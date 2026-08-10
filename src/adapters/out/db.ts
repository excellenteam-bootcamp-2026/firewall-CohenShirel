/**
 * Owns the PostgreSQL connection lifecycle. A singleton because a second pool would
 * silently double the connection count against the database's max_connections limit,
 * and because the composition root must be able to hand the same handle to every adapter.
 */
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type FirewallSchema = typeof schema;
export type FirewallDatabase = NodePgDatabase<FirewallSchema>;

/**
 * Deliberately narrow: the connection layer needs to report progress, not to depend on
 * winston. The composition root passes the real application logger in.
 */
export interface ConnectionLogger {
  info(message: string): void;
  warn(message: string): void;
}

export interface ConnectOptions {
  intervalMs?: number;
  maxAttempts?: number;
  maxBackoffMs?: number;
  logger?: ConnectionLogger;
}

const DEFAULT_MAX_BACKOFF_MS = 30_000;

const fallbackLogger: ConnectionLogger = {
  info: (message) => process.stdout.write(`${message}\n`),
  warn: (message) => process.stderr.write(`${message}\n`),
};

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class DatabaseConnection {
  private static instance: DatabaseConnection | undefined;

  private readonly pool: Pool;
  /** In-flight or completed handshake, so concurrent callers share one attempt loop. */
  private handshake: Promise<void> | undefined;

  public readonly db: FirewallDatabase;

  private constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
    this.db = drizzle(this.pool, { schema });
  }

  public static getInstance(connectionString: string): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection(connectionString);
    }

    return DatabaseConnection.instance;
  }

  /**
   * Stop and wait: at most one outstanding attempt, a fixed pause between attempts, and no
   * progress past this call until PostgreSQL accepts a connection. The database usually
   * finishes booting after this process does, so a failed attempt is expected, not fatal.
   *
   * Idempotent — repeated calls await the same handshake instead of probing once per caller.
   */
  public async connect(options: ConnectOptions = {}): Promise<void> {
    if (!this.handshake) {
      this.handshake = this.runHandshake(options).catch((error: unknown) => {
        // A rejected handshake must not be cached, or a bounded caller that gave up would
        // poison every later attempt with its own failure.
        this.handshake = undefined;

        throw error;
      });
    }

    return this.handshake;
  }

  /** True once a connection has been established and not yet closed. */
  public get isConnected(): boolean {
    return this.handshake !== undefined;
  }

  public async close(): Promise<void> {
    this.handshake = undefined;
    await this.pool.end();
  }

  private async runHandshake({
    intervalMs = 1_000,
    maxAttempts,
    maxBackoffMs = DEFAULT_MAX_BACKOFF_MS,
    logger = fallbackLogger,
  }: ConnectOptions): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        // Acquiring and releasing a client is the cheapest real proof that the server is
        // reachable, authenticated and accepting sessions.
        const client = await this.pool.connect();
        client.release();

        logger.info(`[db] Connected to PostgreSQL on attempt ${attempt}.`);

        return;
      } catch (error) {
        if (maxAttempts !== undefined && attempt >= maxAttempts) {
          throw new Error(
            `[db] Could not connect to PostgreSQL after ${attempt} attempt(s): ${describeError(error)}`
          );
        }

        const delay = Math.min(intervalMs * 2 ** (attempt - 1), maxBackoffMs);

        logger.warn(
          `[db] Connection attempt ${attempt} failed (${describeError(error)}). Retrying in ${delay}ms.`
        );

        await wait(delay);
      }
    }
  }
}

export const createDatabaseConnection = (connectionString: string): DatabaseConnection =>
  DatabaseConnection.getInstance(connectionString);
