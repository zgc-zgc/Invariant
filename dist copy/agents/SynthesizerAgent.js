"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SynthesizerAgent = void 0;
const BaseAgent_1 = require("./BaseAgent");
const fs_1 = require("fs");
const path = __importStar(require("path"));
class SynthesizerAgent extends BaseAgent_1.BaseAgent {
    constructor(apiManager) {
        super(apiManager, 'Synthesizer');
    }
    async identifyCore(messages, contractCode) {
        const discoveries = messages.filter(m => m.messageType === 'discovery');
        const assessments = messages.filter(m => m.messageType === 'assessment');
        const prompt = `
Please identify the most core invariants & rules from the following findings:

Discovered invariants&rules:
${discoveries.map((d, i) => `${i + 1}. ${d.content.description}\n   Reasoning:${d.content.reasoning}`).join('\n\n')}

Value assessments:
${assessments.map((a, i) => `${i + 1}. ${a.content.description}\n   Analysis:${a.content.reasoning}`).join('\n\n')}

Please identify invariants & rules. These should be:
1. Of high importance.
2. Foundational, meaning other invariants may depend on them.
3. Of high level aspect.

Output format:
{
  "coreInvariants": [
    {
      "description": "Core invariant description"
    }
  ],
  "coreRules":[
    {
      "description":"Core rule description"
    }
  ]
}
`;
        const response = await this.callAI(prompt);
        return this.parseCoreInvariants(response);
    }
    async finalSynthesize(data) {
        const allDiscoveries = data.explorerFindings
            .filter(m => m.messageType === 'discovery');
        const prerequisiteMap = this.extractPrerequisiteMap(data.prerequisiteAnalysis);
        const prompt = `
PLEASE SUMMARIZE INVARIANTS AND THEIR PRECONDITIONS (SIMILAR TO requireInvariant IN CVL):

# DISCOVERED INVARIANTS
${allDiscoveries.map((msg, i) => `${i + 1}. ${msg.content.description} (${msg.discovery?.category || 'UNCATEGORIZED'})`).join('\n')}

# PRECONDITION ANALYSIS
${data.prerequisiteAnalysis.filter(m => m.messageType === 'discovery').map((d, i) => `${i + 1}. ${d.content.description}`).join('\n')}

PLEASE PROVIDE:
1. FINAL INVARIANT LIST (DEDUPLICATED, MERGED SIMILAR ITEMS)
2. PRECONDITIONS FOR EACH INVARIANT (requireInvariant)
3. DEPENDENCY GRAPH BETWEEN INVARIANTS
4. CLASSIFICATION OF BASE INVARIANTS (NO PRECONDITIONS) VS DERIVED INVARIANTS (WITH PRECONDITIONS)

# CONTRACT CODE
\`\`\`solidity
{CONTRACT_CODE}
\`\`\`
`.replace('{CONTRACT_CODE}', data.contractCode || '');
        const response = await this.callAI(prompt);
        // 解析响应并构建最终结果
        return this.buildFinalResult(allDiscoveries, prerequisiteMap, response);
    }
    extractPrerequisiteMap(prerequisiteAnalysis) {
        const map = new Map();
        // 从前置条件分析消息中提取不变量和其前置条件的映射
        prerequisiteAnalysis
            .filter(m => m.messageType === 'discovery')
            .forEach(msg => {
            // 这里需要根据实际的消息格式解析前置条件
            // 暂时返回空映射，实际实现需要解析AI的响应
        });
        return map;
    }
    buildFinalResult(allDiscoveries, prerequisiteMap, response) {
        // 从 discoveries 创建 Invariant 对象
        const invariants = allDiscoveries.map(msg => ({
            description: msg.content.description,
            type: 'invariant',
            relatedFunctions: msg.discovery?.relatedElements.functions
        }));
        try {
            const parsed = JSON.parse(this.extractJSON(response));
            return {
                invariants: parsed.invariants || invariants,
                discoveredInvariants: parsed.invariants || invariants,
                discussionSummary: parsed.summary || '不变量发现和前置条件分析完成',
                metadata: {
                    explorerMessages: allDiscoveries.length,
                    deepenerMessages: prerequisiteMap.size,
                    executionStages: ['Explorer Challenge', 'Deepener Prerequisite Analysis', 'Final Synthesis']
                }
            };
        }
        catch (error) {
            // 如果解析失败，返回基本结果
            return {
                invariants: invariants,
                discoveredInvariants: invariants,
                discussionSummary: '不变量发现和前置条件分析完成',
                metadata: {
                    explorerMessages: allDiscoveries.length,
                    deepenerMessages: 0,
                    executionStages: ['Explorer Challenge', 'Deepener Prerequisite Analysis', 'Final Synthesis']
                }
            };
        }
    }
    parseCoreInvariants(response) {
        try {
            const parsed = JSON.parse(this.extractJSON(response));
            const invariants = (parsed.coreInvariants || []).map((inv) => ({
                description: inv.description,
                type: 'invariant'
            }));
            const rules = (parsed.coreRules || []).map((rule) => ({
                description: rule.description,
                type: 'rule'
            }));
            return [...invariants, ...rules];
        }
        catch (error) {
            console.warn('Failed to parse core invariants response');
            return [];
        }
    }
    async saveFailedParseResult(response, error) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `synthesizer-failed-parse-${timestamp}.json`;
        const filepath = path.join('./results', 'failed-parses', filename);
        // 确保目录存在
        await fs_1.promises.mkdir(path.dirname(filepath), { recursive: true });
        // 保存失败的响应
        const data = {
            timestamp: new Date().toISOString(),
            error: error.toString(),
            originalResponse: response,
            extractedJSON: this.extractJSON(response)
        };
        await fs_1.promises.writeFile(filepath, JSON.stringify(data, null, 2));
        this.logger.warn(`Failed parse result saved to: ${filepath}`);
        return filepath;
    }
    parseFinalResult(response) {
        try {
            const jsonStr = this.extractJSON(response);
            const parsed = JSON.parse(jsonStr);
            this.logger.debug(`Parsed JSON structure: ${Object.keys(parsed).join(', ')}`);
            // 尝试多种可能的字段名
            const invariantFields = ['不变量', 'invariants', 'finalInvariants', 'discoveries'];
            const ruleFields = ['规则', 'rules', 'constraints'];
            let invariants = [];
            let rules = [];
            // 查找不变量
            for (const field of invariantFields) {
                if (parsed[field] && Array.isArray(parsed[field])) {
                    invariants = parsed[field].map((inv) => ({
                        description: inv['描述'] || inv.description || inv.content || inv,
                        type: 'invariant'
                    }));
                    this.logger.info(`Found ${invariants.length} invariants in field: ${field}`);
                    break;
                }
            }
            // 查找规则
            for (const field of ruleFields) {
                if (parsed[field] && Array.isArray(parsed[field])) {
                    rules = parsed[field].map((rule) => ({
                        description: rule['描述'] || rule.description || rule.content || rule,
                        type: 'rule'
                    }));
                    this.logger.info(`Found ${rules.length} rules in field: ${field}`);
                    break;
                }
            }
            const allInvariants = [...invariants, ...rules];
            // 如果没有找到任何结果，尝试直接解析整个对象
            if (allInvariants.length === 0) {
                this.logger.warn('No invariants found in standard fields, attempting deep search');
                // 递归搜索对象中的数组
                const arrays = this.findArraysInObject(parsed);
                for (const arr of arrays) {
                    if (arr.length > 0 && this.looksLikeInvariant(arr[0])) {
                        allInvariants.push(...arr.map((item) => ({
                            description: this.extractDescription(item),
                            type: 'unknown'
                        })));
                    }
                }
            }
            this.logger.info(`Total invariants found: ${allInvariants.length}`);
            return {
                contract: 'AnalyzedContract',
                discoveredInvariants: allInvariants
            };
        }
        catch (error) {
            this.logger.error(`Failed to parse synthesis response: ${error}`);
            // 保存失败的解析结果
            this.saveFailedParseResult(response, error).catch(err => this.logger.error(`Failed to save parse error: ${err}`));
            // 返回原始响应作为单个不变量
            return {
                contract: 'AnalyzedContract',
                discoveredInvariants: [{
                        description: response,
                        type: 'raw_response'
                    }]
            };
        }
    }
    findArraysInObject(obj, arrays = []) {
        if (Array.isArray(obj)) {
            arrays.push(obj);
        }
        else if (obj && typeof obj === 'object') {
            for (const key in obj) {
                this.findArraysInObject(obj[key], arrays);
            }
        }
        return arrays;
    }
    looksLikeInvariant(item) {
        if (typeof item === 'string')
            return true;
        if (item && typeof item === 'object') {
            return item.hasOwnProperty('description') ||
                item.hasOwnProperty('描述') ||
                item.hasOwnProperty('content') ||
                item.hasOwnProperty('text');
        }
        return false;
    }
    extractDescription(item) {
        if (typeof item === 'string')
            return item;
        return item['描述'] || item.description || item.content || item.text || JSON.stringify(item);
    }
    extractJSON(response) {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        return jsonMatch ? jsonMatch[0] : response;
    }
}
exports.SynthesizerAgent = SynthesizerAgent;
//# sourceMappingURL=SynthesizerAgent.js.map