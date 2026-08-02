/**
 * Inbound port for firewall rule creation. Driving adapters depend on this interface
 * rather than on FirewallService, which is what keeps them out of the application layer.
 */
import type {
  FirewallRuleMode,
  FirewallRuleType,
} from '../domain/firewall/FirewallRule';

/**
 * Fields are `unknown` on purpose: an adapter cannot hand over a value the domain has not
 * validated, because there is no type it could assert to satisfy this contract.
 */
export interface AddRulesInput {
  type: unknown;
  mode: unknown;
  values: unknown;
}

export interface AddRulesValueByType {
  ip: string;
  domain: string;
  port: number;
}

export interface AddRulesSuccessByType<TType extends FirewallRuleType> {
  type: TType;
  mode: FirewallRuleMode;
  values: Array<{
    id: number;
    value: AddRulesValueByType[TType];
    active: boolean;
  }>;
  status: 'success';
}

export type AddRulesSuccess = {
  [TType in FirewallRuleType]: AddRulesSuccessByType<TType>;
}[FirewallRuleType];

export interface AddRulesError {
  status: 'error';
  code: string;
  message: string;
}

export type AddRulesResult = AddRulesSuccess | AddRulesError;

export interface IFirewallRulesUseCase {
  handleAddRules(input: AddRulesInput): Promise<AddRulesResult>;
}