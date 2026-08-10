/// <reference types="node" />

process.env.ENV = process.env.ENV ?? 'dev';
process.env.PORT = process.env.PORT ?? '3001';
process.env.DB_USER = process.env.DB_USER ?? 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? 'postgres';
process.env.DB_HOST = process.env.DB_HOST ?? 'localhost';
process.env.DB_PORT = process.env.DB_PORT ?? '5432';