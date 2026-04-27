// Mapbox 設定
mapboxgl.accessToken = 'pk.eyJ1IjoiYW5keWNoaXU2MDkiLCJhIjoiY20xaWxjemc1MGVoZzJqb2NyZ2M2enE1aSJ9.PBoFruvUCgE-xt0MbTYmkg';

// 主題設定
const mapThemes = {
    dark: 'mapbox://styles/mapbox/dark-v10',
    light: 'mapbox://styles/mapbox/light-v10'
};

let currentTheme = 'dark'; // 預設使用深色主題

// 行政區中心點
const districtCenters = {
    "中正區": [121.5198, 25.0324],
    "大同區": [121.5133, 25.0634],
    "中山區": [121.5381, 25.0699],
    "松山區": [121.5575, 25.0600],
    "大安區": [121.5434, 25.0264],
    "萬華區": [121.4979, 25.0286],
    "信義區": [121.5716, 25.0305],
    "士林區": [121.5508, 25.0891],
    "北投區": [121.5018, 25.1141],
    "內湖區": [121.5937, 25.0837],
    "南港區": [121.6097, 25.0558],
    "文山區": [121.5736, 24.9886]
};

// 初始化地圖
const map = new mapboxgl.Map({
    container: 'map',
    style: mapThemes[currentTheme],
    center: [121.5654, 25.0330],
    zoom: 11
});

// 全局變量
let crimeData;
let currentDistrict = 'all';
let currentCrimeType = 'all';
let currentYear = '2014';
const mapCenterLat = 25.0330;

// Legend 更新函數
function updateLegend() {
    const legendContainer = document.getElementById('legend');
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
    legendContainer.innerHTML = legendHTML;
}

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
            updateMap();
        }
    });
}


// 工具函數
function metersToPixels(meters, zoom) {
    return meters / (156543.03392 * Math.cos(mapCenterLat * Math.PI / 180) / Math.pow(2, zoom));
}

function extractDistrictFromLocation(location) {
    const districts = Object.keys(districtCenters);
    for (const district of districts) {
        if (location.includes(district)) {
            return district;
        }
    }
    return null;
}

// UI 更新函數
function updateCrimeTypeOptions(data) {
    if (!data || !data.features) return;
    
    const crimeTypes = [...new Set(data.features.map(f => f.properties.案類))].sort();
    const crimeTypeSelect = document.getElementById('crime-type-select');
    crimeTypeSelect.innerHTML = '<option value="all">所有類型</option>';
    
    crimeTypes.forEach(crimeType => {
        const option = document.createElement('option');
        option.value = crimeType;
        option.textContent = crimeType;
        crimeTypeSelect.appendChild(option);
    });
}

// 資料處理函數
function processData(features) {
    // 建立位置計數的 Map
    const locationMap = new Map();
    
    // 第一次遍歷：計算每個位置的案件數
    features.forEach(feature => {
        const coords = JSON.stringify(feature.geometry.coordinates);
        if (!locationMap.has(coords)) {
            locationMap.set(coords, {
                count: 1,
                cases: [feature]
            });
        } else {
            const location = locationMap.get(coords);
            location.count += 1;
            location.cases.push(feature);
        }
    });
    
    // 第二次遍歷：更新每個 feature 的 point_count
    return features.map(feature => {
        const coords = JSON.stringify(feature.geometry.coordinates);
        const location = locationMap.get(coords);
        return {
            ...feature,
            properties: {
                ...feature.properties,
                point_count: location.count
            }
        };
    });
}

// 資料過濾函數
function filterData(data) {
    if (!data || !data.features) {
        console.error('Invalid data structure:', data);
        return [];
    }
    
    return data.features.filter(feature => {
        const properties = feature.properties;
        const district = extractDistrictFromLocation(properties.發生地點);
        const crimeType = properties.案類;
        const year = properties.年份;
        
        const matchesDistrict = currentDistrict === 'all' || district === currentDistrict;
        const matchesCrimeType = currentCrimeType === 'all' || crimeType === currentCrimeType;
        const matchesYear = year && currentYear && year.toString() === currentYear.toString();

        return matchesDistrict && matchesCrimeType && matchesYear;
    });
}

// 熱力圖更新函數
function updateHeatmapLayer() {
    const radius = parseInt(document.getElementById('heatmap-radius').value);
    const intensity = parseFloat(document.getElementById('heatmap-intensity').value);
    const opacity = parseFloat(document.getElementById('heatmap-opacity').value);
    const zoom = map.getZoom();

    const pixelRadius = metersToPixels(radius, zoom);

    if (map.getLayer('crime-heatmap')) {
        map.setPaintProperty('crime-heatmap', 'heatmap-radius', pixelRadius);
        map.setPaintProperty('crime-heatmap', 'heatmap-intensity', intensity);
        map.setPaintProperty('crime-heatmap', 'heatmap-opacity', opacity);
    }

    document.getElementById('radius-value').textContent = radius;
    document.getElementById('intensity-value').textContent = intensity.toFixed(1);
    document.getElementById('opacity-value').textContent = opacity.toFixed(1);
}

// 地圖更新主函數
function updateMap() {
    const filteredFeatures = filterData(crimeData);
    const processedFeatures = processData(filteredFeatures);
    
    if (map.getSource('crime-data')) {
        map.getSource('crime-data').setData({
            type: 'FeatureCollection',
            features: processedFeatures
        });
    } else {
        map.addSource('crime-data', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: processedFeatures
            }
        });

        map.addLayer({
            id: 'crime-heatmap',
            type: 'heatmap',
            source: 'crime-data',
            paint: {
                'heatmap-weight': 1,
                'heatmap-color': [
                    'interpolate',
                    ['linear'],
                    ['heatmap-density'],
                    0, 'rgba(0, 0, 255, 0)',
                    0.2, 'royalblue',
                    0.4, 'cyan',
                    0.6, 'lime',
                    0.8, 'yellow',
                    1, 'red'
                ],
                'heatmap-radius': 200,
                'heatmap-opacity': 0.7
            }
        });

        map.addLayer({
            'id': 'crime-points',
            'type': 'circle',
            'source': 'crime-data',
            'minzoom': 14,
            'paint': {
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

        updateHeatmapLayer();
    }

    document.getElementById('crime-count').textContent = `犯罪案件數: ${processedFeatures.length}`;
    updateLegend(); // 更新圖例
}

// 初始化和事件處理
map.on('load', () => {
    // 設置按鈕的初始樣式
    const themeButton = document.getElementById('theme-toggle');
    themeButton.className = `theme-button ${currentTheme}`;
    
    fetch('https://raw.githubusercontent.com/Kai0514/Repo_1/main/Crime_Map_Web/Crime_Map_Data.geojson')
        .then(response => response.json())
        .then(data => {
            crimeData = data;
            updateCrimeTypeOptions(data);
            updateMap();
            setupEventHandlers();
        })
        .catch(error => {
            console.error('Error loading crime data:', error);
        });
});

function setupEventHandlers() {
    // 點擊事件處理
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

    // 控制項事件監聽
    document.getElementById('district-select').addEventListener('change', (e) => {
        currentDistrict = e.target.value;
        updateMap();

        if (currentDistrict !== 'all') {
            map.flyTo({
                center: districtCenters[currentDistrict],
                zoom: 14,
                essential: true,
                duration: 1500
            });
        } else {
            map.flyTo({
                center: [121.5654, 25.0330],
                zoom: 11,
                essential: true,
                duration: 1500
            });
        }
    });

    document.getElementById('crime-type-select').addEventListener('change', (e) => {
        currentCrimeType = e.target.value;
        updateMap();
    });

    document.getElementById('time-range').addEventListener('input', (e) => {
        currentYear = e.target.value;
        document.getElementById('year-value').textContent = currentYear;
        updateMap();
    });

    // 熱力圖控制
    document.getElementById('heatmap-radius').addEventListener('input', updateHeatmapLayer);
    document.getElementById('heatmap-intensity').addEventListener('input', updateHeatmapLayer);
    document.getElementById('heatmap-opacity').addEventListener('input', updateHeatmapLayer);

    // 主題切換按鈕事件監聽
    document.getElementById('theme-toggle').addEventListener('click', toggleMapTheme);
}

// 縮放事件處理
map.on('zoomend', updateHeatmapLayer);