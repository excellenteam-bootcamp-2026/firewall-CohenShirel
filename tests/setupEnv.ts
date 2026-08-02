/// <reference types="node" />

process.env.ENV = process.env.ENV ?? 'dev';
process.env.PORT = process.env.PORT ?? '3001';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://localhost:5432/firewall_test';