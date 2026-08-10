import { sql } from 'drizzle-orm';
import { createDatabaseConnection } from '../../src/adapters/out/db';
import { createPostgresRepository } from '../../src/adapters/out/postgresRepository';
import { runFirewallRepositoryContractSuite } from '../contracts/firewallRepository.contract';

const shouldRunPostgresContracts = process.env.RUN_POSTGRES_CONTRACT_TESTS === 'true';
const testDatabaseName = process.env.ENV === 'prod' ? 'firewall_db_prod' : 'firewall_db_dev';
const testDatabaseUri = `postgres://${encodeURIComponent(process.env.DB_USER ?? 'postgres')}:${encodeURIComponent(
  process.env.DB_PASSWORD ?? 'postgres'
)}@${process.env.DB_HOST ?? 'localhost'}:${process.env.DB_PORT ?? '5432'}/${testDatabaseName}`;

const dbManager = createDatabaseConnection(testDatabaseUri);
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
