/**
 * drizzle-kit configuration. The connection URI is taken from the validated application
 * config rather than read from process.env here, so the migration tool and the running
 * server can never disagree about which database they are pointed at. Importing that module
 * also loads `.env` and fails fast on a misconfigured environment.
 */
import { defineConfig } from 'drizzle-kit';
import { config } from './src/main/env';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/adapters/out/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: config.selectedDatabaseUri,
  },
  // Print the SQL and ask before anything destructive runs against a real database.
  verbose: true,
  strict: true,
});
