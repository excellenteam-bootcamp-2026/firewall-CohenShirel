"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
/**
 * Application composition root.
 * Wires adapters to use cases, initializes cross-cutting infrastructure, and starts HTTP server.
 */
const express = require('express');
const http_adapter_1 = require("../adapters/http.adapter");
const memory_db_1 = require("../adapters/memory.db");
const Logger_1 = require("../adapters/Logger");
const env_1 = require("./env");
const PORT = env_1.config.PORT;
// Import side effect: initializes singleton logger and console routing once.
void Logger_1.logger;
/**
 * Creates an Express app instance without binding a port.
 * Keeping creation separate from listen() enables integration testing.
 */
function createApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] Incoming Request: ${req.method} ${req.url}`);
        next();
    });
    app.use((0, http_adapter_1.createFirewallRouter)({
        repository: memory_db_1.firewallRepository,
        idGenerator: memory_db_1.idGenerator,
    }));
    return app;
}
if (require.main === module) {
    const app = createApp();
    /**
     * Startup occurs only when executed as the process entrypoint,
     * preventing accidental port binding in tests/importers.
     */
    app.listen(PORT, () => {
        console.log(`Server successfully started and listening on port ${PORT}`);
    });
}
