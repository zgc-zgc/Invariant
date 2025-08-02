import { ConfigManager } from '../config/ConfigManager';
import { APIManager } from '../api/APIManager';
import { DynamicConfigLoader } from '../config/DynamicConfigLoader';
import { ExplorerAgent } from '../agents/ExplorerAgent';
import { DeepenerAgent } from '../agents/DeepenerAgent';
import { SynthesizerAgent } from '../agents/SynthesizerAgent';
import { SimpleSessionManager } from './SimpleSessionManager';
import { SharedContext, AgentMessage, DiscoveryResult, ExplorationTask, Invariant } from '../types';
import { createLogger, Logger } from '../utils/Logger';

export class InvariantDiscoveryOrchestrator {
  private configManager: ConfigManager;
  private apiManager: APIManager;
  private simpleSessionManager: SimpleSessionManager;
  private logger = createLogger('Orchestrator');
  
  // AI Agents
  private explorer: ExplorerAgent;
  private deepener: DeepenerAgent;
  private synthesizer: SynthesizerAgent;
  
  // 会话状态
  private currentSessionId: string | null = null;
  
  constructor() {
    this.configManager = ConfigManager.getInstance();
    this.apiManager = new APIManager(this.configManager.getAPIConfig());
    this.simpleSessionManager = SimpleSessionManager.getInstance();
    
    // Initialize agents
    this.explorer = new ExplorerAgent(this.apiManager);
    this.deepener = new DeepenerAgent(this.apiManager);
    this.synthesizer = new SynthesizerAgent(this.apiManager);
  }
  
  
  async discoverInvariants(
    contractCode: string,
    configPath?: string,
    resumeSessionId?: string
  ): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const mainLogger = Logger.getInstance();
    
    // 1. 检查API失败恢复点
    let sessionId: string;
    let context: SharedContext;
    let currentPhase: 'explorer' | 'deepener' | 'synthesizer' = 'explorer';
    let currentRound = 1;
    
    if (resumeSessionId) {
      // 检查是否有API失败恢复点
      const recoveryDetails = await this.simpleSessionManager.getRecoveryPointDetails();
      
      if (recoveryDetails && recoveryDetails.sessionId === resumeSessionId && recoveryDetails.errorInfo.status === 'failed') {
        mainLogger.phase('检测到API失败恢复点，准备重试');
        this.logger.info(`发现API失败恢复点: ${resumeSessionId}`);
        this.logger.info(`失败阶段: ${recoveryDetails.phase} - ${recoveryDetails.agentRole}代理`);
        this.logger.info(`失败提示词: ${recoveryDetails.failedPrompt.substring(0, 100)}...`);
        
        // 从API失败恢复点恢复
        const snapshot = recoveryDetails.snapshot;
        sessionId = resumeSessionId;
        this.currentSessionId = sessionId;
        
        // 从快照恢复状态
        currentPhase = snapshot.phase;
        currentRound = snapshot.currentRound;
        context = snapshot.context;
        
        mainLogger.phase(`从API失败处恢复 - ${snapshot.phase}阶段`);
        this.logger.info(`✅ 会话恢复成功，将重试失败的API调用`);
        
      } else {
        this.logger.warn(`恢复会话 ${resumeSessionId} 未找到API失败恢复点，开始新会话`);
        sessionId = this.generateSessionId();
        this.currentSessionId = sessionId;
        context = this.initializeContext(contractCode);
      }
    } else {
      sessionId = this.generateSessionId();
      this.currentSessionId = sessionId;
      context = this.initializeContext(contractCode);
    }
    
    // 设置所有AI代理的会话ID
    this.explorer.setCurrentSession(sessionId);
    this.deepener.setCurrentSession(sessionId);
    this.synthesizer.setCurrentSession(sessionId);
    
    mainLogger.phase('开始不变量发现流程');
    this.logger.debug(`会话ID: ${sessionId}`);
    this.logger.debug(`合约代码长度: ${contractCode.length} 字符`);
    this.logger.debug(`配置文件路径: ${configPath || '使用默认配置'}`);
    
    this.logger.info('正在初始化分析环境');
    
    // 加载配置
    this.logger.info('正在加载探索策略配置');
    const explorationTasks = await this.loadExplorationTasks(configPath);
    this.logger.info(`成功加载 ${explorationTasks.length} 个探索维度`);
    
    try {
      let explorerMessages: AgentMessage[] = [];
      let deepenerMessages: AgentMessage[] = [];
      
      // 根据恢复的阶段决定从哪里开始
      if (currentPhase === 'explorer' || (!resumeSessionId)) {
        // 第一阶段：Explorer Challenge探索
        mainLogger.phase('阶段 1: Explorer 探索');
        
        explorerMessages = await this.explorerChallengePhase(sessionId, contractCode, explorationTasks, context);
        
        // 更新阶段状态
        currentPhase = 'deepener';
      } else if (context.discussionHistory && context.discussionHistory.length > 0) {
        // 从恢复的状态中获取explorer结果
        explorerMessages = context.discussionHistory.filter(msg => msg.agentRole === 'Explorer');
        this.logger.info(`从恢复状态获取到 ${explorerMessages.length} 个Explorer消息`);
      }
      
      if (currentPhase === 'deepener' || currentPhase === 'synthesizer') {
        // 第二阶段：Deepener Challenge深化分析
        mainLogger.phase('阶段 2: Deepener 深化');
        
        deepenerMessages = await this.deepenerChallengePhase(sessionId, [], explorerMessages, contractCode);
        
        // 更新阶段状态
        currentPhase = 'synthesizer';
      } else if (context.discussionHistory && context.discussionHistory.length > 0) {
        // 从恢复的状态中获取deepener结果
        deepenerMessages = context.discussionHistory.filter(msg => msg.agentRole === 'Deepener');
        this.logger.info(`从恢复状态获取到 ${deepenerMessages.length} 个Deepener消息`);
      }
      
      // 第三阶段：最终综合
      mainLogger.phase('阶段 3: 最终综合');
      
      const finalResult = await this.synthesizer.finalSynthesize({
        initial: explorerMessages,
        deepened: deepenerMessages,
        core: [], // 不再使用中间总结的core invariants
        contractCode: contractCode
      });
      
      const executionTime = Date.now() - startTime;
      
      // 成功完成
      mainLogger.phase('分析流程完成');
      this.logger.info(`🎉 分析完成! 总耗时: ${(executionTime / 1000).toFixed(2)} 秒`);
      this.logger.info(`📊 发现不变量数量: ${finalResult.discoveredInvariants?.length || 0} 个`);
      this.logger.info(`💾 会话ID: ${sessionId} (可用于恢复)`);
      mainLogger.separator();
      
      return finalResult;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      mainLogger.phase('流程出错');
      this.logger.error(`错误: ${error}`);
      
      this.logger.info(`💾 错误会话ID: ${sessionId} (可用于恢复)`);
      mainLogger.separator();
      throw error;
    }
  }
  
  private async explorerChallengePhase(
    sessionId: string,
    contractCode: string,
    explorationTasks: ExplorationTask[],
    context: SharedContext
  ): Promise<AgentMessage[]> {
    // 使用新的Challenge方法
    const startTime = Date.now();
    const explorerMessages = await this.explorer.exploreWithChallenge(contractCode, explorationTasks, context);
    const endTime = Date.now();
    
    context.discussionHistory.push(...explorerMessages);
    
    this.logger.info(`✅ Explorer 对抗探索完成 (耗时: ${((endTime - startTime) / 1000).toFixed(1)}s)`);
    
    return explorerMessages;
  }
  
  private async deepenerChallengePhase(
    sessionId: string,
    coreInvariants: Invariant[],
    originalFindings: AgentMessage[],
    contractCode: string
  ): Promise<AgentMessage[]> {
    // 使用新的Challenge方法
    const deepenerMessages = await this.deepener.deepenWithChallenge(
      coreInvariants,
      originalFindings,
      contractCode
    );
    
    return deepenerMessages;
  }
  
  // 会话管理工具方法
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `session_${timestamp}_${random}`;
  }
  
  private initializeContext(contractCode: string): SharedContext {
    return {
      contractCode,
      contractName: 'AnalyzedContract',
      discussionHistory: [],
      discoveredInvariants: [],
      openQuestions: [],
      currentRound: 1
    };
  }
  
  // 公共API方法
  getSystemStatus() {
    return {
      apiManager: this.apiManager.getCallStatistics(),
      currentSession: this.currentSessionId
    };
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