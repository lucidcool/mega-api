import pino from 'pino';
import { randomUUID } from 'crypto';

export class LoggerService {
    private static instance: LoggerService;
    private logger: pino.Logger;

    private constructor() {
        this.logger = pino({
            transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                levelFirst: true,
                translateTime: 'yyyy-mm-dd HH:MM:ss',
                ignore: 'pid,hostname',
            }
            }
        });
    }

    public static getInstance(): LoggerService {
        if (!LoggerService.instance) {
            LoggerService.instance = new LoggerService();
        }
        return LoggerService.instance;
    }

    public info(message: string, data?: object): void {
        this.logger.info(data || {}, message);
    }

    public error(message: string, error?: Error | unknown, data?: object): void {
        const errorData = error instanceof Error
            ? { ...data, error: { message: error.message, stack: error.stack } }
            : data;
        
        this.logger.error(errorData || {}, message);
    }

    public warn(message: string, data?: object): void {
        this.logger.warn(data || {}, message);
    }

    public debug(message: string, data?: object): void {
        this.logger.debug(data || {}, message);
    }

    public child(bindings: object): LoggerService {
        const childLogger = new LoggerService();
        childLogger.logger = this.logger.child(bindings);
        return childLogger;
    }
}

export default LoggerService.getInstance();