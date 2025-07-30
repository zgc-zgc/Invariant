import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LoggerConfig {
  level: LogLevel;
  writeToFile?: boolean;
  logFilePath?: string;
  showTimestamp?: boolean;
  showModule?: boolean;
}

export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private logStream?: fs.WriteStream;

  private constructor(config?: LoggerConfig) {
    this.config = config || {
      level: LogLevel.INFO,
      showTimestamp: true,
      showModule: true
    };

    if (this.config.writeToFile && this.config.logFilePath) {
      const logDir = path.dirname(this.config.logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      this.logStream = fs.createWriteStream(this.config.logFilePath, { flags: 'a' });
    }
  }

  static getInstance(config?: LoggerConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  static configure(config: LoggerConfig): void {
    Logger.instance = new Logger(config);
  }

  private formatMessage(level: string, module: string, message: string): string {
    const parts: string[] = [];
    
    if (this.config.showTimestamp) {
      const now = new Date();
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      parts.push(`[${timestamp}]`);
    }
    
    parts.push(`[${level}]`);
    
    if (this.config.showModule && module) {
      parts.push(`[${module}]`);
    }
    
    parts.push(message);
    
    return parts.join(' ');
  }

  private log(level: LogLevel, levelStr: string, module: string, message: string): void {
    if (level < this.config.level) return;

    const formattedMessage = this.formatMessage(levelStr, module, message);
    
    // 控制台输出
    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }

    // 文件输出
    if (this.logStream) {
      this.logStream.write(formattedMessage + '\n');
    }
  }

  debug(module: string, message: string): void {
    this.log(LogLevel.DEBUG, 'DEBUG', module, message);
  }

  info(module: string, message: string): void {
    this.log(LogLevel.INFO, 'INFO', module, message);
  }

  warn(module: string, message: string): void {
    this.log(LogLevel.WARN, 'WARN', module, message);
  }

  error(module: string, message: string): void {
    this.log(LogLevel.ERROR, 'ERROR', module, message);
  }

  // 特殊格式化方法
  separator(): void {
    if (LogLevel.INFO >= this.config.level) {
      const line = '='.repeat(80);
      console.log(line);
      if (this.logStream) {
        this.logStream.write(line + '\n');
      }
    }
  }

  phase(phase: string): void {
    if (LogLevel.INFO >= this.config.level) {
      const message = `=== ${phase} ===`;
      console.log(`\n${message}`);
      if (this.logStream) {
        this.logStream.write(`\n${message}\n`);
      }
    }
  }

  close(): void {
    if (this.logStream) {
      this.logStream.end();
    }
  }
}

// 创建模块化的logger工厂
export function createLogger(module: string) {
  const logger = Logger.getInstance();
  return {
    debug: (message: string) => logger.debug(module, message),
    info: (message: string) => logger.info(module, message),
    warn: (message: string) => logger.warn(module, message),
    error: (message: string) => logger.error(module, message)
  };
}