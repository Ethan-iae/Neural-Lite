# Neural-Lite

一个复古 Aqua 拟物风格的 Web 聊天机器人。

项目采用混合架构：简单的关键词触发和特定指令由前端的本地正则引擎处理，复杂的对话则交由后端的 Gemini 大模型兜底。

## 特性

- **复古 UI**：纯 CSS 还原 2000 年代的玻璃质感、金属拉丝和高光气泡，支持深色模式平滑切换。
- **混合大脑**：本地模糊匹配 + 状态捕获提取记忆，本地词库无法拦截的问题自动转发给 Gemini API。
- **原生交互**：内置 Web Audio API 零延迟音效，针对手机键盘弹出和大屏拖拽做了深度适配。
- **数据留存**：聊天记录和基本人设（如称呼、情绪）均直接保存在浏览器的 `localStorage` 中。
- **实用功能**：整合了实时的天气与空气质量（AQI）查询。

## 技术栈

- **前端**：HTML / CSS / 原生 JS
- **后端**：Cloudflare Pages Functions (Serverless)
- **大模型**：Google Gemini API
- **第三方 API**：waqi / open-meteo
