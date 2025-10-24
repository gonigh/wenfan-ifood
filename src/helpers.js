// 应用辅助函数模块
const AppHelpers = (function() {
    
    /**
     * 联网搜索菜品做法
     * @param {string} dishName - 菜品名称
     * @param {string} messageId - 消息ID
     * @param {string} apiKey - API密钥
     * @param {Function} updateMessageFn - 更新消息的回调函数
     * @param {Function} addMessageFn - 添加消息的回调函数
     * @returns {Promise<Object|null>} 菜品数据或null
     */
    async function searchRecipeOnline(dishName, messageId, apiKey, updateMessageFn, addMessageFn) {
        const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
        
        try {
            // 构建搜索提示
            const searchMessages = [
                {
                    role: 'system',
                    content: '你是一个专业的菜谱助手。请联网搜索用户指定的菜品做法，并严格按照JSON格式返回。'
                },
                {
                    role: 'user',
                    content: `请联网搜索"${dishName}"的详细做法，并按照以下JSON格式返回（只返回JSON，不要其他内容）：

{
  "name": "菜品名称",
  "description": "菜品简介（50字左右）",
  "category": "菜品分类（荤菜/素菜/汤羹/主食/小吃/饮品等）",
  "difficulty": 难度等级（1-5的数字）,
  "servings": 份数（数字）,
  "ingredients": [
    {"name": "食材名", "text_quantity": "用量"}
  ],
  "steps": [
    {"step": 1, "description": "步骤描述"}
  ],
  "prep_time_minutes": 准备时间（数字，分钟）,
  "cook_time_minutes": 烹饪时间（数字，分钟）,
  "additional_notes": ["小贴士1", "小贴士2"]
}

要求：
1. 必须是有效的JSON格式
2. ingredients和steps必须是数组
3. 所有时间用数字表示
4. difficulty必须是1-5之间的整数`
                }
            ];

            updateMessageFn(messageId, '🔍 正在联网搜索并整理菜品做法...');

            // 调用API进行联网搜索
            const response = await fetch(DEEPSEEK_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: searchMessages,
                    temperature: 0.3,
                    web_search: true  // 启用联网搜索
                })
            });

            if (!response.ok) {
                throw new Error('联网搜索失败');
            }

            const data = await response.json();
            let content = data.choices[0].message.content;

            // 提取JSON内容（可能被包裹在markdown代码块中）
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                content = jsonMatch[1];
            }

            // 解析JSON
            const recipeData = JSON.parse(content.trim());

            // 验证必需字段
            if (!recipeData.name || !recipeData.category) {
                throw new Error('返回的菜品数据格式不完整');
            }

            // 添加额外字段
            recipeData.id = 'searched-' + Date.now();
            recipeData.source_path = 'online';
            recipeData.tags = recipeData.tags || [recipeData.category];
            recipeData.total_time_minutes = (recipeData.prep_time_minutes || 0) + (recipeData.cook_time_minutes || 0);

            // 渲染菜品详情
            const contentDiv = document.getElementById(messageId).querySelector('.message-content');
            contentDiv.id = messageId + '-content';
            RecipeDetail.render(recipeData, contentDiv.id);

            // 添加"加入菜品库"按钮
            const addToLibraryBtn = document.createElement('button');
            addToLibraryBtn.className = 'add-to-library-btn';
            addToLibraryBtn.innerHTML = '📥 将这道菜加入我的菜品库';
            addToLibraryBtn.onclick = () => {
                // 调用addRecipe工具
                const result = RecipeTools.addRecipe(recipeData);
                if (result.success) {
                    addToLibraryBtn.innerHTML = '✅ 已加入菜品库';
                    addToLibraryBtn.disabled = true;
                    
                    // 显示成功提示
                    addMessageFn('bot', `✨ "${recipeData.name}"已成功加入你的菜品库！下次可以直接查询这道菜的做法。`);
                } else {
                    alert('加入失败：' + result.error);
                }
            };

            contentDiv.appendChild(addToLibraryBtn);

            // 添加提示消息
            const tipDiv = document.createElement('div');
            tipDiv.className = 'online-recipe-tip';
            tipDiv.textContent = '💡 这是通过联网搜索整理的菜谱，你可以将它保存到菜品库中';
            contentDiv.appendChild(tipDiv);

            return recipeData;

        } catch (error) {
            console.error('联网搜索菜品失败:', error);
            updateMessageFn(messageId, `❌ 联网搜索失败：${error.message}\n\n很抱歉，无法找到"${dishName}"的做法。请尝试：\n1. 检查菜品名称是否正确\n2. 尝试使用更常见的菜名\n3. 或者描述一下你想做的菜，我来帮你推荐类似的菜品`);
            return null;
        }
    }

    /**
     * 通过AI生成后续问题建议
     * @param {Array} conversationHistory - 对话历史
     * @param {string} apiKey - API密钥
     * @returns {Promise<Array<string>>} 建议问题列表
     */
    async function generateSuggestionsWithAI(conversationHistory, apiKey) {
        const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
        
        try {
            // 构建生成建议的提示
            const suggestionMessages = [
                ...conversationHistory,
                {
                    role: 'user',
                    content: '请根据我们的对话，生成3-4个我可能会问的后续问题。要求：\n1. 每个问题独立一行\n2. 不要编号\n3. 问题要简短（10字以内）\n4. 问题要与当前对话相关\n5. 只输出问题，不要其他内容\n\n例如：\n今天吃什么？\n麻婆豆腐怎么做？\n推荐2人的菜单'
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
                    messages: suggestionMessages,
                    temperature: 0.8,
                    max_tokens: 200
                })
            });

            if (!response.ok) {
                throw new Error('生成建议失败');
            }

            const data = await response.json();
            const content = data.choices[0].message.content;

            // 解析返回的问题列表
            const questions = content
                .split('\n')
                .map(q => q.trim())
                .filter(q => q && !q.match(/^[\d\.\-\*]+/) && q.length > 2 && q.length < 30)
                .slice(0, 4);

            return questions.length > 0 ? questions : getDefaultSuggestions();
        } catch (error) {
            console.error('AI生成建议失败:', error);
            return getDefaultSuggestions();
        }
    }

    /**
     * 获取默认建议（作为后备）
     * @returns {Array<string>} 默认建议问题列表
     */
    function getDefaultSuggestions() {
        const defaults = [
            ['今天吃什么？', '推荐一份4人的菜单', '麻婆豆腐怎么做？', '有什么快手菜？'],
            ['推荐家常菜', '宫保鸡丁的做法', '有什么凉菜？', '推荐2人菜单'],
            ['今天吃什么？', '有什么汤可以做？', '西红柿炒鸡蛋怎么做？', '推荐素菜']
        ];
        return defaults[Math.floor(Math.random() * defaults.length)];
    }

    /**
     * 显示建议问题
     * @param {Array<string>} questions - 建议问题列表
     * @param {Function} sendMessageFn - 发送消息的回调函数
     */
    function showSuggestions(questions, sendMessageFn) {
        const chatArea = document.getElementById('chatArea');

        // 移除之前的建议
        const oldSuggestions = chatArea.querySelector('.suggestions');
        if (oldSuggestions && !oldSuggestions.closest('.welcome-msg')) {
            oldSuggestions.remove();
        }

        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'suggestions';
        suggestionsDiv.style.margin = '20px auto';
        suggestionsDiv.style.maxWidth = '400px';

        questions.forEach(question => {
            const btn = document.createElement('button');
            btn.className = 'suggestion-btn';
            btn.textContent = question;
            btn.onclick = () => {
                document.getElementById('userInput').value = question;
                sendMessageFn();
            };
            suggestionsDiv.appendChild(btn);
        });

        chatArea.appendChild(suggestionsDiv);
    }

    /**
     * 处理查看菜谱
     * @param {string} dishName - 菜品名称
     * @param {Function} sendMessageFn - 发送消息的回调函数
     */
    function handleViewRecipe(dishName, sendMessageFn) {
        // 从菜谱数据中查找菜品
        const recipe = window.recipesData.find(r => 
            r.name === dishName || 
            r.name.includes(dishName) || 
            dishName.includes(r.name.replace('的做法', ''))
        );

        if (recipe) {
            // 找到菜品数据，直接显示详情组件
            const messageId = 'recipe-detail-' + Date.now();
            const chatArea = document.getElementById('chatArea');
            
            // 移除欢迎消息
            const welcome = chatArea.querySelector('.welcome-msg');
            if (welcome) welcome.remove();
            
            // 创建消息容器
            const msgDiv = document.createElement('div');
            msgDiv.className = 'message bot';
            msgDiv.id = messageId;
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.id = messageId + '-content';
            
            msgDiv.appendChild(contentDiv);
            chatArea.appendChild(msgDiv);
            
            // 渲染菜品详情
            RecipeDetail.render(recipe, contentDiv.id);
        } else {
            // 未找到菜品数据，使用AI回答
            const input = document.getElementById('userInput');
            input.value = `${dishName}怎么做？`;
            sendMessageFn();
        }
    }

    /**
     * 绑定初始建议按钮的点击事件
     * @param {Function} sendMessageFn - 发送消息的回调函数
     */
    function bindSuggestionButtons(sendMessageFn) {
        const suggestionButtons = document.querySelectorAll('.suggestion-btn');
        suggestionButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('userInput').value = btn.textContent;
                sendMessageFn();
            });
        });
    }

    // 暴露公共接口
    return {
        searchRecipeOnline,
        generateSuggestionsWithAI,
        getDefaultSuggestions,
        showSuggestions,
        handleViewRecipe,
        bindSuggestionButtons
    };
})();

