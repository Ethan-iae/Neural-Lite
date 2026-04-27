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

  // 下面是你原本的密码验证逻辑，保持不变
  const USERNAME = "a";
  const PASSWORD = "a"; 
  const COOKIE_NAME = "nokia_pass";
  const COOKIE_VALUE = "yes";

  // 1. 检查老手机有没有携带 Cookie
  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader && cookieHeader.includes(`${COOKIE_NAME}=${COOKIE_VALUE}`)) {
    return await context.next();
  }

  // 2. 检查原生账密
  const authHeader = request.headers.get("Authorization");
  const expectedAuth = `Basic ${btoa(`${USERNAME}:${PASSWORD}`)}`;

  if (!authHeader || authHeader !== expectedAuth) {
    return new Response("Unauthorized - 请输入密码以访问", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Private Site"',
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  // 3. 验证通过：生成完美兼容老手机的 Cookie
  const response = await context.next();
  const newResponse = new Response(response.body, response);
  
  const expiresDate = new Date();
  expiresDate.setFullYear(expiresDate.getFullYear() + 10);
  const expiresString = expiresDate.toUTCString();
  
  newResponse.headers.append(
    "Set-Cookie", 
    `${COOKIE_NAME}=${COOKIE_VALUE}; Path=/; Max-Age=315360000; Expires=${expiresString}; HttpOnly; Secure`
  );

  return newResponse;
}