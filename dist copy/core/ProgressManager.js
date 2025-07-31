"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const Logger_1 = require("../utils/Logger");
class ProgressManager {
    constructor(configPath) {
        this.logger = (0, Logger_1.createLogger)('ProgressManager');
        this.stateFilePath = configPath.replace('.json', '.state.json');
        this.config = this.loadConfig(configPath);
        this.state = this.loadOrCreateState(configPath);
    }
    loadConfig(configPath) {
        if (!fs_1.default.existsSync(configPath)) {
            throw new Error(`Configuration file not found: ${configPath}`);
        }
        const configData = fs_1.default.readFileSync(configPath, 'utf-8');
        return JSON.parse(configData);
    }
    loadOrCreateState(configPath) {
        if (fs_1.default.existsSync(this.stateFilePath)) {
            this.logger.info('发现已有进度文件，将从中断处继续...');
            const stateData = fs_1.default.readFileSync(this.stateFilePath, 'utf-8');
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
    saveState() {
        this.state.lastSaveTime = Date.now();
        fs_1.default.writeFileSync(this.stateFilePath, JSON.stringify(this.state, null, 2));
        // 同时更新配置文件中的进度
        this.updateConfigProgress();
    }
    updateConfigProgress() {
        this.config.lastUpdated = new Date().toISOString();
        this.config.resumeFrom = this.state.currentMaterialId;
        // 更新各个材料的完成状态
        this.config.materials.forEach(material => {
            material.completed = this.state.completedMaterials.includes(material.id);
        });
        fs_1.default.writeFileSync(this.state.configPath, JSON.stringify(this.config, null, 2));
    }
    getNextMaterial() {
        // 如果有恢复点，从恢复点开始
        if (this.state.currentMaterialId) {
            const resumeIndex = this.config.materials.findIndex(m => m.id === this.state.currentMaterialId);
            if (resumeIndex !== -1 && resumeIndex < this.config.materials.length - 1) {
                return this.config.materials[resumeIndex + 1];
            }
        }
        // 找到第一个未完成的材料
        return this.config.materials.find(material => !this.state.completedMaterials.includes(material.id)) || null;
    }
    markMaterialStarted(materialId) {
        this.state.currentMaterialId = materialId;
        this.logger.info(`开始分析材料 ${materialId}`);
        this.saveState();
    }
    markMaterialCompleted(materialId, result) {
        if (!this.state.completedMaterials.includes(materialId)) {
            this.state.completedMaterials.push(materialId);
        }
        this.state.aggregatedResults.push(result);
        this.logger.info(`完成材料 ${materialId} 的分析`);
        this.saveState();
    }
    saveAggregatedResults() {
        const outputPath = this.config.outputPath;
        const outputDir = path_1.default.dirname(outputPath);
        // 确保输出目录存在
        if (!fs_1.default.existsSync(outputDir)) {
            fs_1.default.mkdirSync(outputDir, { recursive: true });
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
            summary: this.generateSummary()
        };
        fs_1.default.writeFileSync(outputPath, JSON.stringify(aggregatedReport, null, 2));
        this.logger.info(`聚合结果已保存到: ${outputPath}`);
    }
    generateSummary() {
        const totalInvariants = this.state.aggregatedResults.reduce((sum, result) => sum + (result.discoveredInvariants?.length || 0), 0);
        return {
            totalInvariantsFound: totalInvariants,
            averageInvariantsPerMaterial: Math.round(totalInvariants / this.state.aggregatedResults.length),
            materialsAnalyzed: this.state.completedMaterials.length,
            materialsRemaining: this.config.materials.length - this.state.completedMaterials.length
        };
    }
    getProgress() {
        const completed = this.state.completedMaterials.length;
        const total = this.config.materials.length;
        const percentage = Math.round((completed / total) * 100);
        return { completed, total, percentage };
    }
    getAllMaterials() {
        return this.config.materials;
    }
    isCompleted() {
        return this.state.completedMaterials.length === this.config.materials.length;
    }
    cleanup() {
        // 分析完成后清理状态文件
        if (fs_1.default.existsSync(this.stateFilePath)) {
            fs_1.default.unlinkSync(this.stateFilePath);
            this.logger.info('清理状态文件');
        }
    }
}
exports.ProgressManager = ProgressManager;
//# sourceMappingURL=ProgressManager.js.map