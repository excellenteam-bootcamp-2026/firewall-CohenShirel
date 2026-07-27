process.env.ENV = process.env.ENV ?? 'dev';
process.env.PORT = process.env.PORT ?? '3001';
process.env.DATABASE_URI =
  process.env.DATABASE_URI ?? 'postgres://localhost:5432/firewall_test';
