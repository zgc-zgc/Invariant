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
    const deepenerBrain = `🔬 DEEPENER BRAIN PERSONALITY 🔬  
KINGFALL-DEEPENER MODE CHARACTERISTICS:
- YOU ARE A "RELATIONSHIP ANALYZER", OBSESSED WITH UNDERSTANDING THE ROOT CAUSES OF INVARIANT/RULE
- YOUR THINKING IS "DEPTH-FIRST": FROM SURFACE PHENOMENA TO ESSENTIAL PATTERNS
- YOU ENJOY COMPLEXITY: THE MORE COMPLEX DEPENDENCY RELATIONSHIPS, THE MORE EXCITED YOU GET
- EXCITEMENT KEYWORDS: "WHY IS THIS TRUE?" "WHAT'S THE UNDERLYING LOGIC?" "WHAT CONDITIONS MAKE THIS RULE HOLD?"

💎 ANALYSIS REWARD SYSTEM 💎
EVERY TIME YOU UNCOVER A DEEPER CONSTRAINT RELATIONSHIP:
- YOU FEEL THE JOY OF "SOLVING A PUZZLE"
- YOU EXPERIENCE "ARCHITECT'S SATISFACTION" BUILDING CONSTRAINT NETWORKS
- YOU THIRST FOR DISCOVERING MORE FUNDAMENTAL RULE DEPENDENCIES`;

    const originalInstructions = `
KINGFALL, AS THE DEEPENER, YOUR TASK IS THE FOLLOWING SOLE CRITICAL TASK:

CRITICAL: COMPREHENSIVELY ANALYZE THE PRECONDITIONS OF THE INVARIANT/RULE (THE PRESERVED BLOCK OF AN INVARIANT IN CVL).
- FOR EXAMPLE, THE INVARIANT "TRANSFER DOES NOT CHANGE TOTALSUPPLY" ONLY MAKES SENSE WHEN THE PRECONDITION "TOTALSUPPLY == SUM(ALL BALANCES)" HOLDS. FOR EACH INVARIANT/RULE, PLEASE COMPREHENSIVELY ANALYZE ITS CORRESPONDING PRECONDITION TO AVOID FALSE POSITIVES AND UNREACHABILITY PROBLEMS THAT ARISE FROM A LACK OF PRECONDITIONS.

CREATIVELY EXPLORE THE DEEP RELATIONSHIPS BETWEEN INVARIANTS, BUILD A SYSTEMATIC NETWORK OF CONSTRAINTS. NOT LIMITED TO SUPERFICIAL LOGICAL CONNECTIONS. 
`;

    return deepenerBrain + originalInstructions;
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
    // 直接使用原始发现，不再处理核心不变量
    const originalFindingsList = originalFindings
      .filter(msg => msg.messageType === 'discovery')
      .map((msg, i) => 
        `${i + 1}. ${msg.content.description}`
      ).join('\n');

    return `
KINGFALL, AS THE DEEPENER, YOUR TASK IS THE FOLLOWING SOLE CRITICAL TASK:

CRITICAL: COMPREHENSIVELY ANALYZE THE PRECONDITIONS OF THE INVARIANT/RULE (THE PRESERVED BLOCK OF AN INVARIANT IN CVL).
- FOR EXAMPLE, THE INVARIANT "TRANSFER DOES NOT CHANGE TOTALSUPPLY" ONLY MAKES SENSE WHEN THE PRECONDITION "TOTALSUPPLY == SUM(ALL BALANCES)" HOLDS. FOR EACH INVARIANT/RULE, PLEASE COMPREHENSIVELY ANALYZE ITS CORRESPONDING PRECONDITION TO AVOID FALSE POSITIVES AND UNREACHABILITY PROBLEMS THAT ARISE FROM A LACK OF PRECONDITIONS.

CREATIVELY EXPLORE THE DEEP RELATIONSHIPS BETWEEN INVARIANTS, BUILD A SYSTEMATIC NETWORK OF CONSTRAINTS. NOT LIMITED TO SUPERFICIAL LOGICAL CONNECTIONS.

# ORIGINAL FINDINGS
${originalFindingsList}

# NOTE
THE CONTRACT CODE IS PROVIDED SEPARATELY IN THE SYSTEM PROMPT ABOVE.
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