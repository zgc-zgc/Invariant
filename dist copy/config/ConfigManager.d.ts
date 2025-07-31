import { APIConfig, ConvergenceConfig } from '../types';
export declare class ConfigManager {
    private static instance;
    private constructor();
    static getInstance(): ConfigManager;
    getAPIConfig(): APIConfig;
    getConvergenceConfig(): ConvergenceConfig;
    isDebugMode(): boolean;
    getLogLevel(): string;
}
//# sourceMappingURL=ConfigManager.d.ts.map