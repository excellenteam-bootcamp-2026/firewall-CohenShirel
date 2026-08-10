import type { FirewallRule } from '../../domain/firewall/FirewallRule';
import type { IIdGenerator } from '../../ports/IIdGenerator';
import type { IFirewallRepository } from '../../ports/IFirewallRepository';

const rules: FirewallRule[] = [];
let nextId = 1;

const cloneRule = (rule: FirewallRule): FirewallRule => structuredClone(rule);

const cloneRules = (items: FirewallRule[]): FirewallRule[] =>
  items.map(cloneRule);

export const idGenerator: IIdGenerator = {
  async nextIds(count: number): Promise<number[]> {
    return Array.from({ length: Math.max(count, 0) }, () => nextId++);
  },
};

export const firewallRepository: IFirewallRepository & {
  getAll(): FirewallRule[];
  reset(): void;
} = {
  async saveBatch(newRules: FirewallRule[]): Promise<void> {
    rules.push(...cloneRules(newRules));
  },

  async readAll(): Promise<FirewallRule[]> {
    return cloneRules(rules);
  },

  getAll(): FirewallRule[] {
    return cloneRules(rules);
  },

  reset(): void {
    rules.length = 0;
    nextId = 1;
  },
};
