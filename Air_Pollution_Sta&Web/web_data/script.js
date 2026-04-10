// 1. 初始化地圖與基礎設置
const map = L.map('map', { zoomControl: false }).setView([25.04, 121.3], 10);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);

const allStations = ["基隆", "汐止", "萬里", "新店", "土城", "板橋", "新莊", "菜寮", "林口", "淡水", "大同", "中山", "萬華", "古亭", "松山", "陽明", "桃園", "大園", "觀音", "平鎮", "龍潭", "中壢", "三重", "永和"];
const tagContainer = document.getElementById('stationTags');
let aqiLayer, weatherChart, aqi24hChart;
let currentStationName = null;
let monthlyCache = {}; 

// 生成測站篩選標籤
allStations.forEach(s => {
    const div = document.createElement('div');
    div.className = 'tag-item active';
    div.innerText = s;
    div.onclick = function() { 
        this.classList.toggle('active'); 
        updateMap(); 
    };
    tagContainer.appendChild(div);
});

const slider = document.getElementById('timeSlider');
const datePicker = document.getElementById('dateInput');
const timeLabel = document.getElementById('currentTimeLabel');

slider.addEventListener('input', updateMap);
datePicker.addEventListener('change', updateMap);

// 2. 更新地圖與彈窗邏輯
async function updateMap() {
    const hour = slider.value.padStart(2, '0');
    const dateVal = datePicker.value;
    const currentMonth = dateVal.substring(0, 7);
    const t_str = dateVal.replace(/-/g, '') + '_' + hour;
    
    timeLabel.innerText = `${dateVal} ${hour}:00`;

    try {
        if (!monthlyCache[currentMonth]) {
            const res = await fetch(`data_json_monthly/${currentMonth}.json`);
            if (!res.ok) throw new Error("找不到檔案");
            const rawText = await res.text();
            // 處理 JSON 容錯
            const cleanedText = rawText.replace(/:NaN/g, ":null").replace(/:Infinity/g, ":null");
            monthlyCache[currentMonth] = JSON.parse(cleanedText);
        }

        const hourData = monthlyCache[currentMonth][t_str];
        if (!hourData) {
            if (aqiLayer) map.removeLayer(aqiLayer);
            return;
        }

        const activeTags = Array.from(document.querySelectorAll('.tag-item.active')).map(t => t.innerText);
        if (aqiLayer) map.removeLayer(aqiLayer);

        aqiLayer = L.geoJson(hourData, {
            filter: (f) => activeTags.includes(f.properties.s),
            pointToLayer: (f, latlng) => L.circleMarker(latlng, {
                radius: 13, fillColor: f.properties.c, color: "#fff", weight: 2, fillOpacity: 0.9
            }),
            onEachFeature: (f, layer) => {
                const p = f.properties;
                const coords = f.geometry.coordinates;
                const googleMapsUrl = `https://www.google.com/maps?q=${coords[1]},${coords[0]}`;

                const popupContent = `
                    <div style="width:200px; font-family: 'Microsoft JhengHei';">
                        <h4 style="margin:0 0 8px 0; border-bottom:1px solid #eee; padding-bottom:5px;">${p.s} 觀測站</h4>
                        <p style="font-size:12px; margin: 8px 0; color:#666;">
                            📍 座標：${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}<br>
                            🕒 時間：${timeLabel.innerText}
                        </p>
                        <a href="${googleMapsUrl}" target="_blank" 
                           style="display:block; padding:8px; background:#4285F4; color:white; text-decoration:none; border-radius:4px; font-size:12px; text-align:center; font-weight:bold;">
                           🌐 在 Google 地圖查看
                        </a>
                    </div>
                `;
                layer.bindPopup(popupContent);
                layer.on('click', () => { 
                    currentStationName = p.s; 
                    renderAnalysis(); 
                });
            }
        }).addTo(map);

        if (currentStationName) renderAnalysis();

    } catch (e) { 
        console.error("更新地圖失敗:", e); 
    }
}

// 3. 24H 數據序列提取
function getDailySeries(stationName, dateStr, key) {
    const currentMonth = dateStr.substring(0, 7);
    const datePrefix = dateStr.replace(/-/g, '');
    let series = [];
    if (!monthlyCache[currentMonth]) return series;

    for (let h = 0; h < 24; h++) {
        const hStr = h.toString().padStart(2, '0');
        const data = monthlyCache[currentMonth][`${datePrefix}_${hStr}`];
        if (data) {
            const st = data.features.find(f => f.properties.s === stationName);
            series.push(st ? st.properties[key] : null);
        } else { series.push(null); }
    }
    return series;
}

// 4. 圖表分析渲染
function renderAnalysis() {
    if (!currentStationName) return;
    const dateVal = datePicker.value;
    const hour = slider.value.padStart(2, '0');
    const timeKey = dateVal.replace(/-/g, '') + '_' + hour;
    const currentMonth = dateVal.substring(0, 7);
    
    if (!monthlyCache[currentMonth]) return;
    
    const hourData = monthlyCache[currentMonth][timeKey];
    const p = hourData?.features.find(f => f.properties.s === currentStationName)?.properties;
    
    if (!p) return;

    // 更新面板 UI
    document.getElementById('defaultMsg').style.display = 'none';
    document.getElementById('analysisContent').style.display = 'block';
    document.getElementById('viewName').innerText = p.s + ' 站';
    document.getElementById('viewAQI').innerText = 'AQI ' + (p.a || '--');
    document.getElementById('viewAQI').style.color = p.c;
    document.getElementById('viewDetail').innerText = `PM2.5: ${p.p} | 溫度: ${p.t}°C | 降雨: ${p.r || 0}mm`;

    const tempSeries = getDailySeries(p.s, dateVal, 't');
    const rainSeries = getDailySeries(p.s, dateVal, 'r');
    const aqiSeries = getDailySeries(p.s, dateVal, 'a');

    // 氣象雙軸圖 (溫度 + 降雨)
    const ctxW = document.getElementById('weatherChart').getContext('2d');
    if (weatherChart) weatherChart.destroy();
    weatherChart = new Chart(ctxW, {
        data: {
            labels: Array.from({length: 24}, (_, i) => `${i}:00`),
            datasets: [
                {
                    type: 'line',
                    label: '溫度 (°C)',
                    data: tempSeries,
                    borderColor: '#f1c40f',
                    yAxisID: 'y-temp',
                    tension: 0.3
                },
                {
                    type: 'bar',
                    label: '降雨量 (mm)',
                    data: rainSeries,
                    backgroundColor: 'rgba(52, 152, 219, 0.4)',
                    yAxisID: 'y-rain'
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                'y-temp': { type: 'linear', position: 'left', title: { display: true, text: '°C' } },
                'y-rain': { type: 'linear', position: 'right', title: { display: true, text: 'mm' }, min: 0, grid: { drawOnChartArea: false } }
            },
            plugins: { legend: { position: 'bottom' } }
        }
    });

    // AQI 趨勢圖
    const ctxA = document.getElementById('aqi24hChart').getContext('2d');
    if (aqi24hChart) aqi24hChart.destroy();
    aqi24hChart = new Chart(ctxA, {
        type: 'line',
        data: {
            labels: Array.from({length: 24}, (_, i) => `${i}:00`),
            datasets: [{ 
                label: 'AQI', 
                data: aqiSeries, 
                borderColor: p.c, 
                backgroundColor: p.c+'33', 
                fill: true, 
                tension: 0.4 
            }]
        },
        options: { 
            plugins: { legend: { display: false } }, 
            scales: { y: { min: 0 } } 
        }
    });
}

// 啟動地圖更新
updateMap();