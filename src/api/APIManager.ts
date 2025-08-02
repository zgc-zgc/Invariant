import { APIConfig } from '../types';
import { APICallRecord } from '../types/SessionTypes';
import { aiLogger } from '../utils/AICommunicationLogger';
import { createLogger } from '../utils/Logger';
import axios, { AxiosResponse, AxiosError } from 'axios';

export class APIManager {
  private config: APIConfig;
  private logger = createLogger('APIManager');
  private apiCallHistory: Map<string, APICallRecord> = new Map();
  private readonly DEFAULT_TIMEOUT = 180000; // 180秒默认超时（增加3分钟以适应复杂的Deepener阶段）
  
  constructor(config: APIConfig) {
    this.config = config;
    this.setupAxiosDefaults();
  }
  
  
  async callAPI(prompt: string, agent?: string, sessionId?: string): Promise<string> {
    const callId = this.generateCallId();
    const callRecord: APICallRecord = {
      id: callId,
      sessionId: sessionId || 'unknown',
      agent: agent || 'Unknown',
      prompt,
      startTime: Date.now(),
      status: 'pending',
      retryCount: 0,
      method: 'fetch' // 默认方法，会动态调整
    };
    
    this.apiCallHistory.set(callId, callRecord);
    
    const { retryConfig } = this.config;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        callRecord.retryCount = attempt;
        
        // 先尝试fetch，失败后尝试axios
        let response: string;
        try {
          callRecord.method = 'fetch';
          response = await this.makeAPICallWithFetch(prompt, agent, callRecord);
        } catch (fetchError) {
          this.logger.warn(`Fetch调用失败，尝试axios: ${(fetchError as Error).message}`);
          callRecord.method = 'axios';
          response = await this.makeAPICallWithAxios(prompt, agent, callRecord);
        }
        
        // 成功时更新记录
        callRecord.status = 'completed';
        callRecord.response = response;
        callRecord.endTime = Date.now();
        callRecord.duration = callRecord.endTime - callRecord.startTime;
        
        return response;
      } catch (error) {
        lastError = error as Error;
        callRecord.error = lastError.message;
        
        // 检查是否是429错误
        if (this.is429Error(error) && retryConfig.handle429) {
          const delay = this.calculateBackoff(attempt);
          this.logger.info(`Rate limited, waiting ${delay}ms before retry ${attempt + 1}/${retryConfig.maxRetries}...`);
          await this.sleep(delay);
          continue;
        }
        
        // 其他错误也重试
        if (attempt < retryConfig.maxRetries) {
          const delay = this.calculateBackoff(attempt);
          this.logger.warn(`API call failed, retrying in ${delay}ms... (${attempt + 1}/${retryConfig.maxRetries})`);
          await this.sleep(delay);
          continue;
        }
        
        break;
      }
    }
    
    // 失败时更新记录
    callRecord.status = 'failed';
    callRecord.endTime = Date.now();
    callRecord.duration = callRecord.endTime! - callRecord.startTime;
    
    throw new Error(`API call failed after ${retryConfig.maxRetries} retries: ${lastError?.message}`);
  }
  
  
  private setupAxiosDefaults(): void {
    axios.defaults.timeout = this.DEFAULT_TIMEOUT;
    axios.defaults.headers.common['Content-Type'] = 'application/json';
    
    // axios请求拦截器
    axios.interceptors.request.use((config) => {
      this.logger.debug(`发起axios请求: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });
    
    // axios响应拦截器
    axios.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        this.logger.error(`Axios请求失败: ${error.message}`);
        return Promise.reject(error);
      }
    );
  }
  
  private generateCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private async makeAPICallWithFetch(prompt: string, agent?: string, callRecord?: APICallRecord): Promise<string> {
    const requestBody = this.buildRequestBody(prompt);
    
    // 记录发送的提示词
    aiLogger.logPrompt(agent || 'Unknown', prompt, {
      model: this.config.model,
      endpoint: this.config.endpoint,
      method: 'fetch'
    });
    
    const startTime = Date.now();
    
    // 创建AbortController用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.DEFAULT_TIMEOUT);
    
    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
          // 移除 anthropic-version 头部，保持 OpenAI 兼容格式
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = `HTTP ${response.status}: ${response.statusText}`;
        aiLogger.logSystem(`Fetch API调用失败: ${error}`, {
          status: response.status,
          statusText: response.statusText,
          method: 'fetch'
        });
        throw new Error(error);
      }
      
      const data = await response.json();
      const responseContent = this.extractResponseContent(data);
      const duration = Date.now() - startTime;
      
      // 记录AI的响应
      aiLogger.logResponse(agent || 'Unknown', responseContent, duration, {
        model: this.config.model,
        responseLength: responseContent.length,
        method: 'fetch'
      });
      
      return responseContent;
      
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`请求超时 (${this.DEFAULT_TIMEOUT}ms)`);
      }
      throw error;
    }
  }
  
  private async makeAPICallWithAxios(prompt: string, agent?: string, callRecord?: APICallRecord): Promise<string> {
    const requestBody = this.buildRequestBody(prompt);
    
    // 记录发送的提示词
    aiLogger.logPrompt(agent || 'Unknown', prompt, {
      model: this.config.model,
      endpoint: this.config.endpoint,
      method: 'axios'
    });
    
    const startTime = Date.now();
    
    try {
      const response: AxiosResponse = await axios.post(this.config.endpoint, requestBody, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
          // 移除 anthropic-version 头部，保持 OpenAI 兼容格式
        },
        timeout: this.DEFAULT_TIMEOUT
      });
      
      const responseContent = this.extractResponseContent(response.data);
      const duration = Date.now() - startTime;
      
      // 记录AI的响应
      aiLogger.logResponse(agent || 'Unknown', responseContent, duration, {
        model: this.config.model,
        responseLength: responseContent.length,
        method: 'axios'
      });
      
      return responseContent;
      
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.code === 'ECONNABORTED') {
          throw new Error(`Axios请求超时 (${this.DEFAULT_TIMEOUT}ms)`);
        }
        if (axiosError.response) {
          const errorMsg = `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`;
          aiLogger.logSystem(`Axios API调用失败: ${errorMsg}`, {
            status: axiosError.response.status,
            statusText: axiosError.response.statusText,
            method: 'axios'
          });
          throw new Error(errorMsg);
        }
      }
      throw error;
    }
  }
  
  // 连接测试方法
  async testConnection(): Promise<{ fetch: boolean; axios: boolean; errors: string[] }> {
    const testPrompt = "Hello, this is a connection test.";
    const errors: string[] = [];
    let fetchWorks = false;
    let axiosWorks = false;
    
    // 测试fetch
    try {
      await this.makeAPICallWithFetch(testPrompt, 'ConnectionTest');
      fetchWorks = true;
      this.logger.info('Fetch连接测试成功');
    } catch (error) {
      errors.push(`Fetch: ${(error as Error).message}`);
      this.logger.warn(`Fetch连接测试失败: ${(error as Error).message}`);
    }
    
    // 测试axios
    try {
      await this.makeAPICallWithAxios(testPrompt, 'ConnectionTest');
      axiosWorks = true;
      this.logger.info('Axios连接测试成功');
    } catch (error) {
      errors.push(`Axios: ${(error as Error).message}`);
      this.logger.warn(`Axios连接测试失败: ${(error as Error).message}`);
    }
    
    return { fetch: fetchWorks, axios: axiosWorks, errors };
  }
  
  // 获取API调用统计
  getCallStatistics(): {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageResponseTime: number;
    methodUsage: { fetch: number; axios: number };
  } {
    const calls = Array.from(this.apiCallHistory.values());
    const successfulCalls = calls.filter(c => c.status === 'completed');
    const failedCalls = calls.filter(c => c.status === 'failed');
    
    const avgResponseTime = successfulCalls.length > 0 
      ? successfulCalls.reduce((sum, c) => sum + (c.duration || 0), 0) / successfulCalls.length
      : 0;
    
    const fetchCalls = calls.filter(c => c.method === 'fetch').length;
    const axiosCalls = calls.filter(c => c.method === 'axios').length;
    
    return {
      totalCalls: calls.length,
      successfulCalls: successfulCalls.length,
      failedCalls: failedCalls.length,
      averageResponseTime: Math.round(avgResponseTime),
      methodUsage: { fetch: fetchCalls, axios: axiosCalls }
    };
  }

  private async makeAPICall(prompt: string, agent?: string): Promise<string> {
    const requestBody = this.buildRequestBody(prompt);
    
    // 记录发送的提示词
    aiLogger.logPrompt(agent || 'Unknown', prompt, {
      model: this.config.model,
      endpoint: this.config.endpoint
    });
    
    const startTime = Date.now();
    
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
        // 移除 anthropic-version 头部
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const error = `HTTP ${response.status}: ${response.statusText}`;
      aiLogger.logSystem(`API调用失败: ${error}`, {
        status: response.status,
        statusText: response.statusText
      });
      throw new Error(error);
    }
    
    const data = await response.json();
    const responseContent = this.extractResponseContent(data);
    const duration = Date.now() - startTime;
    
    // 记录AI的响应
    aiLogger.logResponse(agent || 'Unknown', responseContent, duration, {
      model: this.config.model,
      responseLength: responseContent.length
    });
    
    return responseContent;
  }
  
  private buildRequestBody(prompt: string): Record<string, any> {
    // 根据不同的API endpoint构建请求体
    if (this.config.endpoint.includes('anthropic')) {
      return {
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      };
    }
    
    // OpenAI格式
    if (this.config.endpoint.includes('openai')) {
      return {
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      };
    }
    
    // 通用格式
    return {
      model: this.config.model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };
  }
  
  private extractResponseContent(data: any): string {
    // Anthropic格式
    if (data.content && Array.isArray(data.content)) {
      return data.content[0].text;
    }
    
    // OpenAI格式
    if (data.choices && data.choices[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    
    // 通用格式尝试
    if (data.response) {
      return data.response;
    }
    
    if (data.text) {
      return data.text;
    }
    
    throw new Error('Unable to extract response content from API response');
  }
  
  private is429Error(error: any): boolean {
    return error.message?.includes('429') || 
           error.status === 429 ||
           error.message?.toLowerCase().includes('rate limit');
  }
  
  private calculateBackoff(attempt: number): number {
    // 指数退避算法
    const baseDelay = this.config.retryConfig.delayMs;
    return Math.min(baseDelay * Math.pow(2, attempt), 60000); // 最大60秒
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}