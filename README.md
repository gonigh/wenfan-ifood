# 🍜 问饭 - AI 美食助手

基于 DeepSeek AI 的智能美食 Web 应用，帮助你解决"今天吃什么"的世纪难题！

github：https://github.com/gonigh/wenfan-ifood/tree/main
在线demo：https://gonigh.github.io/wenfan-ifood/

## ✨ 功能特性

- 🎯 **智能菜单推荐**：根据人数推荐完整菜单，均衡搭配荤素
- 📖 **菜谱详情查询**：查询任意菜品的详细做法、食材配料和制作步骤
- 🤖 **自然对话交互**：使用 DeepSeek Function Calling 实现智能意图识别
- 💾 **丰富菜谱数据**：内置超过 3000+ 道菜的完整数据库
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
                    ┌───────────────────┴────────────────────┐
                    ↓                                        ↓
              getMenu (菜单推荐)                    getRecipe (菜谱查询)
                    ↓                                        ↓
            从菜谱库随机选择                        精确匹配菜品名称
         考虑荤素搭配 + 难度                        返回完整做法
                    ↓                                        ↓
                返回菜单数据                           返回菜谱详情
                    ↓                                        ↓
            MenuCard 组件渲染                     RecipeDetail 组件渲染
                    ↓                                        ↓
                  卡片展示                              详情页展示
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

3. **自然对话**
   - "有什么简单的家常菜？"
   - "推荐几道川菜"
   - "有什么适合新手的菜？"

## 📁 项目结构

```
wenfan/
├── src/
│   ├── index.html           # 主页面
│   ├── style.css            # 样式表（美食主题配色）
│   ├── app.js              # 主应用逻辑
│   ├── tools.js            # 工具函数（菜谱查询）
│   ├── menu-card.js        # 菜单卡片组件
│   ├── recipe-detail.js    # 菜品详情组件
│   ├── background.js       # 滚动背景管理
│   └── recipes-data.js     # 菜谱数据库（3000+ 菜品）
└── README.md
```

## 🔧 核心模块说明

### 1. Tools 模块 (`tools.js`)

提供两个核心工具函数供 AI 调用：

#### `getMenu(peopleCount, preferences)`
**功能**：智能推荐菜单
- **参数**：
  - `peopleCount`: 用餐人数（1-10）
  - `preferences`: 偏好设置（可选）
- **返回**：包含多道菜的菜单数据
- **逻辑**：
  - 根据人数计算菜品数量
  - 荤素搭配（60% 荤菜 40% 素菜）
  - 难度适中优先

#### `getRecipe(dishName)`
**功能**：查询菜谱详情
- **参数**：`dishName` - 菜品名称
- **返回**：完整菜谱数据或错误信息
- **逻辑**：模糊匹配菜品名称

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


## 🛠️ 开发扩展

### 添加新菜品

编辑 `src/recipes-data.js`，按照以下格式添加：

```javascript
{
  "name": "菜品名称的做法",
  "category": "分类（主食/荤菜/素菜/汤/水产/甜品等）",
  "difficulty": 3,  // 1-5 星
  "description": "菜品描述",
  "ingredients": [
    {
      "name": "食材名",
      "quantity": 100,
      "unit": "克",
      "text_quantity": "- 食材名 100克"
    }
  ],
  "steps": [
    {
      "step": 1,
      "description": "步骤描述",
      "duration_minutes": 5
    }
  ]
}
```


## 📝 待办事项

- [ ] 添加菜谱搜索过滤
- [ ] 支持用户上传菜谱

## 📄 许可证

ISC License

## 🙏 致谢

- 菜谱数据来源：[HowToCook](https://github.com/Anduin2017/HowToCook)
- AI 模型提供：[DeepSeek](https://www.deepseek.com/)

