# Neural-Lite

一个基于 Cloudflare Pages 部署的复古风格 AI 聊天界面，集成了 Google Gemini 模型，实时工具与后台管控。

## 项目特性

- **拟物设计**：采用 Lucida Grande 字体与经典的 UI 元素，重现早期操作系统的视觉体验（提供默认界面及诺基亚风格备用界面）。
- ** AI 驱动**：集成 Google Gemini API，支持自定义模型（`GEMINI_MODEL`）与系统提示词（`SYSTEM_PROMPT`），提供个性化的对话体验。
- **实时工具**：支持基于地理位置的实时天气（Open-Meteo）与空气质量（WAQI）查询。
- **内容合规**：内置离线敏感词过滤系统，并在部署时自动构建词典。
- **后台管控**：
  - **访问控制**：支持通过 `PROXY_SECRET` 限制直接访问，支持 `BLOCKED_IPS` 封禁特定恶意 IP，并可一键开启 `MAINTENANCE_MODE` 维护模式。
  - **日志与管理**：结合 Cloudflare KV (`CHAT_LOGS`)，实现对话日志记录、滥用自动封禁机制，并支持在对话框中通过 `ADMIN_PASSWORD` 执行后台清理与解封等特殊指令。

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

本项目设计为直接部署在 **Cloudflare Pages**，由于包含后端 API（位于 `functions` 目录），请遵循以下详细步骤进行配置和部署：

### 1. 前期准备
- **Cloudflare 账号**：用于免费部署 Pages 应用和无服务器函数（Functions）。
- **Google Gemini API Key**：前往 [Google AI Studio](https://aistudio.google.com/) 获取。
- **WAQI Token**（可选）：前往 [WAQI](https://aqicn.org/data-platform/token/) 获取 API Token，用于空气质量查询功能。

### 2. 获取代码
将本项目 Fork 到你自己的 GitHub 仓库，或者克隆到本地后推送到你的 GitHub 仓库。

### 3. 创建 Cloudflare Pages 项目
1. 登录 Cloudflare 控制台，在左侧导航栏选择 **“Workers & Pages”**。
2. 点击 **“创建应用”** (Create application) -> 选择 **“Pages”** 选项卡 -> 点击 **“连接到 Git”** (Connect to Git)。
3. 授权 Cloudflare 访问你的 GitHub 账号，并选择你刚才 Fork/上传的 `Neural-Lite` 仓库。
4. 点击 **“开始设置”** (Begin setup)。

### 4. 构建配置项 (Build settings)
在设置页面，按照以下信息进行配置：
- **项目名称**：(自定义)
- **生产分支**：`main` 或你实际的主分支。
- **框架预设 (Framework preset)**：选择 `None`。
- **构建命令 (Build command)**：填写 `node build-vocabulary.js`（确保每次部署前自动从 txt 词库生成最新词典）。
- **构建输出目录 (Build output directory)**：留空，或填写 `/`。

### 5. 环境变量与 KV 命名空间配置
在部署设置页面的下方，找到 **“环境变量 (Environment variables)”** 并添加以下键值对：

#### 必填变量
- `GEMINI_API_KEY`: 你的 Google Gemini API Key。

#### 可选变量
- `WAQI_API_KEY`: World Air Quality Index 的 API Token（用于空气质量查询）。
- `PROXY_SECRET`: 用于保护 Pages.dev 域名的访问密钥（如需限制直接访问）。
- `MAINTENANCE_MODE`: 设置为 `"true"` 以开启维护模式。
- `ADMIN_PASSWORD`: 管理员密码，用于在对话框中执行特殊管理命令（如清理日志/封禁）。
- `BLOCKED_IPS`: 封禁的 IP 列表（如需封禁特定 IP，用逗号分隔）。
- `SYSTEM_PROMPT`: 自定义 AI 系统提示词（若未设置则使用默认的人格设定）。
- `GEMINI_MODEL`: 自定义使用的 Gemini 模型名称（如不填，默认可能是 gemini-pro 或代码中指定的模型）。
- `CF_GATEWAY_URL`: Cloudflare AI Gateway URL（用于代理/记录 API 请求，如不使用可不填）。
- `CF_AIG_TOKEN`: Cloudflare AI Gateway 授权 Token（与 `CF_GATEWAY_URL` 配合使用）。

#### KV 命名空间绑定 (KV namespace bindings)
如果在代码中启用了日志记录或封禁功能，需要在 Cloudflare 中创建一个 KV 命名空间并绑定：
- 变量名称 (Variable name): `CHAT_LOGS`
- KV 命名空间 (KV namespace): 选择你创建的日志记录空间。

*(建议在生产和预览环境中都配置上述环境变量和绑定)*

### 6. 保存并部署
1. 点击 **“保存并部署”** (Save and Deploy)。
2. 等待 Cloudflare 拉取代码、运行构建命令并部署静态文件与 Functions。
3. 部署成功后，你将获得一个类似于 `https://xxx.pages.dev` 的免费域名，点击即可体验！

### 7. （可选）本地开发与测试
如果你需要在本地运行和调试本项目：
1. 确保已安装 [Node.js](https://nodejs.org/) 和 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`)。
2. 在项目根目录下创建 `.dev.vars` 文件，并填入你的环境变量：
   ```env
   GEMINI_API_KEY=你的API_KEY
   WAQI_API_KEY=你的WAQI_API_KEY
   # 其他可选变量也可以写在这里，例如：
   # MAINTENANCE_MODE=false
   # ADMIN_PASSWORD=你的管理密码
   ```
3. 运行 `node build-vocabulary.js` 生成最新的词典文件。
4. 运行 `wrangler pages dev .` 启动本地测试服务器。

## 开源说明

本项目仅供学习与交流使用。
