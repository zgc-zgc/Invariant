"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgent = void 0;
const uuid_1 = require("uuid");
const Logger_1 = require("../utils/Logger");
const PromptManager_1 = require("../core/PromptManager");
class BaseAgent {
    constructor(apiManager, role) {
        this.apiManager = apiManager;
        this.agentRole = role;
        this.logger = (0, Logger_1.createLogger)(role);
    }
    createMessage(messageType, content, discovery) {
        return {
            messageId: (0, uuid_1.v4)(),
            agentRole: this.agentRole,
            messageType,
            content,
            discovery,
            referenceTo: []
        };
    }
    buildSystemPrompt() {
        return PromptManager_1.PromptManager.getAgentSystemPrompt(this.agentRole);
    }
    async callAI(prompt) {
        this.logger.info('正在调用AI分析引擎');
        const fullPrompt = this.buildSystemPrompt() + '\n\n' + prompt;
        this.logger.debug(`提示词长度: ${fullPrompt.length} 字符`);
        this.logger.info('发送分析请求中...');
        const startTime = Date.now();
        const response = await this.apiManager.callAPI(fullPrompt, this.agentRole);
        const endTime = Date.now();
        this.logger.info(`AI分析完成 (耗时: ${((endTime - startTime) / 1000).toFixed(1)}s)`);
        this.logger.debug(`响应长度: ${response.length} 字符`);
        return response;
    }
    // 新增：构建带合约代码的prompt
    buildPromptWithContract(basePrompt, contractCode) {
        return basePrompt.replace('{CONTRACT_CODE}', contractCode);
    }
}
exports.BaseAgent = BaseAgent;
//# sourceMappingURL=BaseAgent.js.map