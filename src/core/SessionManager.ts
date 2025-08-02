import { ExecutionSnapshot, SessionMetadata, PersistenceDecision, PersistenceTask, HybridConfig, RecoveryPoint, SessionRecoveryInfo } from '../types/SessionTypes';
import { createLogger } from '../utils/Logger';
import { promises as fs } from 'fs';
import path from 'path';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export class HybridSessionManager {
  // 内存层
  private memoryCache = new Map<string, ExecutionSnapshot>();
  private metadata = new Map<string, SessionMetadata>();
  
  // 持久层配置
  private readonly SESSION_DIR = '.invariantx/sessions/';
  private readonly BACKUP_DIR = '.invariantx/backups/';
  private readonly RECOVERY_DIR = '.invariantx/recovery/';
  
  // 后台任务
  private persistQueue: PersistenceTask[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private backgroundInterval: NodeJS.Timeout | null = null;
  
  private logger = createLogger('SessionManager');
  
  // 策略配置
  private readonly config: HybridConfig = {
    persistence: {
      timeStrategy: {
        forceInterval: 60 * 1000,      // 1分钟强制持久化
        maxMemoryTime: 5 * 60 * 1000,  // 5分钟最大内存保留
      },
      businessStrategy: {
        criticalPhases: ['explorer', 'deepener', 'synthesizer'],
        criticalSubPhases: [
          'alpha_completed', 'beta_completed', 'refinement_completed',
          'phase_transition', 'error_recovery', 'convergence_reached'
        ],
      },
      performanceStrategy: {
        maxMemorySize: 10 * 1024 * 1024,  // 10MB内存限制
        batchWindow: 100,                  // 100ms批处理窗口
        compressionEnabled: true,          // 启用压缩
      },
    },
    recovery: {
      autoRecover: true,
      maxRecoveryAttempts: 3,
      recoveryTimeout: 30000, // 30秒恢复超时
    }
  };

  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor(customConfig?: Partial<HybridConfig>) {
    if (customConfig) {
      this.config = this.mergeConfig(this.config, customConfig);
    }
    
    // 异步初始化，但不在构造函数中等待
    this.initPromise = this.initializeAsync();
    this.setupProcessHandlers();
  }

  /**
   * 确保系统已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized && this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * 异步初始化方法
   */
  private async initializeAsync(): Promise<void> {
    try {
      await this.initializeDirectories();
      this.startBackgroundTasks();
      this.initialized = true;
      this.logger.info('SessionManager初始化完成');
    } catch (error) {
      this.logger.error(`SessionManager初始化失败: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 主要的状态更新接口
   */
  async updateState(sessionId: string, snapshot: ExecutionSnapshot): Promise<void> {
    await this.ensureInitialized();
    
    try {
      // 1. 获取上次状态用于比较
      const lastSnapshot = this.memoryCache.get(sessionId);
      
      // 2. 更新内存（永远最快）
      this.memoryCache.set(sessionId, snapshot);
      this.updateMetadata(sessionId, snapshot);
      
      // 3. 智能持久化决策
      const decision = this.makeDecision(snapshot, lastSnapshot);
      
      // 4. 根据决策执行持久化
      if (decision.shouldPersist) {
        await this.executePersistence(sessionId, snapshot, decision);
      }
      
      // 5. 内存管理
      await this.performMemoryManagement();
      
      this.logger.debug(`状态已更新: ${sessionId}, 阶段: ${snapshot.phase}-${snapshot.subPhase}`);
      
    } catch (error) {
      this.logger.error(`状态更新失败: ${(error as Error).message}`);
      // 错误时强制持久化当前状态
      await this.forcePersist(sessionId, snapshot);
      throw error;
    }
  }

  /**
   * 创建恢复点
   */
  async createRecoveryPoint(sessionId: string, stepId: string, description: string): Promise<void> {
    const snapshot = this.memoryCache.get(sessionId);
    if (!snapshot) {
      throw new Error(`会话 ${sessionId} 不存在`);
    }

    const recoveryPoint: RecoveryPoint = {
      stepId,
      description,
      snapshot: { ...snapshot },
      canResume: true,
      resumeInstructions: `从步骤 ${stepId} 恢复: ${description}`
    };

    const recoveryFilePath = path.join(this.RECOVERY_DIR, `${sessionId}_${stepId}.recovery.json`);
    await this.atomicWrite(recoveryFilePath, recoveryPoint);
    
    this.logger.info(`恢复点已创建: ${sessionId}@${stepId}`);
  }

  /**
   * 智能决策核心逻辑
   */
  private makeDecision(current: ExecutionSnapshot, last?: ExecutionSnapshot): PersistenceDecision {
    const reasons: string[] = [];
    let priority: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // 决策因子1: 时间压力
    const metadata = this.metadata.get(current.sessionId);
    if (metadata) {
      const timeSinceLastPersist = Date.now() - metadata.lastPersistTime;
      
      if (timeSinceLastPersist > this.config.persistence.timeStrategy.forceInterval) {
        reasons.push('time_threshold_exceeded');
        priority = this.upgradePriority(priority, 'medium');
      }
      
      if (timeSinceLastPersist > this.config.persistence.timeStrategy.maxMemoryTime) {
        reasons.push('max_memory_time_exceeded');
        priority = this.upgradePriority(priority, 'high');
      }
    }

    // 决策因子2: 业务关键性
    if (this.isCriticalPhase(current)) {
      reasons.push('critical_phase_transition');
      priority = this.upgradePriority(priority, 'high');
    }

    if (this.isCriticalSubPhase(current)) {
      reasons.push('critical_subphase_reached');
      priority = this.upgradePriority(priority, 'critical');
    }

    // 决策因子3: 数据变化幅度
    if (last && this.hasSignificantDataChange(current, last)) {
      reasons.push('significant_data_change');
      priority = this.upgradePriority(priority, 'medium');
    }

    // 决策因子4: 内存压力
    if (this.isMemoryPressureHigh()) {
      reasons.push('memory_pressure');
      priority = this.upgradePriority(priority, 'high');
    }

    // 决策因子5: 错误恢复点
    if (this.isErrorRecoveryPoint(current)) {
      reasons.push('error_recovery_point');
      priority = this.upgradePriority(priority, 'critical');
    }

    return {
      shouldPersist: reasons.length > 0,
      reasons,
      priority,
      estimatedTime: this.estimatePersistTime(current)
    };
  }

  /**
   * 执行持久化操作
   */
  private async executePersistence(sessionId: string, snapshot: ExecutionSnapshot, decision: PersistenceDecision): Promise<void> {
    const persistStartTime = Date.now();

    try {
      // 根据优先级选择策略
      switch (decision.priority) {
        case 'critical':
          await this.criticalPersist(sessionId, snapshot);
          break;
        case 'high':
          await this.highPriorityPersist(sessionId, snapshot);
          break;
        case 'medium':
        case 'low':
          this.backgroundPersist(sessionId, snapshot); // 异步，不等待
          break;
      }

      // 更新持久化元数据
      this.updatePersistMetadata(sessionId, persistStartTime);
      
    } catch (error) {
      this.logger.error(`持久化失败: ${(error as Error).message}`);
      // 持久化失败时的备选方案
      await this.emergencyBackup(sessionId, snapshot);
    }
  }

  /**
   * 关键优先级持久化：同步 + 备份
   */
  private async criticalPersist(sessionId: string, snapshot: ExecutionSnapshot): Promise<void> {
    const filePath = this.getSessionFilePath(sessionId);
    const backupPath = this.getBackupFilePath(sessionId);
    
    // 原子写入主文件
    await this.atomicWrite(filePath, snapshot);
    
    // 同时创建备份
    await this.atomicWrite(backupPath, snapshot);
    
    // 验证写入完整性
    await this.verifyFileIntegrity(filePath, snapshot);
    
    this.logger.info(`[CRITICAL] 会话 ${sessionId} 已安全持久化`);
  }

  /**
   * 高优先级持久化：同步写入
   */
  private async highPriorityPersist(sessionId: string, snapshot: ExecutionSnapshot): Promise<void> {
    const filePath = this.getSessionFilePath(sessionId);
    await this.atomicWrite(filePath, snapshot);
    this.logger.debug(`[HIGH] 会话 ${sessionId} 已持久化`);
  }

  /**
   * 后台持久化：异步写入
   */
  private backgroundPersist(sessionId: string, snapshot: ExecutionSnapshot): void {
    const task: PersistenceTask = {
      sessionId,
      snapshot,
      priority: 'low',
      timestamp: Date.now(),
      retryCount: 0
    };

    this.persistQueue.push(task);
    
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, this.config.persistence.performanceStrategy.batchWindow);
    }
  }

  /**
   * 批处理持久化任务
   */
  private async processBatch(): Promise<void> {
    const tasks = [...this.persistQueue];
    this.persistQueue.length = 0;
    this.batchTimer = null;

    for (const task of tasks) {
      try {
        const filePath = this.getSessionFilePath(task.sessionId);
        await this.atomicWrite(filePath, task.snapshot);
        this.logger.debug(`[BATCH] 会话 ${task.sessionId} 已持久化`);
      } catch (error) {
        this.logger.warn(`批处理持久化失败: ${(error as Error).message}`);
        // 失败的任务重新加入队列
        if (task.retryCount < 3) {
          task.retryCount++;
          this.persistQueue.push(task);
        }
      }
    }
  }

  /**
   * 原子写入实现
   */
  private async atomicWrite(filePath: string, data: any): Promise<void> {
    let tempFilePath = `${filePath}.tmp.${Date.now()}`;
    
    try {
      // 确保目标目录存在
      const targetDir = path.dirname(filePath);
      await fs.mkdir(targetDir, { recursive: true });
      
      let content: Buffer;
      let finalFilePath = filePath;
      
      if (this.config.persistence.performanceStrategy.compressionEnabled) {
        const jsonString = JSON.stringify(data, null, 2);
        content = await gzipAsync(Buffer.from(jsonString, 'utf8'));
        finalFilePath = `${filePath}.gz`;
        tempFilePath = `${tempFilePath}.gz`;
      } else {
        content = Buffer.from(JSON.stringify(data, null, 2), 'utf8');
      }
      
      // 1. 写入临时文件
      await fs.writeFile(tempFilePath, content);
      
      // 2. 验证临时文件存在
      try {
        await fs.access(tempFilePath);
      } catch (error) {
        throw new Error(`临时文件写入失败: ${tempFilePath}`);
      }
      
      // 3. 原子重命名（如果目标文件已存在会被覆盖）
      await fs.rename(tempFilePath, finalFilePath);
      
      this.logger.debug(`原子写入成功: ${finalFilePath}`);
      
    } catch (error) {
      this.logger.error(`原子写入失败: ${(error as Error).message}`);
      
      // 清理临时文件
      try {
        await fs.access(tempFilePath);
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        // 忽略清理错误
      }
      throw error;
    }
  }

  /**
   * 会话恢复
   */
  async restoreSession(sessionId: string): Promise<ExecutionSnapshot | null> {
    await this.ensureInitialized();
    
    // 1. 先检查内存
    const memorySnapshot = this.memoryCache.get(sessionId);
    if (memorySnapshot) {
      this.logger.debug(`从内存恢复会话 ${sessionId}`);
      return memorySnapshot;
    }

    // 2. 从主文件恢复
    try {
      const baseFilePath = this.getSessionFilePath(sessionId);
      this.logger.debug(`尝试从主文件恢复: ${baseFilePath}`);
      
      // 尝试两种文件格式：.session.json.gz（压缩）和 .session.json（未压缩）
      let snapshot: ExecutionSnapshot | null = null;
      
      try {
        // 先尝试压缩文件
        snapshot = await this.readSnapshotFile(`${baseFilePath}.gz`);
        this.logger.debug(`从压缩文件恢复成功: ${baseFilePath}.gz`);
      } catch (error) {
        // 如果压缩文件不存在，尝试未压缩文件
        this.logger.debug(`压缩文件不存在，尝试未压缩文件: ${baseFilePath}`);
        snapshot = await this.readSnapshotFile(baseFilePath);
        this.logger.debug(`从未压缩文件恢复成功: ${baseFilePath}`);
      }
      
      if (!snapshot) {
        throw new Error('无法读取会话文件');
      }
      
      // 恢复到内存
      this.memoryCache.set(sessionId, snapshot);
      this.initializeMetadata(sessionId, snapshot);
      
      this.logger.info(`从文件恢复会话 ${sessionId}`);
      return snapshot;
      
    } catch (error) {
      this.logger.warn(`主文件恢复失败: ${(error as Error).message}`);
      // 3. 尝试从备份恢复
      return await this.restoreFromBackup(sessionId);
    }
  }

  /**
   * 获取会话恢复信息
   */
  async getRecoveryInfo(sessionId: string): Promise<SessionRecoveryInfo | null> {
    try {
      // 查找所有恢复点
      const recoveryFiles = await fs.readdir(this.RECOVERY_DIR);
      const sessionRecoveryFiles = recoveryFiles.filter(f => 
        f.startsWith(`${sessionId}_`) && f.endsWith('.recovery.json')
      );

      if (sessionRecoveryFiles.length === 0) {
        return null;
      }

      const recoveryPoints: RecoveryPoint[] = [];
      for (const file of sessionRecoveryFiles) {
        try {
          const filePath = path.join(this.RECOVERY_DIR, file);
          const content = await fs.readFile(filePath, 'utf8');
          const recoveryPoint = JSON.parse(content) as RecoveryPoint;
          recoveryPoints.push(recoveryPoint);
        } catch (error) {
          this.logger.warn(`恢复点文件损坏: ${file}`);
        }
      }

      if (recoveryPoints.length === 0) {
        return null;
      }

      // 按时间戳排序，选择最新的作为推荐恢复点
      recoveryPoints.sort((a, b) => b.snapshot.timestamp - a.snapshot.timestamp);
      const recommendedRecoveryPoint = recoveryPoints[0];

      // 计算预估丢失的进度
      const currentTime = Date.now();
      const lastSaveTime = recommendedRecoveryPoint.snapshot.timestamp;
      const estimatedLostProgress = Math.min((currentTime - lastSaveTime) / (5 * 60 * 1000), 1); // 最多5分钟进度

      return {
        sessionId,
        availableRecoveryPoints: recoveryPoints,
        recommendedRecoveryPoint,
        estimatedLostProgress,
        canAutomaticRecover: this.config.recovery.autoRecover && estimatedLostProgress < 0.3
      };

    } catch (error) {
      this.logger.error(`获取恢复信息失败: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * 从恢复点恢复会话
   */
  async recoverFromPoint(sessionId: string, stepId: string): Promise<ExecutionSnapshot> {
    const recoveryFilePath = path.join(this.RECOVERY_DIR, `${sessionId}_${stepId}.recovery.json`);
    
    try {
      const content = await fs.readFile(recoveryFilePath, 'utf8');
      const recoveryPoint = JSON.parse(content) as RecoveryPoint;
      
      if (!recoveryPoint.canResume) {
        throw new Error(`恢复点 ${stepId} 不支持恢复`);
      }

      // 恢复到内存
      this.memoryCache.set(sessionId, recoveryPoint.snapshot);
      this.initializeMetadata(sessionId, recoveryPoint.snapshot);
      
      this.logger.info(`从恢复点恢复会话: ${sessionId}@${stepId}`);
      return recoveryPoint.snapshot;
      
    } catch (error) {
      this.logger.error(`从恢复点恢复失败: ${(error as Error).message}`);
      throw error;
    }
  }

  // 工具方法
  private async readSnapshotFile(filePath: string): Promise<ExecutionSnapshot> {
    const isCompressed = filePath.endsWith('.gz');
    
    if (isCompressed) {
      const compressed = await fs.readFile(filePath);
      const decompressed = await gunzipAsync(compressed);
      return JSON.parse(decompressed.toString('utf8'));
    } else {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    }
  }
  
  private async performMemoryManagement(): Promise<void> {
    // 检查内存使用情况并进行必要的清理
    const totalMemory = Array.from(this.metadata.values())
      .reduce((sum, m) => sum + m.memorySize, 0);
    
    if (totalMemory > this.config.persistence.performanceStrategy.maxMemorySize) {
      this.logger.warn('内存使用超限，开始清理旧会话');
      this.forceCleanupOldestSessions(Math.ceil(this.memoryCache.size * 0.2)); // 清理20%的旧会话
    }
  }

  private async restoreFromBackup(sessionId: string): Promise<ExecutionSnapshot | null> {
    try {
      const backupPath = this.getBackupFilePath(sessionId);
      const snapshot = await this.readSnapshotFile(backupPath);
      
      // 恢复到内存
      this.memoryCache.set(sessionId, snapshot);
      this.initializeMetadata(sessionId, snapshot);
      
      this.logger.warn(`从备份恢复会话 ${sessionId}`);
      return snapshot;
      
    } catch (error) {
      this.logger.error(`从备份恢复失败: ${(error as Error).message}`);
      return null;
    }
  }

  private async forcePersist(sessionId: string, snapshot: ExecutionSnapshot): Promise<void> {
    try {
      await this.criticalPersist(sessionId, snapshot);
    } catch (error) {
      this.logger.error(`强制持久化失败: ${(error as Error).message}`);
    }
  }

  private async emergencyBackup(sessionId: string, snapshot: ExecutionSnapshot): Promise<void> {
    try {
      const emergencyPath = path.join(this.BACKUP_DIR, `emergency_${sessionId}_${Date.now()}.json`);
      await this.atomicWrite(emergencyPath, snapshot);
      this.logger.info(`紧急备份已创建: ${emergencyPath}`);
    } catch (error) {
      this.logger.error(`紧急备份失败: ${(error as Error).message}`);
    }
  }

  private updateMetadata(sessionId: string, snapshot: ExecutionSnapshot): void {
    const existing = this.metadata.get(sessionId);
    const now = Date.now();
    
    const metadata: SessionMetadata = {
      sessionId,
      startTime: existing?.startTime || now,
      lastUpdateTime: now,
      lastPersistTime: existing?.lastPersistTime || 0,
      totalUpdates: (existing?.totalUpdates || 0) + 1,
      persistCount: existing?.persistCount || 0,
      memorySize: JSON.stringify(snapshot).length,
      priority: this.calculatePriority(snapshot)
    };
    
    this.metadata.set(sessionId, metadata);
  }

  private updatePersistMetadata(sessionId: string, persistStartTime: number): void {
    const metadata = this.metadata.get(sessionId);
    if (metadata) {
      metadata.lastPersistTime = Date.now();
      metadata.persistCount++;
    }
  }

  private initializeMetadata(sessionId: string, snapshot: ExecutionSnapshot): void {
    const metadata: SessionMetadata = {
      sessionId,
      startTime: snapshot.timestamp,
      lastUpdateTime: Date.now(),
      lastPersistTime: Date.now(),
      totalUpdates: 1,
      persistCount: 1,
      memorySize: JSON.stringify(snapshot).length,
      priority: this.calculatePriority(snapshot)
    };
    
    this.metadata.set(sessionId, metadata);
  }

  private calculatePriority(snapshot: ExecutionSnapshot): 'low' | 'medium' | 'high' | 'critical' {
    if (this.isErrorRecoveryPoint(snapshot)) return 'critical';
    if (this.isCriticalSubPhase(snapshot)) return 'critical';
    if (this.isCriticalPhase(snapshot)) return 'high';
    if (snapshot.executionState.stepProgress > 0.8) return 'medium';
    return 'low';
  }

  // 决策辅助方法
  private isCriticalPhase(snapshot: ExecutionSnapshot): boolean {
    return this.config.persistence.businessStrategy.criticalPhases.includes(snapshot.phase);
  }

  private isCriticalSubPhase(snapshot: ExecutionSnapshot): boolean {
    return this.config.persistence.businessStrategy.criticalSubPhases.some(
      subPhase => snapshot.subPhase.includes(subPhase)
    );
  }

  private hasSignificantDataChange(current: ExecutionSnapshot, last: ExecutionSnapshot): boolean {
    const currentSize = JSON.stringify(current).length;
    const lastSize = JSON.stringify(last).length;
    const changeRatio = Math.abs(currentSize - lastSize) / lastSize;
    return changeRatio > 0.3; // 30%变化阈值
  }

  private isMemoryPressureHigh(): boolean {
    const totalMemoryUsage = Array.from(this.metadata.values())
      .reduce((sum, metadata) => sum + metadata.memorySize, 0);
    
    return totalMemoryUsage > this.config.persistence.performanceStrategy.maxMemorySize;
  }

  private isErrorRecoveryPoint(snapshot: ExecutionSnapshot): boolean {
    return snapshot.subPhase.includes('error') || 
           snapshot.subPhase.includes('recovery') ||
           snapshot.executionState.lastAPICall?.status === 'failed';
  }

  private upgradePriority(current: string, candidate: string): 'low' | 'medium' | 'high' | 'critical' {
    const priorities = ['low', 'medium', 'high', 'critical'];
    const currentIndex = priorities.indexOf(current);
    const candidateIndex = priorities.indexOf(candidate);
    return priorities[Math.max(currentIndex, candidateIndex)] as any;
  }

  private estimatePersistTime(snapshot: ExecutionSnapshot): number {
    const dataSize = JSON.stringify(snapshot).length;
    // 基于数据大小的简单估算：1KB约需1ms
    return Math.max(dataSize / 1024, 10);
  }

  // 路径生成方法
  private getSessionFilePath(sessionId: string): string {
    return path.join(this.SESSION_DIR, `${sessionId}.session.json`);
  }

  private getBackupFilePath(sessionId: string): string {
    return path.join(this.BACKUP_DIR, `${sessionId}.backup.json`);
  }

  // 系统维护方法
  private async initializeDirectories(): Promise<void> {
    const dirs = [this.SESSION_DIR, this.BACKUP_DIR, this.RECOVERY_DIR];
    
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        this.logger.warn(`创建目录失败: ${dir}, ${(error as Error).message}`);
      }
    }
  }

  private startBackgroundTasks(): void {
    // 定期内存清理
    this.backgroundInterval = setInterval(() => {
      this.cleanupOldSessions();
      this.monitorMemoryUsage();
    }, 5 * 60 * 1000); // 5分钟
  }

  private cleanupOldSessions(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时

    for (const [sessionId, metadata] of this.metadata.entries()) {
      if (now - metadata.lastUpdateTime > maxAge) {
        this.memoryCache.delete(sessionId);
        this.metadata.delete(sessionId);
        this.logger.debug(`清理过期会话: ${sessionId}`);
      }
    }
  }

  private monitorMemoryUsage(): void {
    const totalSessions = this.memoryCache.size;
    const totalMemory = Array.from(this.metadata.values())
      .reduce((sum, m) => sum + m.memorySize, 0);
    
    this.logger.debug(`内存使用情况: ${totalSessions} 会话, ${Math.round(totalMemory / 1024)}KB`);
    
    if (totalMemory > this.config.persistence.performanceStrategy.maxMemorySize) {
      this.logger.warn(`内存使用超限，强制清理最旧的会话`);
      this.forceCleanupOldestSessions(5);
    }
  }

  private forceCleanupOldestSessions(count: number): void {
    const sortedMetadata = Array.from(this.metadata.entries())
      .sort(([,a], [,b]) => a.lastUpdateTime - b.lastUpdateTime);
    
    for (let i = 0; i < Math.min(count, sortedMetadata.length); i++) {
      const [sessionId] = sortedMetadata[i];
      this.memoryCache.delete(sessionId);
      this.metadata.delete(sessionId);
      this.logger.debug(`强制清理会话: ${sessionId}`);
    }
  }

  private async verifyFileIntegrity(filePath: string, expectedData: any): Promise<void> {
    try {
      const readData = await this.readSnapshotFile(filePath);
      if (readData.sessionId !== expectedData.sessionId) {
        throw new Error('文件完整性验证失败');
      }
    } catch (error) {
      throw new Error(`文件完整性验证失败: ${(error as Error).message}`);
    }
  }

  private setupProcessHandlers(): void {
    // 移除进程退出处理器，由SimpleSessionManager统一处理
    // 避免重复的优雅退出消息
    
    // 只清理内部定时器
    const cleanup = () => {
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }
      if (this.backgroundInterval) {
        clearInterval(this.backgroundInterval);
      }
    };

    // 注册清理但不退出进程
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

  private async persistAllSessions(): Promise<void> {
    const promises = Array.from(this.memoryCache.entries()).map(
      async ([sessionId, snapshot]) => {
        try {
          await this.criticalPersist(sessionId, snapshot);
        } catch (error) {
          this.logger.error(`保存会话失败 ${sessionId}: ${(error as Error).message}`);
        }
      }
    );
    
    await Promise.all(promises);
  }

  private mergeConfig(base: HybridConfig, custom: Partial<HybridConfig>): HybridConfig {
    return {
      persistence: {
        ...base.persistence,
        ...custom.persistence,
        timeStrategy: {
          ...base.persistence.timeStrategy,
          ...custom.persistence?.timeStrategy
        },
        businessStrategy: {
          ...base.persistence.businessStrategy,
          ...custom.persistence?.businessStrategy
        },
        performanceStrategy: {
          ...base.persistence.performanceStrategy,
          ...custom.persistence?.performanceStrategy
        }
      },
      recovery: {
        ...base.recovery,
        ...custom.recovery
      }
    };
  }

  // 公共API方法
  async getActiveSessionIds(): Promise<string[]> {
    await this.ensureInitialized();
    
    // 首先从内存中获取活跃会话
    const memorySessionIds = Array.from(this.memoryCache.keys());
    
    // 然后扫描持久化文件中的会话
    const persistedSessionIds = await this.scanPersistedSessions();
    
    // 合并并去重
    const allSessionIds = new Set([...memorySessionIds, ...persistedSessionIds]);
    
    return Array.from(allSessionIds);
  }

  /**
   * 扫描持久化的会话文件
   */
  private async scanPersistedSessions(): Promise<string[]> {
    try {
      const sessionDir = path.dirname(this.getSessionFilePath('dummy'));
      
      // 确保会话目录存在
      await fs.mkdir(sessionDir, { recursive: true });
      
      const files = await fs.readdir(sessionDir);
      const sessionIds: string[] = [];
      
      for (const file of files) {
        // 匹配会话文件格式: session_xxxxx.session.json 或 session_xxxxx.session.json.gz
        const match = file.match(/^(session_[a-zA-Z0-9_]+)\.session\.json(\.gz)?$/);
        if (match) {
          const sessionId = match[1];
          
          // 检查是否是未完成的会话
          const isActive = await this.isSessionActive(sessionId);
          if (isActive) {
            sessionIds.push(sessionId);
          }
        }
      }
      
      this.logger.debug(`扫描到 ${sessionIds.length} 个持久化会话`);
      return sessionIds;
      
    } catch (error) {
      this.logger.warn(`扫描持久化会话时出错: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * 检查会话是否仍然活跃（未完成）
   */
  private async isSessionActive(sessionId: string): Promise<boolean> {
    try {
      this.logger.debug(`检查会话活跃状态: ${sessionId}`);
      const snapshot = await this.restoreSession(sessionId);
      if (!snapshot) {
        this.logger.debug(`无法恢复会话: ${sessionId}`);
        return false;
      }
      
      // 检查会话是否已完成
      const isCompleted = snapshot.phase === 'synthesizer' && 
                         snapshot.subPhase === 'analysis_completed';
      
      // 检查会话是否太旧（超过24小时认为无效）
      const isRecent = Date.now() - snapshot.metadata.lastSavedAt < 24 * 60 * 60 * 1000;
      
      const active = !isCompleted && isRecent;
      this.logger.debug(`会话 ${sessionId} 状态: 完成=${isCompleted}, 最近=${isRecent}, 活跃=${active}`);
      
      return active;
      
    } catch (error) {
      this.logger.warn(`检查会话活跃状态时出错: ${(error as Error).message}`);
      return false;
    }
  }

  getSessionMetadata(sessionId: string): SessionMetadata | undefined {
    return this.metadata.get(sessionId);
  }

  async clearSession(sessionId: string): Promise<void> {
    this.memoryCache.delete(sessionId);
    this.metadata.delete(sessionId);
    
    // 删除相关文件
    try {
      const sessionFile = this.getSessionFilePath(sessionId);
      const backupFile = this.getBackupFilePath(sessionId);
      
      await Promise.all([
        fs.unlink(sessionFile).catch(() => {}),
        fs.unlink(backupFile).catch(() => {})
      ]);
      
      this.logger.info(`会话已清理: ${sessionId}`);
    } catch (error) {
      this.logger.warn(`清理会话文件失败: ${(error as Error).message}`);
    }
  }

  getSystemStatus() {
    const totalSessions = this.memoryCache.size;
    const totalMemory = Array.from(this.metadata.values())
      .reduce((sum, m) => sum + m.memorySize, 0);
    
    return {
      activeSessions: totalSessions,
      memoryUsage: Math.round(totalMemory / 1024), // KB
      queuedPersistTasks: this.persistQueue.length,
      config: this.config
    };
  }
}