# InvariantX 恢复机制修复说明

## 🎉 已修复的问题

### 1. API重试过程中手动中断不创建恢复点 ✅

**问题描述**：
- 当API调用超时并进入重试循环时，用户按Ctrl+C中断程序
- 系统没有创建恢复点，导致下次运行从头开始

**解决方案**：
- 在 `ChallengeSystem` 中添加了进程中断处理器
- 当检测到 SIGINT (Ctrl+C) 或 SIGTERM 信号时，自动创建恢复点
- 恢复点包含当前正在执行的API调用信息

**实现细节**：
```typescript
// ChallengeSystem 构造函数中注册中断处理器
this.setupInterruptHandler();

// 在 safeCallAPI 中跟踪当前API调用状态
this.currentAPICall = { prompt, agentRole, context, startTime };

// 中断时创建恢复点
process.once('SIGINT', async () => {
  if (this.currentAPICall) {
    await this.createRecoveryPointOnFailure(...);
  }
});
```

### 2. 使用 --new 参数时仍显示"从中断处继续" ✅

**问题描述**：
- 使用 `--new` 参数应该开始全新分析
- 但 ProgressManager 仍然加载了之前的状态文件

**解决方案**：
- 在 CLI 中添加了状态文件清理逻辑
- 使用 `--new` 时同时清理恢复点文件和进度状态文件

**实现细节**：
```typescript
// 清理恢复点文件
await sessionManager.clearRecoveryPoint();

// 清理进度状态文件
const stateFilePath = materialsConfig.replace('.json', '.state.json');
await fs.unlink(stateFilePath);
```

## 📋 使用说明

### 正常使用流程

1. **开始新分析**：
   ```bash
   npx invariantx --new
   ```

2. **从中断处继续**（API失败或手动中断后）：
   ```bash
   npx invariantx
   ```

3. **查看详细日志**：
   ```bash
   npx invariantx --log-ai
   ```

### 恢复点机制

系统现在会在以下情况创建恢复点：

1. **API调用最终失败**：当所有重试都失败后
2. **用户手动中断**：当用户按Ctrl+C时（新增）
3. **进程异常终止**：当系统崩溃时

恢复点文件位置：`.invariantx/recovery/latest.recovery.json`

### 批量分析进度

- 进度文件：`materials-config.state.json`
- 使用 `--new` 会清理此文件，确保从头开始

## 🔍 调试和验证

### 测试中断恢复

运行测试脚本：
```bash
node test-interrupt-recovery.js
```

然后在提示时按 Ctrl+C，再运行：
```bash
node check-recovery.js
```

### 查看恢复点内容

```bash
cat .invariantx/recovery/latest.recovery.json | jq .
```

## ⚠️ 注意事项

1. **恢复点覆盖**：新的恢复点会覆盖旧的，系统只保留最新的失败点
2. **会话一致性**：恢复时使用相同的会话ID确保状态连续
3. **API配置**：确保恢复时的API配置与中断时一致

## 🛠️ 故障排查

如果恢复机制仍有问题：

1. **启用DEBUG日志**：
   ```bash
   LOG_LEVEL=DEBUG npx invariantx
   ```

2. **检查关键日志**：
   - `🔍 safeCallAPI: 准备调用API`
   - `🛑 检测到进程中断`
   - `🔄 恢复点已更新`

3. **验证文件权限**：
   确保 `.invariantx/recovery/` 目录可写

4. **运行诊断工具**：
   ```bash
   node diagnostic-recovery.js
   ```

## 📝 技术细节

恢复点包含以下信息：
- 会话ID
- 失败阶段（explorer/deepener/synthesizer）
- 失败的AI代理角色
- 失败的提示词
- 错误信息和计数
- 完整的执行快照

这确保了系统可以从任何失败点精确恢复。