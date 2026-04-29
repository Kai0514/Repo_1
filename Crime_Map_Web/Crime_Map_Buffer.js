// 初始化 Leaflet 地圖
let map = L.map('map', { zoomControl: false }).setView([25.0330, 121.5654], 13);
L.control.zoom({ position: 'topright' }).addTo(map);

let crimeData = null;
let currentTheme = 'dark';
let bufferLayer = null;       
let crimePointsLayer = L.layerGroup().addTo(map); 

const tiles = {
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'),
    light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png')
};
tiles[currentTheme].addTo(map);

async function init() {
    try {
        const res = await fetch('https://raw.githubusercontent.com/Kai0514/Repo_1/main/Crime_Map_Web/Crime_Map_Data.geojson');
        crimeData = await res.json();
        setupEvents();
    } catch (e) {
        document.getElementById('result-content').innerText = "數據連線異常";
    }
}

function analyzeCrime() {
    if (!crimeData) return;

    const lat = parseFloat(document.getElementById('input-lat').value);
    const lng = parseFloat(document.getElementById('input-lng').value);
    const radius = parseFloat(document.getElementById('input-radius').value);
    const year = document.getElementById('input-year').value;

    if (bufferLayer) map.removeLayer(bufferLayer);
    crimePointsLayer.clearLayers();

    bufferLayer = L.circle([lat, lng], {
        radius: radius,
        color: currentTheme === 'dark' ? '#FF0033' : '#1E3A8A',
        fillColor: currentTheme === 'dark' ? '#FF0033' : '#3B82F6',
        fillOpacity: 0.15,
        weight: 2,
        dashArray: '5, 10'
    }).addTo(map);

    const centerPoint = turf.point([lng, lat]);
    const buffer = turf.buffer(centerPoint, radius / 1000, { units: 'kilometers' });

    const locationMap = new Map();
    const crimesInRange = crimeData.features.filter(f => {
        const isYear = f.properties.發生日期.startsWith(year);
        const pt = turf.point(f.geometry.coordinates);
        const inArea = turf.booleanPointInPolygon(pt, buffer);
        
        if (isYear && inArea) {
            const coords = JSON.stringify(f.geometry.coordinates);
            if (!locationMap.has(coords)) {
                locationMap.set(coords, { count: 1, properties: f.properties, coords: f.geometry.coordinates });
            } else {
                locationMap.get(coords).count += 1;
            }
            return true;
        }
        return false;
    });

    locationMap.forEach((val) => {
        const color = getPointColor(val.count);
        L.circleMarker([val.coords[1], val.coords[0]], {
            radius: 6,
            fillColor: color,
            color: '#FFF',
            weight: 1,
            fillOpacity: 0.8
        }).bindPopup(`
            <div style="color: #333">
                <strong>案件位置</strong> (共 ${val.count} 起)<br>
                <hr>
                <b>案類：</b>${val.properties.案類}<br>
                <b>最近日期：</b>${val.properties.發生日期}
            </div>
        `).addTo(crimePointsLayer);
    });

    document.getElementById('crime-count').innerText = crimesInRange.length;
    updateAnalysisReport(crimesInRange, year, radius);
    map.flyTo([lat, lng], 15, { duration: 1.5 });
}

function getPointColor(count) {
    if (count >= 6) return '#800080';
    if (count === 5) return '#0000ff';
    if (count === 4) return '#00ff00';
    if (count === 3) return '#ffff00';
    if (count === 2) return '#ff9900';
    return '#ff0000';
}

function updateAnalysisReport(features, year, radius) {
    const resultContent = document.getElementById('result-content');
    if (features.length === 0) {
        resultContent.innerHTML = `<span style="color: var(--p-main)">⚠️ 搜尋區間內無紀錄</span>`;
        return;
    }

    const stats = {};
    features.forEach(f => {
        const type = f.properties.案類;
        stats[type] = (stats[type] || 0) + 1;
    });

    let html = `<b>${year}年度掃描結果：</b><br>`;
    html += `範圍：${radius}m / 總計：${features.length}件<br><hr>`;
    html += `<ul style="padding-left: 15px; margin: 5px 0;">`;
    for (const [type, count] of Object.entries(stats)) {
        html += `<li>${type}: ${count} 起</li>`;
    }
    html += `</ul>`;
    resultContent.innerHTML = html;
}

function setupEvents() {
    document.getElementById('analyze-button').onclick = analyzeCrime;

    document.getElementById('input-radius').oninput = (e) => {
        document.getElementById('radius-val').innerText = e.target.value;
    };

    document.getElementById('theme-toggle').onclick = function() {
        map.removeLayer(tiles[currentTheme]);
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        tiles[currentTheme].addTo(map);
        document.body.setAttribute('data-theme', currentTheme);
        this.innerText = currentTheme === 'dark' ? '切換警政模式' : '切換偵查模式';
        if (bufferLayer) {
            bufferLayer.setStyle({
                color: currentTheme === 'dark' ? '#FF0033' : '#1E3A8A',
                fillColor: currentTheme === 'dark' ? '#FF0033' : '#3B82F6'
            });
        }
    };

    document.getElementById('mobile-toggle').onclick = () => {
        document.getElementById('sidebar').classList.toggle('active');
    };

    map.on('click', (e) => {
        document.getElementById('input-lat').value = e.latlng.lat.toFixed(6);
        document.getElementById('input-lng').value = e.latlng.lng.toFixed(6);
        analyzeCrime();
    });
}

init();