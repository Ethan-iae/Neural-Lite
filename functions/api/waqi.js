export async function onRequest(context) {
    // 1. 从 context 中获取 request 和 env（环境变量对象）
    const { request, env } = context;
    const url = new URL(request.url);
    const city = url.searchParams.get("city");

    if (!city) {
        return new Response(JSON.stringify({ error: "City is required" }), {
            headers: { "content-type": "application/json" },
            status: 400,
        });
    }

    // 2. 从 Cloudflare 环境变量获取 API Key (避免代码泄露)
    const token = env.WAQI_API_KEY;
    
    // 增加一个安全校验：如果没有读取到环境变量，则返回错误
    if (!token) {
        return new Response(JSON.stringify({ error: "WAQI API Key not configured" }), {
            headers: { "content-type": "application/json" },
            status: 500,
        });
    }

    const targetUrl = `https://api.waqi.info/search/?keyword=${encodeURIComponent(city)}&token=${token}`;

    try {
        // 服务器代为请求 WAQI 接口
        const response = await fetch(targetUrl);
        const data = await response.json();

        // 将结果返回给前端
        return new Response(JSON.stringify(data), {
            headers: {
                "content-type": "application/json",
                // 允许网页访问这个接口
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