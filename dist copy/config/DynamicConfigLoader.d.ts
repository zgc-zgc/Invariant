import { ExplorationTask } from '../types';
export declare class DynamicConfigLoader {
    private config;
    constructor(configPaths?: string[]);
    private loadConfigs;
    getConfigCategories(): string[];
    generateExplorationTasks(contractInfo: ContractInfo): Promise<ExplorationTask[]>;
    private createExplorationTask;
    private expandTemplatedPrompts;
    private findMatchingFunctions;
    addCustomConfig(category: string, prompts: string[]): void;
    getCategoryConfig(category: string): any;
}
export interface ContractInfo {
    contractName: string;
    stateVariables: Array<{
        name: string;
        type: string;
        visibility: string;
    }>;
    functions: Array<{
        name: string;
        parameters: string[];
        visibility: string;
    }>;
}
//# sourceMappingURL=DynamicConfigLoader.d.ts.map