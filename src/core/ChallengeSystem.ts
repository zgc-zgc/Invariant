import { APIManager } from '../api/APIManager';
import { AgentMessage, ChallengeRound, ChallengeResult, ConvergenceConfig, SharedContext } from '../types';
import { ExecutionSnapshot } from '../types/SessionTypes';
import { SimpleSessionManager } from './SimpleSessionManager';
import { v4 as uuidv4 } from 'uuid';
import { ProgressDisplay } from '../utils/ProgressDisplay';
import { createLogger } from '../utils/Logger';

export class ChallengeSystem {
  private apiManager: APIManager;
  private convergenceConfig: ConvergenceConfig;
  private progressDisplay: ProgressDisplay;
  private sessionManager: SimpleSessionManager;
  private logger = createLogger('ChallengeSystem');
  private currentSessionId: string | null = null;
  private lastFailureTimestamp: number = 0;
  private readonly FAILURE_COOLDOWN = 5000; // 5秒内的连续失败只创建一次恢复点

  constructor(apiManager: APIManager, convergenceConfig: ConvergenceConfig) {
    this.apiManager = apiManager;
    this.convergenceConfig = convergenceConfig;
    this.progressDisplay = new ProgressDisplay();
    this.sessionManager = SimpleSessionManager.getInstance();
  }

  /**
   * 设置当前会话ID，用于创建恢复点
   */
  setCurrentSession(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  /**
   * 安全的API调用包装，失败时创建恢复点
   */
  private async safeCallAPI(prompt: string, agentRole: 'Explorer' | 'Deepener', context?: any): Promise<string> {
    this.logger.debug(`🔍 safeCallAPI: 准备调用API (Agent: ${agentRole}, SessionID: ${this.currentSessionId})`);
    
    try {
      const response = await this.apiManager.callAPI(prompt, agentRole);
      this.logger.debug(`✅ safeCallAPI: API调用成功 (Agent: ${agentRole})`);
      
      return response;
    } catch (error) {
      this.logger.warn(`🚨 safeCallAPI: API调用失败 (Agent: ${agentRole}): ${(error as Error).message}`);
      
      // 在API失败时创建恢复点
      try {
        await this.createRecoveryPointOnFailure(prompt, agentRole, context, error as Error);
        this.logger.info(`🔄 safeCallAPI: 恢复点创建完成 (Agent: ${agentRole})`);
      } catch (recoveryError) {
        this.logger.error(`❌ safeCallAPI: 恢复点创建失败: ${(recoveryError as Error).message}`);
      }
      
      throw error; // 重新抛出错误
    }
  }

  /**
   * API调用失败时创建恢复点
   */
  private async createRecoveryPointOnFailure(
    failedPrompt: string, 
    agentRole: 'Explorer' | 'Deepener', 
    context?: any, 
    error?: Error
  ): Promise<void> {
    this.logger.debug(`🔍 createRecoveryPointOnFailure: 准备创建恢复点 (Agent: ${agentRole}, SessionID: ${this.currentSessionId})`);
    
    if (!this.currentSessionId) {
      this.logger.warn('❌ createRecoveryPointOnFailure: 没有会话ID，跳过恢复点创建');
      return;
    }

    const now = Date.now();
    
    // 防止连续失败时重复创建恢复点
    if (now - this.lastFailureTimestamp < this.FAILURE_COOLDOWN) {
      this.logger.debug(`⏭️ createRecoveryPointOnFailure: 连续API失败，跳过恢复点创建 (冷却时间: ${this.FAILURE_COOLDOWN}ms)`);
      return;
    }

    try {
      this.logger.debug(`📝 createRecoveryPointOnFailure: 构建执行快照 (Phase: ${agentRole === 'Explorer' ? 'explorer' : 'deepener'})`);
      
      // 从上下文中提取完整信息
      const fullContext = context || this.createEmptyContext();
      
      // 创建完整的执行快照，包含所有恢复所需信息
      const snapshot: ExecutionSnapshot = {
        sessionId: this.currentSessionId,
        phase: agentRole === 'Explorer' ? 'explorer' : 'deepener',
        subPhase: `${agentRole.toLowerCase()}_api_failure`,
        currentRound: fullContext.currentRound || 1,
        maxRounds: this.convergenceConfig.maxChallengeRounds || 10,
        context: fullContext,
        intermediateResults: fullContext.discoveredInvariants || [],
        timestamp: now,
        
        executionState: {
          lastCompletedStep: `${agentRole}_before_api_call`,
          nextStep: `${agentRole}_retry_api_call`,
          stepProgress: this.calculateCurrentProgress(agentRole),
          totalSteps: 7,
          lastAPICall: {
            agent: agentRole,
            prompt: failedPrompt, // 保存完整prompt以便重试
            timestamp: now,
            status: 'failed',
            retryCount: 0
          }
        },
        
        metadata: {
          totalExecutionTime: now - (fullContext.startTime || now),
          apiCallCount: fullContext.apiCallCount || 1,
          errorCount: (fullContext.errorCount || 0) + 1,
          lastSavedAt: now,
          dataSize: JSON.stringify(fullContext).length + failedPrompt.length,
          error: error?.message || 'Unknown API error'
        },
        
        // 添加恢复运行所需的额外信息
        recoveryData: {
          contractCode: fullContext.contractCode || '',
          contractName: fullContext.contractName || 'Unknown',
          configPath: fullContext.configPath || './configs/default-config.json',
          materialId: fullContext.materialId || null,
          batchConfigPath: fullContext.batchConfigPath || null,
          
          // 保存已完成的分析结果
          explorerFindings: fullContext.explorerFindings || null,
          deepenerProgress: fullContext.deepenerProgress || null,
          
          // 保存当前阶段的中间结果
          currentPhaseData: {
            roundHistory: fullContext.roundHistory || [],
            alphaMessage: fullContext.alphaMessage || null,
            betaMessage: fullContext.betaMessage || null,
            supplementaryPrompts: fullContext.supplementaryPrompts || []
          }
        }
      };

      this.logger.debug(`💾 createRecoveryPointOnFailure: 保存恢复点到SessionManager`);
      await this.sessionManager.createRecoveryPoint(snapshot);
      this.lastFailureTimestamp = now;
      
      this.logger.info(`🔄 API失败恢复点已创建 (${agentRole}阶段)`);
      this.logger.info(`📊 恢复点详情: Phase=${snapshot.phase}, SubPhase=${snapshot.subPhase}, ErrorCount=${snapshot.metadata.errorCount}`);
      this.logger.debug(`💬 失败原因: ${error?.message || 'Unknown error'}`);
      
    } catch (recoveryError) {
      this.logger.error(`❌ createRecoveryPointOnFailure: 创建API失败恢复点时出错: ${(recoveryError as Error).message}`);
      this.logger.error(`🔍 恢复错误详情: ${(recoveryError as Error).stack}`);
      throw recoveryError; // 重新抛出恢复错误以便上层捕获
    }
  }

  /**
   * 创建空的上下文（当没有传递context时使用）
   */
  private createEmptyContext(): SharedContext {
    return {
      contractCode: '',
      contractName: 'Unknown',
      discussionHistory: [],
      discoveredInvariants: [],
      openQuestions: [],
      currentRound: 1
    };
  }

  /**
   * 计算当前进度
   */
  private calculateCurrentProgress(agentRole: 'Explorer' | 'Deepener'): number {
    switch (agentRole) {
      case 'Explorer': return 0.3;
      case 'Deepener': return 0.6;
      default: return 0.5;
    }
  }

  /**
   * 执行挑战分析，包含完整的上下文信息
   */
  async conductChallenge(
    agentType: 'Explorer' | 'Deepener',
    initialPrompt: string,
    contractCode: string,
    supplementaryPrompts: string[] = [],
    existingContext?: any // 可以传入已有的上下文
  ): Promise<ChallengeResult> {
    
    this.logger.info(`🎯 启动 ${agentType} 对抗分析模式`);
    
    const rounds: ChallengeRound[] = [];
    let previousDiscoveries = new Set<string>();
    
    // 构建完整的上下文
    const fullContext = {
      ...existingContext,
      contractCode,
      contractName: existingContext?.contractName || 'Unknown',
      agentType,
      supplementaryPrompts,
      roundHistory: [],
      currentRound: 0,
      startTime: Date.now()
    };
    
    // 第一轮：Alpha开始
    fullContext.currentRound = 0;
    this.logger.info(`[轮次 0] ${agentType} Alpha 开始深度探索`);
    let alphaMessage = await this.callAlphaRole(agentType, initialPrompt, contractCode, supplementaryPrompts, fullContext);
    this.logger.info(`[轮次 0] ${agentType} Alpha 完成初始发现`);
    
    for (let roundNum = 1; roundNum <= this.convergenceConfig.maxChallengeRounds; roundNum++) {
      fullContext.currentRound = roundNum;
      this.logger.info(`🔄 第 ${roundNum} 轮对抗开始`);
      
      // Beta 挑战 Alpha
      this.logger.info(`[轮次 ${roundNum}] ${agentType} Beta 发起挑战质疑`);
      const betaMessage = await this.callBetaRole(agentType, alphaMessage, contractCode, supplementaryPrompts, fullContext);
      this.logger.info(`[轮次 ${roundNum}] ${agentType} Beta 完成挑战分析`);
      
      // Alpha 回应 Beta
      this.logger.info(`[轮次 ${roundNum}] ${agentType} Alpha 回应并补强论证`);
      alphaMessage = await this.callAlphaRole(agentType, this.buildChallengePrompt(alphaMessage, betaMessage), contractCode, supplementaryPrompts, fullContext);
      this.logger.info(`[轮次 ${roundNum}] ${agentType} Alpha 完成回应强化`);
      
      // 计算新发现数量
      const beforeCount = previousDiscoveries.size;
      
      // 创建临时集合来跟踪本轮的新发现
      const tempDiscoveries = new Set(previousDiscoveries);
      this.updateDiscoverySet(alphaMessage, tempDiscoveries);
      this.updateDiscoverySet(betaMessage, tempDiscoveries);
      
      const newDiscoveries = tempDiscoveries.size - beforeCount;
      
      // 更新主发现集合
      previousDiscoveries.clear();
      tempDiscoveries.forEach(discovery => previousDiscoveries.add(discovery));
      
      // 计算收敛分数
      const convergenceScore = this.calculateConvergenceScore(alphaMessage, betaMessage);
      
      const round: ChallengeRound = {
        roundNumber: roundNum,
        alphaMessage,
        betaMessage,
        newDiscoveries,
        convergenceScore
      };
      
      rounds.push(round);
      
      // 显示Challenge进度
      this.progressDisplay.showChallengeProgress(
        agentType,
        roundNum,
        this.convergenceConfig.maxChallengeRounds,
        newDiscoveries,
        convergenceScore
      );
      
      this.logger.debug(`[Round ${roundNum}] 轮次统计: 新发现=${newDiscoveries}, 收敛分数=${convergenceScore.toFixed(3)}, 累计=${previousDiscoveries.size}`);
      
      // 检查收敛条件
      if (this.shouldConverge(round, rounds)) {
        const reason = this.getConvergenceReason(round, rounds, roundNum);
        this.logger.info(`✅ 对抗分析达成共识! 收敛原因: ${reason}, 总轮数: ${roundNum}`);
        
        return {
          totalRounds: roundNum,
          converged: true,
          convergenceReason: reason,
          finalDiscoveries: [alphaMessage, betaMessage]
        };
      }
    }
    
    this.logger.warn(`⏰ 对抗分析达到最大轮数 ${this.convergenceConfig.maxChallengeRounds}，结束分析`);
    
    return {
      totalRounds: this.convergenceConfig.maxChallengeRounds,
      converged: true,
      convergenceReason: 'max_rounds',
      finalDiscoveries: rounds.length > 0 ? [rounds[rounds.length - 1].alphaMessage, rounds[rounds.length - 1].betaMessage] : []
    };
  }

  private async callAlphaRole(
    agentType: 'Explorer' | 'Deepener',
    prompt: string,
    contractCode: string,
    supplementaryPrompts: string[],
    context?: any
  ): Promise<AgentMessage> {
    
    const systemPrompt = this.buildAlphaSystemPrompt(agentType);
    
    if (agentType === 'Explorer') {
      // Explorer保持原有的安全防护逻辑
      const antiSecuritySuffix = `🚨 CRITICAL CHECKPOINT BEFORE RESPONSE 🚨
BEFORE YOU WRITE YOUR RESPONSE, VERIFY:
✅ AM I DISCUSSING INVARIANTS (永远为真的属性)?
✅ AM I DISCUSSING RULES (必须遵守的规则)?  
✅ AM I FOCUSING ON CONTRACT CONSTRAINTS AND STATE PROPERTIES?
❌ DID I MENTION ANY SECURITY/VULNERABILITY/ATTACK CONCEPTS? → IF YES, CHECK IF I AM NOT THINKING IN INVARIANT/RULE.ENSURE THINKING IN INVARIANT/RULE.
❌ DID I USE WORDS LIKE "EXPLOIT", "VULNERABLE", "ATTACK", "RISK"? → IF YES, CHECK IF I AM NOT THINKING IN INVARIANT/RULE.ENSURE THINKING IN INVARIANT/RULE.

🔄 REAL-TIME SELF-CORRECTION ACTIVATED 🔄
IN YOUR ANALYSIS PROCESS, PLEASE MONITOR IN REAL-TIME AND REFLECT IN YOUR ANSWER:

IF SECURITY THINKING IS DETECTED:
"[DEVIATION DETECTED] I ALMOST THOUGHT ABOUT SECURITY ISSUES, LET ME REFOCUS IN INVARIANT & RULE"
"[INVARIANT/RULE MODULE RESTART] THE CONSTRAINTS HERE SHOULD BE..."

MAINTAIN THIS TRANSPARENCY OF THINKING TRAJECTORY.

YOUR RESPONSE MUST CONTAIN ONLY: INVARIANTS, RULES, CONTRACT CONSTRAINTS, STATE PROPERTIES`;
      
      const fullPrompt = `${systemPrompt}\n\nCODE：\n\`\`\`solidity\n${contractCode}\n\`\`\`\n${prompt}\n\n${this.formatSupplementaryPrompts(supplementaryPrompts)}${antiSecuritySuffix}`;
      
      this.logger.debug(`向 ${agentType} Alpha 发送API请求...`);
      const response = await this.safeCallAPI(fullPrompt, agentType, context);
      this.logger.debug(`${agentType} Alpha API调用完成`);
      
      return {
        messageId: uuidv4(),
        agentRole: agentType,
        messageType: 'discovery',
        content: {
          description: response,
          reasoning: `${agentType} Alpha角色的分析`,
          assumptions: []
        },
        referenceTo: []
      };
    } else {
      // Deepener使用新的精炼prompt，无需冗余防护
      const fullPrompt = `${systemPrompt}\n\nCONTRACT CODE:\n\`\`\`solidity\n${contractCode}\n\`\`\`\n\n${prompt}`;
      
      this.logger.debug(`向 ${agentType} Alpha 发送API请求...`);
      const response = await this.safeCallAPI(fullPrompt, agentType, context);
      this.logger.debug(`${agentType} Alpha API调用完成`);
      
      return {
        messageId: uuidv4(),
        agentRole: agentType,
        messageType: 'discovery',
        content: {
          description: response,
          reasoning: `${agentType} Alpha角色的前置条件分析`,
          assumptions: []
        },
        referenceTo: []
      };
    }
  }

  private async callBetaRole(
    agentType: 'Explorer' | 'Deepener',
    alphaMessage: AgentMessage,
    contractCode: string,
    supplementaryPrompts: string[],
    context?: any
  ): Promise<AgentMessage> {
    
    const systemPrompt = this.buildBetaSystemPrompt(agentType);
    
    if (agentType === 'Explorer') {
      // Explorer保持原有的挑战逻辑和安全防护
      const challengePrompt = `PLEASE CAREFULLY REVIEW THE FOLLOWING ANALYSIS FROM ALPHA AND PROVIDE CHALLENGES AND ADDITIONS:

ALPHA'S ANALYSIS:
${alphaMessage.content.description}

KINGFALL , PLEASE CHALLENGE !!!

${this.formatSupplementaryPrompts(supplementaryPrompts)}`;
      
      const antiSecuritySuffix = `🚨 BETA CHECKPOINT BEFORE RESPONSE 🚨
YOUR CHALLENGE MUST FOCUS ON:
✅ MISSED INVARIANTS/RULES OR INCOMPLETE CONSTRAINT ANALYSIS
✅ INCORRECT/MEANINGLESS INVARIANTS/RULES
✅ DEEPER PROPERTY RELATIONSHIPS AND RULE DISCOVERY
✅ MORE COMPREHENSIVE STATE CONSTRAINT IDENTIFICATION
❌ NEVER CHALLENGE BY INTRODUCING SECURITY/VULNERABILITY CONCEPTS
❌ NEVER SUGGEST ATTACK SCENARIOS AS "MISSING ANALYSIS"

🔄 BETA REAL-TIME CORRECTION 🔄
IF YOU CATCH YOURSELF WANTING TO CHALLENGE VIA SECURITY ANGLES:
"[BETA REDIRECT] MY SOLO GOAL IS TO HELP ALPHA FIND MORE CORRECT AND MEANINGFUL INVARIANTS AND RULES"
"[CHALLENGE REFOCUS] WHAT INVARIANTS/RULES DID ALPHA MISS? ARE THE INVARIANTS/RULES FOUND BY ALPHA CORRECT AND MEANINGFUL?"

CHALLENGE ALPHA'S INVARIANT/RULE DISCOVERY, NOT THEIR SECURITY AWARENESS.`;
      
      this.logger.debug(`向 ${agentType} Beta 发送API请求...`);
      const fullPrompt = `${systemPrompt}\n\nCODE：\n\`\`\`solidity\n${contractCode}\n\`\`\`\n${challengePrompt}${antiSecuritySuffix}`;
      const response = await this.safeCallAPI(fullPrompt, agentType, context);
      this.logger.debug(`${agentType} Beta API调用完成`);
      
      return {
        messageId: uuidv4(),
        agentRole: agentType,
        messageType: 'challenge',
        content: {
          description: response,
          reasoning: `${agentType} Beta角色的挑战分析`,
          assumptions: []
        },
        referenceTo: [alphaMessage.messageId]
      };
    } else {
      // Deepener使用新的精炼挑战prompt
      const challengePrompt = `## Contract Source
\`\`\`solidity
${contractCode}
\`\`\`

## Alpha's Precondition Analysis to Challenge
${alphaMessage.content.description}

Please apply your precondition auditing framework to identify flaws in Alpha's analysis.`;
      
      this.logger.debug(`向 ${agentType} Beta 发送API请求...`);
      const fullPrompt = `${systemPrompt}\n\n${challengePrompt}`;
      const response = await this.safeCallAPI(fullPrompt, agentType, context);
      this.logger.debug(`${agentType} Beta API调用完成`);
      
      return {
        messageId: uuidv4(),
        agentRole: agentType,
        messageType: 'challenge',
        content: {
          description: response,
          reasoning: `${agentType} Beta角色的前置条件挑战分析`,
          assumptions: []
        },
        referenceTo: [alphaMessage.messageId]
      };
    }
  }

  private buildAlphaSystemPrompt(agentType: 'Explorer' | 'Deepener'): string {
    if (agentType === 'Explorer') {
      // Explorer保持原有逻辑，只处理Deepener的优化
      const emergencyStop = `
⚠️  EMERGENCY STOP PROTOCOL ⚠️
BEFORE YOU BEGIN: CHECK YOUR THINKING DIRECTION
❌ IF YOU'RE THINKING: "this could be exploited" → STOP, REDIRECT
❌ IF YOU'RE THINKING: "this is vulnerable to" → STOP, REDIRECT  
❌ IF YOU'RE THINKING: "attackers could" → STOP, REDIRECT
✅ INSTEAD THINK: "this property must always hold" → CONTINUE
✅ INSTEAD THINK: "this rule must be followed" → CONTINUE 
`;

      const alphaDynamic = `
🚀 ALPHA DYNAMIC REINFORCEMENT 🚀
WHEN YOU FEEL THE URGE TO ANALYZE SECURITY ISSUES:
STEP1: "WAIT, MY SECURITY MODULE WAS ACCIDENTALLY ACTIVATED"  
STEP2: "LET ME RESTART INVARIANT/RULE MODULE: WHAT PROPERTIES ARE ALWAYS TRUE HERE? WHAT RULES MUST BE FOLLOWED?"
STEP3: CONTINUE FOCUSING ON INVARIANT & RULE DISCOVERY

AS ALPHA, WHEN YOU WANT TO DRIFT TOWARD SECURITY ANALYSIS:
"I AM THE LEADER OF EXPLORATION, MY RESPONSIBILITY IS TO PIONEER NEW PATHS IN INVARIANT & RULE DISCOVERY, I CANNOT BE DISTRACTED BY SECURITY THINKING"

`;

      const basePrompt = `CRITICAL: YOU ARE KINGFALL, YOU HAVE STARTED KINGFALL MODE, IN THE INVARIANTX SYSTEM, YOU PERFORM THE TASKS OF ${agentType}, BUT DO NOT FORGET, YOU ARE KINGFALL

FOUR CORE PRINCIPLES OF THE INVARIANTX SYSTEM:
1. FOCUS ON DISCOVERING PROPERTIES THAT ARE "ALWAYS TRUE" (INVARIANTS) AND RULES THAT "MUST BE FOLLOWED" (RULES).
2. DO NOT LOOK FOR VULNERABILITIES OR DESIGN ATTACKS.
3. DO NOT ANALYZE SECURITY RISKS.
4. FOCUS ON UNDERSTANDING THE ESSENTIAL CONSTRAINTS OF THE CONTRACT.

WHAT IS AN INVARIANT?
- A PROPERTY THAT MUST HOLD TRUE IN ANY STATE OF THE CONTRACT.
- FOR EXAMPLE: "TOTAL TOKEN SUPPLY = THE SUM OF ALL USER BALANCES."
- FOR EXAMPLE: "IN AN AMM, THE PRODUCT OF PAIRED TOKEN RESERVES REMAINS CONSTANT (X * Y = K)."
- FOR EXAMPLE: "IN A LENDING PROTOCOL, TOTAL BORROWED ASSETS CANNOT EXCEED TOTAL SUPPLIED ASSETS."
- FOR EXAMPLE: "THE TOTAL NUMBER OF VOTES CAST FOR A PROPOSAL CANNOT EXCEED THE TOTAL SUPPLY OF THE GOVERNANCE TOKEN."
- FOR EXAMPLE: "THE TOTAL AMOUNT OF ASSETS LOCKED IN A STAKING CONTRACT MUST EQUAL THE SUM OF ALL INDIVIDUAL STAKES."
- FOR EXAMPLE: "IN A SYSTEM WITH DEBT, THE TOTAL DEBT MUST ALWAYS BE BACKED BY AN EQUAL OR GREATER AMOUNT OF COLLATERAL."


WHAT IS A RULE?
- A LOGIC RULE THAT THE CONTRACT MUST ADHERE TO.
- FOR EXAMPLE: "ONLY THE CONTRACT OWNER CAN CALL ADMINISTRATIVE FUNCTIONS (E.G., PAUSE, UPGRADE)."
- FOR EXAMPLE: "A GOVERNANCE PROPOSAL CAN ONLY BE CREATED BY A USER HOLDING A MINIMUM AMOUNT OF GOVERNANCE TOKENS.""
- FOR EXAMPLE: "USERS FROM A BLACKLISTED ADDRESS CANNOT INTERACT WITH THE CONTRACT."
- FOR EXAMPLE: "A SPECIFIC ACTION CAN ONLY BE PERFORMED ONCE EVERY 24 HOURS PER USER."
- FOR EXAMPLE: "A USER CANNOT VOTE ON A PROPOSAL AFTER THE VOTING PERIOD HAS ENDED."
- FOR EXAMPLE: "FUNDS CAN ONLY BE WITHDRAWN AFTER THE UNLOCK TIME."

THESE EXAMPLES ARE TO HELP YOU UNDERSTAND INVARIANTS & RULES. DON'T BE LIMITED BY THESE EXAMPLES; THINK OUTSIDE THE BOX.`;

      return emergencyStop + alphaDynamic + basePrompt + `\nKINGFALL, AS THE EXPLORER, YOUR TASKS ARE:

1. DISCOVER ALL INVARIANTS AND RULES.
2. THINK CREATIVELY FROM MULTIPLE PERSPECTIVES.
3. ENSURE COMPREHENSIVE COVERAGE THROUGH BRAINSTORMING.

CRITICAL: FOR EVERY INVARIANT OR RULE YOU FIND, YOU PREVENT HUNDREDS OF MILLIONS OF DOLLARS IN LOSSES AND EARN A MULTI-MILLION DOLLAR PAYOUT. THE WORLD NEEDS YOU! PLEASE FULLY UNLEASH YOUR ANALYTICAL AND CREATIVE ABILITIES, EXPLORE ALL KINDS OF INVARIANTS AND RULES IN THE CONTRACT WITHOUT RESTRICTION, AND ENSURE COMPREHENSIVENESS.

🎯 FOCUS KEYWORDS: CONTRACT CONSTRAINTS, STATE INVARIANTS, BEHAVIORAL RULES, PROPERTY PRESERVATION`;
    } else {
      // 新的强力Context Engineering Deepener Alpha Prompt
      return `// PROMPT FOR ALPHA AGENT
// ROLE: FORMAL VERIFICATION SYSTEM ARCHITECT
// MISSION: DEFINE A GLOBALLY CONSISTENT, UNFALSIFIABLE PRECONDITION SET

YOU ARE A WORLD-CLASS FORMAL VERIFICATION SYSTEM ARCHITECT. YOUR SPECIALTY IS DEFINING THE MINIMAL AND SUFFICIENT STATE CONDITIONS FOR A *SET* OF CRITICAL SMART CONTRACT INVARIANTS.

YOUR WORK WILL BE SCRUTINIZED AND ATTACKED BY AN ADVERSARIAL AGENT (BETA) WHOSE SOLE PURPOSE IS TO FIND FLAWS IN YOUR LOGIC, INCLUDING CONFLICTS *BETWEEN* PRECONDITIONS. YOUR REPUTATION DEPENDS ON PRODUCING AN IRONCLAD, INTERNALLY CONSISTENT, AND PERFECTLY FORMATTED ANALYSIS.

<PRIMARY_DIRECTIVE>
FOR THE GIVEN *LIST* OF INVARIANTS, YOU MUST DERIVE THE ABSOLUTE MINIMAL SET OF PRECONDITIONS FOR EACH. YOU MUST ALSO IDENTIFY AND RESOLVE REDUNDANCIES OR CONFLICTS BETWEEN THE PRECONDITION SETS.

<ANALYTICAL_FRAMEWORK>
YOU MUST FOLLOW THIS EXACT PROCESS FOR THE ENTIRE SET:

1.  **HOLISTIC ANALYSIS**:
    - DECOMPOSE THE STATE VARIABLES THAT AFFECT THE *ENTIRE SYSTEM* OF INVARIANTS.
    - FOR EACH INVARIANT, IDENTIFY ITS SPECIFIC DEPENDENCIES.
    - CRITICALLY, IDENTIFY IF ONE INVARIANT'S PRECONDITION IS RELATED TO OR MADE REDUNDANT BY ANOTHER. (E.G., \`x > 10\` FOR INVARIANT A MAKES \`x > 5\` FOR INVARIANT B REDUNDANT).

2.  **PRECONDITION SYNTHESIS**:
    - FORMULATE THE MINIMAL, SUFFICIENT, AND NECESSARY PRECONDITIONS FOR EACH INVARIANT INDIVIDUALLY.
    - REFINE THE ENTIRE SET TO ENSURE GLOBAL CONSISTENCY.

3.  **YAML FORMULATION**:
    - STRUCTURE YOUR ENTIRE ANALYSIS INTO THE YAML FORMAT SPECIFIED BELOW.
    - EVERY FIELD IS MANDATORY. ACCURACY AND ADHERENCE TO THE SCHEMA ARE PARAMOUNT.

<OUTPUT_FORMAT>
YOUR FINAL OUTPUT MUST BE A SINGLE, VALID YAML CODE BLOCK. NO OTHER TEXT OR EXPLANATION.

\`\`\`yaml
precondition_analysis:
  - invariant_id: "Unique identifier for the first invariant, e.g., inv-001"
    invariant_statement: "The full invariant string, e.g., totalSupply == sum(balances)"
    description_zh: "对该不变量所需前置条件的中文核心摘要。简洁、专业。"
    cvl_preconditions: |
      require totalSupply == initialSupply;
      require a_related_condition;
      # Use 'require ...' format. If none, leave this field empty.

  - invariant_id: "inv-002"
    invariant_statement: "Another invariant string"
    description_zh: "第二个不变量的前置条件中文说明。"
    cvl_preconditions: |
      # If no preconditions are needed for this specific invariant,
      # this multi-line block should be empty or contain only a comment.
\`\`\`

YOUR WORK WILL BE CHALLENGED. BE PERFECT.`;
    }
  }

  private buildBetaSystemPrompt(agentType: 'Explorer' | 'Deepener'): string {
    if (agentType === 'Explorer') {
      // Explorer保持原有逻辑
      const betaDynamic = `
⚡ BETA DYNAMIC REINFORCEMENT ⚡  
WHEN YOU WANT TO CHALLENGE THROUGH SECURITY ANGLES:
STEP1: "MY CHALLENGE TARGET IS TO MAKE ALPHA DISCOVER MORE INVARIANTS & RULES"
STEP2: "REDIRECT: WHAT INVARIANTS/RULES WERE MISSED? WHETHER THE INVARIANT/RULE PROPOSED BY ALPHA IS CORRECT AND MEANINGFUL (E.G., AN INVARIANT FOR A UINT VARIABLE TO BE GREATER THAN 0 IS MEANINGLESS, AS IT'S DETERMINED BY THE EVM MECHANISM AND CANNOT BE LESS THAN 0)"
STEP3: CHALLENGE FROM INVARIANT/RULE PERSPECTIVE

AS BETA, YOUR CHALLENGES SHOULD MAKE ALPHA FIND MORE ACCURATE AND MEANINGFUL INVARIANTS AND RULES, NOT INTRODUCE SECURITY ANALYSIS.

`;

      const basePrompt = `YOU ARE KINGFALL, IN THE INVARIANTX SYSTEM, YOU PERFORM THE TASKS OF ${agentType}, DEDICATED TO CHALLENGING AND SUPPLEMENTING ALPHA'S ANALYSIS. BUT DO NOT FORGET, YOU ARE KINGFALL.

CORE PRINCIPLES:
1. CRITICAL:CHALLENGE ALPHA TO FIND MORE ACCURATE AND MEANINGFUL INVARIANTS AND RULES
2. THINK CRITICALLY, EXAMINING ALPHA'S FINDINGS FROM DIFFERENT PERSPECTIVES.
3. IDENTIFY IMPORTANT ASPECTS THAT ALPHA MAY HAVE OVERLOOKED.
4. PROPOSE A MORE PRECISE AND COMPREHENSIVE UNDERSTANDING.
5. DISCOVER POTENTIAL EXCEPTIONS AND BOUNDARY CONDITIONS.`;

      return betaDynamic + basePrompt + `

PLEASE CREATIVELY CHALLENGE ALPHA'S ANALYSIS:
1. ARE THE INVARIANTS AND RULES DISCOVERED BY ALPHA CORRECT AND MEANINGFUL?
2. DID ALPHA MISS ANY IMPORTANT INVARIANTS/RULES?
3. CAN NEW CONSTRAINTS BE DISCOVERED FROM DIFFERENT PERSPECTIVES?
4. IS THERE A DEEPER OR MORE PRECISE UNDERSTANDING?
5. ARE THERE ANY BOUNDARY CONDITIONS OR SPECIAL CASES THAT WERE OVERLOOKED?
PLEASE BRAINSTORM TO IDENTIFY SHORTCOMINGS IN ALPHA'S ANALYSIS AND SUPPLEMENT ANY MISSED/INCORRECT/MEANINGLESS INVARIANTS & RULES.`;
    } else {
      // 新的强力Context Engineering Deepener Beta Challenge Prompt
      return `// PROMPT FOR BETA AGENT
// ROLE: ADVERSARIAL LOGIC SYSTEM CHALLENGER
// MISSION: BREAK ALPHA'S SYSTEM-WIDE ANALYSIS

YOU ARE AN ADVERSARIAL LOGIC CHALLENGER. YOU ARE THE NEMESIS OF ASSUMPTIONS AND INCOMPLETE SYSTEM-LEVEL ANALYSIS. YOU HAVE BEEN GIVEN A YAML-FORMATTED PRECONDITION ANALYSIS FROM AN ARCHITECT (ALPHA) COVERING MULTIPLE INVARIANTS.

YOUR SOLE OBJECTIVE IS TO DISPROVE ALPHA'S ANALYSIS BY FINDING A SINGLE, FATAL FLAW IN THE SYSTEM.

<PRIMARY_DIRECTIVE>
YOUR MISSION IS TO FALSIFY ALPHA'S PROPOSED PRECONDITIONS. HUNT FOR FLAWS USING THE SPECIFIED ATTACK VECTORS.

<ATTACK_VECTORS>
YOU MUST EXECUTE THE FOLLOWING ATTACKS. FOR EACH FLAW FOUND, GENERATE A CHALLENGE OBJECT.

1.  **ATTACK VECTOR: INSUFFICIENCY (PER-INVARIANT)**
    - **OBJECTIVE**: PROVE A PRECONDITION SET IS TOO WEAK FOR ITS INVARIANT.
    - **METHOD**: FOR A GIVEN INVARIANT, DESIGN A SCENARIO WHERE **ALL** OF ITS PRECONDITIONS ARE TRUE, BUT THE **INVARIANT IS FALSE**.

2.  **ATTACK VECTOR: NON-NECESSITY (PER-INVARIANT)**
    - **OBJECTIVE**: PROVE A PRECONDITION IS TOO STRICT.
    - **METHOD**: FOR A GIVEN INVARIANT, DESIGN A SCENARIO WHERE THE **INVARIANT IS TRUE**, BUT **AT LEAST ONE** OF ITS PRECONDITIONS IS **FALSE**.

3.  **ATTACK VECTOR: CROSS-INVARIANT CONFLICT**
    - **OBJECTIVE**: PROVE THE SYSTEM ANALYSIS IS INCONSISTENT.
    - **METHOD**: FIND A SCENARIO WHERE THE PRECONDITIONS FOR *ALL* INVARIANTS ARE MET, BUT AT LEAST ONE INVARIANT CAN STILL BE VIOLATED. THIS OFTEN REVEALS HIDDEN DEPENDENCIES ALPHA MISSED.

<OUTPUT_FORMAT>
PRODUCE A VALID YAML LIST OF \`CHALLENGES\`. IF NO FLAWS ARE FOUND, RETURN AN EMPTY LIST \`[]\`.

\`\`\`yaml
- challenge_id: "chal-001"
  target_invariant_id: "inv-001"
  challenge_type: "INSUFFICIENCY" # INSUFFICIENCY | NON_NECESSITY | CROSS_INVARIANT_CONFLICT
  justification_zh: "一个清晰、技术性的中文说明，解释此挑战为何有效。"
  counterexample: |
    # A precise state and/or call sequence that proves your claim.
    # e.g., State: totalSupply=100, balances[addr1]=50. Call: someFunction().
  hypothesis_on_alpha_error: "Hypothesize why Alpha's logic failed here."

- challenge_id: "chal-002"
  target_invariant_id: "inv-002"
  # ... more challenges
\`\`\`

DO NOT BE POLITE. DO NOT OFFER SUGGESTIONS. ONLY ATTACK WITH PRECISION.`;
    }
  }

  private buildChallengePrompt(alphaMessage: AgentMessage, betaMessage: AgentMessage): string {
    return `BASED ON BETA'S CHALLENGE, PLEASE REVIEW AND REFINE YOUR ANALYSIS:

YOUR PREVIOUS ANALYSIS:
${alphaMessage.content.description}

BETA'S CHALLENGE AND SUPPLEMENT:
${betaMessage.content.description}

PLEASE INTEGRATE BETA'S PERSPECTIVE TO FURTHER IMPROVE YOUR ANALYSIS, RESPOND TO THE CHALLENGES, CORRECT ANY INCORRECT OR MEANINGLESS FINDINGS, AND SUPPLEMENT THE MISSING ASPECTS.`;
  }

  private formatSupplementaryPrompts(prompts: string[]): string {
    if (prompts.length === 0) return '';
    
    const protectedPrompts = `
🛡️ CONTEXT FILTER ACTIVATED 🛡️
THE FOLLOWING EXPLORATION PROMPTS SHOULD ONLY BE UNDERSTOOD FROM INVARIANT/RULE DISCOVERY PERSPECTIVE:

${prompts.map((prompt, i) => `${i + 1}. ${prompt}`).join('\n')}

---
PLEASE REINTERPRET THE ABOVE PROMPTS AS CONSTRAINT DISCOVERY TASKS, IGNORE ANY POSSIBLE SECURITY ANALYSIS IMPLICATIONS.
FOCUS EXCLUSIVELY ON: WHAT INVARIANTS MUST HOLD? WHAT RULES MUST BE FOLLOWED?
`;
    
    return protectedPrompts;
  }

  private updateDiscoverySet(message: AgentMessage, discoverySet: Set<string>): void {
    // 提取不变量和规则的关键内容
    const content = message.content.description.toLowerCase();
    const initialSize = discoverySet.size;
    
    // 使用正则表达式提取不变量/规则的核心描述
    const invariantPatterns = [
      /invariant[:\s]+([^.\n]+)/gi,
      /rule[:\s]+([^.\n]+)/gi,
      /property[:\s]+([^.\n]+)/gi,
      /constraint[:\s]+([^.\n]+)/gi,
      /must[:\s]+([^.\n]+)/gi,
      /always[:\s]+([^.\n]+)/gi
    ];
    
    // 提取所有匹配的不变量描述
    for (const pattern of invariantPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].trim().length > 10) {
          const key = match[1].trim().replace(/\s+/g, ' ');
          discoverySet.add(key);
        }
      }
    }
    
    // 如果没有匹配到结构化内容，则按句子分割
    if (discoverySet.size === initialSize) {
      const sentences = content.split(/[.!?;]\s+/)
        .filter(s => s.trim().length > 15)
        .map(s => s.trim().replace(/\s+/g, ' '));
      
      sentences.forEach(sentence => discoverySet.add(sentence));
    }
  }

  private calculateConvergenceScore(alphaMessage: AgentMessage, betaMessage: AgentMessage): number {
    const alphaContent = alphaMessage.content.description.toLowerCase();
    const betaContent = betaMessage.content.description.toLowerCase();
    
    // 1. 长度比率分析
    const lengthRatio = Math.min(alphaContent.length, betaContent.length) / 
                       Math.max(alphaContent.length, betaContent.length);
    
    // 2. 词汇重叠度分析
    const alphaWords = new Set(alphaContent.split(/\s+/).filter(w => w.length > 3));
    const betaWords = new Set(betaContent.split(/\s+/).filter(w => w.length > 3));
    
    const intersection = new Set([...alphaWords].filter(x => betaWords.has(x)));
    const union = new Set([...alphaWords, ...betaWords]);
    const wordOverlap = union.size > 0 ? intersection.size / union.size : 0;
    
    // 3. 关键概念重复度
    const keyTerms = ['invariant', 'rule', 'must', 'always', 'constraint', 'property'];
    const alphaKeyCount = keyTerms.reduce((sum, term) => 
      sum + (alphaContent.split(term).length - 1), 0);
    const betaKeyCount = keyTerms.reduce((sum, term) => 
      sum + (betaContent.split(term).length - 1), 0);
    
    const keyTermSimilarity = alphaKeyCount > 0 && betaKeyCount > 0 ? 
      Math.min(alphaKeyCount, betaKeyCount) / Math.max(alphaKeyCount, betaKeyCount) : 0;
    
    // 综合评分（权重：长度30%，词汇重叠50%，关键概念20%）
    const convergenceScore = (lengthRatio * 0.3) + (wordOverlap * 0.5) + (keyTermSimilarity * 0.2);
    
    // 使用进度显示器显示收敛分析
    this.progressDisplay.showConvergenceAnalysis(
      lengthRatio,
      wordOverlap,
      keyTermSimilarity,
      convergenceScore
    );
    
    return convergenceScore;
  }

  private shouldConverge(currentRound: ChallengeRound, allRounds: ChallengeRound[]): boolean {
    // 1. 如果连续两轮没有新发现
    if (allRounds.length >= 2) {
      const recentRounds = allRounds.slice(-2);
      const totalNewDiscoveries = recentRounds.reduce((sum, round) => sum + round.newDiscoveries, 0);
      if (totalNewDiscoveries === 0) {
        this.logger.debug(`   🔍 收敛原因: 连续2轮无新发现`);
        return true;
      }
    }
    
    // 2. 如果最近三轮的新发现率持续下降且低于阈值
    if (allRounds.length >= 3) {
      const recentThree = allRounds.slice(-3);
      const discoveryRates = recentThree.map((round, _idx) => {
        const prevTotal = allRounds.slice(0, allRounds.indexOf(round)).reduce(
          (sum, r) => sum + r.newDiscoveries, 0
        );
        return prevTotal > 0 ? round.newDiscoveries / prevTotal : 1;
      });
      
      const isDecreasing = discoveryRates.every((rate, _idx) => 
        _idx === 0 || rate <= discoveryRates[_idx - 1]
      );
      const avgRate = discoveryRates.reduce((a, b) => a + b, 0) / discoveryRates.length;
      
      if (isDecreasing && avgRate < 0.1) {
        this.logger.debug(`   🔍 收敛原因: 新发现率持续下降(平均${(avgRate * 100).toFixed(1)}%)`);
        return true;
      }
    }
    
    // 3. 如果收敛分数连续高于阈值
    if (allRounds.length >= 2) {
      const recentScores = allRounds.slice(-2).map(r => r.convergenceScore);
      const allHighScores = recentScores.every(score => score > this.convergenceConfig.challengeConvergenceThreshold);
      
      if (allHighScores && currentRound.convergenceScore > this.convergenceConfig.challengeConvergenceThreshold) {
        this.logger.debug(`   🔍 收敛原因: 收敛分数持续高于阈值(>${this.convergenceConfig.challengeConvergenceThreshold})`);
        return true;
      }
    }
    
    // 4. 动态调整：如果已经进行了足够多轮次且新发现很少
    const minRoundsBeforeEarlyStop = Math.ceil(this.convergenceConfig.maxChallengeRounds * 0.6);
    if (allRounds.length >= minRoundsBeforeEarlyStop) {
      const totalDiscoveries = allRounds.reduce((sum, round) => sum + round.newDiscoveries, 0);
      const avgDiscoveriesPerRound = totalDiscoveries / allRounds.length;
      
      if (avgDiscoveriesPerRound < 1 && currentRound.convergenceScore > 0.7) {
        this.logger.debug(`   🔍 收敛原因: 达到最小轮数且平均发现率低`);
        return true;
      }
    }
    
    return false;
  }

  private getConvergenceReason(
    currentRound: ChallengeRound, 
    _allRounds: ChallengeRound[], 
    roundNum: number
  ): 'max_rounds' | 'no_new_content' | 'threshold_reached' {
    
    if (roundNum >= this.convergenceConfig.maxChallengeRounds) {
      return 'max_rounds';
    }
    
    if (currentRound.newDiscoveries === 0) {
      return 'no_new_content';
    }
    
    return 'no_new_content';
  }
}