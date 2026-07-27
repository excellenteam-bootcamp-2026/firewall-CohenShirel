"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidRuleMode = isValidRuleMode;
exports.isValidRuleType = isValidRuleType;
exports.isValidIPv4 = isValidIPv4;
exports.isValidDomain = isValidDomain;
exports.isValidPort = isValidPort;
exports.isValidValueForType = isValidValueForType;
exports.validateAddRulesInput = validateAddRulesInput;
const ok = () => ({ ok: true });
const fail = (code, message) => ({
    ok: false,
    error: { code, message },
});
/**
 * Restricts modes to explicit allow-list values to prevent accidental policy drift.
 */
function isValidRuleMode(mode) {
    return mode === 'blacklist' || mode === 'whitelist';
}
/**
 * Restricts rule types to the domain-supported categories.
 */
function isValidRuleType(type) {
    return type === 'ip' || type === 'domain' || type === 'port';
}
// Monolith parity: IP validation is IPv4-only.
/**
 * Validates IPv4 in pure domain code without relying on Node networking helpers.
 * Keeping this logic local preserves portability and testability.
 */
function isValidIPv4(value) {
    if (typeof value !== 'string')
        return false;
    const parts = value.split('.');
    if (parts.length !== 4)
        return false;
    for (const part of parts) {
        if (!/^(0|[1-9]\d{0,2})$/.test(part))
            return false;
        const n = Number(part);
        if (!Number.isInteger(n) || n < 0 || n > 255)
            return false;
    }
    return true;
}
/**
 * Accepts host-like domains only; rejects protocol/path/port to enforce normalized rule values.
 */
function isValidDomain(value) {
    if (typeof value !== 'string' || value.length === 0)
        return false;
    if (value.includes('://') || value.includes('/') || value.includes(':')) {
        return false;
    }
    const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return domainRegex.test(value);
}
/**
 * Validates TCP/UDP port range with strict integer semantics.
 */
function isValidPort(value) {
    return (typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 1 &&
        value <= 65535);
}
/**
 * Dispatches value validation by declared rule type.
 */
function isValidValueForType(type, value) {
    if (type === 'ip')
        return isValidIPv4(value);
    if (type === 'domain')
        return isValidDomain(value);
    return isValidPort(value);
}
/**
 * Performs all-or-nothing validation for add-rules requests.
 * Returning domain error codes keeps transport-specific mapping (HTTP status, etc.) outside the domain.
 */
function validateAddRulesInput(input) {
    const { type, mode, values } = input;
    if (!isValidRuleType(type)) {
        return fail('INVALID_RULE_TYPE', 'Rule type must be one of: ip, domain, port.');
    }
    if (!isValidRuleMode(mode)) {
        return fail('INVALID_MODE', "Mode must be strictly either 'blacklist' or 'whitelist'.");
    }
    if (!Array.isArray(values) || values.length === 0) {
        return fail('INVALID_VALUES', 'Values must be a non-empty array.');
    }
    for (const v of values) {
        if (!isValidValueForType(type, v)) {
            if (type === 'ip') {
                return fail('INVALID_IP', 'Only valid IPv4 addresses are accepted.');
            }
            if (type === 'domain') {
                return fail('INVALID_DOMAIN', 'Domains must not include protocol, path, or port.');
            }
            return fail('INVALID_PORT', 'Ports must be integers between 1 and 65535.');
        }
    }
    return ok();
}
