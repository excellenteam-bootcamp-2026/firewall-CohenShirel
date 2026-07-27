"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
/**
 * Logging infrastructure adapter.
 * Centralizes environment-aware Winston configuration and console monkey patching.
 */
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const winston_1 = require("winston");
const env_1 = require("../main/env");
/**
 * Singleton wrapper that guarantees one logger instance and one console patch lifecycle.
 */
class LoggerSingleton {
    constructor() {
        this.originalConsole = {
            log: console.log.bind(console),
            info: console.info.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
        };
        this.logger = this.createWinstonLogger();
        this.patchConsole();
    }
    static getInstance() {
        if (!LoggerSingleton.instance) {
            LoggerSingleton.instance = new LoggerSingleton();
        }
        return LoggerSingleton.instance;
    }
    /**
     * Exposes the shared Winston logger instance for module-level usage.
     */
    getLogger() {
        return this.logger;
    }
    /**
     * Chooses transports and levels by environment.
     * In production, file initialization failures gracefully degrade to console logging.
     */
    createWinstonLogger() {
        const commonFormat = winston_1.format.combine(winston_1.format.timestamp(), winston_1.format.errors({ stack: true }), winston_1.format.splat(), winston_1.format.printf(({ level, message, timestamp, stack, ...meta }) => {
            const metaString = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
            const errorStack = stack ? `\n${stack}` : '';
            return `${timestamp} [${level}] ${message}${metaString}${errorStack}`;
        }));
        if (env_1.config.ENV === 'dev') {
            return (0, winston_1.createLogger)({
                level: 'silly',
                format: commonFormat,
                transports: [new winston_1.transports.Console({ format: winston_1.format.combine(winston_1.format.colorize(), commonFormat) })],
            });
        }
        const loggerTransports = [];
        try {
            const logsDirPath = node_path_1.default.resolve(process.cwd(), 'logs');
            node_fs_1.default.mkdirSync(logsDirPath, { recursive: true });
            loggerTransports.push(new winston_1.transports.File({
                filename: node_path_1.default.join(logsDirPath, 'app.log'),
                level: 'info',
                handleExceptions: true,
            }));
        }
        catch (error) {
            this.originalConsole.error('Logger initialization warning: failed to create file transport. Falling back to console.', error);
            loggerTransports.push(new winston_1.transports.Console({
                level: 'info',
                handleExceptions: true,
            }));
        }
        return (0, winston_1.createLogger)({
            level: 'info',
            format: commonFormat,
            transports: loggerTransports,
            exitOnError: false,
        });
    }
    /**
     * Redirects console calls into Winston so legacy logs are captured consistently.
     */
    patchConsole() {
        if (LoggerSingleton.patchedConsole) {
            return;
        }
        console.log = (...args) => {
            this.logger.debug(this.stringifyArgs(args));
        };
        console.info = (...args) => {
            this.logger.info(this.stringifyArgs(args));
        };
        console.warn = (...args) => {
            this.logger.warn(this.stringifyArgs(args));
        };
        console.error = (...args) => {
            this.logger.error(this.stringifyArgs(args));
        };
        LoggerSingleton.patchedConsole = true;
    }
    /**
     * Normalizes console arguments into a single message while preserving Error stack traces.
     */
    stringifyArgs(args) {
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
            }
            catch {
                return String(arg);
            }
        })
            .join(' ');
    }
}
LoggerSingleton.instance = null;
LoggerSingleton.patchedConsole = false;
/**
 * Shared logger singleton export for the entire process.
 */
exports.logger = LoggerSingleton.getInstance().getLogger();
