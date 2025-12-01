// ==============================================================================
// PRODUCTION-READY LOGGER UTILITY
// ==============================================================================
// Centralized logging that can be disabled in production
// ==============================================================================

const isDevelopment = import.meta.env.DEV;
const isDebugEnabled = import.meta.env.VITE_DEBUG === 'true';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
    enabledLevels: LogLevel[];
    prefix: string;
}

const defaultConfig: LoggerConfig = {
    enabledLevels: isDevelopment || isDebugEnabled 
        ? ['debug', 'info', 'warn', 'error'] 
        : ['warn', 'error'],
    prefix: '[Genesis]'
};

class Logger {
    private config: LoggerConfig;

    constructor(config: Partial<LoggerConfig> = {}) {
        this.config = { ...defaultConfig, ...config };
    }

    private shouldLog(level: LogLevel): boolean {
        return this.config.enabledLevels.includes(level);
    }

    private formatMessage(level: LogLevel, message: string): string {
        const timestamp = new Date().toISOString();
        return `${this.config.prefix} [${timestamp}] [${level.toUpperCase()}] ${message}`;
    }

    debug(message: string, ...args: unknown[]): void {
        if (this.shouldLog('debug')) {
            console.log(this.formatMessage('debug', message), ...args);
        }
    }

    info(message: string, ...args: unknown[]): void {
        if (this.shouldLog('info')) {
            console.info(this.formatMessage('info', message), ...args);
        }
    }

    warn(message: string, ...args: unknown[]): void {
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', message), ...args);
        }
    }

    error(message: string, ...args: unknown[]): void {
        if (this.shouldLog('error')) {
            console.error(this.formatMessage('error', message), ...args);
        }
    }

    // Create a child logger with a custom prefix
    child(prefix: string): Logger {
        return new Logger({
            ...this.config,
            prefix: `${this.config.prefix}:${prefix}`
        });
    }
}

// Singleton instance
export const logger = new Logger();

// Named loggers for different modules
export const collaborationLogger = logger.child('Collab');
export const generationLogger = logger.child('Generate');
export const authLogger = logger.child('Auth');
export const storageLogger = logger.child('Storage');

export default logger;
