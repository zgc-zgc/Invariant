import { BaseAgent } from './BaseAgent';
import { APIManager } from '../api/APIManager';
import { AgentMessage } from '../types';
export declare class DeepenerAgent extends BaseAgent {
    private challengeSystem;
    constructor(apiManager: APIManager);
    analyzePrerequisites(explorerFindings: AgentMessage[], contractCode: string): Promise<AgentMessage[]>;
    private buildEnhancedDeepeningPrompt;
    private buildPrerequisiteAnalysisPrompt;
}
//# sourceMappingURL=DeepenerAgent.d.ts.map