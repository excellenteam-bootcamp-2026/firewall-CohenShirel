import { validateAddRulesInput } from '../domain/firewall/FirewallValidators';
import type {
  FirewallRule,
  FirewallRuleMode,
  FirewallRuleType,
} from '../domain/firewall/FirewallRule';
import type { IIdGenerator } from '../ports/IIdGenerator';
import type { IFirewallRepository } from '../ports/IFirewallRepository';
import type {
  AddRulesInput,
  AddRulesResult,
  AddRulesSuccess,
  AddRulesSuccessByType,
  AddRulesValueByType,
  GetRulesResult,
  IFirewallRulesUseCase,
} from '../ports/IFirewallRulesUseCase';

type CreatedRuleValue<TType extends FirewallRuleType> = AddRulesSuccessByType<TType>['values'][number];

export class FirewallService implements IFirewallRulesUseCase {
  constructor(
    private readonly repository: IFirewallRepository,
    private readonly idGenerator: IIdGenerator
  ) {}

  /**
   * Validates the full batch before persisting anything, so the operation is atomic:
   * either every rule in the request is created, or none is.
   */
  async handleAddRules(input: AddRulesInput): Promise<AddRulesResult> {
    const validation = validateAddRulesInput({
      type: input.type,
      mode: input.mode,
      values: input.values,
    });

    if (!validation.ok) {
      return {
        status: 'error',
        code: validation.error.code,
        message: validation.error.message,
      };
    }

    const type = input.type as FirewallRuleType;
    const mode = input.mode as FirewallRuleMode;

    switch (type) {
      case 'ip':
        return this.createSuccess(type, mode, input.values as AddRulesValueByType['ip'][]);
      case 'domain':
        return this.createSuccess(type, mode, input.values as AddRulesValueByType['domain'][]);
      case 'port':
        return this.createSuccess(type, mode, input.values as AddRulesValueByType['port'][]);
    }
  }

  async handleGetRules(): Promise<GetRulesResult> {
    try {
      const rules = await this.repository.readAll();

      return {
        status: 'success',
        rules,
      };
    } catch (error) {
      return {
        status: 'error',
        code: 'GET_RULES_FAILED',
        message: error instanceof Error ? error.message : 'Failed to load firewall rules.',
      };
    }
  }

  private async createSuccess<TType extends FirewallRuleType>(
    type: TType,
    mode: FirewallRuleMode,
    values: AddRulesValueByType[TType][]
  ): Promise<AddRulesSuccessByType<TType>> {
    // One reservation for the whole batch: every rule needs its ID before the single write
    // that stores them, and the response has to name each rule it created.
    const ids = await this.idGenerator.nextIds(values.length);

    if (ids.length !== values.length) {
      throw new Error(
        `ID generator returned ${ids.length} ID(s) for ${values.length} rule(s).`
      );
    }

    const newRules: FirewallRule[] = [];
    const createdValues: Array<CreatedRuleValue<TType>> = [];

    values.forEach((value, index) => {
      const newRule: FirewallRule = {
        id: ids[index],
        type,
        mode,
        value,
        active: true,
      };

      newRules.push(newRule);
      createdValues.push({
        id: newRule.id,
        value,
        active: newRule.active,
      });
    });

    await this.repository.saveBatch(newRules);

    return {
      type,
      mode,
      values: createdValues,
      status: 'success',
    };
  }
}
