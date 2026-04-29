import { sensitiveWords } from "./vocabulary.js";

export async function onRequestPost(context) {
  // 读取 Cloudflare 环境变量，检查是否开启了维护模式
  if (context.env.MAINTENANCE_MODE === "true") {
    return new Response(
      JSON.stringify({
        // 这里写你想要劝退的文案，支持你前端的 Markdown 格式
        reply:
          " **系统升级维护中** \n\n抱歉，目前我的云端神经元正在进行休眠升级，暂时无法提供服务啦。大家先散了吧，等站长弄好了我再回来！",
      }),
      {
        headers: {
          "Content-Type": "application/json",
          // 解决跨域问题（如果有的话）
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  // 获取前端传来的用户消息和历史记录
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
    });
  }

  // 强制限制单次发言不超过 2000 字
  const userMessage = (body.message || "").substring(0, 2000);

  // 获取并判断历史记录长度
  let history = body.history || [];

  // 如果历史记录达到或超过 60 条（一问一答算2条，即约30轮对话）
  if (history.length >= 60) {
    return new Response(
      JSON.stringify({
        reply:
          " **对话长度提醒**\n\n当前的对话历史已达到**60条**的上限啦。为了保证我的回复质量和运行效率，请开启新话题，我们重新开始聊吧！",
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  // ==========================================
  // 🧹 新增：管理员一键指令 (清理日志 & 查看封禁)
  // ==========================================
  const ADMIN_COMMAND = context.env.ADMIN_PASSWORD;

  if (ADMIN_COMMAND && context.env.CHAT_LOGS) {
    // 指令 1：清空所有日志 (原封不动)
    if (userMessage === ADMIN_COMMAND) {
      let listed;
      let deletedCount = 0;
      try {
        do {
          listed = await context.env.CHAT_LOGS.list({ prefix: "log_" });
          const deletePromises = listed.keys.map((key) =>
            context.env.CHAT_LOGS.delete(key.name),
          );
          await Promise.all(deletePromises);
          deletedCount += listed.keys.length;
        } while (!listed.list_complete);

        return new Response(
          JSON.stringify({
            reply: `**系统提示**：共清空了 ${deletedCount} 条对话记录。`,
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ reply: `**清理失败**：${error.message}` }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }
    }

    // 指令 2：查看当前被封禁的 IP 名单 (在你的密码后面加个空格和 bans)
    if (userMessage === `${ADMIN_COMMAND} bans`) {
      let listed;
      let bannedIPs = [];
      try {
        do {
          // 检索所有以 ban_ 开头的 Key
          listed = await context.env.CHAT_LOGS.list({ prefix: "ban_" });
          // 把 "ban_192.168.1.1" 变成 "192.168.1.1"
          bannedIPs.push(
            ...listed.keys.map((key) => key.name.replace("ban_", "")),
          );
        } while (!listed.list_complete);

        const replyText =
          bannedIPs.length > 0
            ? `**当前被封禁的 IP 名单 (共 ${bannedIPs.length} 个)**：\n${bannedIPs.join("\n")}`
            : "**系统提示**：当前天下太平，没有被封禁的 IP。";

        return new Response(JSON.stringify({ reply: replyText }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ reply: `**获取失败**：${error.message}` }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }
    }
  }

  // ==========================================
  // 穿透反代获取真实访客 IP (使用自定义请求头防拦截)
  // ==========================================
  const clientIP =
    request.headers.get("X-My-Custom-Real-IP") ||
    request.headers.get("CF-Connecting-IP") ||
    "unknown-ip";

  // ==========================================
  //  新增：检查 IP 是否在 72 小时封禁期内
  // ==========================================
  if (context.env.CHAT_LOGS && clientIP !== "unknown-ip") {
    const banKey = `ban_${clientIP}`;
    const isBanned = await context.env.CHAT_LOGS.get(banKey);

    if (isBanned) {
      return new Response(
        JSON.stringify({
          reply:
            "**访问被拒绝**：由于此前多次触发严重敏感词，您的 IP 目前处于7天封禁期内",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }
  }

  //  IP 黑名单拦截
  const blockedIPsString = env.BLOCKED_IPS || "";
  const blockedIPs = blockedIPsString.split(",").map((ip) => ip.trim());

  if (clientIP !== "unknown-ip" && blockedIPs.includes(clientIP)) {
    return new Response(
      JSON.stringify({
        reply: "**访问被拒绝**：你的 IP 地址已被管理员封禁，无法使用本服务。",
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  if (context.env.CHAT_LOGS && clientIP !== "unknown-ip") {
    const rateLimitKey = `rate_limit_${clientIP}`;
    const lastRequestTime = await context.env.CHAT_LOGS.get(rateLimitKey);
    const now = Date.now();

    // 如果该 IP 之前访问过，且距离上次访问不足 2 秒（2000毫秒）
    if (lastRequestTime && now - parseInt(lastRequestTime) < 2000) {
      return new Response(
        JSON.stringify({
          reply:
            "**触发防刷机制**：你的发言太快啦，CPU都冒烟了！请休息 2 秒钟再发吧~",
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // 记录本次请求的时间戳。
    // expirationTtl: 60 表示这条记录 60 秒后会自动从 KV 数据库删除，避免垃圾数据堆积。
    context.waitUntil(
      context.env.CHAT_LOGS.put(rateLimitKey, now.toString(), {
        expirationTtl: 60,
      }),
    );
  }

  // ==========================================
  // 🛡️ 第一重护盾：本地敏感词拦截网
  // ==========================================


  // 简单的降噪匹配示例
  const cleanMessage = userMessage
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "")
    .toLowerCase();
  const isSensitive = sensitiveWords.some((word) =>
    cleanMessage.includes(word.toLowerCase()),
  );

  if (isSensitive) {
    // 如果触发了敏感词，并且能获取到 IP
    if (context.env.CHAT_LOGS && clientIP !== "unknown-ip") {
      const strikeKey = `strike_${clientIP}`; // 违规计次 Key
      const banKey = `ban_${clientIP}`; // 封禁状态 Key

      // 获取该 IP 之前的违规次数
      let strikes = await context.env.CHAT_LOGS.get(strikeKey);
      strikes = strikes ? parseInt(strikes) + 1 : 1;

      if (strikes >= 5) {
        // 💥 触发5次，执行封禁！
        // 168小时 = 168 * 60 * 60 = 604800 秒
        await context.env.CHAT_LOGS.put(banKey, "true", {
          expirationTtl: 604800,
        });
        // 封禁后，清空计次器
        await context.env.CHAT_LOGS.delete(strikeKey);

        return new Response(
          JSON.stringify({
            reply:
              "**封禁通知**：由于多次发送违规敏感内容，您的 IP 已被系统自动封禁 168 小时。IP已被记录",
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      } else {
        // 记录第1次警告，并设置计次器的有效期（例如12小时内犯3次才算，避免误伤）
        // 12小时 = 43200秒
        await context.env.CHAT_LOGS.put(strikeKey, strikes.toString(), {
          expirationTtl: 43200,
        });

        return new Response(
          JSON.stringify({
            reply:
              "**严重警告**：您的发言违规，多次触发将导致您被封禁 168 小时",
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }
    }

    // 兜底回复（以防 KV 未配置或没有 IP）
    return new Response(
      JSON.stringify({
        reply:
          "抱歉，由于我的系统安全设定，我无法讨论这个话题哦。我们聊点别的吧！",
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  // ==========================================
  // 💾 新增：存入 KV 数据库，用于后期在后台查看
  // ==========================================
  if (context.env.CHAT_LOGS) {
    // 1. 将时间转换为 UTC+8 (北京/台北/新加坡时间)
    // 使用 Intl.DateTimeFormat 强制指定时区，并格式化为 YYYY-MM-DD_HH:mm:ss
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
    // 格式化输出示例："2024/05/20 20:30:45" -> 替换为 "2024-05-20_20:30:45"
    const timeKey = timeFormatter
      .format(new Date())
      .replace(/\//g, "-")
      .replace(" ", "_");

    // 计算倒置时间戳
    const reverseTimestamp = Number.MAX_SAFE_INTEGER - Date.now();

    // 将数字转换为 36 进制字符串，并去掉冗余日期
    // .toString(36) 会把长数字变成类似 "k1p4z5r2" 这样的短字符串
    const shortID = reverseTimestamp.toString(36);

    // 最终 Key 格式：log_k1p4z5r2
    const finalKey = `log_${shortID}`;

    // 获取访客归属地 (IP 前面已经获取过了，这里直接用)
    const country =
      request.headers.get("X-Real-Country") ||
      request.cf?.country ||
      "未知国家";
    const region =
      request.headers.get("X-Real-Region") || request.cf?.region || "未知省/州";
    const city =
      request.headers.get("X-Real-City") || request.cf?.city || "未知城市";

    // 拼接归属地字符串，例如："CN - Beijing - Beijing"
    const location = `${country} - ${region} - ${city}`;

    const logData = {
      time: timeKey,
      message: userMessage,
      location: location, // 👈 已经帮你挪到前面来了
      historyLength: history.length,
      ip: clientIP,
    };

    // 后台静默保存到数据库
    context.waitUntil(
      context.env.CHAT_LOGS.put(finalKey, JSON.stringify(logData), {
        // 换成 finalKey
        expirationTtl: 604800,
      }),
    );
  }

  // 从 Cloudflare 环境变量获取 API Key (避免代码泄露)
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API Key not configured" }), {
      status: 500,
    });
  }

  // 构造 Gemini 需要的上下文对话格式
  const contents = [];

  // 将你允许的表情提取成一个字符串
  const allowedEmojis =
    "🤣, 🥺, 😀, 😁, 😂, 😃, 😄, 😅, 😆, 😇, 😉, 😊, 😋, 😌, 😍, 😎, 😏, 😐, 😒, 😓, 😔, 😖, 😘, 😚, 😜, 😝, 😞, 😠, 😡, 😢, 😣, 😤, 😥, 😨, 😩, 😪, 😫, 😭, 😰, 😱, 😲, 😳, 😴, 😵, 😷, 💡, 💦, 💬, 💻, 👌, 👍, 👏, 🔍, 🎉, ✅, ❌ ";

  // 从 Cloudflare 环境变量获取自定义人设
  // 如果后台没有设置 SYSTEM_PROMPT，就直接返回空字符串（什么都不给）
  const customPrompt = env.SYSTEM_PROMPT ? env.SYSTEM_PROMPT + "\n" : "";

  // ==========================================
  // ⏰ 新增：动态时间注入 (Time Injection)
  // ==========================================
  // 使用 Intl.DateTimeFormat 获取当前准确的东八区时间
  const promptTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", // 保持和你上面 KV 日志的时间一致
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const currentTimeStr = promptTimeFormatter.format(new Date());
  const timePrompt = `【当前系统时间】：${currentTimeStr}。在回答涉及时间、日期的问题时，以此时间作为“现在”的基准。\n`;

  // 强制拼接：自定义人设 + 时间注入 + Emoji 规则
  const systemPrompt = `${customPrompt}${timePrompt}【表情符号限制】：你在回复中如果需要使用表情符号（Emoji），只能且必须从以下列表中挑选：${allowedEmojis}。绝对不能使用此列表之外的任何表情符号！\n【最高指令】：请直接输出你最终要对用户说的话，严禁在回复中输出任何“思考过程”、“角色设定检查”、“分析步骤”或以星号(*)开头的内部心理活动！`;

  // 填入历史聊天记录
  for (const turn of history) {
    if (turn.q) contents.push({ role: "user", parts: [{ text: turn.q }] });
    if (turn.a) contents.push({ role: "model", parts: [{ text: turn.a }] });
  }

  // 填入当前用户的最新问题
  contents.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  // 从环境变量获取模型名称。如果后台没设置，直接报错！
  const modelName = env.GEMINI_MODEL;

  if (!modelName) {
    return new Response(
      JSON.stringify({
        error: "Configuration Error",
        details: "后台未设置 GEMINI_MODEL 环境变量，请在 Cloudflare 设置",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  // 使用 Cloudflare 官方 AI 网关代理
  // 获取网关地址
  const cfGatewayUrl = env.CF_GATEWAY_URL;

  // 动态拼接请求 URL（网关地址 + Gemini 具体模型路径 + API Key）
  // 让网关网址保持纯净
  const targetUrl = `${cfGatewayUrl}/v1beta/models/${modelName}:generateContent`;

  // 动态构建请求体，并开启联网搜索与原生系统指令
  const requestBody = {
    contents: contents,
    tools: [{ google_search: {} }],
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_NONE", // 仅拦截极高危色情内容。如果你想完全放开，可以改成 "BLOCK_NONE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
    ],
  };

  try {
    const geminiRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 这是给 Google 的钥匙
        "x-goog-api-key": apiKey,
        // 这是给 Cloudflare 的钥匙
        "cf-aig-authorization": env.CF_AIG_TOKEN,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await geminiRes.json();

    // 处理 Google 官方在提问阶段的拦截 (promptFeedback)
    if (data.promptFeedback && data.promptFeedback.blockReason) {
      return new Response(
        JSON.stringify({
          reply: `**触发云端安全策略**：由于包含敏感词汇，该问题被 Google 底层引擎拒绝回答 (原因: ${data.promptFeedback.blockReason})。`,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // 如果报错，直接把完整的原始数据抛给前端
    if (data.error) {
      throw new Error(`详细报错信息: ${JSON.stringify(data)}`);
    }

    // 提取 AI 的回复内容
    if (data.candidates && data.candidates.length > 0) {
      // 判断是否被安全机制拦截
      if (data.candidates[0].finishReason === "SAFETY") {
        throw new Error("被 Gemini 安全机制拦截：内容可能违规。");
      }

      let parts = data.candidates[0].content.parts;
      let aiReply = parts.map(p => p.text).join('\n').trim();

      // 【新增】：检查是否有联网搜索的元数据（来源链接）
      const groundingMetadata = data.candidates[0].groundingMetadata;
      if (groundingMetadata && groundingMetadata.searchEntryPoint) {
        // 你可以选择将搜索来源的 HTML 提示附加在回复后面
        // searchEntryPoint.html 内容通常是“由 Google 搜索提供”的小挂件
        aiReply += `\n\n> *基于 Google 搜索结果生成*`;
      }

      // ==========================================
      // 🛡️ 第二重护盾：清理非法 Emoji
      // ==========================================
      const allowedEmojisStr =
        "🤣🥺😀😁😂😃😄😅😆😇😉😊😋😌😍😎😏😐😒😓😔😖😘😚😜😝😞😠😡😢😣😤😥😨😩😪😫😭😰😱😲😳😴😵😷💡💦💬💻👌👍👏🔍🎉✅❌";

      // 这个正则匹配了绝大多数的 Emoji 图标
      const emojiRegex =
        /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F9B0}-\u{1F9B3}]/gu;

      // 如果是诺基亚等老旧设备，直接过滤所有代理对和 Emoji
      if (body.client === 'nokia') {
        aiReply = aiReply.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/g, '');
      } else {
        // 将 AI 回复中的所有 Emoji 找出来，如果不在白名单里，就替换为空字符串（删除掉）
        aiReply = aiReply.replace(emojiRegex, (match) => {
          return allowedEmojisStr.includes(match) ? match : "";
        });
      }

      return new Response(JSON.stringify({ reply: aiReply }), {
        headers: { "Content-Type": "application/json" },
      });
    } else {
      // 把 Google 返回的完整神秘数据打印出来看看
      throw new Error("无返回文本。Google原始返回：" + JSON.stringify(data));
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Gemini API Error", details: err.message }),
      { status: 500 },
    );
  }
} // 这是 onRequestPost 的正确结束括号

// ==========================================
// 🌐 新增：处理跨域请求 (CORS) 预检
// ==========================================
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type", // 允许前端带 Content-Type 请求头
    },
  });
}
