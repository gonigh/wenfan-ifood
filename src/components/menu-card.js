// 菜单卡片组件
const MenuCard = (function() {
    
    /**
     * 菜单数据类型定义
     * @typedef {Object} MenuData
     * @property {number} peopleCount - 用餐人数
     * @property {DishItem[]} dishes - 菜品列表
     * @property {string} message - 菜单推荐说明
     */

    /**
     * 菜品数据类型定义（仅包含菜单展示所需字段）
     * @typedef {Object} DishItem
     * @property {string} name - 菜品名称（必需）
     * @property {string} category - 菜品分类（必需）
     * @property {number|string} difficulty - 难度级别：数字1-5或文字'简单'|'中等'|'困难'（必需）
     * @property {string} [description] - 菜品描述（可选）
     * @property {string} [image] - 成品图片URL（可选）
     */

    /**
     * 验证菜品数据格式
     * @param {*} dish - 待验证的菜品数据
     * @returns {boolean} 是否为有效的菜品数据
     */
    function validateDish(dish) {
        if (!dish || typeof dish !== 'object') return false;
        
        // 必需字段验证
        if (!dish.name || typeof dish.name !== 'string' || dish.name.trim() === '') return false;
        if (!dish.category || typeof dish.category !== 'string' || dish.category.trim() === '') return false;
        
        // difficulty 可以是数字（1-5）或字符串
        if (dish.difficulty === null || dish.difficulty === undefined) return false;
        const isValidNumber = typeof dish.difficulty === 'number' && dish.difficulty >= 1 && dish.difficulty <= 5;
        const isValidString = typeof dish.difficulty === 'string' && dish.difficulty.trim() !== '';
        if (!isValidNumber && !isValidString) return false;
        
        return true;
    }

    /**
     * 验证菜单数据格式
     * @param {*} menuData - 待验证的菜单数据
     * @returns {{valid: boolean, error?: string}} 验证结果
     */
    function validateMenuData(menuData) {
        if (!menuData || typeof menuData !== 'object') {
            return { valid: false, error: '菜单数据格式错误' };
        }

        if (!Array.isArray(menuData.dishes)) {
            return { valid: false, error: '菜单数据缺少 dishes 字段或格式错误' };
        }

        if (menuData.dishes.length === 0) {
            return { valid: false, error: '菜单中没有菜品' };
        }

        // 验证每个菜品
        for (let i = 0; i < menuData.dishes.length; i++) {
            const dish = menuData.dishes[i];
            if (!validateDish(dish)) {
                return { 
                    valid: false, 
                    error: `菜品 ${i + 1} 数据格式错误，缺少必需字段（name/category/difficulty）` 
                };
            }
        }

        return { valid: true };
    }

    /**
     * 安全地转义 HTML 特殊字符，防止 XSS 攻击
     * @param {string} str - 待转义的字符串
     * @returns {string} 转义后的字符串
     */
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * 将难度值转换为星星显示
     * @param {number|string} difficulty - 难度值（1-5的数字或文字描述）
     * @returns {{stars: string, color: string}} 星星显示和颜色
     */
    function convertDifficultyToStars(difficulty) {
        let level = 3; // 默认中等难度
        
        // 如果是数字，直接使用
        if (typeof difficulty === 'number') {
            level = Math.max(1, Math.min(5, Math.round(difficulty)));
        } 
        // 如果是字符串，转换为数字
        else if (typeof difficulty === 'string') {
            const difficultyMap = {
                '简单': 2,
                '中等': 3,
                '困难': 5
            };
            level = difficultyMap[difficulty] || 3;
        }
        
        // 根据星级确定颜色
        let color = '#ed8936'; // 默认橙色
        if (level <= 2) {
            color = '#48bb78'; // 绿色
        } else if (level >= 4) {
            color = '#f56565'; // 红色
        }
        
        return {
            stars: '★'.repeat(level) + '☆'.repeat(5 - level),
            color: color
        };
    }

    /**
     * 渲染菜单卡片
     * @param {MenuData} menuData - 菜单数据
     * @returns {string} 渲染后的 HTML 字符串
     * @throws {Error} 当数据格式不正确时抛出错误
     */
    function render(menuData) {
        // 数据验证
        const validation = validateMenuData(menuData);
        if (!validation.valid) {
            console.error('菜单数据验证失败:', validation.error, menuData);
            return `<div class="menu-error">⚠️ ${escapeHtml(validation.error)}</div>`;
        }

        const dishes = menuData.dishes;
        const message = escapeHtml(menuData.message || '');
        
        let html = `<div class="menu-intro">${message}</div>`;
        html += '<div class="menu-cards">';
        
        dishes.forEach(dish => {
            // 转换难度为星星显示
            const difficultyInfo = convertDifficultyToStars(dish.difficulty);
            
            // 使用 escapeHtml 防止 XSS
            const name = escapeHtml(dish.name);
            const category = escapeHtml(dish.category);
            const description = escapeHtml(dish.description || '美味佳肴');
            const rawName = dish.name; // 保留原始名称用于 data 属性
            const imageUrl = dish.image ? escapeHtml(dish.image) : '';
            
            html += `
                <div class="menu-card">
                    ${imageUrl ? `<div class="menu-card-image">
                        <img src="${imageUrl}" alt="${name}" onerror="this.parentElement.style.display='none'">
                    </div>` : ''}
                    <div class="menu-card-header">
                        <h3 class="menu-card-title">${name}</h3>
                        <span class="menu-card-category">${category}</span>
                    </div>
                    <div class="menu-card-body">
                        <p class="menu-card-description">${description}</p>
                        <div class="menu-card-meta">
                            <span class="difficulty" style="color: ${difficultyInfo.color}">
                                ${difficultyInfo.stars}
                            </span>
                        </div>
                    </div>
                    <div class="menu-card-footer">
                        <button class="view-recipe-btn" data-dish-name="${escapeHtml(rawName)}">
                            📖 查看做法
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    /**
     * 检查数据是否为有效的菜单数据
     * @param {*} data - 待检查的数据
     * @returns {boolean} 是否为有效的菜单数据
     */
    function isMenuData(data) {
        return validateMenuData(data).valid;
    }

    /**
     * 绑定卡片按钮事件
     * @param {HTMLElement} container - 包含菜单卡片的容器元素
     */
    function bindEvents(container) {
        if (!container) {
            console.warn('MenuCard.bindEvents: 容器元素不存在');
            return;
        }
        
        const buttons = container.querySelectorAll('.view-recipe-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const dishName = this.getAttribute('data-dish-name');
                if (dishName) {
                    // 填充输入框并直接发送
                    const userInput = document.getElementById('userInput');
                    const sendBtn = document.getElementById('sendBtn');
                    if (userInput && sendBtn) {
                        userInput.value = `查看${dishName}`;
                        sendBtn.click(); // 触发发送按钮点击事件
                    }
                }
            });
        });
    }

    // 暴露公共接口
    return {
        render,
        isMenuData,
        bindEvents
    };
})();

