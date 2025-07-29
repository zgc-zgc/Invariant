import { APIConfig } from '../types';

export class APIManager {
  private config: APIConfig;
  
  constructor(config: APIConfig) {
    this.config = config;
  }
  
  async callAPI(prompt: string): Promise<string> {
    const { retryConfig } = this.config;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const response = await this.makeAPICall(prompt);
        return response;
      } catch (error) {
        lastError = error as Error;
        
        // 检查是否是429错误
        if (this.is429Error(error) && retryConfig.handle429) {
          const delay = this.calculateBackoff(attempt);
          console.log(`Rate limited, waiting ${delay}ms before retry ${attempt + 1}/${retryConfig.maxRetries}...`);
          await this.sleep(delay);
          continue;
        }
        
        // 其他错误也重试
        if (attempt < retryConfig.maxRetries) {
          const delay = this.calculateBackoff(attempt);
          console.log(`API call failed, retrying in ${delay}ms... (${attempt + 1}/${retryConfig.maxRetries})`);
          await this.sleep(delay);
          continue;
        }
        
        break;
      }
    }
    
    throw new Error(`API call failed after ${retryConfig.maxRetries} retries: ${lastError?.message}`);
  }
  
  private async makeAPICall(prompt: string): Promise<string> {
    const requestBody = this.buildRequestBody(prompt);
    
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return this.extractResponseContent(data);
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