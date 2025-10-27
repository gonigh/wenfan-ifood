// 菜谱工具模块
const RecipeTools = (function() {
    let recipes = [];
    const LOCAL_STORAGE_KEY = 'custom_recipes';

    /**
     * 从localStorage加载自定义菜谱
     */
    function loadCustomRecipes() {
        try {
            const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (stored) {
                const customRecipes = JSON.parse(stored);
                if (Array.isArray(customRecipes)) {
                    console.log(`RecipeTools: 从本地加载 ${customRecipes.length} 道自定义菜谱`);
                    return customRecipes;
                }
            }
        } catch (error) {
            console.error('RecipeTools: 加载自定义菜谱失败', error);
        }
        return [];
    }

    /**
     * 保存自定义菜谱到localStorage
     */
    function saveCustomRecipes(customRecipes) {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(customRecipes));
            console.log(`RecipeTools: 已保存 ${customRecipes.length} 道自定义菜谱到本地`);
            return true;
        } catch (error) {
            console.error('RecipeTools: 保存自定义菜谱失败', error);
            return false;
        }
    }

    /**
     * 初始化菜谱数据（合并文件数据和本地数据）
     * @param {Array} recipesData - 菜谱数据数组
     */
    function initRecipes(recipesData) {
        if (!Array.isArray(recipesData)) {
            console.error('RecipeTools.initRecipes: 数据必须是数组');
            return;
        }
        
        // 加载自定义菜谱
        const customRecipes = loadCustomRecipes();
        
        // 合并数据：自定义菜谱放在前面
        recipes = [...customRecipes, ...recipesData];
        
        console.log(`RecipeTools: 已加载 ${recipes.length} 道菜谱（${customRecipes.length} 道自定义 + ${recipesData.length} 道预设）`);
    }

    /**
     * 解析用户偏好上下文，提取关键词
     * @param {string} context - 用户描述的偏好
     * @returns {Object} 解析结果
     */
    function parseUserPreferences(context) {
        if (!context || typeof context !== 'string') {
            return { keywords: [], categories: [] };
        }

        const contextLower = context.toLowerCase();
        const keywords = [];
        const categories = [];

        // 食材类型关键词映射
        const ingredientMap = {
            '海鲜': ['虾', '蟹', '鱼', '贝', '蛤', '鲍鱼', '扇贝', '海参', '鱿鱼', '章鱼'],
            '水产': ['虾', '蟹', '鱼', '贝', '蛤', '鲍鱼', '扇贝', '海参', '鱿鱼', '章鱼'],
            '猪肉': ['猪肉', '五花肉', '里脊', '排骨', '猪蹄', '猪肝'],
            '牛肉': ['牛肉', '牛排', '牛腩', '牛柳'],
            '鸡肉': ['鸡', '鸡翅', '鸡腿', '鸡胸'],
            '羊肉': ['羊肉', '羊排', '羊腿'],
            '豆腐': ['豆腐', '豆干', '豆皮'],
            '蔬菜': ['青菜', '白菜', '菠菜', '生菜', '芹菜', '西兰花', '菜花'],
            '菌菇': ['香菇', '蘑菇', '金针菇', '木耳', '银耳', '平菇'],
            '素菜': ['青菜', '白菜', '菠菜', '茄子', '豆腐', '土豆', '萝卜']
        };

        // 口味关键词
        const tasteKeywords = {
            '辣': ['辣', '麻辣', '香辣', '川菜', '湘菜'],
            '清淡': ['清淡', '少油', '少盐', '健康'],
            '咸': ['咸', '重口'],
            '甜': ['甜', '糖醋'],
            '酸': ['酸', '醋'],
            '鲜': ['鲜', '清鲜']
        };

        // 烹饪方式关键词
        const cookingMethodKeywords = {
            '炒': ['炒', '快手'],
            '蒸': ['蒸', '清蒸'],
            '煮': ['煮', '炖', '汤'],
            '炸': ['炸', '煎'],
            '烤': ['烤', '烧烤'],
            '凉拌': ['凉拌', '凉菜']
        };

        // 检查食材类型
        for (const [key, items] of Object.entries(ingredientMap)) {
            if (contextLower.includes(key.toLowerCase())) {
                keywords.push(...items);
                if (key === '海鲜' || key === '水产') {
                    categories.push('水产');
                }
            }
        }

        // 检查口味
        for (const [key, items] of Object.entries(tasteKeywords)) {
            if (items.some(taste => contextLower.includes(taste))) {
                keywords.push(key);
            }
        }

        // 检查烹饪方式
        for (const [key, items] of Object.entries(cookingMethodKeywords)) {
            if (items.some(method => contextLower.includes(method))) {
                keywords.push(key);
            }
        }

        return {
            keywords: [...new Set(keywords)], // 去重
            categories: [...new Set(categories)]
        };
    }

    /**
     * 根据用户偏好过滤菜品
     * @param {Array} dishes - 菜品列表
     * @param {Object} preferences - 用户偏好
     * @returns {Array} 过滤后的菜品列表
     */
    function filterDishesByPreferences(dishes, preferences) {
        if (!preferences.keywords || preferences.keywords.length === 0) {
            return dishes;
        }

        // 根据偏好对菜品进行评分
        const scoredDishes = dishes.map(dish => {
            let score = 0;
            const dishText = `${dish.name} ${dish.description} ${dish.category} ${(dish.tags || []).join(' ')}`.toLowerCase();

            // 检查食材匹配
            const ingredientsText = (dish.ingredients || [])
                .map(ing => ing.name || '')
                .join(' ')
                .toLowerCase();

            // 分类匹配
            if (preferences.categories.includes(dish.category)) {
                score += 10;
            }

            // 关键词匹配
            for (const keyword of preferences.keywords) {
                const keywordLower = keyword.toLowerCase();
                if (dishText.includes(keywordLower)) {
                    score += 5;
                }
                if (ingredientsText.includes(keywordLower)) {
                    score += 8;
                }
                if (dish.name.toLowerCase().includes(keywordLower)) {
                    score += 15; // 菜名匹配权重最高
                }
            }

            return { dish, score };
        });

        // 过滤出有分数的菜品
        const matchedDishes = scoredDishes.filter(item => item.score > 0);

        // 如果有匹配的菜品，返回按分数排序的结果
        if (matchedDishes.length > 0) {
            return matchedDishes
                .sort((a, b) => b.score - a.score)
                .map(item => item.dish);
        }

        // 如果没有匹配，返回原始列表（降级为随机推荐）
        console.log('RecipeTools: 未找到匹配的菜品，使用随机推荐');
        return dishes;
    }

    /**
     * 获取菜单推荐
     * @param {number} peopleCount - 用餐人数（1-10人），默认4人
     * @param {string} context - 用户偏好上下文（可选），如"想吃海鲜"、"要辣的"、"清淡一些"等
     * @returns {Object} 菜单数据对象
     * @returns {number} return.peopleCount - 用餐人数
     * @returns {Array<Object>} return.dishes - 推荐菜品列表（仅包含菜单展示字段）
     * @returns {string} return.dishes[].name - 菜品名称
     * @returns {string} return.dishes[].category - 菜品分类
     * @returns {number} return.dishes[].difficulty - 难度级别（1-5）
     * @returns {string} return.dishes[].description - 菜品描述（已清理标题、难度等信息）
     * @returns {string} [return.dishes[].image] - 成品图片URL
     * @returns {string} return.message - 推荐说明文字
     */
    function getMenu(peopleCount = 4, context = '') {
        // 参数验证
        if (typeof peopleCount !== 'number' || peopleCount < 1 || peopleCount > 20) {
            console.warn(`RecipeTools.getMenu: 人数 ${peopleCount} 超出范围，使用默认值 4`);
            peopleCount = 4;
        }

        if (recipes.length === 0) {
            console.error('RecipeTools.getMenu: 菜谱数据未加载');
            return {
                peopleCount: peopleCount,
                dishes: [],
                message: '⚠️ 菜谱数据未加载，无法推荐菜单'
            };
        }

        // 解析用户偏好上下文
        const preferences = parseUserPreferences(context);
        console.log('RecipeTools.getMenu: 解析的用户偏好:', preferences);

        const vegetableCount = Math.floor((peopleCount + 1) / 2);
        const meatCount = Math.ceil((peopleCount + 1) / 2);

        let meatDishes = recipes.filter(r => r.category === '荤菜' || r.category === '水产');
        let vegetableDishes = recipes.filter(r =>
            r.category !== '荤菜' && r.category !== '水产' &&
            r.category !== '早餐' && r.category !== '主食'
        );

        // 根据用户偏好过滤菜品
        if (preferences.keywords.length > 0) {
            meatDishes = filterDishesByPreferences(meatDishes, preferences);
            vegetableDishes = filterDishesByPreferences(vegetableDishes, preferences);
        }

        let recommendedDishes = [];
        let fishDish = null;

        // 特别处理：如果人数超过8人，增加鱼类荤菜
        if (peopleCount > 8) {
            const fishDishes = recipes.filter(r => r.category === '水产');
            if (fishDishes.length > 0) {
                fishDish = fishDishes[Math.floor(Math.random() * fishDishes.length)];
                recommendedDishes.push(fishDish);
            }
        }

        // 打乱肉类优先级顺序，增加随机性
        const meatTypes = ['猪肉', '鸡肉', '牛肉', '羊肉', '鸭肉', '鱼肉'];
        for (let i = meatTypes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [meatTypes[i], meatTypes[j]] = [meatTypes[j], meatTypes[i]];
        }

        const selectedMeatDishes = [];
        const remainingMeatCount = fishDish ? meatCount - 1 : meatCount;

        // 尝试按照随机化的肉类优先级选择荤菜
        for (const meatType of meatTypes) {
            if (selectedMeatDishes.length >= remainingMeatCount) break;

            const meatTypeOptions = meatDishes.filter(dish => {
                return dish.ingredients?.some(ingredient => {
                    const name = ingredient.name?.toLowerCase() || '';
                    return name.includes(meatType.toLowerCase());
                });
            });

            if (meatTypeOptions.length > 0) {
                const selected = meatTypeOptions[Math.floor(Math.random() * meatTypeOptions.length)];
                selectedMeatDishes.push(selected);
                meatDishes = meatDishes.filter(dish => dish.id !== selected.id);
            }
        }

        // 如果通过肉类筛选的荤菜不够，随机选择剩余的
        while (selectedMeatDishes.length < remainingMeatCount && meatDishes.length > 0) {
            const randomIndex = Math.floor(Math.random() * meatDishes.length);
            selectedMeatDishes.push(meatDishes[randomIndex]);
            meatDishes.splice(randomIndex, 1);
        }

        // 随机选择素菜
        const selectedVegetableDishes = [];
        while (selectedVegetableDishes.length < vegetableCount && vegetableDishes.length > 0) {
            const randomIndex = Math.floor(Math.random() * vegetableDishes.length);
            selectedVegetableDishes.push(vegetableDishes[randomIndex]);
            vegetableDishes.splice(randomIndex, 1);
        }

        // 合并推荐菜单
        recommendedDishes = recommendedDishes.concat(selectedMeatDishes, selectedVegetableDishes);

        /**
         * 清理菜品描述，提取纯描述文字
         * @param {string} description - 原始描述（可能包含标题、难度等）
         * @returns {string} 清理后的描述
         */
        function cleanDescription(description) {
            if (!description || typeof description !== 'string') {
                return '';
            }

            // 移除 markdown 标题（# 开头的行）
            let cleaned = description.replace(/^#+\s+.+$/gm, '');
            
            // 移除难度说明行（包含"预估烹饪难度"或"★"的行）
            cleaned = cleaned.replace(/预估烹饪难度[：:].*/g, '');
            cleaned = cleaned.replace(/^.*[★☆]{2,}.*$/gm, '');
            
            // 移除图片链接 ![xxx](xxx)
            cleaned = cleaned.replace(/!\[.*?\]\(.*?\)/g, '');
            
            // 移除多余的空行，只保留一个换行
            cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
            
            // 去除首尾空白
            cleaned = cleaned.trim();
            
            // 如果清理后为空，返回默认描述
            return cleaned || '美味佳肴';
        }

        // 统计各类别菜品数量
        const categoryCount = {};
        recommendedDishes.forEach(d => {
            categoryCount[d.category] = (categoryCount[d.category] || 0) + 1;
        });

        // 生成类别说明文字
        const categoryText = Object.entries(categoryCount)
            .map(([cat, count]) => `${count}道${cat}`)
            .join('、');

        return {
            peopleCount,
            dishes: recommendedDishes.map(d => ({
                name: d.name,
                category: d.category,
                difficulty: d.difficulty,
                description: cleanDescription(d.description),
                image: d.image_path || (d.images && d.images.length > 0 ? d.images[0] : null)
            })),
            message: `为${peopleCount}人推荐的菜单，包含${categoryText}，共${recommendedDishes.length}道菜。`
        };
    }

    /**
     * 获取指定菜品的详细菜谱
     * @param {string} dishName - 菜品名称
     * @returns {Object} 菜谱数据对象或错误信息
     * @returns {string} [return.name] - 菜品名称
     * @returns {string} [return.category] - 菜品分类
     * @returns {string} [return.difficulty] - 难度级别
     * @returns {string} [return.description] - 菜品描述
     * @returns {Array<Object>} [return.ingredients] - 食材列表
     * @returns {string} return.ingredients[].name - 食材名称
     * @returns {string} return.ingredients[].quantity - 食材用量
     * @returns {Array<string>} [return.steps] - 制作步骤
     * @returns {number} [return.prep_time] - 准备时间（分钟）
     * @returns {number} [return.cook_time] - 烹饪时间（分钟）
     * @returns {string} [return.error] - 错误信息
     * @returns {string} [return.message] - 提示信息
     * @returns {Array<Object>} [return.possibleMatches] - 可能匹配的菜品列表
     */
    function getRecipe(dishName) {
        // 参数验证
        if (!dishName || typeof dishName !== 'string') {
            return {
                error: '菜品名称不能为空',
                suggestion: '请提供有效的菜品名称'
            };
        }

        if (recipes.length === 0) {
            return {
                error: '菜谱数据未加载',
                suggestion: '请稍后重试'
            };
        }
        // 首先尝试精确匹配ID
        let foundRecipe = recipes.find(r => r.id === dishName);

        // 如果没有找到，尝试精确匹配名称
        if (!foundRecipe) {
            foundRecipe = recipes.find(r => r.name === dishName);
        }

        // 如果还没有找到，尝试匹配去掉"的做法"后的名称
        if (!foundRecipe) {
            const cleanDishName = dishName.replace(/的做法$/, '').trim();
            foundRecipe = recipes.find(r => {
                const cleanRecipeName = r.name.replace(/的做法$/, '').trim();
                return cleanRecipeName === cleanDishName;
            });
        }

        // 如果还没有找到，尝试模糊匹配名称
        if (!foundRecipe) {
            const cleanDishName = dishName.replace(/的做法$/, '').trim();
            foundRecipe = recipes.find(r => {
                const cleanRecipeName = r.name.replace(/的做法$/, '').trim();
                return r.name.toLowerCase().includes(dishName.toLowerCase()) ||
                       cleanRecipeName.toLowerCase().includes(cleanDishName.toLowerCase()) ||
                       cleanDishName.toLowerCase().includes(cleanRecipeName.toLowerCase());
            });
        }

        // 如果仍然没有找到，返回所有可能的匹配项（最多5个）
        if (!foundRecipe) {
            const possibleMatches = recipes.filter(r =>
                r.name.toLowerCase().includes(dishName.toLowerCase()) ||
                r.description.toLowerCase().includes(dishName.toLowerCase())
            ).slice(0, 5);

            if (possibleMatches.length === 0) {
                return {
                    error: "未找到匹配的菜谱",
                    query: dishName,
                    suggestion: "请检查菜谱名称是否正确，或尝试使用关键词搜索"
                };
            }

            return {
                message: "未找到精确匹配，以下是可能的匹配项：",
                query: dishName,
                possibleMatches: possibleMatches.map(r => ({
                    id: r.id,
                    name: r.name,
                    description: r.description,
                    category: r.category
                }))
            };
        }

        // 返回找到的完整菜谱信息（返回原始对象用于详情组件渲染）
        return {
            success: true,
            recipe: foundRecipe  // 返回完整的菜谱对象
        };
    }

    /**
     * 新增菜品
     * @param {Object} recipeData - 菜品数据
     * @returns {Object} 操作结果
     */
    function addRecipe(recipeData) {
        // 参数验证
        if (!recipeData || typeof recipeData !== 'object') {
            return {
                success: false,
                error: '菜品数据格式错误'
            };
        }

        // 必需字段验证
        if (!recipeData.name || typeof recipeData.name !== 'string' || recipeData.name.trim() === '') {
            return {
                success: false,
                error: '菜品名称不能为空'
            };
        }

        if (!recipeData.category || typeof recipeData.category !== 'string') {
            return {
                success: false,
                error: '菜品分类不能为空'
            };
        }

        // 生成唯一ID
        const timestamp = Date.now();
        const id = `custom-${timestamp}-${recipeData.name.replace(/\s+/g, '-')}`;

        // 构建完整的菜品对象
        const newRecipe = {
            id: id,
            name: recipeData.name,
            description: recipeData.description || '',
            source_path: `custom/${id}.md`,
            image_path: recipeData.image_path || null,
            images: recipeData.images || [],
            category: recipeData.category,
            difficulty: recipeData.difficulty || 3,
            tags: recipeData.tags || [recipeData.category],
            servings: recipeData.servings || 1,
            ingredients: recipeData.ingredients || [],
            steps: recipeData.steps || [],
            prep_time_minutes: recipeData.prep_time_minutes || null,
            cook_time_minutes: recipeData.cook_time_minutes || null,
            total_time_minutes: recipeData.total_time_minutes || null,
            additional_notes: recipeData.additional_notes || [],
            custom: true, // 标记为自定义菜谱
            created_at: new Date().toISOString()
        };

        // 加载现有的自定义菜谱
        const customRecipes = loadCustomRecipes();

        // 检查是否已存在同名菜品
        const existingIndex = customRecipes.findIndex(r => r.name === newRecipe.name);
        if (existingIndex !== -1) {
            // 更新现有菜品
            customRecipes[existingIndex] = newRecipe;
            console.log(`RecipeTools: 更新菜品 "${newRecipe.name}"`);
        } else {
            // 添加新菜品
            customRecipes.unshift(newRecipe); // 添加到开头
            console.log(`RecipeTools: 新增菜品 "${newRecipe.name}"`);
        }

        // 保存到localStorage
        if (!saveCustomRecipes(customRecipes)) {
            return {
                success: false,
                error: '保存菜品失败，请检查浏览器存储空间'
            };
        }

        // 更新内存中的菜谱列表
        if (existingIndex !== -1) {
            // 查找并更新recipes中的对应项
            const recipeIndex = recipes.findIndex(r => r.name === newRecipe.name);
            if (recipeIndex !== -1) {
                recipes[recipeIndex] = newRecipe;
            }
        } else {
            // 添加到recipes开头
            recipes.unshift(newRecipe);
        }

        return {
            success: true,
            message: existingIndex !== -1 ? `菜品"${newRecipe.name}"已更新` : `菜品"${newRecipe.name}"添加成功`,
            recipe: newRecipe
        };
    }

    /**
     * 执行工具函数
     * @param {string} functionName - 函数名称：'getMenu'、'getRecipe' 或 'addRecipe'
     * @param {Object} args - 函数参数
     * @param {number} [args.peopleCount] - getMenu 所需参数：用餐人数
     * @param {string} [args.context] - getMenu 所需参数：用户偏好上下文
     * @param {string} [args.dishName] - getRecipe 所需参数：菜品名称
     * @param {Object} [args.recipeData] - addRecipe 所需参数：菜品数据
     * @returns {Object} 执行结果或错误信息
     */
    function executeTool(functionName, args) {
        if (!functionName || typeof functionName !== 'string') {
            console.error('RecipeTools.executeTool: 函数名称无效', functionName);
            return { error: '函数名称无效' };
        }

        if (!args || typeof args !== 'object') {
            console.error('RecipeTools.executeTool: 参数格式错误', args);
            return { error: '参数格式错误' };
        }

        if (functionName === 'getMenu') {
            return getMenu(args.peopleCount || 4, args.context || '');
        } else if (functionName === 'getRecipe') {
            return getRecipe(args.dishName);
        } else if (functionName === 'addRecipe') {
            return addRecipe(args.recipeData);
        }

        console.error('RecipeTools.executeTool: 未知的工具函数', functionName);
        return { error: `未知的工具函数: ${functionName}` };
    }

    // 工具定义
    const toolsDefinition = [
        {
            type: 'function',
            function: {
                name: 'getMenu',
                description: '根据用餐人数和用户偏好智能推荐荤素搭配的菜品组合，解决用户"今天吃什么"的难题。支持根据上下文识别用户的口味偏好（如海鲜、辣、清淡等）进行个性化推荐。',
                parameters: {
                    type: 'object',
                    properties: {
                        peopleCount: {
                            type: 'number',
                            description: '用餐人数（1-10人），会根据人数推荐合适数量和搭配的菜品'
                        },
                        context: {
                            type: 'string',
                            description: '用户的口味偏好或需求描述，例如："想吃海鲜"、"要辣的菜"、"清淡一些"、"想吃川菜"、"要有豆腐"等。AI应该从对话历史中提取用户表达的偏好，如果用户没有明确偏好则留空。'
                        }
                    }
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'getRecipe',
                description: '根据用户提供的菜品或饮品名称，查询并返回详细的制作方法，包括所需食材和步骤。支持查询各类菜肴（如麻婆豆腐、西红柿炒鸡蛋）和饮品（如可乐桶、奶茶等）的做法。',
                parameters: {
                    type: 'object',
                    properties: {
                        dishName: {
                            type: 'string',
                            description: "用户想要查询做法的菜品或饮品名称，例如 '麻婆豆腐'、'西红柿炒鸡蛋'、'可乐桶' 等。"
                        }
                    },
                    required: ['dishName']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'addRecipe',
                description: '立即添加用户自定义的菜品或饮品配方到菜谱库中，并保存到本地存储。当用户说"添加"、"保存"、"记录"、"添加到菜谱库"等词时，必须调用此工具执行实际操作，而不是只回复确认信息。用户可以保存自己的独家配方、改良菜谱或新学会的做法。',
                parameters: {
                    type: 'object',
                    properties: {
                        recipeData: {
                            type: 'object',
                            description: '菜品数据对象',
                            properties: {
                                name: {
                                    type: 'string',
                                    description: '菜品名称（必填），例如"我的秘制红烧肉"'
                                },
                                category: {
                                    type: 'string',
                                    description: '菜品分类（必填），如"荤菜"、"素菜"、"汤羹"、"主食"、"小吃"、"饮品"等'
                                },
                                description: {
                                    type: 'string',
                                    description: '菜品描述，可以包含菜品特色、口味、来源等信息'
                                },
                                difficulty: {
                                    type: 'number',
                                    description: '难度等级，1-5的整数，1最简单，5最难，默认为3'
                                },
                                servings: {
                                    type: 'number',
                                    description: '份数，默认为1'
                                },
                                ingredients: {
                                    type: 'array',
                                    description: '食材列表，每项包含name（名称）和text_quantity（用量描述）',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string', description: '食材名称' },
                                            text_quantity: { type: 'string', description: '用量描述，如"100克"、"适量"' }
                                        }
                                    }
                                },
                                steps: {
                                    type: 'array',
                                    description: '制作步骤列表，每项包含step（步骤序号）和description（步骤描述）',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            step: { type: 'number', description: '步骤序号' },
                                            description: { type: 'string', description: '步骤描述' }
                                        }
                                    }
                                },
                                prep_time_minutes: {
                                    type: 'number',
                                    description: '准备时间（分钟）'
                                },
                                cook_time_minutes: {
                                    type: 'number',
                                    description: '烹饪时间（分钟）'
                                },
                                additional_notes: {
                                    type: 'array',
                                    description: '小贴士或注意事项',
                                    items: { type: 'string' }
                                },
                                tags: {
                                    type: 'array',
                                    description: '标签列表，如["快手菜", "下饭菜"]',
                                    items: { type: 'string' }
                                }
                            },
                            required: ['name', 'category']
                        }
                    },
                    required: ['recipeData']
                }
            }
        }
    ];

    // 暴露公共接口
    return {
        initRecipes,
        getMenu,
        getRecipe,
        addRecipe,
        executeTool,
        toolsDefinition,
        loadCustomRecipes,
        saveCustomRecipes
    };
})();

