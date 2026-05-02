/**
 * gemini-core.js — 共享 Gemini API 核心逻辑
 * 
 * 提取自 gemini.js，供 chat.js 和 gemini.js 共同调用。
 * 消除了 loopback HTTP 子请求，改为直接函数调用。
 */

import { sensitiveWords } from "../api/vocabulary.js";

// ==========================================
// 辅助工具
// ==========================================

/**
 * 创建标准 JSON 响应
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/**
 * 处理 CORS 预检请求
 */
export function handleOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// ==========================================
// 核心处理函数
// ==========================================

/**
 * 处理 Gemini 聊天请求的完整逻辑。
 * 包含：维护模式检查、对话长度限制、管理员指令、IP 封禁、
 * 速率限制、敏感词拦截、日志记录、API 调用、后处理。
 *
 * @param {Object} options
 * @param {string} options.userMessage - 用户消息 (已截断到 2000 字)
 * @param {Array}  options.history     - 对话历史
 * @param {string} options.clientIP    - 客户端真实 IP
 * @param {string} options.clientType  - 客户端类型 ('nokia' 或其他)
 * @param {Object} options.env         - Cloudflare 环境变量
 * @param {Object} options.context     - Cloudflare context (用于 waitUntil)
 * @param {Object} options.cfData      - request.cf 数据 (国家/地区/城市)
 * @param {Object} options.geoHeaders  - 地理位置请求头
 * @returns {Response}
 */
export async function processGeminiRequest({
  userMessage,
  history,
  clientIP,
  clientType,
  env,
  context,
  cfData,
  geoHeaders,
}) {
  // --- 维护模式 ---
  if (env.MAINTENANCE_MODE === "true") {
    return jsonResponse({
      reply:
        " **系统升级维护中** \n\n抱歉，目前我的云端神经元正在进行休眠升级，暂时无法提供服务啦。大家先散了吧，等站长弄好了我再回来！",
    });
  }

  // --- 对话长度限制 ---
  if (history.length >= 60) {
    return jsonResponse({
      reply:
        " **对话长度提醒**\n\n当前的对话历史已达到**60条**的上限啦。为了保证我的回复质量和运行效率，请开启新话题，我们重新开始聊吧！",
    });
  }

  // --- 管理员指令 ---
  const ADMIN_COMMAND = env.ADMIN_PASSWORD;
  if (ADMIN_COMMAND && env.CHAT_LOGS) {
    // 指令 1：清空所有日志
    if (userMessage === ADMIN_COMMAND) {
      let listed;
      let deletedCount = 0;
      try {
        do {
          listed = await env.CHAT_LOGS.list({ prefix: "log_" });
          const deletePromises = listed.keys.map((key) =>
            env.CHAT_LOGS.delete(key.name),
          );
          await Promise.all(deletePromises);
          deletedCount += listed.keys.length;
        } while (!listed.list_complete);
        return jsonResponse({
          reply: `**系统提示**：共清空了 ${deletedCount} 条对话记录。`,
        });
      } catch (error) {
        return jsonResponse({
          reply: `**清理失败**：${error.message}`,
        });
      }
    }

    // 指令 2：查看封禁 IP 名单
    if (userMessage === `${ADMIN_COMMAND} bans`) {
      let listed;
      let bannedIPs = [];
      try {
        do {
          listed = await env.CHAT_LOGS.list({ prefix: "ban_" });
          bannedIPs.push(
            ...listed.keys.map((key) => key.name.replace("ban_", "")),
          );
        } while (!listed.list_complete);
        const replyText =
          bannedIPs.length > 0
            ? `**当前被封禁的 IP 名单 (共 ${bannedIPs.length} 个)**：\n${bannedIPs.join("\n")}`
            : "**系统提示**：当前天下太平，没有被封禁的 IP。";
        return jsonResponse({ reply: replyText });
      } catch (error) {
        return jsonResponse({
          reply: `**获取失败**：${error.message}`,
        });
      }
    }
  }

  // --- IP 封禁检查 ---
  if (env.CHAT_LOGS && clientIP !== "unknown-ip") {
    const banKey = `ban_${clientIP}`;
    const isBanned = await env.CHAT_LOGS.get(banKey);
    if (isBanned) {
      return jsonResponse(
        {
          reply:
            "**访问被拒绝**：由于此前多次触发严重敏感词，您的 IP 目前处于7天封禁期内",
        },
        403,
      );
    }
  }

  // --- IP 黑名单拦截 ---
  const blockedIPsString = env.BLOCKED_IPS || "";
  const blockedIPs = blockedIPsString.split(",").map((ip) => ip.trim());
  if (clientIP !== "unknown-ip" && blockedIPs.includes(clientIP)) {
    return jsonResponse(
      {
        reply:
          "**访问被拒绝**：你的 IP 地址已被管理员封禁，无法使用本服务。",
      },
      403,
    );
  }

  // --- 速率限制 ---
  if (env.CHAT_LOGS && clientIP !== "unknown-ip") {
    const rateLimitKey = `rate_limit_${clientIP}`;
    const lastRequestTime = await env.CHAT_LOGS.get(rateLimitKey);
    const now = Date.now();
    if (lastRequestTime && now - parseInt(lastRequestTime) < 2000) {
      return jsonResponse({
        reply:
          "**触发防刷机制**：你的发言太快啦，CPU都冒烟了！请休息 2 秒钟再发吧~",
      });
    }
    context.waitUntil(
      env.CHAT_LOGS.put(rateLimitKey, now.toString(), {
        expirationTtl: 60,
      }),
    );
  }

  // --- 敏感词拦截 ---
  const cleanMessage = userMessage
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "")
    .toLowerCase();
  const isSensitive = sensitiveWords.some((word) =>
    cleanMessage.includes(word.toLowerCase()),
  );

  if (isSensitive) {
    if (env.CHAT_LOGS && clientIP !== "unknown-ip") {
      const strikeKey = `strike_${clientIP}`;
      const banKey = `ban_${clientIP}`;
      let strikes = await env.CHAT_LOGS.get(strikeKey);
      strikes = strikes ? parseInt(strikes) + 1 : 1;

      if (strikes >= 5) {
        await env.CHAT_LOGS.put(banKey, "true", { expirationTtl: 604800 });
        await env.CHAT_LOGS.delete(strikeKey);
        return jsonResponse({
          reply:
            "**封禁通知**：由于多次发送违规敏感内容，您的 IP 已被系统自动封禁 168 小时。IP已被记录",
        });
      } else {
        await env.CHAT_LOGS.put(strikeKey, strikes.toString(), {
          expirationTtl: 43200,
        });
        return jsonResponse({
          reply:
            "**严重警告**：您的发言违规，多次触发将导致您被封禁 168 小时",
        });
      }
    }
    return jsonResponse({
      reply:
        "抱歉，由于我的系统安全设定，我无法讨论这个话题哦。我们聊点别的吧！",
    });
  }

  // --- 日志记录 ---
  if (env.CHAT_LOGS) {
    const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const timeKey = timeFormatter
      .format(new Date())
      .replace(/\//g, "-")
      .replace(" ", "_");
    const reverseTimestamp = Number.MAX_SAFE_INTEGER - Date.now();
    const shortID = reverseTimestamp.toString(36);
    const finalKey = `log_${shortID}`;

    const country = geoHeaders.country || cfData?.country || "未知国家";
    const region = geoHeaders.region || cfData?.region || "未知省/州";
    const city = geoHeaders.city || cfData?.city || "未知城市";
    const location = `${country} - ${region} - ${city}`;

    const logData = {
      time: timeKey,
      message: userMessage,
      location: location,
      historyLength: history.length,
      ip: clientIP,
    };

    context.waitUntil(
      env.CHAT_LOGS.put(finalKey, JSON.stringify(logData), {
        expirationTtl: 604800,
      }),
    );
  }

  // --- 调用 Gemini API ---
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonResponse(
      { error: "API Key not configured" },
      500,
    );
  }

  const contents = [];
  const allowedEmojis =
    "🤣, 🥺, 😀, 😁, 😂, 😃, 😄, 😅, 😆, 😇, 😉, 😊, 😋, 😌, 😍, 😎, 😏, 😐, 😒, 😓, 😔, 😖, 😘, 😚, 😜, 😝, 😞, 😠, 😡, 😢, 😣, 😤, 😥, 😨, 😩, 😪, 😫, 😭, 😰, 😱, 😲, 😳, 😴, 😵, 😷, 💡, 💦, 💬, 💻, 👌, 👍, 👏, 🔍, 🎉, ✅, ❌ ";

  const customPrompt = env.SYSTEM_PROMPT ? env.SYSTEM_PROMPT + "\n" : "";

  const promptTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const currentTimeStr = promptTimeFormatter.format(new Date());
  const timePrompt = `【当前系统时间】：${currentTimeStr}。在回答涉及时间、日期的问题时，以此时间作为"现在"的基准。\n`;

  const systemPrompt = `${customPrompt}${timePrompt}【表情符号限制】：你在回复中如果需要使用表情符号（Emoji），只能且必须从以下列表中挑选：${allowedEmojis}。绝对不能使用此列表之外的任何表情符号！\n【最高指令】：请直接输出你最终要对用户说的话，严禁在回复中输出任何"思考过程"、"角色设定检查"、"分析步骤"或以星号(*)开头的内部心理活动！`;

  for (const turn of history) {
    if (turn.q) contents.push({ role: "user", parts: [{ text: turn.q }] });
    if (turn.a) contents.push({ role: "model", parts: [{ text: turn.a }] });
  }
  contents.push({ role: "user", parts: [{ text: userMessage }] });

  const modelName = env.GEMINI_MODEL;
  if (!modelName) {
    return jsonResponse(
      {
        error: "Configuration Error",
        details: "后台未设置 GEMINI_MODEL 环境变量，请在 Cloudflare 设置",
      },
      500,
    );
  }

  const cfGatewayUrl = env.CF_GATEWAY_URL;
  const targetUrl = `${cfGatewayUrl}/v1beta/models/${modelName}:generateContent`;

  const requestBody = {
    contents: contents,
    tools: [{ google_search: {} }],
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    safetySettings: [
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
    ],
  };

  try {
    const geminiRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
        "cf-aig-authorization": env.CF_AIG_TOKEN,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await geminiRes.json();

    // 处理提问阶段拦截
    if (data.promptFeedback && data.promptFeedback.blockReason) {
      return jsonResponse({
        reply: `**触发云端安全策略**：由于包含敏感词汇，该问题被 Google 底层引擎拒绝回答 (原因: ${data.promptFeedback.blockReason})。`,
      });
    }

    if (data.error) {
      throw new Error(`详细报错信息: ${JSON.stringify(data)}`);
    }

    if (data.candidates && data.candidates.length > 0) {
      if (data.candidates[0].finishReason === "SAFETY") {
        throw new Error("被 Gemini 安全机制拦截：内容可能违规。");
      }

      let parts = data.candidates[0].content.parts;
      let aiReply = parts.map((p) => p.text).join("\n").trim();

      // 联网搜索元数据
      const groundingMetadata = data.candidates[0].groundingMetadata;
      if (groundingMetadata && groundingMetadata.searchEntryPoint) {
        aiReply += `\n\n> *基于 Google 搜索结果生成*`;
      }

      // LaTeX 箭头处理
      aiReply = aiReply
        .replace(/\$\\rightarrow\$/g, "→")
        .replace(/\\rightarrow/g, "→")
        .replace(/\$\\to\$/g, "→")
        .replace(/\\to/g, "→");

      // Emoji 过滤
      const allowedEmojisStr =
        "🤣🥺😀😁😂😃😄😅😆😇😉😊😋😌😍😎😏😐😒😓😔😖😘😚😜😝😞😠😡😢😣😤😥😨😩😪😫😭😰😱😲😳😴😵😷💡💦💬💻👌👍👏🔍🎉✅❌";
      const emojiRegex =
        /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F9B0}-\u{1F9B3}]/gu;

      if (clientType === "nokia") {
        aiReply = aiReply.replace(
          /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/g,
          "",
        );
      } else {
        aiReply = aiReply.replace(emojiRegex, (match) => {
          return allowedEmojisStr.includes(match) ? match : "";
        });
      }

      return jsonResponse({ reply: aiReply });
    } else {
      throw new Error(
        "无返回文本。Google原始返回：" + JSON.stringify(data),
      );
    }
  } catch (err) {
    return jsonResponse(
      { error: "Gemini API Error", details: err.message },
      500,
    );
  }
}
