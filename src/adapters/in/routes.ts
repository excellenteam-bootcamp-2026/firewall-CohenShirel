/**
 * Single source of truth for inbound HTTP paths.
 * Deliberately separate from env.ts: route strings are part of the published API
 * contract, so they must stay importable without triggering environment validation.
 */
export const API_BASE_PATH = '/api/v1';

export const FIREWALL_RULES_PATH = `${API_BASE_PATH}/firewall/rules` as const;
