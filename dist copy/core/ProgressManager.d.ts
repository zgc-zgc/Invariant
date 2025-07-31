import { DiscoveryResult } from '../types';
export interface MaterialItem {
    id: string;
    type: 'contract' | 'document' | 'folder';
    name: string;
    path: string;
    priority: 'high' | 'medium' | 'low';
    completed: boolean;
}
export interface MaterialsConfig {
    projectName: string;
    description: string;
    materials: MaterialItem[];
    outputPath: string;
    resumeFrom: string | null;
    lastUpdated: string | null;
}
export interface AnalysisState {
    configPath: string;
    currentMaterialId: string | null;
    completedMaterials: string[];
    aggregatedResults: DiscoveryResult[];
    startTime: number;
    lastSaveTime: number;
}
export declare class ProgressManager {
    private stateFilePath;
    private config;
    private state;
    private logger;
    constructor(configPath: string);
    private loadConfig;
    private loadOrCreateState;
    saveState(): void;
    private updateConfigProgress;
    getNextMaterial(): MaterialItem | null;
    markMaterialStarted(materialId: string): void;
    markMaterialCompleted(materialId: string, result: DiscoveryResult): void;
    saveAggregatedResults(): void;
    private generateSummary;
    getProgress(): {
        completed: number;
        total: number;
        percentage: number;
    };
    getAllMaterials(): MaterialItem[];
    isCompleted(): boolean;
    cleanup(): void;
}
//# sourceMappingURL=ProgressManager.d.ts.map