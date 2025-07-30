import * as fs from 'fs';
import * as path from 'path';

export interface AILogEntry {
  timestamp: string;
  type: 'PROMPT' | 'RESPONSE' | 'SYSTEM_LOG';
  agent?: string;
  content: string;
  metadata?: {
    duration?: number;
    error?: string;
    [key: string]: any;
  };
}

export class AICommunicationLogger {
  private static instance: AICommunicationLogger;
  private logBuffer: AILogEntry[] = [];
  private logFilePath: string;
  private isEnabled: boolean = false;
  private writeStream: fs.WriteStream | null = null;

  private constructor() {
    const logsDir = path.join(process.cwd(), 'ai-logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFilePath = path.join(logsDir, `ai-communication-${timestamp}.txt`);
  }

  static getInstance(): AICommunicationLogger {
    if (!AICommunicationLogger.instance) {
      AICommunicationLogger.instance = new AICommunicationLogger();
    }
    return AICommunicationLogger.instance;
  }

  enable(): void {
    this.isEnabled = true;
    this.writeStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
    console.log(`📝 AI通信记录已启用，日志文件: ${this.logFilePath}`);
    this.writeHeader();
  }

  disable(): void {
    this.isEnabled = false;
    if (this.writeStream) {
      this.flushBuffer();
      this.writeStream.end();
      this.writeStream = null;
    }
    console.log('📝 AI通信记录已关闭');
  }

  logPrompt(agent: string, prompt: string, metadata?: any): void {
    if (!this.isEnabled) return;
    
    const entry: AILogEntry = {
      timestamp: new Date().toISOString(),
      type: 'PROMPT',
      agent,
      content: prompt,
      metadata
    };
    
    this.addEntry(entry);
  }

  logResponse(agent: string, response: string, duration?: number, metadata?: any): void {
    if (!this.isEnabled) return;
    
    const entry: AILogEntry = {
      timestamp: new Date().toISOString(),
      type: 'RESPONSE',
      agent,
      content: response,
      metadata: { ...metadata, duration }
    };
    
    this.addEntry(entry);
  }

  logSystem(message: string, metadata?: any): void {
    if (!this.isEnabled) return;
    
    const entry: AILogEntry = {
      timestamp: new Date().toISOString(),
      type: 'SYSTEM_LOG',
      content: message,
      metadata
    };
    
    this.addEntry(entry);
  }

  private addEntry(entry: AILogEntry): void {
    this.logBuffer.push(entry);
    
    // 立即写入文件
    if (this.writeStream) {
      this.writeEntryToFile(entry);
    }
  }

  private writeHeader(): void {
    if (!this.writeStream) return;
    
    const header = `
================================================================================
InvariantX AI Communication Log
开始时间: ${new Date().toISOString()}
================================================================================

`;
    this.writeStream.write(header);
  }

  private writeEntryToFile(entry: AILogEntry): void {
    if (!this.writeStream) return;
    
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
    } else if (entry.type === 'RESPONSE') {
      output += '🟢 AI的回复:\n';
    } else {
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

  private flushBuffer(): void {
    // Buffer已经实时写入，这里只是确保所有内容都已写入
    if (this.writeStream) {
      this.writeStream.write('\n' + '='.repeat(80) + '\n');
      this.writeStream.write(`日志结束时间: ${new Date().toISOString()}\n`);
      this.writeStream.write('='.repeat(80) + '\n');
    }
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }

  isLoggingEnabled(): boolean {
    return this.isEnabled;
  }
}

// 导出单例
export const aiLogger = AICommunicationLogger.getInstance();