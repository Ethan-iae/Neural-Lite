export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // === 新增逻辑：基于“暗号”拦截 pages.dev 直接访问 ===
  const proxySecret = request.headers.get("X-Proxy-Secret");
  
  // 如果访问的是默认域名，且没有携带我们在 Worker 中设置的暗号
  if (url.hostname.endsWith(".pages.dev") && proxySecret !== env.PROXY_SECRET) {
    // 强烈建议使用 301 重定向，把乱跑的用户引回你的正规域名
    return Response.redirect(`https://ai.ekiz.top${url.pathname}${url.search}`, 301);
    
    // (如果你不想跳转，只想报错，可以取消下面这行的注释并删掉上面的 return)
    // return new Response("Forbidden - 请通过官方域名 ai.ekiz.top 访问", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  // =================================================

  return await context.next();
}