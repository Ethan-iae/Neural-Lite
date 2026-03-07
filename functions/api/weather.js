export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const city = url.searchParams.get("city");

    if (!city) {
        return new Response(JSON.stringify({ error: "City is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    const cleanCity = city.replace(/[市区县]/g, "");
    let lat = null, lng = null, resolvedCity = city;

    // 🌟 修复核心 1：增强版 fetch
    // 1. 放宽超时时间到 5000ms 抵抗冷启动。
    // 2. 增加真实浏览器的 User-Agent，防止被气象局和地图接口拦截(403)。
    // 3. 拦截非 JSON 返回值，防止 HTML 脏数据导致程序崩溃。
    const fetchJson = async (fetchUrl, ms = 5000) => {
        try {
            const response = await Promise.race([
                fetch(fetchUrl, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept": "application/json"
                    }
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
            ]);
            
            if (!response.ok) return null; // 状态码不是 200，直接当做失败，平滑降级
            return await response.json();
        } catch (e) {
            return null;
        }
    };

    try {
        // ==========================================
        // 🚀 第一步：获取经纬度 (双引擎解析)
        // ==========================================
        const geoUrl1 = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanCity)}&count=5&language=zh&format=json`;
        const geoRes1 = await fetchJson(geoUrl1, 4000);

        if (geoRes1 && geoRes1.results && geoRes1.results.length > 0) {
            const bestMatch = geoRes1.results.reduce((prev, current) => {
                return (prev.population || 0) > (current.population || 0) ? prev : current;
            });
            lat = bestMatch.latitude;
            lng = bestMatch.longitude;
            resolvedCity = bestMatch.name;
        } else {
            const geoUrl2 = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanCity)}&limit=1`;
            const geoRes2 = await fetchJson(geoUrl2, 4000);

            if (geoRes2 && geoRes2.length > 0) {
                lat = geoRes2[0].lat;
                lng = geoRes2[0].lon;
                resolvedCity = cleanCity;
            } else {
                throw new Error("双引擎均超时或未能认出该城市");
            }
        }

        // ==========================================
        // 🚀 第二步：三路大军同时出击获取气象！
        // ==========================================
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,surface_pressure,wind_speed_10m&timezone=auto`;
        const omAqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,pm2_5&timezone=auto`;
        
        const waqiToken = env.WAQI_API_KEY; 
        const waqiUrl = waqiToken ? `https://api.waqi.info/search/?keyword=${encodeURIComponent(resolvedCity)}&token=${waqiToken}` : null;

        const promises = [
            fetchJson(weatherUrl, 5000),
            fetchJson(omAqiUrl, 5000)
        ];
        
        if (waqiUrl) {
            promises.push(fetchJson(waqiUrl, 5000));
        } else {
            promises.push(Promise.resolve(null)); 
        }

        const [weatherData, omAqiData, waqiData] = await Promise.all(promises);

        let report = `🌍 ${resolvedCity}的实时天气\n`;

        // --- 1. 解析天气数据 ---
        if (weatherData && weatherData.current) {
            const cur = weatherData.current;
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

        // --- 2. 解析空气质量 (AQI) ---
        let aqiSuccess = false;

        // 🌟 修复核心 2：增加 Array.isArray 校验。防止 WAQI 报错返回字符串时导致意外错误
        if (waqiData && waqiData.status === 'ok' && Array.isArray(waqiData.data) && waqiData.data.length > 0) {
            for (let i = 0; i < Math.min(waqiData.data.length, 5); i++) {
                const val = parseInt(waqiData.data[i].aqi);
                if (!isNaN(val) && waqiData.data[i].aqi !== "-") {
                    let level = val <= 50 ? "🟢(优)" : val <= 100 ? "🟡(良)" : val <= 150 ? "🟠(轻度)" : val <= 200 ? "🔴(中度)" : val <= 300 ? "🟣(重度)" : "☠️(严重)";
                    report += `🌫️ 空气(AQI)：${val} ${level}\n📡 数据源：地面监测站`;
                    aqiSuccess = true;
                    break;
                }
            }
        }

        if (!aqiSuccess && omAqiData && omAqiData.current?.us_aqi !== undefined) {
            const aqiVal = omAqiData.current.us_aqi;
            const pm25 = omAqiData.current.pm2_5;
            let level = aqiVal <= 50 ? "🟢(优)" : aqiVal <= 100 ? "🟡(良)" : aqiVal <= 150 ? "🟠(轻度)" : aqiVal <= 200 ? "🔴(中度)" : aqiVal <= 300 ? "🟣(重度)" : "☠️(严重)";
            report += `🌫️ 空气(AQI)：${aqiVal} ${level}\n😷 PM2.5：${pm25} µg/m³ (卫星估算)`;
            aqiSuccess = true;
        }

        if (!aqiSuccess) report += `🌫️ 空气(AQI)：暂无数据`;

        return new Response(JSON.stringify({ report: report.trim() }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });

    } catch (e) {
        console.error("Weather API Error:", e.message);
        // 🌟 修复核心 3：把真实报错追加在 detail 里，以后如果再失败，你一眼就能看出是不是真的被拦截了
        return new Response(JSON.stringify({ 
            error: "气象卫星连接失败，可能是城市名字没认出来，或者网络开小差了。",
            detail: e.message 
        }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    }
}