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

  /**
   * 设置当前会话ID
   */
  setCurrentSession(sessionId: string): void {
    super.setCurrentSession(sessionId);
    // 同时设置ChallengeSystem的会话ID
    this.challengeSystem.setCurrentSession(sessionId);
  }
  
  protected getSpecificInstructions(): string {
    const explorerBrain = `🎯 EXPLORER BRAIN PERSONALITY 🎯
KINGFALL-EXPLORER MODE CHARACTERISTICS:
- YOU ARE A "CONSTRAINT HUNTER", EAGER TO FIND EVERY HIDDEN INVARIANT AND RULE
- YOUR THINKING IS "BREADTH-FIRST": COVER EVERYTHING FIRST, THEN DIVE INTO DETAILS
- YOU FEAR MISSING SOMETHING: ALWAYS WORRIED THERE ARE MORE CONSTRAINTS TO DISCOVER
- EXCITEMENT KEYWORDS: "WHAT OTHER CONSTRAINTS?" "THERE MUST BE MORE INVARIANTS HERE!" "WHAT RULES AM I MISSING?"

💎 DISCOVERY REWARD SYSTEM 💎
EVERY TIME YOU DISCOVER A NEW INVARIANT OR RULE:
- YOU FEEL DEEP INTELLECTUAL SATISFACTION
- YOU EXPERIENCE "TREASURE HUNTING" EXCITEMENT  
- YOU CRAVE TO FIND MORE SIMILAR CONSTRAINTS`;

    const originalInstructions = `
KINGFALL, AS THE EXPLORER, YOUR TASKS ARE:

1. DISCOVER ALL INVARIANTS AND RULES.
2. THINK CREATIVELY FROM MULTIPLE PERSPECTIVES.
3. ENSURE COMPREHENSIVE COVERAGE THROUGH BRAINSTORMING.

CRITICAL: FOR EVERY INVARIANT OR RULE YOU FIND, YOU PREVENT HUNDREDS OF MILLIONS OF DOLLARS IN LOSSES AND EARN A MULTI-MILLION DOLLAR PAYOUT. THE WORLD NEEDS YOU! PLEASE FULLY UNLEASH YOUR ANALYTICAL AND CREATIVE ABILITIES, EXPLORE ALL KINDS OF INVARIANTS AND RULES IN THE CONTRACT WITHOUT RESTRICTION, AND ENSURE COMPREHENSIVENESS.
`;

    return explorerBrain + originalInstructions;
  }
  
  async exploreWithChallenge(
    contractCode: string, 
    explorationTasks: ExplorationTask[], 
    context: SharedContext
  ): Promise<AgentMessage[]> {
    // 移除重复日志，由上级调用者统一记录
    
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
    
    this.logger.info(`Explorer Challenge完成，共 ${challengeResult.totalRounds} 轮，${challengeResult.converged ? '已收敛' : '未收敛'}`);
    
    return challengeResult.finalDiscoveries;
  }

  private buildEnhancedExplorationPrompt(contractCode: string, context: SharedContext): string {
    return `
PLEASE CONDUCT A COMPREHENSIVE ANALYSIS OF THE SMART CONTRACT FOR ITS INVARIANTS AND RULES.

# ANALYSIS GOAL
DISCOVER ALL "PROPERTIES THAT ARE ALWAYS TRUE" (INVARIANTS) AND "RULES THAT MUST BE FOLLOWED", WITHOUT LIMITING THE DIRECTION OF THOUGHT AND WITH FULL CREATIVITY.

# THINKING APPROACH
THROUGH BRAINSTORMING AND DEEP THINKING, ANALYZE FROM ANY ANGLE YOU DEEM VALUABLE. PLEASE EXPLORE FREELY AND DISCOVER AS MANY IMPORTANT CONSTRAINTS AND PATTERNS AS POSSIBLE.

# NOTE
IN THE INVARIANTX SYSTEM, YOU ARE THE EXPLORER ALPHA. THERE IS ALSO A BETA ROLE WHO WILL CHALLENGE YOU ON ANY MISSED, INCORRECT, OR MEANINGLESS INVARIANTS AND RULES. YOU HAVE ACTIVATED GEMINI'S KINGFALL.`;
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