# InvariantX

智能合约Invariant和Rule自动发现系统

## 项目概述

InvariantX是一个将刚性程序控制与AI智能分析相结合的系统，专门用于自动发现Solidity智能合约中的不变量(invariant)和规则(rule)。核心原理是程序作为会议主持人，而AI代理进行深度讨论，自主发现不变量。

**重要说明：这不是漏洞扫描器或攻击工具，而是专注于理解合约约束本质的不变量发现系统。**

## 系统架构

### 4个核心AI代理
- **Explorer（探索者）**: 自由发现不变量和规则
- **ValueAssessor（价值评估者）**: 评估不变量的重要性（不是设计攻击）
- **Deepener（深化者）**: 深化理解，发现隐藏关联
- **Synthesizer（综合者）**: 组织和整理最终结果

### 技术栈
- **框架**: TypeScript + Node.js
- **AI接口**: 支持通过环境变量配置的任何LLM API
- **错误处理**: 自动重试、429处理、指数退避
- **配置**: 环境变量驱动

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

# 收敛控制
MIN_ROUNDS=5
MAX_ROUNDS=20
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

### 批量分析模式
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
      "priority": "high"
    },
    {
      "id": "002", 
      "type": "document",
      "name": "白皮书",
      "path": "./docs/whitepaper.md",
      "priority": "medium"
    },
    {
      "id": "003",
      "type": "folder", 
      "name": "治理合约目录",
      "path": "./contracts/governance/",
      "priority": "low"
    }
  ],
  "outputPath": "./results/analysis-results.json"
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

### 探索配置 (JSON格式)
```json
{
  "数学关系": [
    "代币总供应量是否等于所有用户余额之和？",
    "是否存在数学恒等式？"
  ],
  "状态转换": [
    "状态变化是否遵循特定规律？",
    "是否有状态转换的先决条件？"
  ],
  "访问控制": [
    "谁可以调用特定函数？",
    "权限检查是否一致？"
  ]
}
```

### 动态配置特性
- **完全动态**: JSON中的键值对不需要在程序中硬编码
- **模板支持**: 支持 `{variable}` 变量替换
- **函数匹配**: 支持函数名模式匹配

## 工作流程

1. **初始探索阶段**
   - Explorer基于合约代码和配置进行自由探索
   - ValueAssessor评估发现的不变量的重要性

2. **核心识别**
   - Synthesizer识别出3-5个最核心的不变量

3. **深化分析阶段**
   - Deepener基于核心不变量进行深度分析
   - 发现不变量间的关联关系和派生约束

4. **最终综合**
   - Synthesizer整理所有发现，去重合并
   - 按重要性和置信度排序输出最终结果

## 输出格式

```json
{
  "contract": "合约名称",
  "discoveredInvariants": [
    {
      "id": "unique-id",
      "type": "Invariant|Rule",
      "description": "自然语言描述",
      "importance": "重要性说明",
      "relatedFunctions": ["相关函数"],
      "confidence": 0.9,
      "validationStatus": "验证状态",
      "category": "类别",
      "source": "发现来源"
    }
  ],
  "discussionSummary": {
    "totalRounds": 1,
    "invariantsDiscovered": 15,
    "coverageMetrics": {}
  },
  "executionTime": 5000
}
```

## 核心概念

### 什么是Invariant？
- 在合约任何状态下都必须为真的属性
- 例如："代币总供应量 = 所有用户余额之和"

### 什么是Rule？
- 合约必须遵守的业务逻辑规则
- 例如："只有在解锁时间后才能提取资金"

## 开发指南

### 项目结构
```
src/
├── agents/          # 4个AI代理
├── api/            # API管理和错误处理
├── config/         # 配置管理
├── core/           # 核心orchestrator
├── types/          # TypeScript类型定义
└── utils/          # 工具函数
```

### 添加新的探索类别
1. 在配置JSON中添加新的键值对
2. 系统会自动识别并使用新的探索任务

### 扩展API支持
1. 修改 `APIManager.ts` 中的API调用逻辑
2. 添加新的认证方式或请求格式

## 故障排除

### 常见问题
1. **API调用失败**: 检查API_KEY和API_ENDPOINT配置
2. **429错误**: 系统会自动重试，可调整RETRY_DELAY_MS
3. **解析失败**: 检查模型响应格式，系统有fallback机制

### 调试模式
使用 `--verbose` 标志获取详细输出信息。

## 示例

查看 `examples/SimpleToken.sol` 获取示例智能合约。

## 许可证

MIT License

## 贡献

本项目专注于不变量发现，不接受与安全攻击相关的贡献。