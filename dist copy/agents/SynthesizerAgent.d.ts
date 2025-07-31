import { BaseAgent } from './BaseAgent';
import { APIManager } from '../api/APIManager';
import { AgentMessage, Invariant, DiscoveryResult } from '../types';
export declare class SynthesizerAgent extends BaseAgent {
    constructor(apiManager: APIManager);
    identifyCore(messages: AgentMessage[], contractCode?: string): Promise<Invariant[]>;
    finalSynthesize(data: {
        explorerFindings: AgentMessage[];
        prerequisiteAnalysis: AgentMessage[];
        contractCode?: string;
    }): Promise<DiscoveryResult>;
    private extractPrerequisiteMap;
    private buildFinalResult;
    private parseCoreInvariants;
    private saveFailedParseResult;
    private parseFinalResult;
    private findArraysInObject;
    private looksLikeInvariant;
    private extractDescription;
    private extractJSON;
}
//# sourceMappingURL=SynthesizerAgent.d.ts.map