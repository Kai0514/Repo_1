const districtList = ["中正區", "大同區", "中山區", "松山區", "大安區", "萬華區", "信義區", "士林區", "北投區", "內湖區", "南港區", "文山區"];
const crimeTypes = ["住宅竊盜", "機車竊盜", "自行車竊盜", "汽車竊盜"];

let globalData = [];
let selectedDistricts = new Set();
let selectedCrimeTypes = new Set();
let timeSeriesChart = null;

function initialize() {
    const distBox = document.getElementById('district-buttons');
    const typeBox = document.getElementById('crime-type-buttons');

    districtList.forEach(d => {
        const b = document.createElement('button');
        b.className = 'toggle-button'; b.innerText = d;
        b.onclick = () => {
            b.classList.toggle('active');
            selectedDistricts.has(d) ? selectedDistricts.delete(d) : selectedDistricts.add(d);
            updateVisualization();
        };
        distBox.appendChild(b);
    });

    crimeTypes.forEach(t => {
        const b = document.createElement('button');
        b.className = 'toggle-button'; b.innerText = t;
        b.onclick = () => {
            b.classList.toggle('active');
            selectedCrimeTypes.has(t) ? selectedCrimeTypes.delete(t) : selectedCrimeTypes.add(t);
            updateVisualization();
        };
        typeBox.appendChild(b);
    });

    flatpickr(".date-input", { locale: "zh_tw", dateFormat: "Y-m-d", onChange: updateVisualization });
    
    document.getElementById('reset-filters').onclick = resetFilters;
    document.getElementById('export-chart').onclick = exportChart;
    document.getElementById('download-csv').onclick = downloadCSV;

    setupTheme();
    loadData();
}

async function loadData() {
    const status = document.getElementById('sys-status');
    try {
        const res = await fetch('https://raw.githubusercontent.com/Kai0514/Repo_1/main/Crime_Map_Web/Crime_Map_Data.geojson');
        const data = await res.json();
        globalData = data.features;
        updateVisualization();
    } catch (e) { status.innerText = "● CONNECTION FAILED"; }
}

function updateVisualization() {
    const start = document.getElementById('start-date').value;
    const end = document.getElementById('end-date').value;

    const filtered = globalData.filter(item => {
        const p = item.properties;
        const d = districtList.find(dist => p.發生地點.includes(dist)) || '未知';
        const matchDate = (!start || p.發生日期 >= start) && (!end || p.發生日期 <= end);
        const matchDist = selectedDistricts.size === 0 || selectedDistricts.has(d);
        const matchType = selectedCrimeTypes.size === 0 || selectedCrimeTypes.has(p.案類);
        return matchDate && matchDist && matchType;
    });

    // 動態月平均計算
    const sDate = start ? new Date(start) : new Date("2024-01-01");
    const eDate = end ? new Date(end) : new Date();
    const months = Math.max(1, (eDate.getFullYear() - sDate.getFullYear()) * 12 + (eDate.getMonth() - sDate.getMonth()) + 1);
    
    document.getElementById('total-cases').innerText = filtered.length;
    document.getElementById('avg-monthly-cases').innerText = (filtered.length / months).toFixed(1);

    // 統計最高地區
    const counts = {};
    filtered.forEach(item => {
        const d = districtList.find(dist => item.properties.發生地點.includes(dist)) || '其他';
        counts[d] = (counts[d] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
    document.getElementById('top-district').innerText = sorted[0] ? `${sorted[0][0]} (${sorted[0][1]})` : '-';

    renderChart(filtered);
    renderTable(filtered);
}

function renderChart(data) {
    const ctx = document.getElementById('timeSeriesChart').getContext('2d');
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const mainColor = isDark ? '#FF0033' : '#1E3A8A';

    const daily = {};
    data.forEach(d => daily[d.properties.發生日期] = (daily[d.properties.發生日期] || 0) + 1);
    const labels = Object.keys(daily).sort();

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, isDark ? 'rgba(255, 0, 51, 0.3)' : 'rgba(30, 58, 138, 0.2)');
    gradient.addColorStop(1, 'transparent');

    if (timeSeriesChart) timeSeriesChart.destroy();
    timeSeriesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '每日案件數',
                data: labels.map(l => daily[l]),
                borderColor: mainColor,
                backgroundColor: gradient,
                fill: true, tension: 0.4, borderWidth: 3, pointRadius: 2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: isDark ? '#888' : '#333' } },
                y: { ticks: { color: isDark ? '#888' : '#333' } }
            }
        }
    });
}

function resetFilters() {
    selectedDistricts.clear(); selectedCrimeTypes.clear();
    document.querySelectorAll('.toggle-button').forEach(b => b.classList.remove('active'));
    document.getElementById('start-date')._flatpickr.clear();
    document.getElementById('end-date')._flatpickr.clear();
    updateVisualization();
}

function exportChart() {
    const link = document.createElement('a');
    link.download = 'Crime_Chart_Export.png';
    link.href = document.getElementById('timeSeriesChart').toDataURL();
    link.click();
}

function setupTheme() {
    const btn = document.getElementById('theme-toggle');
    const apply = (t) => {
        document.body.setAttribute('data-theme', t);
        const isDark = t === 'dark';
        btn.innerText = isDark ? '切換至警政模式' : '切換至偵查模式';
        document.getElementById('sys-title').innerText = isDark ? 'CRIME INTEL SYSTEM' : '臺北市犯罪數據公報';
        document.getElementById('sys-status').innerText = isDark ? '● LIVE FEED ACTIVE' : '● 警政公務系統 - 已連線';
        if (timeSeriesChart) updateVisualization();
    };
    btn.onclick = () => {
        const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', next);
        apply(next);
    };
    apply(localStorage.getItem('theme') || 'dark');
}

function renderTable(data) {
    const tbody = document.querySelector('#dataTable tbody');
    tbody.innerHTML = data.slice(0, 50).map(i => `
        <tr><td>${i.properties.發生日期}</td><td>${districtList.find(d => i.properties.發生地點.includes(d)) || '未知'}</td><td>${i.properties.案類}</td><td>${i.properties.發生地點}</td></tr>
    `).join('');
}

function downloadCSV() { alert("正在導出 CSV..."); }

document.addEventListener('DOMContentLoaded', initialize);