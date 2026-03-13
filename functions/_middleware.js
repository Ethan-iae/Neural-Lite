export async function onRequest(context) {
  const { request } = context;
  
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
  
  // 计算出 10 年后的具体时间，转为老浏览器能懂的 UTC 格式
  const expiresDate = new Date();
  expiresDate.setFullYear(expiresDate.getFullYear() + 10);
  const expiresString = expiresDate.toUTCString();
  
  // 双管齐下：同时加入 Max-Age 和 Expires
  newResponse.headers.append(
    "Set-Cookie", 
    `${COOKIE_NAME}=${COOKIE_VALUE}; Path=/; Max-Age=315360000; Expires=${expiresString}; HttpOnly; Secure`
  );

  return newResponse;
}