export declare class BatchAnalysisOrchestrator {
    private progressManager;
    private materialReader;
    private discoveryOrchestrator;
    private logger;
    constructor(configPath: string);
    analyzeBatch(): Promise<void>;
    private analyzeSingleMaterial;
    private aggregateResults;
    getProgress(): {
        completed: number;
        total: number;
        percentage: number;
    };
    resumeAnalysis(): Promise<void>;
}
//# sourceMappingURL=BatchAnalysisOrchestrator.d.ts.map