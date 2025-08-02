// 会话状态管理相关类型定义

export interface ExecutionSnapshot {
  sessionId: string;
  phase: 'explorer' | 'deepener' | 'synthesizer';
  subPhase: string; // 如 'alpha_round_1', 'beta_challenge_2', 'refinement_completed'
  currentRound: number;
  maxRounds: number;
  context: any; // SharedContext
  intermediateResults: any[];
  timestamp: number;
  
  // 详细的执行状态
  executionState: {
    lastCompletedStep: string;
    nextStep: string;
    stepProgress: number; // 0-1
    totalSteps: number;
    
    // API调用状态
    lastAPICall?: {
      agent: string;
      prompt: string;
      timestamp: number;
      status: 'pending' | 'completed' | 'failed';
      retryCount: number;
    };
  };
  
  // 元数据
  metadata: {
    totalExecutionTime: number;
    apiCallCount: number;
    errorCount: number;
    lastSavedAt: number;
    dataSize: number;
    error?: string; // API 错误信息
  };
  
  // 恢复运行所需的额外数据
  recoveryData?: {
    contractCode: string;
    contractName: string;
    configPath: string;
    materialId?: string;
    batchConfigPath?: string;
    explorerFindings?: any;
    deepenerProgress?: any;
    currentPhaseData?: {
      roundHistory: any[];
      alphaMessage?: any;
      betaMessage?: any;
      supplementaryPrompts: string[];
    };
  };
}

export interface SessionMetadata {
  sessionId: string;
  startTime: number;
  lastUpdateTime: number;
  lastPersistTime: number;
  totalUpdates: number;
  persistCount: number;
  memorySize: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface PersistenceDecision {
  shouldPersist: boolean;
  reasons: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedTime: number;
}

export interface PersistenceTask {
  sessionId: string;
  snapshot: ExecutionSnapshot;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  retryCount: number;
}

export interface HybridConfig {
  persistence: {
    timeStrategy: {
      forceInterval: number;      // 强制持久化间隔 (ms)
      maxMemoryTime: number;      // 最大内存保留时间 (ms)
    };
    businessStrategy: {
      criticalPhases: string[];   // 关键阶段
      criticalSubPhases: string[]; // 关键子阶段
    };
    performanceStrategy: {
      maxMemorySize: number;      // 内存限制 (bytes)
      batchWindow: number;        // 批处理窗口 (ms)
      compressionEnabled: boolean; // 启用压缩
    };
  };
  recovery: {
    autoRecover: boolean;         // 自动恢复
    maxRecoveryAttempts: number;  // 最大恢复尝试次数
    recoveryTimeout: number;      // 恢复超时时间 (ms)
  };
}

export interface RecoveryPoint {
  stepId: string;
  description: string;
  snapshot: ExecutionSnapshot;
  canResume: boolean;
  resumeInstructions?: string;
}

export interface APICallRecord {
  id: string;
  sessionId: string;
  agent: string;
  prompt: string;
  response?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'completed' | 'failed' | 'timeout';
  error?: string;
  retryCount: number;
  method: 'fetch' | 'axios';
}

export interface SessionRecoveryInfo {
  sessionId: string;
  availableRecoveryPoints: RecoveryPoint[];
  recommendedRecoveryPoint: RecoveryPoint;
  estimatedLostProgress: number; // 预估丢失的进度 (0-1)
  canAutomaticRecover: boolean;
}