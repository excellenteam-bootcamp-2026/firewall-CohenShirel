"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
/**
 * Main-layer configuration module.
 * Validates process environment at startup and fails fast to prevent unsafe runtime states.
 */
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    ENV: zod_1.z.enum(['dev', 'production']),
    PORT: zod_1.z
        .coerce
        .number()
        .int('PORT must be an integer.')
        .min(1, 'PORT must be between 1 and 65535.')
        .max(65535, 'PORT must be between 1 and 65535.'),
    DATABASE_URI: zod_1.z
        .string()
        .url('DATABASE_URI must be a valid URL.')
        .refine((value) => {
        const parsed = new URL(value);
        return parsed.port.length > 0;
    }, 'DATABASE_URI must include an explicit port.'),
    DATABASE_URI_DEV: zod_1.z
        .string()
        .url('DATABASE_URI_DEV must be a valid URL.')
        .refine((value) => {
        const parsed = new URL(value);
        return parsed.port.length > 0;
    }, 'DATABASE_URI_DEV must include an explicit port.')
        .optional(),
    DATABASE_URI_PRODUCTION: zod_1.z
        .string()
        .url('DATABASE_URI_PRODUCTION must be a valid URL.')
        .refine((value) => {
        const parsed = new URL(value);
        return parsed.port.length > 0;
    }, 'DATABASE_URI_PRODUCTION must include an explicit port.')
        .optional(),
});
const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
    // Aggregate schema issues into one actionable startup error.
    const details = parsedEnv.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
    throw new Error(`Invalid environment configuration. ${details}`);
}
const { ENV, PORT, DATABASE_URI, DATABASE_URI_DEV, DATABASE_URI_PRODUCTION } = parsedEnv.data;
const databaseUriByEnv = {
    dev: DATABASE_URI_DEV ?? DATABASE_URI,
    production: DATABASE_URI_PRODUCTION ?? DATABASE_URI,
};
const constants = {
    appName: 'firewall-cohenshirel',
    apiBasePath: '/api/v1',
    firewallRulesPath: '/api/v1/firewall/rules',
};
/**
 * Parsed, validated configuration exposed to the rest of the application.
 */
exports.config = {
    ENV,
    PORT,
    DATABASE_URI,
    DATABASE_URI_DEV,
    DATABASE_URI_PRODUCTION,
    databaseUriByEnv,
    selectedDatabaseUri: databaseUriByEnv[ENV],
    constants,
};
