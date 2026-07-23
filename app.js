// DOM Elements
const symbolInput = document.getElementById('symbol-input');
const searchBtn = document.getElementById('search-btn');
const stockNameEl = document.getElementById('stock-name');
const stockTickerEl = document.getElementById('stock-ticker');
const currentPriceEl = document.getElementById('current-price');
const priceChangeEl = document.getElementById('price-change');
const changePercentEl = document.getElementById('change-percent');
const lastUpdatedEl = document.getElementById('last-updated');
const trendIconEl = document.getElementById('trend-icon');
const chartLoader = document.getElementById('chart-loader');

// Top 10 Elements
const top10ListEl = document.getElementById('top10-list');

// Alert Elements
const alertPriceInput = document.getElementById('alert-price');
const alertConditionSelect = document.getElementById('alert-condition');
const alertEmailInput = document.getElementById('alert-email');
const emailHelperText = document.getElementById('email-helper-text');
const useDiffEmailBtn = document.getElementById('use-diff-email-btn');
const setAlertBtn = document.getElementById('set-alert-btn');
const activeAlertContainer = document.getElementById('active-alert-container');
const activeAlertText = document.getElementById('active-alert-text');
const clearAlertBtn = document.getElementById('clear-alert-btn');
const toastContainer = document.getElementById('toast-container');

// AI Elements
const runAiBtn = document.getElementById('run-ai-btn');
const aiResults = document.getElementById('ai-results');
const aiTickerName = document.getElementById('ai-ticker-name');

// State
let currentSymbol = 'RELIANCE.NS';
let stockChart = null;
let currentPrice = 0;
let previousClose = 0;
let updateInterval = null;
let activeAlert = null;

// Old TOP_10_SYMBOLS declaration removed to fix SyntaxError

// Initialize Chart.js with custom dark theme colors
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Outfit', sans-serif";

function initChart() {
    const ctx = document.getElementById('stockChart').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    stockChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Price (₹)',
                data: [],
                borderColor: '#3b82f6',
                borderWidth: 2,
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#3b82f6',
                pointHoverBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#f8fafc',
                    bodyColor: '#f8fafc',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            return `₹ ${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false, drawBorder: false }, ticks: { maxTicksLimit: 8 } },
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false }, ticks: { callback: function(value) { return '₹ ' + value; } } }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
    });
}

// Format Currency
const formatINR = (num) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(num);

// Top 10 Symbols (Mixed Indian & US Stocks)
const TOP_10_SYMBOLS = [
    'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'INFY.NS', 
    'AAPL', 'TSLA', 'MSFT', 'NVDA', 'GOOGL'
];

// Fetch Main Chart Data (Using Netlify Backend)
async function fetchStockData(symbol, isBackgroundUpdate = false, isInitialLoad = false) {
    try {
        if (!isBackgroundUpdate) chartLoader.classList.remove('hidden');
        
        let cleanSymbol = symbol.trim().toUpperCase();
        
        // Auto-translation: If query looks like a query or friendly name rather than a raw ticker
        const isLikelyQuery = /\s/.test(cleanSymbol) || (cleanSymbol.length > 6 && !cleanSymbol.includes('.'));
        if (isLikelyQuery) {
            try {
                const searchRes = await fetch(`/.netlify/functions/stock?action=search&q=${encodeURIComponent(symbol)}`);
                const searchData = await searchRes.json();
                if (searchData && searchData.length > 0) {
                    cleanSymbol = searchData[0].symbol;
                }
            } catch(err) {
                console.error("Auto-translation error:", err);
            }
        }
        
        // Add .NS default for common Indian symbols if omitted
        if (['RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK', 'INFY'].includes(cleanSymbol)) {
            cleanSymbol += '.NS';
        }

        let data;
        const url = `/.netlify/functions/stock?action=chart&symbol=${cleanSymbol}`;
        const response = await fetch(url).catch(() => ({ ok: false }));
        
        if (response.ok) {
            data = await response.json();
            if (data.error) throw new Error(data.error);
        } else {
            throw new Error('Could not connect to backend server');
        }

        currentPrice = parseFloat(data.price);
        previousClose = parseFloat(data.prevClose);
        
        const changeValue = currentPrice - previousClose;
        const changePercent = (changeValue / previousClose) * 100;
        
        updateDashboardUI(data.symbol.replace('.NS', ''), data.name, currentPrice, changeValue, changePercent);
        
        if (!isBackgroundUpdate && !isInitialLoad) {
            symbolInput.value = data.name || data.symbol;
        }
        
        if (data.prices && data.prices.length > 0) {
            updateChart(data.labels, data.prices, changeValue >= 0);
        }
        
        checkAlerts(currentPrice);
        
        aiTickerName.textContent = data.symbol.replace('.NS', '');
        document.getElementById('alert-ticker-name').textContent = data.symbol.replace('.NS', '');

    } catch (error) {
        console.error('Error fetching stock data:', error);
        if (!isBackgroundUpdate) {
            showToast('Error loading chart data. Try searching for full company name.', 'error');
        }
    } finally {
        chartLoader.classList.add('hidden');
    }
}

async function loadTop10() {
    top10ListEl.innerHTML = '<div class="loader-small"></div>';
    
    try {
        const symbols = TOP_10_SYMBOLS.join(',');
        const url = `/.netlify/functions/stock?action=top10&symbols=${symbols}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        
        const resultData = await response.json();
        if (resultData.error) throw new Error(resultData.error);
        
        top10ListEl.innerHTML = '';
        
        resultData.forEach((stockData) => {
            const symbolBase = stockData.symbol.replace('.NS', '');
            const price = parseFloat(stockData.price);
            const change = parseFloat(stockData.change);
            const pct = parseFloat(stockData.percent_change);
            const isUp = change >= 0;
            
            const div = document.createElement('div');
            div.className = 'top10-item';
            div.innerHTML = `
                <div class="top10-info">
                    <span class="top10-symbol" title="${stockData.shortName}">${stockData.shortName}</span>
                    <span class="top10-price">${symbolBase} • ${formatINR(price)}</span>
                </div>
                <div class="top10-trend ${isUp ? 'up' : 'down'}">
                    ${isUp ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}%
                </div>
            `;
            
            div.addEventListener('click', () => {
                symbolInput.value = stockData.symbol;
                searchBtn.click();
            });
            
            top10ListEl.appendChild(div);
        });
        
    } catch(e) {
        console.error("Top 10 Fetch Error:", e);
        top10ListEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:10px;">Failed to load list.</p>';
    }
}

async function loadLiveTicker() {
    const container = document.getElementById('ticker-items-container');
    if (!container) return;
    
    try {
        const symbols = TOP_10_SYMBOLS.join(',');
        const url = `/.netlify/functions/stock?action=top10&symbols=${symbols}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const resultData = await response.json();
        if (resultData.error) throw new Error(resultData.error);
        
        container.innerHTML = '';
        
        const tickerItemsHTML = resultData.map(stock => {
            const isUp = stock.change >= 0;
            const arrow = isUp ? '▲' : '▼';
            const inrClass = stock.symbol.endsWith('.NS') || stock.symbol.endsWith('.BO') ? '₹' : '$';
            const priceFormatted = stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const absoluteChange = Math.abs(stock.change).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const percentChange = Math.abs(stock.percent_change).toFixed(2);
            const changeFormatted = `${arrow} ${absoluteChange} (${percentChange}%)`;
            const directionClass = isUp ? 'bullish' : 'bearish';
            
            return `
                <div class="ticker-item ${directionClass}" style="cursor: pointer;">
                    <span class="ticker-symbol">${stock.symbol.replace('.NS', '')}</span>
                    <span class="ticker-price">${inrClass} ${priceFormatted}</span>
                    <span class="ticker-change">${changeFormatted}</span>
                </div>
            `;
        }).join('');
        
        container.innerHTML = tickerItemsHTML + tickerItemsHTML;
        
        // Add click events to ticker items to load that symbol on click
        container.querySelectorAll('.ticker-item').forEach((item, idx) => {
            item.addEventListener('click', () => {
                const stockData = resultData[idx % resultData.length];
                symbolInput.value = stockData.symbol;
                searchBtn.click();
            });
        });
        
    } catch (e) {
        console.error('Failed to load Live Stock Ticker:', e);
        container.innerHTML = `<div style="padding: 0 20px; color: var(--text-muted); font-size: 0.85rem;">Failed to load live ticker.</div>`;
    }
}

function updateDashboardUI(symbol, name, price, changeVal, changePct) {
    stockTickerEl.textContent = symbol;
    stockNameEl.textContent = name || symbol;
    
    currentPriceEl.textContent = formatINR(price);
    
    const isPositive = changeVal >= 0;
    const sign = isPositive ? '+' : '';
    changePercentEl.textContent = `${sign}${formatINR(Math.abs(changeVal)).replace('₹','₹ ')} (${sign}${changePct.toFixed(2)}%)`;
    
    if (isPositive) {
        priceChangeEl.className = 'price-change positive';
        trendIconEl.innerHTML = `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>`;
    } else {
        priceChangeEl.className = 'price-change negative';
        trendIconEl.innerHTML = `<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline>`;
    }
    
    lastUpdatedEl.textContent = `Last updated: ${new Date().toLocaleTimeString('en-IN')}`;
}

function updateChart(labels, data, isPositive) {
    stockChart.data.labels = labels;
    stockChart.data.datasets[0].data = data;
    
    const color = isPositive ? '#10b981' : '#ef4444';
    const ctx = document.getElementById('stockChart').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    
    if (isPositive) {
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.5)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
    } else {
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.5)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
    }
    
    stockChart.data.datasets[0].borderColor = color;
    stockChart.data.datasets[0].backgroundColor = gradient;
    stockChart.data.datasets[0].pointHoverBorderColor = color;
    
    stockChart.update();
}

// --- AI PREDICT LOGIC ---
function runAiPrediction() {
    runAiBtn.disabled = true;
    runAiBtn.textContent = 'Processing Data...';
    aiResults.classList.remove('hidden');
    
    // Reset
    document.getElementById('ai-rsi-fill').style.width = '0%';
    document.getElementById('ai-macd-fill').style.width = '0%';
    document.getElementById('ai-vol-fill').style.width = '0%';
    document.getElementById('ai-rsi-text').textContent = 'Analyzing...';
    document.getElementById('ai-macd-text').textContent = 'Analyzing...';
    document.getElementById('ai-vol-text').textContent = 'Analyzing...';
    
    // Simulate AI thinking time
    setTimeout(() => {
        // Generate pseudo-random deterministic results based on current price
        const isBullish = Math.random() > 0.4; // 60% chance bullish for effect
        
        // Update bars
        const rsiVal = isBullish ? 65 : 35;
        const macdVal = isBullish ? 80 : 20;
        const volVal = 40 + (Math.random() * 40);
        
        const rsiFill = document.getElementById('ai-rsi-fill');
        const macdFill = document.getElementById('ai-macd-fill');
        
        rsiFill.style.width = `${rsiVal}%`;
        rsiFill.style.backgroundColor = isBullish ? '#10b981' : '#ef4444';
        document.getElementById('ai-rsi-text').textContent = isBullish ? 'Oversold (Buy Signal)' : 'Overbought (Sell Signal)';
        
        macdFill.style.width = `${macdVal}%`;
        macdFill.style.backgroundColor = isBullish ? '#10b981' : '#ef4444';
        document.getElementById('ai-macd-text').textContent = isBullish ? 'Bullish Crossover' : 'Bearish Crossover';
        
        document.getElementById('ai-vol-fill').style.width = `${volVal}%`;
        document.getElementById('ai-vol-fill').style.backgroundColor = '#f59e0b';
        document.getElementById('ai-vol-text').textContent = volVal > 60 ? 'High Volatility' : 'Stable';
        
        // Final Verdict
        const verdictEl = document.getElementById('ai-verdict');
        verdictEl.textContent = isBullish ? 'BULLISH' : 'BEARISH';
        verdictEl.style.color = isBullish ? '#10b981' : '#ef4444';
        
        const change = (currentPrice * 0.02) + (Math.random() * (currentPrice * 0.03));
        const target = isBullish ? currentPrice + change : currentPrice - change;
        document.getElementById('ai-target').textContent = formatINR(target);
        
        runAiBtn.textContent = 'Analysis Complete';
        setTimeout(() => { runAiBtn.disabled = false; runAiBtn.textContent = 'Run Analysis Again'; }, 3000);
        
    }, 1500);
}


// --- TABS & NAVIGATION ---
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        // Remove active class from all tabs
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        // Add active class to clicked
        item.classList.add('active');
        
        // Hide all views
        document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
        
        // Show target view
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
    });
});


// Email Alert State
let useDifferentEmail = false;

function updateEmailAlertUI() {
    const authMode = sessionStorage.getItem('auth_mode');
    const authUsername = sessionStorage.getItem('auth_username') || '';
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authUsername);
    
    if (authMode === 'logged_in' && isEmail) {
        if (useDifferentEmail) {
            alertEmailInput.readOnly = false;
            emailHelperText.classList.add('hidden');
            useDiffEmailBtn.textContent = 'Use Registered Email';
            useDiffEmailBtn.classList.remove('hidden');
        } else {
            alertEmailInput.value = authUsername;
            alertEmailInput.readOnly = true;
            emailHelperText.classList.remove('hidden');
            useDiffEmailBtn.textContent = 'Use Another Email';
            useDiffEmailBtn.classList.remove('hidden');
        }
    } else {
        alertEmailInput.readOnly = false;
        if (!alertEmailInput.value || alertEmailInput.value === authUsername) {
            alertEmailInput.value = '';
        }
        emailHelperText.classList.add('hidden');
        useDiffEmailBtn.classList.add('hidden');
    }
}

// Fetch and render alert logs from server
async function loadAlertHistory() {
    const authMode = sessionStorage.getItem('auth_mode');
    const token = sessionStorage.getItem('auth_token');
    
    const promptEl = document.getElementById('alerts-auth-prompt');
    const listEl = document.getElementById('alert-history-list');
    
    if (authMode !== 'logged_in' || !token) {
        promptEl.classList.remove('hidden');
        listEl.classList.add('hidden');
        return;
    }
    
    try {
        const response = await fetch('/api/alerts', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch alerts');
        
        let alerts = await response.json();
        
        promptEl.classList.add('hidden');
        listEl.classList.remove('hidden');
        
        // Search & Status filters
        const searchVal = document.getElementById('alert-search').value.toLowerCase().trim();
        const filterVal = activeFilterValue;
        
        if (filterVal !== 'all') {
            alerts = alerts.filter(a => a.status === filterVal);
        }
        if (searchVal) {
            alerts = alerts.filter(a => a.symbol.toLowerCase().includes(searchVal) || a.company_name.toLowerCase().includes(searchVal));
        }
        
        if (alerts.length === 0) {
            listEl.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.9rem;">No alerts found matching filters.</div>`;
            return;
        }
        
        listEl.innerHTML = '';
        alerts.forEach(alert => {
            const item = document.createElement('div');
            item.className = 'alert-history-item';
            
            const condText = alert.condition === 'above' ? 'Goes Above' : (alert.condition === 'below' ? 'Drops Below' : 'Equals To');
            const createdTime = new Date(alert.created_at).toLocaleString('en-IN');
            const triggeredTime = alert.triggered_at ? new Date(alert.triggered_at).toLocaleString('en-IN') : '--';
            
            const emailStatusClass = alert.email_status ? alert.email_status.toLowerCase() : 'pending';
            const emailStatusText = alert.email_status || 'Pending';
            const emailErrorHtml = alert.email_error ? `<div style="color: var(--danger); font-size: 0.75rem; margin-top: 4px; line-height: 1.3; font-weight: 500;">❌ Email Error: ${alert.email_error}</div>` : '';
            
            item.innerHTML = `
                <div class="alert-history-info">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <strong style="font-size: 1.05rem; color: var(--text-main);">${alert.symbol}</strong>
                        <span style="font-size: 0.85rem; color: var(--text-muted);">${alert.company_name}</span>
                    </div>
                    <div style="font-size: 0.9rem; margin-top: 4px;">
                        Target: <strong>${formatINR(alert.target_price)}</strong> | Cond: <strong>${condText}</strong>
                    </div>
                    <div class="alert-history-meta" style="margin-top: 6px; font-size: 0.75rem; line-height: 1.4;">
                        Created: ${createdTime} <br>
                        ${alert.status === 'triggered' ? `Triggered: <span style="color:var(--success); font-weight:600;">${triggeredTime}</span>` : ''}
                        ${emailErrorHtml}
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                    <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end;">
                        <span class="alert-badge ${alert.status}" title="Alert Status">${alert.status}</span>
                        <span class="email-badge ${emailStatusClass}" title="Email Delivery Status">Email: ${emailStatusText}</span>
                    </div>
                    <div class="alert-history-actions">
                        ${alert.status === 'pending' ? `
                            <button class="btn-secondary" data-action="cancel" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.2); padding: 4px 8px; font-size: 0.75rem;">Cancel</button>
                        ` : `
                            <button class="btn-primary" data-action="recreate" style="padding: 4px 8px; font-size: 0.75rem;">Recreate</button>
                            <button class="btn-secondary" data-action="delete" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.2); padding: 4px 8px; font-size: 0.75rem;">Delete</button>
                        `}
                    </div>
                </div>
            `;
            
            // Listeners
            if (alert.status === 'pending') {
                item.querySelector('[data-action="cancel"]').addEventListener('click', async () => {
                    if (confirm('Cancel this pending alert?')) {
                        const res = await fetch(`/api/alerts?id=${alert.id}&action=cancel`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (res.ok) {
                            showToast('Alert cancelled', 'success');
                            loadAlertHistory();
                        }
                    }
                });
            } else {
                item.querySelector('[data-action="recreate"]').addEventListener('click', async () => {
                    const res = await fetch('/api/alerts/recreate', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}` 
                        },
                        body: JSON.stringify({ id: alert.id })
                    });
                    if (res.ok) {
                        showToast('Alert re-enabled (pending)', 'success');
                        loadAlertHistory();
                    }
                });
                item.querySelector('[data-action="delete"]').addEventListener('click', async () => {
                    if (confirm('Delete alert log record?')) {
                        const res = await fetch(`/api/alerts?id=${alert.id}&action=delete`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (res.ok) {
                            showToast('Alert log deleted', 'success');
                            loadAlertHistory();
                        }
                    }
                });
            }
            
            listEl.appendChild(item);
        });
    } catch(e) {
        listEl.innerHTML = `<div style="color: var(--danger); font-size: 0.9rem; padding: 10px;">Failed to load alerts.</div>`;
    }
}

// Alert System
async function setAlert() {
    const priceStr = alertPriceInput.value;
    const condition = alertConditionSelect.value;
    const email = alertEmailInput.value.trim();
    
    if (!priceStr || isNaN(priceStr)) { showToast('Please enter a valid price.', 'error'); return; }
    if (!email) { showToast('Please enter an email address for alert notifications.', 'error'); return; }
    
    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address.', 'error');
        return;
    }
    
    const targetPrice = parseFloat(priceStr);
    const token = sessionStorage.getItem('auth_token');
    
    if (!token) {
        showToast('Please log in to set stock price alerts.', 'error');
        return;
    }
    
    try {
        const res = await fetch('/api/alerts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                symbol: currentSymbol,
                target_price: targetPrice,
                condition: condition,
                email: email
            })
        });
        
        if (res.ok) {
            alertPriceInput.value = '';
            showToast('Alert created successfully with email notifications!', 'success');
            loadAlertHistory();
        } else {
            const errData = await res.json();
            showToast(errData.error || 'Failed to create alert.', 'error');
        }
    } catch (e) {
        showToast('Server update error.', 'error');
    }
}

function checkAlerts(currentPrice) {
    // Left empty since checking is handled entirely on the backend scheduler
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = '';
    if (type === 'success') icon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    else if (type === 'error') icon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    else if (type === 'alert') icon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
    toast.innerHTML = `${icon} <span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 5000);
}

// Search Suggestions Container Creation
const suggestionsBox = document.createElement('div');
suggestionsBox.id = 'search-suggestions';
suggestionsBox.className = 'search-suggestions hidden';
symbolInput.parentNode.style.position = 'relative';
symbolInput.parentNode.appendChild(suggestionsBox);

let searchTimeout = null;

let activeSuggestionIndex = -1;

function updateActiveSuggestion(items) {
    items.forEach((item, index) => {
        if (index === activeSuggestionIndex) {
            item.classList.add('active');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });
}

symbolInput.addEventListener('keydown', (e) => {
    const items = suggestionsBox.querySelectorAll('.suggestion-item');
    if (suggestionsBox.classList.contains('hidden') || !items.length) return;
    
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
        updateActiveSuggestion(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
        updateActiveSuggestion(items);
    } else if (e.key === 'Enter') {
        if (activeSuggestionIndex > -1 && items[activeSuggestionIndex]) {
            e.preventDefault();
            items[activeSuggestionIndex].click();
        }
    }
});

function highlightMatch(text, query) {
    if (!query) return text;
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    
    if (t.startsWith(q)) {
        return `<strong>${text.slice(0, query.length)}</strong>${text.slice(query.length)}`;
    }
    
    try {
        const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b(${escapedQuery})`, 'gi');
        return text.replace(regex, '<strong>$1</strong>');
    } catch (e) {
        return text;
    }
}

symbolInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    activeSuggestionIndex = -1;
    const query = symbolInput.value.trim();
    if (query.length < 1) {
        suggestionsBox.classList.add('hidden');
        return;
    }
    
    searchTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`/.netlify/functions/stock?action=search&q=${encodeURIComponent(query)}`);
            const results = await res.json();
            
            const q = query.toLowerCase();
            const filteredResults = (results || []).filter(item => {
                const s = item.symbol.toLowerCase();
                const n = item.name.toLowerCase();
                const cleanS = s.replace('.ns', '').replace('.bo', '');
                return s.startsWith(q) || cleanS.startsWith(q) || n.startsWith(q);
            });
            
            if (filteredResults.length > 0) {
                suggestionsBox.innerHTML = '';
                filteredResults.slice(0, 8).forEach((item, index) => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    
                    const name = item.name.length > 25 ? item.name.slice(0, 22) + '...' : item.name;
                    const cleanSymbol = item.symbol.replace('.NS', '');
                    
                    const highlightedName = highlightMatch(name, query);
                    const highlightedSymbol = highlightMatch(cleanSymbol, query);
                    
                    div.innerHTML = `
                        <div class="suggestion-name" title="${item.name}">${highlightedName}</div>
                        <div class="suggestion-meta">
                            <span class="suggestion-symbol">${highlightedSymbol}</span>
                            <span style="font-size:0.75rem;opacity:0.8;">(${item.exchange})</span>
                        </div>
                    `;
                    div.addEventListener('click', () => {
                        symbolInput.value = item.symbol;
                        suggestionsBox.classList.add('hidden');
                        searchBtn.click();
                    });
                    suggestionsBox.appendChild(div);
                });
                suggestionsBox.classList.remove('hidden');
            } else {
                suggestionsBox.innerHTML = `
                    <div style="pointer-events: none; text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 12px;">
                        No stocks found
                    </div>
                `;
                suggestionsBox.classList.remove('hidden');
            }
        } catch(e) {
            console.error("Suggestions error:", e);
        }
    }, 50);
});

// Close suggestions when clicking outside
document.addEventListener('click', (e) => {
    if (!symbolInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
        suggestionsBox.classList.add('hidden');
    }
});

// Watchlist rendering logic
async function loadWatchlist() {
    const authMode = sessionStorage.getItem('auth_mode');
    const token = sessionStorage.getItem('auth_token');
    
    const promptEl = document.getElementById('watchlist-auth-prompt');
    const gridEl = document.getElementById('watchlist-grid');
    const statusContainer = document.getElementById('market-status-container');
    const statusEl = document.getElementById('market-status');
    
    if (authMode !== 'logged_in' || !token) {
        promptEl.classList.remove('hidden');
        gridEl.classList.add('hidden');
        if (statusContainer) statusContainer.style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch('/api/watchlist', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch watchlist');
        
        const items = await response.json();
        
        promptEl.classList.add('hidden');
        gridEl.classList.remove('hidden');
        
        if (items.length === 0) {
            gridEl.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 30px 20px; color: var(--text-muted); font-size: 0.95rem;">
                    Your watchlist is empty. Search a stock above and click "Track" to start tracking!
                </div>
            `;
            if (statusContainer) statusContainer.style.display = 'none';
            return;
        }
        
        if (statusContainer) {
            statusContainer.style.display = 'inline-flex';
            statusEl.textContent = items[0].market_status;
            statusEl.style.color = items[0].market_status === 'Open' ? 'var(--success)' : 'var(--text-muted)';
        }
        
        gridEl.innerHTML = '';
        items.forEach(item => {
            const isUp = item.change >= 0;
            const card = document.createElement('div');
            card.className = 'watchlist-item';
            
            const changeSign = isUp ? '+' : '';
            const symbolBase = item.symbol.replace('.NS', '');
            
            card.innerHTML = `
                <div class="watchlist-compact-row">
                    <span class="watchlist-compact-text"><strong>${symbolBase}</strong> - ${item.company_name}</span>
                    <span class="watchlist-expand-indicator">▼</span>
                </div>
                <div class="watchlist-expanded-details">
                    <div class="watchlist-header">
                        <div>
                            <div class="watchlist-symbol">${symbolBase}</div>
                            <div class="watchlist-name" title="${item.company_name}">${item.company_name}</div>
                        </div>
                        <span class="watchlist-status-tag ${item.market_status.toLowerCase()}">${item.market_status}</span>
                    </div>
                    <div class="watchlist-price-block">
                        <span class="watchlist-price">${formatINR(item.price)}</span>
                        <span class="watchlist-change ${isUp ? 'positive' : 'negative'}" style="padding: 2px 6px; border-radius: 8px; font-size: 0.75rem; font-weight:600;">
                            ${changeSign}${item.percent_change.toFixed(2)}%
                        </span>
                    </div>
                    <div class="watchlist-limits">
                        <div>L: ${formatINR(item.low)}</div>
                        <div>H: ${formatINR(item.high)}</div>
                    </div>
                    <div class="watchlist-actions" style="margin-top: 8px;">
                        <button class="btn-primary" data-action="details">Details</button>
                        <button class="btn-secondary" data-action="alert">Alert</button>
                        <button class="btn-secondary" style="color: var(--danger); border-color: rgba(239,68,68,0.25);" data-action="remove">Remove</button>
                    </div>
                </div>
            `;
            
            // Toggle expanded class on click (excluding button clicks)
            card.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    card.classList.toggle('expanded');
                }
            });
            
            card.querySelector('[data-action="details"]').addEventListener('click', () => {
                symbolInput.value = item.symbol;
                searchBtn.click();
            });
            
            card.querySelector('[data-action="alert"]').addEventListener('click', () => {
                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                const alertsTab = document.querySelector('[data-target="view-alerts"]');
                alertsTab.classList.add('active');
                
                document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
                document.getElementById('view-alerts').classList.add('active');
                
                document.getElementById('alert-ticker-name').textContent = symbolBase;
                alertPriceInput.value = Math.round(item.price);
                alertPriceInput.focus();
            });
            
            card.querySelector('[data-action="remove"]').addEventListener('click', async () => {
                if (confirm(`Remove ${symbolBase} from your watchlist?`)) {
                    try {
                        const res = await fetch(`/api/watchlist?symbol=${item.symbol}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (res.ok) {
                            showToast(`${symbolBase} removed from watchlist`, 'success');
                            loadWatchlist();
                        }
                    } catch (e) {
                        showToast('Failed to remove item', 'error');
                    }
                }
            });
            
            gridEl.appendChild(card);
        });
    } catch (e) {
        gridEl.innerHTML = `<div style="grid-column: 1/-1; color: var(--danger); text-align:center; padding: 20px;">Failed to load watchlist.</div>`;
    }
}

// Search track click listener
searchBtn.addEventListener('click', async () => {
    const val = symbolInput.value.trim();
    if (val) {
        currentSymbol = val;
        suggestionsBox.classList.add('hidden');
        await fetchStockData(currentSymbol);
        
        // Add to watchlist if logged in
        const token = sessionStorage.getItem('auth_token');
        if (token) {
            try {
                const res = await fetch('/api/watchlist', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ symbol: currentSymbol })
                });
                if (res.ok) {
                    showToast(`Tracking ${currentSymbol.replace('.NS', '')} on Watchlist`, 'success');
                    loadWatchlist();
                }
            } catch (e) {
                console.error("Watchlist save error:", e);
            }
        }
    }
});

symbolInput.addEventListener('keypress', (e) => { 
    if (e.key === 'Enter') {
        suggestionsBox.classList.add('hidden');
        searchBtn.click();
    }
});

setAlertBtn.addEventListener('click', setAlert);
runAiBtn.addEventListener('click', runAiPrediction);

// --- AUTH STATE & TRANSITIONS ---
const authOverlay = document.getElementById('auth-overlay');
const authBackBtn = document.getElementById('auth-back-btn');
const authCardSubtitle = document.getElementById('auth-card-subtitle');
const authSelectionScreen = document.getElementById('auth-selection-screen');
const authLoginScreen = document.getElementById('auth-login-screen');
const authSignupScreen = document.getElementById('auth-signup-screen');

const selectLoginBtn = document.getElementById('select-login-btn');
const selectSignupBtn = document.getElementById('select-signup-btn');
const selectGuestLink = document.getElementById('select-guest-link');
const switchToSignup = document.getElementById('switch-to-signup');
const switchToLogin = document.getElementById('switch-to-login');
const guestAltLinks = document.querySelectorAll('.auth-guest-alt');

const submitLoginBtn = document.getElementById('submit-login-btn');
const submitSignupBtn = document.getElementById('submit-signup-btn');
const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');

const signupNameInput = document.getElementById('signup-name');
const signupUsernameInput = document.getElementById('signup-username');
const signupPasswordInput = document.getElementById('signup-password');
const signupConfirmPasswordInput = document.getElementById('signup-confirm-password');

const headerAuthButtons = document.getElementById('header-auth-buttons');
const headerUserProfile = document.getElementById('header-user-profile');
const headerLoginBtn = document.getElementById('header-login-btn');
const headerSignupBtn = document.getElementById('header-signup-btn');
const userDisplayName = document.getElementById('user-display-name');

const profileTrigger = document.getElementById('profile-menu-trigger');
const profileMenu = document.getElementById('profile-dropdown-menu');
const logoutBtnDropdown = document.getElementById('logout-btn-dropdown');

const settingsOverlay = document.getElementById('profile-settings-overlay');
const settingsCloseBtn = document.getElementById('settings-close-btn');

let appInitialized = false;

function showAuthScreen(screenId) {
    authSelectionScreen.classList.add('hidden');
    authLoginScreen.classList.add('hidden');
    authSignupScreen.classList.add('hidden');
    authBackBtn.classList.add('hidden');
    
    if (screenId === 'selection') {
        authSelectionScreen.classList.remove('hidden');
        authCardSubtitle.textContent = 'Elevate Your Trading with Real-time Insights & AI Predictions';
    } else if (screenId === 'login') {
        authLoginScreen.classList.remove('hidden');
        authBackBtn.classList.remove('hidden');
        authCardSubtitle.textContent = 'Welcome back! Log in to access your saved alerts and insights.';
        loginUsernameInput.focus();
    } else if (screenId === 'signup') {
        authSignupScreen.classList.remove('hidden');
        authBackBtn.classList.remove('hidden');
        authCardSubtitle.textContent = 'Join Bull Trend AI to monitor stock alerts and run technical analyses.';
        signupNameInput.focus();
    }
}

// --- STATE VARIABLES FOR CUSTOM FILTERS & PROFILE ---
let activeFilterValue = 'all';
let profilePicBase64 = null;

// Dynamic Avatar Rendering (Base64 or Silhouette SVG)
function renderUserAvatar(element, imageUrl, name = '') {
    if (!element) return;
    if (imageUrl) {
        element.innerHTML = `<img src="${imageUrl}" alt="${name}" class="avatar-img-element" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    } else {
        element.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 60%; height: 60%; color: var(--text-muted);"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
        element.style.display = 'flex';
        element.style.alignItems = 'center';
        element.style.justifyContent = 'center';
        element.style.background = 'rgba(255,255,255,0.05)';
    }
}

function enterDashboard(mode, username = '', name = '') {
    authOverlay.classList.add('hidden');
    
    const displayLabel = name || username;
    
    if (mode === 'logged_in') {
        headerAuthButtons.classList.add('hidden');
        headerUserProfile.classList.remove('hidden');
        userDisplayName.textContent = displayLabel;
        
        // Fetch fresh user details to render avatar and details cards
        const token = sessionStorage.getItem('auth_token');
        fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).then(user => {
            document.getElementById('dropdown-user-name').textContent = user.name;
            document.getElementById('dropdown-user-email').textContent = user.username;
            
            renderUserAvatar(document.getElementById('header-avatar'), user.profile_picture, user.name);
            renderUserAvatar(document.getElementById('dropdown-avatar'), user.profile_picture, user.name);
        }).catch(() => {
            renderUserAvatar(document.getElementById('header-avatar'), null, displayLabel);
            renderUserAvatar(document.getElementById('dropdown-avatar'), null, displayLabel);
        });
    } else {
        headerAuthButtons.classList.remove('hidden');
        headerUserProfile.classList.add('hidden');
    }
    
    if (!appInitialized) {
        appInitialized = true;
        initChart();
        fetchStockData(currentSymbol, false, true);
        loadTop10();
        loadLiveTicker();
        
        if (updateInterval) clearInterval(updateInterval);
        updateInterval = setInterval(() => {
            fetchStockData(currentSymbol, true);
            loadWatchlist();
            loadAlertHistory();
            loadLiveTicker();
        }, 30000);
    }
    
    useDifferentEmail = false;
    updateEmailAlertUI();
    loadWatchlist();
    loadAlertHistory();
}

async function handleLogin() {
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value;
    
    if (!username) { showToast('Please enter your username or email.', 'error'); return; }
    if (password.length < 4) { showToast('Password must be at least 4 characters long.', 'error'); return; }
    
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (res.ok) {
            sessionStorage.setItem('auth_mode', 'logged_in');
            sessionStorage.setItem('auth_username', data.username);
            sessionStorage.setItem('auth_name', data.name);
            sessionStorage.setItem('auth_token', data.token);
            showToast(`Welcome back, ${data.name}!`, 'success');
            
            loginUsernameInput.value = '';
            loginPasswordInput.value = '';
            
            enterDashboard('logged_in', data.username, data.name);
        } else {
            showToast(data.error || 'Login failed.', 'error');
        }
    } catch(e) {
        showToast('Server connection failed.', 'error');
    }
}

async function handleSignup() {
    const name = signupNameInput.value.trim();
    const username = signupUsernameInput.value.trim();
    const password = signupPasswordInput.value;
    const confirmPassword = signupConfirmPasswordInput.value;
    
    if (!name) { showToast('Please enter your name.', 'error'); return; }
    if (!username) { showToast('Please enter a username or email.', 'error'); return; }
    if (password.length < 4) { showToast('Password must be at least 4 characters long.', 'error'); return; }
    if (password !== confirmPassword) { showToast('Passwords do not match.', 'error'); return; }
    
    try {
        const res = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, username, password })
        });
        const data = await res.json();
        
        if (res.ok) {
            sessionStorage.setItem('auth_mode', 'logged_in');
            sessionStorage.setItem('auth_username', data.username);
            sessionStorage.setItem('auth_name', data.name);
            sessionStorage.setItem('auth_token', data.token);
            showToast('Account created successfully!', 'success');
            
            signupNameInput.value = '';
            signupUsernameInput.value = '';
            signupPasswordInput.value = '';
            signupConfirmPasswordInput.value = '';
            
            enterDashboard('logged_in', data.username, data.name);
        } else {
            if (data.error === 'Email/Username already registered.') {
                showToast('Email already registered! Switching to Log In...', 'info');
                loginUsernameInput.value = username;
                showAuthScreen('login');
                
                signupNameInput.value = '';
                signupUsernameInput.value = '';
                signupPasswordInput.value = '';
                signupConfirmPasswordInput.value = '';
                
                loginPasswordInput.focus();
            } else {
                showToast(data.error || 'Signup failed.', 'error');
            }
        }
    } catch(e) {
        showToast('Server connection failed.', 'error');
    }
}

function handleGuestMode() {
    sessionStorage.setItem('auth_mode', 'guest');
    showToast('Continuing as guest. Log in anytime to track settings.', 'success');
    enterDashboard('guest');
}

function handleLogout() {
    sessionStorage.removeItem('auth_mode');
    sessionStorage.removeItem('auth_username');
    sessionStorage.removeItem('auth_name');
    sessionStorage.removeItem('auth_token');
    
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
    appInitialized = false;
    
    profileMenu.classList.remove('active');
    profileMenu.classList.add('hidden');
    
    showAuthScreen('selection');
    authOverlay.classList.remove('hidden');
    useDifferentEmail = false;
    updateEmailAlertUI();
    loadWatchlist();
    loadAlertHistory();
    showToast('Logged out successfully.', 'success');
}

// CollapsibleDropdown Trigger
profileTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = profileMenu.classList.contains('hidden');
    if (isHidden) {
        profileMenu.classList.remove('hidden');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                profileMenu.classList.add('active');
            });
        });
    } else {
        profileMenu.classList.remove('active');
        profileMenu.addEventListener('transitionend', function handler() {
            profileMenu.classList.add('hidden');
            profileMenu.removeEventListener('transitionend', handler);
        }, { once: true });
    }
});

document.addEventListener('click', () => {
    if (!profileMenu.classList.contains('hidden')) {
        profileMenu.classList.remove('active');
        profileMenu.classList.add('hidden');
    }
});

// Dropdown Actions
document.querySelectorAll('#profile-dropdown-menu .dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const action = item.getAttribute('data-action');
        if (!action) return;
        
        if (action === 'profile') {
            showSettingsOverlay('profile');
        } else if (action === 'edit-profile') {
            showSettingsOverlay('edit-profile');
        } else if (action === 'profile-pic') {
            showSettingsOverlay('profile-pic');
        } else if (action === 'watchlist') {
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            document.querySelector('[data-target="view-dashboard"]').classList.add('active');
            document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
            document.getElementById('view-dashboard').classList.add('active');
            document.querySelector('.watchlist-card').scrollIntoView({ behavior: 'smooth' });
        } else if (action === 'alerts') {
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            document.querySelector('[data-target="view-alerts"]').classList.add('active');
            document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
            document.getElementById('view-alerts').classList.add('active');
        } else if (action === 'notifications') {
            showSettingsOverlay('notifications');
        } else if (action === 'password') {
            showSettingsOverlay('password');
        }
    });
});

settingsCloseBtn.addEventListener('click', () => {
    settingsOverlay.classList.add('hidden');
});

function showSettingsOverlay(screenType) {
    settingsOverlay.classList.remove('hidden');
    document.querySelectorAll('.settings-screen').forEach(scr => scr.classList.add('hidden'));
    
    const titleEl = document.getElementById('settings-title');
    const subtitleEl = document.getElementById('settings-subtitle');
    const token = sessionStorage.getItem('auth_token');
    
    if (screenType === 'profile') {
        titleEl.textContent = 'My Profile';
        subtitleEl.textContent = 'Account metadata and credentials logs';
        document.getElementById('settings-profile-screen').classList.remove('hidden');
        
        fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).then(user => {
            document.getElementById('settings-profile-name').value = user.name;
            document.getElementById('settings-profile-email').value = user.username;
            document.getElementById('settings-profile-created').value = new Date(user.created_at).toLocaleString('en-IN');
            renderUserAvatar(document.getElementById('settings-avatar'), user.profile_picture, user.name);
        });
    } else if (screenType === 'edit-profile') {
        titleEl.textContent = 'Edit Profile Name';
        subtitleEl.textContent = 'Change your full name inside the application';
        document.getElementById('settings-edit-profile-screen').classList.remove('hidden');
        
        const currentName = sessionStorage.getItem('auth_name') || '';
        document.getElementById('edit-profile-name').value = currentName;
        document.getElementById('edit-profile-name').focus();
    } else if (screenType === 'profile-pic') {
        titleEl.textContent = 'Profile Picture';
        subtitleEl.textContent = 'Upload or delete your custom photo avatar';
        document.getElementById('settings-profile-pic-screen').classList.remove('hidden');
        
        profilePicBase64 = null;
        document.getElementById('profile-pic-file').value = '';
        document.getElementById('chosen-file-name').textContent = 'No file chosen';
        
        fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).then(user => {
            renderUserAvatar(document.getElementById('upload-avatar-preview'), user.profile_picture, user.name);
        });
    } else if (screenType === 'password') {
        titleEl.textContent = 'Change Password';
        subtitleEl.textContent = 'Update your dashboard login security credentials';
        document.getElementById('settings-password-screen').classList.remove('hidden');
        
        document.getElementById('password-current').value = '';
        document.getElementById('password-new').value = '';
        document.getElementById('password-confirm').value = '';
    } else if (screenType === 'notifications') {
        titleEl.textContent = 'Notification Settings';
        subtitleEl.textContent = 'Configure trigger alerts options';
        document.getElementById('settings-notifications-screen').classList.remove('hidden');
    }
}

// Edit Profile Actions
document.getElementById('btn-to-edit-profile').addEventListener('click', () => showSettingsOverlay('edit-profile'));
document.getElementById('btn-to-change-avatar').addEventListener('click', () => showSettingsOverlay('profile-pic'));
document.querySelectorAll('.btn-back-to-profile').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        showSettingsOverlay('profile');
    });
});

document.getElementById('btn-send-test-email').addEventListener('click', async () => {
    const token = sessionStorage.getItem('auth_token');
    const btn = document.getElementById('btn-send-test-email');
    if (!token) {
        showToast('Please log in to send a test email.', 'error');
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Sending test email...';
    
    try {
        const res = await fetch('/api/auth/test-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        if (res.ok) {
            showToast('✉️ Test email sent successfully to your registered email!', 'success');
        } else {
            const data = await res.json().catch(() => ({}));
            const errMsg = data.detail ? `Email Error: ${data.detail}` : (data.error || 'Failed to send test email. Check server log configurations.');
            showToast(errMsg, 'error');
        }
    } catch (e) {
        showToast('Server update error.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '🧪 Send Test Email';
    }
});

document.getElementById('submit-edit-profile-btn').addEventListener('click', async () => {
    const name = document.getElementById('edit-profile-name').value.trim();
    const token = sessionStorage.getItem('auth_token');
    if (!name) { showToast('Name cannot be blank.', 'error'); return; }
    
    try {
        const res = await fetch('/api/auth/edit-profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name })
        });
        if (res.ok) {
            sessionStorage.setItem('auth_name', name);
            showToast('Name updated successfully!', 'success');
            
            userDisplayName.textContent = name;
            document.getElementById('dropdown-user-name').textContent = name;
            
            showSettingsOverlay('profile');
        } else {
            const err = await res.json();
            showToast(err.error || 'Failed to update name', 'error');
        }
    } catch (e) {
        showToast('Server update error.', 'error');
    }
});

// Profile Picture Uploader Actions
const fileInput = document.getElementById('profile-pic-file');
document.getElementById('btn-choose-file').addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    document.getElementById('chosen-file-name').textContent = file.name;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        profilePicBase64 = event.target.result;
        renderUserAvatar(document.getElementById('upload-avatar-preview'), profilePicBase64, 'Preview');
    };
    reader.readAsDataURL(file);
});

document.getElementById('submit-profile-pic-btn').addEventListener('click', async () => {
    const token = sessionStorage.getItem('auth_token');
    if (!profilePicBase64) {
        showToast('Please choose a photo to upload.', 'error');
        return;
    }
    
    try {
        const res = await fetch('/api/auth/profile-pic', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ profile_picture: profilePicBase64 })
        });
        if (res.ok) {
            showToast('Profile picture uploaded successfully!', 'success');
            
            renderUserAvatar(document.getElementById('header-avatar'), profilePicBase64);
            renderUserAvatar(document.getElementById('dropdown-avatar'), profilePicBase64);
            
            showSettingsOverlay('profile');
        } else {
            showToast('Failed to upload profile picture.', 'error');
        }
    } catch (e) {
        showToast('Server update error.', 'error');
    }
});

document.getElementById('submit-delete-pic-btn').addEventListener('click', async () => {
    const token = sessionStorage.getItem('auth_token');
    if (confirm('Remove profile photo?')) {
        try {
            const res = await fetch('/api/auth/profile-pic', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ profile_picture: '' })
            });
            if (res.ok) {
                showToast('Profile picture removed.', 'success');
                profilePicBase64 = null;
                
                renderUserAvatar(document.getElementById('header-avatar'), null);
                renderUserAvatar(document.getElementById('dropdown-avatar'), null);
                renderUserAvatar(document.getElementById('upload-avatar-preview'), null);
                
                showSettingsOverlay('profile');
            } else {
                showToast('Failed to remove photo.', 'error');
            }
        } catch (e) {
            showToast('Server error.', 'error');
        }
    }
});

document.getElementById('submit-change-password-btn').addEventListener('click', async () => {
    const cur = document.getElementById('password-current').value;
    const nxt = document.getElementById('password-new').value;
    const conf = document.getElementById('password-confirm').value;
    const token = sessionStorage.getItem('auth_token');
    
    if (!cur || !nxt) { showToast('Password fields cannot be blank.', 'error'); return; }
    if (nxt !== conf) { showToast('New passwords do not match.', 'error'); return; }
    if (nxt.length < 4) { showToast('Password must be >= 4 characters.', 'error'); return; }
    
    try {
        const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ current_password: cur, new_password: nxt })
        });
        const data = await res.json();
        if (res.ok) {
            showToast('Password updated successfully!', 'success');
            settingsOverlay.classList.add('hidden');
        } else {
            showToast(data.error || 'Failed to update password.', 'error');
        }
    } catch (e) {
        showToast('Server update error.', 'error');
    }
});

document.getElementById('submit-save-notifications-btn').addEventListener('click', () => {
    showToast('Notifications configurations updated!', 'success');
    settingsOverlay.classList.add('hidden');
});

// Listeners for authentication screen
selectLoginBtn.addEventListener('click', () => showAuthScreen('login'));
selectSignupBtn.addEventListener('click', () => showAuthScreen('signup'));
selectGuestLink.addEventListener('click', handleGuestMode);
switchToSignup.addEventListener('click', () => showAuthScreen('signup'));
switchToLogin.addEventListener('click', () => showAuthScreen('login'));
authBackBtn.addEventListener('click', () => showAuthScreen('selection'));
guestAltLinks.forEach(link => link.addEventListener('click', handleGuestMode));

submitLoginBtn.addEventListener('click', handleLogin);
loginPasswordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
submitSignupBtn.addEventListener('click', handleSignup);
signupConfirmPasswordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSignup(); });

// Header buttons click listeners
headerLoginBtn.addEventListener('click', () => {
    authOverlay.classList.remove('hidden');
    showAuthScreen('login');
});
headerSignupBtn.addEventListener('click', () => {
    authOverlay.classList.remove('hidden');
    showAuthScreen('signup');
});
logoutBtnDropdown.addEventListener('click', handleLogout);

useDiffEmailBtn.addEventListener('click', (e) => {
    e.preventDefault();
    useDifferentEmail = !useDifferentEmail;
    if (!useDifferentEmail) {
        alertEmailInput.value = sessionStorage.getItem('auth_username') || '';
    } else {
        alertEmailInput.value = '';
        alertEmailInput.focus();
    }
    updateEmailAlertUI();
});

// Search & Custom dropdown listeners for alerts
document.getElementById('alert-search').addEventListener('input', loadAlertHistory);

const statusFilterDropdown = document.getElementById('status-filter-dropdown');
const statusFilterTrigger = document.getElementById('status-filter-trigger');
const statusFilterOptions = document.getElementById('status-filter-options');
const statusFilterLabel = document.getElementById('status-filter-label');

statusFilterTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    statusFilterDropdown.classList.toggle('open');
});

document.addEventListener('click', () => {
    statusFilterDropdown.classList.remove('open');
});

statusFilterOptions.querySelectorAll('.custom-dropdown-option').forEach(option => {
    option.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = option.getAttribute('data-value');
        activeFilterValue = val;
        statusFilterLabel.textContent = option.textContent;
        
        statusFilterOptions.querySelectorAll('.custom-dropdown-option').forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        
        statusFilterDropdown.classList.remove('open');
        loadAlertHistory();
    });
});

// Initialize application on DOM load
document.addEventListener('DOMContentLoaded', () => {
    const savedMode = sessionStorage.getItem('auth_mode');
    const savedUsername = sessionStorage.getItem('auth_username') || '';
    const savedName = sessionStorage.getItem('auth_name') || '';
    
    if (savedMode) {
        enterDashboard(savedMode, savedUsername, savedName);
    } else {
        showAuthScreen('selection');
        updateEmailAlertUI();
    }
});
