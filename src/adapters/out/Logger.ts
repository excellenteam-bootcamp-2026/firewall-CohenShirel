/**
 * Logging adapter. Everything here is a factory on purpose: importing this module must
 * not create transports, touch the filesystem, or patch the console.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, RequestHandler } from 'express';
import { createLogger, format, transports, type Logger as WinstonLogger } from 'winston';

export type AppLogger = WinstonLogger;

export function createAppLogger(environment: 'dev' | 'production'): WinstonLogger {
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

  if (environment === 'dev') {
    return createLogger({
      level: 'silly',
      format: commonFormat,
      transports: [new transports.Console({ format: format.combine(format.colorize(), commonFormat) })],
    });
  }

  const loggerTransports: Array<transports.ConsoleTransportInstance | transports.FileTransportInstance> = [];

  // A read-only or full filesystem must not take the process down, so file logging
  // degrades to the console instead of throwing during startup.
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
    loggerTransports.push(
      new transports.Console({
        level: 'info',
        handleExceptions: true,
      })
    );

    process.stderr.write(
      `Logger initialization warning: failed to create file transport. Falling back to console.\n${
        error instanceof Error ? error.stack || error.message : String(error)
      }\n`
    );
  }

  return createLogger({
    level: 'info',
    format: commonFormat,
    transports: loggerTransports,
    exitOnError: false,
  });
}

export function createRequestLogger(logger: Pick<WinstonLogger, 'info'>): RequestHandler {
  return (req: Request, _res: unknown, next: NextFunction) => {
    const timestamp = new Date().toISOString();
    logger.info(`[${timestamp}] Incoming Request: ${req.method} ${req.url}`);
    next();
  };
}
