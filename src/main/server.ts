import express from 'express';
import { createFirewallRouter } from '../adapters/in/http.adapter';
import { createDatabaseConnection } from '../adapters/out/db';
import {
  firewallRepository as memoryRepository,
  idGenerator as memoryIdGenerator,
} from '../adapters/out/memory.db';
import { createAppLogger, createRequestLogger } from '../adapters/out/Logger';
import { createPostgresIdGenerator } from '../adapters/out/postgresIdGenerator';
import { createPostgresRepository } from '../adapters/out/postgresRepository';
import { FIREWALL_RULES_PATH } from '../adapters/in/routes';
import { FirewallService } from '../application/firewallService';
import type { IFirewallRepository } from '../ports/IFirewallRepository';
import type { IFirewallRulesUseCase } from '../ports/IFirewallRulesUseCase';
import type { IIdGenerator } from '../ports/IIdGenerator';
import { config } from './env';

const PORT = config.PORT;
export interface AppDependencies {
  repository?: IFirewallRepository;
  idGenerator?: IIdGenerator;
}

const isMalformedJsonError = (
  error: unknown
): error is SyntaxError & { status?: number; body?: unknown } =>
  error instanceof SyntaxError &&
  (error as SyntaxError & { status?: number; body?: unknown }).status === 400 &&
  'body' in (error as object);

export function createApp(
  logger = createAppLogger(config.loggerEnvironment),
  dependencies: AppDependencies = {}
) {
  const {
    repository = memoryRepository,
    idGenerator = memoryIdGenerator,
  } = dependencies;

  const app = express();
  const firewallRulesUseCase: IFirewallRulesUseCase = new FirewallService(
    repository,
    idGenerator
  );

  app.use(express.json());

  app.use(createRequestLogger(logger));

  app.use(
    createFirewallRouter({
      firewallRulesUseCase,
      firewallRulesPath: FIREWALL_RULES_PATH,
    })
  );

  app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (isMalformedJsonError(error)) {
      logger.warn('Malformed JSON request rejected.');

      return res.status(400).json({
        status: 'error',
        code: 'INVALID_JSON_PAYLOAD',
        message: 'Malformed JSON request body.',
      });
    }

    return next(error);
  });

  return app;
}
async function bootstrap(): Promise<void> {
  const logger = createAppLogger(config.loggerEnvironment);
  const dbManager = createDatabaseConnection(config.selectedDatabaseUri);

  await dbManager.connect({
    logger,
    intervalMs: config.DB_CONNECTION_INTERVAL,
  });

  const postgresRepository = createPostgresRepository(dbManager.db);
  const postgresIdGenerator = createPostgresIdGenerator(dbManager.db);

  const app = createApp(logger, {
    repository: postgresRepository,
    idGenerator: postgresIdGenerator,
  });

  const server = app.listen(PORT, () => {
    logger.info(`Server successfully started and listening on port ${PORT}`);
  });

  const shutdown = (signal: string): void => {
    logger.info(`Received ${signal}. Shutting down.`);

    server.close(() => {
      void dbManager.close().then(
        () => process.exit(0),
        (error: unknown) => {
          logger.error('Failed to close the database pool cleanly.', error);
          process.exit(1);
        }
      );
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) {
  void bootstrap().catch((error: unknown) => {
    process.stderr.write(
      `Startup failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
    );
    process.exit(1);
  });
}
