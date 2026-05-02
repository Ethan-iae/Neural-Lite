export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 防直连和暗号验证逻辑已移除，适配单变量通用反代脚本。

  return await context.next();
}