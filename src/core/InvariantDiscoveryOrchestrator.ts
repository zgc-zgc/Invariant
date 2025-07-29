import { ConfigManager } from '../config/ConfigManager';
import { APIManager } from '../api/APIManager';
import { DynamicConfigLoader } from '../config/DynamicConfigLoader';
import { ExplorerAgent } from '../agents/ExplorerAgent';
import { DeepenerAgent } from '../agents/DeepenerAgent';
import { SynthesizerAgent } from '../agents/SynthesizerAgent';
import { SharedContext, AgentMessage, DiscoveryResult, ExplorationTask, Invariant } from '../types';

export class InvariantDiscoveryOrchestrator {
  private configManager: ConfigManager;
  private apiManager: APIManager;
  private configLoader: DynamicConfigLoader;
  
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
    console.log('\n' + '='.repeat(80));
    console.log('🚀 开始InvariantX智能合约不变量发现流程');
    console.log('='.repeat(80));
    console.log(`📅 开始时间: ${new Date().toLocaleString()}`);
    console.log(`📄 合约代码长度: ${contractCode.length} 字符`);
    console.log(`⚙️  配置文件路径: ${configPath || '使用默认配置'}`);
    console.log('='.repeat(80) + '\n');
    
    // 初始化共享上下文
    const context: SharedContext = {
      contractCode,
      contractName: 'AnalyzedContract',
      discussionHistory: [],
      discoveredInvariants: [],
      openQuestions: [],
      currentRound: 1
    };
    
    console.log('📋 初始化共享上下文完成');
    
    // 加载配置
    console.log('⚙️  正在加载探索任务配置...');
    const explorationTasks = await this.loadExplorationTasks(configPath);
    console.log(`✅ 加载完成，共 ${explorationTasks.length} 个探索任务`);
    
    try {
      // 第一阶段：Explorer Challenge探索
      console.log('\n' + '━'.repeat(60));
      console.log('🔍 第一阶段：Explorer Alpha-Beta Challenge探索');
      console.log('━'.repeat(60));
      console.log('🎯 目标：通过Alpha-Beta挑战机制全面发现合约不变量');
      console.log(`📊 探索任务数量: ${explorationTasks.length}`);
      
      const explorerMessages = await this.explorerChallengePhase(contractCode, explorationTasks, context);
      
      console.log('\n✅ Explorer挑战阶段完成');
      console.log(`📈 生成消息数量: ${explorerMessages.length}`);
      
      // 识别核心不变量
      console.log('\n' + '━'.repeat(60));
      console.log('🎯 核心不变量识别阶段');
      console.log('━'.repeat(60));
      console.log('🔬 正在从Explorer发现中提取最关键的不变量...');
      
      const coreInvariants = await this.synthesizer.identifyCore(explorerMessages);
      
      console.log(`\n✅ 核心不变量识别完成`);
      console.log(`💎 识别出 ${coreInvariants.length} 个核心不变量`);
      coreInvariants.forEach((invariant, index) => {
        console.log(`   ${index + 1}. ${invariant.description.substring(0, 80)}...`);
      });
      
      // 第二阶段：Deepener Challenge深化分析
      console.log('第二阶段：Deepener Alpha-Beta Challenge深化分析');
      const deepenerMessages = await this.deepenerChallengePhase(coreInvariants, explorerMessages, contractCode);
      
      // 第三阶段：最终综合
      console.log('第三阶段：最终综合');
      const finalResult = await this.synthesizer.finalSynthesize({
        initial: explorerMessages,
        deepened: deepenerMessages,
        core: coreInvariants
      });
      
      const executionTime = Date.now() - startTime;
      
      // 成功完成
      console.log('\n' + '='.repeat(80));
      console.log('🎆 InvariantX不变量发现流程成功完成!');
      console.log('='.repeat(80));
      console.log(`⏱️  总执行时间: ${executionTime} ms (${(executionTime / 1000).toFixed(2)} 秒)`);
      console.log(`📊 最终不变量数量: ${finalResult.discoveredInvariants?.length || 0}`);
      console.log(`📦 返回结果大小: ${JSON.stringify(finalResult).length} 字符`);
      console.log('='.repeat(80) + '\n');
      
      return finalResult;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('\n' + '❌'.repeat(20));
      console.error('⚠️  InvariantX发现流程出错!');
      console.error('❌'.repeat(60));
      console.error(`⏱️  失败时间: ${executionTime}ms`);
      console.error(`🔍 错误信息: ${error}`);
      console.error('❌'.repeat(60));
      throw error;
    }
  }
  
  private async explorerChallengePhase(
    contractCode: string,
    explorationTasks: ExplorationTask[],
    context: SharedContext
  ): Promise<AgentMessage[]> {
    console.log('\n🔍 Explorer Alpha-Beta Challenge开始...');
    console.log(`📊 探索任务数量: ${explorationTasks.length}`);
    
    // 使用新的Challenge方法
    const startTime = Date.now();
    const explorerMessages = await this.explorer.exploreWithChallenge(contractCode, explorationTasks, context);
    const endTime = Date.now();
    
    context.discussionHistory.push(...explorerMessages);
    
    console.log(`\n✅ Explorer Challenge完成`);
    console.log(`⏱️  耗时: ${endTime - startTime}ms`);
    console.log(`💡 发现了 ${explorerMessages.length} 个潜在不变量`);
    
    return explorerMessages;
  }
  
  private async deepenerChallengePhase(
    coreInvariants: Invariant[],
    originalFindings: AgentMessage[],
    contractCode: string
  ): Promise<AgentMessage[]> {
    console.log('Deepener 开始Alpha-Beta Challenge深化分析...');
    
    // 使用新的Challenge方法
    const deepenerMessages = await this.deepener.deepenWithChallenge(
      coreInvariants,
      originalFindings,
      contractCode
    );
    
    console.log(`Deepener Challenge完成，完成了 ${deepenerMessages.length} 个深化分析`);
    
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
      console.log(`加载了 ${tasks.length} 个探索任务类别`);
      return tasks;
      
    } catch (error) {
      console.warn('配置加载失败，使用默认探索模式:', error);
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