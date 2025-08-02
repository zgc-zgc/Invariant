#!/usr/bin/env node

import { Command } from 'commander';
import { InvariantDiscoveryOrchestrator } from '../core/InvariantDiscoveryOrchestrator';
import { SimpleSessionManager } from '../core/SimpleSessionManager';
import { Logger, LogLevel } from '../utils/Logger';

const recoveryProgram = new Command();

recoveryProgram
  .name('invariantx-recovery')
  .description('InvariantX Recovery Management Tools')
  .version('1.0.0');

// 显示恢复点状态
recoveryProgram
  .command('status')
  .description('Show recovery point status')
  .action(async () => {
    Logger.configure({
      level: LogLevel.INFO,
      showTimestamp: true,
      showModule: true,
      writeToFile: false
    });
    
    const logger = Logger.getInstance();
    const sessionManager = SimpleSessionManager.getInstance();
    
    try {
      logger.info('Recovery', '=== 恢复点状态 ===');
      
      const recoveryDetails = await sessionManager.getRecoveryPointDetails();
      
      if (recoveryDetails) {
        logger.info('Recovery', '✅ 发现API失败恢复点:');
        logger.info('Recovery', `   会话ID: ${recoveryDetails.sessionId}`);
        logger.info('Recovery', `   失败阶段: ${recoveryDetails.phase} - ${recoveryDetails.agentRole}代理`);
        logger.info('Recovery', `   创建时间: ${new Date(recoveryDetails.snapshot.timestamp).toLocaleString()}`);
        logger.info('Recovery', `   错误状态: ${recoveryDetails.errorInfo.status}`);
        logger.info('Recovery', `   错误次数: ${recoveryDetails.errorInfo.errorCount}`);
        logger.info('Recovery', `   下一步骤: ${recoveryDetails.errorInfo.nextStep}`);
        
        if (recoveryDetails.failedPrompt) {
          const preview = recoveryDetails.failedPrompt.length > 200 
            ? recoveryDetails.failedPrompt.substring(0, 200) + '...'
            : recoveryDetails.failedPrompt;
          logger.info('Recovery', `   失败提示词: ${preview}`);
        }
      } else {
        logger.info('Recovery', '🔍 未发现API失败恢复点');
      }
    } catch (error) {
      logger.error('Recovery', `检查恢复点状态失败: ${error}`);
      process.exit(1);
    }
  });

// 清理恢复点
recoveryProgram
  .command('clear')
  .description('Clear recovery point')
  .action(async () => {
    Logger.configure({
      level: LogLevel.INFO,
      showTimestamp: true,
      showModule: true,
      writeToFile: false
    });
    
    const logger = Logger.getInstance();
    const sessionManager = SimpleSessionManager.getInstance();
    
    try {
      await sessionManager.clearRecoveryPoint();
      logger.info('Recovery', '✅ 恢复点已清理');
    } catch (error) {
      logger.error('Recovery', `清理恢复点失败: ${error}`);
      process.exit(1);
    }
  });

// 系统状态
recoveryProgram
  .command('system')
  .description('Show system status')
  .action(async () => {
    Logger.configure({
      level: LogLevel.INFO,
      showTimestamp: true,
      showModule: true,
      writeToFile: false
    });
    
    const logger = Logger.getInstance();
    
    try {
      const orchestrator = new InvariantDiscoveryOrchestrator();
      const status = orchestrator.getSystemStatus();
      
      logger.info('System', '=== 系统状态 ===');
      logger.info('System', `当前会话: ${status.currentSession || '无'}`);
      logger.info('System', '=== API统计 ===');
      logger.info('System', `总调用次数: ${status.apiManager.totalCalls}`);
      logger.info('System', `成功调用: ${status.apiManager.successfulCalls}`);
      logger.info('System', `失败调用: ${status.apiManager.failedCalls}`);
      logger.info('System', `平均响应时间: ${status.apiManager.averageResponseTime.toFixed(2)}ms`);
      logger.info('System', `方法使用: fetch=${status.apiManager.methodUsage.fetch}, axios=${status.apiManager.methodUsage.axios}`);
    } catch (error) {
      logger.error('System', `获取系统状态失败: ${error}`);
      process.exit(1);
    }
  });

export { recoveryProgram };