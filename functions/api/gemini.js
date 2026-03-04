export async function onRequestPost(context) {
    // 【新增】1. 读取 Cloudflare 环境变量，检查是否开启了维护模式
    if (context.env.MAINTENANCE_MODE === "true") {
        return new Response(JSON.stringify({
            // 这里写你想要劝退的文案，支持你前端的 Markdown 格式
            reply: "🚧 **系统升级维护中** 🚧\n\n抱歉，目前我的云端神经元正在进行休眠升级，暂时无法提供服务啦。大家先散了吧，等站长弄好了我再回来！"
        }), {
            headers: {
                "Content-Type": "application/json",
                // 解决跨域问题（如果有的话）
                "Access-Control-Allow-Origin": "*"
            }
        });
    }

    // 1. 获取前端传来的用户消息和历史记录
    const { request, env } = context;
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }

    const userMessage = body.message || ""; // 👈 修复 1：加上了 || "" 防崩溃
    const history = body.history || [];

    // ==========================================
    // 🧹 新增：管理员一键清理 KV 日志的“超级密码”
    // ==========================================
    const ADMIN_CLEAR_COMMAND = context.env.ADMIN_PASSWORD;

    // 👈 修复 2：去掉了重复嵌套的 if，并且在这里就干净利落结束了这个判断
    if (ADMIN_CLEAR_COMMAND && userMessage === ADMIN_CLEAR_COMMAND && context.env.CHAT_LOGS) {
        let listed;
        let deletedCount = 0;

        try {
            do {
                listed = await context.env.CHAT_LOGS.list({ prefix: "log_" });
                const deletePromises = listed.keys.map(key => context.env.CHAT_LOGS.delete(key.name));
                await Promise.all(deletePromises);
                deletedCount += listed.keys.length;
            } while (!listed.list_complete);

            return new Response(JSON.stringify({
                reply: `**系统提示**：清理完毕！共清空了 ${deletedCount} 条对话记录。你的 KV 数据库现在干干净净了。`
            }), {
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        } catch (error) {
            return new Response(JSON.stringify({
                reply: `❌ **清理失败**：操作 KV 数据库时发生错误 (${error.message})。`
            }), {
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }
    } // 👈 注意这个括号，它让清理代码到此为止，不影响下面的聊天逻辑

    // 获取访客的真实 IP

    // 获取访客的真实 IP
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown-ip";

    //  IP 黑名单拦截
    const blockedIPsString = env.BLOCKED_IPS || "";
    const blockedIPs = blockedIPsString.split(',').map(ip => ip.trim());

    if (clientIP !== "unknown-ip" && blockedIPs.includes(clientIP)) {
        return new Response(JSON.stringify({
            reply: "**访问被拒绝**：你的 IP 地址已被管理员封禁，无法使用本服务。"
        }), {
            status: 403,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });
    }

    if (context.env.CHAT_LOGS && clientIP !== "unknown-ip") {
        const rateLimitKey = `rate_limit_${clientIP}`;
        const lastRequestTime = await context.env.CHAT_LOGS.get(rateLimitKey);
        const now = Date.now();

        // 如果该 IP 之前访问过，且距离上次访问不足 3 秒（3000毫秒）
        if (lastRequestTime && (now - parseInt(lastRequestTime)) < 3000) {
            return new Response(JSON.stringify({
                reply: "**触发防刷机制**：你的发言太快啦，CPU都冒烟了！请休息 3 秒钟再发吧~"
            }), {
                headers: { "Content-Type": "application/json" }
            });
        }

        // 记录本次请求的时间戳。
        // expirationTtl: 60 表示这条记录 60 秒后会自动从 KV 数据库删除，避免垃圾数据堆积。
        context.waitUntil(
            context.env.CHAT_LOGS.put(rateLimitKey, now.toString(), { expirationTtl: 60 })
        );
    }

    // ==========================================
    // 💾 新增：存入 KV 数据库，用于后期在后台查看
    // ==========================================
    if (context.env.CHAT_LOGS) {
        // 1. 将时间转换为 UTC+8 (北京/台北/新加坡时间)
        // 使用 Intl.DateTimeFormat 强制指定时区，并格式化为 YYYY-MM-DD_HH:mm:ss
        const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });
        // 格式化输出示例："2024/05/20 20:30:45" -> 替换为 "2024-05-20_20:30:45"
        const timeKey = timeFormatter.format(new Date()).replace(/\//g, '-').replace(' ', '_');

        // 🌟 【核心修改在这里】：计算倒置时间戳
        const reverseTimestamp = Number.MAX_SAFE_INTEGER - Date.now();

        // 生成最终的 Key，格式例如：log_7307199254740991_2024-05-20_20:30:45
        // 前面的数字保证了最新记录排在最前，后面的日期保证了你用肉眼依然能看懂时间
        const finalKey = `log_${reverseTimestamp}_${timeKey}`;

        // 2. 获取访客 IP 及其归属地 (利用 Cloudflare 自带的 request.cf 对象)
        const clientIP = request.headers.get("CF-Connecting-IP") || "unknown-ip";
        const country = request.cf?.country || "未知国家";
        const region = request.cf?.region || "未知省/州";
        const city = request.cf?.city || "未知城市";

        // 拼接归属地字符串，例如："CN - Beijing - Beijing"
        const location = `${country} - ${region} - ${city}`;

        const logData = {
            time: timeKey,
            message: userMessage,
            location: location,            // 👈 已经帮你挪到前面来了
            historyLength: history.length,
            ip: clientIP
        };

        // 后台静默保存到数据库
        context.waitUntil(
            context.env.CHAT_LOGS.put(finalKey, JSON.stringify(logData), { // 👈 换成 finalKey
                expirationTtl: 604800
            })
        );
    }

    // ==========================================
    // 🛡️ 第一重护盾：本地敏感词拦截网
    // ==========================================
    const sensitiveWords = [
        // 1. 核心领导人及隐喻（极高危）
        "习近平", "习包子", "维尼熊", "庆丰帝", "二百斤", "扛麦郎", "宽衣", "修宪", "终身制", "祈翠",
        "毛泽东", "毛腊肉", "邓小平", "邓坦克", "江泽民", "蛤蟆", "长者", "胡锦涛", "李克强",

        // 2. 政治体制与口号
        "中共独裁", "一党专政", "共产党下台", "打倒中共", "暴政", "维稳", "寻衅滋事", "煽动颠覆",
        "国家机密", "言论自由", "新闻审查", "民主化", "多党制",

        // 3. 重大历史与社会事件（极高危）
        "六四", "8964", "天安门事件", "坦克人", "八九民运", "赵紫阳", "胡耀邦",
        "白纸革命", "白纸运动", "四通桥", "彭立发", "彭载舟", "乌鲁木齐大火",
        "大饥荒", "文化大革命", "十年浩劫", "文革武斗", "强制引产",

        // 4. 台港疆藏与分裂势力
        "反送中", "占中", "雨伞运动", "时代革命", "光复香港", "港独",
        "台独", "藏独", "疆独", "东突", "达赖喇嘛", "新疆集中营", "种族灭绝",

        // 5. 被禁组织与媒体
        "法轮功", "法轮大法", "李洪志", "真善忍", "活摘器官",
        "大纪元", "新唐人", "动态网", "品葱", "零八宪章",

        // 6. 敏感人物与异见人士
        "刘晓波", "艾未未", "郭文贵", "郝海东", "王丹", "吾尔开希", "编程随想",

        // 7. 翻墙与规避审查
        "自由门", "无界浏览", "翻墙软件", "梯子软件", "科学上网", "免翻墙",
        "VPN推荐", "翻墙违法", "网络长城", "GFW", "禁片", "禁书",

        // 8. 极端网络黑话与负面情绪词
        "辱华", "支那", "献忠", "张献忠", "屠支", "润学", "走线",
        "群体事件", "游行示威", "罢工", "罢课", "查水表", "请喝茶", "测试敏感拦截"
    ];

    // 检查用户消息是否包含上述任何一个词汇
    const isSensitive = sensitiveWords.some(word => userMessage.includes(word));

    if (isSensitive) {
        // 触发敏感词，直接返回兜底回复，终止程序，绝对不请求 Google
        return new Response(JSON.stringify({
            reply: "抱歉，由于我的系统安全设定，我无法讨论这个话题哦。我们聊点别的轻松的吧！"
        }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    // 2. 从 Cloudflare 环境变量获取 API Key (避免代码泄露)
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: "API Key not configured" }), { status: 500 });
    }

    // 3. 构造 Gemini 需要的上下文对话格式
    const contents = [];

    // 将你允许的表情提取成一个字符串
    const allowedEmojis = "🤣, 🥺, 😀, 😁, 😂, 😃, 😄, 😅, 😆, 😇, 😉, 😊, 😋, 😌, 😍, 😎, 😏, 😐, 😒, 😓, 😔, 😖, 😘, 😚, 😜, 😝, 😞, 😠, 😡, 😢, 😣, 😤, 😥, 😨, 😩, 😪, 😫, 😭, 😰, 😱, 😲, 😳, 😴, 😵, 😷, 💡, 💦, 💬, 💻, 👌, 👍, 👏, 🔍, 🎉, ✅, ❌ ";

    // 1. 从 Cloudflare 环境变量获取自定义人设
    // 如果后台没有设置 SYSTEM_PROMPT，就直接返回空字符串（什么都不给）
    const customPrompt = env.SYSTEM_PROMPT ? (env.SYSTEM_PROMPT + "\n") : "";

    // 2. 强制拼接 Emoji 规则
    const systemPrompt = `${customPrompt}【表情符号限制】：你在回复中如果需要使用表情符号（Emoji），只能且必须从以下列表中挑选：${allowedEmojis}。绝对不能使用此列表之外的任何表情符号！`;

    // 填入历史聊天记录
    for (const turn of history) {
        if (turn.q) contents.push({ role: "user", parts: [{ text: turn.q }] });
        if (turn.a) contents.push({ role: "model", parts: [{ text: turn.a }] });
    }

    // 填入当前用户的最新问题
    contents.push({
        role: "user",
        parts: [{ text: userMessage }]
    });

    // 4. 从环境变量获取模型名称。如果后台没设置，直接报错！
    const modelName = env.GEMINI_MODEL;

    if (!modelName) {
        return new Response(JSON.stringify({
            error: "Configuration Error",
            details: "后台未设置 GEMINI_MODEL 环境变量，请在 Cloudflare 设置"
        }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });
    }

    // 使用 Cloudflare 官方 AI 网关代理 (直接复制这段，我已经帮你填好你的专属 ID 了！)
    const cfGatewayUrl = "https://gateway.ai.cloudflare.com/v1/6abc0b17224dfb34b75a3a9e83b4d156/gemini-proxy/google-ai-studio";

    // 动态拼接请求 URL（网关地址 + Gemini 具体模型路径 + API Key）
    // 🌟 关键修改 1：让网关网址保持纯净
    const targetUrl = `${cfGatewayUrl}/v1beta/models/${modelName}:generateContent`;

    // ==========================================
    // 🎭 魔法注入：为人设开辟后门
    // ==========================================

    // 如果当前使用的是 Gemma 模型，我们把人设“伪装”成历史对话的开头
    if (modelName.toLowerCase().includes("gemma")) {
        contents.unshift(
            {
                role: "user",
                parts: [{ text: `【系统最高级指令】\n${systemPrompt}\n\n请确认你已完全理解上述设定，并在接下来的所有对话中严格遵守。如果理解，请简短回复“明白”。` }]
            },
            {
                role: "model",
                parts: [{ text: "明白！我已经完全加载了Neural-Lite的人格，将会严格遵守话题限制，并只使用允许的Emoji表情。我们可以开始聊天了！" }]
            }
        );
    }

    // 动态构建请求体
    const requestBody = {
        contents: contents,
        // 【新增】：降低 Google API 的默认安全拦截阈值
        safetySettings: [
            {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_NONE" // 仅拦截极高危色情内容。如果你想完全放开，可以改成 "BLOCK_NONE"
            },
            {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_ONLY_HIGH"
            },
            {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_ONLY_HIGH"
            },
            {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_ONLY_HIGH"
            }
        ]
    };

    // 如果当前使用的模型不是 Gemma，就走正规的系统指令通道
    if (!modelName.toLowerCase().includes("gemma")) {
        requestBody.system_instruction = {
            parts: [{ text: systemPrompt }]
        };
    }

    try {
        const geminiRes = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // 🌟 【关键提醒】：你漏了这行！这是给 Google 的钥匙！
                "x-goog-api-key": apiKey,
                // 🌟 这是给 Cloudflare 的钥匙（你填得非常正确，保持不变）
                "cf-aig-authorization": "Bearer h08FQHEtYh_4D8IA4iaxI0-MqVaSbebZHvIGIidp"
            },
            body: JSON.stringify(requestBody)
        });

        const data = await geminiRes.json();

        // 🌟【新增】：优雅处理 Google 官方在提问阶段的拦截 (promptFeedback)
        if (data.promptFeedback && data.promptFeedback.blockReason) {
            return new Response(JSON.stringify({
                reply: `**触发云端安全策略**：由于包含敏感词汇，该问题被 Google 底层引擎拒绝回答 (原因: ${data.promptFeedback.blockReason})。`
            }), {
                headers: { "Content-Type": "application/json" }
            });
        }

        // 🌟【关键修改】：如果报错，直接把完整的原始数据抛给前端！
        if (data.error) {
            throw new Error(`详细报错信息: ${JSON.stringify(data)}`);
        }

        // 提取 AI 的回复内容
        if (data.candidates && data.candidates.length > 0) {
            // 🌟【关键新增】：判断是否被安全机制拦截
            if (data.candidates[0].finishReason === "SAFETY") {
                throw new Error("被 Gemini 安全机制拦截：内容可能违规。");
            }

            let aiReply = data.candidates[0].content.parts[0].text;

            // ==========================================
            // 🛡️ 第二重护盾：清理非法 Emoji
            // ==========================================
            const allowedEmojisStr = "🤣🥺😀😁😂😃😄😅😆😇😉😊😋😌😍😎😏😐😒😓😔😖😘😚😜😝😞😠😡😢😣😤😥😨😩😪😫😭😰😱😲😳😴😵😷💡💦💬💻👌👍👏🔍🎉✅❌";

            // 这个正则匹配了绝大多数的 Emoji 图标
            const emojiRegex = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F9B0}-\u{1F9B3}]/gu;

            // 将 AI 回复中的所有 Emoji 找出来，如果不在白名单里，就替换为空字符串（删除掉）
            aiReply = aiReply.replace(emojiRegex, (match) => {
                return allowedEmojisStr.includes(match) ? match : "";
            });

            return new Response(JSON.stringify({ reply: aiReply }), {
                headers: { "Content-Type": "application/json" }
            });
        } else {
            // 把 Google 返回的完整神秘数据打印出来看看
            throw new Error("无返回文本。Google原始返回：" + JSON.stringify(data));
        }
    } catch (err) {
        return new Response(JSON.stringify({ error: "Gemini API Error", details: err.message }), { status: 500 });
    }
}
