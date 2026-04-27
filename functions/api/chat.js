export async function onRequestPost(context) {
    const { request, env } = context;
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }

    const { message, history, memory } = body;
    if (!message) {
        return new Response(JSON.stringify({ reply: "..." }), { headers: { 'Content-Type': 'application/json' } });
    }

    // --- Optimized Backend Weather Logic (No Loopback, Original Style) ---
    const weatherKeywords = ["天气", "气温", "多少度", "下雨吗", "天儿"];
    if (weatherKeywords.some(k => message.includes(k))) {
        let city = message.replace(/天气|气温|多少度|怎么样|查询|查一下|今天|现在|的|我|想|知道|看看|这里|那里|环境|指数|空气|质量|预报|下雨吗|天儿/g, "").trim();
        if (!city || city.length < 2) city = "北京";

        try {
            const cleanCity = city.replace(/[市区县]/g, "");
            const fetchTimeout = (urlToFetch, ms, options = {}) => Promise.race([
                fetch(urlToFetch, options),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
            ]);

            let lat = null, lng = null, resolvedCity = city;
            const geoUrl1 = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanCity)}&count=5&language=zh&format=json`;
            const geoRes1 = await fetchTimeout(geoUrl1, 3000).then(r => r.json()).catch(() => null);

            if (geoRes1 && geoRes1.results && geoRes1.results.length > 0) {
                const bestMatch = geoRes1.results.reduce((prev, current) => (prev.population || 0) > (current.population || 0) ? prev : current);
                lat = bestMatch.latitude;
                lng = bestMatch.longitude;
                resolvedCity = bestMatch.name;
            } else {
                const geoUrl2 = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanCity)}&limit=1`;
                const geoRes2 = await fetchTimeout(geoUrl2, 4000, { headers: { "User-Agent": "Neural-Lite-Bot/1.0" } }).then(r => r.json()).catch(() => null);
                if (geoRes2 && geoRes2.length > 0) {
                    lat = geoRes2[0].lat;
                    lng = geoRes2[0].lon;
                    resolvedCity = cleanCity;
                }
            }

            if (lat && lng) {
                const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,surface_pressure,wind_speed_10m&timezone=auto`;
                const omAqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,pm2_5&timezone=auto`;
                
                // --- 1:1 Restore WAQI logic (avoiding internal fetch) ---
                const waqiToken = env.WAQI_API_KEY;
                // Try searching by coordinates first (most accurate), then by Chinese city name
                const waqiGeoUrl = `https://api.waqi.info/feed/geo:${lat};${lng}/?token=${waqiToken}`;
                const waqiSearchUrl = `https://api.waqi.info/search/?token=${waqiToken}&keyword=${encodeURIComponent(cleanCity)}`;

                const [weatherRes, waqiGeoRes, waqiSearchRes, omAqiRes] = await Promise.allSettled([
                    fetchTimeout(weatherUrl, 4000).then(r => r.json()),
                    fetchTimeout(waqiGeoUrl, 4000).then(r => r.json()),
                    fetchTimeout(waqiSearchUrl, 4000).then(r => r.json()),
                    fetchTimeout(omAqiUrl, 4000).then(r => r.json())
                ]);

                let report = `🌍 ${resolvedCity}的实时天气\n`;
                if (weatherRes.status === 'fulfilled' && weatherRes.value?.current) {
                    const cur = weatherRes.value.current;
                    const wmoCodes = {
                        0: "晴朗", 1: "大部晴朗", 2: "局部多云", 3: "阴天",
                        45: "雾", 48: "结霜雾",
                        51: "轻微毛毛雨", 53: "中等毛毛雨", 55: "密集毛毛雨",
                        61: "小雨", 63: "中雨", 65: "大雨",
                        71: "小雪", 73: "中雪", 75: "大雪",
                        80: "阵雨", 81: "强阵雨", 82: "暴雨",
                        95: "雷暴", 96: "雷暴伴有轻微冰雹", 99: "雷暴伴有重冰雹"
                    };
                    const weatherText = wmoCodes[cur.weather_code] || "未知";
                    report += `🌤️ 天气：${weatherText}\n`;
                    report += `🌡️ 温度：${cur.temperature_2m} °C\n`;
                    report += `🤔 体感：${cur.apparent_temperature} °C\n`;
                    report += `💧 湿度：${cur.relative_humidity_2m}%\n`;
                    report += `🌬️ 风速：${cur.wind_speed_10m} km/h\n`;
                    report += `🎈 气压：${cur.surface_pressure} hPa (地面)\n`;
                } else {
                    report += `🌤️ 天气：获取失败\n`;
                }

                let aqiSuccess = false;
                
                // --- 1:1 Restore original waqi.js search logic ---
                if (waqiSearchRes.status === 'fulfilled' && waqiSearchRes.value?.status === 'ok' && waqiSearchRes.value.data?.length > 0) {
                    // Original waqi.js logic: loop through search results to find a valid AQI
                    for (let i = 0; i < Math.min(waqiSearchRes.value.data.length, 5); i++) {
                        const stationData = waqiSearchRes.value.data[i];
                        const val = parseInt(stationData.aqi);
                        // Filter out empty or invalid AQI values
                        if (!isNaN(val) && stationData.aqi !== "-" && stationData.aqi !== "") {
                            let level = val <= 50 ? "🟢(优)" : val <= 100 ? "🟡(良)" : val <= 150 ? "🟠(轻度)" : val <= 200 ? "🔴(中度)" : val <= 300 ? "🟣(重度)" : "☠️(严重)";
                            report += `🌫️ 空气(AQI)：${val} ${level}\n📡 数据源：地面监测站`;
                            aqiSuccess = true;
                            break;
                        }
                    }
                }

                // Method 2: Geo-location feed (Backup if search fails)
                if (!aqiSuccess && waqiGeoRes.status === 'fulfilled' && waqiGeoRes.value?.status === 'ok') {
                    const val = parseInt(waqiGeoRes.value.data?.aqi);
                    if (!isNaN(val)) {
                        let level = val <= 50 ? "🟢(优)" : val <= 100 ? "🟡(良)" : val <= 150 ? "🟠(轻度)" : val <= 200 ? "🔴(中度)" : val <= 300 ? "🟣(重度)" : "☠️(严重)";
                        report += `🌫️ 空气(AQI)：${val} ${level}\n📡 数据源：地面监测站`;
                        aqiSuccess = true;
                    }
                }

                // Method 3: Satellite estimation (Final fallback)
                if (!aqiSuccess && omAqiRes.status === 'fulfilled' && omAqiRes.value?.current?.us_aqi !== undefined) {
                    const aqiVal = omAqiRes.value.current.us_aqi;
                    const pm25 = omAqiRes.value.current.pm2_5;
                    let level = aqiVal <= 50 ? "🟢(优)" : aqiVal <= 100 ? "🟡(良)" : aqiVal <= 150 ? "🟠(轻度)" : aqiVal <= 200 ? "🔴(中度)" : aqiVal <= 300 ? "🟣(重度)" : "☠️(严重)";
                    report += `🌫️ 空气(AQI)：${aqiVal} ${level}\n😷 PM2.5：${pm25} µg/m³ (卫星估算)`;
                    aqiSuccess = true;
                }

                if (!aqiSuccess) report += `🌫️ 空气(AQI)：暂无数据`;

                return new Response(JSON.stringify({ reply: report.trim(), memory: memory }), { 
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
        } catch (e) {
            console.error("精细天气查询失败:", e);
        }
    }
    // ------------------------------------------------------------

    // Call Gemini Endpoint natively via loopback fetch
    const origin = new URL(request.url).origin;
    try {
        const visitorIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-My-Custom-Real-IP') || '';
        const userAgent = request.headers.get('User-Agent') || 'Neural-Lite-Internal';
        
        const geminiRes = await fetch(`${origin}/api/gemini?t=${Date.now()}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-My-Custom-Real-IP': visitorIP,
                'User-Agent': userAgent
            },
            body: JSON.stringify({ message, history }),
            redirect: 'follow'
        });
        
        const responseText = await geminiRes.text();
        
        if (!geminiRes.ok) {
            throw new Error(`Gemini sub-request failed with status ${geminiRes.status}: ${responseText.substring(0, 100)}`);
        }

        try {
            const data = JSON.parse(responseText);
            // Pass the response through but append memory
            return new Response(JSON.stringify({ ...data, memory: memory }), {
                status: geminiRes.status,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (jsonErr) {
            throw new Error(`Failed to parse Gemini response as JSON. Content starts with: ${responseText.substring(0, 50)}`);
        }

    } catch (e) {
        console.error("Gemini 请求失败:", e);
        const fallback = "我的云端神经元似乎断线了... 稍后再试吧。";
        return new Response(JSON.stringify({ 
            reply: fallback, 
            memory: memory, 
            error: "Internal Sub-request Error",
            details: e.message 
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}