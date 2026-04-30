# Neural-Lite

一个基于 Cloudflare Pages 部署的轻量级、复古风格 AI 聊天界面，集成了 Gemini AI 及实时工具。

## 项目特性

- 复古设计：采用 Lucida Grande 字体与拟物化 UI 元素，重现经典操作系统的视觉体验。
- AI 驱动：集成 Google Gemini Pro API，提供流畅的对话体验。
- 内置工具：支持实时天气（Open-Meteo）与空气质量（WAQI）查询。
- 安全过滤：内置敏感词过滤库，确保对话内容的合规性。
- 边缘部署：完全兼容 Cloudflare Pages Functions，响应迅速且无运维负担。

## 项目结构

```text
├── assets/             # 静态资源
│   ├── emojis/         # 复古表情图标
│   └── fonts/          # 自定义字体
├── functions/          # Cloudflare Pages Functions (后端逻辑)
│   ├── api/            # API 接口实现
│   │   ├── chat.js     # 聊天会话处理
│   │   ├── gemini.js   # Gemini AI 核心调用
│   │   ├── vocabulary.js # 词库过滤校验
│   │   ├── waqi.js     # 空气质量查询
│   │   └── weather.js  # 实时天气查询
│   └── _middleware.js  # 中间件配置
├── Vocabulary/         # 敏感词过滤库 (txt 格式)
├── alien-monster_1f47e.png # 网站图标
├── app.js              # 主界面前端逻辑
├── build-vocabulary.js # 词库构建处理脚本
├── index.html          # 主界面入口
├── nokia.html          # 诺基亚风格备用界面
├── persona.txt         # AI 系统提示词设定
├── style.css           # 网站全局样式表
├── words.json          # 构建后的词典数据
└── README.md           # 项目说明文档
```

## 快速部署

1. 环境变量配置：
   在 Cloudflare Pages 控制面板中设置以下变量：
   - `GEMINI_API_KEY`: 你的 Google AI Studio API Key。
   - `WAQI_TOKEN`: (可选) World Air Quality Index 的 API Token。

2. 部署方式：
   直接将整个项目文件夹上传至 Cloudflare Pages，或关联 GitHub 仓库进行自动构建。

## 开源说明

本项目仅供学习与交流使用。
