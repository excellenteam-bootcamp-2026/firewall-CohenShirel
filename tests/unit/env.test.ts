describe('env configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('builds the dev database URI from discrete DB variables', () => {
    process.env.ENV = 'dev';
    process.env.PORT = '3001';
    process.env.DB_USER = 'firewall';
    process.env.DB_PASSWORD = 'secret';
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';

    const { config } = require('../../src/main/env');

    expect(config.selectedDatabaseName).toBe('firewall_db_dev');
    expect(config.selectedDatabaseUri).toBe('postgres://firewall:secret@localhost:5432/firewall_db_dev');
    expect(config.loggerEnvironment).toBe('dev');
  });

  it('builds the prod database URI and maps logger environment to production', () => {
    process.env.ENV = 'prod';
    process.env.PORT = '3001';
    process.env.DB_USER = 'firewall';
    process.env.DB_PASSWORD = 'secret';
    process.env.DB_HOST = 'db.internal';
    process.env.DB_PORT = '5433';

    const { config } = require('../../src/main/env');

    expect(config.selectedDatabaseName).toBe('firewall_db_prod');
    expect(config.selectedDatabaseUri).toBe('postgres://firewall:secret@db.internal:5433/firewall_db_prod');
    expect(config.loggerEnvironment).toBe('production');
  });

  it('throws when DB_PORT is out of range', () => {
    process.env.ENV = 'dev';
    process.env.PORT = '3001';
    process.env.DB_USER = 'firewall';
    process.env.DB_PASSWORD = 'secret';
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '70000';

    expect(() => require('../../src/main/env')).toThrow(
      'DB_PORT must be between 1 and 65535.'
    );
  });
});
