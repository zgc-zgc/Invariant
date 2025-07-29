import fs from 'fs';
import path from 'path';
import { DiscoveryResult, Invariant } from '../types';

export interface MaterialItem {
  id: string;
  type: 'contract' | 'document' | 'folder';
  name: string;
  path: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
}

export interface MaterialsConfig {
  projectName: string;
  description: string;
  materials: MaterialItem[];
  outputPath: string;
  resumeFrom: string | null;
  lastUpdated: string | null;
}

export interface AnalysisState {
  configPath: string;
  currentMaterialId: string | null;
  completedMaterials: string[];
  aggregatedResults: DiscoveryResult[];
  startTime: number;
  lastSaveTime: number;
}

export class ProgressManager {
  private stateFilePath: string;
  private config: MaterialsConfig;
  private state: AnalysisState;

  constructor(configPath: string) {
    this.stateFilePath = configPath.replace('.json', '.state.json');
    this.config = this.loadConfig(configPath);
    this.state = this.loadOrCreateState(configPath);
  }

  private loadConfig(configPath: string): MaterialsConfig {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    
    const configData = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configData);
  }

  private loadOrCreateState(configPath: string): AnalysisState {
    if (fs.existsSync(this.stateFilePath)) {
      console.log('发现已有进度文件，将从中断处继续...');
      const stateData = fs.readFileSync(this.stateFilePath, 'utf-8');
      return JSON.parse(stateData);
    }

    return {
      configPath,
      currentMaterialId: null,
      completedMaterials: [],
      aggregatedResults: [],
      startTime: Date.now(),
      lastSaveTime: Date.now()
    };
  }

  public saveState(): void {
    this.state.lastSaveTime = Date.now();
    fs.writeFileSync(this.stateFilePath, JSON.stringify(this.state, null, 2));
    
    // 同时更新配置文件中的进度
    this.updateConfigProgress();
  }

  private updateConfigProgress(): void {
    this.config.lastUpdated = new Date().toISOString();
    this.config.resumeFrom = this.state.currentMaterialId;
    
    // 更新各个材料的完成状态
    this.config.materials.forEach(material => {
      material.completed = this.state.completedMaterials.includes(material.id);
    });
    
    fs.writeFileSync(this.state.configPath, JSON.stringify(this.config, null, 2));
  }

  public getNextMaterial(): MaterialItem | null {
    // 如果有恢复点，从恢复点开始
    if (this.state.currentMaterialId) {
      const resumeIndex = this.config.materials.findIndex(
        m => m.id === this.state.currentMaterialId
      );
      if (resumeIndex !== -1 && resumeIndex < this.config.materials.length - 1) {
        return this.config.materials[resumeIndex + 1];
      }
    }

    // 找到第一个未完成的材料
    return this.config.materials.find(
      material => !this.state.completedMaterials.includes(material.id)
    ) || null;
  }

  public markMaterialStarted(materialId: string): void {
    this.state.currentMaterialId = materialId;
    console.log(`开始分析材料 ${materialId}`);
    this.saveState();
  }

  public markMaterialCompleted(materialId: string, result: DiscoveryResult): void {
    if (!this.state.completedMaterials.includes(materialId)) {
      this.state.completedMaterials.push(materialId);
    }
    
    this.state.aggregatedResults.push(result);
    console.log(`完成材料 ${materialId} 的分析`);
    
    this.saveState();
  }

  public saveAggregatedResults(): void {
    const outputPath = this.config.outputPath;
    const outputDir = path.dirname(outputPath);
    
    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const aggregatedReport = {
      projectName: this.config.projectName,
      description: this.config.description,
      analysisStartTime: this.state.startTime,
      analysisEndTime: Date.now(),
      totalMaterials: this.config.materials.length,
      completedMaterials: this.state.completedMaterials.length,
      materialResults: this.state.aggregatedResults.map((result, index) => ({
        materialId: this.config.materials[index]?.id || `unknown-${index}`,
        materialName: this.config.materials[index]?.name || 'Unknown',
        materialType: this.config.materials[index]?.type || 'unknown',
        analysisResult: result
      })),
      aggregatedInvariants: this.aggregateInvariants(),
      summary: this.generateSummary()
    };

    fs.writeFileSync(outputPath, JSON.stringify(aggregatedReport, null, 2));
    console.log(`聚合结果已保存到: ${outputPath}`);
  }

  private aggregateInvariants(): Invariant[] {
    const allInvariants: Invariant[] = [];
    const seenDescriptions = new Set<string>();

    for (const result of this.state.aggregatedResults) {
      for (const invariant of result.discoveredInvariants || []) {
        // 去重：基于描述的相似性
        if (!seenDescriptions.has(invariant.description)) {
          allInvariants.push(invariant);
          seenDescriptions.add(invariant.description);
        }
      }
    }

    // 返回不变量列表（移除排序逻辑）
    return allInvariants;
  }

  private generateSummary(): any {
    const totalInvariants = this.state.aggregatedResults.reduce(
      (sum, result) => sum + (result.discoveredInvariants?.length || 0), 0
    );

    return {
      totalInvariantsFound: totalInvariants,
      averageInvariantsPerMaterial: Math.round(totalInvariants / this.state.aggregatedResults.length),
      materialsAnalyzed: this.state.completedMaterials.length,
      materialsRemaining: this.config.materials.length - this.state.completedMaterials.length
    };
  }

  public getProgress(): { completed: number; total: number; percentage: number } {
    const completed = this.state.completedMaterials.length;
    const total = this.config.materials.length;
    const percentage = Math.round((completed / total) * 100);
    
    return { completed, total, percentage };
  }

  public getAllMaterials(): MaterialItem[] {
    return this.config.materials;
  }

  public isCompleted(): boolean {
    return this.state.completedMaterials.length === this.config.materials.length;
  }

  public cleanup(): void {
    // 分析完成后清理状态文件
    if (fs.existsSync(this.stateFilePath)) {
      fs.unlinkSync(this.stateFilePath);
      console.log('清理状态文件');
    }
  }
}