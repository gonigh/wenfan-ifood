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

你会使用联网搜索来获取最新的餐厅信息、用户评价和推荐。
请保持友好、热情的语气，并提供实用的就餐建议。`;

        this.keywords = [
            '餐厅', '饭店', '馆子', '探店', '附近', '周边',
            '外出吃', '去哪吃', '吃饭的地方', '美食', '小吃',
            '推荐店', '哪里有', '好吃的店', '餐馆'
        ];
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

            // 调用联网搜索获取美食信息
            const result = await this.callDeepSeekStream(
                this.conversationHistory,
                (content) => updateMessage(botMessageId, content),
                () => {},
                { webSearch: true }
            );

            this.addToHistory('assistant', result.content);

        } catch (error) {
            updateMessage(botMessageId, '❌ 发生错误: ' + error.message);
            console.error(`${this.name}:`, error);
        }
    }
}
