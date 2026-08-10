/**
 * Validates the environment once, at import time, so a misconfigured process dies at
 * startup rather than on the first request that happens to need a missing variable.
 */
import dotenv from 'dotenv';
import { z } from 'zod';

/**
 * Loads `.env` before a single variable is read. Variables already present in the
 * environment win — an injected production value must never be overwritten by a file that
 * happened to ship in the image, and it keeps tests that preset `process.env` hermetic.
 * A missing `.env` is a no-op, which is the normal case in production.
 */
dotenv.config({ quiet: true });

/** Fallback wait between database connection attempts when the variable is absent. */
const DEFAULT_DB_CONNECTION_INTERVAL_MS = 2_000;

const ENV_TO_DATABASE_SUFFIX = {
  dev: 'dev',
  prod: 'prod',
} as const;

type RuntimeEnv = keyof typeof ENV_TO_DATABASE_SUFFIX;

const toDatabaseName = (environment: RuntimeEnv): string =>
  `firewall_db_${ENV_TO_DATABASE_SUFFIX[environment]}`;

const encodeSegment = (value: string, segmentName: string): string => {
  const encoded = encodeURIComponent(value);

  if (encoded.length === 0) {
    throw new Error(`${segmentName} must not be empty.`);
  }

  return encoded;
};

const envSchema = z.object({
  ENV: z.enum(['dev', 'prod']),
  PORT: z
    .coerce
    .number()
    .int('PORT must be an integer.')
    .min(1, 'PORT must be between 1 and 65535.')
    .max(65535, 'PORT must be between 1 and 65535.'),
  DB_USER: z.string().min(1, 'DB_USER must not be empty.'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD must not be empty.'),
  DB_HOST: z.string().min(1, 'DB_HOST must not be empty.'),
  DB_PORT: z
    .coerce
    .number()
    .int('DB_PORT must be an integer.')
    .min(1, 'DB_PORT must be between 1 and 65535.')
    .max(65535, 'DB_PORT must be between 1 and 65535.'),
  DB_CONNECTION_INTERVAL: z
    .coerce
    .number()
    .int('DB_CONNECTION_INTERVAL must be an integer number of milliseconds.')
    .positive('DB_CONNECTION_INTERVAL must be greater than zero.')
    .default(DEFAULT_DB_CONNECTION_INTERVAL_MS),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  // Aggregate every issue into one message so a bad deployment is fixed in a single pass.
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  throw new Error(`Invalid environment configuration. ${details}`);
}

const {
  ENV,
  PORT,
  DB_USER,
  DB_PASSWORD,
  DB_HOST,
  DB_PORT,
  DB_CONNECTION_INTERVAL,
} = parsedEnv.data;

const selectedDatabaseName = toDatabaseName(ENV);
const selectedDatabaseUri = `postgres://${encodeSegment(DB_USER, 'DB_USER')}:${encodeSegment(
  DB_PASSWORD,
  'DB_PASSWORD'
)}@${DB_HOST}:${DB_PORT}/${selectedDatabaseName}`;

const constants = {
  appName: 'firewall-cohenshirel',
} as const;

const loggerEnvironment = ENV === 'dev' ? 'dev' : 'production';

export const config = {
  ENV,
  PORT,
  DB_USER,
  DB_PASSWORD,
  DB_HOST,
  DB_PORT,
  DB_CONNECTION_INTERVAL,
  selectedDatabaseName,
  selectedDatabaseUri,
  loggerEnvironment,
  constants,
} as const;

