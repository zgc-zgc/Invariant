import { DiscoveryResult } from '../types';
export declare class InvariantDiscoveryOrchestrator {
    private configManager;
    private apiManager;
    private configLoader;
    private logger;
    private explorer;
    private deepener;
    private synthesizer;
    constructor();
    discoverInvariants(contractCode: string, configPath?: string): Promise<DiscoveryResult>;
    private explorerChallengePhase;
    private deepenerChallengePhase;
    private loadExplorationTasks;
    discoverWithCustomPrompts(contractCode: string, customPrompts: string[]): Promise<DiscoveryResult>;
}
//# sourceMappingURL=InvariantDiscoveryOrchestrator.d.ts.map