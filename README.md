# 🍜 问饭 - AI 美食助手

基于 DeepSeek AI 的智能美食 Web 应用，帮助你解决"今天吃什么"的世纪难题！

github：https://github.com/gonigh/wenfan-ifood/tree/main

在线demo：https://gonigh.github.io/wenfan-ifood/

## ✨ 功能特性

- 🎯 **智能菜单推荐**：根据人数推荐完整菜单，均衡搭配荤素
- 📖 **菜谱详情查询**：查询任意菜品的详细做法、食材配料和制作步骤
- 🔍 **联网实时搜索**：本地找不到菜品时，自动联网搜索并整理最新做法
- 📥 **自定义菜谱库**：保存联网搜索的菜品，或添加自己的独家配方
- 🤖 **自然对话交互**：使用 DeepSeek Function Calling 实现智能意图识别
- 💾 **丰富菜谱数据**：内置超过 3000+ 道菜的完整数据库，可扩展
- 🎨 **动态滚动背景**：6 行可点击的美食滚动展示，增强视觉体验
- 🃏 **美观卡片展示**：菜单以精美卡片形式呈现，支持查看详情

## 🏗️ 技术架构

### 核心技术栈

- **前端框架**: 原生 HTML5 + CSS3 + JavaScript (ES6+)
- **AI 模型**: DeepSeek Chat (支持 Function Calling)
- **Markdown 渲染**: Marked.js
- **截图功能**: html2canvas

### 架构设计

```
用户输入 → DeepSeek API 分析意图 → Function Calling
                                        ↓
        ┌───────────────────────────────┴────────────────────────────┐
        ↓                               ↓                             ↓
  getMenu (菜单推荐)          getRecipe (菜谱查询)          addRecipe (添加菜谱)
        ↓                               ↓                             ↓
  从菜谱库随机选择                 精确匹配菜品名称                保存到本地存储
  考虑荤素搭配 + 难度                     ↓                      (localStorage)
        ↓                        ┌──────┴──────┐
    返回菜单数据                  ↓              ↓
        ↓                      找到          未找到
  MenuCard 组件渲染               ↓              ↓
        ↓                    返回菜谱       联网搜索 🔍
      卡片展示                   ↓         (Web Search)
                                 ↓              ↓
                        RecipeDetail       AI 整理做法
                           组件渲染            ↓
                                 ↓         显示详情 + 
                             详情页展示    "加入菜品库"按钮
```

## 🚀 使用指南

### 快速开始

1. **首次使用**
   - 应用已预置体验用 API Key，可直接使用
   - 首次打开时 API Key 已自动填充，无需手动配置
   - ⚠️ **重要提示**：默认 Key 仅供体验，大规模使用请申请自己的 Key

2. **替换 API Key（可选）**
   - 点击右上角"⚙️ 设置"按钮
   - 前往 [DeepSeek 官网](https://platform.deepseek.com/api_keys) 申请免费 API Key
   - 在设置面板中替换为自己的 Key
   - API Key 会自动保存到浏览器 localStorage

### 基本使用

1. **推荐菜单**
   - 输入："推荐一份 4 人的菜单"
   - 输入："今天吃什么？"
   - 点击预制问题按钮

2. **查询菜谱**
   - 输入："麻婆豆腐怎么做？"
   - 输入："宫保鸡丁的做法"
   - 点击菜单卡片的"查看做法"按钮
   - 点击背景滚动的菜品

3. **联网搜索新菜品** 🆕
   - 输入："冰粉怎么做？"（本地没有时自动联网搜索）
   - 输入："油泼辣子的做法"
   - AI 会自动联网搜索并整理做法
   - 可点击"加入菜品库"保存到本地

4. **添加自定义菜谱** 🆕
   - 输入："帮我添加一道菜：我的秘制红烧肉..."
   - 提供菜品名称、食材、步骤等信息
   - AI 会自动整理并保存到本地
   - 下次查询时可直接使用

5. **自然对话**
   - "有什么简单的家常菜？"
   - "推荐几道川菜"
   - "有什么适合新手的菜？"

## 📁 项目结构

```
wenfan/
├── index.html              # 主页面
├── src/
│   ├── app.js              # 核心应用逻辑 (379行)
│   ├── helpers.js          # 辅助函数模块 🆕
│   ├── tools.js            # AI 工具函数（菜谱 CRUD）
│   ├── menu-card.js        # 菜单卡片组件
│   ├── recipe-detail.js    # 菜品详情组件
│   ├── background.js       # 滚动背景管理
│   ├── recipes-data.js     # 菜谱数据库（3000+ 菜品）
│   └── style.css           # 样式表（美食主题配色）
└── README.md
```

## 🔧 核心模块说明

### 1. Tools 模块 (`tools.js`)

提供三个核心工具函数供 AI 调用：

#### `getMenu(peopleCount)`
**功能**：智能推荐菜单
- **参数**：`peopleCount` - 用餐人数（1-20）
- **返回**：包含多道菜的菜单数据
- **逻辑**：
  - 根据人数计算菜品数量
  - 荤素搭配（人数÷2 向上取整）
  - 8人以上额外添加鱼类
  - 随机化肉类优先级增加多样性

#### `getRecipe(dishName)`
**功能**：查询菜谱详情
- **参数**：`dishName` - 菜品名称
- **返回**：完整菜谱数据或错误信息
- **逻辑**：
  - 精确匹配 ID 和名称
  - 模糊匹配（支持去掉"的做法"）
  - 本地找不到时返回错误，触发联网搜索

#### `addRecipe(recipeData)` 🆕
**功能**：添加自定义菜谱
- **参数**：`recipeData` - 菜品完整数据对象
- **返回**：操作成功或失败信息
- **逻辑**：
  - 验证必需字段（名称、分类）
  - 生成唯一 ID
  - 保存到 localStorage
  - 同名菜品自动更新

### 2. MenuCard 组件 (`menu-card.js`)

**功能**：渲染菜单卡片
- 网格布局展示多道菜
- 显示菜品图片、名称、分类、难度
- "查看做法"按钮交互

### 3. RecipeDetail 组件 (`recipe-detail.js`)

**功能**：渲染菜品详情
- 完整的食材配料列表
- 带编号的制作步骤
- 份数调整功能
- 截图分享功能

### 4. Background 模块 (`background.js`)

**功能**：动态滚动背景
- 从菜谱数据中随机抽取 90 个菜品
- 6 行不同速度滚动
- 根据分类智能匹配 emoji
- 点击触发菜谱查询

### 5. Helpers 模块 (`helpers.js`) 🆕

**功能**：辅助函数集合，优化代码结构

#### `searchRecipeOnline(dishName, messageId, apiKey, updateMessageFn, addMessageFn)`
- **功能**：联网搜索菜品做法
- **流程**：
  1. 调用 DeepSeek API 启用 `web_search`
  2. AI 联网搜索并按 JSON 格式整理
  3. 渲染菜品详情组件
  4. 添加"加入菜品库"按钮

#### `generateSuggestionsWithAI(conversationHistory, apiKey)`
- **功能**：AI 生成智能后续问题建议
- **逻辑**：根据对话历史生成 3-4 个相关问题

#### `showSuggestions(questions, sendMessageFn)`
- **功能**：在 UI 中显示建议问题按钮

#### `handleViewRecipe(dishName, sendMessageFn)`
- **功能**：处理查看菜谱逻辑
- **逻辑**：本地查找 → 显示详情或触发 AI 查询

#### `bindSuggestionButtons(sendMessageFn)`
- **功能**：绑定建议按钮点击事件


## 🛠️ 开发扩展

### 方式一：通过 AI 对话添加 🆕 推荐

直接在对话中告诉 AI：

```
"帮我添加一道菜：我的秘制红烧肉
食材：五花肉500克，冰糖30克...
步骤：1. 五花肉切块焯水..."
```

AI 会自动：
- 整理成标准格式
- 调用 `addRecipe` 工具
- 保存到浏览器本地存储
- 可随时查询和使用

### 方式二：手动编辑数据文件

编辑 `src/recipes-data.js`，按照以下格式添加：

```javascript
{
  "id": "custom-xxx",
  "name": "菜品名称的做法",
  "category": "分类（主食/荤菜/素菜/汤羹/水产/甜品等）",
  "difficulty": 3,  // 1-5 星
  "description": "菜品描述",
  "ingredients": [
    {
      "name": "食材名",
      "text_quantity": "100克"
    }
  ],
  "steps": [
    {
      "step": 1,
      "description": "步骤描述"
    }
  ],
  "prep_time_minutes": 10,
  "cook_time_minutes": 20
}
```

### 数据存储说明

- **内置菜谱**：存储在 `recipes-data.js` 文件中
- **自定义菜谱**：存储在浏览器 `localStorage` 中
- **合并策略**：启动时自动合并，自定义菜谱优先显示

## 📄 许可证

ISC License

## 🙏 致谢

- 菜谱数据来源：[HowToCook](https://github.com/Anduin2017/HowToCook)
- AI 模型提供：[DeepSeek](https://www.deepseek.com/)

