import type { AddRulesInput } from '../../../ports/IFirewallRulesUseCase';

export interface AddRulesRequestBody {
  type?: unknown;
  mode?: unknown;
  values?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Missing and malformed fields are passed through as undefined rather than rejected here,
 * so the domain validator remains the single source of error codes and messages.
 */
export function toAddRulesInput(body: unknown): AddRulesInput {
  if (!isRecord(body)) {
    return {
      type: undefined,
      mode: undefined,
      values: undefined,
    };
  }

  return {
    type: body.type,
    mode: body.mode,
    values: body.values,
  };
}
