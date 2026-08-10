const debugMock = jest.fn();
const infoMock = jest.fn();
const warnMock = jest.fn();
const errorMock = jest.fn();

jest.mock('winston', () => {
  const loggerApi = {
    debug: debugMock,
    info: infoMock,
    warn: warnMock,
    error: errorMock,
  };

  return {
    createLogger: jest.fn(() => loggerApi),
    format: {
      combine: jest.fn(() => ({})),
      timestamp: jest.fn(() => ({})),
      errors: jest.fn(() => ({})),
      splat: jest.fn(() => ({})),
      printf: jest.fn(() => ({})),
      colorize: jest.fn(() => ({})),
    },
    transports: {
      Console: jest.fn(function Console(this: unknown) {
        return this;
      }),
      File: jest.fn(function File(this: unknown) {
        return this;
      }),
    },
  };
});

describe('Logger adapter', () => {
  const originalEnv = process.env;
  const originalConsoleLog = console.log;
  const originalConsoleInfo = console.info;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      ENV: 'dev',
      PORT: '3001',
      DATABASE_URL: 'postgres://localhost:5432/firewall_test',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('does not patch console on import and logs requests explicitly', () => {
    const { createAppLogger, createRequestLogger } = require('../../src/adapters/out/Logger');
    const { createLogger: createLoggerMock } = require('winston');

    expect(console.log).toBe(originalConsoleLog);
    expect(console.info).toBe(originalConsoleInfo);
    expect(console.warn).toBe(originalConsoleWarn);
    expect(console.error).toBe(originalConsoleError);

    const logger = createAppLogger('dev');
    expect(createLoggerMock).toHaveBeenCalledTimes(1);
    expect(logger).toBeDefined();

    const middleware = createRequestLogger({ info: infoMock });
    const next = jest.fn();

    middleware({ method: 'POST', url: '/api/v1/firewall/rules' } as never, {} as never, next);

    expect(infoMock).toHaveBeenCalledWith(
      expect.stringMatching(/Incoming Request: POST \/api\/v1\/firewall\/rules/)
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});
