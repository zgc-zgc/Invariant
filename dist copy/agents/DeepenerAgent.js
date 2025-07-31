"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepenerAgent = void 0;
const BaseAgent_1 = require("./BaseAgent");
const ChallengeSystem_1 = require("../core/ChallengeSystem");
const ConfigManager_1 = require("../config/ConfigManager");
class DeepenerAgent extends BaseAgent_1.BaseAgent {
    constructor(apiManager) {
        super(apiManager, 'Deepener');
        const configManager = ConfigManager_1.ConfigManager.getInstance();
        this.challengeSystem = new ChallengeSystem_1.ChallengeSystem(apiManager, configManager.getConvergenceConfig());
    }
    async analyzePrerequisites(explorerFindings, contractCode) {
        console.log('开始前置条件分析 (requireInvariant)...');
        // 构建前置条件分析的初始提示
        const initialPrompt = this.buildPrerequisiteAnalysisPrompt(explorerFindings, contractCode);
        // 进行Alpha-Beta Challenge
        const challengeResult = await this.challengeSystem.conductChallenge('Deepener', initialPrompt, contractCode, [] // Deepener主要基于内置逻辑
        );
        console.log(`前置条件分析完成，共 ${challengeResult.totalRounds} 轮，${challengeResult.converged ? '已收敛' : '未收敛'}`);
        return challengeResult.finalDiscoveries;
    }
    buildEnhancedDeepeningPrompt(coreInvariants, originalFindings, contractCode) {
        const coreInvariantsList = coreInvariants.map((inv, i) => `${i + 1}. **${inv.description}**`).join('\n\n');
        const originalFindingsList = originalFindings
            .filter(msg => msg.messageType === 'discovery')
            .map((msg, i) => `${i + 1}. ${msg.content.description}`).join('\n');
        return `
KINGFALL, AS THE DEEPENER, YOUR TASK IS THE FOLLOWING SOLE CRITICAL TASK:

CRITICAL: COMPREHENSIVELY ANALYZE THE PRECONDITIONS OF THE INVARIANT/RULE (THE PRESERVED BLOCK OF AN INVARIANT IN CVL).
- FOR EXAMPLE, THE INVARIANT "TRANSFER DOES NOT CHANGE TOTALSUPPLY" ONLY MAKES SENSE WHEN THE PRECONDITION "TOTALSUPPLY == SUM(ALL BALANCES)" HOLDS. FOR EACH INVARIANT/RULE, PLEASE COMPREHENSIVELY ANALYZE ITS CORRESPONDING PRECONDITION.

CREATIVELY EXPLORE THE DEEP RELATIONSHIPS BETWEEN INVARIANTS, BUILD A SYSTEMATIC NETWORK OF CONSTRAINTS. NOT LIMITED TO SUPERFICIAL LOGICAL CONNECTIONS.

# CORE INVARIANT&RULE
${coreInvariantsList}

# ORIGINAL FINDINGS
${originalFindingsList}

# NOTE
THE CONTRACT CODE IS PROVIDED SEPARATELY IN THE SYSTEM PROMPT ABOVE.
`;
    }
    buildPrerequisiteAnalysisPrompt(explorerFindings, contractCode) {
        const discoveredInvariants = explorerFindings
            .filter(msg => msg.messageType === 'discovery')
            .map((msg, i) => `${i + 1}. **${msg.content.description}**`).join('\n\n');
        return `
KINGFALL, AS THE DEEPENER, YOUR CRITICAL TASK IS TO ANALYZE PREREQUISITES (requireInvariant in CVL):

YOU NEED TO ANALYZE THE PRECONDITIONS FOR EACH DISCOVERED INVARIANT TO HOLD. THESE PRECONDITIONS ARE OTHER INVARIANTS THAT MUST BE TRUE.

FOR EXAMPLE:
- INVARIANT "TRANSFER DOES NOT CHANGE TOTALSUPPLY" PRECONDITION MIGHT BE "TOTALSUPPLY == SUM(ALL BALANCES)"

# DISCOVERED INVARIANTS
${discoveredInvariants}

# YOUR TASK
1. IDENTIFY THE PRECONDITIONS (OTHER INVARIANTS) REQUIRED FOR EACH INVARIANT TO HOLD
2. ANALYZE THE DEPENDENCY NETWORK BETWEEN INVARIANTS  
3. BUILD A COMPLETE INVARIANT HIERARCHY

# CONTRACT CODE
\`\`\`solidity
{CONTRACT_CODE}
\`\`\``.replace('{CONTRACT_CODE}', contractCode);
    }
}
exports.DeepenerAgent = DeepenerAgent;
//# sourceMappingURL=DeepenerAgent.js.map