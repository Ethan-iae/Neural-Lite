/**
 * gemini.js — 保留的独立 Gemini API 端点（薄壳）
 * 
 * 核心逻辑已提取到 lib/gemini-core.js。
 * 此文件仅作为 /api/gemini 路由入口，调用共享模块。
 */

import { processGeminiRequest, handleOptions } from "../lib/gemini-core.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
    });
  }

  const clientIP =
    request.headers.get("X-My-Custom-Real-IP") ||
    request.headers.get("CF-Connecting-IP") ||
    "unknown-ip";

  return await processGeminiRequest({
    userMessage: (body.message || "").substring(0, 2000),
    history: body.history || [],
    clientIP,
    clientType: body.client || "",
    env,
    context,
    cfData: request.cf || {},
    geoHeaders: {
      country: request.headers.get("X-Real-Country"),
      region: request.headers.get("X-Real-Region"),
      city: request.headers.get("X-Real-City"),
    },
  });
}

// ==========================================
// 🌐 处理跨域请求 (CORS) 预检
// ==========================================
export async function onRequestOptions() {
  return handleOptions();
}
