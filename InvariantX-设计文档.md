# InvariantX - 智能合约Invariant和Rule自动发现系统

## 一、项目概述

### 1.1 核心理念

InvariantX是一个结合"死板程序控制"和"AI智能分析"的系统，专门用于自动发现Solidity智能合约中的invariant（不变量）和rule（规则）。

**关键原则：**
- 程序只是会议主持人，负责流程控制和错误处理
- AI agents才是核心，通过深度讨论自主发现invariants和rules
- 不是找漏洞，而是发现和理解合约的核心约束
- 不预设invariant类型，让AI充分发挥主观能动性

### 1.2 系统定位

- **不是**：漏洞扫描器、攻击工具、代码审计工具
- **而是**：Invariant发现系统、约束理解工具、规则提取系统

## 二、系统架构

### 2.1 技术栈

```typescript
{
  框架: "TypeScript + Node.js",
  AI接口: "支持自定义API endpoint（通过env配置）",
  错误处理: "自动重试、429处理、指数退避",
  配置管理: "环境变量驱动"
}
```

### 2.2 核心组件

```typescript
// 1. 协调器 - 管理讨论流程
class InvariantDiscoveryOrchestrator {
  - 管理Agent调用顺序
  - 维护共享上下文
  - 处理API错误和重试
  - 判断收敛条件
}

// 2. AI Agents - 不同角色的分析专家
class AIAgents {
  - Explorer: 自由发现invariants
  - ValueAssessor: 评估invariant重要性
  - Deepener: 深化理解和发现关联
  - Synthesizer: 综合整理最终结果
}

// 3. 共享上下文 - 讨论记忆
class SharedContext {
  - 合约代码
  - 讨论历史
  - 发现的invariants
  - 待解决问题
}
```

## 三、AI Agent设计

### 3.1 Explorer（探索者）

**角色定位**：自由探索，不受限制地发现各种invariant和rule

**Prompt核心**：
```
你是智能合约分析专家。深入理解合约，发现所有重要的invariant和rule。

什么是invariant？
- 在任何状态下都必须为真的属性
- 例："总供应量等于所有账户余额之和"

什么是rule？  
- 合约必须遵守的业务逻辑规则
- 例："只有锁定期结束后才能提取"

请自由探索，不要局限于特定类型。
```

### 3.2 ValueAssessor（价值评估者）

**角色定位**：评估每个invariant的重要性（不是设计攻击）

**关键转变**：
- ❌ 错误理解：如何攻击这个invariant
- ✅ 正确理解：保护这个invariant有多重要

**评估维度**：
- 违反后的经济损失
- 对系统的影响程度
- 受影响的用户范围

### 3.3 Deepener（深化者）

**角色定位**：深化对invariant的理解，发现隐藏关联

**主要任务**：
1. 发现invariant之间的依赖关系
2. 挖掘隐含的前提条件
3. 识别相关但未被发现的invariant
4. 探索边界情况和特殊场景

### 3.4 Synthesizer（综合者）

**角色定位**：整理和组织所有发现，确保完整性和清晰度

**输出要求**：
- 去除重复内容
- 合并相似观点
- 按重要性排序
- 确保描述准确

## 四、半结构化数据交换机制

### 4.1 Agent通信格式

```typescript
interface AgentMessage {
  // 结构化部分（程序可解析）
  messageId: string;
  agentRole: "Explorer" | "ValueAssessor" | "Deepener" | "Synthesizer";
  messageType: "discovery" | "assessment" | "challenge" | "synthesis";
  
  discovery?: {
    invariantId: string;
    category: string; // AI自主分类，不预设
    relatedElements: {
      functions: string[];
      variables: string[];
    };
    confidence: number; // 0-1
  };
  
  // 自由表达部分（AI创造性）
  content: {
    description: string;      // 自然语言描述
    reasoning: string;        // 推理过程
    assumptions?: string[];   // 隐含假设
    questions?: string[];     // 待讨论问题
  };
  
  // 上下文引用
  referenceTo?: string[];     // 引用的其他消息ID
}
```

## 五、JSON配置驱动的可扩展机制

### 5.1 动态配置系统

```typescript
// 程序不硬编码任何键名，完全动态读取JSON结构
class DynamicConfigLoader {
  // 动态获取所有配置类别
  getConfigCategories(): string[] {
    return Object.keys(this.config);
  }
  
  // 动态处理任意键值对结构
  async generatePromptsFromConfig(contractInfo: any): Promise<string[]> {
    const allPrompts: string[] = [];
    
    // 遍历JSON中的所有键
    for (const [categoryKey, categoryValue] of Object.entries(this.config)) {
      const categoryPrompts = await this.processCategoryDynamically(
        categoryKey, categoryValue, contractInfo
      );
      allPrompts.push(...categoryPrompts);
    }
    return allPrompts;
  }
}
```

### 5.2 配置文件示例

```json
{
  "description": "动态Invariant发现配置 - 所有键都是动态解析",
  
  "基础数学关系探索": [
    "寻找所有数值变量之间的总和关系",
    "分析是否存在守恒定律",
    "检查比例关系和乘积关系"
  ],
  
  "uint256类型探索": [
    "分析 {variable} 的数值边界约束",
    "检查 {variable} 的变化模式和方向"
  ],
  
  "函数组合模式_mint_burn": {
    "匹配函数": ["mint", "burn"],
    "探索提示": [
      "分析mint和burn对总量的影响",
      "检查mint和burn的对称性"
    ]
  }
}
```

### 5.3 使用方式

```bash
# 使用默认配置
invariantx analyze contract.sol

# 组合使用多个配置
invariantx analyze contract.sol --config default.json,defi.json,custom.json
```

## 六、反馈循环工作流程

### 6.1 改进的工作流程

```typescript
// 反馈循环：核心invariant → Deepener
async discoverInvariants(contractCode: string): Promise<DiscoveryResult> {
  // 1. 初始探索（基于JSON配置）
  const initialFindings = await this.explorer.explore(contractCode, config);
  
  // 2. 价值评估
  const assessedFindings = await this.valueAssessor.assess(initialFindings);
  
  // 3. 识别核心invariant
  const coreInvariants = await this.synthesizer.identifyCore(assessedFindings);
  
  // 4. 反馈给Deepener深化分析
  const deepenedFindings = await this.deepener.deepenBasedOnCore({
    coreInvariants: coreInvariants,
    originalFindings: assessedFindings,
    prompts: [
      `基于核心invariant: ${coreInvariants.map(i => i.description).join(', ')}`,
      `分析这些invariant之间的关联关系`,
      `寻找基于核心约束的派生invariant`
    ]
  });
  
  // 5. 最终综合
  return await this.synthesizer.finalSynthesize([...assessedFindings, ...deepenedFindings]);
}
```

### 6.2 收敛机制

收敛条件：
1. 发现速度明显下降
2. 出现大量重复内容
3. 主要功能都已覆盖
4. Agents达成高度共识

## 七、确保全面性的机制

### 7.1 多层次探索策略

1. **功能覆盖**：确保每个函数都被分析
2. **状态变量覆盖**：检查所有状态变量的约束
3. **交互模式覆盖**：分析函数间的交互约束
4. **时间维度覆盖**：考虑时序相关的规则

### 7.2 系统性提示机制

JSON配置驱动的checklist机制：
- 引导探索：为AI提供方向性提示
- 确保覆盖：系统性检查避免遗漏重要领域

### 7.3 交叉验证机制

不同视角的Agent相互验证：
- 所有Agent使用相同的AI模型（通过env配置）
- 通过不同prompt实现不同验证视角
- 确保发现的invariant经过多重验证

## 八、API管理和错误处理

### 8.1 环境配置

```env
# API配置（支持任意LLM API）
API_ENDPOINT=https://your-api-endpoint.com/v1/chat
API_KEY=your-api-key
MODEL_NAME=your-model-name
TEMPERATURE=0.7

# 错误处理
RETRY_ENABLED=true
MAX_RETRIES=5
RETRY_DELAY_MS=1000
HANDLE_429=true

# 收敛控制
MIN_ROUNDS=5
MAX_ROUNDS=20
```

### 8.2 错误处理机制

```typescript
- 自动重试机制
- 429错误特殊处理（等待并重试）
- 指数退避算法
- 详细的错误日志
```

## 九、工作流程

### 9.1 主流程

```
1. 独立探索阶段
   - 多个Agent并行分析，避免群体思维
   - 每个Agent独立提出发现

2. 深度讨论阶段  
   - 选择高价值议题
   - Agents展开多轮讨论
   - 不断深化理解

3. 验证完善阶段
   - 交叉验证重要发现
   - 填补可能的遗漏
   - 确保逻辑一致性

4. 综合输出阶段
   - 整理所有发现
   - 生成结构化报告
```

### 9.2 动态调整策略

- 根据已发现内容调整探索重点
- 智能生成针对性提示
- 自动识别并填补空白区域

## 十、输出格式

```json
{
  "contract": "ContractName",
  "discoveredInvariants": [
    {
      "type": "Invariant/Rule",
      "description": "自然语言描述",
      "importance": "重要性说明", 
      "relatedFunctions": ["相关函数"],
      "confidence": 0.95,
      "validationStatus": "已验证"
    }
  ],
  "discussionSummary": {
    "totalRounds": 8,
    "invariantsDiscovered": 15,
    "coverageMetrics": {...}
  }
}
```

## 十一、关键设计决策

### 11.1 为什么不预设invariant类型？

让AI自由发现可以：
- 避免思维限制
- 发现非常规的invariant
- 适应不同类型的合约
- 最大化AI的创造力

### 11.2 为什么强调"不是找漏洞"？

- 找漏洞会让AI关注攻击方法
- 我们要的是理解约束本质
- 发现invariant是构建性的
- 攻击思维会偏离主要目标

### 11.3 为什么使用多Agent讨论？

- 不同视角互补
- 通过辩论深化理解
- 交叉验证提高质量
- 模拟人类专家组讨论

## 十二、实施建议

### 12.1 第一阶段（MVP）

1. 实现基础流程控制
2. 配置4个核心Agent
3. 简单的收敛判断
4. 基础错误处理

### 12.2 第二阶段（增强）

1. 添加更多专业Agent
2. 智能提示生成
3. 高级收敛算法
4. 可视化讨论过程

### 12.3 第三阶段（优化）

1. 性能优化
2. 成本控制
3. 结果质量评估
4. 与其他工具集成

## 十三、总结

InvariantX通过结合程序的稳定性和AI的智能性，实现了智能合约invariant的自动发现。系统的核心价值在于：

1. **充分发挥AI能力**：不限制AI思维，让其自由探索
2. **系统性保证完整性**：通过多层机制确保不遗漏
3. **注重理解而非攻击**：专注于发现和理解约束
4. **灵活可扩展**：支持任意AI API，易于定制

这种设计理念确保了系统既有AI的创造力，又有程序的可靠性，能够高效地发现智能合约中的各种invariant和rule。