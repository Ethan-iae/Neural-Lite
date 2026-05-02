export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // === 基于"暗号"拦截 pages.dev 直接访问 ===
  // 在 Cloudflare Pages 后台设置环境变量：
  //   CANONICAL_DOMAIN = ai.ekiz.top （你的正式域名，不带 https://）
  //   PROXY_SECRET     = 你的暗号
  const proxySecret = request.headers.get("X-Proxy-Secret");
  const canonicalDomain = env.CANONICAL_DOMAIN;
  
  // 如果访问的是默认域名，且没有携带暗号
  if (url.hostname.endsWith(".pages.dev") && proxySecret !== env.PROXY_SECRET) {
    if (canonicalDomain) {
      // 301 重定向到正式域名
      return Response.redirect(`https://${canonicalDomain}${url.pathname}${url.search}`, 301);
    }
    // 如果未配置正式域名，直接拒绝访问
    return new Response("Forbidden - 请通过官方域名访问", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  // =================================================

  return await context.next();
}