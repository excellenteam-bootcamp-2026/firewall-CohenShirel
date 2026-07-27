/**
 * Application composition root.
 * Wires adapters to use cases, initializes cross-cutting infrastructure, and starts HTTP server.
 */
const express = require('express');
import { createFirewallRouter } from '../adapters/http.adapter';
import { firewallRepository, idGenerator } from '../adapters/memory.db';
import { logger } from '../adapters/Logger';
import { config } from './env';

const PORT = config.PORT;
// Import side effect: initializes singleton logger and console routing once.
void logger;

/**
 * Creates an Express app instance without binding a port.
 * Keeping creation separate from listen() enables integration testing.
 */
export function createApp() {
  const app = express();

  app.use(express.json());

  app.use((req: any, _res: any, next: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Incoming Request: ${req.method} ${req.url}`);
    next();
  });

  app.use(
    createFirewallRouter({
      repository: firewallRepository,
      idGenerator,
    })
  );

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
