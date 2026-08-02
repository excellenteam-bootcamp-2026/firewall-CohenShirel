/**
 * Outbound persistence port. Batch-only by design: the use case must be able to store a
 * whole request atomically, which a per-rule save cannot guarantee.
 */
import type { FirewallRule } from '../domain/firewall/FirewallRule';

export interface IFirewallRepository {
  saveBatch(rules: FirewallRule[]): Promise<void>;
}