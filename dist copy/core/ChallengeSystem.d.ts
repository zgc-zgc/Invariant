import { APIManager } from '../api/APIManager';
import { ChallengeResult, ConvergenceConfig } from '../types';
export declare class ChallengeSystem {
    private apiManager;
    private convergenceConfig;
    private progressDisplay;
    private logger;
    constructor(apiManager: APIManager, convergenceConfig: ConvergenceConfig);
    conductChallenge(agentType: 'Explorer' | 'Deepener', initialPrompt: string, contractCode: string, supplementaryPrompts?: string[]): Promise<ChallengeResult>;
    private callAlphaRole;
    private callBetaRole;
    private buildChallengePrompt;
    private formatSupplementaryPrompts;
    private updateDiscoverySet;
    private calculateConvergenceScore;
    private shouldConverge;
    private getConvergenceReason;
}
//# sourceMappingURL=ChallengeSystem.d.ts.map