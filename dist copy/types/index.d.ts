export interface AgentMessage {
    messageId: string;
    agentRole: 'Explorer' | 'Deepener' | 'Synthesizer';
    messageType: 'discovery' | 'assessment' | 'challenge' | 'synthesis';
    discovery?: {
        invariantId: string;
        category: string;
        relatedElements: {
            functions: string[];
            variables: string[];
        };
    };
    content: {
        description: string;
        reasoning: string;
        assumptions?: string[];
        questions?: string[];
    };
    referenceTo?: string[];
}
export interface Invariant {
    description: string;
    type?: string;
    importance?: string;
    relatedFunctions?: string[];
}
export interface DiscoveryResult {
    invariants?: Invariant[];
    totalProcessingTime?: number;
    executionTime?: number;
    metadata?: {
        explorerMessages?: number;
        deepenerMessages?: number;
        coreInvariants?: number;
        executionStages?: string[];
        timestamp?: string;
    };
    discussionSummary?: string;
    contract?: string;
    discoveredInvariants?: Invariant[];
}
export interface SharedContext {
    contractCode: string;
    contractName: string;
    discussionHistory: AgentMessage[];
    discoveredInvariants: Invariant[];
    openQuestions: string[];
    coreInvariants?: Invariant[];
    currentRound: number;
}
export interface APIConfig {
    endpoint: string;
    apiKey: string;
    model: string;
    retryConfig: {
        enabled: boolean;
        maxRetries: number;
        delayMs: number;
        handle429: boolean;
    };
}
export interface ConvergenceConfig {
    minRounds: number;
    maxRounds: number;
    discoveryThreshold: number;
    maxChallengeRounds: number;
    challengeConvergenceThreshold: number;
}
export interface ExplorationTask {
    category: string;
    prompts: string[];
    priority: 'low' | 'normal' | 'high';
    context?: Record<string, any>;
}
export interface ChallengeRound {
    roundNumber: number;
    alphaMessage: AgentMessage;
    betaMessage: AgentMessage;
    newDiscoveries: number;
    convergenceScore: number;
}
export interface ChallengeResult {
    totalRounds: number;
    converged: boolean;
    convergenceReason: 'max_rounds' | 'no_new_content' | 'threshold_reached';
    finalDiscoveries: AgentMessage[];
}
//# sourceMappingURL=index.d.ts.map