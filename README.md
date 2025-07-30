# InvariantX

智能合约Invariant和Rule自动发现系统

## 项目概述

InvariantX是一个将刚性程序控制与AI智能分析相结合的系统，专门用于自动发现Solidity智能合约中的不变量(invariant)和规则(rule)。核心原理是程序作为会议主持人，而AI代理进行深度讨论，自主发现不变量。

**重要说明：这不是漏洞扫描器或攻击工具，而是专注于理解合约约束本质的不变量发现系统。**

## 🚀 最新优化 (2025-01-29)

### 1. **智能收敛策略**
- **增强的收敛分数计算**：基于长度比率(30%)、词汇重叠(50%)、关键概念相似度(20%)的综合评分
- **多维度收敛判断**：
  - 连续无新发现自动停止
  - 新发现率持续下降检测
  - 收敛分数阈值动态判断
  - 智能早停机制（达到60%轮数后评估）

### 2. **结构化进度显示**
- **实时Challenge进度条**：显示当前轮次、新发现数量、收敛分数
- **收敛分析可视化**：实时展示各维度收敛指标
- **美观的ASCII界面**：清晰的进度展示和统计信息

### 3. **断点恢复机制**
- **自动保存分析状态**：支持从中断处继续
- **材料级别的进度追踪**：记录每个分析材料的完成状态
- **智能恢复**：自动识别未完成的任务并继续

### 4. **统一和可配置的日志系统**
- **结构化日志**：所有日志输出已统一为 `[时间戳] [级别] [模块] 消息` 格式，提高了可读性。
- **分级日志系统**：
  - **`INFO` 级别**：默认显示，只包含关键操作步骤，如阶段开始/结束、API调用等，使流程清晰明了。
  - **`DEBUG` 级别**：通过 `--verbose` 标志启用，提供详细的内部信息，如收敛计算、API提示预览等，便于深度调试。
- **日志文件**：所有日志会自动保存到 `./logs/` 目录下的文件中，便于事后分析。

## 系统架构

### 3个核心AI代理 + Alpha-Beta挑战系统
- **Explorer（探索者）**: 通过Alpha-Beta角色互相挑战，全面发现不变量和规则（已整合ValueAssessor功能）
- **Deepener（深化者）**: 通过Alpha-Beta角色互相挑战，深化理解并发现隐藏关联
- **Synthesizer（综合者）**: 组织和整理最终结果，识别核心不变量

### Alpha-Beta挑战工作流
1. **Explorer挑战阶段**：Explorer的Alpha-Beta角色互相挑战，全面发现不变量并评估重要性
2. **核心识别**：Synthesizer从挑战结果中识别3-5个最关键的不变量
3. **Deepener挑战阶段**：基于核心不变量，Deepener的Alpha-Beta角色互相挑战，分析关系并派生新约束
4. **最终综合**：Synthesizer整合所有发现形成最终结果

### 技术栈
- **框架**: TypeScript + Node.js
- **AI接口**: 支持通过环境变量配置的任何LLM API
- **错误处理**: 自动重试、429处理、指数退避
- **配置**: 环境变量驱动 + 动态JSON配置

## 安装与配置

### 1. 安装依赖
```bash
npm install
```

### 2. 环境配置
创建 `.env` 文件：
```env
# API配置 (支持任何LLM API)
API_ENDPOINT=https://api.anthropic.com/v1/messages
API_KEY=your-api-key
MODEL_NAME=claude-3-sonnet-20240229

# 错误处理
RETRY_ENABLED=true
MAX_RETRIES=5
RETRY_DELAY_MS=1000
HANDLE_429=true

# 原始收敛控制
MIN_ROUNDS=3
MAX_ROUNDS=10

# 挑战系统配置
MAX_CHALLENGE_ROUNDS=5
CHALLENGE_CONVERGENCE_THRESHOLD=0.75
```

### 3. 编译项目
```bash
npm run build
```

## 使用方法

### 智能发现模式
```bash
# 自动从配置文件批量分析（推荐）
npx invariantx discover --verbose

# 指定材料配置文件
npx invariantx discover -m ./my-materials-config.json --verbose

# 分析特定的单个合约
npx invariantx discover ./examples/SimpleToken.sol --verbose

# 保存结果到文件
npx invariantx discover -o results.json
```

### 批量分析模式（支持断点恢复）
```bash
# 批量分析多个合约和文档
npx invariantx batch ./configs/materials-config.json

# 从中断处恢复分析
npx invariantx batch ./configs/materials-config.json --resume

# 详细输出
npx invariantx batch ./configs/materials-config.json --verbose
```

### 材料配置文件格式
```json
{
  "projectName": "项目名称",
  "description": "项目描述", 
  "materials": [
    {
      "id": "001",
      "type": "contract",
      "name": "主合约",
      "path": "./contracts/Main.sol",
      "priority": "high",
      "completed": false
    },
    {
      "id": "002", 
      "type": "document",
      "name": "白皮书",
      "path": "./docs/whitepaper.md",
      "priority": "medium",
      "completed": false
    },
    {
      "id": "003",
      "type": "folder", 
      "name": "治理合约目录",
      "path": "./contracts/governance/",
      "priority": "low",
      "completed": false
    }
  ],
  "outputPath": "./results/analysis-results.json",
  "resumeFrom": null,
  "lastUpdated": null
}
```

### 自定义提示探索
```bash
npx invariantx prompt ./contract.sol "请探索代币余额相关的不变量" "分析访问控制机制"
```

### 配置管理
```bash
# 检查当前配置
npx invariantx config --check

# 初始化配置示例
npx invariantx config --init
```

## 配置文件

### 探索配置 (JSON格式) - 完全动态
```json
{
  "基础数学关系探索": [
    "探索代币总供应量与用户余额之间的数学关系",
    "分析数值计算中的恒等式和守恒定律"
  ],
  "状态转换规律": [
    "分析状态变化的前置条件和后置条件",
    "探索状态转换的时序约束"
  ],
  "访问控制模式": [
    "识别函数调用的权限要求",
    "分析角色基础的访问控制规则"
  ],
  "时间锁定机制": [
    "探索与时间相关的约束条件",
    "分析时间锁定和延迟执行模式"
  ],
  "经济模型约束": [
    "分析代币经济学中的供需平衡",
    "探索激励机制的数学约束"
  ],
  "安全边界条件": [
    "识别数值溢出的防护机制",
    "分析重入攻击的防护规则"
  ]
}
```

### 动态配置特性
- **完全动态**: JSON中的键值对不需要在程序中硬编码
- **模板支持**: 支持 `{variable}` 变量替换
- **函数匹配**: 支持函数名模式匹配
- **无限扩展**: 随时添加新的探索类别，无需修改代码

## 工作流程

1. **Alpha-Beta挑战式探索**
   - Explorer的Alpha和Beta角色基于不同视角进行挑战式发现
   - 通过辩论确保全面性，避免遗漏重要不变量

2. **智能收敛判断**
   - 实时计算收敛分数
   - 多维度判断是否继续挑战
   - 避免无效计算，提高效率

3. **核心不变量识别**
   - Synthesizer从大量发现中提取3-5个最关键的不变量
   - 作为深化分析的基础

4. **关系深化挑战**
   - Deepener的Alpha-Beta基于核心不变量进行深度挑战
   - 发现不变量间的关联和派生约束

5. **最终综合输出**
   - 去重、分类、排序
   - 生成结构化的分析报告

## 输出格式

```json
{
  "contract": "合约名称",
  "discoveredInvariants": [
    {
      "description": "永远为真的属性描述",
      "type": "数学关系|状态约束|访问控制|时间约束",
      "importance": "关键|重要|一般",
      "relatedFunctions": ["transfer", "mint", "burn"],
      "confidence": 0.95,
      "source": "Explorer-Alpha|Explorer-Beta|Deepener"
    }
  ],
  "discussionSummary": {
    "explorerChallengeRounds": 4,
    "deepenerChallengeRounds": 3,
    "totalInvariantsFound": 25,
    "coreInvariantsIdentified": 5,
    "convergenceAchieved": true
  },
  "metadata": {
    "executionTime": 45000,
    "timestamp": "2025-01-29T12:00:00Z",
    "modelUsed": "claude-3-sonnet"
  }
}
```

## 核心概念

### 什么是Invariant（不变量）？
- 在合约任何状态下都必须为真的属性
- 例如："代币总供应量 = 所有用户余额之和"
- 例如："锁定的代币数量 ≤ 总供应量"

### 什么是Rule（规则）？
- 合约必须遵守的业务逻辑规则
- 例如："只有在解锁时间后才能提取资金"
- 例如："只有owner可以铸造新代币"

### Alpha-Beta挑战机制
- **Alpha角色**：提出初始发现和分析
- **Beta角色**：挑战、补充、深化Alpha的发现
- **收敛机制**：通过智能判断避免无限循环

## 开发指南

### 项目结构
```
src/
├── agents/          # 3个AI代理实现
├── api/            # API管理和错误处理
├── config/         # 配置管理（环境变量+动态JSON）
├── core/           # 核心编排器和挑战系统
│   ├── InvariantDiscoveryOrchestrator.ts
│   ├── ChallengeSystem.ts        # Alpha-Beta挑战实现
│   ├── BatchAnalysisOrchestrator.ts
│   └── ProgressManager.ts        # 断点恢复支持
├── types/          # TypeScript类型定义
└── utils/          # 工具函数
    └── ProgressDisplay.ts        # 进度显示工具
```

### 添加新的探索类别
1. 在 `configs/default-config.json` 中添加新的键值对
2. 系统会自动识别并使用新的探索任务
3. 无需修改任何代码

### 扩展API支持
1. 修改 `APIManager.ts` 中的API调用逻辑
2. 通过环境变量配置新的API端点
3. 系统自动适配请求格式

## 性能优化建议

1. **调整收敛阈值**：通过 `CHALLENGE_CONVERGENCE_THRESHOLD` 控制收敛敏感度
2. **限制挑战轮数**：通过 `MAX_CHALLENGE_ROUNDS` 避免过度分析
3. **批量分析优化**：使用材料配置文件进行批量处理
4. **断点恢复**：长时间分析任务支持中断后继续

## 故障排除

### 常见问题
1. **API调用失败**: 检查API_KEY和API_ENDPOINT配置
2. **429错误**: 系统会自动重试，可调整RETRY_DELAY_MS
3. **收敛过快**: 降低CHALLENGE_CONVERGENCE_THRESHOLD值
4. **分析时间过长**: 减少MAX_CHALLENGE_ROUNDS值

### 调试模式
使用 `--verbose` 标志启用详细的`DEBUG`级别日志，可以获取详细的运行时信息，包括：
- 每轮挑战的详细统计
- 收敛分数计算过程
- API调用的详细日志（如提示词预览）
- 内部状态转换和统计信息

## 示例

查看 `examples/SimpleToken.sol` 获取示例智能合约。

## 许可证

MIT License

## 贡献指南

1. 本项目专注于不变量发现，不接受与安全攻击相关的贡献
2. 欢迎提交新的探索策略和分析维度
3. 代码提交前请运行 `npm run lint`
4. 保持AI代理的独立性和模块化

## 联系方式

如有问题或建议，请提交Issue到: https://github.com/zgc-zgc/Invariant