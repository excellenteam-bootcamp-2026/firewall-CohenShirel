/**
 * Driving adapter for HTTP/Express.
 * It translates transport input/output to application use-case contracts.
 */
const express = require('express');
import {
  handleAddRules,
  type AddRulesInput,
  type IdGenerator,
  type FirewallRulesRepository,
} from '../application/firewallService';

/**
 * Creates the firewall HTTP router with injected application dependencies.
 */
export function createFirewallRouter(deps: {
  repository: FirewallRulesRepository;
  idGenerator: IdGenerator;
}) {
  const router = express.Router();

  /**
   * Route keeps transport concerns local and delegates business rules to the use case.
   */
  router.post('/api/v1/firewall/rules', (req: any, res: any) => {
    const { type, mode, values } = req.body ?? {};

    const input: AddRulesInput = { type, mode, values };
    const result = handleAddRules(input, {
      repository: deps.repository,
      idGenerator: deps.idGenerator,
    });

    if (result.status === 'error') {
      return res.status(400).json(result);
    }

    return res.status(201).json(result);
  });

  return router;
}
