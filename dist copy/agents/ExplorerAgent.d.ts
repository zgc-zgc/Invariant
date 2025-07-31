import { BaseAgent } from './BaseAgent';
import { APIManager } from '../api/APIManager';
import { AgentMessage, SharedContext, ExplorationTask } from '../types';
export declare class ExplorerAgent extends BaseAgent {
    private challengeSystem;
    constructor(apiManager: APIManager);
    exploreWithChallenge(contractCode: string, explorationTasks: ExplorationTask[], context: SharedContext): Promise<AgentMessage[]>;
    private buildEnhancedExplorationPrompt;
    private extractSupplementaryPrompts;
    explore(contractCode: string, explorationTasks: ExplorationTask[], context: SharedContext): Promise<AgentMessage[]>;
}
//# sourceMappingURL=ExplorerAgent.d.ts.map