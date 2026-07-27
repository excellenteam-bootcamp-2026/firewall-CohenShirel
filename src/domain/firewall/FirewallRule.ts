/**
 * Domain types for firewall rules.
 * This file defines the canonical business vocabulary shared across application and adapters.
 */
export type FirewallRuleType = 'ip' | 'domain' | 'port';
export type FirewallRuleMode = 'blacklist' | 'whitelist';

/**
 * Immutable shape of a firewall rule as understood by the domain.
 */
export interface FirewallRule {
  id: number;
  type: FirewallRuleType;
  mode: FirewallRuleMode;
  value: string | number;
  active: boolean;
}
