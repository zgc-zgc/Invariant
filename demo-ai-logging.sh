#!/bin/bash
# InvariantX AI通信记录演示脚本

echo "🔧 InvariantX AI通信记录功能演示"
echo "================================="
echo ""
echo "此脚本演示如何使用 --log-ai 参数来记录系统与AI的通信内容"
echo ""

# 检查示例合约是否存在
if [ ! -f "./examples/SimpleToken.sol" ]; then
    echo "❌ 错误：找不到示例合约文件 ./examples/SimpleToken.sol"
    echo "请确保项目根目录下存在 examples/SimpleToken.sol 文件"
    exit 1
fi

echo "✅ 找到示例合约: ./examples/SimpleToken.sol"
echo ""
echo "📝 启动带有AI通信记录的不变量发现分析..."
echo ""
echo "执行命令: npx invariantx discover ./examples/SimpleToken.sol --log-ai --verbose"
echo ""
echo "按Enter继续..."
read

# 运行命令
npx invariantx discover ./examples/SimpleToken.sol --log-ai --verbose

echo ""
echo "✅ 分析完成！"
echo ""
echo "📂 AI通信记录已保存到 ai-logs/ 目录"
echo "📝 使用以下命令查看最新的AI通信记录："
echo ""
echo "   cat ai-logs/ai-communication-*.txt"
echo ""
echo "记录内容包括："
echo "  - 🔵 发送给AI的完整提示词"
echo "  - 🟢 AI的完整响应内容"
echo "  - ⚪ 系统运行日志"
echo "  - 📊 调用元数据（耗时、模型信息等）"