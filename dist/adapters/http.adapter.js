"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFirewallRouter = createFirewallRouter;
/**
 * Driving adapter for HTTP/Express.
 * It translates transport input/output to application use-case contracts.
 */
const express = require('express');
const firewallService_1 = require("../application/firewallService");
/**
 * Creates the firewall HTTP router with injected application dependencies.
 */
function createFirewallRouter(deps) {
    const router = express.Router();
    /**
     * Route keeps transport concerns local and delegates business rules to the use case.
     */
    router.post('/api/v1/firewall/rules', (req, res) => {
        const { type, mode, values } = req.body ?? {};
        const input = { type, mode, values };
        const result = (0, firewallService_1.handleAddRules)(input, {
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
