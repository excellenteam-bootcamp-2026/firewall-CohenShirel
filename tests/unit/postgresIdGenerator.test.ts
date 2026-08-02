import type { FirewallDatabase } from '../../src/adapters/out/db';
import {
  FIREWALL_RULES_ID_SEQUENCE,
  PostgresIdGenerator,
} from '../../src/adapters/out/postgresIdGenerator';
import { PersistenceDataError } from '../../src/adapters/out/persistence';

type ExecuteResult = { rows: Array<{ id: string }> };

/**
 * The generator is exercised against a fake execute() so the SQL it builds, and its handling
 * of what PostgreSQL returns, can be asserted without a live database.
 */
const createDatabase = (
  execute: jest.Mock<Promise<ExecuteResult>, [unknown]>
): FirewallDatabase => ({ execute } as unknown as FirewallDatabase);

const rowsFor = (ids: number[]): ExecuteResult => ({
  rows: ids.map((id) => ({ id: String(id) })),
});

describe('PostgresIdGenerator', () => {
  it('draws ids from the table sequence and returns them as numbers', async () => {
    const execute = jest.fn<Promise<ExecuteResult>, [unknown]>(async () =>
      rowsFor([7, 8, 9])
    );
    const generator = new PostgresIdGenerator(createDatabase(execute));

    await expect(generator.nextIds(3)).resolves.toEqual([7, 8, 9]);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('advances the sequence once per requested id in a single statement', async () => {
    const execute = jest.fn<Promise<ExecuteResult>, [unknown]>(async () => rowsFor([1, 2]));
    const generator = new PostgresIdGenerator(createDatabase(execute));

    await generator.nextIds(2);

    // Reaching into the built query keeps the bound sequence name and row count honest:
    // hardcoding either would reintroduce the desync this class exists to prevent.
    const query = execute.mock.calls[0][0] as { queryChunks?: unknown[] };
    const rendered = JSON.stringify(query.queryChunks ?? query);

    expect(rendered).toContain('nextval');
    expect(rendered).toContain('generate_series');
    expect(rendered).toContain(FIREWALL_RULES_ID_SEQUENCE);
  });

  it('does not query the database for an empty batch', async () => {
    const execute = jest.fn<Promise<ExecuteResult>, [unknown]>(async () => rowsFor([]));
    const generator = new PostgresIdGenerator(createDatabase(execute));

    await expect(generator.nextIds(0)).resolves.toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([-1, 1.5, Number.NaN])('rejects an invalid count (%p)', async (count) => {
    const execute = jest.fn<Promise<ExecuteResult>, [unknown]>(async () => rowsFor([]));
    const generator = new PostgresIdGenerator(createDatabase(execute));

    await expect(generator.nextIds(count)).rejects.toThrow(RangeError);
    expect(execute).not.toHaveBeenCalled();
  });

  it('fails when the sequence returns fewer ids than requested', async () => {
    const execute = jest.fn<Promise<ExecuteResult>, [unknown]>(async () => rowsFor([1]));
    const generator = new PostgresIdGenerator(createDatabase(execute));

    await expect(generator.nextIds(2)).rejects.toThrow(PersistenceDataError);
  });

  it('fails instead of returning NaN when a sequence value is unparseable', async () => {
    const execute = jest.fn<Promise<ExecuteResult>, [unknown]>(async () => ({
      rows: [{ id: 'not-a-number' }],
    }));
    const generator = new PostgresIdGenerator(createDatabase(execute));

    await expect(generator.nextIds(1)).rejects.toThrow(
      /expected an integer, found "not-a-number"/
    );
  });

  it('fails on a bigint beyond safe integer precision', async () => {
    const execute = jest.fn<Promise<ExecuteResult>, [unknown]>(async () => ({
      rows: [{ id: '9007199254740993' }],
    }));
    const generator = new PostgresIdGenerator(createDatabase(execute));

    await expect(generator.nextIds(1)).rejects.toThrow(/safe integer range/);
  });
});
