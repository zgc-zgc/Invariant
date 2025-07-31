"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchAnalysisOrchestrator = void 0;
const InvariantDiscoveryOrchestrator_1 = require("./InvariantDiscoveryOrchestrator");
const ProgressManager_1 = require("./ProgressManager");
const MaterialReader_1 = require("./MaterialReader");
const Logger_1 = require("../utils/Logger");
class BatchAnalysisOrchestrator {
    constructor(configPath) {
        this.logger = (0, Logger_1.createLogger)('BatchOrchestrator');
        this.progressManager = new ProgressManager_1.ProgressManager(configPath);
        this.materialReader = new MaterialReader_1.MaterialReader();
        this.discoveryOrchestrator = new InvariantDiscoveryOrchestrator_1.InvariantDiscoveryOrchestrator();
    }
    async analyzeBatch() {
        this.logger.info('🚀 启动批量分析流程');
        // 验证所有材料路径
        const materials = this.progressManager.getAllMaterials();
        const validationErrors = MaterialReader_1.MaterialReader.validateMaterialPaths(materials);
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
        let material;
        while ((material = this.progressManager.getNextMaterial()) !== null) {
            try {
                await this.analyzeSingleMaterial(material);
            }
            catch (error) {
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
    async analyzeSingleMaterial(material) {
        this.logger.info(`\n=== 📋 开始分析材料 ${material.id}: ${material.name} ===`);
        this.progressManager.markMaterialStarted(material.id);
        // 读取材料内容
        const contents = await this.materialReader.readMaterial(material);
        if (contents.length === 0) {
            this.logger.warn(`⚠️ 材料 ${material.id} 没有可读取的内容`);
            return;
        }
        this.logger.info(`📁 材料包含 ${contents.length} 个文件/内容`);
        // 为每个内容进行分析
        const allResults = [];
        for (const content of contents) {
            this.logger.info(`  🔍 分析内容: ${content.name} (${content.type})`);
            try {
                // 所有内容类型都使用相同的分析路径
                const result = await this.discoveryOrchestrator.discoverInvariants(content.content);
                // 给结果添加来源信息
                result.contract = `${material.name} - ${content.name} (${content.type})`;
                allResults.push(result);
                this.logger.info(`    ✅ 发现 ${result.discoveredInvariants?.length || 0} 个不变量`);
            }
            catch (error) {
                this.logger.error(`    ❌ 分析内容 ${content.name} 时出错: ${error}`);
            }
        }
        // 合并当前材料的所有结果
        const aggregatedResult = this.aggregateResults(material, allResults);
        this.progressManager.markMaterialCompleted(material.id, aggregatedResult);
        this.logger.info(`=== 🎯 完成材料 ${material.id} 分析，发现 ${aggregatedResult.discoveredInvariants?.length || 0} 个不变量 ===\n`);
    }
    aggregateResults(material, results) {
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
    getProgress() {
        return this.progressManager.getProgress();
    }
    async resumeAnalysis() {
        this.logger.info('恢复中断的分析...');
        await this.analyzeBatch();
    }
}
exports.BatchAnalysisOrchestrator = BatchAnalysisOrchestrator;
//# sourceMappingURL=BatchAnalysisOrchestrator.js.map