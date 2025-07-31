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
exports.Logger = exports.LogLevel = void 0;
exports.createLogger = createLogger;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    constructor(config) {
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
    static getInstance(config) {
        if (!Logger.instance) {
            Logger.instance = new Logger(config);
        }
        return Logger.instance;
    }
    static configure(config) {
        Logger.instance = new Logger(config);
    }
    formatMessage(level, module, message) {
        const parts = [];
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
    log(level, levelStr, module, message) {
        if (level < this.config.level)
            return;
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
    debug(module, message) {
        this.log(LogLevel.DEBUG, 'DEBUG', module, message);
    }
    info(module, message) {
        this.log(LogLevel.INFO, 'INFO', module, message);
    }
    warn(module, message) {
        this.log(LogLevel.WARN, 'WARN', module, message);
    }
    error(module, message) {
        this.log(LogLevel.ERROR, 'ERROR', module, message);
    }
    // 特殊格式化方法
    separator() {
        if (LogLevel.INFO >= this.config.level) {
            const line = '='.repeat(80);
            console.log(line);
            if (this.logStream) {
                this.logStream.write(line + '\n');
            }
        }
    }
    phase(phase) {
        if (LogLevel.INFO >= this.config.level) {
            const message = `=== ${phase} ===`;
            console.log(`\n${message}`);
            if (this.logStream) {
                this.logStream.write(`\n${message}\n`);
            }
        }
    }
    close() {
        if (this.logStream) {
            this.logStream.end();
        }
    }
}
exports.Logger = Logger;
// 创建模块化的logger工厂
function createLogger(module) {
    const logger = Logger.getInstance();
    return {
        debug: (message) => logger.debug(module, message),
        info: (message) => logger.info(module, message),
        warn: (message) => logger.warn(module, message),
        error: (message) => logger.error(module, message)
    };
}
//# sourceMappingURL=Logger.js.map