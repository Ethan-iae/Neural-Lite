export async function onRequest(context) {
    // 从请求 URL 中获取查询参数 (city)
    const { request } = context;
    const url = new URL(request.url);
    // === 1. 新增：先看看是不是查百科 ===
    const type = url.searchParams.get("type"); 

    if (type === "wiki") {
        const keyword = url.searchParams.get("keyword");
        if (!keyword) return new Response("Missing keyword", { status: 400 });

        // 维基百科接口地址
        const targetUrl = `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(keyword)}`;
        
        try {
            const response = await fetch(targetUrl, {
                headers: { "User-Agent": "Neural-Lite-Bot/1.0" } // 必填身份标识
            });

            // 如果没找到词条
            if (response.status === 404) {
                return new Response(JSON.stringify({ found: false }), {
                    headers: { "content-type": "application/json" }
                });
            }

            // 找到了，返回数据
            const data = await response.json();
            return new Response(JSON.stringify({ found: true, data: data }), {
                headers: { "content-type": "application/json" }
            });
        } catch (err) {
            return new Response(JSON.stringify({ found: false }), { status: 500 });
        }
    }
    // === 插入结束，下面是你原来的代码，不用动 ===
    const city = url.searchParams.get("city");

    if (!city) {
        return new Response(JSON.stringify({ error: "City is required" }), {
            headers: { "content-type": "application/json" },
            status: 400,
        });
    }

    // --- 这里是你的 API Key，现在它运行在服务器端，用户看不到了 ---
    const token = '8eb22fc66433b4f47fbc76b6c3b00a3375049fc2';
    const targetUrl = `https://api.waqi.info/search/?keyword=${encodeURIComponent(city)}&token=${token}`;

    try {
        // 服务器代为请求 WAQI 接口
        const response = await fetch(targetUrl);
        const data = await response.json();

        // 将结果返回给你的前端
        return new Response(JSON.stringify(data), {
            headers: {
                "content-type": "application/json",
                // 允许你的网页访问这个接口
                "Access-Control-Allow-Origin": "*"
            },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: "Failed to fetch data" }), {
            headers: { "content-type": "application/json" },
            status: 500,
        });
    }
}