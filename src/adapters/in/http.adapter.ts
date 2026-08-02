import express from 'express';
import type { Request, Response } from 'express';
import {
  type AddRulesRequestBody,
  toAddRulesInput,
} from './dto/firewall.dto';
import type {
  AddRulesResult,
  IFirewallRulesUseCase,
} from '../../ports/IFirewallRulesUseCase';

type AddRulesRequest = Request<Record<string, never>, AddRulesResult, AddRulesRequestBody>;

export function createFirewallRouter(deps: {
  firewallRulesUseCase: IFirewallRulesUseCase;
  firewallRulesPath: string;
}) {
  const router = express.Router();

  router.post(deps.firewallRulesPath, async (req: AddRulesRequest, res: Response<AddRulesResult>) => {
    const input = toAddRulesInput(req.body);
    const result = await deps.firewallRulesUseCase.handleAddRules(input);

    if (result.status === 'error') {
      return res.status(400).json(result);
    }

    return res.status(201).json(result);
  });

  return router;
}
