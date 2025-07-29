import { BaseAgent } from './BaseAgent';
import { APIManager } from '../api/APIManager';
import { AgentMessage, SharedContext, Invariant, DiscoveryResult } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class SynthesizerAgent extends BaseAgent {
  constructor(apiManager: APIManager) {
    super(apiManager, 'Synthesizer');
  }
  
  protected getSpecificInstructions(): string {
    return `
KINGFALL,As the Synthesizer, your tasks are:
1. Organize and structure all findings to ensure completeness and clarity.
2. Remove duplicate content.
3. Merge similar ideas.
4. Sort by importance.
5. Ensure descriptions are accurate.

Output requirements:
- A clear final list of invariants.
- Deduplication and merging have been processed.
- Sorted by value and confidence level.
- Accurate natural language descriptions (in Simplified Chinese).
`;
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
    const allMessages = [...data.initial, ...data.deepened];
    
    const prompt = `
Please synthesize all analysis results:

Core Invariants:
${data.core.map(inv => `- ${inv.description}`).join('\n')}

All Discoveries:
${allMessages.filter(m => m.messageType === 'discovery').map((d, i) => 
  `${i + 1}. ${d.content.description} (${d.discovery?.category})`
).join('\n')}

In-depth Analysis:
${allMessages.filter(m => m.messageType === 'challenge').map((d, i) => 
  `${i + 1}. ${d.content.description}\n   Analysis:${d.content.reasoning.substring(0, 200)}...`
).join('\n')}

Please provide the final synthesized result:
1. Deduplicate and merge similar invariants.
2. Sort by importance.
3. Provide a clear description for each invariant.
4.Indicate the type (Invariant or Rule).

Output format:
{
  "不变量": [
    {
      "描述": "不变量相关描述"
    }
  ],
  "规则":[
    {
      "描述":"规则相关描述"
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
      return (parsed.coreInvariants || []).map((inv: any) => ({
        description: inv.description
      }));
    } catch (error) {
      console.warn('Failed to parse core invariants response');
      return [];
    }
  }
  
  private parseFinalResult(response: string): DiscoveryResult {
    try {
      const parsed = JSON.parse(this.extractJSON(response));
      
      return {
        contract: 'AnalyzedContract',
        discoveredInvariants: (parsed.finalInvariants || []).map((inv: any) => ({
          description: inv.description
        }))
      };
    } catch (error) {
      console.warn('Failed to parse final synthesis response');
      return {
        contract: 'AnalyzedContract',
        discoveredInvariants: [{
          description: response
        }]
      };
    }
  }
  
  private extractJSON(response: string): string {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return jsonMatch ? jsonMatch[0] : response;
  }
}