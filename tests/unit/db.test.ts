const poolMock = jest.fn();
const drizzleMock = jest.fn(() => ({}));

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation((options) => {
    poolMock(options);

    return {
      connect: jest.fn(),
      end: jest.fn(),
    };
  }),
}));

jest.mock('drizzle-orm/node-postgres', () => ({
  drizzle: drizzleMock,
}));

describe('database adapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    poolMock.mockClear();
    drizzleMock.mockClear();
    process.env = {
      ...originalEnv,
      ENV: 'dev',
      PORT: '3001',
      DATABASE_URL: 'postgres://localhost:5432/fallback_db',
      DATABASE_URI_DEV: 'postgres://localhost:5432/dev_db',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('creates the pool from the injected database URI through the singleton API', () => {
    const { DatabaseConnection } = require('../../src/adapters/out/db');

    const dbManager = DatabaseConnection.getInstance(
      'postgres://localhost:5432/dev_db',
      1000
    );

    expect(poolMock).toHaveBeenCalledWith({
      connectionString: 'postgres://localhost:5432/dev_db',
    });
    expect(drizzleMock).toHaveBeenCalledTimes(1);
    expect(dbManager).toBeDefined();
  });
});