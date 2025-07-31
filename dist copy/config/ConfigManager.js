"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class ConfigManager {
    constructor() { }
    static getInstance() {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
    getAPIConfig() {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            throw new Error('API_KEY environment variable is required');
        }
        return {
            endpoint: process.env.API_ENDPOINT || 'https://api.anthropic.com/v1/messages',
            apiKey,
            model: process.env.MODEL_NAME || 'claude-3-sonnet-20240229',
            retryConfig: {
                enabled: process.env.RETRY_ENABLED !== 'false',
                maxRetries: parseInt(process.env.MAX_RETRIES || '5'),
                delayMs: parseInt(process.env.RETRY_DELAY_MS || '1000'),
                handle429: process.env.HANDLE_429 !== 'false'
            }
        };
    }
    getConvergenceConfig() {
        return {
            minRounds: parseInt(process.env.MIN_ROUNDS || '3'),
            maxRounds: parseInt(process.env.MAX_ROUNDS || '10'),
            discoveryThreshold: parseFloat(process.env.DISCOVERY_THRESHOLD || '0.1'),
            maxChallengeRounds: parseInt(process.env.MAX_CHALLENGE_ROUNDS || '5'),
            challengeConvergenceThreshold: parseFloat(process.env.CHALLENGE_CONVERGENCE_THRESHOLD || '0.75')
        };
    }
    isDebugMode() {
        return process.env.DEBUG === 'true';
    }
    getLogLevel() {
        return process.env.LOG_LEVEL || 'info';
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=ConfigManager.js.map