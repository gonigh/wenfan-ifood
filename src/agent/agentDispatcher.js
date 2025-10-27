/**
 * AgentDispatcher - Agent调度器
 * 负责根据用户消息选择合适的Agent来处理
 */
const AgentDispatcher = (function() {
    let agents = [];
    let apiKey = null;
    let currentAgent = null;
    let uiCallbacks = {};
    let suggestionAgent = null;
    let lastUserMessage = '';
    let lastAssistantMessage = '';
    let conversationHistory = []; // 调度器级别的对话历史

    /**
     * 初始化调度器
     * @param {string} key - API密钥
     * @param {Object} callbacks - UI回调函数
     */
    function init(key, callbacks) {
        apiKey = key;
        uiCallbacks = callbacks;

        // 注册所有Agent
        agents = [
            new CookAgent(),
            new FoodFinderAgent()
        ];

        // 初始化推荐问句Agent
        suggestionAgent = new SuggestionAgent();
        suggestionAgent.init(apiKey);

        // 初始化所有Agent
        agents.forEach(agent => agent.init(apiKey));
    }

    /**
     * 使用AI识别用户意图
     * @param {string} message - 用户消息
     * @returns {Promise<Object>} { needsClarification: boolean, intent: 'cook'|'restaurant'|'unclear' }
     */
    async function analyzeUserIntent(message) {
        const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

        try {
            const messages = [
                ...conversationHistory,
                {
                    role: 'system',
                    content: `你是一个意图识别助手。判断用户的问题是关于：
1. "自己做饭" - 用户想知道做什么菜、菜谱、做法等
2. "找店吃" - 用户想找餐厅、外出就餐、附近美食等
3. "不明确" - 问题太模糊，无法判断是做饭还是找店

请只返回JSON格式: {"intent": "cook|restaurant|unclear", "confidence": 0-100}`
                },
                {
                    role: 'user',
                    content: message
                }
            ];

            const response = await fetch(DEEPSEEK_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: messages,
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                throw new Error('意图识别失败');
            }

            const data = await response.json();
            const content = data.choices[0].message.content;

            // 尝试提取JSON
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                return {
                    needsClarification: result.intent === 'unclear',
                    intent: result.intent,
                    confidence: result.confidence || 0
                };
            }

            return { needsClarification: false, intent: 'cook', confidence: 0 };

        } catch (error) {
            console.error('AgentDispatcher: 意图识别失败:', error);
            // 失败时不进行澄清，直接使用默认逻辑
            return { needsClarification: false, intent: 'cook', confidence: 0 };
        }
    }

    /**
     * 显示意图澄清选项（使用推荐问句形式）
     * @param {string} originalMessage - 原始消息
     */
    async function showIntentClarification(originalMessage) {
        const botMessageId = 'bot-msg-' + Date.now();
        uiCallbacks.addMessage('bot', '🤔 你是想自己做饭吃，还是找店吃呢？', botMessageId);

        // 显示澄清问句作为建议
        const clarificationQuestions = [
            '我想自己做饭',
            '我想找店吃'
        ];

        // 使用现有的 showSuggestions 机制
        uiCallbacks.showSuggestions(clarificationQuestions, async (selectedQuestion) => {
            // 记录用户选择到对话历史
            conversationHistory.push({ role: 'user', content: originalMessage });
            conversationHistory.push({ role: 'assistant', content: '你是想自己做饭吃，还是找店吃呢？' });
            conversationHistory.push({ role: 'user', content: selectedQuestion });

            if (selectedQuestion.includes('自己做饭')) {
                // 用户选择自己做饭
                await dispatchToAgent('CookAgent', '推荐今天做什么菜');
            } else if (selectedQuestion.includes('找店')) {
                // 用户选择找店吃
                await dispatchToAgent('FoodFinderAgent', '附近有什么好吃的推荐？');
            }
        });
    }

    /**
     * 选择最合适的Agent
     * @param {string} message - 用户消息
     * @param {string} intentHint - 意图提示 ('cook'|'restaurant')
     * @returns {Promise<BaseAgent|null>} 选中的Agent
     */
    async function selectAgent(message, intentHint = null) {
        // 如果有明确的意图提示，直接返回对应Agent
        if (intentHint === 'cook') {
            return agents.find(a => a.name === 'CookAgent');
        }
        if (intentHint === 'restaurant') {
            return agents.find(a => a.name === 'FoodFinderAgent');
        }

        const scores = [];

        // 获取每个Agent的置信度分数
        for (const agent of agents) {
            const score = await agent.canHandle(message);
            scores.push({ agent, score });
        }

        // 按分数排序
        scores.sort((a, b) => b.score - a.score);

        // 如果最高分数大于阈值(30)，则选择该Agent
        if (scores[0].score > 30) {
            return scores[0].agent;
        }

        // 否则使用默认Agent (CookAgent)
        return agents.find(a => a.name === 'CookAgent');
    }

    /**
     * 调度消息到合适的Agent
     * @param {string} message - 用户消息
     */
    async function dispatch(message) {
        try {
            // 保存用户消息
            lastUserMessage = message;

            // 使用AI分析用户意图
            const intentAnalysis = await analyzeUserIntent(message);
            console.log('AgentDispatcher: 意图分析结果:', intentAnalysis);

            // 如果意图不明确，显示澄清选项
            if (intentAnalysis.needsClarification) {
                await showIntentClarification(message);
                return;
            }

            // 根据意图选择Agent
            const selectedAgent = await selectAgent(message, intentAnalysis.intent);

            if (!selectedAgent) {
                throw new Error('没有可用的Agent');
            }

            currentAgent = selectedAgent;

            // 记录对话历史
            conversationHistory.push({ role: 'user', content: message });

            // 调用Agent处理消息
            await currentAgent.handleMessage(message, {
                uiCallbacks,
                dispatcher: this
            });

            // 获取最新的助手回复（从对话历史中）
            const history = currentAgent.getHistory();
            const lastAssistantMsg = history.filter(m => m.role === 'assistant').pop();
            if (lastAssistantMsg) {
                lastAssistantMessage = lastAssistantMsg.content || '';
                conversationHistory.push({ role: 'assistant', content: lastAssistantMessage });
            }

            // 生成推荐问句
            const suggestions = await getSuggestions(lastUserMessage, lastAssistantMessage);
            uiCallbacks.showSuggestions(suggestions);

        } catch (error) {
            console.error('AgentDispatcher: 调度失败:', error);
            uiCallbacks.addMessage('bot', `❌ 系统错误: ${error.message}`);
        }
    }

    /**
     * 获取推荐问句
     * @param {string} userMessage - 用户消息
     * @param {string} assistantMessage - 助手回复
     * @returns {Promise<Array<string>>}
     */
    async function getSuggestions(userMessage, assistantMessage) {
        if (!suggestionAgent) {
            return [];
        }
        return await suggestionAgent.generateSuggestions(userMessage, assistantMessage);
    }

    /**
     * 重置所有Agent的对话历史
     */
    function resetAllAgents() {
        agents.forEach(agent => agent.resetConversation());
        currentAgent = null;
        conversationHistory = []; // 清空调度器的对话历史
    }

    /**
     * 获取当前Agent
     * @returns {BaseAgent|null}
     */
    function getCurrentAgent() {
        return currentAgent;
    }

    /**
     * 获取所有注册的Agent
     * @returns {Array<BaseAgent>}
     */
    function getAllAgents() {
        return agents;
    }

    /**
     * 手动指定Agent处理消息
     * @param {string} agentName - Agent名称
     * @param {string} message - 用户消息
     */
    async function dispatchToAgent(agentName, message) {
        const agent = agents.find(a => a.name === agentName);
        if (!agent) {
            throw new Error(`未找到Agent: ${agentName}`);
        }

        currentAgent = agent;
        await agent.handleMessage(message, {
            uiCallbacks,
            dispatcher: this
        });
    }

    // 暴露公共接口
    return {
        init,
        dispatch,
        selectAgent,
        resetAllAgents,
        getCurrentAgent,
        getAllAgents,
        dispatchToAgent,
        getSuggestions
    };
})();
