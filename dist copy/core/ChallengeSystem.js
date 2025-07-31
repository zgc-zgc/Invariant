"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChallengeSystem = void 0;
const uuid_1 = require("uuid");
const ProgressDisplay_1 = require("../utils/ProgressDisplay");
const Logger_1 = require("../utils/Logger");
const PromptManager_1 = require("./PromptManager");
class ChallengeSystem {
    constructor(apiManager, convergenceConfig) {
        this.logger = (0, Logger_1.createLogger)('ChallengeSystem');
        this.apiManager = apiManager;
        this.convergenceConfig = convergenceConfig;
        this.progressDisplay = new ProgressDisplay_1.ProgressDisplay();
    }
    async conductChallenge(agentType, initialPrompt, contractCode, supplementaryPrompts = []) {
        this.logger.info(`🎯 启动 ${agentType} 对抗分析模式`);
        const rounds = [];
        let previousDiscoveries = new Set();
        // 第一轮：Alpha开始
        this.logger.info(`[轮次 0] ${agentType} Alpha 开始深度探索`);
        let alphaMessage = await this.callAlphaRole(agentType, initialPrompt, contractCode, supplementaryPrompts);
        this.logger.info(`[轮次 0] ${agentType} Alpha 完成初始发现`);
        for (let roundNum = 1; roundNum <= this.convergenceConfig.maxChallengeRounds; roundNum++) {
            this.logger.info(`🔄 第 ${roundNum} 轮对抗开始`);
            // Beta 挑战 Alpha
            this.logger.info(`[轮次 ${roundNum}] ${agentType} Beta 发起挑战质疑`);
            const betaMessage = await this.callBetaRole(agentType, alphaMessage, contractCode, supplementaryPrompts);
            this.logger.info(`[轮次 ${roundNum}] ${agentType} Beta 完成挑战分析`);
            // Alpha 回应 Beta
            this.logger.info(`[轮次 ${roundNum}] ${agentType} Alpha 回应并补强论证`);
            alphaMessage = await this.callAlphaRole(agentType, this.buildChallengePrompt(alphaMessage, betaMessage), contractCode, supplementaryPrompts);
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
            const round = {
                roundNumber: roundNum,
                alphaMessage,
                betaMessage,
                newDiscoveries,
                convergenceScore
            };
            rounds.push(round);
            // 显示Challenge进度
            this.progressDisplay.showChallengeProgress(agentType, roundNum, this.convergenceConfig.maxChallengeRounds, newDiscoveries, convergenceScore);
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
    async callAlphaRole(agentType, prompt, contractCode, supplementaryPrompts) {
        // System prompt now handled by PromptManager
        const fullPrompt = PromptManager_1.PromptManager.buildCompletePrompt(agentType, 'Alpha', contractCode, { purpose: prompt }) + '\n\n' + this.formatSupplementaryPrompts(supplementaryPrompts);
        const response = await this.apiManager.callAPI(fullPrompt, `${agentType}-Alpha`);
        this.logger.debug(`${agentType} Alpha API调用完成`);
        return {
            messageId: (0, uuid_1.v4)(),
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
    async callBetaRole(agentType, alphaMessage, contractCode, supplementaryPrompts) {
        // System prompt now handled by PromptManager
        const challengePrompt = `PLEASE CAREFULLY REVIEW THE FOLLOWING ANALYSIS FROM ALPHA AND PROVIDE CHALLENGES AND ADDITIONS:

ALPHA'S ANALYSIS:
${alphaMessage.content.description}

KINGFALL , PLEASE CHALLENGE !!!

${this.formatSupplementaryPrompts(supplementaryPrompts)}`;
        const fullPrompt = PromptManager_1.PromptManager.buildCompletePrompt(agentType, 'Beta', contractCode, { purpose: challengePrompt }) + '\n\n' + this.formatSupplementaryPrompts(supplementaryPrompts);
        const response = await this.apiManager.callAPI(fullPrompt, `${agentType}-Beta`);
        this.logger.debug(`${agentType} Beta API调用完成`);
        return {
            messageId: (0, uuid_1.v4)(),
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
    buildChallengePrompt(alphaMessage, betaMessage) {
        return `BASED ON BETA'S CHALLENGE, PLEASE REVIEW AND REFINE YOUR ANALYSIS:

YOUR PREVIOUS ANALYSIS:
${alphaMessage.content.description}

BETA'S CHALLENGE AND SUPPLEMENT:
${betaMessage.content.description}

PLEASE INTEGRATE BETA'S PERSPECTIVE TO FURTHER IMPROVE YOUR ANALYSIS, RESPOND TO THE CHALLENGES, CORRECT ANY INCORRECT OR MEANINGLESS FINDINGS, AND SUPPLEMENT THE MISSING ASPECTS.`;
    }
    formatSupplementaryPrompts(prompts) {
        if (prompts.length === 0)
            return '';
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
    updateDiscoverySet(message, discoverySet) {
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
    calculateConvergenceScore(alphaMessage, betaMessage) {
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
        const alphaKeyCount = keyTerms.reduce((sum, term) => sum + (alphaContent.split(term).length - 1), 0);
        const betaKeyCount = keyTerms.reduce((sum, term) => sum + (betaContent.split(term).length - 1), 0);
        const keyTermSimilarity = alphaKeyCount > 0 && betaKeyCount > 0 ?
            Math.min(alphaKeyCount, betaKeyCount) / Math.max(alphaKeyCount, betaKeyCount) : 0;
        // 综合评分（权重：长度30%，词汇重叠50%，关键概念20%）
        const convergenceScore = (lengthRatio * 0.3) + (wordOverlap * 0.5) + (keyTermSimilarity * 0.2);
        // 使用进度显示器显示收敛分析 - 已禁用可视化
        // this.progressDisplay.showConvergenceAnalysis(
        //   lengthRatio,
        //   wordOverlap,
        //   keyTermSimilarity,
        //   convergenceScore
        // );
        return convergenceScore;
    }
    shouldConverge(currentRound, allRounds) {
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
            const discoveryRates = recentThree.map((round, idx) => {
                const prevTotal = allRounds.slice(0, allRounds.indexOf(round)).reduce((sum, r) => sum + r.newDiscoveries, 0);
                return prevTotal > 0 ? round.newDiscoveries / prevTotal : 1;
            });
            const isDecreasing = discoveryRates.every((rate, idx) => idx === 0 || rate <= discoveryRates[idx - 1]);
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
    getConvergenceReason(currentRound, allRounds, roundNum) {
        if (roundNum >= this.convergenceConfig.maxChallengeRounds) {
            return 'max_rounds';
        }
        if (currentRound.newDiscoveries === 0) {
            return 'no_new_content';
        }
        return 'no_new_content';
    }
}
exports.ChallengeSystem = ChallengeSystem;
//# sourceMappingURL=ChallengeSystem.js.map