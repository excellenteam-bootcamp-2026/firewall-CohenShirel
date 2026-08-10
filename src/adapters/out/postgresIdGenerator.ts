/**
 * Reserves rule IDs from the sequence that owns `firewall_rules.id`.
 *
 * The serial column and the application must not be two independent sources of IDs. When
 * IDs come from anywhere else, the sequence never advances past 1, so the first row that
 * ever omits an explicit ID collides with an existing one and the INSERT fails on the
 * primary key. Drawing from `nextval` makes the two the same source by construction.
 */
import { sql } from 'drizzle-orm';
import type { FirewallDatabase } from './db';
import { PersistenceDataError, parseStoredInteger } from './persistence';
import type { IIdGenerator } from '../../ports/IIdGenerator';

/** Sequence implicitly created by the `serial` column; renaming the table renames it too. */
export const FIREWALL_RULES_ID_SEQUENCE = 'firewall_rules_id_seq';

/**
 * `nextval` returns bigint, which node-postgres surfaces as a string to avoid losing
 * precision. A type alias rather than an interface: Drizzle's row generic requires an
 * implicit index signature, which interfaces do not provide.
 */
type SequenceRow = { id: string };

export class PostgresIdGenerator implements IIdGenerator {
  /**
   * Both dependencies are injected: a test can drive a throwaway connection, and a renamed
   * table or non-default schema only needs a different sequence name here.
   */
  constructor(
    private readonly database: FirewallDatabase,
    private readonly sequenceName: string = FIREWALL_RULES_ID_SEQUENCE
  ) {}

  /**
   * One round trip per batch rather than one per rule: `generate_series` drives `nextval`
   * exactly `count` times inside a single statement. Sequence increments are never rolled
   * back, so a failed batch burns its IDs — gaps are expected and harmless, duplicates are
   * what the primary key would reject.
   */
  public async nextIds(count: number): Promise<number[]> {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new RangeError(
        `nextIds expects a non-negative integer count, received ${count}.`
      );
    }

    // generate_series(1, 0) is empty, so this is only a saved round trip, not a special case.
    if (count === 0) {
      return [];
    }

    const result = await this.database.execute<SequenceRow>(
      sql`SELECT nextval(${this.sequenceName}::regclass)::text AS id FROM generate_series(1, ${count})`
    );

    const rows = result.rows;

    if (rows.length !== count) {
      throw new PersistenceDataError(
        `Sequence ${this.sequenceName} returned ${rows.length} ID(s) for a request of ${count}.`
      );
    }

    return rows.map((row, index) =>
      parseStoredInteger(row.id, `Sequence ${this.sequenceName} ID at position ${index}`)
    );
  }
}

export const createPostgresIdGenerator = (
  database: FirewallDatabase,
  sequenceName: string = FIREWALL_RULES_ID_SEQUENCE
): PostgresIdGenerator => new PostgresIdGenerator(database, sequenceName);
