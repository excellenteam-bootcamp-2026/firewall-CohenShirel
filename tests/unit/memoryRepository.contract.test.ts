import { firewallRepository } from '../../src/adapters/out/memory.db';
import { runFirewallRepositoryContractSuite } from '../contracts/firewallRepository.contract';

runFirewallRepositoryContractSuite(() => ({
  name: 'memory repository',
  repository: firewallRepository,
  readAll: async () => firewallRepository.getAll(),
  reset: () => firewallRepository.reset(),
}));
