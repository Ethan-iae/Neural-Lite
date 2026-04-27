export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);
    const city = url.searchParams.get("city");

    if (!city) {
        return new Response(JSON.stringify({ error: "City is required" }), {
            headers: { "content-type": "application/json" },
            status: 400,
        });
    }

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
            const bestMatch = geoRes1.results.reduce((prev, current) => {
                return (prev.population || 0) > (current.population || 0) ? prev : current;
            });
            lat = bestMatch.latitude;
            lng = bestMatch.longitude;
            resolvedCity = bestMatch.name;
        } else {
            console.log(`Open-Meteo 未找到 "${cleanCity}"，正在启用 OSM 地图引擎兜底...`);
            const geoUrl2 = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanCity)}&limit=1`;
            const geoRes2 = await fetchTimeout(geoUrl2, 4000, {
                headers: { "User-Agent": "Neural-Lite-Weather-Bot/1.0" }
            }).then(r => r.json()).catch(() => null);
            if (geoRes2 && geoRes2.length > 0) {
                lat = geoRes2[0].lat;
                lng = geoRes2[0].lon;
                resolvedCity = cleanCity;
            } else {
                throw new Error("双引擎均无法解析该城市的经纬度");
            }
        }

        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,surface_pressure,wind_speed_10m&timezone=auto`;
        const omAqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,pm2_5&timezone=auto`;
        
        // 调用同环境下的 waqi 接口
        const waqiUrl = new URL(`/api/waqi?city=${encodeURIComponent(resolvedCity)}`, request.url).toString();

        const [weatherData, waqiData, omAqiData] = await Promise.allSettled([
            fetchTimeout(weatherUrl, 4000).then(r => r.json()),
            fetchTimeout(waqiUrl, 4000).then(r => r.json()),
            fetchTimeout(omAqiUrl, 4000).then(r => r.json())
        ]);

        let report = `🌍 ${resolvedCity}的实时天气\n`;
        if (weatherData.status === 'fulfilled' && weatherData.value?.current) {
            const cur = weatherData.value.current;
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
        if (waqiData.status === 'fulfilled' && waqiData.value?.status === 'ok' && waqiData.value.data?.length > 0) {
            for (let i = 0; i < Math.min(waqiData.value.data.length, 5); i++) {
                const val = parseInt(waqiData.value.data[i].aqi);
                if (!isNaN(val) && waqiData.value.data[i].aqi !== "-") {
                    let level = val <= 50 ? "🟢(优)" : val <= 100 ? "🟡(良)" : val <= 150 ? "🟠(轻度)" : val <= 200 ? "🔴(中度)" : val <= 300 ? "🟣(重度)" : "☠️(严重)";
                    report += `🌫️ 空气(AQI)：${val} ${level}\n📡 数据源：地面监测站`;
                    aqiSuccess = true;
                    break;
                }
            }
        }

        if (!aqiSuccess && omAqiData.status === 'fulfilled' && omAqiData.value?.current?.us_aqi !== undefined) {
            const aqiVal = omAqiData.value.current.us_aqi;
            const pm25 = omAqiData.value.current.pm2_5;
            let level = aqiVal <= 50 ? "🟢(优)" : aqiVal <= 100 ? "🟡(良)" : aqiVal <= 150 ? "🟠(轻度)" : aqiVal <= 200 ? "🔴(中度)" : aqiVal <= 300 ? "🟣(重度)" : "☠️(严重)";
            report += `🌫️ 空气(AQI)：${aqiVal} ${level}\n😷 PM2.5：${pm25} µg/m³ (卫星估算)`;
            aqiSuccess = true;
        }

        if (!aqiSuccess) report += `🌫️ 空气(AQI)：暂无数据`;

        return new Response(JSON.stringify({ report: report.trim() }), {
            headers: {
                "content-type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });
    } catch (e) {
        console.error("天气抓取彻底失败:", e);
        return new Response(JSON.stringify({ report: "气象卫星连接失败，可能是城市名字没认出来，或者网络开小差了。" }), {
            headers: {
                "content-type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });
    }
}
