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

const databaseUrlWithPort = (name: string) =>
  z
    .string()
    .url(`${name} must be a valid URL.`)
    .refine((value) => {
      const parsed = new URL(value);
      return parsed.port.length > 0;
    }, `${name} must include an explicit port.`);

/** Fallback wait between database connection attempts when the variable is absent. */
const DEFAULT_DB_CONNECTION_INTERVAL_MS = 2_000;

const envSchema = z.object({
  ENV: z.enum(['dev', 'production']),
  PORT: z
    .coerce
    .number()
    .int('PORT must be an integer.')
    .min(1, 'PORT must be between 1 and 65535.')
    .max(65535, 'PORT must be between 1 and 65535.'),
  DATABASE_URI: databaseUrlWithPort('DATABASE_URI').optional(),
  DATABASE_URL: z.string().url(),
  DATABASE_URI_DEV: databaseUrlWithPort('DATABASE_URI_DEV').optional(),
  DATABASE_URI_PRODUCTION: databaseUrlWithPort('DATABASE_URI_PRODUCTION').optional(),
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
  DATABASE_URI,
  DATABASE_URL,
  DATABASE_URI_DEV,
  DATABASE_URI_PRODUCTION,
  DB_CONNECTION_INTERVAL,
} = parsedEnv.data;

// Precedence is explicit: an env-specific URI always wins over the shared fallback.
const databaseUriByEnv = {
  dev: DATABASE_URI_DEV ?? DATABASE_URL ?? DATABASE_URI,
  production: DATABASE_URI_PRODUCTION ?? DATABASE_URL ?? DATABASE_URI,
} as const;

const constants = {
  appName: 'firewall-cohenshirel',
} as const;

export const config = {
  ENV,
  PORT,
  DATABASE_URI,
  DATABASE_URL,
  DATABASE_URI_DEV,
  DATABASE_URI_PRODUCTION,
  DB_CONNECTION_INTERVAL,
  databaseUriByEnv,
  selectedDatabaseUri: databaseUriByEnv[ENV],
  constants,
} as const;

