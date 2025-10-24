// 等待DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {

    const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
    
    // 默认提供的 API Key（仅供体验，大规模使用请替换为自己的）
    const DEFAULT_API_KEY = 'sk-b04c564fe6cc41bda7b5d23591415cf7';

    let apiKey = null;
    let conversationHistory = [];

    // 加载菜谱数据
    function loadRecipes() {
        try {
            // 直接从全局变量获取数据
            if (window.recipesData) {
                RecipeTools.initRecipes(window.recipesData);
                console.log(`已加载 ${window.recipesData.length} 道菜谱`);
            } else {
                throw new Error('菜谱数据未加载');
            }
        } catch (error) {
            console.error('加载菜谱数据失败:', error);
            addMessage('bot', '⚠️ 菜谱数据加载失败，部分功能可能无法使用');
        }
    }

    // 初始化 AI
    function initAI() {
        const inputKey = document.getElementById('apiKey').value.trim();
        if (inputKey) {
            apiKey = inputKey;
        }
        // 如果还是没有 apiKey（理论上不会，因为有默认值），则提示
        if (!apiKey) {
            addMessage('bot', '⚠️ API Key 未设置，请检查配置');
            document.getElementById('settingsPanel').classList.add('active');
            return false;
        }
        return true;
    }

    // 调用DeepSeek API（流式）
    async function callDeepSeekStream(messages, onChunk, onToolCall, options = {}) {
        const requestBody = {
            model: 'deepseek-chat',
            messages: messages,
            tools: options.disableTools ? undefined : RecipeTools.toolsDefinition,
            temperature: 0.7,
            stream: true
        };
        
        // 如果需要联网搜索，添加web_search参数
        if (options.webSearch) {
            requestBody.web_search = true;
        }
        
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
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
        let currentToolCall = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 保留不完整的行

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
                                currentToolCall = toolCalls[tc.index];

                                if (tc.id) currentToolCall.id = tc.id;
                                if (tc.function?.name) currentToolCall.function.name = tc.function.name;
                                if (tc.function?.arguments) currentToolCall.function.arguments += tc.function.arguments;
                            }
                        }
                    }

                    // 检查finish_reason
                    if (data.choices?.[0]?.finish_reason === 'tool_calls') {
                        onToolCall(toolCalls);
                    }
                } catch (e) {
                    console.error('解析流式数据失败:', e, line);
                }
            }
        }

        return {
            content: fullContent,
            tool_calls: toolCalls.length > 0 ? toolCalls : null
        };
    }

    // 发送消息
    async function sendMessage() {
        const input = document.getElementById('userInput');
        const message = input.value.trim();

        if (!message) return;

        if (!initAI()) return;

        // 显示用户消息
        addMessage('user', message);
        input.value = '';

        // 创建一个bot消息容器用于流式输出
        const botMessageId = 'bot-msg-' + Date.now();
        addMessage('bot', '', botMessageId);

        try {
            // 添加用户消息到历史
            conversationHistory.push({
                role: 'user',
                content: message
            });

            let hasToolCalls = false;
            let toolCallsToExecute = null;

            // 流式调用API
            const result = await callDeepSeekStream(
                conversationHistory,
                (content) => {
                    // 实时更新UI以显示流式效果
                    // 注意：如果后续检测到工具调用，这部分内容会被覆盖
                    if (!hasToolCalls) {
                        updateMessage(botMessageId, content);
                    }
                },
                (toolCalls) => {
                    hasToolCalls = true;
                    toolCallsToExecute = toolCalls;
                }
            );

            // 处理工具调用
            if (hasToolCalls && toolCallsToExecute) {
                // 清空之前流式显示的内容（如果有）
                updateMessage(botMessageId, '');
                
                // 添加助手消息到历史（包含tool_calls）
                conversationHistory.push({
                    role: 'assistant',
                    content: result.content || null,
                    tool_calls: toolCallsToExecute
                });

                // 执行所有工具调用，并检查是否有特殊数据需要渲染
                let menuResult = null;
                let recipeResult = null;
                let recipeNotFound = null;
                for (const toolCall of toolCallsToExecute) {
                    const functionName = toolCall.function.name;
                    const functionArgs = JSON.parse(toolCall.function.arguments);
                    const functionResult = RecipeTools.executeTool(functionName, functionArgs);

                    // 如果是getMenu工具，保存结果用于特殊渲染
                    if (functionName === 'getMenu' && functionResult.dishes) {
                        menuResult = functionResult;
                    }

                    // 如果是getRecipe工具且成功找到菜谱，保存结果用于详情组件渲染
                    if (functionName === 'getRecipe' && functionResult.success && functionResult.recipe) {
                        recipeResult = functionResult.recipe;
                    }
                    
                    // 如果是getRecipe工具但未找到菜谱，记录菜品名称用于联网搜索
                    if (functionName === 'getRecipe' && functionResult.error) {
                        recipeNotFound = functionArgs.dishName;
                    }

                    conversationHistory.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(functionResult)
                    });
                }

                // 如果有菜谱详情数据，直接显示详情组件
                if (recipeResult) {
                    // 创建消息容器
                    const contentDiv = document.getElementById(botMessageId).querySelector('.message-content');
                    contentDiv.id = botMessageId + '-content';
                    
                    // 渲染菜品详情
                    RecipeDetail.render(recipeResult, contentDiv.id);
                    
                    // 添加简化的助手回答到历史
                    conversationHistory.push({
                        role: 'assistant',
                        content: `已为用户显示了《${recipeResult.name}》的详细做法。`
                    });
                } 
                // 如果需要联网搜索菜品做法
                else if (recipeNotFound) {
                    // 调用AI联网搜索并总结菜品做法
                    const searchedRecipe = await AppHelpers.searchRecipeOnline(
                        recipeNotFound, 
                        botMessageId, 
                        apiKey, 
                        updateMessage, 
                        addMessage
                    );
                    
                    if (searchedRecipe) {
                        // 添加助手回答到历史
                        conversationHistory.push({
                            role: 'assistant',
                            content: `已通过联网搜索找到《${searchedRecipe.name}》的做法并展示给用户。`
                        });
                    } else {
                        // 搜索失败，显示常规AI回答
                        const finalResult = await callDeepSeekStream(
                            conversationHistory,
                            (content) => {
                                updateMessage(botMessageId, content);
                            },
                            () => { }
                        );
                        conversationHistory.push({
                            role: 'assistant',
                            content: finalResult.content
                        });
                    }
                }
                // 如果有菜单数据，直接显示卡片
                else if (menuResult) {
                    updateMessage(botMessageId, '', menuResult);
                    
                    // 添加简化的助手回答到历史（用于AI生成建议）
                    conversationHistory.push({
                        role: 'assistant',
                        content: `已为用户推荐了${menuResult.peopleCount}人份的菜单，包含${menuResult.dishes.length}道菜。`
                    });
                } else {
                    // 流式调用API获取最终回答（第一次不显示，直接显示最终结果）
                    const finalResult = await callDeepSeekStream(
                        conversationHistory,
                        (content) => {
                            updateMessage(botMessageId, content);
                        },
                        () => { }
                    );

                    // 添加最终助手回答到历史
                    conversationHistory.push({
                        role: 'assistant',
                        content: finalResult.content
                    });
                }

                // 通过AI生成并显示后续问题建议
                const followUpQuestions = await AppHelpers.generateSuggestionsWithAI(conversationHistory, apiKey);
                AppHelpers.showSuggestions(followUpQuestions, sendMessage);
            } else {
                // 没有工具调用，内容已在流式过程中显示
                // 只需添加回答到历史
                conversationHistory.push({
                    role: 'assistant',
                    content: result.content
                });

                // 通过AI生成并显示后续问题建议
                const followUpQuestions = await AppHelpers.generateSuggestionsWithAI(conversationHistory, apiKey);
                AppHelpers.showSuggestions(followUpQuestions, sendMessage);
            }

        } catch (error) {
            updateMessage(botMessageId, '❌ 发生错误: ' + error.message);
            console.error(error);
        }
    };

    // 添加消息
    function addMessage(type, text, messageId = null, menuData = null) {
        const chatArea = document.getElementById('chatArea');
        const welcome = chatArea.querySelector('.welcome-msg');
        if (welcome) welcome.remove();
        
        // 移除之前的建议
        const oldSuggestions = chatArea.querySelector('.suggestions');
        if (oldSuggestions && !oldSuggestions.closest('.welcome-msg')) {
            oldSuggestions.remove();
        }

        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${type}`;
        if (messageId) {
            msgDiv.id = messageId;
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // 如果是bot消息
        if (type === 'bot') {
            // 优先渲染菜单卡片
            if (menuData && MenuCard.isMenuData(menuData)) {
                contentDiv.innerHTML = MenuCard.render(menuData);
                // 延迟绑定事件，确保DOM已添加
                setTimeout(() => {
                    MenuCard.bindEvents(contentDiv, handleViewRecipe);
                }, 0);
            } else if (typeof marked !== 'undefined') {
                // 否则渲染markdown
                contentDiv.innerHTML = marked.parse(text);
            } else {
                contentDiv.textContent = text;
            }
        } else {
            contentDiv.textContent = text;
        }

        msgDiv.appendChild(contentDiv);
        chatArea.appendChild(msgDiv);
        
        return messageId || msgDiv.id;
    }

    // 更新消息内容（用于流式输出）
    function updateMessage(messageId, text, menuData = null) {
        const msgDiv = document.getElementById(messageId);
        if (!msgDiv) return;
        
        const contentDiv = msgDiv.querySelector('.message-content');
        if (contentDiv) {
            // 优先渲染菜单卡片
            if (menuData && MenuCard.isMenuData(menuData)) {
                contentDiv.innerHTML = MenuCard.render(menuData);
                // 绑定卡片按钮事件
                MenuCard.bindEvents(contentDiv, handleViewRecipe);
            } else if (typeof marked !== 'undefined') {
                contentDiv.innerHTML = marked.parse(text);
            } else {
                contentDiv.textContent = text;
            }
        }
    }

    // 暴露到全局供背景脚本使用
    window.handleViewRecipe = (dishName) => AppHelpers.handleViewRecipe(dishName, sendMessage);


    // 切换设置面板
    function toggleSettings() {
        const panel = document.getElementById('settingsPanel');
        panel.classList.toggle('active');
    }

    // 键盘事件
    function handleKeyPress(event) {
        if (event.key === 'Enter') {
            sendMessage();
        }
    }

    // 初始化
    loadRecipes();

    // 尝试从 localStorage 加载 API Key，否则使用默认 Key
    const savedKey = localStorage.getItem('deepseek_api_key');
    if (savedKey) {
        document.getElementById('apiKey').value = savedKey;
        apiKey = savedKey;
    } else {
        // 使用默认 API Key
        document.getElementById('apiKey').value = DEFAULT_API_KEY;
        apiKey = DEFAULT_API_KEY;
    }

    // 保存 API Key 到 localStorage
    document.getElementById('apiKey').addEventListener('change', (e) => {
        const newKey = e.target.value;
        localStorage.setItem('deepseek_api_key', newKey);
        apiKey = newKey;
    });

    // 绑定事件监听器
    document.getElementById('settingsBtn').addEventListener('click', toggleSettings);
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    document.getElementById('userInput').addEventListener('keypress', handleKeyPress);
    AppHelpers.bindSuggestionButtons(sendMessage);

}); // DOMContentLoaded 结束
