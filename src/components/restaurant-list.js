/**
 * RestaurantList - 餐厅列表组件
 * 用于展示高德地图API返回的餐厅搜索结果
 */
const RestaurantList = (function() {

    /**
     * 渲染餐厅列表
     * @param {Array} restaurants - 餐厅数据列表
     * @param {string} containerId - 容器元素ID
     * @param {Object} locationInfo - 位置信息（可选）
     */
    function render(restaurants, containerId, locationInfo = null) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('RestaurantList: 找不到容器元素', containerId);
            return;
        }

        // 清空容器
        container.innerHTML = '';

        // 如果没有餐厅数据
        if (!restaurants || restaurants.length === 0) {
            container.innerHTML = `
                <div class="restaurant-list-empty">
                    <p>😔 附近暂无餐厅信息</p>
                </div>
            `;
            return;
        }

        // 创建列表容器
        const listWrapper = document.createElement('div');
        listWrapper.className = 'restaurant-list-wrapper';

        // 添加位置信息头部（如果有）
        if (locationInfo) {
            const headerDiv = document.createElement('div');
            headerDiv.className = 'restaurant-list-header';
            headerDiv.innerHTML = `
                <div class="location-info">
                    <span class="location-icon">📍</span>
                    <span class="location-text">${locationInfo.full_location || locationInfo.city || '当前位置'}</span>
                </div>
                <div class="result-count">找到 ${restaurants.length} 家餐厅</div>
            `;
            listWrapper.appendChild(headerDiv);
        }

        // 创建餐厅列表
        const listDiv = document.createElement('div');
        listDiv.className = 'restaurant-list';

        restaurants.forEach((restaurant, index) => {
            const item = createRestaurantItem(restaurant, index + 1);
            listDiv.appendChild(item);
        });

        listWrapper.appendChild(listDiv);
        container.appendChild(listWrapper);
    }

    /**
     * 创建单个餐厅项
     * @param {Object} restaurant - 餐厅数据
     * @param {number} index - 序号
     * @returns {HTMLElement}
     */
    function createRestaurantItem(restaurant, index) {
        const item = document.createElement('div');
        item.className = 'restaurant-item';

        // 操作按钮区域 - 固定到右上角
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'restaurant-actions';

        // 电话按钮
        if (restaurant.business?.tel) {
            const telBtn = document.createElement('button');
            telBtn.className = 'action-btn tel-btn';
            telBtn.innerHTML = '📞 电话';
            telBtn.onclick = () => {
                window.location.href = `tel:${restaurant.business.tel}`;
            };
            actionsDiv.appendChild(telBtn);
        }

        // 导航按钮
        if (restaurant.location) {
            const navBtn = document.createElement('button');
            navBtn.className = 'action-btn nav-btn';
            navBtn.innerHTML = '🧭 导航';
            navBtn.onclick = () => {
                const [lng, lat] = restaurant.location.split(',');
                window.open(`https://uri.amap.com/marker?position=${lng},${lat}&name=${encodeURIComponent(restaurant.name)}`);
            };
            actionsDiv.appendChild(navBtn);
        }

        item.appendChild(actionsDiv);

        // 餐厅名称和序号
        const nameDiv = document.createElement('div');
        nameDiv.className = 'restaurant-name-row';
        nameDiv.innerHTML = `
            <span class="restaurant-index">${index}</span>
            <h3 class="restaurant-name">${restaurant.name || '未知餐厅'}</h3>
        `;
        item.appendChild(nameDiv);

        // 餐厅类型标签
        if (restaurant.type) {
            const typeTag = document.createElement('span');
            typeTag.className = 'restaurant-type-tag';
            typeTag.textContent = restaurant.type;
            item.appendChild(typeTag);
        }

        // 主内容区域 - 左右布局容器
        const contentDiv = document.createElement('div');
        contentDiv.className = 'restaurant-content';

        // 左侧：餐厅图片
        if (restaurant.photos && restaurant.photos.length > 0) {
            const photoDiv = document.createElement('div');
            photoDiv.className = 'restaurant-photo';
            const img = document.createElement('img');
            img.src = restaurant.photos[0].url;
            img.alt = restaurant.photos[0].title || restaurant.name;
            img.className = 'restaurant-photo-img';
            img.onerror = function() {
                // 图片加载失败时隐藏
                photoDiv.style.display = 'none';
            };
            photoDiv.appendChild(img);
            contentDiv.appendChild(photoDiv);
        }

        // 右侧：业务信息容器
        const infoContainer = document.createElement('div');
        infoContainer.className = 'restaurant-info-container';

        // 商业信息区域（评分、人均、营业时间等）
        if (restaurant.business) {
            const businessDiv = createBusinessInfo(restaurant.business);
            infoContainer.appendChild(businessDiv);
        }

        // 地址信息
        const addressDiv = document.createElement('div');
        addressDiv.className = 'restaurant-address';
        addressDiv.innerHTML = `
            <span class="address-icon">📍</span>
            <span class="address-text">${formatAddress(restaurant)}</span>
        `;
        infoContainer.appendChild(addressDiv);

        // 距离信息
        if (restaurant.distance) {
            const distanceDiv = document.createElement('div');
            distanceDiv.className = 'restaurant-distance';
            const distanceIcon = document.createElement('span');
            distanceIcon.className = 'distance-icon';
            distanceIcon.textContent = '🚶';
            const distanceText = document.createElement('span');
            distanceText.className = 'distance-text';
            distanceText.textContent = formatDistance(restaurant.distance);
            distanceDiv.appendChild(distanceIcon);
            distanceDiv.appendChild(distanceText);
            infoContainer.appendChild(distanceDiv);
        }

        // 特色标签
        if (restaurant.business?.tag) {
            const tagsDiv = document.createElement('div');
            tagsDiv.className = 'restaurant-tags';
            const tags = restaurant.business.tag.split(';').slice(0, 3); // 最多显示3个标签
            tags.forEach(tag => {
                const tagSpan = document.createElement('span');
                tagSpan.className = 'tag-item';
                tagSpan.textContent = tag;
                tagsDiv.appendChild(tagSpan);
            });
            infoContainer.appendChild(tagsDiv);
        }

        contentDiv.appendChild(infoContainer);
        item.appendChild(contentDiv);

        return item;
    }

    /**
     * 创建商业信息区域
     * @param {Object} business - 商业信息
     * @returns {HTMLElement}
     */
    function createBusinessInfo(business) {
        const div = document.createElement('div');
        div.className = 'restaurant-business';

        const infoItems = [];

        // 评分
        if (business.rating) {
            infoItems.push(`
                <div class="business-item">
                    <span class="business-icon">⭐</span>
                    <span class="business-value">${business.rating}分</span>
                </div>
            `);
        }

        // 人均消费
        if (business.cost) {
            infoItems.push(`
                <div class="business-item">
                    <span class="business-icon">💰</span>
                    <span class="business-value">¥${business.cost}</span>
                </div>
            `);
        }

        // 今日营业时间
        if (business.opentime_today) {
            infoItems.push(`
                <div class="business-item">
                    <span class="business-icon">🕐</span>
                    <span class="business-value">${business.opentime_today}</span>
                </div>
            `);
        }

        div.innerHTML = infoItems.join('');
        return div;
    }

    /**
     * 格式化地址
     * @param {Object} restaurant - 餐厅数据
     * @returns {string}
     */
    function formatAddress(restaurant) {
        const parts = [];
        if (restaurant.adname) parts.push(restaurant.adname);
        if (restaurant.address) parts.push(restaurant.address);
        return parts.join(' ') || '地址未知';
    }

    /**
     * 格式化距离
     * @param {string|number} distance - 距离（米）
     * @returns {string}
     */
    function formatDistance(distance) {
        const dist = parseFloat(distance);
        if (isNaN(dist)) return '距离未知';

        if (dist < 1000) {
            return `${Math.round(dist)}米`;
        } else {
            return `${(dist / 1000).toFixed(1)}公里`;
        }
    }

    // 暴露公共接口
    return {
        render
    };
})();
