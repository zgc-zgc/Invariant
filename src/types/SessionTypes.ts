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