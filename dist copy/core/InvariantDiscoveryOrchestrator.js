"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvariantDiscoveryOrchestrator = void 0;
const ConfigManager_1 = require("../config/ConfigManager");
const APIManager_1 = require("../api/APIManager");
const DynamicConfigLoader_1 = require("../config/DynamicConfigLoader");
const ExplorerAgent_1 = require("../agents/ExplorerAgent");
const DeepenerAgent_1 = require("../agents/DeepenerAgent");
const SynthesizerAgent_1 = require("../agents/SynthesizerAgent");
const Logger_1 = require("../utils/Logger");
class InvariantDiscoveryOrchestrator {
    constructor() {
        this.logger = (0, Logger_1.createLogger)('Orchestrator');
        this.configManager = ConfigManager_1.ConfigManager.getInstance();
        this.apiManager = new APIManager_1.APIManager(this.configManager.getAPIConfig());
        this.configLoader = new DynamicConfigLoader_1.DynamicConfigLoader();
        // Initialize agents
        this.explorer = new ExplorerAgent_1.ExplorerAgent(this.apiManager);
        this.deepener = new DeepenerAgent_1.DeepenerAgent(this.apiManager);
        this.synthesizer = new SynthesizerAgent_1.SynthesizerAgent(this.apiManager);
    }
    async discoverInvariants(contractCode, configPath) {
        const startTime = Date.now();
        const mainLogger = Logger_1.Logger.getInstance();
        mainLogger.phase('开始不变量发现流程');
        this.logger.debug(`合约代码长度: ${contractCode.length} 字符`);
        this.logger.debug(`配置文件路径: ${configPath || '使用默认配置'}`);
        // 初始化共享上下文
        const context = {
            contractCode,
            contractName: 'AnalyzedContract',
            discussionHistory: [],
            discoveredInvariants: [],
            openQuestions: [],
            currentRound: 1
        };
        this.logger.info('正在初始化分析环境');
        // 加载配置
        this.logger.info('正在加载探索策略配置');
        const explorationTasks = await this.loadExplorationTasks(configPath);
        this.logger.info(`成功加载 ${explorationTasks.length} 个探索维度`);
        try {
            // 第一阶段：Explorer Challenge探索
            mainLogger.phase('阶段 1: Explorer 探索');
            const explorerMessages = await this.explorerChallengePhase(contractCode, explorationTasks, context);
            this.logger.info(`Explorer 探索完成，产生 ${explorerMessages.length} 项发现`);
            // 第二阶段：Deepener 分析前置条件
            mainLogger.phase('阶段 2: Deepener 前置条件分析');
            const deepenerMessages = await this.deepenerChallengePhase(explorerMessages, contractCode);
            // 第三阶段：最终综合
            mainLogger.phase('阶段 3: 总结不变量和前置条件');
            const finalResult = await this.synthesizer.finalSynthesize({
                explorerFindings: explorerMessages,
                prerequisiteAnalysis: deepenerMessages,
                contractCode: contractCode
            });
            const executionTime = Date.now() - startTime;
            // 成功完成
            mainLogger.phase('分析流程完成');
            this.logger.info(`🎉 分析完成! 总耗时: ${(executionTime / 1000).toFixed(2)} 秒`);
            this.logger.info(`📊 发现不变量数量: ${finalResult.discoveredInvariants?.length || 0} 个`);
            mainLogger.separator();
            return finalResult;
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            mainLogger.phase('流程出错');
            this.logger.error(`错误: ${error}`);
            mainLogger.separator();
            throw error;
        }
    }
    async explorerChallengePhase(contractCode, explorationTasks, context) {
        this.logger.info('🚀 启动 Explorer 对抗探索');
        // 使用新的Challenge方法
        const startTime = Date.now();
        const explorerMessages = await this.explorer.exploreWithChallenge(contractCode, explorationTasks, context);
        const endTime = Date.now();
        context.discussionHistory.push(...explorerMessages);
        this.logger.info(`✅ Explorer 对抗探索完成 (耗时: ${((endTime - startTime) / 1000).toFixed(1)}s)`);
        return explorerMessages;
    }
    async deepenerChallengePhase(explorerFindings, contractCode) {
        this.logger.info('🔍 启动 Deepener 前置条件分析');
        // 使用新的Challenge方法分析前置条件
        const deepenerMessages = await this.deepener.analyzePrerequisites(explorerFindings, contractCode);
        this.logger.info(`✅ Deepener 深度分析完成，生成 ${deepenerMessages.length} 项深化发现`);
        return deepenerMessages;
    }
    async loadExplorationTasks(configPath) {
        try {
            const configLoader = new DynamicConfigLoader_1.DynamicConfigLoader(configPath ? [configPath] : undefined);
            // 基本的合约信息（简化版）
            const contractInfo = {
                contractName: 'AnalyzedContract',
                stateVariables: [],
                functions: []
            };
            const tasks = await configLoader.generateExplorationTasks(contractInfo);
            this.logger.debug(`成功加载 ${tasks.length} 个探索任务类别`);
            return tasks;
        }
        catch (error) {
            this.logger.warn(`⚠️ 配置加载失败，使用默认探索模式: ${error}`);
            return [
                {
                    category: 'general',
                    prompts: ['请探索合约中的所有重要不变量和规则'],
                    priority: 'normal'
                }
            ];
        }
    }
    async discoverWithCustomPrompts(contractCode, customPrompts) {
        const customTasks = [{
                category: 'custom',
                prompts: customPrompts,
                priority: 'high'
            }];
        return this.discoverInvariants(contractCode);
    }
}
exports.InvariantDiscoveryOrchestrator = InvariantDiscoveryOrchestrator;
//# sourceMappingURL=InvariantDiscoveryOrchestrator.js.map