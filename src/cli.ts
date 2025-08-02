#!/usr/bin/env node

import { Command } from 'commander';
import { promises as fs } from 'fs';
import { InvariantDiscoveryOrchestrator } from './core/InvariantDiscoveryOrchestrator';
import { BatchAnalysisOrchestrator } from './core/BatchAnalysisOrchestrator';
import { Logger, LogLevel } from './utils/Logger';
import { aiLogger } from './utils/AICommunicationLogger';
import { SimpleSessionManager } from './core/SimpleSessionManager';

const program = new Command();

program
  .name('invariantx')
  .description('InvariantX - AI-powered invariant discovery for Solidity smart contracts')
  .version('1.0.0')
  .argument('[contract-file]', 'Path to the Solidity contract file (optional, will use materials config if not provided)')
  .option('--log-ai', 'Enable AI communication logging (saves prompts and responses to file)', false)
  .option('--new', 'Force start new analysis, ignore any interrupted sessions', false)
  .action(async (contractFile: string | undefined, options) => {
    try {
      // 配置日志系统 - 固定配置，简化操作
      const logFilePath = `./logs/invariantx-${new Date().toISOString().split('T')[0]}.log`;
      
      Logger.configure({
        level: LogLevel.INFO,
        showTimestamp: true,
        showModule: true,
        writeToFile: true,
        logFilePath: logFilePath
      });
      
      const logger = Logger.getInstance();
      
      // 启用AI通信记录（如果指定）
      if (options.logAi) {
        aiLogger.enable();
        logger.info('System', '📝 AI通信记录已启用');
      }
      
      logger.info('System', 'InvariantX - 智能合约不变量发现系统');
      logger.separator();
      
      // 固定材料配置文件路径
      const materialsConfig = './configs/materials-config.json';
      
      // 简单会话管理器
      const sessionManager = SimpleSessionManager.getInstance();
      
      // 智能会话检测器（除非强制新建）
      let resumeSessionId: string | undefined;
      
      if (!options.new) {
        // 检查API失败恢复点
        logger.info('System', '🔍 检查是否有API失败恢复点...');
        const recoveryDetails = await sessionManager.getRecoveryPointDetails();
        
        if (recoveryDetails && recoveryDetails.errorInfo.status === 'failed') {
          logger.info('System', '⚠️  检测到API失败恢复点:');
          logger.info('System', `   失败阶段: ${recoveryDetails.phase} - ${recoveryDetails.agentRole}代理`);
          logger.info('System', `   会话ID: ${recoveryDetails.sessionId}`);
          logger.info('System', `   错误次数: ${recoveryDetails.errorInfo.errorCount}`);
          logger.info('System', `   下一步骤: ${recoveryDetails.errorInfo.nextStep}`);
          
          if (recoveryDetails.failedPrompt) {
            const promptPreview = recoveryDetails.failedPrompt.length > 100 
              ? recoveryDetails.failedPrompt.substring(0, 100) + '...'
              : recoveryDetails.failedPrompt;
            logger.info('System', `   失败提示词: ${promptPreview}`);
          }
          
          logger.info('System', '🔄 系统将从API失败处重试');
          resumeSessionId = recoveryDetails.sessionId;
        } else {
          logger.info('System', '✅ 未发现API失败恢复点');
        }
        
        // 验证合约文件（如果指定了）
        if (contractFile && !await fileExists(contractFile)) {
          logger.error('System', `❌ 找不到合约文件: ${contractFile}`);
          process.exit(1);
        }
        
        // 如果没有指定合约文件，检查材料配置
        if (!contractFile) {
          if (!await fileExists(materialsConfig)) {
            logger.error('System', `❌ 找不到材料配置文件: ${materialsConfig}`);
            logger.info('System', '💡 请指定合约文件路径，或确保材料配置文件存在');
            process.exit(1);
          }
          
          // 不在这里执行批量分析，统一在后面的执行部分处理
        }
      } else {
        logger.info('System', '🆕 强制开始新分析（忽略API失败恢复点）');
        
        // 清理恢复点文件
        await sessionManager.clearRecoveryPoint();
        
        // 清理进度状态文件（对于批量分析）
        const stateFilePath = materialsConfig.replace('.json', '.state.json');
        try {
          await fs.unlink(stateFilePath);
          logger.info('System', '📝 已清理进度状态文件');
        } catch (error) {
          // 文件不存在是正常的，忽略错误
        }
        
        // 验证合约文件（如果指定了）
        if (contractFile && !await fileExists(contractFile)) {
          logger.error('System', `❌ 找不到合约文件: ${contractFile}`);
          process.exit(1);
        }
        
        // 如果没有指定合约文件但使用了--new，也需要检查材料配置
        if (!contractFile && !await fileExists(materialsConfig)) {
          logger.error('System', `❌ 找不到材料配置文件: ${materialsConfig}`);
          logger.info('System', '💡 请指定合约文件路径，或确保材料配置文件存在');
          process.exit(1);
        }
      }
      
      // 执行分析
      if (!contractFile) {
        // 批量分析
        logger.info('System', `📁 加载材料配置: ${materialsConfig}`);
        
        // 如果使用--new参数，需要额外清理ProgressManager的状态文件
        if (options.new) {
          const stateFilePath = materialsConfig.replace('.json', '.state.json');
          try {
            await fs.unlink(stateFilePath);
            logger.info('System', '📝 已清理批量分析进度状态文件');
          } catch (error) {
            // 文件不存在是正常的，忽略错误
          }
        }
        
        const batchOrchestrator = new BatchAnalysisOrchestrator(materialsConfig);
        await batchOrchestrator.analyzeBatch();
        logger.info('System', '🎉 批量分析完成!');
      } else {
        // 单个合约分析
        logger.info('System', `📄 正在加载合约: ${contractFile}`);
        const contractCode = await fs.readFile(contractFile, 'utf-8');
        logger.info('System', `📊 合约代码长度: ${contractCode.length} 字符`);
        
        // 初始化orchestrator
        const orchestrator = new InvariantDiscoveryOrchestrator();
        
        // 开始发现流程（可能是恢复）
        if (resumeSessionId) {
          logger.info('System', '🔄 从中断处恢复分析流程');
        } else {
          logger.info('System', '🚀 启动全新的不变量发现流程');
        }
        
        const result = await orchestrator.discoverInvariants(contractCode, './configs/default-config.json', resumeSessionId);
        
        // 控制台输出摘要
        logger.info('System', '=== 🎯 发现结果摘要 ===');
        logger.info('System', `合约: ${result.contract || 'Unknown'}`);
        logger.info('System', `发现的不变量总数: ${result.discoveredInvariants?.length || 0} 个`);
        
        logger.info('System', '=== 详细结果 ===');
        const invariants = result.discoveredInvariants || [];
        invariants.forEach((inv, index) => {
          logger.info('System', `${index + 1}. ${inv.description}`);
          if (inv.preconditions && inv.preconditions.length > 0) {
            logger.info('System', `   前置条件: ${inv.preconditions.join(', ')}`);
          }
        });
      }
      
      // 关闭AI通信记录
      if (options.logAi && aiLogger.isLoggingEnabled()) {
        logger.info('System', `📝 AI通信记录已保存到: ${aiLogger.getLogFilePath()}`);
        aiLogger.disable();
      }
      
    } catch (error) {
      const logger = Logger.getInstance();
      logger.error('System', `❌ 分析过程出错: ${error}`);
      
      // 确保关闭AI通信记录
      if (aiLogger.isLoggingEnabled()) {
        aiLogger.disable();
      }
      
      process.exit(1);
    }
  });

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, _promise) => {
  console.error('未处理的Promise拒绝:', reason);
  process.exit(1);
});

program.parse();