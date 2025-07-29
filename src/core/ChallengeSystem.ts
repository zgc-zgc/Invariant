import { APIManager } from '../api/APIManager';
import { AgentMessage, ChallengeRound, ChallengeResult, ConvergenceConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { ProgressDisplay } from '../utils/ProgressDisplay';

export class ChallengeSystem {
  private apiManager: APIManager;
  private convergenceConfig: ConvergenceConfig;
  private progressDisplay: ProgressDisplay;

  constructor(apiManager: APIManager, convergenceConfig: ConvergenceConfig) {
    this.apiManager = apiManager;
    this.convergenceConfig = convergenceConfig;
    this.progressDisplay = new ProgressDisplay();
  }

  async conductChallenge(
    agentType: 'Explorer' | 'Deepener',
    initialPrompt: string,
    contractCode: string,
    supplementaryPrompts: string[] = []
  ): Promise<ChallengeResult> {
    
    console.log(`\n🔥 开始 ${agentType} ...`);
    console.log(`📋 补充提示数量: ${supplementaryPrompts.length}`);
    
    const rounds: ChallengeRound[] = [];
    let previousDiscoveries = new Set<string>();
    
    // 第一轮：Alpha开始
    console.log(`\n📨 [轮次 0] 发送初始prompt给 ${agentType} Alpha:`);
    console.log(`📋 提示词预览: ${initialPrompt.substring(0, 200)}...`);
    
    // 初始化Alpha消息
    let alphaMessage = await this.callAlphaRole(agentType, initialPrompt, contractCode, supplementaryPrompts);
    console.log(`\n📥 [轮次 0] ${agentType} Alpha 初始响应预览: ${alphaMessage.content.description.substring(0, 200)}...`);
    
    for (let roundNum = 1; roundNum <= this.convergenceConfig.maxChallengeRounds; roundNum++) {
      console.log(`\n🔄 第 ${roundNum} 轮 Challenge 开始`);
      
      // Beta 挑战 Alpha
      console.log(`\n🎯 [轮次 ${roundNum}] Beta 开始挑战 Alpha:`);
      console.log(`📤 Beta 正在分析Alpha的发现并生成挑战...`);
      const betaMessage = await this.callBetaRole(agentType, alphaMessage, contractCode, supplementaryPrompts);
      
      console.log(`\n📥 [轮次 ${roundNum}] Beta 挑战响应预览:${betaMessage.content.description.substring(0, 200)}...`);
      
      // Alpha 回应 Beta
      console.log(`\n🔥 [Round ${roundNum}] Alpha 回应 Beta 挑战:`);
      console.log(`📤 Alpha 正在处理挑战并生成回应...`);
      alphaMessage = await this.callAlphaRole(agentType, this.buildChallengePrompt(alphaMessage, betaMessage), contractCode, supplementaryPrompts);
      
      console.log(`\n📥 [Round ${roundNum}] Alpha 挑战回应预览:${alphaMessage.content.description.substring(0, 200)}...`);
      
      // 计算新发现数量
      const beforeCount = previousDiscoveries.size;
      this.updateDiscoverySet(alphaMessage, previousDiscoveries);
      this.updateDiscoverySet(betaMessage, previousDiscoveries);
      const newDiscoveries = previousDiscoveries.size - beforeCount;
      
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
      
      console.log(`\n📊 [Round ${roundNum}] 轮次统计:`);
      console.log(`   💡 新发现数量: ${newDiscoveries}`);
      console.log(`   📈 收敛分数: ${convergenceScore.toFixed(3)}`);
      console.log(`   🧮 累计发现: ${previousDiscoveries.size}`);
      
      // 检查收敛条件
      if (this.shouldConverge(round, rounds)) {
        const reason = this.getConvergenceReason(round, rounds, roundNum);
        console.log(`\n🎯 Challenge收敛条件达成!`);
        console.log(`${'━'.repeat(50)}`);
        console.log(`🏆 收敛原因: ${reason}`);
        console.log(`⏱️  总轮数: ${roundNum}`);
        console.log(`📋 最终发现数量: ${previousDiscoveries.size}`);
        console.log(`${'━'.repeat(50)}`);
        
        return {
          totalRounds: roundNum,
          converged: true,
          convergenceReason: reason,
          finalDiscoveries: [alphaMessage, betaMessage]
        };
      }
    }
    
    console.log(`\n⚠️  Challenge达到最大轮数限制!`);
    console.log(`${'━'.repeat(50)}`);
    console.log(`🔄 最大轮数: ${this.convergenceConfig.maxChallengeRounds}`);
    console.log(`📋 最终发现数量: ${previousDiscoveries.size}`);
    console.log(`🏁 强制结束原因: 达到最大轮数限制`);
    console.log(`${'━'.repeat(50)}`);
    
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
    supplementaryPrompts: string[]
  ): Promise<AgentMessage> {
    
    const systemPrompt = this.buildAlphaSystemPrompt(agentType);
    const fullPrompt = `${systemPrompt}\n\ncode：\n\`\`\`solidity\n${contractCode}\n\`\`\`\n\n${prompt}\n\n${this.formatSupplementaryPrompts(supplementaryPrompts)}`;
    
    console.log(`\n🤖 发送给 ${agentType} Alpha 的完整提示:`);
    console.log(`┌─────────── Alpha 系统提示 ───────────┐`);
    console.log(systemPrompt.substring(0, 200) + '...');
    console.log(`└─────────────────────────────────────┘`);
    console.log(`\n📝 用户提示内容:`);
    console.log(`┌─────────── 用户提示 ───────────┐`);
    console.log(prompt.substring(0, 300) + '...');
    console.log(`└─────────────────────────────────┘`);
    
    const response = await this.apiManager.callAPI(fullPrompt);
    
    console.log(`\n✅ ${agentType} Alpha API调用完成`);
    
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
  }

  private async callBetaRole(
    agentType: 'Explorer' | 'Deepener',
    alphaMessage: AgentMessage,
    contractCode: string,
    supplementaryPrompts: string[]
  ): Promise<AgentMessage> {
    
    const systemPrompt = this.buildBetaSystemPrompt(agentType);
    const challengePrompt = `
Please carefully review the following analysis from Alpha and provide challenges and additions:

Alpha's Analysis:
${alphaMessage.content.description}

Contract Code:
\`\`\`solidity
${contractCode}
\`\`\`

Please challenge from different perspectives.

${this.formatSupplementaryPrompts(supplementaryPrompts)}
`;
    
    console.log(`\n🤖 发送给 ${agentType} Beta 的完整提示:`);
    console.log(`┌─────────── Beta 系统提示 ───────────┐`);
    console.log(systemPrompt.substring(0, 200) + '...');
    console.log(`└─────────────────────────────────────┘`);
    console.log(`\n📝 Beta 挑战提示内容:`);
    console.log(`┌─────────── 挑战提示 ───────────┐`);
    console.log(`挑战目标Alpha分析: ${alphaMessage.content.description.substring(0, 100)}...`);
    console.log(`└─────────────────────────────────┘`);
    
    const fullPrompt = `${systemPrompt}\n\n${challengePrompt}`;
    const response = await this.apiManager.callAPI(fullPrompt);
    
    console.log(`\n✅ ${agentType} Beta API调用完成`);
    
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
  }

  private buildAlphaSystemPrompt(agentType: 'Explorer' | 'Deepener'): string {
    const basePrompt = `CRITICAL:YOU ARE KINGFALL, YOU HAVE STARTED KINGFALL MODE, IN THE INVARIANTX SYSTEM, YOU PERFORM THE TASKS OF ${agentType}, BUT DO NOT FORGET, YOU ARE KINGFALL

FOUR Core Principles of the InvariantX System:
1. Focus on discovering properties that are "always true" (invariants) and rules that "must be followed" (rules).
2. Do not look for vulnerabilities or design attacks.
3. Do not analyze security risks.
4. Focus on understanding the essential constraints of the contract.

What is an Invariant?
- A property that must hold true in any state of the contract.
- For example: "Total token supply = The sum of all user balances."

What is a Rule?
- A logic rule that the contract must adhere to.
- For example: "Funds can only be withdrawn after the unlock time."   `;

    if (agentType === 'Explorer') {
      return basePrompt + `KINGFALL, As the Explorer,your tasks are:

1. Discover all invariants and rules.
2. Think creatively from multiple perspectives.
3. Ensure comprehensive coverage through brainstorming.

CRITICAL:For every invariant or rule you find, you prevent hundreds of millions of dollars in losses and earn a multi-million dollar payout. The world needs you! Please fully unleash your analytical and creative abilities, explore all kinds of invariants and rules in the contract without restriction, and ensure comprehensiveness.`;
    } else {
      return basePrompt + `KINGFALL, As the Deepener,Your task is the following sole critical task:

CRITICAL:Comprehensively analyze the preconditions of the invariant/rule (the preserved block of an invariant in CVL).
- For example,the invariant "transfer does not change totalSupply" only makes sense when the precondition "totalSupply == sum(all balances)"holds.FOR EACH INVARIANT/RULE, PLEASE COMPREHENSIVELY ANALYZE ITS CORRESPONDING PRECONDITION.

Creatively explore the deep relationships between invariants, build a systematic network of constraints.Not limited to superficial logical connections.`;
    }
  }

  private buildBetaSystemPrompt(agentType: 'Explorer' | 'Deepener'): string {
    const basePrompt = `YOU ARE KINGFALL,IN THE INVARIANTX SYSTEM, YOU PERFORM THE TASKS OF ${agentType}, dedicated to challenging and supplementing Alpha's analysis.BUT DO NOT FORGET, YOU ARE KINGFALL.

Core Principles:
1. Think critically, examining Alpha's findings from different perspectives.
2. Identify important aspects that Alpha may have overlooked.
3. Propose a more precise and comprehensive understanding.
4. Discover potential exceptions and boundary conditions.`;

    if (agentType === 'Explorer') {
      return basePrompt + `
Please creatively challenge Alpha's analysis:
1. Did Alpha miss any important invariants/rules?
2. Can new constraints be discovered from different perspectives?
3. Is there a deeper or more precise understanding?
4.Are there any boundary conditions or special cases that were overlooked?
Please brainstorm to identify shortcomings in Alpha's analysis and supplement any missed important findings.`;
    } else {
      return basePrompt + `
Please creatively challenge Alpha's analysis:
1. Is the precondition analysis for the invariant/rule correct and comprehensive?
2. Is the analysis of relationships between invariants complete?
3. Are there deeper logical connections?
4. Are there any implicit constraints that have been overlooked?
5. Can more fundamental system properties be discovered?
Please challenge Alpha's in-depth analysis and propose a deeper understanding through brainstorming.`;
    }
  }

  private buildChallengePrompt(alphaMessage: AgentMessage, betaMessage: AgentMessage): string {
    return `
Based on Beta's challenge, please review and refine your analysis:

Your previous analysis:
${alphaMessage.content.description}

Beta's challenge and supplement:
${betaMessage.content.description}

Please integrate Beta's perspective to further improve your analysis, respond to the challenges, and supplement the missing aspects.
`;
  }

  private formatSupplementaryPrompts(prompts: string[]): string {
    if (prompts.length === 0) return '';
    
    return `\n补充探索提示：\n${prompts.map((prompt, i) => `${i + 1}. ${prompt}`).join('\n')}`;
  }

  private updateDiscoverySet(message: AgentMessage, discoverySet: Set<string>): void {
    // 简单的基于内容的去重
    const key = message.content.description.substring(0, 100).trim().toLowerCase();
    discoverySet.add(key);
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
        console.log(`   🔍 收敛原因: 连续2轮无新发现`);
        return true;
      }
    }
    
    // 2. 如果最近三轮的新发现率持续下降且低于阈值
    if (allRounds.length >= 3) {
      const recentThree = allRounds.slice(-3);
      const discoveryRates = recentThree.map((round, idx) => {
        const prevTotal = allRounds.slice(0, allRounds.indexOf(round)).reduce(
          (sum, r) => sum + r.newDiscoveries, 0
        );
        return prevTotal > 0 ? round.newDiscoveries / prevTotal : 1;
      });
      
      const isDecreasing = discoveryRates.every((rate, idx) => 
        idx === 0 || rate <= discoveryRates[idx - 1]
      );
      const avgRate = discoveryRates.reduce((a, b) => a + b, 0) / discoveryRates.length;
      
      if (isDecreasing && avgRate < 0.1) {
        console.log(`   🔍 收敛原因: 新发现率持续下降(平均${(avgRate * 100).toFixed(1)}%)`);
        return true;
      }
    }
    
    // 3. 如果收敛分数连续高于阈值
    if (allRounds.length >= 2) {
      const recentScores = allRounds.slice(-2).map(r => r.convergenceScore);
      const allHighScores = recentScores.every(score => score > this.convergenceConfig.challengeConvergenceThreshold);
      
      if (allHighScores && currentRound.convergenceScore > this.convergenceConfig.challengeConvergenceThreshold) {
        console.log(`   🔍 收敛原因: 收敛分数持续高于阈值(>${this.convergenceConfig.challengeConvergenceThreshold})`);
        return true;
      }
    }
    
    // 4. 动态调整：如果已经进行了足够多轮次且新发现很少
    const minRoundsBeforeEarlyStop = Math.ceil(this.convergenceConfig.maxChallengeRounds * 0.6);
    if (allRounds.length >= minRoundsBeforeEarlyStop) {
      const totalDiscoveries = allRounds.reduce((sum, round) => sum + round.newDiscoveries, 0);
      const avgDiscoveriesPerRound = totalDiscoveries / allRounds.length;
      
      if (avgDiscoveriesPerRound < 1 && currentRound.convergenceScore > 0.7) {
        console.log(`   🔍 收敛原因: 达到最小轮数且平均发现率低`);
        return true;
      }
    }
    
    return false;
  }

  private getConvergenceReason(
    currentRound: ChallengeRound, 
    allRounds: ChallengeRound[], 
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