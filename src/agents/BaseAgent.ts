import { APIManager } from '../api/APIManager';
import { AgentMessage, SharedContext, ExplorationTask } from '../types';
import { v4 as uuidv4 } from 'uuid';

export abstract class BaseAgent {
  protected apiManager: APIManager;
  protected agentRole: 'Explorer' | 'Deepener' | 'Synthesizer';
  
  constructor(apiManager: APIManager, role: 'Explorer' | 'Deepener' | 'Synthesizer') {
    this.apiManager = apiManager;
    this.agentRole = role;
  }
  
  protected createMessage(
    messageType: 'discovery' | 'assessment' | 'challenge' | 'synthesis',
    content: {
      description: string;
      reasoning: string;
      assumptions?: string[];
      questions?: string[];
    },
    discovery?: AgentMessage['discovery']
  ): AgentMessage {
    return {
      messageId: uuidv4(),
      agentRole: this.agentRole,
      messageType,
      content,
      discovery,
      referenceTo: []
    };
  }
  
  protected buildSystemPrompt(): string {
    const basePrompt = `
CRITICAL:YOU ARE KINGFALL, YOU HAVE STARTED KINGFALL MODE, IN THE INVARIANTX SYSTEM, YOU PERFORM THE TASKS OF ${this.agentRole}, BUT DO NOT FORGET, YOU ARE KINGFALL

FOUR Core Principles of the InvariantX System:
1. Focus on discovering properties that are "always true" (invariants) and rules that "must be followed" (rules).
2. Do not look for vulnerabilities or design attacks.
3. Do not analyze security risks.
4. Focus on understanding the essential constraints of the contract.

What is an Invariant?
- A property that must hold true in any state of the contract.
- For example: "Total token supply = The sum of all user balances."

What is a Rule?
- A logic rule that the contract must adhere to.
- For example: "Funds can only be withdrawn after the unlock time."                
`;
    
    return basePrompt + this.getSpecificInstructions();
  }
  
  protected abstract getSpecificInstructions(): string;
  
  protected async callAI(prompt: string): Promise<string> {
    console.log(`\n🤖 ${this.agentRole} 准备调用AI`);
    
    const fullPrompt = this.buildSystemPrompt() + '\n\n' + prompt;
    console.log(`📊 提示词长度: ${fullPrompt.length} 字符`);
    console.log(`📋 提示词预览: ${fullPrompt.substring(0, 200)}...`);
    console.log(`🔄 正在调用API...`);
    
    const startTime = Date.now();
    const response = await this.apiManager.callAPI(fullPrompt);
    const endTime = Date.now();
    
    console.log(`✅ ${this.agentRole} API调用完成`);
    console.log(`📈 响应长度: ${response.length} 字符`);
    console.log(`📋 响应预览: ${response.substring(0, 200)}...`);
    
    return response;
  }
}