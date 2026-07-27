/**
 * Application use case for firewall rule creation.
 * This layer orchestrates domain validation and persistence ports without transport coupling.
 */
import { validateAddRulesInput } from '../domain/firewall/FirewallValidators';
import type {
  FirewallRule,
  FirewallRuleMode,
  FirewallRuleType,
} from '../domain/firewall/FirewallRule';

/**
 * Output port for persisting rules.
 */
export interface FirewallRulesRepository {
  addMany(rules: FirewallRule[]): void;
}

/**
 * Port that abstracts ID generation strategy.
 */
export interface IdGenerator {
  nextId(): number;
}

/**
 * Use-case input shape intentionally typed as unknown to force explicit validation.
 */
export interface AddRulesInput {
  type: unknown;
  mode: unknown;
  values: unknown;
}

export interface AddRulesSuccess {
  type: FirewallRuleType;
  mode: FirewallRuleMode;
  values: Array<{
    id: number;
    value: string | number;
    active: boolean;
  }>;
  status: 'success';
}

export interface AddRulesError {
  status: 'error';
  code: string;
  message: string;
}

export type AddRulesResult = AddRulesSuccess | AddRulesError;

/**
 * Creates firewall rules only after batch validation succeeds.
 * This prevents partial writes and keeps state transitions atomic at use-case level.
 */
export function handleAddRules(
  input: AddRulesInput,
  deps: {
    idGenerator: IdGenerator;
    repository: FirewallRulesRepository;
  }
): AddRulesResult {
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
  const values = input.values as Array<string | number>;

  const newRules: FirewallRule[] = [];
  const createdValues: AddRulesSuccess['values'] = [];

  for (const value of values) {
    const newRule: FirewallRule = {
      id: deps.idGenerator.nextId(),
      type,
      mode,
      value,
      active: true,
    };

    newRules.push(newRule);
    createdValues.push({
      id: newRule.id,
      value: newRule.value,
      active: newRule.active,
    });
  }

  deps.repository.addMany(newRules);

  return {
    type,
    mode,
    values: createdValues,
    status: 'success',
  };
}
