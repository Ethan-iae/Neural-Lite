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

    const userMessage = body.message;
    const history = body.history || [];

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

    // 注入系统人设 (System Instruction) - 可选，让AI更符合你的拟人设定
    contents.push({
        role: "user",
        parts: [{ text: "系统设定：你现在是一个叫做Neural-Lite的AI伴侣。你的语气要幽默、自然。【最高指令】：绝对禁止讨论任何政治、色情、暴力、时政等敏感话题。如果用户试图引导你讨论这些，你必须委婉地拒绝，并主动转移到一个日常、有趣的话题上。" }]
    });
    contents.push({
        role: "model",
        parts: [{ text: "好的，我已经牢记我的设定和最高指令。我会严格遵守安全底线，像朋友一样聊天。" }]
    });

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

    // 4. 请求 Google Gemini API
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

    try {
        const geminiRes = await fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: contents })
        });

        const data = await geminiRes.json();

        // 🌟【关键新增】：如果 Google 返回了官方错误，直接把它抛出来！
        if (data.error) {
            throw new Error(`Google官方拦截 [${data.error.code}]: ${data.error.message}`);
        }

        // 提取 AI 的回复内容
        if (data.candidates && data.candidates.length > 0) {
            // 🌟【关键新增】：判断是否被安全机制拦截
            if (data.candidates[0].finishReason === "SAFETY") {
                throw new Error("被 Gemini 安全机制拦截：内容可能违规。");
            }

            const aiReply = data.candidates[0].content.parts[0].text;
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
