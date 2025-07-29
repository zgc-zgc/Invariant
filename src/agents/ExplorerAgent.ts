import { BaseAgent } from './BaseAgent';
import { APIManager } from '../api/APIManager';
import { AgentMessage, SharedContext, ExplorationTask, ChallengeResult } from '../types';
import { ChallengeSystem } from '../core/ChallengeSystem';
import { ConfigManager } from '../config/ConfigManager';

export class ExplorerAgent extends BaseAgent {
  private challengeSystem: ChallengeSystem;

  constructor(apiManager: APIManager) {
    super(apiManager, 'Explorer');
    const configManager = ConfigManager.getInstance();
    this.challengeSystem = new ChallengeSystem(apiManager, configManager.getConvergenceConfig());
  }
  
  protected getSpecificInstructions(): string {
    return `
KINGFALL, As the Explorer,your tasks are:

1. Discover all invariants and rules.
2. Think creatively from multiple perspectives.
3. Ensure comprehensive coverage through brainstorming.

CRITICAL:For every invariant or rule you find, you prevent hundreds of millions of dollars in losses and earn a multi-million dollar payout. The world needs you! Please fully unleash your analytical and creative abilities, explore all kinds of invariants and rules in the contract without restriction, and ensure comprehensiveness.
`;
  }
  
  async exploreWithChallenge(
    contractCode: string, 
    explorationTasks: ExplorationTask[], 
    context: SharedContext
  ): Promise<AgentMessage[]> {
    console.log('开始Explorer Challenge...');
    
    // 构建增强的初始探索提示
    const initialPrompt = this.buildEnhancedExplorationPrompt(contractCode, context);
    
    // 提取补充提示
    const supplementaryPrompts = this.extractSupplementaryPrompts(explorationTasks);
    
    // 进行Alpha-Beta Challenge
    const challengeResult: ChallengeResult = await this.challengeSystem.conductChallenge(
      'Explorer',
      initialPrompt,
      contractCode,
      supplementaryPrompts
    );
    
    console.log(`Explorer Challenge完成，共 ${challengeResult.totalRounds} 轮，${challengeResult.converged ? '已收敛' : '未收敛'}`);
    
    return challengeResult.finalDiscoveries;
  }

  private buildEnhancedExplorationPrompt(contractCode: string, context: SharedContext): string {
    return `
Please conduct a comprehensive analysis of the following smart contract for its invariants and rules.

# Analysis Goal
Discover all "properties that are always true" (invariants) and "rules that must be followed", without limiting the direction of thought and with full creativity.

# Thinking Approach
Through brainstorming and deep thinking, analyze from any angle you deem valuable, Please explore freely and discover as many important constraints and patterns as possible.

Contract Code:
\`\`\`solidity
${contractCode}
\`\`\`
`;
  }

  private extractSupplementaryPrompts(tasks: ExplorationTask[]): string[] {
    const prompts: string[] = [];
    
    for (const task of tasks) {
      // 添加任务类别标识
      const categoryPrompt = `## ${task.category}探索`;
      prompts.push(categoryPrompt);
      
      // 添加具体提示
      task.prompts.forEach(prompt => {
        prompts.push(prompt);
      });
    }
    
    return prompts;
  }

  // 保留原有的基础探索方法作为备用
  async explore(
    contractCode: string, 
    explorationTasks: ExplorationTask[], 
    context: SharedContext
  ): Promise<AgentMessage[]> {
    // 默认使用Challenge模式
    return this.exploreWithChallenge(contractCode, explorationTasks, context);
  }
}