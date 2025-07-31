"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicConfigLoader = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class DynamicConfigLoader {
    constructor(configPaths = ['./configs/default-config.json']) {
        this.config = {};
        this.loadConfigs(configPaths);
    }
    loadConfigs(configPaths) {
        for (const configPath of configPaths) {
            try {
                const fullPath = path_1.default.resolve(configPath);
                const configData = JSON.parse(fs_1.default.readFileSync(fullPath, 'utf8'));
                // 合并配置，后加载的覆盖先加载的
                Object.assign(this.config, configData);
            }
            catch (error) {
                console.warn(`Failed to load config from ${configPath}:`, error);
            }
        }
    }
    // 动态获取所有配置类别
    getConfigCategories() {
        return Object.keys(this.config).filter(key => key !== 'description');
    }
    // 动态处理任意键值对结构
    async generateExplorationTasks(contractInfo) {
        const tasks = [];
        // 遍历JSON中的所有键
        for (const [categoryKey, categoryValue] of Object.entries(this.config)) {
            if (categoryKey === 'description')
                continue;
            const task = await this.createExplorationTask(categoryKey, categoryValue, contractInfo);
            if (task) {
                tasks.push(task);
            }
        }
        return tasks;
    }
    async createExplorationTask(key, value, contractInfo) {
        // 处理直接的prompt数组
        if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
            return {
                category: key,
                prompts: value,
                priority: 'normal'
            };
        }
        // 处理模板化的prompt（包含{variable}等占位符）
        if (Array.isArray(value)) {
            return {
                category: key,
                prompts: this.expandTemplatedPrompts(value, contractInfo),
                priority: 'normal'
            };
        }
        // 处理函数模式匹配
        if (typeof value === 'object' && value['匹配函数'] && value['探索提示']) {
            const matchingFunctions = this.findMatchingFunctions(value['匹配函数'], contractInfo);
            if (matchingFunctions.length > 0) {
                return {
                    category: key,
                    prompts: value['探索提示'],
                    priority: 'high', // 匹配到的模式优先级更高
                    context: { matchingFunctions }
                };
            }
        }
        return null;
    }
    // 展开模板化提示
    expandTemplatedPrompts(prompts, contractInfo) {
        const expandedPrompts = [];
        for (const promptTemplate of prompts) {
            if (promptTemplate.includes('{variable}')) {
                // 为每个状态变量生成提示
                for (const variable of contractInfo.stateVariables) {
                    const expandedPrompt = promptTemplate.replace(/\{variable\}/g, variable.name);
                    expandedPrompts.push(expandedPrompt);
                }
            }
            else {
                expandedPrompts.push(promptTemplate);
            }
        }
        return expandedPrompts;
    }
    // 查找匹配的函数
    findMatchingFunctions(patterns, contractInfo) {
        const matchingFunctions = [];
        for (const pattern of patterns) {
            for (const func of contractInfo.functions) {
                if (func.name.toLowerCase().includes(pattern.toLowerCase())) {
                    matchingFunctions.push(func.name);
                }
            }
        }
        return matchingFunctions;
    }
    // 添加新的配置
    addCustomConfig(category, prompts) {
        this.config[category] = prompts;
    }
    // 获取特定类别的配置
    getCategoryConfig(category) {
        return this.config[category];
    }
}
exports.DynamicConfigLoader = DynamicConfigLoader;
//# sourceMappingURL=DynamicConfigLoader.js.map