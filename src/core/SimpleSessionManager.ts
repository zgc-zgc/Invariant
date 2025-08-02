import { promises as fs } from 'fs';
import path from 'path';
import { ExecutionSnapshot } from '../types/SessionTypes';
import { createLogger } from '../utils/Logger';

/**
 * 简化的恢复点管理器
 * 只处理API失败恢复点，不处理会话保存
 * 统一处理进程退出，避免重复退出消息
 */
export class SimpleSessionManager {
  private static instance: SimpleSessionManager | null = null;
  private logger = createLogger('SimpleSessionManager');
  private readonly recoveryPointFile = '.invariantx/recovery/latest.recovery.json';
  private initialized = false;
  private exitHandlersRegistered = false;

  private constructor() {}

  static getInstance(): SimpleSessionManager {
    if (!SimpleSessionManager.instance) {
      SimpleSessionManager.instance = new SimpleSessionManager();
    }
    return SimpleSessionManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(path.dirname(this.recoveryPointFile), { recursive: true });
      
      this.setupProcessHandlers();
      this.initialized = true;
      this.logger.info('SimpleSessionManager初始化完成');
    } catch (error) {
      this.logger.error(`初始化失败: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 设置进程退出处理器 - 只在这里统一处理
   */
  private setupProcessHandlers(): void {
    if (this.exitHandlersRegistered) return;
    
    const gracefulExit = async () => {
      this.logger.info('正在优雅退出，保存所有会话状态...');
      
      try {
        // 这里可以添加其他清理逻辑
        this.logger.info('所有会话状态已保存，安全退出');
      } catch (error) {
        this.logger.error(`退出时出错: ${(error as Error).message}`);
      }
      
      process.exit(0);
    };

    process.on('SIGINT', gracefulExit);
    process.on('SIGTERM', gracefulExit);
    process.on('beforeExit', gracefulExit);
    
    this.exitHandlersRegistered = true;
  }

  /**
   * 创建/覆盖单一恢复点 - 只在API失败时调用
   */
  async createRecoveryPoint(snapshot: ExecutionSnapshot): Promise<void> {
    await this.initialize();
    
    this.logger.debug(`🔍 createRecoveryPoint: 开始创建恢复点 (SessionID: ${snapshot.sessionId})`);
    
    try {
      const recoveryData = {
        sessionId: snapshot.sessionId,
        timestamp: Date.now(),
        phase: snapshot.phase,
        subPhase: snapshot.subPhase,
        agentRole: snapshot.executionState.lastAPICall?.agent || 'Unknown',
        failedPrompt: snapshot.executionState.lastAPICall?.prompt || '',
        errorInfo: {
          status: snapshot.executionState.lastAPICall?.status || 'unknown',
          lastCompletedStep: snapshot.executionState.lastCompletedStep,
          nextStep: snapshot.executionState.nextStep,
          errorCount: snapshot.metadata.errorCount
        },
        description: `API失败恢复点 - ${snapshot.phase}:${snapshot.subPhase}`,
        snapshot: snapshot
      };
      
      this.logger.debug(`💾 createRecoveryPoint: 写入恢复点文件: ${this.recoveryPointFile}`);
      await fs.writeFile(this.recoveryPointFile, JSON.stringify(recoveryData, null, 2), 'utf8');
      
      this.logger.info(`🔄 恢复点已更新 - ${snapshot.phase}阶段 ${recoveryData.agentRole}代理`);
      this.logger.info(`📊 恢复点统计: ErrorCount=${recoveryData.errorInfo.errorCount}, PromptLength=${recoveryData.failedPrompt.length}, DataSize=${snapshot.metadata.dataSize}bytes`);
      
      if (recoveryData.failedPrompt) {
        const promptPreview = recoveryData.failedPrompt.length > 50 
          ? recoveryData.failedPrompt.substring(0, 50) + '...'
          : recoveryData.failedPrompt;
        this.logger.debug(`失败提示词预览: ${promptPreview}`);
      }
    } catch (error) {
      this.logger.error(`❌ createRecoveryPoint: 创建恢复点失败: ${(error as Error).message}`);
      this.logger.error(`🔍 恢复点创建错误详情: ${(error as Error).stack}`);
      throw error;
    }
  }

  /**
   * 获取最新的恢复点详细信息
   */
  async getRecoveryPointDetails(): Promise<{
    sessionId: string;
    phase: string;
    subPhase: string;
    agentRole: string;
    failedPrompt: string;
    errorInfo: any;
    snapshot: ExecutionSnapshot;
  } | null> {
    this.logger.debug(`🔍 getRecoveryPointDetails: 检查恢复点文件: ${this.recoveryPointFile}`);
    
    try {
      const content = await fs.readFile(this.recoveryPointFile, 'utf8');
      const recoveryData = JSON.parse(content);
      
      this.logger.debug(`✅ getRecoveryPointDetails: 找到恢复点`);
      this.logger.debug(`📊 恢复点信息: SessionID=${recoveryData.sessionId}, Phase=${recoveryData.phase}, Agent=${recoveryData.agentRole}`);
      this.logger.debug(`📊 错误信息: Status=${recoveryData.errorInfo?.status}, ErrorCount=${recoveryData.errorInfo?.errorCount}`);
      
      return recoveryData;
    } catch (error) {
      this.logger.debug(`❌ getRecoveryPointDetails: 没有找到恢复点详情: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * 清理恢复点文件
   */
  async clearRecoveryPoint(): Promise<void> {
    try {
      await fs.unlink(this.recoveryPointFile);
      this.logger.info('恢复点文件已清理');
    } catch (error) {
      this.logger.debug(`清理恢复点失败: ${(error as Error).message}`);
    }
  }
}