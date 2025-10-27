/**
 * CookAgent - 做饭Agent
 * 处理菜谱查询、菜单推荐、菜品管理等做饭相关事务
 */
class CookAgent extends BaseAgent {
    constructor() {
        super('CookAgent', '负责处理做饭相关的任务，包括菜谱查询、菜单推荐、菜品管理等');

        // 设置系统提示词
        this.systemPrompt = `你是一个专业的烹饪助手，精通各种菜谱和做饭技巧。你的职责包括：
1. 回答关于菜谱、烹饪方法的问题
2. 根据人数和需求推荐菜单
3. 提供详细的烹饪步骤和技巧
4. 帮助用户管理和查询菜品

你可以使用工具来查询菜谱数据库、生成菜单推荐。如果数据库中没有用户需要的菜谱，可以联网搜索。
请保持友好、专业的语气，并尽可能提供详细和实用的建议。`;

        this.keywords = [
            '做', '煮', '炒', '蒸', '煎', '炸', '烤', '炖', '煲',
            '菜谱', '菜单', '推荐', '食材', '步骤', '做法', '怎么做',
            '今天吃什么', '吃什么', '菜品', '料理', '烹饪'
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
                score += 20;
            }
        }

        // 常见模式匹配
        if (messageLower.match(/.*怎么做|.*的做法|.*食谱|.*菜谱/)) {
            score += 30;
        }

        if (messageLower.match(/推荐.*菜|.*人.*菜单|今天吃什么/)) {
            score += 30;
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

            let hasToolCalls = false;
            let toolCallsToExecute = null;

            // 流式调用API
            const result = await this.callDeepSeekStream(
                this.conversationHistory,
                (content) => {
                    if (!hasToolCalls) {
                        updateMessage(botMessageId, content);
                    }
                },
                (toolCalls) => {
                    hasToolCalls = true;
                    toolCallsToExecute = toolCalls;
                },
                { tools: RecipeTools.toolsDefinition }
            );

            // 处理工具调用
            if (hasToolCalls && toolCallsToExecute) {
                updateMessage(botMessageId, '');

                // 添加 assistant 的工具调用消息
                this.addToHistory('assistant', result.content || null, { tool_calls: toolCallsToExecute });

                // 执行工具并添加工具结果到历史
                const { menuResult, recipeResult, recipeNotFound } = await this.handleToolCalls(toolCallsToExecute, botMessageId, context);

                // 显示菜谱详情（直接渲染，不需要再次调用API）
                if (recipeResult) {
                    const contentDiv = document.getElementById(botMessageId).querySelector('.message-content');
                    contentDiv.id = botMessageId + '-content';
                    RecipeDetail.render(recipeResult, contentDiv.id);

                    // 添加一条说明性的assistant消息到历史
                    const summaryMessage = `已为用户显示了《${recipeResult.name}》的详细做法。`;
                    this.addToHistory('assistant', summaryMessage);
                }
                // 联网搜索
                else if (recipeNotFound) {
                    const searchedRecipe = await this.searchRecipeOnline(recipeNotFound, botMessageId, context);

                    if (searchedRecipe) {
                        // 添加一条说明性的assistant消息到历史
                        const summaryMessage = `已通过联网搜索找到《${searchedRecipe.name}》的做法并展示给用户。`;
                        this.addToHistory('assistant', summaryMessage);
                    } else {
                        // 搜索失败，让AI根据工具结果生成回复
                        const finalResult = await this.callDeepSeekStream(
                            this.conversationHistory,
                            (content) => updateMessage(botMessageId, content),
                            () => { }
                        );
                        this.addToHistory('assistant', finalResult.content);
                    }
                }
                // 显示菜单卡片
                else if (menuResult) {
                    updateMessage(botMessageId, '', menuResult);
                    // 添加一条说明性的assistant消息到历史
                    const summaryMessage = `已为用户推荐了${menuResult.peopleCount}人份的菜单，包含${menuResult.dishes.length}道菜。`;
                    this.addToHistory('assistant', summaryMessage);
                } else {
                    // 没有特殊处理，让AI根据工具结果生成回复
                    const finalResult = await this.callDeepSeekStream(
                        this.conversationHistory,
                        (content) => updateMessage(botMessageId, content),
                        () => { }
                    );
                    this.addToHistory('assistant', finalResult.content);
                }

            } else {
                // 没有工具调用，直接添加assistant回复
                this.addToHistory('assistant', result.content);
            }

        } catch (error) {
            updateMessage(botMessageId, '❌ 发生错误: ' + error.message);
            console.error(`${this.name}:`, error);
        }
    }

    /**
     * 处理工具调用
     * @param {Array} toolCalls - 工具调用列表
     * @param {string} botMessageId - 机器人消息ID
     * @param {Object} context - 上下文信息
     * @returns {Promise<Object>} 处理结果
     */
    async handleToolCalls(toolCalls, botMessageId, context) {
        let menuResult = null;
        let recipeResult = null;
        let recipeNotFound = null;

        for (const toolCall of toolCalls) {
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);
            const functionResult = RecipeTools.executeTool(functionName, functionArgs);

            if (functionName === 'getMenu' && functionResult.dishes) {
                menuResult = functionResult;
            }

            if (functionName === 'getRecipe' && functionResult.success && functionResult.recipe) {
                recipeResult = functionResult.recipe;
            }

            if (functionName === 'getRecipe' && functionResult.error) {
                recipeNotFound = functionArgs.dishName;
            }

            this.addToHistory('tool', JSON.stringify(functionResult), { tool_call_id: toolCall.id });
        }

        return { menuResult, recipeResult, recipeNotFound };
    }

    /**
     * 联网搜索菜品做法
     * @param {string} dishName - 菜品名称
     * @param {string} messageId - 消息ID
     * @param {Object} context - 上下文信息
     * @returns {Promise<Object|null>}
     */
    async searchRecipeOnline(dishName, messageId, context) {
        const { updateMessage, addMessage } = context.uiCallbacks;

        try {
            const searchMessages = [
                { role: 'system', content: '你是一个专业的菜谱助手。请联网搜索用户指定的菜品做法，并严格按照JSON格式返回。' },
                {
                    role: 'user',
                    content: `请联网搜索"${dishName}"的详细做法，并按照以下JSON格式返回（只返回JSON，不要其他内容）：

{
  "name": "菜品名称",
  "description": "菜品简介（50字左右）",
  "category": "菜品分类（荤菜/素菜/汤羹/主食/小吃/饮品等）",
  "difficulty": 难度等级（1-5的数字）,
  "servings": 份数（数字）,
  "ingredients": [{"name": "食材名", "text_quantity": "用量"}],
  "steps": [{"step": 1, "description": "步骤描述"}],
  "prep_time_minutes": 准备时间（数字，分钟）,
  "cook_time_minutes": 烹饪时间（数字，分钟）,
  "additional_notes": ["小贴士1", "小贴士2"]
}`
                }
            ];

            updateMessage(messageId, '🔍 正在联网搜索并整理菜品做法...');

            const result = await this.callDeepSeekStream(
                searchMessages,
                () => {},
                () => {},
                { webSearch: true, temperature: 0.3 }
            );

            let content = result.content;
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                content = jsonMatch[1];
            }

            const recipeData = JSON.parse(content.trim());
            if (!recipeData.name || !recipeData.category) {
                throw new Error('返回的菜品数据格式不完整');
            }

            recipeData.id = 'searched-' + Date.now();
            recipeData.source_path = 'online';
            recipeData.tags = recipeData.tags || [recipeData.category];
            recipeData.total_time_minutes = (recipeData.prep_time_minutes || 0) + (recipeData.cook_time_minutes || 0);

            const contentDiv = document.getElementById(messageId).querySelector('.message-content');
            contentDiv.id = messageId + '-content';
            RecipeDetail.render(recipeData, contentDiv.id);

            const addToLibraryBtn = document.createElement('button');
            addToLibraryBtn.className = 'add-to-library-btn';
            addToLibraryBtn.innerHTML = '📥 将这道菜加入我的菜品库';
            addToLibraryBtn.onclick = () => {
                const result = RecipeTools.addRecipe(recipeData);
                if (result.success) {
                    addToLibraryBtn.innerHTML = '✅ 已加入菜品库';
                    addToLibraryBtn.disabled = true;
                    addMessage('bot', `✨ "${recipeData.name}"已成功加入你的菜品库！`);
                } else {
                    alert('加入失败：' + result.error);
                }
            };
            contentDiv.appendChild(addToLibraryBtn);

            return recipeData;

        } catch (error) {
            console.error(`${this.name}: 联网搜索失败:`, error);
            updateMessage(messageId, `❌ 联网搜索失败：${error.message}`);
            return null;
        }
    }

}