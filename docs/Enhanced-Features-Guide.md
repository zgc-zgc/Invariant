# InvariantX 简化CLI使用指南

## 超简洁的命令行界面 🚀

InvariantX现在提供极简的命令行体验，只需一个命令即可运行：

### 基本使用

```bash
# 最简单的运行方式 - 批量分析配置中的所有合约
npx invariantx

# 分析单个合约文件
npx invariantx ./examples/SimpleToken.sol

# 启用AI对话日志记录
npx invariantx --log-ai

# 强制开始新分析（忽略中断会话）
npx invariantx --new

# 组合使用
npx invariantx ./examples/SimpleToken.sol --log-ai --new
```

### 仅有的两个参数

- **`--log-ai`**: 启用AI通信日志，保存所有对话到文件
- **`--new`**: 强制开始新分析，忽略任何中断的会话

### 智能行为

1. **自动批量分析**: 不指定文件时自动使用 `./configs/materials-config.json`
2. **智能会话恢复**: 自动检测并恢复中断的会话（除非使用 `--new`）
3. **统一配置**: 自动使用 `./configs/default-config.json` 配置文件
4. **详细输出**: 总是显示完整的分析结果和详情

### 使用示例

#### 示例1: 最简单的批量分析
```bash
npx invariantx
```
**输出:**
```
InvariantX - 智能合约不变量发现系统
==========================================

🔍 检测中断的批量分析会话...
✅ 未发现相关中断会话，开始新分析
🔄 进入批量分析模式
📁 加载材料配置: ./configs/materials-config.json
🎉 批量分析完成!
```

#### 示例2: 单个合约分析（自动恢复）
```bash
npx invariantx ./examples/SimpleToken.sol
```
**输出:**
```
🔍 检测中断的分析会话...
✨ 发现高置信度的中断会话，自动恢复
🔄 会话: session_1735718400000_abc123def
   阶段: deepener (beta_challenge_2)
   进度: 65.4%
   中断时间: 3分钟前
   置信度: 85%
🔄 自动从中断处继续分析...

从 deepener 阶段第 2 轮恢复
✅ 会话恢复成功，从步骤 "deepener_alpha_round_3" 继续
```

#### 示例3: 强制新分析
```bash
npx invariantx --new ./examples/SimpleToken.sol
```
**输出:**
```
🆕 强制开始新分析（忽略中断会话）
📄 正在加载合约: ./examples/SimpleToken.sol
🚀 启动全新的不变量发现流程
```

#### 示例4: 带AI日志的分析
```bash
npx invariantx --log-ai
```
**输出:**
```
📝 AI通信记录已启用
[分析过程...]
📝 AI通信记录已保存到: ./ai-logs/ai-communication-2025-08-01T10-30-15-123Z.txt
```

### 双重API支持 (Fetch + Axios)
系统现在同时支持fetch和axios两种API调用方式，提供更高的稳定性：

- **自动降级**: 优先使用fetch，失败时自动切换到axios
- **超时控制**: 默认60秒超时，可配置
- **错误重试**: 智能重试机制，支持429错误处理
- **调用统计**: 详细的API调用统计和性能监控

### 使用示例
```bash
# 查看API调用统计
npx invariantx-recovery system
```

## 2. 会话管理和中断恢复

### 步骤级别的中断恢复
系统支持在任何步骤中断后恢复，包括：

- **Explorer阶段**: Alpha/Beta挑战的每一轮
- **Deepener阶段**: 深化分析的每个步骤  
- **Synthesizer阶段**: 最终合成过程
- **API调用级别**: 每个API调用前后的状态保存

### 混合存储策略
采用智能的内存+持久化混合策略：

- **高性能**: 内存中实时更新状态
- **智能持久化**: 基于时间、业务重要性、数据变化等多维度决策
- **自动恢复**: 程序重启后自动检测和恢复未完成的会话

## 3. 基本使用

### 开始新的分析
```bash
# 普通分析
npx invariantx discover ./examples/SimpleToken.sol

# 带配置文件的分析
npx invariantx discover ./examples/SimpleToken.sol --config ./my-config.json
```

### 中断恢复操作

#### 查看活跃会话
```bash
npx invariantx-recovery list
```
输出示例：
```
找到 2 个活跃会话:
  🔄 session_1735718400000_abc123def
     阶段: deepener (beta_challenge_2)
     进度: 65.4%
     最后更新: 2025-01-31 15:30:25

  🔄 session_1735718500000_xyz789ghi  
     阶段: explorer (alpha_round_3)
     进度: 25.8%
     最后更新: 2025-01-31 15:28:10
```

#### 查看会话详细状态
```bash
npx invariantx-recovery status session_1735718400000_abc123def
```
输出示例：
```
📊 会话状态: session_1735718400000_abc123def
阶段: deepener
子阶段: beta_challenge_2
当前轮次: 2/10
进度: 65.4%
下一步: deepener_alpha_round_3
API调用次数: 15
错误次数: 1
数据大小: 245KB
创建时间: 2025-01-31 15:25:00
最后保存: 2025-01-31 15:30:25

🔗 最后API调用:
  Agent: Deepener
  状态: completed
  重试次数: 1
  时间: 2025-01-31 15:30:20
```

#### 查看恢复选项
```bash
npx invariantx-recovery recovery session_1735718400000_abc123def
```
输出示例：
```
🔄 会话恢复信息: session_1735718400000_abc123def
可用恢复点: 5 个
预估丢失进度: 2.1%
可自动恢复: 是

📍 推荐恢复点:
  步骤ID: deepener_alpha_round_2
  描述: Deepener第2轮Alpha完成
  可恢复: 是
  时间: 2025-01-31 15:29:45

📋 所有恢复点:
  👉 deepener_alpha_round_2: Deepener第2轮Alpha完成
     时间: 2025-01-31 15:29:45
     explorer_completed: Explorer阶段完成
     时间: 2025-01-31 15:27:30
     deepener_start: Deepener阶段开始
     时间: 2025-01-31 15:27:35
```

#### 恢复中断的会话
```bash
npx invariantx-recovery resume session_1735718400000_abc123def ./examples/SimpleToken.sol
```
输出示例：
```
🔄 开始恢复会话: session_1735718400000_abc123def
📄 合约文件: ./examples/SimpleToken.sol

检测到中断会话，准备恢复
发现可恢复会话: session_1735718400000_abc123def
可用恢复点: 5 个
预估丢失进度: 2.1%
从 deepener 阶段第 2 轮恢复
✅ 会话恢复成功，从步骤 "deepener_alpha_round_3" 继续

阶段 2: Deepener 深化
[继续分析过程...]

✅ 会话恢复完成!
📊 发现不变量: 8 个
```

### 会话管理

#### 清理会话
```bash
# 交互式清理
npx invariantx-recovery clear session_1735718400000_abc123def

# 强制清理
npx invariantx-recovery clear session_1735718400000_abc123def --force
```

#### 查看系统状态
```bash
npx invariantx-recovery system
```
输出示例：
```
🖥️ 系统状态:
当前会话: session_1735718600000_current123

📊 会话管理器:
  活跃会话: 3
  内存使用: 512KB
  待持久化任务: 0

🌐 API管理器:
  总调用次数: 45
  成功次数: 43
  失败次数: 2
  平均响应时间: 2340ms
  方法使用: Fetch 40 次, Axios 5 次
```

## 4. 高级特性

### 智能恢复策略
系统根据以下因素自动决定恢复策略：

1. **时间间隔**: 中断时间短(<5分钟)自动恢复，长时间中断提供选择
2. **数据完整性**: 检查保存数据的完整性
3. **阶段重要性**: 关键阶段(如Synthesizer)优先保护
4. **错误类型**: 区分网络错误、API错误、程序错误

### 性能优化
- **批处理**: 低优先级的持久化操作批量处理
- **压缩存储**: 大数据自动压缩存储
- **内存管理**: 智能清理过期会话释放内存
- **并发处理**: 后台异步持久化不阻塞主流程

### 错误处理增强
- **多层重试**: API调用失败时的多层重试机制
- **方法切换**: Fetch失败自动切换Axios
- **超时控制**: 可配置的请求超时时间
- **错误分类**: 区分429限流、网络错误、API错误等

## 5. 配置选项

### 环境变量配置
```env
# API配置
API_ENDPOINT=https://api.anthropic.com/v1/messages
API_KEY=your_api_key
MODEL_NAME=claude-3-sonnet-20240229

# 超时和重试
REQUEST_TIMEOUT=60000
MAX_RETRIES=5
RETRY_DELAY_MS=1000

# 会话管理
SESSION_FORCE_PERSIST_INTERVAL=60000      # 1分钟强制持久化
SESSION_MAX_MEMORY_TIME=300000            # 5分钟最大内存保留
SESSION_MAX_MEMORY_SIZE=10485760          # 10MB内存限制
SESSION_AUTO_RECOVER=true                 # 自动恢复
```

### 会话配置自定义
```typescript
const customConfig = {
  persistence: {
    timeStrategy: {
      forceInterval: 30000,    // 30秒强制持久化
      maxMemoryTime: 120000,   // 2分钟最大内存保留
    },
    performanceStrategy: {
      compressionEnabled: true,  // 启用压缩
      batchWindow: 200,         // 200ms批处理窗口
    }
  },
  recovery: {
    autoRecover: true,
    maxRecoveryAttempts: 5,
    recoveryTimeout: 60000,   // 60秒恢复超时
  }
};
```

## 6. 故障排除

### 常见问题

#### API调用失败
```bash
# 测试API连接
npx invariantx config --check

# 查看详细错误日志
ls ai-logs/
```

#### 会话恢复失败
```bash
# 检查恢复信息
npx invariantx-recovery recovery <session-id>

# 强制清理损坏的会话
npx invariantx-recovery clear <session-id> --force
```

#### 内存使用过高
```bash
# 查看系统状态
npx invariantx-recovery system

# 清理所有旧会话
npx invariantx-recovery list
# 然后逐个清理不需要的会话
```

### 日志文件
- **AI通信日志**: `ai-logs/ai-communication-*.txt`
- **会话状态**: `.invariantx/sessions/`
- **恢复点**: `.invariantx/recovery/`
- **备份文件**: `.invariantx/backups/`

这些增强功能让InvariantX成为了一个更加健壮、用户友好的智能合约分析系统，支持长时间运行的复杂分析任务，并提供完善的中断恢复机制。