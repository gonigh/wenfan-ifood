// 菜品详情组件
const RecipeDetail = (function() {
    
    /**
     * 验证配料数据
     */
    function validateIngredient(ingredient) {
        return ingredient && typeof ingredient === 'object' && 
               ingredient.name && ingredient.text_quantity;
    }

    /**
     * 验证步骤数据
     */
    function validateStep(step) {
        return step && typeof step === 'object' && 
               typeof step.step === 'number' && step.description;
    }

    /**
     * 验证菜品详情数据
     */
    function validateRecipe(recipe) {
        if (!recipe || typeof recipe !== 'object') {
            return { valid: false, error: '菜品数据格式错误' };
        }

        // 必需字段：仅名称和分类
        if (!recipe.name || typeof recipe.name !== 'string' || recipe.name.trim() === '') {
            return { valid: false, error: '缺少菜品名称' };
        }
        if (!recipe.category || typeof recipe.category !== 'string') {
            return { valid: false, error: '缺少菜品分类' };
        }
        
        // 难度可以为空，但如果有值必须是1-5的数字
        if (recipe.difficulty !== null && recipe.difficulty !== undefined) {
            if (typeof recipe.difficulty !== 'number' || recipe.difficulty < 1 || recipe.difficulty > 5) {
                return { valid: false, error: '难度等级必须是1-5的整数' };
            }
        }
        
        // 配料可以为空，但必须是数组
        if (recipe.ingredients && !Array.isArray(recipe.ingredients)) {
            return { valid: false, error: '配料清单必须是数组格式' };
        }
        
        // 步骤可以为空，但必须是数组
        if (recipe.steps && !Array.isArray(recipe.steps)) {
            return { valid: false, error: '制作步骤必须是数组格式' };
        }

        // 验证配料（如果有的话）
        if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
            for (let i = 0; i < recipe.ingredients.length; i++) {
                if (!validateIngredient(recipe.ingredients[i])) {
                    return { valid: false, error: `配料 ${i + 1} 格式错误` };
                }
            }
        }

        // 验证步骤（如果有的话）
        if (recipe.steps && Array.isArray(recipe.steps)) {
            for (let i = 0; i < recipe.steps.length; i++) {
                if (!validateStep(recipe.steps[i])) {
                    return { valid: false, error: `步骤 ${i + 1} 格式错误` };
                }
            }
        }

        return { valid: true };
    }

    /**
     * 转义HTML
     */
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * 清理描述内容，只保留纯文本描述
     */
    function cleanDescription(description) {
        if (!description || typeof description !== 'string') return '';
        
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
        
        return cleaned;
    }

    /**
     * 渲染难度星级
     */
    function renderDifficulty(difficulty) {
        if (!difficulty || typeof difficulty !== 'number') {
            return ''; // 难度为空时不显示
        }
        const stars = '★'.repeat(difficulty) + '☆'.repeat(5 - difficulty);
        return `<span class="recipe-difficulty" title="难度: ${difficulty}/5">${stars}</span>`;
    }

    /**
     * 渲染时间信息
     */
    function renderTimeInfo(recipe) {
        const times = [];
        if (recipe.prep_time_minutes) times.push(`准备: ${recipe.prep_time_minutes}分钟`);
        if (recipe.cook_time_minutes) times.push(`烹饪: ${recipe.cook_time_minutes}分钟`);
        if (recipe.total_time_minutes) times.push(`总计: ${recipe.total_time_minutes}分钟`);
        
        if (times.length === 0) return '';
        
        return `
            <div class="recipe-time-info">
                <span class="time-icon">⏱️</span>
                ${times.map(t => `<span class="time-item">${escapeHtml(t)}</span>`).join('')}
            </div>
        `;
    }

    /**
     * 渲染配料列表
     */
    function renderIngredients(ingredients, servings = 1) {
        if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
            return ''; // 配料为空时不显示
        }
        
        const uniqueIngredients = [];
        const seen = new Set();
        
        // 去重：优先保留有数量的配料
        for (const ing of ingredients) {
            if (!seen.has(ing.name)) {
                seen.add(ing.name);
                uniqueIngredients.push(ing);
            } else if (ing.quantity !== null) {
                const idx = uniqueIngredients.findIndex(i => i.name === ing.name);
                if (uniqueIngredients[idx].quantity === null) {
                    uniqueIngredients[idx] = ing;
                }
            }
        }

        return `
            <div class="recipe-ingredients">
                <h3>🥘 配料清单</h3>
                <div class="servings-control">
                    <label>份数：</label>
                    <button class="servings-btn" data-action="decrease">-</button>
                    <span class="servings-value">${servings}</span>
                    <button class="servings-btn" data-action="increase">+</button>
                </div>
                <ul class="ingredients-list">
                    ${uniqueIngredients.map(ing => {
                        let displayText = escapeHtml(ing.name);
                        if (ing.quantity !== null && ing.unit) {
                            const adjustedQty = (ing.quantity * servings).toFixed(1);
                            displayText += ` <strong>${adjustedQty}${escapeHtml(ing.unit)}</strong>`;
                        } else if (ing.text_quantity) {
                            // 提取数字并调整
                            const match = ing.text_quantity.match(/(\d+\.?\d*)\s*([a-zA-Z]+|[克个毫升斤两勺])/);
                            if (match) {
                                const qty = parseFloat(match[1]) * servings;
                                displayText += ` <strong>${qty.toFixed(1)}${escapeHtml(match[2])}</strong>`;
                            }
                        }
                        return `<li>${displayText}</li>`;
                    }).join('')}
                </ul>
            </div>
        `;
    }

    /**
     * 渲染制作步骤
     */
    function renderSteps(steps) {
        if (!steps || steps.length === 0) {
            return ''; // 步骤为空时返回空字符串
        }
        
        return `
            <div class="recipe-steps">
                <h3>👨‍🍳 制作步骤</h3>
                <ol class="steps-list">
                    ${steps.map(step => `
                        <li class="step-item">
                            <div class="step-number">${step.step}</div>
                            <div class="step-content">
                                <p class="step-description">${escapeHtml(step.description)}</p>
                                ${step.image ? `<img src="${escapeHtml(step.image)}" alt="步骤${step.step}" class="step-image">` : ''}
                                ${step.duration ? `<span class="step-duration">⏱ ${escapeHtml(step.duration)}</span>` : ''}
                                ${step.tips ? `<div class="step-tips">💡 ${escapeHtml(step.tips)}</div>` : ''}
                            </div>
                        </li>
                    `).join('')}
                </ol>
            </div>
        `;
    }

    /**
     * 渲染附加说明
     */
    function renderNotes(notes) {
        if (!notes || notes.length === 0) return '';
        
        return `
            <div class="recipe-notes">
                <h3>📝 小贴士</h3>
                <ul class="notes-list">
                    ${notes.map(note => `<li>${escapeHtml(note)}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    /**
     * 渲染完整菜品详情
     */
    function render(recipe, containerId) {
        const validation = validateRecipe(recipe);
        if (!validation.valid) {
            console.error('菜品数据验证失败:', validation.error);
            return false;
        }

        const container = document.getElementById(containerId);
        if (!container) {
            console.error('容器元素不存在:', containerId);
            return false;
        }

        const servings = recipe.servings || 1;
        const cleanedDescription = cleanDescription(recipe.description);

        const html = `
            <div class="recipe-detail-card" data-recipe-id="${escapeHtml(recipe.id || '')}">
                <div class="recipe-actions-top">
                    <button class="action-text-btn" data-action="export">导出</button>
                </div>
                
                <div class="recipe-header">
                    <h2 class="recipe-title">${escapeHtml(recipe.name)}</h2>
                    <div class="recipe-meta">
                        <span class="recipe-category">${escapeHtml(recipe.category)}</span>
                        ${renderDifficulty(recipe.difficulty)}
                    </div>
                </div>

                ${recipe.image_path ? `<img src="${escapeHtml(recipe.image_path)}" alt="${escapeHtml(recipe.name)}" class="recipe-main-image">` : ''}
                
                ${cleanedDescription ? `<div class="recipe-description">${escapeHtml(cleanedDescription).replace(/\n/g, '<br>')}</div>` : ''}
                
                ${renderTimeInfo(recipe)}

                <div class="recipe-content">
                    ${renderIngredients(recipe.ingredients || [], servings)}
                    ${renderSteps(recipe.steps || [])}
                    ${renderNotes(recipe.additional_notes || [])}
                </div>
            </div>
        `;

        container.innerHTML = html;
        bindEvents(container, recipe);
        return true;
    }

    /**
     * 绑定事件
     */
    function bindEvents(container, recipe) {
        let currentServings = recipe.servings || 1;

        // 份数调整（只有在有配料的情况下才绑定）
        if (recipe.ingredients && recipe.ingredients.length > 0) {
            container.querySelectorAll('.servings-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const action = e.target.dataset.action;
                    if (action === 'increase') {
                        currentServings++;
                    } else if (action === 'decrease' && currentServings > 1) {
                        currentServings--;
                    }
                    updateServings(container, recipe, currentServings);
                });
            });
        }

        // 操作按钮
        container.querySelectorAll('.action-text-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action === 'export') {
                    handleExport(container);
                }
            });
        });
    }

    /**
     * 更新份数显示
     */
    function updateServings(container, recipe, servings) {
        const servingsValue = container.querySelector('.servings-value');
        if (servingsValue) servingsValue.textContent = servings;

        // 重新渲染配料列表（如果有配料的话）
        if (recipe.ingredients && recipe.ingredients.length > 0) {
            const ingredientsContainer = container.querySelector('.recipe-ingredients');
            if (ingredientsContainer) {
                const newHtml = renderIngredients(recipe.ingredients, servings);
                if (newHtml) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = newHtml;
                    ingredientsContainer.replaceWith(tempDiv.firstElementChild);
                    
                    // 重新绑定份数按钮事件
                    container.querySelectorAll('.servings-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const action = e.target.dataset.action;
                            if (action === 'increase') {
                                servings++;
                            } else if (action === 'decrease' && servings > 1) {
                                servings--;
                            }
                            updateServings(container, recipe, servings);
                        });
                    });
                }
            }
        }
    }

    /**
     * 导出为图片功能
     */
    async function handleExport(container) {
        const card = container.querySelector('.recipe-detail-card');
        if (!card) return;

        // 获取菜品名称作为文件名
        const recipeName = card.querySelector('.recipe-title')?.textContent || '菜谱';

        // 隐藏操作按钮
        const actionButtons = card.querySelector('.recipe-actions-top');
        const originalDisplay = actionButtons ? actionButtons.style.display : '';

        try {
            if (actionButtons) {
                actionButtons.style.display = 'none';
            }

            // 使用 html2canvas 库导出
            if (typeof html2canvas === 'undefined') {
                alert('导出功能需要加载 html2canvas 库');
                return;
            }

            // 显示导出中提示
            const exportBtn = container.querySelector('[data-action="export"]');
            const originalText = exportBtn ? exportBtn.textContent : '';
            if (exportBtn) exportBtn.textContent = '导出中...';

            const canvas = await html2canvas(card, {
                backgroundColor: '#ffffff',
                scale: 2,
                logging: false,
                useCORS: true,
                allowTaint: true
            });

            // 恢复按钮文本
            if (exportBtn) exportBtn.textContent = originalText;

            // 转换为图片并下载
            canvas.toBlob((blob) => {
                if (!blob) {
                    throw new Error('图片生成失败');
                }
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${recipeName}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });

        } catch (error) {
            console.error('导出图片失败:', error);
            alert('导出图片失败，请稍后重试');
        } finally {
            // 恢复操作按钮显示
            if (actionButtons) {
                actionButtons.style.display = originalDisplay;
            }
        }
    }

    // 公开API
    return {
        render,
        validateRecipe
    };
})();

