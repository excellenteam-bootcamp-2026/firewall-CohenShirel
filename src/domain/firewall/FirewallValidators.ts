/**
 * Validation policy for firewall rule creation. Kept free of framework and I/O
 * dependencies so the same rules apply no matter which adapter drives them.
 */
import type { FirewallRuleMode, FirewallRuleType } from './FirewallRule';

/**
 * Part of the public contract: adapters map these codes onto transport errors,
 * so renaming a code is a breaking API change.
 */
export interface ValidationIssue {
  code: string;
  message: string;
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: ValidationIssue };

const ok = (): ValidationResult => ({ ok: true });

const fail = (code: string, message: string): ValidationResult => ({
  ok: false,
  error: { code, message },
});

export function isValidRuleMode(mode: unknown): mode is FirewallRuleMode {
  return mode === 'blacklist' || mode === 'whitelist';
}

export function isValidRuleType(type: unknown): type is FirewallRuleType {
  return type === 'ip' || type === 'domain' || type === 'port';
}

/**
 * IPv4 only, by product rule — IPv6 addresses are rejected, not normalised.
 * Hand-rolled rather than delegating to a library so the domain keeps zero dependencies.
 */
export function isValidIPv4(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const parts = value.split('.');
  if (parts.length !== 4) return false;

  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return false;
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return false;
  }

  return true;
}

/**
 * Host names only: a protocol, path or port makes the value ambiguous as a rule target,
 * so those are rejected rather than stripped.
 */
export function isValidDomain(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;

  if (value.includes('://') || value.includes('/') || value.includes(':')) {
    return false;
  }

  const labels = value.split('.');

  if (labels.length < 2 || labels.some((label) => label.length === 0)) {
    return false;
  }

  const topLevelLabel = labels[labels.length - 1];
  if (!/^[a-zA-Z]{2,}$/.test(topLevelLabel)) {
    return false;
  }

  return labels.every((label, index) => {
    if (label.startsWith('-') || label.endsWith('-')) {
      return false;
    }

    const labelPattern = index === labels.length - 1
      ? /^[a-zA-Z]{2,}$/
      : /^[a-zA-Z0-9-]+$/;

    return labelPattern.test(label);
  });
}

export function isValidPort(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 65535
  );
}

const validatorByType: Record<FirewallRuleType, (value: unknown) => boolean> = {
  ip: isValidIPv4,
  domain: isValidDomain,
  port: isValidPort,
};

const invalidValueIssueByType: Record<FirewallRuleType, ValidationIssue> = {
  ip: {
    code: 'INVALID_IP',
    message: 'Only valid IPv4 addresses are accepted.',
  },
  domain: {
    code: 'INVALID_DOMAIN',
    message: 'Domains must not include protocol, path, or port.',
  },
  port: {
    code: 'INVALID_PORT',
    message: 'Ports must be integers between 1 and 65535.',
  },
};

export function isValidValueForType(
  type: FirewallRuleType,
  value: unknown
): boolean {
  return validatorByType[type](value);
}

/**
 * Validates the payload as one unit and stops at the first problem, so a caller fixing
 * a request is never chasing a moving target. Returns domain error codes rather than
 * HTTP status codes: transport mapping belongs to the adapters.
 */
export function validateAddRulesInput(input: {
  type: unknown;
  mode: unknown;
  values: unknown;
}): ValidationResult {
  const { type, mode, values } = input;

  if (!isValidRuleType(type)) {
    return fail(
      'INVALID_RULE_TYPE',
      'Rule type must be one of: ip, domain, port.'
    );
  }

  if (!isValidRuleMode(mode)) {
    return fail(
      'INVALID_MODE',
      "Mode must be strictly either 'blacklist' or 'whitelist'."
    );
  }

  if (!Array.isArray(values) || values.length === 0) {
    return fail('INVALID_VALUES', 'Values must be a non-empty array.');
  }

  for (const v of values) {
    if (!isValidValueForType(type, v)) {
      const issue = invalidValueIssueByType[type];
      return fail(issue.code, issue.message);
    }
  }

  return ok();
}
