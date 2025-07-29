import dotenv from 'dotenv';
import { APIConfig, ConvergenceConfig } from '../types';

dotenv.config();

export class ConfigManager {
  private static instance: ConfigManager;
  
  private constructor() {}
  
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }
  
  getAPIConfig(): APIConfig {
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
  
  getConvergenceConfig(): ConvergenceConfig {
    return {
      minRounds: parseInt(process.env.MIN_ROUNDS || '3'),
      maxRounds: parseInt(process.env.MAX_ROUNDS || '10'),
      discoveryThreshold: parseFloat(process.env.DISCOVERY_THRESHOLD || '0.1'),
      maxChallengeRounds: parseInt(process.env.MAX_CHALLENGE_ROUNDS || '5'),
      challengeConvergenceThreshold: parseFloat(process.env.CHALLENGE_CONVERGENCE_THRESHOLD || '0.75')
    };
  }
  
  isDebugMode(): boolean {
    return process.env.DEBUG === 'true';
  }
  
  getLogLevel(): string {
    return process.env.LOG_LEVEL || 'info';
  }
}