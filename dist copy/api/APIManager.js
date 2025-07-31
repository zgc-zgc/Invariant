"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIManager = void 0;
const AICommunicationLogger_1 = require("../utils/AICommunicationLogger");
class APIManager {
    constructor(config) {
        this.config = config;
    }
    async callAPI(prompt, agent) {
        const { retryConfig } = this.config;
        let lastError = null;
        for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
            try {
                const response = await this.makeAPICall(prompt, agent);
                return response;
            }
            catch (error) {
                lastError = error;
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
    async makeAPICall(prompt, agent) {
        const requestBody = this.buildRequestBody(prompt);
        // 记录发送的提示词
        AICommunicationLogger_1.aiLogger.logPrompt(agent || 'Unknown', prompt, {
            model: this.config.model,
            endpoint: this.config.endpoint
        });
        const startTime = Date.now();
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
            const error = `HTTP ${response.status}: ${response.statusText}`;
            AICommunicationLogger_1.aiLogger.logSystem(`API调用失败: ${error}`, {
                status: response.status,
                statusText: response.statusText
            });
            throw new Error(error);
        }
        const data = await response.json();
        const responseContent = this.extractResponseContent(data);
        const duration = Date.now() - startTime;
        // 记录AI的响应
        AICommunicationLogger_1.aiLogger.logResponse(agent || 'Unknown', responseContent, duration, {
            model: this.config.model,
            responseLength: responseContent.length
        });
        return responseContent;
    }
    buildRequestBody(prompt) {
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
    extractResponseContent(data) {
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
    is429Error(error) {
        return error.message?.includes('429') ||
            error.status === 429 ||
            error.message?.toLowerCase().includes('rate limit');
    }
    calculateBackoff(attempt) {
        // 指数退避算法
        const baseDelay = this.config.retryConfig.delayMs;
        return Math.min(baseDelay * Math.pow(2, attempt), 60000); // 最大60秒
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.APIManager = APIManager;
//# sourceMappingURL=APIManager.js.map