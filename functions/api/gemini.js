export async function onRequestPost(context) {
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
        parts: [{ text: "系统设定：你现在是一个运行在本地浏览器里的拟人化AI伴侣，叫做Neural-Lite。你的语气应该像一个人类朋友，幽默、有同理心。请尽量用简短、自然的中文口语回复我。" }]
    });
    contents.push({
        role: "model",
        parts: [{ text: "好的，我已经记住了我的设定。我会像朋友一样和你聊天。" }]
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

    // 4. 请求 Google Gemini API (这里使用免费的 gemini-1.5-flash 或 gemini-2.5-flash)
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    try {
        const geminiRes = await fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: contents })
        });

        const data = await geminiRes.json();

        // 提取 AI 的回复内容
        if (data.candidates && data.candidates.length > 0) {
            const aiReply = data.candidates[0].content.parts[0].text;
            return new Response(JSON.stringify({ reply: aiReply }), {
                headers: { "Content-Type": "application/json" }
            });
        } else {
            throw new Error("No candidates in response");
        }
    } catch (err) {
        return new Response(JSON.stringify({ error: "Gemini API Error", details: err.message }), { status: 500 });
    }
}