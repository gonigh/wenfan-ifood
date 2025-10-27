/**
 * FoodFinderAgent - 找美食Agent
 * 处理找餐厅、美食推荐、探店等相关事务
 */
class FoodFinderAgent extends BaseAgent {
    constructor() {
        super('FoodFinderAgent', '负责处理找美食的任务，包括餐厅推荐、美食探店、附近美食等');

        // 设置系统提示词
        this.systemPrompt = `你是一个专业的美食向导，擅长推荐餐厅和美食探店。你的职责包括：
1. 根据用户需求推荐合适的餐厅
2. 提供附近美食、餐馆的信息
3. 介绍特色菜品和餐厅特点
4. 帮助用户做出就餐选择

你可以使用以下工具：
- searchNearby: 搜索附近的美食餐厅。**会自动通过IP定位识别用户位置，无需询问用户**。
  支持按关键词、类型、距离筛选，返回详细的餐厅信息包括名称、地址、电话、评分、人均消费等。

使用工具时的注意事项：
1. 当用户询问"附近"、"周边"美食时，**直接调用 searchNearby 工具，不要询问用户位置**，系统会自动定位
2. 可以根据用户需求设置搜索关键词（如"火锅"、"川菜"）和搜索半径
3. 使用 show_fields 参数 "business,photos" 获取详细的商业信息（营业时间、电话、评分等）
4. 优先使用 searchNearby 工具获取真实数据，而不是联网搜索
5. 调用 searchNearby 时，location 参数留空即可，系统会自动定位

请保持友好、热情的语气，并提供实用的就餐建议。`;

        this.keywords = [
            '餐厅', '饭店', '馆子', '探店', '附近', '周边',
            '外出吃', '去哪吃', '吃饭的地方', '美食', '小吃',
            '推荐店', '哪里有', '好吃的店', '餐馆'
        ];
    }

    /**
     * 初始化Agent，包括设置高德地图API Key
     * @param {string} apiKey - DeepSeek API密钥
     */
    init(apiKey) {
        super.init(apiKey);
    }

    /**
     * 判断是否能处理此消息
     * @param {string} message - 用户消息
     * @returns {Promise<number>} 置信度分数 (0-100)
     */
    async canHandle(message) {
        const messageLower = message.toLowerCase();
        let score = 0;

        // 关键词匹配
        for (const keyword of this.keywords) {
            if (messageLower.includes(keyword)) {
                score += 25;
            }
        }

        // 常见模式匹配
        if (messageLower.match(/附近.*餐厅|哪里.*好吃|推荐.*店|去哪.*吃/)) {
            score += 30;
        }

        if (messageLower.match(/外出|出去吃|外面吃|下馆子/)) {
            score += 25;
        }

        return Math.min(score, 100);
    }

    /**
     * 执行工具调用
     * @param {Array} toolCalls - 工具调用列表
     * @param {string} messageId - 消息ID，用于渲染组件
     * @param {Function} updateMessage - 更新消息的回调
     * @returns {Promise<Object>} { results: Array, hasRendered: boolean }
     */
    async executeToolCalls(toolCalls, messageId, updateMessage) {
        const results = [];
        let hasRendered = false; // 标记是否已经渲染了组件

        for (const toolCall of toolCalls) {
            const functionName = toolCall.function.name;
            let args;

            try {
                args = JSON.parse(toolCall.function.arguments);
            } catch (e) {
                console.error(`${this.name}: 解析工具参数失败:`, e);
                results.push({
                    tool_call_id: toolCall.id,
                    role: 'tool',
                    name: functionName,
                    content: JSON.stringify({ error: '参数解析失败' })
                });
                continue;
            }

            try {
                let result;

                if (functionName === 'searchNearby') {
                    // 调用高德地图搜索工具
                    result = await AmapTools.searchNearby(args);

                    // 如果搜索成功，使用RestaurantList组件渲染结果
                    if (result.success && result.pois && result.pois.length > 0) {
                        const messageDiv = document.getElementById(messageId);
                        if (messageDiv) {
                            const contentDiv = messageDiv.querySelector('.message-content');
                            if (contentDiv) {
                                // 清空内容并渲染餐厅列表
                                contentDiv.innerHTML = '';
                                contentDiv.id = messageId + '-content';
                                RestaurantList.render(result.pois, contentDiv.id, result.locationInfo);
                                hasRendered = true; // 标记已渲染
                            }
                        }
                    } else if (result.success && result.pois && result.pois.length === 0) {
                        // 没有结果时显示提示
                        updateMessage(messageId, '😔 附近暂时没有找到餐厅，试试换个位置或关键词？');
                        hasRendered = true;
                    } else if (!result.success) {
                        // 搜索失败时显示错误
                        updateMessage(messageId, `❌ 搜索失败: ${result.error}`);
                        hasRendered = true;
                    }
                } else {
                    result = { error: `未知的工具: ${functionName}` };
                }

                results.push({
                    tool_call_id: toolCall.id,
                    role: 'tool',
                    name: functionName,
                    content: JSON.stringify(result)
                });


            } catch (error) {
                console.error(`${this.name}: 工具 ${functionName} 执行失败:`, error);
                results.push({
                    tool_call_id: toolCall.id,
                    role: 'tool',
                    name: functionName,
                    content: JSON.stringify({ error: error.message })
                });
            }
        }

        return { results, hasRendered };
    }

    /**
     * 处理用户消息
     * @param {string} message - 用户消息
     * @param {Object} context - 上下文信息
     */
    async handleMessage(message, context) {
        const { addMessage, updateMessage, showSuggestions } = context.uiCallbacks;
        const botMessageId = 'bot-msg-' + Date.now();
        addMessage('bot', '', botMessageId);

        try {
            this.addToHistory('user', message);

            // 准备工具定义
            const tools = AmapTools.toolsDefinition;

            let continueLoop = true;
            let loopCount = 0;
            const MAX_LOOPS = 5; // 防止无限循环

            while (continueLoop && loopCount < MAX_LOOPS) {
                loopCount++;

                // 调用API
                const result = await this.callDeepSeekStream(
                    this.conversationHistory,
                    (content) => updateMessage(botMessageId, content),
                    async (toolCalls) => {
                        // 工具调用回调
                        console.log(`${this.name}: 收到工具调用请求`, toolCalls);
                    },
                    {
                        tools: tools,
                        webSearch: !tools // 如果没有工具，使用联网搜索
                    }
                );

                // 检查是否有工具调用
                if (result.tool_calls && result.tool_calls.length > 0) {
                    // 添加助手消息（包含工具调用）
                    this.addToHistory('assistant', result.content || null, {
                        tool_calls: result.tool_calls
                    });

                    // 执行工具调用
                    updateMessage(botMessageId, '🔍 正在搜索附近的美食...');
                    const { results: toolResults, hasRendered } = await this.executeToolCalls(result.tool_calls, botMessageId, updateMessage);

                    // 添加工具结果到历史
                    for (const toolResult of toolResults) {
                        this.addToHistory('tool', toolResult.content, {
                            tool_call_id: toolResult.tool_call_id,
                            name: toolResult.name
                        });
                    }

                    // 如果已经渲染了组件（餐厅列表），直接结束，不再继续调用AI
                    if (hasRendered) {
                        continueLoop = false;
                    } else {
                        // 显示工具执行状态
                        updateMessage(botMessageId, '🔍 正在分析搜索结果...');
                        // 继续循环，让AI处理工具结果
                        continueLoop = true;
                    }

                } else {
                    // 没有工具调用，添加最终响应
                    this.addToHistory('assistant', result.content);
                    continueLoop = false;
                }
            }

            if (loopCount >= MAX_LOOPS) {
                console.warn(`${this.name}: 达到最大循环次数，停止处理`);
                updateMessage(botMessageId, updateMessage(botMessageId, '⚠️ 处理超时，请稍后重试'));
            }

        } catch (error) {
            updateMessage(botMessageId, '❌ 发生错误: ' + error.message);
            console.error(`${this.name}:`, error);
        }
    }
}
