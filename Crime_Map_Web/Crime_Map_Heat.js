const districtCenters = {
    "中正區": [25.0324, 121.5198], "大同區": [25.0634, 121.5133], "中山區": [25.0699, 121.5381],
    "松山區": [25.0600, 121.5575], "大安區": [25.0264, 121.5434], "萬華區": [25.0286, 121.4979],
    "信義區": [25.0305, 121.5716], "士林區": [25.0891, 121.5508], "北投區": [25.1321, 121.5050],
    "內湖區": [25.0697, 121.5898], "南港區": [25.0546, 121.6073], "文山區": [24.9892, 121.5701]
};

let map = L.map('map', { zoomControl: false }).setView([25.0330, 121.5654], 11);
L.control.zoom({ position: 'topright' }).addTo(map);

let heatLayer = null;
let crimeData = null;
let currentTheme = 'dark';
let isMoving = false; // 追蹤地圖是否正在移動

const tiles = {
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'),
    light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png')
};
tiles[currentTheme].addTo(map);

async function init() {
    try {
        const res = await fetch('https://raw.githubusercontent.com/Kai0514/Repo_1/main/Crime_Map_Web/Crime_Map_Data.geojson');
        crimeData = await res.json();
        
        const types = [...new Set(crimeData.features.map(f => f.properties.案類))];
        const select = document.getElementById('crime-type-select');
        types.forEach(t => {
            let opt = document.createElement('option');
            opt.value = opt.innerText = t;
            select.appendChild(opt);
        });

        updateMap();
        setupEvents();
    } catch (e) {
        document.getElementById('crime-count').innerText = "ERR";
    }
}

// 核心更新函式：修復不透明度運作
function updateMap() {
    if (!crimeData || isMoving) return; // 地圖移動中不渲染，避免閃爍

    if (heatLayer) map.removeLayer(heatLayer);

    const dist = document.getElementById('district-select').value;
    const type = document.getElementById('crime-type-select').value;
    const year = document.getElementById('time-range').value;

    const heatPoints = crimeData.features
        .filter(f => {
            const p = f.properties;
            const mDist = dist === 'all' || p.發生地點.includes(dist);
            const mType = type === 'all' || p.案類 === type;
            const mYear = p.發生日期.startsWith(year);
            return mDist && mType && mYear;
        })
        .map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0], 0.5]);

    // 重新建立熱力層以強制更新 minOpacity 參數
    heatLayer = L.heatLayer(heatPoints, {
        radius: parseInt(document.getElementById('heatmap-radius').value),
        blur: parseInt(document.getElementById('heatmap-blur').value),
        minOpacity: parseFloat(document.getElementById('heatmap-opacity').value),
        gradient: { 0.4: 'blue', 0.6: 'cyan', 0.7: 'lime', 0.8: 'yellow', 1.0: 'red' }
    }).addTo(map);

    document.getElementById('crime-count').innerText = heatPoints.length;
}

function setupEvents() {
    // 解決移動順序：監聽 moveend
    document.getElementById('district-select').onchange = (e) => {
        const val = e.target.value;
        if (heatLayer) map.removeLayer(heatLayer); // 移動前先移除熱力圖，保持清爽
        
        if (val !== 'all') {
            isMoving = true;
            map.flyTo(districtCenters[val], 14, { duration: 1.5 });
        } else {
            map.setView([25.0330, 121.5654], 11);
            updateMap();
        }
    };

    // 當地圖「停止移動」時才出現熱度圖
    map.on('moveend', () => {
        isMoving = false;
        updateMap();
    });

    document.getElementById('crime-type-select').onchange = updateMap;
    document.getElementById('time-range').oninput = (e) => {
        document.getElementById('year-value').innerText = e.target.value;
        updateMap();
    };

    // 參數連動
    ['radius', 'blur', 'opacity'].forEach(key => {
        document.getElementById(`heatmap-${key}`).oninput = (e) => {
            document.getElementById(`${key === 'opacity' ? 'opacity' : key}-value`).innerText = e.target.value;
            updateMap();
        };
    });

    // 主題切換
    document.getElementById('theme-toggle').onclick = function() {
        map.removeLayer(tiles[currentTheme]);
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        tiles[currentTheme].addTo(map);
        document.body.setAttribute('data-theme', currentTheme);
        this.innerText = currentTheme === 'dark' ? '切換警政模式' : '切換偵查模式';
    };

    // 找回小螢幕選單開關
    document.getElementById('mobile-toggle').onclick = () => {
        document.getElementById('sidebar').classList.toggle('active');
    };
}

init();