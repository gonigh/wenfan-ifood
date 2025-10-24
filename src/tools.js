// 菜谱工具模块
const RecipeTools = (function() {
    let recipes = [];

    /**
     * 初始化菜谱数据
     * @param {Array} recipesData - 菜谱数据数组
     */
    function initRecipes(recipesData) {
        if (!Array.isArray(recipesData)) {
            console.error('RecipeTools.initRecipes: 数据必须是数组');
            return;
        }
        recipes = recipesData;
        console.log(`RecipeTools: 已加载 ${recipes.length} 道菜谱`);
    }

    /**
     * 获取菜单推荐
     * @param {number} peopleCount - 用餐人数（1-10人），默认4人
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
    function getMenu(peopleCount = 4) {
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
        const vegetableCount = Math.floor((peopleCount + 1) / 2);
        const meatCount = Math.ceil((peopleCount + 1) / 2);

        let meatDishes = recipes.filter(r => r.category === '荤菜' || r.category === '水产');
        let vegetableDishes = recipes.filter(r =>
            r.category !== '荤菜' && r.category !== '水产' &&
            r.category !== '早餐' && r.category !== '主食'
        );

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

        // 如果还没有找到，尝试模糊匹配名称
        if (!foundRecipe) {
            foundRecipe = recipes.find(r =>
                r.name.toLowerCase().includes(dishName.toLowerCase())
            );
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
     * 执行工具函数
     * @param {string} functionName - 函数名称：'getMenu' 或 'getRecipe'
     * @param {Object} args - 函数参数
     * @param {number} [args.peopleCount] - getMenu 所需参数：用餐人数
     * @param {string} [args.dishName] - getRecipe 所需参数：菜品名称
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
            return getMenu(args.peopleCount || 4);
        } else if (functionName === 'getRecipe') {
            return getRecipe(args.dishName);
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
                description: '根据用餐人数智能推荐荤素搭配的菜品组合，解决用户"今天吃什么"的难题。',
                parameters: {
                    type: 'object',
                    properties: {
                        peopleCount: {
                            type: 'number',
                            description: '用餐人数（1-10人），会根据人数推荐合适数量和搭配的菜品'
                        }
                    }
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'getRecipe',
                description: '根据用户提供的菜品名称，查询并返回该菜品的详细制作方法，包括所需食材和步骤。',
                parameters: {
                    type: 'object',
                    properties: {
                        dishName: {
                            type: 'string',
                            description: "用户想要查询做法的菜品名称，例如 '麻婆豆腐' 或 '西红柿炒鸡蛋'。"
                        }
                    },
                    required: ['dishName']
                }
            }
        }
    ];

    // 暴露公共接口
    return {
        initRecipes,
        getMenu,
        getRecipe,
        executeTool,
        toolsDefinition
    };
})();

