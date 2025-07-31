export declare class ProgressDisplay {
    private startTime;
    private currentPhase;
    private subPhases;
    constructor();
    updatePhase(phase: string): void;
    updateSubPhase(name: string, current: number, total: number): void;
    showDiscoveryProgress(explorerAlpha: number, explorerBeta: number, synthesizerProgress: number, deepenerProgress: number, totalInvariants: number): void;
    showChallengeProgress(agentType: string, round: number, maxRounds: number, newDiscoveries: number, convergenceScore: number): void;
    showBatchProgress(currentMaterial: string, completed: number, total: number, currentInvariants: number): void;
    private render;
    private renderBar;
    private truncate;
    showConvergenceAnalysis(lengthRatio: number, wordOverlap: number, keyTermSimilarity: number, overallScore: number): void;
    private renderMiniBar;
}
//# sourceMappingURL=ProgressDisplay.d.ts.map