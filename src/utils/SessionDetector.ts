import path from 'path';
import { promises as fs } from 'fs';
import { ExecutionSnapshot, SessionRecoveryInfo } from '../types/SessionTypes';
import { HybridSessionManager } from '../core/SessionManager';
import { createLogger } from './Logger';

/**
 * 智能会话检测器
 * 负责检测和匹配中断的会话，提供自动恢复建议
 */
export class SessionDetector {
  private sessionManager: HybridSessionManager;
  private logger = createLogger('SessionDetector');

  constructor() {
    this.sessionManager = new HybridSessionManager();
  }

  /**
   * 检测指定合约文件是否有中断的会话
   * @param contractFilePath 合约文件路径
   * @returns 匹配的会话信息
   */
  async detectInterruptedSessions(contractFilePath?: string): Promise<InterruptedSessionMatch[]> {
    try {
      const activeSessionIds = await this.sessionManager.getActiveSessionIds();
      
      if (activeSessionIds.length === 0) {
        return [];
      }

      const matches: InterruptedSessionMatch[] = [];

      for (const sessionId of activeSessionIds) {
        const snapshot = await this.sessionManager.restoreSession(sessionId);
        if (!snapshot) continue;

        const match = await this.evaluateSessionMatch(snapshot, contractFilePath);
        if (match.confidence > 0) {
          matches.push(match);
        }
      }

      // 按置信度排序
      return matches.sort((a, b) => b.confidence - a.confidence);

    } catch (error) {
      this.logger.warn(`检测中断会话时出错: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * 评估会话与当前合约的匹配度
   */
  private async evaluateSessionMatch(
    snapshot: ExecutionSnapshot, 
    contractFilePath?: string
  ): Promise<InterruptedSessionMatch> {
    let confidence = 0;
    const reasons: string[] = [];
    const warnings: string[] = [];

    // 1. 检查会话是否未完成
    if (snapshot.phase === 'synthesizer' && snapshot.subPhase === 'analysis_completed') {
      return {
        sessionId: snapshot.sessionId,
        confidence: 0,
        reasons: ['会话已完成'],
        warnings: [],
        snapshot,
        recommendedAction: 'ignore'
      };
    }

    // 2. 时间因素评估 (最近的会话优先)
    const timeSinceLastUpdate = Date.now() - snapshot.metadata.lastSavedAt;
    if (timeSinceLastUpdate < 5 * 60 * 1000) { // 5分钟内
      confidence += 40;
      reasons.push('会话中断时间很短(< 5分钟)');
    } else if (timeSinceLastUpdate < 30 * 60 * 1000) { // 30分钟内
      confidence += 25;
      reasons.push('会话中断时间较短(< 30分钟)');
    } else if (timeSinceLastUpdate < 2 * 60 * 60 * 1000) { // 2小时内
      confidence += 15;
      reasons.push('会话中断时间中等(< 2小时)');
    } else {
      confidence += 5;
      warnings.push('会话中断时间较长，数据可能过期');
    }

    // 3. 合约文件匹配评估
    if (contractFilePath) {
      const contractMatch = await this.evaluateContractMatch(snapshot, contractFilePath);
      confidence += contractMatch.confidenceBonus;
      reasons.push(...contractMatch.reasons);
      warnings.push(...contractMatch.warnings);
    } else {
      confidence += 20; // 批量模式，给予中等置信度
      reasons.push('批量分析模式，无需精确文件匹配');
    }

    // 4. 会话进度评估
    const progressFactor = this.evaluateProgress(snapshot);
    confidence += progressFactor.confidenceBonus;
    reasons.push(...progressFactor.reasons);

    // 5. 数据完整性评估
    if (snapshot.context && snapshot.context.contractCode) {
      confidence += 10;
      reasons.push('会话数据完整');
    } else {
      warnings.push('会话数据不完整');
    }

    // 确定推荐操作
    const recommendedAction = this.determineRecommendedAction(confidence, warnings);

    return {
      sessionId: snapshot.sessionId,
      confidence: Math.min(100, confidence),
      reasons,
      warnings,
      snapshot,
      recommendedAction
    };
  }

  private async evaluateContractMatch(
    snapshot: ExecutionSnapshot, 
    contractFilePath: string
  ): Promise<{confidenceBonus: number, reasons: string[], warnings: string[]}> {
    const reasons: string[] = [];
    const warnings: string[] = [];
    let confidenceBonus = 0;

    try {
      // 读取当前合约内容
      const currentContract = await fs.readFile(contractFilePath, 'utf-8');
      const storedContract = snapshot.context?.contractCode;

      if (!storedContract) {
        warnings.push('会话中没有存储合约代码');
        return { confidenceBonus: 0, reasons, warnings };
      }

      // 文件路径匹配
      const currentFileName = path.basename(contractFilePath);
      if (snapshot.context?.contractName?.includes(currentFileName) || 
          snapshot.context?.contractName?.includes(path.parse(contractFilePath).name)) {
        confidenceBonus += 15;
        reasons.push('合约文件名匹配');
      }

      // 内容哈希匹配
      if (currentContract === storedContract) {
        confidenceBonus += 25;
        reasons.push('合约内容完全匹配');
      } else {
        // 检查相似度
        const similarity = this.calculateStringSimilarity(currentContract, storedContract);
        if (similarity > 0.95) {
          confidenceBonus += 20;
          reasons.push('合约内容高度相似(95%+)');
        } else if (similarity > 0.8) {
          confidenceBonus += 10;
          reasons.push('合约内容相似(80%+)');
          warnings.push('合约内容有变化，可能影响分析结果');
        } else {
          confidenceBonus += 0;
          warnings.push('合约内容差异较大，不建议恢复此会话');
        }
      }

    } catch (error) {
      warnings.push(`无法读取合约文件: ${(error as Error).message}`);
    }

    return { confidenceBonus, reasons, warnings };
  }

  private evaluateProgress(snapshot: ExecutionSnapshot): {confidenceBonus: number, reasons: string[]} {
    const reasons: string[] = [];
    let confidenceBonus = 0;

    const progress = snapshot.executionState.stepProgress;
    
    if (progress > 0.8) {
      confidenceBonus += 15;
      reasons.push('会话进度较高(80%+)，恢复价值大');
    } else if (progress > 0.5) {
      confidenceBonus += 10;
      reasons.push('会话进度中等(50%+)');
    } else if (progress > 0.2) {
      confidenceBonus += 5;
      reasons.push('会话进度较低，恢复价值有限');
    }

    // 检查特定阶段
    if (snapshot.phase === 'synthesizer') {
      confidenceBonus += 10;
      reasons.push('已进入最终综合阶段');
    } else if (snapshot.phase === 'deepener') {
      confidenceBonus += 8;
      reasons.push('已进入深化分析阶段');
    }

    return { confidenceBonus, reasons };
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    // 简单的相似度计算 - 可以使用更复杂的算法如Levenshtein距离
    const maxLen = Math.max(len1, len2);
    const minLen = Math.min(len1, len2);
    
    // 长度差异太大直接返回低相似度
    if (minLen / maxLen < 0.5) return 0;

    // 计算字符匹配度
    let matches = 0;
    const shortStr = len1 < len2 ? str1 : str2;
    const longStr = len1 >= len2 ? str1 : str2;
    
    for (let i = 0; i < shortStr.length; i++) {
      if (longStr.includes(shortStr[i])) {
        matches++;
      }
    }
    
    return matches / maxLen;
  }

  private determineRecommendedAction(confidence: number, warnings: string[]): RecommendedAction {
    if (confidence >= 80 && warnings.length === 0) {
      return 'auto_resume';
    } else if (confidence >= 60) {
      return 'prompt_resume';
    } else if (confidence >= 30) {
      return 'list_option';
    } else {
      return 'ignore';
    }
  }

  /**
   * 获取最佳恢复候选
   */
  async getBestResumeCandidate(contractFilePath?: string): Promise<InterruptedSessionMatch | null> {
    const matches = await this.detectInterruptedSessions(contractFilePath);
    
    if (matches.length === 0) return null;

    // 返回置信度最高的匹配
    const best = matches[0];
    
    // 只有当置信度足够高时才推荐自动恢复
    if (best.confidence >= 60) {
      return best;
    }

    return null;
  }

  /**
   * 格式化会话恢复信息用于用户显示
   */
  formatSessionInfo(match: InterruptedSessionMatch): string {
    const snapshot = match.snapshot;
    const progress = (snapshot.executionState.stepProgress * 100).toFixed(1);
    const timeAgo = this.formatTimeAgo(Date.now() - snapshot.metadata.lastSavedAt);
    
    return [
      `🔄 会话: ${snapshot.sessionId}`,
      `   阶段: ${snapshot.phase} (${snapshot.subPhase})`,
      `   进度: ${progress}%`,
      `   中断时间: ${timeAgo}`,
      `   置信度: ${match.confidence.toFixed(0)}%`,
      ...(match.warnings.length > 0 ? [`   ⚠️  ${match.warnings.join(', ')}`] : [])
    ].join('\n');
  }

  private formatTimeAgo(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    return `${seconds}秒前`;
  }
}

export interface InterruptedSessionMatch {
  sessionId: string;
  confidence: number;
  reasons: string[];
  warnings: string[];
  snapshot: ExecutionSnapshot;
  recommendedAction: RecommendedAction;
}

export type RecommendedAction = 'auto_resume' | 'prompt_resume' | 'list_option' | 'ignore';