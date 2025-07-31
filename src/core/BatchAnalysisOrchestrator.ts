import { InvariantDiscoveryOrchestrator } from './InvariantDiscoveryOrchestrator';
import { ProgressManager, MaterialItem } from './ProgressManager';
import { MaterialReader, MaterialContent } from './MaterialReader';
import { DiscoveryResult } from '../types';
import { createLogger } from '../utils/Logger';

export class BatchAnalysisOrchestrator {
  private progressManager: ProgressManager;
  private materialReader: MaterialReader;
  private discoveryOrchestrator: InvariantDiscoveryOrchestrator;
  private logger = createLogger('BatchOrchestrator');

  constructor(configPath: string) {
    this.progressManager = new ProgressManager(configPath);
    this.materialReader = new MaterialReader();
    this.discoveryOrchestrator = new InvariantDiscoveryOrchestrator();
  }

  public async analyzeBatch(): Promise<void> {
    this.logger.info('🚀 启动批量分析流程');
    
    // 验证所有材料路径
    const materials = this.progressManager.getAllMaterials();
    const validationErrors = MaterialReader.validateMaterialPaths(materials);
    if (validationErrors.length > 0) {
      this.logger.error('❌ 路径验证失败:');
      validationErrors.forEach(error => this.logger.error(`  - ${error}`));
      throw new Error('配置文件中存在无效路径');
    }

    // 显示进度信息
    const progress = this.progressManager.getProgress();
    this.logger.info(`📊 材料总数: ${progress.total}, 已完成: ${progress.completed} (${progress.percentage}%)`);

    if (this.progressManager.isCompleted()) {
      this.logger.info('✅ 所有材料已分析完成!');
      this.progressManager.saveAggregatedResults();
      this.progressManager.cleanup();
      return;
    }

    // 开始分析循环
    let material: MaterialItem | null;
    while ((material = this.progressManager.getNextMaterial()) !== null) {
      try {
        await this.analyzeSingleMaterial(material);
      } catch (error) {
        this.logger.error(`❌ 分析材料 ${material.id} (${material.name}) 时出错: ${error}`);
        
        // 询问是否继续或跳过
        this.logger.info('选择: 1) 跳过此材料继续 2) 停止分析');
        // 这里可以添加用户输入处理，暂时默认跳过
        this.logger.warn('⚠️ 跳过此材料，继续下一个');
        continue;
      }
    }

    this.logger.info('🎉 批量分析全部完成!');
    this.progressManager.saveAggregatedResults();
    this.progressManager.cleanup();
  }

  private async analyzeSingleMaterial(material: MaterialItem): Promise<void> {
    this.logger.info(`=== 📋 开始分析材料 ${material.id}: ${material.name} ===`);
    
    this.progressManager.markMaterialStarted(material.id);

    // 读取材料内容
    const contents: MaterialContent[] = await this.materialReader.readMaterial(material);
    
    if (contents.length === 0) {
      this.logger.warn(`⚠️ 材料 ${material.id} 没有可读取的内容`);
      return;
    }

    this.logger.info(`📁 材料包含 ${contents.length} 个文件/内容`);

    // 为每个内容进行分析
    const allResults: DiscoveryResult[] = [];
    
    for (const content of contents) {
      this.logger.info(`  🔍 分析内容: ${content.name} (${content.type})`);
      
      try {
        // 所有内容类型都使用相同的分析路径
        const result = await this.discoveryOrchestrator.discoverInvariants(content.content);
        
        // 给结果添加来源信息
        result.contract = `${material.name} - ${content.name} (${content.type})`;
        allResults.push(result);
        
        this.logger.info(`    ✅ 发现 ${result.discoveredInvariants?.length || 0} 个不变量`);
        
      } catch (error) {
        this.logger.error(`    ❌ 分析内容 ${content.name} 时出错: ${error}`);
      }
    }

    // 合并当前材料的所有结果
    const aggregatedResult = this.aggregateResults(material, allResults);
    
    this.progressManager.markMaterialCompleted(material.id, aggregatedResult);
    
    this.logger.info(`=== 🎯 完成材料 ${material.id} 分析，发现 ${aggregatedResult.discoveredInvariants?.length || 0} 个不变量 ===`);
  }


  private aggregateResults(material: MaterialItem, results: DiscoveryResult[]): DiscoveryResult {
    if (results.length === 0) {
      return {
        contract: material.name,
        discoveredInvariants: []
      };
    }

    if (results.length === 1) {
      return results[0];
    }

    // 合并多个结果
    const allInvariants = results.flatMap(r => r.discoveredInvariants || []);

    return {
      contract: material.name,
      discoveredInvariants: allInvariants
    };
  }

  public getProgress(): { completed: number; total: number; percentage: number } {
    return this.progressManager.getProgress();
  }

  public async resumeAnalysis(): Promise<void> {
    this.logger.info('恢复中断的分析...');
    await this.analyzeBatch();
  }
}