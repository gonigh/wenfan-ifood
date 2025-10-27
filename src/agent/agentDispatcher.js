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
     * 选择最合适的Agent
     * @param {string} message - 用户消息
     * @returns {Promise<BaseAgent|null>} 选中的Agent
     */
    async function selectAgent(message) {
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

            // 选择Agent
            const selectedAgent = await selectAgent(message);

            if (!selectedAgent) {
                throw new Error('没有可用的Agent');
            }

            currentAgent = selectedAgent;

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
