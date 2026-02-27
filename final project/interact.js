// Mapbox 設定
mapboxgl.accessToken = 'pk.eyJ1IjoiYW5keWNoaXU2MDkiLCJhIjoiY20xaWxjemc1MGVoZzJqb2NyZ2M2enE1aSJ9.PBoFruvUCgE-xt0MbTYmkg';

// 主題設定
const mapThemes = {
    dark: 'mapbox://styles/mapbox/dark-v10',
    light: 'mapbox://styles/mapbox/light-v10'
};

let currentTheme = 'dark';
let map;
let crimeData = null;

// 初始化地圖
map = new mapboxgl.Map({
    container: 'map',
    style: mapThemes[currentTheme],
    center: [121.5654, 25.0330],
    zoom: 11
});

// 載入犯罪資料
fetch('./crime_data_cleaned.geojson')
    .then(response => response.json())
    .then(data => {
        crimeData = data;
        console.log('Crime data loaded successfully');
    })
    .catch(error => {
        console.error('Error loading crime data:', error);
    });

// 主題切換函數
function toggleMapTheme() {
    const themeButton = document.getElementById('theme-toggle');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // 更新地圖樣式
    map.setStyle(mapThemes[newTheme]);
    
    // 更新按鈕文字和樣式
    themeButton.textContent = newTheme === 'dark' ? '切換淺色主題' : '切換深色主題';
    themeButton.className = `theme-button ${newTheme}`;
    
    // 更新當前主題
    currentTheme = newTheme;

    // 切換主題類別
    document.body.classList.toggle('theme-dark', currentTheme === 'dark');
    
    // 在樣式加載完成後重新添加資料源和圖層
    map.once('style.load', () => {
        if (crimeData) {
            updateMapDisplayAndCrimes(
                parseFloat(document.getElementById('input-lng').value),
                parseFloat(document.getElementById('input-lat').value),
                parseFloat(document.getElementById('input-radius').value),
                document.getElementById('input-year').value
            );
        }
    });
}

// 更新圖例
function updateLegend() {
    const legendContainer = document.getElementById('legend');
    if (!legendContainer) {
        const legendDiv = document.createElement('div');
        legendDiv.id = 'legend';
        document.body.appendChild(legendDiv);
    }
    
    const legendItems = [
        { color: '#ff0000', label: '1起案件' },
        { color: '#ff9900', label: '2起案件' },
        { color: '#ffff00', label: '3起案件' },
        { color: '#00ff00', label: '4起案件' },
        { color: '#0000ff', label: '5起案件' },
        { color: '#800080', label: '6起以上案件' }
    ];

    let legendHTML = `
        <h3>案件數量圖例</h3>
        <div class="legend-content">
    `;

    legendItems.forEach(item => {
        legendHTML += `
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${item.color}"></div>
                <span class="legend-label">${item.label}</span>
            </div>
        `;
    });

    legendHTML += `</div>`;
    document.getElementById('legend').innerHTML = legendHTML;
}

// 更新地圖顯示和犯罪數據
function updateMapDisplayAndCrimes(lng, lat, radius, year) {
    // 移除舊的圖層和數據源
    ['analysis-circle', 'center-point', 'crime-points'].forEach(layerId => {
        if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
        }
    });
    ['analysis-circle', 'center-point', 'crime-points'].forEach(sourceId => {
        if (map.getSource(sourceId)) {
            map.removeSource(sourceId);
        }
    });

    // 創建圓形範圍
    const center = [lng, lat];
    const circle = turf.circle(center, radius / 1000, { steps: 64, units: 'kilometers' });

    // 添加圓形範圍到地圖
    map.addSource('analysis-circle', {
        type: 'geojson',
        data: circle
    });

    map.addLayer({
        id: 'analysis-circle',
        type: 'fill',
        source: 'analysis-circle',
        paint: {
            'fill-color': '#ff0000',
            'fill-opacity': 0.2,
            'fill-outline-color': '#ff0000'
        }
    });

    // 添加中心點標記
    map.addSource('center-point', {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: center
            }
        }
    });

    map.addLayer({
        id: 'center-point',
        type: 'circle',
        source: 'center-point',
        paint: {
            'circle-radius': 6,
            'circle-color': '#ff0000',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
        }
    });

    // 篩選並統計犯罪點
    const locationMap = new Map();
    const crimesInRange = crimeData.features.filter(feature => {
        const crimeYear = feature.properties.年份.toString();
        const crimeLat = feature.geometry.coordinates[1];
        const crimeLng = feature.geometry.coordinates[0];
        const distance = turf.distance([lng, lat], [crimeLng, crimeLat], { units: 'meters' });
        
        if (crimeYear === year && distance <= radius) {
            const coords = JSON.stringify(feature.geometry.coordinates);
            if (!locationMap.has(coords)) {
                locationMap.set(coords, {
                    count: 1,
                    feature: feature
                });
            } else {
                locationMap.get(coords).count += 1;
            }
            return true;
        }
        return false;
    });

    // 處理統計後的數據
    const processedFeatures = Array.from(locationMap.values()).map(({count, feature}) => ({
        ...feature,
        properties: {
            ...feature.properties,
            point_count: count
        }
    }));

    // 添加處理後的犯罪數據點到地圖
    map.addSource('crime-points', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: processedFeatures
        }
    });

    map.addLayer({
        id: 'crime-points',
        type: 'circle',
        source: 'crime-points',
        paint: {
            'circle-radius': 6,
            'circle-color': [
                'case',
                ['==', ['get', 'point_count'], 1], '#ff0000',  // 1起案件 - 紅色
                ['==', ['get', 'point_count'], 2], '#ff9900',  // 2起案件 - 橙色
                ['==', ['get', 'point_count'], 3], '#ffff00',  // 3起案件 - 黃色
                ['==', ['get', 'point_count'], 4], '#00ff00',  // 4起案件 - 綠色
                ['==', ['get', 'point_count'], 5], '#0000ff',  // 5起案件 - 藍色
                '#800080'  // 6起以上 - 紫色
            ],
            'circle-opacity': 0.7
        }
    });

    // 更新結果顯示
    const crimeTypes = analyzeCrimeTypes(crimesInRange);
    const resultContent = document.getElementById('result-content');
    resultContent.innerHTML = generateAnalysisReport(year, lat, lng, radius, crimesInRange, crimeTypes);
    
    // 更新圖例
    updateLegend();
}

// 分析犯罪類型
function analyzeCrimeTypes(crimesInRange) {
    const crimeTypes = {};
    crimesInRange.forEach(crime => {
        const type = crime.properties.案類;
        crimeTypes[type] = (crimeTypes[type] || 0) + 1;
    });
    return crimeTypes;
}

// 生成分析報告
function generateAnalysisReport(year, lat, lng, radius, crimesInRange, crimeTypes) {
    const totalCrimes = crimesInRange.length;

    const sortedTypes = Object.entries(crimeTypes)
        .sort(([, a], [, b]) => b - a);

    let typesHtml = sortedTypes.map(([type, count]) => {
        const percentage = ((count / totalCrimes) * 100).toFixed(1);
        return `
            <div class="crime-type-item">
                <span class="crime-type-name">${type}</span>
                <span class="crime-type-count">${count}件 (${percentage}%)</span>
            </div>`;
    }).join('');

    return `
        <div class="analysis-summary">
            <div class="summary-item">
                <h4>分析參數</h4>
                <p>年份：${year}年</p>
                <p>座標：(${lat}, ${lng})</p>
                <p>半徑：${radius}公尺</p>
            </div>
            
            <div class="summary-item">
                <h4>總體統計</h4>
                <p class="total-crimes">總案件數：${totalCrimes}件</p>
            </div>
            
            <div class="summary-item">
                <h4>案件類型分布</h4>
                <div class="crime-types-list">
                    ${typesHtml}
                </div>
            </div>
        </div>`;
}

// 分析犯罪
function analyzeCrime() {
    if (!crimeData) {
        alert('犯罪資料尚未載入完成，請稍後再試。');
        return;
    }

    const year = document.getElementById('input-year').value;
    const lat = parseFloat(document.getElementById('input-lat').value);
    const lng = parseFloat(document.getElementById('input-lng').value);
    const radius = parseFloat(document.getElementById('input-radius').value);

    if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
        alert('請輸入有效的數值');
        return;
    }

    updateMapDisplayAndCrimes(lng, lat, radius, year);
}

// 地圖加載完成後的初始化
map.on('load', () => {
    map.addControl(new mapboxgl.NavigationControl());
    updateLegend();
});

// 點擊地圖更新座標
map.on('click', (e) => {
    const lat = e.lngLat.lat.toFixed(4);
    const lng = e.lngLat.lng.toFixed(4);
    document.getElementById('input-lat').value = lat;
    document.getElementById('input-lng').value = lng;

    const year = document.getElementById('input-year').value;
    const radius = parseFloat(document.getElementById('input-radius').value);
    updateMapDisplayAndCrimes(lng, lat, radius, year);
});

// 點擊犯罪點顯示詳細資訊
map.on('click', 'crime-points', (e) => {
    const properties = e.features[0].properties;
    const coordinates = e.features[0].geometry.coordinates.slice();
    const point_count = properties.point_count || 1;

    const popupContent = `
        <strong>此位置共有 ${point_count} 起案件</strong><br>
        <hr>
        <strong>案類：</strong>${properties.案類}<br>
        <strong>發生時間：</strong>${properties.發生日期} ${properties.發生時段}<br>
        <strong>發生地點：</strong>${properties.發生地點}<br>
        <strong>週幾：</strong>${properties.週幾}
    `;

    new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(popupContent)
        .addTo(map);
});

// 滑鼠游標效果
map.on('mouseenter', 'crime-points', () => {
    map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'crime-points', () => {
    map.getCanvas().style.cursor = '';
});

// 錯誤處理
map.on('error', (e) => {
    console.error('Map error:', e);
});

// 事件監聽器
document.getElementById('analyze-button').addEventListener('click', analyzeCrime);
document.getElementById('theme-toggle').addEventListener('click', toggleMapTheme);
// 點擊地圖更新座標
map.on('click', (e) => {
    const lat = e.lngLat.lat.toFixed(4);
    const lng = e.lngLat.lng.toFixed(4);
    document.getElementById('input-lat').value = lat;
    document.getElementById('input-lng').value = lng;

    // 自動更新地圖顯示寰域範圍
    const radius = parseFloat(document.getElementById('input-radius').value);
    updateMapDisplay(lng, lat, radius);
});

// 錯誤處理
map.on('error', (e) => {
    console.error('Map error:', e);
});



