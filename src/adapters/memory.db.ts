/**
 * In-memory driven adapter implementing persistence-related ports.
 * It is intentionally simple and process-local, making it suitable for local runs and tests.
 */
import type { FirewallRule } from '../domain/firewall/FirewallRule';

const rules: FirewallRule[] = [];
let nextId = 1;

export const idGenerator = {
  /**
   * Provides monotonic IDs so use cases stay storage-agnostic.
   */
  nextId(): number {
    return nextId++;
  },
};

export const firewallRepository = {
  /**
   * Persists a validated batch in one append operation.
   */
  addMany(newRules: FirewallRule[]): void {
    rules.push(...newRules);
  },

  /**
   * Returns a defensive copy to protect internal mutable state.
   */
  getAll(): FirewallRule[] {
    return [...rules];
  },

  /**
   * Test utility for deterministic isolation between test cases.
   */
  reset(): void {
    rules.length = 0;
    nextId = 1;
  },
};
