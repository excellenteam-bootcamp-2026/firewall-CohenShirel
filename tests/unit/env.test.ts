describe('env configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('prefers DATABASE_URI_DEV when ENV is dev', () => {
    process.env.ENV = 'dev';
    process.env.PORT = '3001';
    process.env.DATABASE_URL = 'postgres://localhost:5432/fallback_db';
    process.env.DATABASE_URI_DEV = 'postgres://localhost:5432/dev_db';

    const { config } = require('../../src/main/env');

    expect(config.selectedDatabaseUri).toBe('postgres://localhost:5432/dev_db');
  });

  it('throws when DATABASE_URI_DEV does not include a port', () => {
    process.env.ENV = 'dev';
    process.env.PORT = '3001';
    process.env.DATABASE_URL = 'postgres://localhost:5432/fallback_db';
    process.env.DATABASE_URI_DEV = 'postgres://localhost/dev_db';

    expect(() => require('../../src/main/env')).toThrow(
      'DATABASE_URI_DEV must include an explicit port.'
    );
  });
});
