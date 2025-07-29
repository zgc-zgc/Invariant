#!/usr/bin/env node

import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import { InvariantDiscoveryOrchestrator } from './core/InvariantDiscoveryOrchestrator';
import { BatchAnalysisOrchestrator } from './core/BatchAnalysisOrchestrator';
import { ConfigManager } from './config/ConfigManager';

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
  .action(async (contractFile: string | undefined, options) => {
    try {
      console.log('InvariantX - 智能合约不变量发现系统');
      console.log('=====================================');
      
      // 如果没有指定合约文件，使用材料配置文件进行批量分析
      if (!contractFile) {
        console.log('未指定合约文件，将从材料配置文件进行批量分析...');
        
        if (!await fileExists(options.materials)) {
          console.error(`错误：找不到材料配置文件 ${options.materials}`);
          console.log('提示：请指定合约文件路径，或确保材料配置文件存在');
          process.exit(1);
        }
        
        console.log(`正在加载材料配置: ${options.materials}`);
        
        // 使用批量分析
        const batchOrchestrator = new BatchAnalysisOrchestrator(options.materials);
        await batchOrchestrator.analyzeBatch();
        
        console.log('批量分析完成！');
        return;
      }
      
      // 单个合约分析的原有逻辑
      if (!await fileExists(contractFile)) {
        console.error(`错误：找不到合约文件 ${contractFile}`);
        process.exit(1);
      }
      
      // 读取合约代码
      console.log(`正在加载合约文件: ${contractFile}`);
      const contractCode = await fs.readFile(contractFile, 'utf-8');
      
      if (options.verbose) {
        console.log(`合约代码长度: ${contractCode.length} 字符`);
      }
      
      // 初始化orchestrator
      const orchestrator = new InvariantDiscoveryOrchestrator();
      
      // 开始发现流程
      console.log('开始Invariant发现流程...');
      const result = await orchestrator.discoverInvariants(contractCode, options.config);
      
      // 输出结果
      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(result, null, 2));
        console.log(`结果已保存到: ${options.output}`);
      }
      
      // 控制台输出摘要
      console.log('\n=== 发现结果摘要 ===');
      console.log(`合约: ${result.contract || 'Unknown'}`);
      console.log(`发现的不变量总数: ${result.discoveredInvariants?.length || 0}`);
      
      if (options.verbose) {
        console.log('\n=== 详细结果 ===');
        const invariants = result.discoveredInvariants || [];
        invariants.forEach((inv, index) => {
          console.log(`\n${index + 1}. ${inv.description}`);
        });
      }
      
    } catch (error) {
      console.error('发现流程失败:', error);
      process.exit(1);
    }
  });

program
  .command('batch')
  .description('Batch analyze multiple contracts and documents from a materials config file')
  .argument('<materials-config>', 'Path to materials configuration file')
  .option('--resume', 'Resume from interrupted analysis', false)
  .option('--verbose', 'Enable verbose logging', false)
  .action(async (materialsConfig: string, options) => {
    try {
      console.log('InvariantX - 批量智能合约不变量发现');
      console.log('=====================================');
      
      // 验证材料配置文件
      if (!await fileExists(materialsConfig)) {
        console.error(`错误：找不到材料配置文件 ${materialsConfig}`);
        process.exit(1);
      }
      
      console.log(`正在加载材料配置: ${materialsConfig}`);
      
      // 初始化批量分析orchestrator
      const batchOrchestrator = new BatchAnalysisOrchestrator(materialsConfig);
      
      if (options.resume) {
        console.log('尝试从中断处恢复分析...');
        await batchOrchestrator.resumeAnalysis();
      } else {
        console.log('开始批量分析流程...');
        await batchOrchestrator.analyzeBatch();
      }
      
      console.log('批量分析完成！');
      
    } catch (error) {
      console.error('批量分析失败:', error);
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
      console.log('当前配置:');
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
      if (!await fileExists(contractFile)) {
        console.error(`错误：找不到合约文件 ${contractFile}`);
        process.exit(1);
      }
      
      const contractCode = await fs.readFile(contractFile, 'utf-8');
      const orchestrator = new InvariantDiscoveryOrchestrator();
      
      console.log('使用自定义提示进行发现...');
      console.log('自定义提示:');
      prompts.forEach((prompt, index) => {
        console.log(`  ${index + 1}. ${prompt}`);
      });
      
      const result = await orchestrator.discoverWithCustomPrompts(contractCode, prompts);
      
      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(result, null, 2));
        console.log(`结果已保存到: ${options.output}`);
      } else {
        console.log('\n结果:');
        console.log(JSON.stringify(result, null, 2));
      }
      
    } catch (error) {
      console.error('自定义发现流程失败:', error);
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
    console.log(`配置示例已创建: ${envPath}`);
    console.log('请根据您的需求修改配置文件');
  } else {
    console.log(`配置文件已存在: ${envPath}`);
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
  process.exit(1);
});

program.parse();