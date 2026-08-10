/**
 * Canonical business vocabulary for firewall rules. Adding a type or mode here is a
 * domain decision: validators, persistence and DTOs all key off these unions.
 */
export type FirewallRuleType = 'ip' | 'domain' | 'port';
export type FirewallRuleMode = 'blacklist' | 'whitelist';

export interface FirewallRule {
  id: number;
  type: FirewallRuleType;
  mode: FirewallRuleMode;
  value: string | number;
  active: boolean;
}
