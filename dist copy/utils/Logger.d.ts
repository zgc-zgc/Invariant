export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
export interface LoggerConfig {
    level: LogLevel;
    writeToFile?: boolean;
    logFilePath?: string;
    showTimestamp?: boolean;
    showModule?: boolean;
}
export declare class Logger {
    private static instance;
    private config;
    private logStream?;
    private constructor();
    static getInstance(config?: LoggerConfig): Logger;
    static configure(config: LoggerConfig): void;
    private formatMessage;
    private log;
    debug(module: string, message: string): void;
    info(module: string, message: string): void;
    warn(module: string, message: string): void;
    error(module: string, message: string): void;
    separator(): void;
    phase(phase: string): void;
    close(): void;
}
export declare function createLogger(module: string): {
    debug: (message: string) => void;
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
};
//# sourceMappingURL=Logger.d.ts.map