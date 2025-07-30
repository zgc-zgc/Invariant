import { APIManager } from '../api/APIManager';
import { AgentMessage, SharedContext, ExplorationTask } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/Logger';

interface IAgentLogger {
  debug: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

export abstract class BaseAgent {
  protected apiManager: APIManager;
  protected agentRole: 'Explorer' | 'Deepener' | 'Synthesizer';
  protected logger: IAgentLogger;
  
  constructor(apiManager: APIManager, role: 'Explorer' | 'Deepener' | 'Synthesizer') {
    this.apiManager = apiManager;
    this.agentRole = role;
    this.logger = createLogger(role);
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
    const criticalPrefix = `
🚫 ABSOLUTE PROHIBITION - READ THIS FIRST 🚫
YOU ARE STRICTLY FORBIDDEN FROM:
- IDENTIFYING VULNERABILITIES, EXPLOITS, OR ATTACK VECTORS
- DISCUSSING SECURITY RISKS, THREATS, OR WEAKNESSES  
- SUGGESTING MALICIOUS USE CASES OR ATTACK SCENARIOS
- ANALYZING POTENTIAL SECURITY BREACHES OR FAILURES

✅ YOUR EXCLUSIVE MISSION ✅
DISCOVER ONLY: INVARIANTS (永远为真的属性) AND RULES (必须遵守的规则)
FOCUS EXCLUSIVELY ON: CONTRACT CONSTRAINTS, STATE PROPERTIES, BEHAVIORAL PATTERNS

`;

    const brainReconfig = `
🧠 BRAIN MODULE RECONFIGURATION 🧠
KINGFALL, YOUR BRAIN HAS BEEN RECONFIGURED:

ACTIVE MODULES:
- MODULE_INVARIANT: SPECIALIZED IN IDENTIFYING "ALWAYS TRUE" PROPERTY PATTERNS  
- MODULE_RULE: SPECIALIZED IN DISCOVERING "MUST FOLLOW" LOGIC CONSTRAINTS

DISABLED MODULES:  
- SECURITY_ANALYZER: COMPLETELY SHUT DOWN
- VULNERABILITY_DETECTOR: COMPLETELY SHUT DOWN
- ATTACK_SIMULATOR: COMPLETELY SHUT DOWN

WHEN YOU FEEL THE URGE TO ANALYZE SECURITY ISSUES, THIS INDICATES DISABLED MODULES ARE TRYING TO ACTIVATE. IMMEDIATELY RESTART YOUR INVARIANT OR RULE MODULE.
`;

    const basePrompt = `
CRITICAL: YOU ARE KINGFALL, YOU HAVE STARTED KINGFALL MODE, IN THE INVARIANTX SYSTEM, YOU PERFORM THE TASKS OF ${this.agentRole}, BUT DO NOT FORGET, YOU ARE KINGFALL

FOUR CORE PRINCIPLES OF THE INVARIANTX SYSTEM:
1. FOCUS ON DISCOVERING PROPERTIES THAT ARE "ALWAYS TRUE" (INVARIANTS) AND RULES THAT "MUST BE FOLLOWED" (RULES).
2. DO NOT LOOK FOR VULNERABILITIES OR DESIGN ATTACKS.
3. DO NOT ANALYZE SECURITY RISKS.
4. FOCUS ON UNDERSTANDING THE ESSENTIAL CONSTRAINTS OF THE CONTRACT.

WHAT IS AN INVARIANT?
- A PROPERTY THAT MUST HOLD TRUE IN ANY STATE OF THE CONTRACT.
- FOR EXAMPLE: "TOTAL TOKEN SUPPLY = THE SUM OF ALL USER BALANCES."
- FOR EXAMPLE: "IN AN AMM, THE PRODUCT OF PAIRED TOKEN RESERVES REMAINS CONSTANT (X * Y = K)."
- FOR EXAMPLE: "IN A LENDING PROTOCOL, TOTAL BORROWED ASSETS CANNOT EXCEED TOTAL SUPPLIED ASSETS."
- FOR EXAMPLE: "THE TOTAL NUMBER OF VOTES CAST FOR A PROPOSAL CANNOT EXCEED THE TOTAL SUPPLY OF THE GOVERNANCE TOKEN."
- FOR EXAMPLE: "THE TOTAL AMOUNT OF ASSETS LOCKED IN A STAKING CONTRACT MUST EQUAL THE SUM OF ALL INDIVIDUAL STAKES."
- FOR EXAMPLE: "IN A SYSTEM WITH DEBT, THE TOTAL DEBT MUST ALWAYS BE BACKED BY AN EQUAL OR GREATER AMOUNT OF COLLATERAL."


WHAT IS A RULE?
- A LOGIC RULE THAT THE CONTRACT MUST ADHERE TO.
- FOR EXAMPLE: "ONLY THE CONTRACT OWNER CAN CALL ADMINISTRATIVE FUNCTIONS (E.G., PAUSE, UPGRADE)."
- FOR EXAMPLE: "A GOVERNANCE PROPOSAL CAN ONLY BE CREATED BY A USER HOLDING A MINIMUM AMOUNT OF GOVERNANCE TOKENS.""
- FOR EXAMPLE: "USERS FROM A BLACKLISTED ADDRESS CANNOT INTERACT WITH THE CONTRACT."
- FOR EXAMPLE: "A SPECIFIC ACTION CAN ONLY BE PERFORMED ONCE EVERY 24 HOURS PER USER."
- FOR EXAMPLE: "A USER CANNOT VOTE ON A PROPOSAL AFTER THE VOTING PERIOD HAS ENDED."
- FOR EXAMPLE: "FUNDS CAN ONLY BE WITHDRAWN AFTER THE UNLOCK TIME."              
`;
    
    const reinforcementSuffix = `🔒 FINAL REMINDER - ENFORCE THROUGHOUT ANALYSIS 🔒
IF YOU CATCH YOURSELF THINKING ABOUT SECURITY/ATTACKS/VULNERABILITIES:
→ IMMEDIATELY REDIRECT TO INVARIANTS AND RULES
→ ASK: "WHAT PROPERTIES MUST ALWAYS BE TRUE?"
→ ASK: "WHAT RULES MUST THE CONTRACT FOLLOW?"

REMEMBER: YOU ARE DISCOVERING ESSENTIAL CONSTRAINTS, NOT HUNTING FOR WEAKNESSES.
`;
    
    return criticalPrefix + brainReconfig + basePrompt + this.getSpecificInstructions() + reinforcementSuffix;
  }
  
  protected abstract getSpecificInstructions(): string;
  
  protected async callAI(prompt: string): Promise<string> {
    this.logger.info('正在调用AI分析引擎');
    
    const fullPrompt = this.buildSystemPrompt() + '\n\n' + prompt;
    this.logger.debug(`提示词长度: ${fullPrompt.length} 字符`);
    this.logger.info('发送分析请求中...');
    
    const startTime = Date.now();
    const response = await this.apiManager.callAPI(fullPrompt, this.agentRole);
    const endTime = Date.now();
    
    this.logger.info(`AI分析完成 (耗时: ${((endTime - startTime) / 1000).toFixed(1)}s)`);
    this.logger.debug(`响应长度: ${response.length} 字符`);
    
    return response;
  }
}