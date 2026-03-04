export async function onRequest(context) {
  const { request } = context;
  
  // ==========================================
  // 在这里修改为你想要的用户名和密码
  const USERNAME = "a";
  const PASSWORD = "a"; 
  // ==========================================

  // 获取请求头中的 Authorization 信息
  const authHeader = request.headers.get("Authorization");
  
  // 将你的账号密码进行 Base64 编码以作对比
  const expectedAuth = `Basic ${btoa(`${USERNAME}:${PASSWORD}`)}`;

  // 如果没有验证信息，或者密码错误，则拦截请求并要求输入密码
  if (!authHeader || authHeader !== expectedAuth) {
    return new Response("Unauthorized - 请输入密码以访问", {
      status: 401,
      headers: {
        // 触发浏览器的自带密码输入弹窗
        "WWW-Authenticate": 'Basic realm="Private Site"',
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  // 如果账号密码正确，放行请求，正常加载你的网站原本内容
  return await context.next();
}