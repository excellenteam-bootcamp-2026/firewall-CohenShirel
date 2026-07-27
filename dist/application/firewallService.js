"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAddRules = handleAddRules;
/**
 * Application use case for firewall rule creation.
 * This layer orchestrates domain validation and persistence ports without transport coupling.
 */
const FirewallValidators_1 = require("../domain/firewall/FirewallValidators");
/**
 * Creates firewall rules only after batch validation succeeds.
 * This prevents partial writes and keeps state transitions atomic at use-case level.
 */
function handleAddRules(input, deps) {
    const validation = (0, FirewallValidators_1.validateAddRulesInput)({
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
    const type = input.type;
    const mode = input.mode;
    const values = input.values;
    const newRules = [];
    const createdValues = [];
    for (const value of values) {
        const newRule = {
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
