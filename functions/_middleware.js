export async function onRequest(context) {
  const { request } = context;
  
  // ==========================================
  const USERNAME = "a";
  const PASSWORD = "a"; 
  // 定义一个暗号 Cookie，名字和值可以随便改
  const COOKIE_NAME = "nokia_pass";
  const COOKIE_VALUE = "yes";
  // ==========================================

  // 1. 第一重验证：检查老手机有没有携带我们之前发过的暗号 Cookie
  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader && cookieHeader.includes(`${COOKIE_NAME}=${COOKIE_VALUE}`)) {
    // 只要有正确的 Cookie，直接放行，不再要求输入密码
    return await context.next();
  }

  // 2. 第二重验证：如果没有 Cookie，则检查自带界面的账密
  const authHeader = request.headers.get("Authorization");
  const expectedAuth = `Basic ${btoa(`${USERNAME}:${PASSWORD}`)}`;

  if (!authHeader || authHeader !== expectedAuth) {
    // 没密码或密码错误，弹出原生的系统级密码框
    return new Response("Unauthorized - 请输入密码以访问", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Private Site"',
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  // 3. 验证通过：拦截后续的响应，给手机塞一个长期有效的 Cookie
  const response = await context.next();
  // 因为 context.next() 返回的 response 是只读的，需要复制一份才能修改头信息
  const newResponse = new Response(response.body, response);
  
  // 设置一个有效期为 10 年的 Cookie
  // HttpOnly 防脚本偷窥，Secure 保证只在 HTTPS 加密通道传输
  newResponse.headers.append(
    "Set-Cookie", 
    `${COOKIE_NAME}=${COOKIE_VALUE}; Path=/; Max-Age=315360000; HttpOnly; Secure`
  );

  return newResponse;
}