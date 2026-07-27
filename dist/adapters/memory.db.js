"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.firewallRepository = exports.idGenerator = void 0;
const rules = [];
let nextId = 1;
exports.idGenerator = {
    /**
     * Provides monotonic IDs so use cases stay storage-agnostic.
     */
    nextId() {
        return nextId++;
    },
};
exports.firewallRepository = {
    /**
     * Persists a validated batch in one append operation.
     */
    addMany(newRules) {
        rules.push(...newRules);
    },
    /**
     * Returns a defensive copy to protect internal mutable state.
     */
    getAll() {
        return [...rules];
    },
    /**
     * Test utility for deterministic isolation between test cases.
     */
    reset() {
        rules.length = 0;
        nextId = 1;
    },
};
