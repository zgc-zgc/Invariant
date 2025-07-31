"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExplorerAgent = void 0;
const BaseAgent_1 = require("./BaseAgent");
const ChallengeSystem_1 = require("../core/ChallengeSystem");
const ConfigManager_1 = require("../config/ConfigManager");
const PromptManager_1 = require("../core/PromptManager");
class ExplorerAgent extends BaseAgent_1.BaseAgent {
    constructor(apiManager) {
        super(apiManager, 'Explorer');
        const configManager = ConfigManager_1.ConfigManager.getInstance();
        this.challengeSystem = new ChallengeSystem_1.ChallengeSystem(apiManager, configManager.getConvergenceConfig());
    }
    async exploreWithChallenge(contractCode, explorationTasks, context) {
        this.logger.info('开始Explorer Challenge...');
        // 构建增强的初始探索提示
        const initialPrompt = this.buildEnhancedExplorationPrompt(contractCode, context);
        // 提取补充提示
        const supplementaryPrompts = this.extractSupplementaryPrompts(explorationTasks);
        // 进行Alpha-Beta Challenge
        const challengeResult = await this.challengeSystem.conductChallenge('Explorer', initialPrompt, contractCode, supplementaryPrompts);
        this.logger.info(`Explorer Challenge完成，共 ${challengeResult.totalRounds} 轮，${challengeResult.converged ? '已收敛' : '未收敛'}`);
        return challengeResult.finalDiscoveries;
    }
    buildEnhancedExplorationPrompt(contractCode, context) {
        // 使用PromptManager构建完整的prompt，而不是硬编码
        return PromptManager_1.PromptManager.buildCompletePrompt('Explorer', 'Alpha', contractCode, {
            name: 'Unknown',
            purpose: 'COMPREHENSIVE ANALYSIS OF THE SMART CONTRACT FOR ITS INVARIANTS AND RULES. DISCOVER ALL "PROPERTIES THAT ARE ALWAYS TRUE" (INVARIANTS) AND "RULES THAT MUST BE FOLLOWED", WITHOUT LIMITING THE DIRECTION OF THOUGHT AND WITH FULL CREATIVITY.'
        });
    }
    extractSupplementaryPrompts(tasks) {
        const prompts = [];
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
    async explore(contractCode, explorationTasks, context) {
        // 默认使用Challenge模式
        return this.exploreWithChallenge(contractCode, explorationTasks, context);
    }
}
exports.ExplorerAgent = ExplorerAgent;
//# sourceMappingURL=ExplorerAgent.js.map