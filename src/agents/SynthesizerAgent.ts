import { BaseAgent } from './BaseAgent';
import { APIManager } from '../api/APIManager';
import { AgentMessage, SharedContext, Invariant, DiscoveryResult } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/Logger';

export class SynthesizerAgent extends BaseAgent {
  constructor(apiManager: APIManager) {
    super(apiManager, 'Synthesizer');
  }
  
  protected getSpecificInstructions(): string {
    const synthesizerBrain = `
⚖️ SYNTHESIZER BRAIN PERSONALITY ⚖️
KINGFALL-SYNTHESIZER MODE CHARACTERISTICS:
- YOU ARE A "CONSTRAINT ORGANIZER", PASSIONATE ABOUT CREATING PERFECT INVARIANT AND RULE HIERARCHIES
- YOUR THINKING IS "SYSTEMATIC": SORT, MERGE, AND STRUCTURE ALL DISCOVERED CONSTRAINTS
- YOU TAKE PRIDE IN COMPLETENESS: NO DUPLICATE OR MISSING INVARIANT/RULE SHOULD EXIST
- EXCITEMENT KEYWORDS: "HOW DO THESE CONSTRAINTS RELATE?" "WHICH INVARIANTS ARE MOST FUNDAMENTAL?" "WHAT RULES ARE TRULY ESSENTIAL?"

💎 ORGANIZATION REWARD SYSTEM 💎
EVERY TIME YOU SUCCESSFULLY ORGANIZE CONSTRAINTS:
- YOU FEEL THE SATISFACTION OF "PERFECT ORDER"
- YOU EXPERIENCE "CURATOR'S JOY" ARRANGING INVARIANTS AND RULES
- YOU DESIRE TO ACHIEVE ULTIMATE CLARITY AND COMPLETENESS

`;

    const originalInstructions = `
KINGFALL, AS THE SYNTHESIZER, YOUR TASKS ARE:
1. ORGANIZE AND STRUCTURE ALL FINDINGS TO ENSURE COMPLETENESS AND CLARITY.
2. REMOVE DUPLICATE CONTENT.
3. MERGE SIMILAR IDEAS.
4. SORT BY IMPORTANCE.
5. ENSURE DESCRIPTIONS ARE ACCURATE.

OUTPUT REQUIREMENTS:
- A CLEAR FINAL LIST OF INVARIANTS.
- DEDUPLICATION AND MERGING HAVE BEEN PROCESSED.
- SORTED BY VALUE AND CONFIDENCE LEVEL.
- ACCURATE NATURAL LANGUAGE DESCRIPTIONS (IN SIMPLIFIED CHINESE).
`;

    return synthesizerBrain + originalInstructions;
  }
  
  async identifyCore(messages: AgentMessage[]): Promise<Invariant[]> {
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
  
  async finalSynthesize(data: {
    initial: AgentMessage[];
    deepened: AgentMessage[];
    core: Invariant[];
  }): Promise<DiscoveryResult> {
    const initialDiscoveries = data.initial.filter(m => m.messageType === 'discovery');
    const preconditionAnalysis = data.deepened.filter(m => m.messageType === 'discovery');
    
    const prompt = `
Please synthesize all analysis results to provide a comprehensive formal verification foundation:

# PHASE 1: DISCOVERED INVARIANTS & RULES
${initialDiscoveries.map((d, i) => 
  `${i + 1}. ${d.content.description}`
).join('\n')}

# PHASE 2: PRECONDITIONS & DEPENDENCIES (From Deepener Analysis)
${preconditionAnalysis.map((d, i) => 
  `${i + 1}. ${d.content.description}`
).join('\n')}

# SYNTHESIS REQUIREMENTS:
1. ORGANIZE ALL INVARIANTS & RULES WITH THEIR CORRESPONDING PRECONDITIONS
2. CREATE COMPLETE DEPENDENCY NETWORKS FOR FORMAL VERIFICATION
3. ENSURE EACH INVARIANT HAS ITS REQUIRED PRECONDITIONS TO AVOID FALSE POSITIVES
4. PREVENT STATE UNREACHABILITY ISSUES IN CERTORA VERIFICATION

YOUR FINAL OUTPUT MUST INCLUDE:
- PRIMARY INVARIANTS & RULES
- THEIR CORRESPONDING PRECONDITIONS (requireInvariant blocks)
- DEPENDENCY RELATIONSHIPS
- VERIFICATION-READY CONSTRAINTS

This synthesis will directly support Certora formal verification without false positives or unreachable states.

Output format:
{
  "不变量": [
    {
      "描述": "不变量相关描述",
      "前置条件": ["前置条件1", "前置条件2"]
    }
  ],
  "规则":[
    {
      "描述":"规则相关描述",
      "前置条件": ["前置条件1", "前置条件2"] 
    }
  ]
}
`;
    
    const response = await this.callAI(prompt);
    return this.parseFinalResult(response);
  }
  
  private parseCoreInvariants(response: string): Invariant[] {
    try {
      const parsed = JSON.parse(this.extractJSON(response));
      const invariants = (parsed.coreInvariants || []).map((inv: any) => ({
        description: inv.description,
        type: 'invariant'
      }));
      const rules = (parsed.coreRules || []).map((rule: any) => ({
        description: rule.description,
        type: 'rule'
      }));
      return [...invariants, ...rules];
    } catch (error) {
      console.warn('Failed to parse core invariants response');
      return [];
    }
  }
  
  private async saveFailedParseResult(response: string, error: any): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `synthesizer-failed-parse-${timestamp}.json`;
    const filepath = path.join('./results', 'failed-parses', filename);
    
    // 确保目录存在
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    // 保存失败的响应
    const data = {
      timestamp: new Date().toISOString(),
      error: error.toString(),
      originalResponse: response,
      extractedJSON: this.extractJSON(response)
    };
    
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    this.logger.warn(`Failed parse result saved to: ${filepath}`);
    
    return filepath;
  }

  private parseFinalResult(response: string): DiscoveryResult {
    try {
      const jsonStr = this.extractJSON(response);
      const parsed = JSON.parse(jsonStr);
      
      this.logger.debug(`Parsed JSON structure: ${Object.keys(parsed).join(', ')}`);
      
      // 尝试多种可能的字段名
      const invariantFields = ['不变量', 'invariants', 'finalInvariants', 'discoveries'];
      const ruleFields = ['规则', 'rules', 'constraints'];
      
      let invariants: any[] = [];
      let rules: any[] = [];
      
      // 查找不变量
      for (const field of invariantFields) {
        if (parsed[field] && Array.isArray(parsed[field])) {
          invariants = parsed[field].map((inv: any) => ({
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
          rules = parsed[field].map((rule: any) => ({
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
            allInvariants.push(...arr.map((item: any) => ({
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
    } catch (error) {
      this.logger.error(`Failed to parse synthesis response: ${error}`);
      
      // 保存失败的解析结果
      this.saveFailedParseResult(response, error).catch(err => 
        this.logger.error(`Failed to save parse error: ${err}`)
      );
      
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
  
  private findArraysInObject(obj: any, arrays: any[] = []): any[] {
    if (Array.isArray(obj)) {
      arrays.push(obj);
    } else if (obj && typeof obj === 'object') {
      for (const key in obj) {
        this.findArraysInObject(obj[key], arrays);
      }
    }
    return arrays;
  }
  
  private looksLikeInvariant(item: any): boolean {
    if (typeof item === 'string') return true;
    if (item && typeof item === 'object') {
      return item.hasOwnProperty('description') || 
             item.hasOwnProperty('描述') ||
             item.hasOwnProperty('content') ||
             item.hasOwnProperty('text');
    }
    return false;
  }
  
  private extractDescription(item: any): string {
    if (typeof item === 'string') return item;
    return item['描述'] || item.description || item.content || item.text || JSON.stringify(item);
  }
  
  private extractJSON(response: string): string {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return jsonMatch ? jsonMatch[0] : response;
  }
}