/**
 * Logging infrastructure adapter.
 * Centralizes environment-aware Winston configuration and console monkey patching.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createLogger, format, transports, type Logger as WinstonLogger } from 'winston';
import { config } from '../main/env';

/**
 * Singleton wrapper that guarantees one logger instance and one console patch lifecycle.
 */
class LoggerSingleton {
  private static instance: LoggerSingleton | null = null;
  private static patchedConsole = false;

  private readonly logger: WinstonLogger;
  private readonly originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  private constructor() {
    this.logger = this.createWinstonLogger();
    this.patchConsole();
  }

  static getInstance(): LoggerSingleton {
    if (!LoggerSingleton.instance) {
      LoggerSingleton.instance = new LoggerSingleton();
    }

    return LoggerSingleton.instance;
  }

  /**
   * Exposes the shared Winston logger instance for module-level usage.
   */
  getLogger(): WinstonLogger {
    return this.logger;
  }

  /**
   * Chooses transports and levels by environment.
   * In production, file initialization failures gracefully degrade to console logging.
   */
  private createWinstonLogger(): WinstonLogger {
    const commonFormat = format.combine(
      format.timestamp(),
      format.errors({ stack: true }),
      format.splat(),
      format.printf(({ level, message, timestamp, stack, ...meta }) => {
        const metaString = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        const errorStack = stack ? `\n${stack}` : '';

        return `${timestamp} [${level}] ${message}${metaString}${errorStack}`;
      })
    );

    if (config.ENV === 'dev') {
      return createLogger({
        level: 'silly',
        format: commonFormat,
        transports: [new transports.Console({ format: format.combine(format.colorize(), commonFormat) })],
      });
    }

    const loggerTransports: Array<transports.ConsoleTransportInstance | transports.FileTransportInstance> = [];

    try {
      const logsDirPath = path.resolve(process.cwd(), 'logs');
      fs.mkdirSync(logsDirPath, { recursive: true });

      loggerTransports.push(
        new transports.File({
          filename: path.join(logsDirPath, 'app.log'),
          level: 'info',
          handleExceptions: true,
        })
      );
    } catch (error) {
      this.originalConsole.error(
        'Logger initialization warning: failed to create file transport. Falling back to console.',
        error
      );

      loggerTransports.push(
        new transports.Console({
          level: 'info',
          handleExceptions: true,
        })
      );
    }

    return createLogger({
      level: 'info',
      format: commonFormat,
      transports: loggerTransports,
      exitOnError: false,
    });
  }

  /**
   * Redirects console calls into Winston so legacy logs are captured consistently.
   */
  private patchConsole(): void {
    if (LoggerSingleton.patchedConsole) {
      return;
    }

    console.log = (...args: unknown[]) => {
      this.logger.debug(this.stringifyArgs(args));
    };

    console.info = (...args: unknown[]) => {
      this.logger.info(this.stringifyArgs(args));
    };

    console.warn = (...args: unknown[]) => {
      this.logger.warn(this.stringifyArgs(args));
    };

    console.error = (...args: unknown[]) => {
      this.logger.error(this.stringifyArgs(args));
    };

    LoggerSingleton.patchedConsole = true;
  }

  /**
   * Normalizes console arguments into a single message while preserving Error stack traces.
   */
  private stringifyArgs(args: unknown[]): string {
    return args
      .map((arg) => {
        if (typeof arg === 'string') {
          return arg;
        }

        if (arg instanceof Error) {
          return arg.stack || arg.message;
        }

        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      })
      .join(' ');
  }
}

/**
 * Shared logger singleton export for the entire process.
 */
export const logger = LoggerSingleton.getInstance().getLogger();
