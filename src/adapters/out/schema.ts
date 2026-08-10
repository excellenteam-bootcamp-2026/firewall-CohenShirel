/**
 * Physical table definition for firewall rules. This file is the only place that knows the
 * storage shape; it must stay in sync with the FirewallRule domain shape.
 *
 * `type` and `mode` are varchar rather than pg enums so widening a domain union does not
 * require a migration, while `$type<...>()` keeps the compile-time types exactly as narrow
 * as the domain unions — so a typo cannot reach an INSERT and a read needs no cast.
 */
import { boolean, pgTable, serial, varchar } from 'drizzle-orm/pg-core';
import type {
  FirewallRuleMode,
  FirewallRuleType,
} from '../../domain/firewall/FirewallRule';

export const firewallRules = pgTable('firewall_rules', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 50 }).$type<FirewallRuleType>().notNull(),
  mode: varchar('mode', { length: 50 }).$type<FirewallRuleMode>().notNull(),
  // Textual for every rule type, ports included: one concept, one column. The adapter
  // converts a port back to a number when it maps the row to a domain entity.
  value: varchar('value', { length: 255 }).notNull(),
  active: boolean('active').notNull().default(true),
});

/** Row shape returned by a SELECT. Never leaves the adapters/out layer. */
export type FirewallRuleRow = typeof firewallRules.$inferSelect;

/** Row shape accepted by an INSERT: `active` is optional because the column defaults. */
export type NewFirewallRuleRow = typeof firewallRules.$inferInsert;
