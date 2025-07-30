#!/usr/bin/env node

import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import { InvariantDiscoveryOrchestrator } from './core/InvariantDiscoveryOrchestrator';
import { BatchAnalysisOrchestrator } from './core/BatchAnalysisOrchestrator';
import { ConfigManager } from './config/ConfigManager';
import { Logger, LogLevel } from './utils/Logger';
import { aiLogger } from './utils/AICommunicationLogger';

const program = new Command();

program
  .name('invariantx')
  .description('InvariantX - AI-powered invariant discovery for Solidity smart contracts')
  .version('1.0.0');

program
  .command('discover')
  .description('Discover invariants in Solidity contracts')
  .argument('[contract-file]', 'Path to the Solidity contract file (optional, will use materials config if not provided)')
  .option('-c, --config <config-file>', 'Path to configuration file', './configs/default-config.json')
  .option('-m, --materials <materials-config>', 'Path to materials configuration file', './configs/materials-config.json')
  .option('-o, --output <output-file>', 'Output file for results (JSON format)')
  .option('--verbose', 'Enable verbose logging', false)
  .option('--log-ai', 'Enable AI communication logging (saves prompts and responses to file)', false)
  .action(async (contractFile: string | undefined, options) => {
    try {
      // 配置日志系统
      const logLevel = options.verbose ? LogLevel.DEBUG : LogLevel.INFO;
      const logFilePath = `./logs/invariantx-${new Date().toISOString().split('T')[0]}.log`;
      
      Logger.configure({
        level: logLevel,
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
      
      // 如果没有指定合约文件，使用材料配置文件进行批量分析
      if (!contractFile) {
        logger.info('System', '🔄 进入批量分析模式');
        
        if (!await fileExists(options.materials)) {
          logger.error('System', `❌ 找不到材料配置文件: ${options.materials}`);
          logger.info('System', '💡 请指定合约文件路径，或确保材料配置文件存在');
          process.exit(1);
        }
        
        logger.info('System', `📁 加载材料配置: ${options.materials}`);
        
        // 使用批量分析
        const batchOrchestrator = new BatchAnalysisOrchestrator(options.materials);
        await batchOrchestrator.analyzeBatch();
        
        logger.info('System', '🎉 批量分析完成!');
        return;
      }
      
      // 单个合约分析的原有逻辑
      if (!await fileExists(contractFile)) {
        logger.error('System', `❌ 找不到合约文件: ${contractFile}`);
        process.exit(1);
      }
      
      // 读取合约代码
      logger.info('System', `📄 正在加载合约: ${contractFile}`);
      const contractCode = await fs.readFile(contractFile, 'utf-8');
      
      if (options.verbose) {
        logger.info('System', `📊 合约代码长度: ${contractCode.length} 字符`);
      }
      
      // 初始化orchestrator
      const orchestrator = new InvariantDiscoveryOrchestrator();
      
      // 开始发现流程
      logger.info('System', '🚀 启动不变量发现流程');
      const result = await orchestrator.discoverInvariants(contractCode, options.config);
      
      // 输出结果
      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(result, null, 2));
        logger.info('System', `💾 结果已保存至: ${options.output}`);
      }
      
      // 控制台输出摘要
      logger.info('System', '\n=== 🎯 发现结果摘要 ===');
      logger.info('System', `合约: ${result.contract || 'Unknown'}`);
      logger.info('System', `发现的不变量总数: ${result.discoveredInvariants?.length || 0} 个`);
      
      if (options.verbose) {
        logger.info('System', '\n=== 详细结果 ===');
        const invariants = result.discoveredInvariants || [];
        invariants.forEach((inv, index) => {
          logger.info('System', `\n${index + 1}. ${inv.description}`);
        });
      }
      
      // 关闭AI通信记录
      if (options.logAi && aiLogger.isLoggingEnabled()) {
        logger.info('System', `\n📝 AI通信记录已保存到: ${aiLogger.getLogFilePath()}`);
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

program
  .command('batch')
  .description('Batch analyze multiple contracts and documents from a materials config file')
  .argument('<materials-config>', 'Path to materials configuration file')
  .option('--resume', 'Resume from interrupted analysis', false)
  .option('--verbose', 'Enable verbose logging', false)
  .option('--log-ai', 'Enable AI communication logging (saves prompts and responses to file)', false)
  .action(async (materialsConfig: string, options) => {
    try {
      const logLevel = options.verbose ? LogLevel.DEBUG : LogLevel.INFO;
      Logger.configure({ level: logLevel, showTimestamp: true, showModule: true, writeToFile: true });
      const logger = Logger.getInstance();
      
      // 启用AI通信记录（如果指定）
      if (options.logAi) {
        aiLogger.enable();
        logger.info('System', '📝 AI通信记录已启用');
      }

      logger.info('System', 'InvariantX - 批量智能合约不变量发现');
      logger.separator();
      
      // 验证材料配置文件
      if (!await fileExists(materialsConfig)) {
        logger.error('System', `错误：找不到材料配置文件 ${materialsConfig}`);
        process.exit(1);
      }
      
      logger.info('System', `正在加载材料配置: ${materialsConfig}`);
      
      // 初始化批量分析orchestrator
      const batchOrchestrator = new BatchAnalysisOrchestrator(materialsConfig);
      
      if (options.resume) {
        logger.info('System', '尝试从中断处恢复分析...');
        await batchOrchestrator.resumeAnalysis();
      } else {
        logger.info('System', '开始批量分析流程...');
        await batchOrchestrator.analyzeBatch();
      }
      
      logger.info('System', '批量分析完成！');
      
      // 关闭AI通信记录
      if (options.logAi && aiLogger.isLoggingEnabled()) {
        logger.info('System', `\n📝 AI通信记录已保存到: ${aiLogger.getLogFilePath()}`);
        aiLogger.disable();
      }
      
    } catch (error) {
      const logger = Logger.getInstance();
      logger.error('System', `批量分析失败: ${error}`);
      
      // 确保关闭AI通信记录
      if (aiLogger.isLoggingEnabled()) {
        aiLogger.disable();
      }
      
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Configure InvariantX settings')
  .option('--check', 'Check current configuration')
  .option('--init', 'Initialize configuration with example')
  .action(async (options) => {
    if (options.check) {
      const config = ConfigManager.getInstance();
      const apiConfig = config.getAPIConfig();
      console.log('当前配置:'); // Keep console.log for simple config display
      console.log(`API端点: ${apiConfig.endpoint}`);
      console.log(`模型: ${apiConfig.model}`);
      console.log(`最大重试次数: ${apiConfig.retryConfig.maxRetries}`);
    }
    
    if (options.init) {
      await initializeConfig();
    }
  });

program
  .command('prompt')
  .description('Discover invariants with custom prompts')
  .argument('<contract-file>', 'Path to the Solidity contract file')
  .argument('<prompts...>', 'Custom exploration prompts')
  .option('-o, --output <output-file>', 'Output file for results')
  .action(async (contractFile: string, prompts: string[], options) => {
    try {
      const logger = Logger.getInstance();
      logger.info('System', '开始使用自定义提示进行发现...');
      if (!await fileExists(contractFile)) {
        logger.error('System', `错误：找不到合约文件 ${contractFile}`);
        process.exit(1);
      }
      
      const contractCode = await fs.readFile(contractFile, 'utf-8');
      const orchestrator = new InvariantDiscoveryOrchestrator();
      
      logger.info('System', '自定义提示:');
      prompts.forEach((prompt, index) => {
        logger.info('System', `  ${index + 1}. ${prompt}`);
      });
      
      const result = await orchestrator.discoverWithCustomPrompts(contractCode, prompts);
      
      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(result, null, 2));
        logger.info('System', `结果已保存到: ${options.output}`);
      } else {
        logger.info('System', '\n结果:');
        logger.info('System', JSON.stringify(result, null, 2));
      }
      
    } catch (error) {
      const logger = Logger.getInstance();
      logger.error('System', `自定义发现流程失败: ${error}`);
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

async function initializeConfig(): Promise<void> {
  const exampleEnv = `# InvariantX 配置示例
# API配置 (支持任何LLM API)
API_ENDPOINT=https://api.anthropic.com/v1/messages
API_KEY=your-api-key
MODEL_NAME=claude-3-sonnet-20240229

# 错误处理配置
RETRY_ENABLED=true
MAX_RETRIES=5
RETRY_DELAY_MS=1000
HANDLE_429=true

# 收敛控制
MIN_ROUNDS=5
MAX_ROUNDS=20
`;

  const envPath = '.env';
  if (!await fileExists(envPath)) {
    await fs.writeFile(envPath, exampleEnv);
    console.log(`配置示例已创建: ${envPath}`); // Keep console.log for simple user feedback
    console.log('请根据您的需求修改配置文件');
  } else {
    console.log(`配置文件已存在: ${envPath}`);
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error); // Keep console.error for critical, unhandled errors
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason); // Keep console.error for critical, unhandled errors
  process.exit(1);
});

program.parse();