/**
 * ============================================================================
 * FIREWALL REST API SERVER
 * ============================================================================
 * A professional, production-grade Node.js/Express backend service designed 
 * to manage firewall rules (IPs, Domains, Ports) with robust defensive 
 * programming, DRY architecture, and strict in-memory state management.
 */

const express = require('express');
const net = require('net'); // Node.js built-in module for robust IP validation

// Initialize Express application instance
const app = express();
const PORT = 3000;

// ============================================================================
// 1. IN-MEMORY DATABASE & STATE MANAGEMENT
// ============================================================================
// The single source of truth for the server's state. 
// Lives strictly in RAM and resets upon server restart.
const firewallRules = [];
let nextId = 1;

/**
 * Generates a globally unique, auto-incrementing numeric ID for firewall rules.
 * @returns {number} The next unique ID
 */
const generateId = () => nextId++;

// ============================================================================
// 2. GLOBAL MIDDLEWARES
// ============================================================================

// Middleware: Parses incoming request bodies with JSON payloads into req.body
app.use(express.json());

// Middleware: Audit logging for observability, tracking every incoming request method, URL, and timestamp
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Incoming Request: ${req.method} ${req.url}`);
    next(); // Pass control to the next middleware or route handler
});

// ============================================================================
// 3. VALIDATION HELPERS (Defensive Programming)
// ============================================================================

/**
 * Validates if a string is a legitimate IPv4 address.
 * Leverages Node.js core 'net' library for bulletproof parsing.
 */
const isValidIPv4 = (ip) => {
    return typeof ip === 'string' && net.isIP(ip) === 4;
};

/**
 * Validates domain structure: must be a clean domain name, 
 * strictly rejecting protocols, paths, or ports.
 */
const isValidDomain = (domain) => {
    if (typeof domain !== 'string' || domain.length === 0) return false;
    // Disallow protocols, slashes, or colon ports
    if (domain.includes('://') || domain.includes('/') || domain.includes(':')) {
        return false;
    }
    // Standard basic domain format verification via regex
    const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
};

/**
 * Validates network port ranges (integers strictly between 1 and 65535).
 */
const isValidPort = (port) => {
    return Number.isInteger(port) && port >= 1 && port <= 65535;
};

/**
 * Validates the core structural schema of incoming mutation payloads.
 * Ensures strict typing and prevents malformed data entry.
 */
const validatePayload = (req, res) => {
    const { values, mode } = req.body;

    // Validate mode constraint
    if (!['blacklist', 'whitelist'].includes(mode)) {
        return res.status(400).json({
            status: "error",
            code: "INVALID_MODE",
            message: "Mode must be strictly either 'blacklist' or 'whitelist'."
        });
    }

    // Validate values array constraint
    if (!Array.isArray(values) || values.length === 0) {
        return res.status(400).json({
            status: "error",
            code: "INVALID_VALUES",
            message: "Values must be a non-empty array."
        });
    }
};

// ============================================================================
// 4. CORE BUSINESS LOGIC (DRY Principle & All-or-Nothing Approach)
// ============================================================================

/**
 * Generic handler for adding rules. Implements "All-or-Nothing" validation:
 * verifies the entire batch upfront before mutating state to ensure data integrity.
 */
const handleAddRules = (req, res, type, validatorFn, errorCode, errorMessage) => {
    const { values, mode } = req.body;

    // Phase 1: Pre-validation loop (All-or-Nothing safety check)
    for (const val of values) {
        if (!validatorFn(val)) {
            return res.status(400).json({
                status: "error",
                code: errorCode,
                message: errorMessage
            });
        }
    }

    // Phase 2: State mutation and insertion
    const addedRules = [];
    for (const val of values) {
        const newRule = {
            id: generateId(),
            type,
            mode,
            value: val,
            active: true 
        };

        firewallRules.push(newRule);
        
        // Prepare streamlined response object matching exact output schema
        addedRules.push({
            id: newRule.id,
            value: newRule.value,
            active: newRule.active
        });
    }

    // Return successful creation response (201 Created)
    return res.status(201).json({
        type,
        mode,
        values: addedRules,
        status: "success"
    });
};

// ============================================================================
// 5. API ROUTE DEFINITIONS
// ============================================================================

// 2.1 Add IPs Endpoint
app.post('/api/firewall/ips', (req, res) => {
    validatePayload(req, res);
    if (res.headersSent) return;
    handleAddRules(req, res, 'ip', isValidIPv4, 'INVALID_IP', 'Only valid IPv4 addresses are accepted.');
});

// 2.2 Add Domains Endpoint
app.post('/api/firewall/domains', (req, res) => {
    validatePayload(req, res);
    if (res.headersSent) return;
    handleAddRules(req, res, 'domain', isValidDomain, 'INVALID_DOMAIN', 'Domains must not include protocol, path, or port.');
});

// 2.3 Add Ports Endpoint
app.post('/api/firewall/ports', (req, res) => {
    validatePayload(req, res);
    if (res.headersSent) return;
    handleAddRules(req, res, 'port', isValidPort, 'INVALID_PORT', 'Ports must be integers between 1 and 65535.');
});

// 2.4 Remove Firewall Rules Endpoint
app.delete('/api/firewall/rules', (req, res) => {
    const { ids } = req.body;

    // Validate IDs payload structure
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every(Number.isInteger)) {
        return res.status(400).json({
            status: "error",
            code: "INVALID_IDS",
            message: "IDs must be a non-empty array of integers."
        });
    }

    const removedRules = [];

    // Traverse backwards to safely modify the array in-place without index shift bugs
    for (let i = firewallRules.length - 1; i >= 0; i--) {
        if (ids.includes(firewallRules[i].id)) {
            const removed = firewallRules.splice(i, 1)[0];
            removedRules.push({
                id: removed.id,
                type: removed.type,
                mode: removed.mode,
                value: removed.value,
                active: removed.active
            });
        }
    }

    // Handle case where none of the requested IDs were found
    if (removedRules.length === 0) {
        return res.status(404).json({
            status: "error",
            code: "RULES_NOT_FOUND",
            message: "None of the specified rule IDs were found."
        });
    }

    return res.status(200).json({
        removed: removedRules,
        status: "success"
    });
});

// 2.5 Get Firewall Rules Endpoint (Supports optional type query parameter filtering)
app.get('/api/firewall/rules', (req, res) => {
    const { type } = req.query;

    // Optional query validation if filter is provided
    if (type && !['ip', 'domain', 'port'].includes(type)) {
        return res.status(400).json({
            status: "error",
            code: "INVALID_QUERY_TYPE",
            message: "Filter type must be one of: ip, domain, port."
        });
    }

    // Filter rules if a specific type was requested
    const targetRules = type ? firewallRules.filter(rule => rule.type === type) : firewallRules;

    // Group rules into structured categorization categories
    const responseObj = {
        ips: targetRules.filter(r => r.type === 'ip'),
        domains: targetRules.filter(r => r.type === 'domain'),
        ports: targetRules.filter(r => r.type === 'port')
    };

    return res.status(200).json(responseObj);
});

// 2.6 Update Rule Activation Status Endpoint
app.patch('/api/firewall/rules/status', (req, res) => {
    const { ids, active } = req.body;

    // Validate IDs array
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every(Number.isInteger)) {
        return res.status(400).json({
            status: "error",
            code: "INVALID_IDS",
            message: "IDs must be a non-empty array of integers."
        });
    }

    // Validate active boolean flag
    if (typeof active !== 'boolean') {
        return res.status(400).json({
            status: "error",
            code: "INVALID_ACTIVE_STATE",
            message: "Active must be a Boolean value (true or false)."
        });
    }

    const updatedRules = [];

    // Update matching rules in memory
    for (const rule of firewallRules) {
        if (ids.includes(rule.id)) {
            rule.active = active;
            updatedRules.push({
                id: rule.id,
                type: rule.type,
                mode: rule.mode,
                value: rule.value,
                active: rule.active
            });
        }
    }

    // Return 404 if no valid IDs matched existing records
    if (updatedRules.length === 0) {
        return res.status(404).json({
            status: "error",
            code: "RULES_NOT_FOUND",
            message: "None of the specified rule IDs were found for update."
        });
    }

    return res.status(200).json({
        updated: updatedRules,
        status: "success"
    });
});

// ============================================================================
// 6. SERVER INITIALIZATION
// ============================================================================
app.listen(PORT, () => {
    console.log(`Server successfully started and listening on port ${PORT}`);
});