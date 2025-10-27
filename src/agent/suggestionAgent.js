/**
 * SuggestionAgent - 推荐问句Agent
 * 只根据最新的一问一答，预测接下来最有可能的问题
 */
class SuggestionAgent extends BaseAgent {
    constructor() {
        super('SuggestionAgent', '负责生成推荐问句');
    }

    /**
     * 判断是否能处理此消息
     * SuggestionAgent不直接处理用户消息，由其他Agent调用
     * @returns {Promise<number>}
     */
    async canHandle() {
        return 0;
    }

    /**
     * 生成推荐问句
     * @param {string} userMessage - 用户最新的消息
     * @param {string} assistantMessage - 助手最新的回复
     * @returns {Promise<Array<string>>} 推荐的问题列表
     */
    async generateSuggestions(userMessage, assistantMessage) {
        try {
            // 只使用最新的一问一答
            const suggestionMessages = [
                {
                    role: 'system',
                    content: '你是一个智能问题推荐助手。根据用户的最后一个问题和助手的回答，预测用户接下来最有可能的问题或者回答。'
                },
                {
                    role: 'user',
                    content: userMessage
                },
                {
                    role: 'assistant',
                    content: assistantMessage
                },
                {
                    role: 'user',
                    content: '基于上面的对话，生成3-4个我接下来最可能输入的下一句话。要求：\n1. 每个问题独立一行\n2. 不要编号\n3. 问题要简短（10字以内）\n4. 问题要与刚才的对话紧密相关\n5. 只输出问题，不要其他内容'
                }
            ];

            const result = await this.callDeepSeekStream(
                suggestionMessages,
                () => {},
                () => {},
                { temperature: 0.8 }
            );

            // 解析生成的问题
            const questions = result.content
                .split('\n')
                .map(q => q.trim())
                .filter(q => q && !q.match(/^[\d\.\-\*]+/) && q.length > 2 && q.length < 30)
                .slice(0, 4);

            return questions.length > 0 ? questions : this.getDefaultSuggestions();
        } catch (error) {
            console.error(`${this.name}: 生成建议失败:`, error);
            return this.getDefaultSuggestions();
        }
    }

    /**
     * 获取默认建议（兜底方案）
     * @returns {Array<string>}
     */
    getDefaultSuggestions() {
        const defaults = [
            ['今天吃什么？', '推荐一份4人的菜单', '麻婆豆腐怎么做？', '有什么快手菜？'],
            ['推荐家常菜', '宫保鸡丁的做法', '有什么凉菜？', '推荐2人菜单'],
            ['今天吃什么？', '有什么汤可以做？', '西红柿炒鸡蛋怎么做？', '推荐素菜']
        ];
        return defaults[Math.floor(Math.random() * defaults.length)];
    }

    /**
     * handleMessage 方法（不实际使用，满足基类要求）
     */
    async handleMessage() {
        throw new Error('SuggestionAgent 不直接处理消息，请使用 generateSuggestions 方法');
    }
}
