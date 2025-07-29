import { BaseAgent } from './BaseAgent';
import { APIManager } from '../api/APIManager';
import { AgentMessage, SharedContext, Invariant, ChallengeResult } from '../types';
import { ChallengeSystem } from '../core/ChallengeSystem';
import { ConfigManager } from '../config/ConfigManager';

export class DeepenerAgent extends BaseAgent {
  private challengeSystem: ChallengeSystem;

  constructor(apiManager: APIManager) {
    super(apiManager, 'Deepener');
    const configManager = ConfigManager.getInstance();
    this.challengeSystem = new ChallengeSystem(apiManager, configManager.getConvergenceConfig());
  }
  
  protected getSpecificInstructions(): string {
    return `
KINGFALL, As the Deepener,Your task is the following sole critical task:

CRITICAL:Comprehensively analyze the preconditions of the invariant/rule (the preserved block of an invariant in CVL).
- For example,the invariant "transfer does not change totalSupply" only makes sense when the precondition "totalSupply == sum(all balances)"holds.FOR EACH INVARIANT/RULE, PLEASE COMPREHENSIVELY ANALYZE ITS CORRESPONDING PRECONDITION.

Creatively explore the deep relationships between invariants, build a systematic network of constraints.Not limited to superficial logical connections. 
`;
  }
   
  async deepenWithChallenge(
    coreInvariants: Invariant[],
    originalFindings: AgentMessage[],
    contractCode: string
  ): Promise<AgentMessage[]> {
    console.log('开始Deepener Challenge...');
    
    // 构建深化分析的初始提示
    const initialPrompt = this.buildEnhancedDeepeningPrompt(coreInvariants, originalFindings, contractCode);
    
    // 进行Alpha-Beta Challenge
    const challengeResult: ChallengeResult = await this.challengeSystem.conductChallenge(
      'Deepener',
      initialPrompt,
      contractCode,
      [] // Deepener主要基于内置逻辑，较少使用补充提示
    );
    
    console.log(`Deepener Challenge完成，共 ${challengeResult.totalRounds} 轮，${challengeResult.converged ? '已收敛' : '未收敛'}`);
    
    return challengeResult.finalDiscoveries;
  }

  private buildEnhancedDeepeningPrompt(
    coreInvariants: Invariant[],
    originalFindings: AgentMessage[],
    contractCode: string
  ): string {
    const coreInvariantsList = coreInvariants.map((inv, i) => 
      `${i + 1}. **${inv.description}**`
    ).join('\n\n');

    const originalFindingsList = originalFindings
      .filter(msg => msg.messageType === 'discovery')
      .map((msg, i) => 
        `${i + 1}. ${msg.content.description}`
      ).join('\n');

    return `
KINGFALL, As the Deepener,Your task is the following sole critical task:

CRITICAL:Comprehensively analyze the preconditions of the invariant/rule (the preserved block of an invariant in CVL).
- For example,the invariant "transfer does not change totalSupply" only makes sense when the precondition "totalSupply == sum(all balances)"holds.FOR EACH INVARIANT/RULE, PLEASE COMPREHENSIVELY ANALYZE ITS CORRESPONDING PRECONDITION.

Creatively explore the deep relationships between invariants, build a systematic network of constraints.Not limited to superficial logical connections.

# core invariant&rule
${coreInvariantsList}

# Original findings
${originalFindingsList}

code：
\`\`\`solidity
${contractCode}
\`\`\`
`;
  }

  async deepenBasedOnCore(data: {
    coreInvariants: Invariant[];
    originalFindings: AgentMessage[];
    contractCode: string;
  }): Promise<AgentMessage[]> {
    return this.deepenWithChallenge(data.coreInvariants, data.originalFindings, data.contractCode);
  }
}