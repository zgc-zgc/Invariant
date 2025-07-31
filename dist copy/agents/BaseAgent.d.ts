import { APIManager } from '../api/APIManager';
import { AgentMessage } from '../types';
interface IAgentLogger {
    debug: (message: string) => void;
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
}
export declare abstract class BaseAgent {
    protected apiManager: APIManager;
    protected agentRole: 'Explorer' | 'Deepener' | 'Synthesizer';
    protected logger: IAgentLogger;
    constructor(apiManager: APIManager, role: 'Explorer' | 'Deepener' | 'Synthesizer');
    protected createMessage(messageType: 'discovery' | 'assessment' | 'challenge' | 'synthesis', content: {
        description: string;
        reasoning: string;
        assumptions?: string[];
        questions?: string[];
    }, discovery?: AgentMessage['discovery']): AgentMessage;
    protected buildSystemPrompt(): string;
    protected callAI(prompt: string): Promise<string>;
    protected buildPromptWithContract(basePrompt: string, contractCode: string): string;
}
export {};
//# sourceMappingURL=BaseAgent.d.ts.map