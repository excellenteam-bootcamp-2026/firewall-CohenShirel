import type { FirewallRule } from '../../src/domain/firewall/FirewallRule';
import type { IFirewallRepository } from '../../src/ports/IFirewallRepository';

export interface FirewallRepositoryContractHarness {
  name: string;
  repository: IFirewallRepository;
  readAll(): Promise<FirewallRule[]> | FirewallRule[];
  reset?(): Promise<void> | void;
}

const sampleRule = (id: number, value: string | number): FirewallRule => ({
  id,
  type: typeof value === 'number' ? 'port' : 'ip',
  mode: 'blacklist',
  value,
  active: true,
});

const cloneRules = (rules: FirewallRule[]): FirewallRule[] =>
  structuredClone(rules);

/**
 * Reusable repository contract suite.
 * Any adapter implementing IFirewallRepository should satisfy these behaviors.
 */
export function runFirewallRepositoryContractSuite(
  createHarness: () => FirewallRepositoryContractHarness
): void {
  describe('IFirewallRepository contract', () => {
    let harness: FirewallRepositoryContractHarness;

    beforeEach(async () => {
      harness = createHarness();
      await harness.reset?.();
    });

    it('persists all rules in a batch', async () => {
      const batch = [sampleRule(1, '10.0.0.1'), sampleRule(2, 443)];

      await harness.repository.saveBatch(batch);

      await expect(harness.readAll()).resolves.toEqual(batch);
    });

    it('appends across multiple batch writes', async () => {
      const firstBatch = [sampleRule(1, '10.0.0.1')];
      const secondBatch = [sampleRule(2, '8.8.8.8')];

      await harness.repository.saveBatch(firstBatch);
      await harness.repository.saveBatch(secondBatch);

      await expect(harness.readAll()).resolves.toEqual([
        ...firstBatch,
        ...secondBatch,
      ]);
    });

    it('does not mutate caller batch array', async () => {
      const batch = [sampleRule(1, '10.0.0.1')];
      const originalSnapshot = cloneRules(batch);

      await harness.repository.saveBatch(batch);

      expect(batch).toEqual(originalSnapshot);
    });

    it('decouples persisted state from caller-owned rule objects', async () => {
      const batch = [sampleRule(1, '10.0.0.1')];

      await harness.repository.saveBatch(batch);
      batch[0].value = '8.8.8.8';
      batch[0].active = false;

      await expect(harness.readAll()).resolves.toEqual([sampleRule(1, '10.0.0.1')]);
    });

    it('returns detached rule objects on every read', async () => {
      await harness.repository.saveBatch([sampleRule(1, '10.0.0.1')]);

      const firstRead = await harness.readAll();
      firstRead[0].value = '8.8.8.8';
      firstRead[0].active = false;

      await expect(harness.readAll()).resolves.toEqual([sampleRule(1, '10.0.0.1')]);
    });
  });
}
