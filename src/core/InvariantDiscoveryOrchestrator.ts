import { ConfigManager } from '../config/ConfigManager';
import { APIManager } from '../api/APIManager';
import { DynamicConfigLoader } from '../config/DynamicConfigLoader';
import { ExplorerAgent } from '../agents/ExplorerAgent';
import { DeepenerAgent } from '../agents/DeepenerAgent';
import { SynthesizerAgent } from '../agents/SynthesizerAgent';
import { SharedContext, AgentMessage, DiscoveryResult, ExplorationTask, Invariant } from '../types';
import { createLogger, Logger } from '../utils/Logger';

export class InvariantDiscoveryOrchestrator {
  private configManager: ConfigManager;
  private apiManager: APIManager;
  private configLoader: DynamicConfigLoader;
  private logger = createLogger('Orchestrator');
  
  // AI Agents
  private explorer: ExplorerAgent;
  private deepener: DeepenerAgent;
  private synthesizer: SynthesizerAgent;
  
  constructor() {
    this.configManager = ConfigManager.getInstance();
    this.apiManager = new APIManager(this.configManager.getAPIConfig());
    this.configLoader = new DynamicConfigLoader();
    
    // Initialize agents
    this.explorer = new ExplorerAgent(this.apiManager);
    this.deepener = new DeepenerAgent(this.apiManager);
    this.synthesizer = new SynthesizerAgent(this.apiManager);
  }
  
  async discoverInvariants(
    contractCode: string,
    configPath?: string
  ): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const mainLogger = Logger.getInstance();
    
    mainLogger.phase('开始不变量发现流程');
    this.logger.debug(`合约代码长度: ${contractCode.length} 字符`);
    this.logger.debug(`配置文件路径: ${configPath || '使用默认配置'}`);
    
    // 初始化共享上下文
    const context: SharedContext = {
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
      
      // 识别核心不变量
      mainLogger.phase('核心不变量识别');
      const coreInvariants = await this.synthesizer.identifyCore(explorerMessages);
      this.logger.info(`成功识别 ${coreInvariants.length} 个核心不变量`);
      coreInvariants.forEach((invariant, index) => {
        this.logger.debug(`   ${index + 1}. ${invariant.description.substring(0, 80)}`);
      });
      
      // 第二阶段：Deepener Challenge深化分析
      mainLogger.phase('阶段 2: Deepener 深化');
      const deepenerMessages = await this.deepenerChallengePhase(coreInvariants, explorerMessages, contractCode);
      
      // 第三阶段：最终综合
      mainLogger.phase('阶段 3: 最终综合');
      const finalResult = await this.synthesizer.finalSynthesize({
        initial: explorerMessages,
        deepened: deepenerMessages,
        core: coreInvariants
      });
      
      const executionTime = Date.now() - startTime;
      
      // 成功完成
      mainLogger.phase('分析流程完成');
      this.logger.info(`🎉 分析完成! 总耗时: ${(executionTime / 1000).toFixed(2)} 秒`);
      this.logger.info(`📊 发现不变量数量: ${finalResult.discoveredInvariants?.length || 0} 个`);
      mainLogger.separator();
      
      return finalResult;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      mainLogger.phase('流程出错');
      this.logger.error(`错误: ${error}`);
      mainLogger.separator();
      throw error;
    }
  }
  
  private async explorerChallengePhase(
    contractCode: string,
    explorationTasks: ExplorationTask[],
    context: SharedContext
  ): Promise<AgentMessage[]> {
    this.logger.info('🚀 启动 Explorer 对抗探索');
    
    // 使用新的Challenge方法
    const startTime = Date.now();
    const explorerMessages = await this.explorer.exploreWithChallenge(contractCode, explorationTasks, context);
    const endTime = Date.now();
    
    context.discussionHistory.push(...explorerMessages);
    
    this.logger.info(`✅ Explorer 对抗探索完成 (耗时: ${((endTime - startTime) / 1000).toFixed(1)}s)`);
    
    return explorerMessages;
  }
  
  private async deepenerChallengePhase(
    coreInvariants: Invariant[],
    originalFindings: AgentMessage[],
    contractCode: string
  ): Promise<AgentMessage[]> {
    this.logger.info('🔍 启动 Deepener 深化分析');
    
    // 使用新的Challenge方法
    const deepenerMessages = await this.deepener.deepenWithChallenge(
      coreInvariants,
      originalFindings,
      contractCode
    );
    
    this.logger.info(`✅ Deepener 深度分析完成，生成 ${deepenerMessages.length} 项深化发现`);
    
    return deepenerMessages;
  }
  
  private async loadExplorationTasks(configPath?: string): Promise<ExplorationTask[]> {
    try {
      const configLoader = new DynamicConfigLoader(configPath ? [configPath] : undefined);
      
      // 基本的合约信息（简化版）
      const contractInfo = {
        contractName: 'AnalyzedContract',
        stateVariables: [],
        functions: []
      };
      
      const tasks = await configLoader.generateExplorationTasks(contractInfo);
      this.logger.debug(`成功加载 ${tasks.length} 个探索任务类别`);
      return tasks;
      
    } catch (error) {
      this.logger.warn(`⚠️ 配置加载失败，使用默认探索模式: ${error}`);
      return [
        {
          category: 'general',
          prompts: ['请探索合约中的所有重要不变量和规则'],
          priority: 'normal' as const
        }
      ];
    }
  }
  
  async discoverWithCustomPrompts(
    contractCode: string,
    customPrompts: string[]
  ): Promise<DiscoveryResult> {
    const customTasks: ExplorationTask[] = [{
      category: 'custom',
      prompts: customPrompts,
      priority: 'high' as const
    }];
    
    return this.discoverInvariants(contractCode);
  }
}