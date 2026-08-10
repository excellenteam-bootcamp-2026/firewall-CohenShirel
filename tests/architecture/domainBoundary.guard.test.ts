import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');

interface LayerRule {
  layer: string;
  root: string;
  /** Path segments this layer must never resolve an import to. */
  forbiddenSegments: string[];
  /** Whether the layer is allowed to depend on npm packages / node builtins. */
  allowExternalPackages: boolean;
}

/**
 * `main` is the composition root and is intentionally absent: wiring concrete adapters
 * into the application is its whole job, so it may reach into every layer.
 * `main` is likewise missing from the adapters rule because infrastructure legitimately
 * reads validated startup config from `main/env`.
 */
const layerRules: LayerRule[] = [
  {
    layer: 'domain',
    root: 'src/domain',
    forbiddenSegments: ['/adapters/', '/application/', '/main/', '/ports/'],
    allowExternalPackages: false,
  },
  {
    layer: 'ports',
    root: 'src/ports',
    forbiddenSegments: ['/adapters/', '/application/', '/main/'],
    allowExternalPackages: false,
  },
  {
    layer: 'application',
    root: 'src/application',
    forbiddenSegments: ['/adapters/', '/main/'],
    allowExternalPackages: false,
  },
  {
    layer: 'adapters',
    root: 'src/adapters',
    forbiddenSegments: ['/application/'],
    allowExternalPackages: true,
  },
];

const toPosix = (value: string): string => value.replace(/\\/g, '/');

const getTsFilesRecursively = (dirPath: string): string[] => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      return getTsFilesRecursively(fullPath);
    }

    return entry.isFile() && fullPath.endsWith('.ts') ? [fullPath] : [];
  });
};

/**
 * Every syntax a TypeScript file can use to pull in another module. `require` and dynamic
 * `import()` matter as much as static imports: a layer violation smuggled in through
 * `require` is still a layer violation, and the CommonJS output makes it easy to write.
 * Patterns tolerate newlines so multi-line `import type { ... } from '...'` is not missed.
 */
const moduleSpecifierPatterns: RegExp[] = [
  // Static import/re-export. Anchored to the line start because a bare `\bimport` also
  // matches inside specifiers such as './multi-line-import'.
  /^\s*import\s+(?:type\s+)?[\s\S]*?\bfrom\s*['"]([^'"]+)['"]/gm,
  /^\s*export\s+(?:type\s+)?[\s\S]*?\bfrom\s*['"]([^'"]+)['"]/gm,
  // Side-effect import.
  /^\s*import\s+['"]([^'"]+)['"]/gm,
  // Call forms, which can appear anywhere inside an expression.
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

const moduleSpecifiersFrom = (content: string): string[] => {
  const specifiers = new Set<string>();

  for (const pattern of moduleSpecifierPatterns) {
    for (const match of content.matchAll(pattern)) {
      specifiers.add(match[1]);
    }
  }

  return [...specifiers];
};

const violationsFor = (filePath: string, content: string, rule: LayerRule): string[] => {
  const relativePath = toPosix(path.relative(projectRoot, filePath));
  const violations: string[] = [];

  for (const specifier of moduleSpecifiersFrom(content)) {
    if (!specifier.startsWith('.')) {
      if (!rule.allowExternalPackages) {
        violations.push(`${relativePath}: external dependency is not allowed (${specifier})`);
      }

      continue;
    }

    const resolved = toPosix(path.normalize(path.join(path.dirname(filePath), specifier)));
    const forbiddenSegment = rule.forbiddenSegments.find((segment) => resolved.includes(segment));

    if (forbiddenSegment) {
      violations.push(
        `${relativePath}: must not depend on ${forbiddenSegment} (${specifier})`
      );
    }
  }

  return violations;
};

describe('Architecture boundary guard', () => {
  it.each(layerRules)('$layer does not depend on forbidden layers', (rule) => {
    const layerRoot = path.resolve(projectRoot, rule.root);
    const files = getTsFilesRecursively(layerRoot);

    expect(files.length).toBeGreaterThan(0);

    const violations = files.flatMap((filePath) =>
      violationsFor(filePath, fs.readFileSync(filePath, 'utf8'), rule)
    );

    expect(violations).toEqual([]);
  });

  describe('specifier extraction', () => {
    it('detects every module syntax, including require and multi-line imports', () => {
      const sample = [
        "import defaultExport from './default-import';",
        "import type {\n  Multi,\n  Line,\n} from './multi-line-import';",
        "import './side-effect-import';",
        "export { reExported } from './re-export';",
        "const lazy = await import('./dynamic-import');",
        "const legacy = require('./require-call');",
      ].join('\n');

      expect(moduleSpecifiersFrom(sample).sort()).toEqual([
        './default-import',
        './dynamic-import',
        './multi-line-import',
        './re-export',
        './require-call',
        './side-effect-import',
      ]);
    });
  });

  describe('rule enforcement', () => {
    const domainRule = layerRules.find((rule) => rule.layer === 'domain') as LayerRule;
    const adaptersRule = layerRules.find((rule) => rule.layer === 'adapters') as LayerRule;
    const domainFile = path.join(projectRoot, 'src/domain/firewall/Sample.ts');
    const adapterFile = path.join(projectRoot, 'src/adapters/in/sample.adapter.ts');

    it('rejects a domain file reaching outward via import or require', () => {
      const content = [
        "import { FirewallService } from '../../application/firewallService';",
        "const express = require('express');",
      ].join('\n');

      expect(violationsFor(domainFile, content, domainRule)).toEqual([
        'src/domain/firewall/Sample.ts: must not depend on /application/ (../../application/firewallService)',
        'src/domain/firewall/Sample.ts: external dependency is not allowed (express)',
      ]);
    });

    it('rejects an adapter reaching into the application layer via require', () => {
      const content = "const { FirewallService } = require('../../application/firewallService');";

      expect(violationsFor(adapterFile, content, adaptersRule)).toEqual([
        'src/adapters/in/sample.adapter.ts: must not depend on /application/ (../../application/firewallService)',
      ]);
    });

    it('allows an adapter to depend on ports, domain and npm packages', () => {
      const content = [
        "import express from 'express';",
        "import type { FirewallRule } from '../../domain/firewall/FirewallRule';",
        "import type { IFirewallRepository } from '../../ports/IFirewallRepository';",
      ].join('\n');

      expect(violationsFor(adapterFile, content, adaptersRule)).toEqual([]);
    });
  });
});
