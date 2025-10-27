// 等待DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {

    const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
    
    // 默认提供的 API Key（仅供体验，大规模使用请替换为自己的）
    const DEFAULT_API_KEY = 'sk-b04c564fe6cc41bda7b5d23591415cf7';

    let apiKey = null;

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

    // 标记是否已初始化
    let isDispatcherInitialized = false;

    // 初始化 Agent Dispatcher
    function initAgentDispatcher() {
        // 如果已经初始化过，直接返回成功
        if (isDispatcherInitialized) {
            return true;
        }

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

        // 初始化Agent调度器（只初始化一次）
        AgentDispatcher.init(apiKey, {
            addMessage,
            updateMessage,
            showSuggestions
        });

        isDispatcherInitialized = true;
        return true;
    }

    // 显示后续问题建议
    function showSuggestions(questions) {
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
                sendMessage();
            };
            suggestionsDiv.appendChild(btn);
        });

        chatArea.appendChild(suggestionsDiv);
    }

    // 调用DeepSeek API（流式）- 保留用于向后兼容
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

    // 发送消息 - 使用Agent调度器
    async function sendMessage() {
        const input = document.getElementById('userInput');
        const message = input.value.trim();

        if (!message) return;

        if (!initAgentDispatcher()) return;

        // 显示用户消息
        addMessage('user', message);
        input.value = '';

        try {
            // 使用Agent调度器处理消息
            await AgentDispatcher.dispatch(message);
        } catch (error) {
            addMessage('bot', '❌ 发生错误: ' + error.message);
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

        // 滚动到最新消息
        chatArea.scrollTop = chatArea.scrollHeight;

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

            // 滚动到最新消息
            const chatArea = document.getElementById('chatArea');
            chatArea.scrollTop = chatArea.scrollHeight;
        }
    }

    // 处理查看菜谱
    function handleViewRecipe(dishName) {
        const recipe = window.recipesData.find(r =>
            r.name === dishName ||
            r.name.includes(dishName) ||
            dishName.includes(r.name.replace('的做法', ''))
        );

        if (recipe) {
            const messageId = 'recipe-detail-' + Date.now();
            const chatArea = document.getElementById('chatArea');

            const welcome = chatArea.querySelector('.welcome-msg');
            if (welcome) welcome.remove();

            const msgDiv = document.createElement('div');
            msgDiv.className = 'message bot';
            msgDiv.id = messageId;

            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.id = messageId + '-content';

            msgDiv.appendChild(contentDiv);
            chatArea.appendChild(msgDiv);

            RecipeDetail.render(recipe, contentDiv.id);
        } else {
            document.getElementById('userInput').value = `${dishName}怎么做？`;
            sendMessage();
        }
    }

    // 暴露到全局供背景脚本使用
    window.handleViewRecipe = handleViewRecipe;


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

    // 绑定初始建议按钮
    function bindInitialSuggestions() {
        const suggestionButtons = document.querySelectorAll('.suggestion-btn');
        suggestionButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('userInput').value = btn.textContent;
                sendMessage();
            });
        });
    }

    // 绑定事件监听器
    document.getElementById('settingsBtn').addEventListener('click', toggleSettings);
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    document.getElementById('userInput').addEventListener('keypress', handleKeyPress);
    bindInitialSuggestions();

}); // DOMContentLoaded 结束
