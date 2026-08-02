/**
 * Outbound persistence adapter: the only place in the process that knows firewall rules
 * live in PostgreSQL. Rows are translated at this boundary, so nothing above this file
 * ever sees a database row and nothing below it ever sees a domain entity.
 */
import { asc, sql } from 'drizzle-orm';
import type { FirewallDatabase } from './db';
import { parseStoredInteger } from './persistence';
import {
  firewallRules,
  type FirewallRuleRow,
  type NewFirewallRuleRow,
} from './schema';
import type { FirewallRule } from '../../domain/firewall/FirewallRule';
import type { IFirewallRepository } from '../../ports/IFirewallRepository';

/**
 * PostgreSQL binds at most 65535 parameters per statement. At five columns per row a batch
 * of this size stays far below that ceiling, so an oversized request degrades into several
 * statements inside the same transaction instead of failing at the driver.
 */
const MAX_ROWS_PER_INSERT = 1_000;

const toRow = (rule: FirewallRule): NewFirewallRuleRow => ({
  id: rule.id,
  type: rule.type,
  mode: rule.mode,
  // Ports reach the domain as numbers and the column is textual: normalise here rather
  // than letting the driver decide how to render them.
  value: String(rule.value),
  active: rule.active,
});

/**
 * A port rule's value is declared `number` in the domain, so `Number(row.value)` on corrupt
 * text would smuggle `NaN` past the type system and into rule evaluation. Refusing the row
 * keeps the failure at the boundary that can still name the offending id.
 */
const toDomain = (row: FirewallRuleRow): FirewallRule => ({
  id: row.id,
  type: row.type,
  mode: row.mode,
  value:
    row.type === 'port'
      ? parseStoredInteger(row.value, `firewall_rules.value for rule ${row.id}`)
      : row.value,
  active: row.active,
});

const chunk = <TItem>(items: readonly TItem[], size: number): TItem[][] => {
  const chunks: TItem[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

export class PostgresRepository implements IFirewallRepository {
  /**
   * The database handle is injected so a test can drive this adapter against a throwaway
   * connection, while production keeps the process-wide singleton.
   */
  constructor(private readonly database: FirewallDatabase) {}

  /**
   * One transaction per batch. The use case validates the whole request before calling in
   * and answers with every rule it created, so a partially stored batch would make that
   * response a lie. The caller's array is mapped, never mutated.
   */
  public async saveBatch(rules: readonly FirewallRule[]): Promise<void> {
    // Drizzle rejects an INSERT with no VALUES, so an empty batch is a no-op.
    if (rules.length === 0) {
      return;
    }

    const rows = rules.map(toRow);

    await this.database.transaction(async (tx) => {
      for (const rowsChunk of chunk(rows, MAX_ROWS_PER_INSERT)) {
        await tx.insert(firewallRules).values(rowsChunk);
      }
    });
  }

  /**
   * Ordered by id because PostgreSQL guarantees no implicit row order, and callers compare
   * whole batches. Every row becomes a fresh entity, so a reader cannot mutate stored state.
   */
  public async readAll(): Promise<FirewallRule[]> {
    const rows = await this.database
      .select()
      .from(firewallRules)
      .orderBy(asc(firewallRules.id));

    return rows.map(toDomain);
  }

  /**
   * Test-only escape hatch. TRUNCATE also rewinds the serial sequence, which matters
   * because suites assert on exact ids; it is not a production operation.
   */
  public async reset(): Promise<void> {
    await this.database.execute(
      sql`TRUNCATE TABLE ${firewallRules} RESTART IDENTITY`
    );
  }
}

export const createPostgresRepository = (database: FirewallDatabase): PostgresRepository =>
  new PostgresRepository(database);
