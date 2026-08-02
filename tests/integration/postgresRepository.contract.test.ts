import { sql } from 'drizzle-orm';
import { createDatabaseConnection } from '../../src/adapters/out/db';
import { createPostgresRepository } from '../../src/adapters/out/postgresRepository';
import { runFirewallRepositoryContractSuite } from '../contracts/firewallRepository.contract';

const shouldRunPostgresContracts = process.env.RUN_POSTGRES_CONTRACT_TESTS === 'true';
const dbManager = createDatabaseConnection(process.env.DATABASE_URL ?? 'postgres://localhost:5432/firewall_test');
const postgresRepository = createPostgresRepository(dbManager.db);

const ensureTableExists = async (): Promise<void> => {
  await dbManager.db.execute(sql`
    CREATE TABLE IF NOT EXISTS firewall_rules (
      id SERIAL PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      mode VARCHAR(50) NOT NULL,
      value VARCHAR(255) NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);
};

if (!shouldRunPostgresContracts) {
  describe('Postgres repository contract harness', () => {
    it('is disabled unless RUN_POSTGRES_CONTRACT_TESTS=true', () => {
      expect(shouldRunPostgresContracts).toBe(false);
    });
  });
} else {
  describe('Postgres repository contract harness', () => {
    beforeAll(async () => {
      await dbManager.connect({ maxAttempts: 3 });
      await ensureTableExists();
    });

    afterAll(async () => {
      await dbManager.close();
    });

    runFirewallRepositoryContractSuite(() => ({
      name: 'postgres repository',
      repository: postgresRepository,
      readAll: () => postgresRepository.readAll(),
      reset: () => postgresRepository.reset(),
    }));
  });
}
