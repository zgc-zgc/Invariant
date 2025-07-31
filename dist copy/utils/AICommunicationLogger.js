"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiLogger = exports.AICommunicationLogger = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class AICommunicationLogger {
    constructor() {
        this.logBuffer = [];
        this.isEnabled = false;
        this.writeStream = null;
        const logsDir = path.join(process.cwd(), 'ai-logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.logFilePath = path.join(logsDir, `ai-communication-${timestamp}.txt`);
    }
    static getInstance() {
        if (!AICommunicationLogger.instance) {
            AICommunicationLogger.instance = new AICommunicationLogger();
        }
        return AICommunicationLogger.instance;
    }
    enable() {
        this.isEnabled = true;
        this.writeStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
        console.log(`📝 AI通信记录已启用，日志文件: ${this.logFilePath}`);
        this.writeHeader();
    }
    disable() {
        this.isEnabled = false;
        if (this.writeStream) {
            this.flushBuffer();
            this.writeStream.end();
            this.writeStream = null;
        }
        console.log('📝 AI通信记录已关闭');
    }
    logPrompt(agent, prompt, metadata) {
        if (!this.isEnabled)
            return;
        const entry = {
            timestamp: new Date().toISOString(),
            type: 'PROMPT',
            agent,
            content: prompt,
            metadata
        };
        this.addEntry(entry);
    }
    logResponse(agent, response, duration, metadata) {
        if (!this.isEnabled)
            return;
        const entry = {
            timestamp: new Date().toISOString(),
            type: 'RESPONSE',
            agent,
            content: response,
            metadata: { ...metadata, duration }
        };
        this.addEntry(entry);
    }
    logSystem(message, metadata) {
        if (!this.isEnabled)
            return;
        const entry = {
            timestamp: new Date().toISOString(),
            type: 'SYSTEM_LOG',
            content: message,
            metadata
        };
        this.addEntry(entry);
    }
    addEntry(entry) {
        this.logBuffer.push(entry);
        // 立即写入文件
        if (this.writeStream) {
            this.writeEntryToFile(entry);
        }
    }
    writeHeader() {
        if (!this.writeStream)
            return;
        const header = `
================================================================================
InvariantX AI Communication Log
开始时间: ${new Date().toISOString()}
================================================================================

`;
        this.writeStream.write(header);
    }
    writeEntryToFile(entry) {
        if (!this.writeStream)
            return;
        let output = `\n${'='.repeat(80)}\n`;
        output += `[${entry.timestamp}] ${entry.type}`;
        if (entry.agent) {
            output += ` - Agent: ${entry.agent}`;
        }
        if (entry.metadata?.duration) {
            output += ` - 耗时: ${(entry.metadata.duration / 1000).toFixed(2)}s`;
        }
        output += '\n' + '-'.repeat(80) + '\n';
        if (entry.type === 'PROMPT') {
            output += '🔵 发送给AI的提示词:\n';
        }
        else if (entry.type === 'RESPONSE') {
            output += '🟢 AI的回复:\n';
        }
        else {
            output += '⚪ 系统日志:\n';
        }
        output += entry.content;
        if (entry.metadata && Object.keys(entry.metadata).length > 0) {
            output += '\n\n📊 元数据:\n';
            output += JSON.stringify(entry.metadata, null, 2);
        }
        output += '\n';
        this.writeStream.write(output);
    }
    flushBuffer() {
        // Buffer已经实时写入，这里只是确保所有内容都已写入
        if (this.writeStream) {
            this.writeStream.write('\n' + '='.repeat(80) + '\n');
            this.writeStream.write(`日志结束时间: ${new Date().toISOString()}\n`);
            this.writeStream.write('='.repeat(80) + '\n');
        }
    }
    getLogFilePath() {
        return this.logFilePath;
    }
    isLoggingEnabled() {
        return this.isEnabled;
    }
}
exports.AICommunicationLogger = AICommunicationLogger;
// 导出单例
exports.aiLogger = AICommunicationLogger.getInstance();
//# sourceMappingURL=AICommunicationLogger.js.map