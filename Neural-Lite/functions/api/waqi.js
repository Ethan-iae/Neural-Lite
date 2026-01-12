export async function onRequest(context) {
    // 从请求 URL 中获取查询参数 (city)
    const { request } = context;
    const url = new URL(request.url);
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