/**
 * BaseAgent - Agent基类
 * 所有专门的Agent都应该继承此基类
 */
class BaseAgent {
    constructor(name, description) {
        this.name = name;
        this.description = description;
        this.apiKey = null;
        this.conversationHistory = [];
    }

    /**
     * 初始化Agent
     * @param {string} apiKey - API密钥
     */
    init(apiKey) {
        this.apiKey = apiKey;
        this.conversationHistory = [];

        // 如果子类定义了系统提示词，添加到历史记录开头
        if (this.systemPrompt) {
            this.conversationHistory.push({
                role: 'system',
                content: this.systemPrompt
            });
        }

        console.log(`${this.name}: 已初始化`);
    }

    /**
     * 重置对话历史
     */
    resetConversation() {
        this.conversationHistory = [];

        // 重新添加系统提示词
        if (this.systemPrompt) {
            this.conversationHistory.push({
                role: 'system',
                content: this.systemPrompt
            });
        }

        console.log(`${this.name}: 对话历史已重置`);
    }

    /**
     * 判断该Agent是否能处理此消息
     * @param {string} message - 用户消息
     * @returns {Promise<number>} 置信度分数 (0-100)
     */
    async canHandle(message) {
        throw new Error('子类必须实现 canHandle 方法');
    }

    /**
     * 处理用户消息
     * @param {string} message - 用户消息
     * @param {Object} context - 上下文信息
     * @returns {Promise<void>}
     */
    async handleMessage(message, context) {
        throw new Error('子类必须实现 handleMessage 方法');
    }

    /**
     * 流式调用 DeepSeek API
     * @param {Array} messages - 消息历史
     * @param {Function} onChunk - 流式内容回调
     * @param {Function} onToolCall - 工具调用回调
     * @param {Object} options - 可选参数
     * @returns {Promise<Object>} API响应结果
     */
    async callDeepSeekStream(messages, onChunk, onToolCall, options = {}) {
        const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

        const requestBody = {
            model: 'deepseek-chat',
            messages: messages,
            tools: options.tools || undefined,
            temperature: options.temperature || 0.7,
            stream: true
        };

        if (options.webSearch) {
            requestBody.web_search = true;
        }

        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || '调用API失败');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let toolCalls = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.trim() || line.trim() === 'data: [DONE]') continue;
                if (!line.startsWith('data: ')) continue;

                try {
                    const jsonStr = line.slice(6);
                    const data = JSON.parse(jsonStr);
                    const delta = data.choices?.[0]?.delta;

                    if (delta?.content) {
                        fullContent += delta.content;
                        onChunk(fullContent);
                    }

                    if (delta?.tool_calls) {
                        for (const tc of delta.tool_calls) {
                            if (tc.index !== undefined) {
                                if (!toolCalls[tc.index]) {
                                    toolCalls[tc.index] = {
                                        id: tc.id || '',
                                        type: tc.type || 'function',
                                        function: { name: '', arguments: '' }
                                    };
                                }
                                const currentToolCall = toolCalls[tc.index];
                                if (tc.id) currentToolCall.id = tc.id;
                                if (tc.function?.name) currentToolCall.function.name = tc.function.name;
                                if (tc.function?.arguments) currentToolCall.function.arguments += tc.function.arguments;
                            }
                        }
                    }

                    if (data.choices?.[0]?.finish_reason === 'tool_calls') {
                        onToolCall(toolCalls);
                    }
                } catch (e) {
                    console.error(`${this.name}: 解析流式数据失败:`, e);
                }
            }
        }

        return {
            content: fullContent,
            tool_calls: toolCalls.length > 0 ? toolCalls : null
        };
    }

    /**
     * 添加消息到对话历史
     * @param {string} role - 角色 (user/assistant/tool)
     * @param {string} content - 消息内容
     * @param {Object} extra - 额外信息
     */
    addToHistory(role, content, extra = {}) {
        const message = {
            role,
            content,
            ...extra
        };
        this.conversationHistory.push(message);
    }

    /**
     * 获取对话历史
     * @returns {Array} 对话历史
     */
    getHistory() {
        return this.conversationHistory;
    }

    /**
     * 打印对话历史（调试用）
     */
    printHistory() {
        console.log(`${this.name}: ===== 对话历史 (${this.conversationHistory.length} 条消息) =====`);
        this.conversationHistory.forEach((msg, index) => {
            const preview = msg.content ? msg.content.substring(0, 100) : '(null)';
            console.log(`${index + 1}. [${msg.role}]:`, preview);
            if (msg.tool_calls) {
                console.log(`   工具调用:`, msg.tool_calls.map(tc => tc.function.name));
            }
            if (msg.tool_call_id) {
                console.log(`   工具ID:`, msg.tool_call_id);
            }
        });
        console.log(`${this.name}: ===== 历史结束 =====`);
    }
}
