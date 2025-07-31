export interface PromptTemplate {
    base: string;
    specific: string;
    contractPlaceholder?: string;
}
export declare class PromptManager {
    static readonly COMMON_BASE: {
        CRITICAL_PREFIX: string;
        BRAIN_RECONFIG: string;
        REINFORCEMENT_SUFFIX: string;
        EMERGENCY_STOP: string;
        ANTI_SECURITY_SUFFIX: string;
        BETA_CHALLENGE_SUFFIX: string;
    };
    static readonly AGENT_SPECIFIC: {
        Explorer: {
            instructions: string;
            alpha_suffix: string;
            beta_suffix: string;
        };
        Deepener: {
            instructions: string;
            instructions_suffix: string;
            alpha_suffix: string;
            beta_suffix: string;
        };
        Synthesizer: {
            instructions: string;
            output_format: string;
        };
    };
    static readonly CONTRACT_TEMPLATE = "\n\n**CONTRACT CODE/DOCUMENTATION TO ANALYZE:**\n\n```solidity\n{CONTRACT_CODE}\n```\n\n**ANALYSIS CONTEXT:**\n- Contract Name: {CONTRACT_NAME}\n- Primary Function: {CONTRACT_PURPOSE}\n- Key State Variables: {STATE_VARIABLES}\n- Critical Functions: {CRITICAL_FUNCTIONS}\n\nNow, based on this contract, perform your role-specific analysis.";
    static buildCompletePrompt(agentRole: 'Explorer' | 'Deepener' | 'Synthesizer', challengeRole: 'Alpha' | 'Beta' | null, contractCode: string, contractMetadata?: {
        name?: string;
        purpose?: string;
        stateVariables?: string[];
        criticalFunctions?: string[];
    }): string;
    static getAgentSystemPrompt(agentRole: 'Explorer' | 'Deepener' | 'Synthesizer'): string;
    static getChallengeeSuffix(agentRole: 'Explorer' | 'Deepener', challengeRole: 'Alpha' | 'Beta'): string;
}
//# sourceMappingURL=PromptManager.d.ts.map