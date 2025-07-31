export interface AILogEntry {
    timestamp: string;
    type: 'PROMPT' | 'RESPONSE' | 'SYSTEM_LOG';
    agent?: string;
    content: string;
    metadata?: {
        duration?: number;
        error?: string;
        [key: string]: any;
    };
}
export declare class AICommunicationLogger {
    private static instance;
    private logBuffer;
    private logFilePath;
    private isEnabled;
    private writeStream;
    private constructor();
    static getInstance(): AICommunicationLogger;
    enable(): void;
    disable(): void;
    logPrompt(agent: string, prompt: string, metadata?: any): void;
    logResponse(agent: string, response: string, duration?: number, metadata?: any): void;
    logSystem(message: string, metadata?: any): void;
    private addEntry;
    private writeHeader;
    private writeEntryToFile;
    private flushBuffer;
    getLogFilePath(): string;
    isLoggingEnabled(): boolean;
}
export declare const aiLogger: AICommunicationLogger;
//# sourceMappingURL=AICommunicationLogger.d.ts.map