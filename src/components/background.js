// 食物滚动背景效果
(function() {
    // 从全局菜谱数据中随机选取菜品
    function getRandomDishes(count) {
        // 从真实菜谱数据中选取
        const shuffled = [...window.recipesData].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, count);
        
        return selected.map(recipe => {
            // 根据分类选择emoji
            let emoji = '🍴';
            const category = recipe.category || '';
            
            if (category.includes('水产')) emoji = '🐟';
            else if (category.includes('肉')) emoji = '🍖';
            else if (category.includes('素') || category.includes('蔬菜')) emoji = '🥬';
            else if (category.includes('汤')) emoji = '🍲';
            else if (category.includes('主食')) emoji = '🍜';
            else if (category.includes('早餐')) emoji = '🥟';
            else if (category.includes('甜品')) emoji = '🍰';
            else if (category.includes('饮品')) emoji = '🥤';
            
            // 清理菜名中的"的做法"等后缀
            let displayName = recipe.name.replace(/的做法$/, '').replace(/的制作方法$/, '');
            
            return { 
                emoji, 
                name: displayName,
                originalName: recipe.name  // 保存原始名称用于查找
            };
        });
    }

    // 创建食物项元素
    function createFoodItem(emoji, name, originalName) {
        const item = document.createElement('div');
        item.className = 'food-item';
        item.innerHTML = `
            <span class="emoji">${emoji}</span>
            <span class="name">${name}</span>
        `;
        
        // 添加点击事件 - 像预制问题一样填充输入框
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            const input = document.getElementById('userInput');
            const sendBtn = document.getElementById('sendBtn');
            
            if (input && sendBtn) {
                // 填充输入框
                input.value = `${name}怎么做？`;
                // 触发发送
                sendBtn.click();
            }
        });
        
        return item;
    }

    // 创建一行滚动的食物
    function createFoodRow(dishes, speed) {
        const row = document.createElement('div');
        row.className = 'food-row';
        row.style.animationDuration = `${speed}s`;
        
        // 创建两份相同的内容以实现无缝循环
        for (let i = 0; i < 2; i++) {
            dishes.forEach(dish => {
                row.appendChild(createFoodItem(dish.emoji, dish.name, dish.originalName));
            });
        }
        
        return row;
    }

    // 初始化滚动背景
    function initBackground() {
        const background = document.getElementById('foodBackground');
        if (!background) return;

        // 创建多行不同速度的滚动效果
        const rowCount = 6; // 6行
        const dishesPerRow = 15; // 每行15个菜品
        
        for (let i = 0; i < rowCount; i++) {
            const dishes = getRandomDishes(dishesPerRow);
            const speed = 60 + Math.random() * 40; // 60-100秒
            const row = createFoodRow(dishes, speed);
            
            // 设置每行的垂直位置
            const topPosition = (i * 100 / rowCount) + (Math.random() * 5); // 均匀分布+随机偏移
            row.style.top = `${topPosition}%`;
            row.style.transform = `translateY(-50%)`;
            
            background.appendChild(row);
        }
    }

    // 等待DOM和菜谱数据加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initBackground, 100); // 稍微延迟以确保菜谱数据已加载
        });
    } else {
        setTimeout(initBackground, 100);
    }
})();

