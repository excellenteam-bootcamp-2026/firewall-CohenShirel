import type { FirewallDatabase } from '../../src/adapters/out/db';
import { PersistenceDataError } from '../../src/adapters/out/persistence';
import { PostgresRepository } from '../../src/adapters/out/postgresRepository';
import type { FirewallRuleRow } from '../../src/adapters/out/schema';

/**
 * Row-to-domain mapping is asserted against a fake select chain: the interesting cases are
 * rows no healthy database would produce, which a live instance cannot be made to return.
 */
const createDatabase = (rows: FirewallRuleRow[]): FirewallDatabase =>
  ({
    select: () => ({
      from: () => ({
        orderBy: async () => rows,
      }),
    }),
  } as unknown as FirewallDatabase);

const row = (overrides: Partial<FirewallRuleRow>): FirewallRuleRow => ({
  id: 1,
  type: 'ip',
  mode: 'blacklist',
  value: '10.0.0.1',
  active: true,
  ...overrides,
});

describe('PostgresRepository row mapping', () => {
  it('maps a port rule value back to a number', async () => {
    const repository = new PostgresRepository(
      createDatabase([row({ id: 4, type: 'port', value: '8080' })])
    );

    await expect(repository.readAll()).resolves.toEqual([
      { id: 4, type: 'port', mode: 'blacklist', value: 8080, active: true },
    ]);
  });

  it('leaves textual rule values untouched', async () => {
    const repository = new PostgresRepository(
      createDatabase([row({ type: 'domain', value: 'example.com' })])
    );

    await expect(repository.readAll()).resolves.toEqual([
      { id: 1, type: 'domain', mode: 'blacklist', value: 'example.com', active: true },
    ]);
  });

  it.each(['8080a', '', ' 80', '80.5', '1e3', 'NaN'])(
    'refuses a corrupt port value (%p) instead of yielding NaN',
    async (corruptValue) => {
      const repository = new PostgresRepository(
        createDatabase([row({ id: 12, type: 'port', value: corruptValue })])
      );

      await expect(repository.readAll()).rejects.toThrow(PersistenceDataError);
      await expect(repository.readAll()).rejects.toThrow(
        /firewall_rules\.value for rule 12/
      );
    }
  );
});
