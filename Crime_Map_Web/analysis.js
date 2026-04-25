// 預設的犯罪類型和行政區列表
const crimeTypes = ["住宅竊盜", "機車竊盜", "自行車竊盜", "汽車竊盜"];
const districtList = [
    "中正區", "大同區", "中山區", 
    "松山區", "大安區", "萬華區", 
    "信義區", "士林區", "北投區", 
    "內湖區", "南港區", "文山區"
];

// 全局變數
let globalData = [];
let selectedCrimeTypes = new Set();
let selectedDistricts = new Set();
let timeSeriesChart = null;

// 從地址中提取行政區
function getDistrict(location) {
    for (const district of districtList) {
        if (location.includes(district)) {
            return district;
        }
    }
    return '未知';
}

// 初始化日期選擇器
function initializeDatePickers() {
    const config = {
        locale: "zh_tw",
        dateFormat: "Y-m-d",
        onChange: () => updateVisualization(),
        disableMobile: true // 強制桌面樣式
    };
    
    flatpickr("#start-date", {
        ...config,
        defaultDate: "2014-01-01"
    });

    flatpickr("#end-date", {
        ...config,
        defaultDate: "2023-12-31"
    });
}


// 初始化按鈕
function initializeButtons() {
    // 初始化犯罪類型按鈕
    const crimeButtonsContainer = document.getElementById('crime-type-buttons');
    crimeButtonsContainer.innerHTML = '';
    crimeTypes.forEach(type => {
        const button = document.createElement('button');
        button.className = 'toggle-button';
        button.textContent = type;
        button.onclick = () => toggleCrimeType(type, button);
        crimeButtonsContainer.appendChild(button);
    });

    // 初始化行政區按鈕
    const districtButtonsContainer = document.getElementById('district-buttons');
    districtButtonsContainer.innerHTML = '';
    districtList.forEach(district => {
        const button = document.createElement('button');
        button.className = 'toggle-button';
        button.textContent = district;
        button.onclick = () => toggleDistrict(district, button);
        districtButtonsContainer.appendChild(button);
    });

    // 初始狀態顯示提示訊息
    updateVisualization();
}

// 切換犯罪類型選擇
function toggleCrimeType(type, button) {
    if (selectedCrimeTypes.has(type)) {
        selectedCrimeTypes.delete(type);
        button.classList.remove('active');
    } else {
        selectedCrimeTypes.add(type);
        button.classList.add('active');
    }
    updateVisualization();
}

// 切換行政區選擇
function toggleDistrict(district, button) {
    if (selectedDistricts.has(district)) {
        selectedDistricts.delete(district);
        button.classList.remove('active');
    } else {
        selectedDistricts.add(district);
        button.classList.add('active');
    }
    updateVisualization();
}

// 初始化
async function initialize() {
    await loadData();
    initializeDatePickers();
    initializeButtons();
    setupEventListeners();
}

// 載入數據
async function loadData() {
    try {
        const response = await fetch('./crime_data_cleaned.geojson');
        const data = await response.json();
        globalData = data.features;
        console.log('Data loaded:', globalData.length, 'records');
    } catch (error) {
        console.error('Error loading data:', error);
        alert('數據載入失敗，請確保數據文件存在且可訪問');
    }
}

// 設置事件監聽器
function setupEventListeners() {
    // 下載按鈕
    document.getElementById('download-chart').addEventListener('click', downloadChart);
    document.getElementById('download-geojson').addEventListener('click', downloadCSV); // 更新按鈕的事件處理函數
}

// 獲取過濾後的數據
function getFilteredData() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    return globalData.filter(item => {
        const date = item.properties.發生日期;
        const district = getDistrict(item.properties.發生地點);
        const type = item.properties.案類;
        
        const matchDate = (!startDate || date >= startDate) && (!endDate || date <= endDate);
        const matchDistrict = selectedDistricts.size === 0 || selectedDistricts.has(district);
        const matchType = selectedCrimeTypes.size === 0 || selectedCrimeTypes.has(type);

        return matchDate && matchDistrict && matchType;
    });
}

// 更新統計摘要
function updateStats(data) {
    // 如果沒有選擇任何條件，顯示預設值
    if (selectedCrimeTypes.size === 0 || selectedDistricts.size === 0) {
        document.getElementById('total-cases').textContent = '0';
        document.getElementById('avg-monthly-cases').textContent = '0';
        document.getElementById('top-district').textContent = '-';
        document.getElementById('top-crime-type').textContent = '-';
        return;
    }

    // 計算總案件數
    const totalCases = data.length;
    document.getElementById('total-cases').textContent = totalCases;

    if (totalCases === 0) {
        document.getElementById('avg-monthly-cases').textContent = '0';
        document.getElementById('top-district').textContent = '-';
        document.getElementById('top-crime-type').textContent = '-';
        return;
    }

    // 計算每月平均案件數
    const dates = data.map(item => item.properties.發生日期.substring(0, 7)); // 取年月
    const uniqueMonths = new Set(dates).size;
    const avgMonthlyCases = (totalCases / uniqueMonths).toFixed(1);
    document.getElementById('avg-monthly-cases').textContent = avgMonthlyCases;

    // 計算最高發生區域
    const districtCounts = {};
    data.forEach(item => {
        const district = getDistrict(item.properties.發生地點);
        districtCounts[district] = (districtCounts[district] || 0) + 1;
    });
    const topDistrict = Object.entries(districtCounts)
        .sort((a, b) => b[1] - a[1])[0][0];
    document.getElementById('top-district').textContent = topDistrict;

    // 計算主要犯罪類型
    const crimeCounts = {};
    data.forEach(item => {
        const type = item.properties.案類;
        crimeCounts[type] = (crimeCounts[type] || 0) + 1;
    });
    const topCrimeType = Object.entries(crimeCounts)
        .sort((a, b) => b[1] - a[1])[0][0];
    document.getElementById('top-crime-type').textContent = topCrimeType;
}

// 更新時間序列圖表
function updateTimeSeriesChart(data) {
    const ctx = document.getElementById('timeSeriesChart');
    if (!ctx) {
        console.error('Cannot find chart canvas');
        return;
    }

    // 基本檢查
    if (selectedCrimeTypes.size === 0 || selectedDistricts.size === 0) {
        if (timeSeriesChart) {
            timeSeriesChart.destroy();
            timeSeriesChart = null;
        }
        const context = ctx.getContext('2d');
        context.clearRect(0, 0, ctx.width, ctx.height);
        context.font = '16px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('請選擇至少一個犯罪類型和一個行政區', ctx.width / 2, ctx.height / 2);
        return;
    }

    // 為每個選定的行政區準備數據
    const districtData = {};
    selectedDistricts.forEach(district => {
        districtData[district] = {};
    });

    // 按區域和月份分類數據
    data.forEach(item => {
        const fullDate = item.properties.發生日期.split('T')[0];
        // 只取年月部分 (YYYY-MM)
        const monthDate = fullDate.substring(0, 7);
        const district = getDistrict(item.properties.發生地點);
        
        if (selectedDistricts.has(district)) {
            if (!districtData[district][monthDate]) {
                districtData[district][monthDate] = 0;
            }
            districtData[district][monthDate]++;
        }
    });

    // 獲取所有月份並排序
    const allMonths = [...new Set(data.map(item => 
        item.properties.發生日期.split('T')[0].substring(0, 7)
    ))].sort();

    // 格式化月份顯示
    const formatMonth = (yearMonth) => {
        const [year, month] = yearMonth.split('-');
        return `${year}年${month}月`;
    };

    // 準備數據集
    const datasets = Array.from(selectedDistricts).map((district, index) => {
        const colors = [
            'rgb(255, 99, 132)',   // 紅色
            'rgb(54, 162, 235)',   // 藍色
            'rgb(75, 192, 192)',   // 青色
            'rgb(255, 159, 64)',   // 橙色
            'rgb(153, 102, 255)',  // 紫色
            'rgb(255, 205, 86)',   // 黃色
            'rgb(201, 203, 207)',  // 灰色
            'rgb(255, 99, 255)',   // 粉紅色
            'rgb(99, 255, 132)',   // 綠色
            'rgb(99, 132, 255)',   // 深藍色
            'rgb(255, 159, 255)',  // 粉紫色
            'rgb(159, 255, 159)'   // 淺綠色
        ];

        const dataPoints = allMonths.map(month => 
            Math.round(districtData[district][month] || 0) // 將數值四捨五入為整數
        );

        return {
            label: district,
            data: dataPoints,
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length].replace('rgb', 'rgba').replace(')', ', 0.1)'),
            borderWidth: 2,
            tension: 0.1,
            fill: false,
            pointRadius: 2,
            pointHoverRadius: 5
        };
    });

    // 更新圖表
    if (timeSeriesChart) {
        timeSeriesChart.destroy();
    }

    timeSeriesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: allMonths.map(formatMonth), // 格式化月份標籤
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '各行政區案件數量時間分布',
                    font: {
                        size: 16
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#000',
                    bodyColor: '#000',
                    borderColor: '#ddd',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${Math.round(context.raw)}件`; // 顯示整數件數
                        }
                    }
                },
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            size: 12
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '月份',
                        font: {
                            size: 14
                        }
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '案件數',
                        font: {
                            size: 14
                        }
                    },
                    ticks: {
                        stepSize: 1, // 確保y軸刻度為整數
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

// 更新表格數據
function updateTable(data) {
    const tbody = document.getElementById('dataTable').querySelector('tbody');
    if (!tbody) {
        console.error('Cannot find table body');
        return;
    }

    // 如果沒有選擇任何條件，顯示提示訊息
    if (selectedCrimeTypes.size === 0 || selectedDistricts.size === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">請選擇至少一個犯罪類型和一個行政區</td></tr>';
        return;
    }

    // 處理數據
    const aggregatedData = {};
    data.forEach(item => {
        const date = item.properties.發生日期;
        const district = getDistrict(item.properties.發生地點);
        const type = item.properties.案類;
        const key = `${date}-${district}-${type}`;
        
        if (!aggregatedData[key]) {
            aggregatedData[key] = {
                date,
                district,
                type,
                count: 0
            };
        }
        aggregatedData[key].count++;
    });

    // 更新表格
    tbody.innerHTML = '';
    if (Object.keys(aggregatedData).length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">無符合條件的數據</td></tr>';
        return;
    }

    Object.values(aggregatedData)
        .sort((a, b) => a.date.localeCompare(b.date))
        .forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.date}</td>
                <td>${row.district}</td>
                <td>${row.type}</td>
                <td>${row.count}</td>
            `;
            tbody.appendChild(tr);
        });
}

// 下載圖表
function downloadChart() {
    const canvas = document.getElementById('timeSeriesChart');
    if (!canvas) {
        console.error('Cannot find chart canvas');
        return;
    }

    const link = document.createElement('a');
    link.download = '犯罪統計圖表.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// 下載 GeoJSON
function downloadCSV() {
    const filteredData = getFilteredData();
    
    // 生成檔名
    let filename = '犯罪數據';
    
    // 加入犯罪類型到檔名
    if (selectedCrimeTypes.size > 0) {
        filename += '_' + Array.from(selectedCrimeTypes).join('_');
    }
    
    // 加入行政區到檔名
    if (selectedDistricts.size > 0) {
        filename += '_' + Array.from(selectedDistricts).join('_');
    }
    
    // 加上日期和副檔名
    const currentDate = new Date().toISOString().split('T')[0];
    filename += `_${currentDate}.csv`;
    
    // 定義 CSV 的欄位標題
    const headers = ['日期', '行政區', '案類', '地點'];
    
    // 將數據轉換為 CSV 格式
    const csvData = filteredData.map(item => [
        item.properties.發生日期.split('T')[0],
        getDistrict(item.properties.發生地點),
        item.properties.案類,
        item.properties.發生地點
    ]);
    
    // 加入標題行
    csvData.unshift(headers);
    
    // 將數據轉換為 CSV 字串
    const csvString = csvData
        .map(row => row.map(cell => {
            if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
                return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
        }).join(','))
        .join('\n');
    
    // 創建 Blob 對象
    const blob = new Blob(['\uFEFF' + csvString], {
        type: 'text/csv;charset=utf-8'
    });
    
    // 創建下載連結
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    
    // 清理 URL 物件
    URL.revokeObjectURL(url);
}

// 更新所有視覺化
function updateVisualization() {
    const filteredData = getFilteredData();
    updateStats(filteredData);
    updateTimeSeriesChart(filteredData);
    updateTable(filteredData);
}

// 頁面載入時初始化
document.addEventListener('DOMContentLoaded', initialize);

document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('theme-toggle');

    // 初始化主題
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    themeToggleBtn.textContent = currentTheme === 'light' ? '切換至深色模式' : '切換至淺色模式';

    // 監聽切換按鈕
    themeToggleBtn.addEventListener('click', () => {
        const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeToggleBtn.textContent = newTheme === 'light' ? '切換至深色模式' : '切換至淺色模式';
    });
});
