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
const alertPhoneInput = document.getElementById('alert-phone');
const setAlertBtn = document.getElementById('set-alert-btn');
const activeAlertContainer = document.getElementById('active-alert-container');
const activeAlertText = document.getElementById('active-alert-text');
const clearAlertBtn = document.getElementById('clear-alert-btn');
const toastContainer = document.getElementById('toast-container');

// AI Elements
const runAiBtn = document.getElementById('run-ai-btn');
const aiResults = document.getElementById('ai-results');
const aiTickerName = document.getElementById('ai-ticker-name');
const aiStockNameEl = document.getElementById('ai-stock-name');
const aiStockTickerEl = document.getElementById('ai-stock-ticker');

// State
let currentSymbol = 'RELIANCE.NS';
let stockChart = null;
let currentPrice = 0;
let previousClose = 0;
let updateInterval = null;
let activeAlert = null;
let currentStockData = null;
let insightsStockData = [];

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
        
        currentStockData = data;
        
        if (aiStockNameEl) aiStockNameEl.textContent = data.name || data.symbol;
        if (aiStockTickerEl) aiStockTickerEl.textContent = data.symbol.replace('.NS', '');
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
    if (!currentStockData || !currentStockData.prices || currentStockData.prices.length === 0) {
        showToast('No stock data available to run prediction.', 'error');
        return;
    }

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
    
    document.getElementById('ai-verdict').textContent = '--';
    document.getElementById('ai-verdict').className = 'verdict-direction';
    document.getElementById('ai-target').textContent = '₹ --';
    document.getElementById('ai-expected-change').textContent = '--%';
    document.getElementById('ai-expected-change').className = 'expected-change';
    document.getElementById('ai-confidence-score').textContent = '--%';
    document.getElementById('ai-confidence-fill').style.width = '0%';
    document.getElementById('ai-confidence-badge').textContent = '--';
    document.getElementById('ai-confidence-badge').className = 'confidence-badge';
    
    // Simulate AI thinking/processing time (1.5 seconds for visual impact)
    setTimeout(() => {
        const prices = currentStockData.prices.filter(p => p > 0);
        const rsiVal = calculateRSI(prices, 14) || 50;
        const regression = calculateRegression(prices.slice(-Math.min(prices.length, 60))) || { slope: 0 };
        const vol = calculateVolatility(prices) || 0.02;
        
        const quote = {
            symbol: currentStockData.symbol,
            price: currentPrice
        };
        const chartPoints = currentStockData.prices.map((price, idx) => ({
            time: currentStockData.labels[idx] || '',
            price: price
        }));
        
        // Compute predictions for tomorrow (1 day projection)
        const prediction = runStockPrediction(quote, chartPoints, 1);
        
        // 1. Update Momentum (RSI) Progress Bar
        const rsiFill = document.getElementById('ai-rsi-fill');
        rsiFill.style.width = `${rsiVal}%`;
        if (rsiVal > 70) {
            rsiFill.style.backgroundColor = 'var(--danger)';
            document.getElementById('ai-rsi-text').textContent = `RSI: ${rsiVal.toFixed(1)} (Overbought / Sell)`;
        } else if (rsiVal < 30) {
            rsiFill.style.backgroundColor = 'var(--success)';
            document.getElementById('ai-rsi-text').textContent = `RSI: ${rsiVal.toFixed(1)} (Oversold / Buy)`;
        } else {
            rsiFill.style.backgroundColor = 'var(--primary)';
            document.getElementById('ai-rsi-text').textContent = `RSI: ${rsiVal.toFixed(1)} (Neutral)`;
        }
        
        // 2. Update Trend (Linear Regression) Progress Bar
        const slopePct = regression.slope / currentPrice;
        // Map slopePct to a percentage from 0 to 100 where 50 is neutral
        const trendVal = Math.max(0, Math.min(100, 50 + (slopePct * 15000)));
        const macdFill = document.getElementById('ai-macd-fill');
        macdFill.style.width = `${trendVal}%`;
        if (trendVal > 55) {
            macdFill.style.backgroundColor = 'var(--success)';
            document.getElementById('ai-macd-text').textContent = `Trend Slope: +${(slopePct * 100).toFixed(4)}% (Bullish)`;
        } else if (trendVal < 45) {
            macdFill.style.backgroundColor = 'var(--danger)';
            document.getElementById('ai-macd-text').textContent = `Trend Slope: ${(slopePct * 100).toFixed(4)}% (Bearish)`;
        } else {
            macdFill.style.backgroundColor = 'var(--text-muted)';
            document.getElementById('ai-macd-text').textContent = `Trend Slope: ${(slopePct * 100).toFixed(4)}% (Flat)`;
        }
        
        // 3. Update Volatility Progress Bar
        const volVal = Math.min(100, vol * 3000); // map up to ~3.3% daily standard deviation as 100%
        const volFill = document.getElementById('ai-vol-fill');
        volFill.style.width = `${volVal}%`;
        if (volVal > 60) {
            volFill.style.backgroundColor = 'var(--danger)';
            document.getElementById('ai-vol-text').textContent = `Volatility: ${(vol * 100).toFixed(2)}% (High)`;
        } else if (volVal > 30) {
            volFill.style.backgroundColor = '#f59e0b';
            document.getElementById('ai-vol-text').textContent = `Volatility: ${(vol * 100).toFixed(2)}% (Moderate)`;
        } else {
            volFill.style.backgroundColor = 'var(--success)';
            document.getElementById('ai-vol-text').textContent = `Volatility: ${(vol * 100).toFixed(2)}% (Low / Stable)`;
        }
        
        // 4. Update Final Verdict Grid
        const verdictEl = document.getElementById('ai-verdict');
        const expectedChangeEl = document.getElementById('ai-expected-change');
        const targetEl = document.getElementById('ai-target');
        const confidenceScoreEl = document.getElementById('ai-confidence-score');
        const confidenceFillEl = document.getElementById('ai-confidence-fill');
        const confidenceBadgeEl = document.getElementById('ai-confidence-badge');
        
        const isUp = prediction.direction === 'up';
        const isDown = prediction.direction === 'down';
        
        // Update tomorrow's price direction status
        if (isUp) {
            verdictEl.textContent = 'INCREASE ▲';
            verdictEl.className = 'verdict-direction up';
        } else if (isDown) {
            verdictEl.textContent = 'DECREASE ▼';
            verdictEl.className = 'verdict-direction down';
        } else {
            verdictEl.textContent = 'STABLE ▬';
            verdictEl.className = 'verdict-direction flat';
        }
        
        // Update projected target and change percent
        targetEl.textContent = formatINR(prediction.predictedPrice);
        const sign = prediction.expectedChange >= 0 ? '+' : '';
        expectedChangeEl.textContent = `${sign}${prediction.expectedChange.toFixed(2)}%`;
        expectedChangeEl.className = `expected-change ${prediction.direction}`;
        
        // Update confidence
        const confidence = prediction.confidence;
        confidenceScoreEl.textContent = `${confidence}%`;
        confidenceFillEl.style.width = `${confidence}%`;
        
        if (confidence >= 70) {
            confidenceBadgeEl.textContent = 'High Confidence';
            confidenceBadgeEl.className = 'confidence-badge high';
            confidenceFillEl.style.backgroundColor = 'var(--success)';
        } else if (confidence >= 50) {
            confidenceBadgeEl.textContent = 'Medium Confidence';
            confidenceBadgeEl.className = 'confidence-badge medium';
            confidenceFillEl.style.backgroundColor = '#f59e0b';
        } else {
            confidenceBadgeEl.textContent = 'Low Confidence';
            confidenceBadgeEl.className = 'confidence-badge low';
            confidenceFillEl.style.backgroundColor = 'var(--danger)';
        }
        
        runAiBtn.textContent = 'Analysis Complete';
        setTimeout(() => {
            runAiBtn.disabled = false;
            runAiBtn.textContent = 'Run Analysis Again';
        }, 3000);
        
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
        
        if (targetId === 'view-insights') {
            loadMarketInsights();
        } else if (targetId === 'view-indices') {
            loadGlobalMarkets();
        }
    });
});


// Alert System
function setAlert() {
    const priceStr = alertPriceInput.value;
    const condition = alertConditionSelect.value;
    const phone = alertPhoneInput.value.trim();
    
    if (!priceStr || isNaN(priceStr)) { showToast('Please enter a valid price.', 'error'); return; }
    if (!phone) { showToast('Please enter a mobile number for SMS notifications.', 'error'); return; }
    
    // Simple regex phone validation
    const phoneRegex = /^\+?[0-9\s\-()]{10,15}$/;
    if (!phoneRegex.test(phone)) {
        showToast('Please enter a valid mobile number (e.g. +91 98765 43210).', 'error');
        return;
    }
    
    const targetPrice = parseFloat(priceStr);
    activeAlert = { price: targetPrice, condition, phone };
    activeAlertText.innerHTML = `Alert when price goes <strong>${condition}</strong> ${formatINR(targetPrice)} (SMS to: <strong>${phone}</strong>)`;
    activeAlertContainer.classList.remove('hidden');
    alertPriceInput.value = '';
    alertPhoneInput.value = '';
    showToast('Alert created successfully with SMS notifications!', 'success');
}

function clearAlert() {
    activeAlert = null;
    activeAlertContainer.classList.add('hidden');
    showToast('Alert cancelled.', 'success');
}

function checkAlerts(currentPrice) {
    if (!activeAlert) return;
    let triggered = false;
    if (activeAlert.condition === 'above' && currentPrice >= activeAlert.price) triggered = true;
    else if (activeAlert.condition === 'below' && currentPrice <= activeAlert.price) triggered = true;
    
    if (triggered) {
        const symbolStr = stockTickerEl.textContent;
        const msg = `🎯 TARGET HIT: ${symbolStr} is now ${formatINR(currentPrice)}`;
        
        // App Notification Toast
        showToast(msg, 'alert');
        
        // SMS Notification Simulation
        const phone = activeAlert.phone;
        console.log(`[SMS Gateway] Sending alert SMS to ${phone}: "${msg}"`);
        showToast(`📱 SMS alert sent to ${phone}!`, 'success');
        
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator(); osc.connect(ctx.destination);
            osc.frequency.setValueAtTime(880, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.1);
            setTimeout(() => {
                const osc2 = ctx.createOscillator(); osc2.connect(ctx.destination);
                osc2.frequency.setValueAtTime(1046.50, ctx.currentTime); osc2.start(); osc2.stop(ctx.currentTime + 0.2);
            }, 150);
        } catch (e) {}
        clearAlert();
    }
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
            
            if (results && results.length > 0) {
                suggestionsBox.innerHTML = '';
                results.slice(0, 5).forEach((item, index) => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    
                    const name = item.name.length > 25 ? item.name.slice(0, 22) + '...' : item.name;
                    const cleanSymbol = item.symbol.replace('.NS', '');
                    
                    div.innerHTML = `
                        <div class="suggestion-name" title="${item.name}">${name}</div>
                        <div class="suggestion-meta">
                            <span class="suggestion-symbol">${cleanSymbol}</span>
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
                suggestionsBox.classList.add('hidden');
            }
        } catch(e) {
            console.error("Suggestions error:", e);
        }
    }, 300);
});

// Close suggestions when clicking outside
document.addEventListener('click', (e) => {
    if (!symbolInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
        suggestionsBox.classList.add('hidden');
    }
});

// Listeners
searchBtn.addEventListener('click', () => {
    const val = symbolInput.value.trim();
    if (val) {
        currentSymbol = val;
        suggestionsBox.classList.add('hidden');
        fetchStockData(currentSymbol);
    }
});
symbolInput.addEventListener('keypress', (e) => { 
    if (e.key === 'Enter') {
        suggestionsBox.classList.add('hidden');
        searchBtn.click();
    }
});
setAlertBtn.addEventListener('click', setAlert);
clearAlertBtn.addEventListener('click', clearAlert);
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
const logoutBtn = document.getElementById('logout-btn');

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

function enterDashboard(mode, username = '') {
    authOverlay.classList.add('hidden');
    
    if (mode === 'logged_in') {
        headerAuthButtons.classList.add('hidden');
        headerUserProfile.classList.remove('hidden');
        userDisplayName.textContent = username;
    } else {
        headerAuthButtons.classList.remove('hidden');
        headerUserProfile.classList.add('hidden');
    }
    
    if (!appInitialized) {
        appInitialized = true;
        initChart();
        fetchStockData(currentSymbol, false, true);
        loadTop10();
        
        if (updateInterval) clearInterval(updateInterval);
        updateInterval = setInterval(() => {
            fetchStockData(currentSymbol, true);
        }, 60000);
    }
}

function handleLogin() {
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value;
    
    if (!username) { showToast('Please enter your username or email.', 'error'); return; }
    if (password.length < 4) { showToast('Password must be at least 4 characters long.', 'error'); return; }
    
    sessionStorage.setItem('auth_mode', 'logged_in');
    sessionStorage.setItem('auth_username', username);
    showToast(`Welcome back, ${username}!`, 'success');
    
    loginUsernameInput.value = '';
    loginPasswordInput.value = '';
    
    enterDashboard('logged_in', username);
}

function handleSignup() {
    const name = signupNameInput.value.trim();
    const username = signupUsernameInput.value.trim();
    const password = signupPasswordInput.value;
    const confirmPassword = signupConfirmPasswordInput.value;
    
    if (!name) { showToast('Please enter your name.', 'error'); return; }
    if (!username) { showToast('Please enter a username or email.', 'error'); return; }
    if (password.length < 4) { showToast('Password must be at least 4 characters long.', 'error'); return; }
    if (password !== confirmPassword) { showToast('Passwords do not match.', 'error'); return; }
    
    sessionStorage.setItem('auth_mode', 'logged_in');
    sessionStorage.setItem('auth_username', username);
    showToast('Account created successfully!', 'success');
    
    signupNameInput.value = '';
    signupUsernameInput.value = '';
    signupPasswordInput.value = '';
    signupConfirmPasswordInput.value = '';
    
    enterDashboard('logged_in', username);
}

function handleGuestMode() {
    sessionStorage.setItem('auth_mode', 'guest');
    showToast('Continuing as guest. Log in anytime to save settings.', 'success');
    enterDashboard('guest');
}

function handleLogout() {
    sessionStorage.removeItem('auth_mode');
    sessionStorage.removeItem('auth_username');
    
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
    appInitialized = false;
    
    showAuthScreen('selection');
    authOverlay.classList.remove('hidden');
    showToast('Logged out successfully.', 'success');
}

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
logoutBtn.addEventListener('click', handleLogout);

// --- MARKET INSIGHTS LOGIC ---
const INSIGHTS_SYMBOLS = [
    // Technology (13)
    'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AVGO', 'ORCL', 'NFLX',
    'TCS.NS', 'INFY.NS', 'WIPRO.NS', 'HCLTECH.NS', 'TECHM.NS',
    // Financial Services (11)
    'JPM', 'BAC', 'MS', 'GS', 'V', 'MA',
    'HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS', 'AXISBANK.NS', 'KOTAKBANK.NS',
    // Consumer Cyclical (10)
    'TSLA', 'AMZN', 'HD', 'NKE', 'MCD',
    'TATASTEEL.NS', 'MARUTI.NS', 'M&M.NS', 'TATAMOTORS.NS', 'EICHERMOT.NS',
    // Energy & Conglomerates (9)
    'XOM', 'CVX', 'COP',
    'RELIANCE.NS', 'ONGC.NS', 'NTPC.NS', 'COALINDIA.NS', 'BPCL.NS', 'IOC.NS',
    // Consumer Goods (10)
    'PG', 'KO', 'PEP', 'WMT', 'COST',
    'ITC.NS', 'HINDUNILVR.NS', 'NESTLEIND.NS', 'BRITANNIA.NS', 'TATACONSUM.NS',
    // Healthcare (11)
    'LLY', 'JNJ', 'UNH', 'MRK', 'ABBV', 'PFE',
    'SUNPHARMA.NS', 'CIPLA.NS', 'DRREDDY.NS', 'APOLLOHOSP.NS', 'DIVISLAB.NS'
];

const STOCK_INDUSTRIES = {
    // Technology
    'AAPL': 'Technology', 'MSFT': 'Technology', 'NVDA': 'Technology', 'GOOGL': 'Technology',
    'META': 'Technology', 'AVGO': 'Technology', 'ORCL': 'Technology', 'NFLX': 'Technology',
    'TCS.NS': 'Technology', 'INFY.NS': 'Technology', 'WIPRO.NS': 'Technology', 
    'HCLTECH.NS': 'Technology', 'TECHM.NS': 'Technology',
    // Financial Services
    'JPM': 'Financial Services', 'BAC': 'Financial Services', 'MS': 'Financial Services', 
    'GS': 'Financial Services', 'V': 'Financial Services', 'MA': 'Financial Services',
    'HDFCBANK.NS': 'Financial Services', 'ICICIBANK.NS': 'Financial Services', 
    'SBIN.NS': 'Financial Services', 'AXISBANK.NS': 'Financial Services', 'KOTAKBANK.NS': 'Financial Services',
    // Consumer Cyclical
    'TSLA': 'Consumer Cyclical', 'AMZN': 'Consumer Cyclical', 'HD': 'Consumer Cyclical', 
    'NKE': 'Consumer Cyclical', 'MCD': 'Consumer Cyclical',
    'TATASTEEL.NS': 'Consumer Cyclical', 'MARUTI.NS': 'Consumer Cyclical', 
    'M&M.NS': 'Consumer Cyclical', 'TATAMOTORS.NS': 'Consumer Cyclical', 'EICHERMOT.NS': 'Consumer Cyclical',
    // Energy & Conglomerates
    'XOM': 'Energy & Conglomerates', 'CVX': 'Energy & Conglomerates', 'COP': 'Energy & Conglomerates',
    'RELIANCE.NS': 'Energy & Conglomerates', 'ONGC.NS': 'Energy & Conglomerates', 
    'NTPC.NS': 'Energy & Conglomerates', 'COALINDIA.NS': 'Energy & Conglomerates', 
    'BPCL.NS': 'Energy & Conglomerates', 'IOC.NS': 'Energy & Conglomerates',
    // Consumer Goods
    'PG': 'Consumer Goods', 'KO': 'Consumer Goods', 'PEP': 'Consumer Goods', 
    'WMT': 'Consumer Goods', 'COST': 'Consumer Goods',
    'ITC.NS': 'Consumer Goods', 'HINDUNILVR.NS': 'Consumer Goods', 
    'NESTLEIND.NS': 'Consumer Goods', 'BRITANNIA.NS': 'Consumer Goods', 'TATACONSUM.NS': 'Consumer Goods',
    // Healthcare
    'LLY': 'Healthcare', 'JNJ': 'Healthcare', 'UNH': 'Healthcare', 'MRK': 'Healthcare', 
    'ABBV': 'Healthcare', 'PFE': 'Healthcare',
    'SUNPHARMA.NS': 'Healthcare', 'CIPLA.NS': 'Healthcare', 'DRREDDY.NS': 'Healthcare', 
    'APOLLOHOSP.NS': 'Healthcare', 'DIVISLAB.NS': 'Healthcare'
};

async function loadMarketInsights() {
    const growingList = document.getElementById('growing-stocks-list');
    const fallingList = document.getElementById('falling-stocks-list');
    const industriesList = document.getElementById('trending-industries-list');
    
    if (growingList) growingList.innerHTML = '<div class="loader-small"></div>';
    if (fallingList) fallingList.innerHTML = '<div class="loader-small"></div>';
    if (industriesList) industriesList.innerHTML = '<div class="loader-small"></div>';
    
    try {
        const symbols = INSIGHTS_SYMBOLS.join(',');
        const url = `/.netlify/functions/stock?action=top10&symbols=${symbols}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch insights data');
        const data = await response.json();
        
        insightsStockData = data;
        
        // Filter and map industry names
        data.forEach(item => {
            item.industry = STOCK_INDUSTRIES[item.symbol] || 'Other';
        });
        
        // 1. Render Growing Stocks (sort descending by pct, take top 10)
        const growing = [...data].sort((a, b) => b.percent_change - a.percent_change).slice(0, 10);
        if (growingList) {
            growingList.innerHTML = '';
            if (growing.length === 0) {
                growingList.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;padding:10px;">No growing stocks found.</p>';
            }
            growing.forEach(stock => {
                const row = createMoverRow(stock);
                growingList.appendChild(row);
            });
        }
        
        // 2. Render Falling Stocks (sort ascending by pct, take top 10)
        const falling = [...data].sort((a, b) => a.percent_change - b.percent_change).slice(0, 10);
        if (fallingList) {
            fallingList.innerHTML = '';
            if (falling.length === 0) {
                fallingList.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;padding:10px;">No falling stocks found.</p>';
            }
            falling.forEach(stock => {
                const row = createMoverRow(stock);
                fallingList.appendChild(row);
            });
        }
        
        // 3. Render Trending Industries
        // Group by industry and calculate average change
        const industriesMap = {};
        data.forEach(stock => {
            if (!industriesMap[stock.industry]) {
                industriesMap[stock.industry] = [];
            }
            industriesMap[stock.industry].push(stock.percent_change);
        });
        
        const industriesListArray = Object.keys(industriesMap).map(industry => {
            const changes = industriesMap[industry];
            const avgChange = changes.reduce((sum, val) => sum + val, 0) / changes.length;
            return { name: industry, change: avgChange };
        });
        
        // Sort industries descending by average change
        industriesListArray.sort((a, b) => b.change - a.change);
        
        if (industriesList) {
            industriesList.innerHTML = '';
            if (industriesListArray.length === 0) {
                industriesList.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;padding:10px;">No industries found.</p>';
            }
            industriesListArray.forEach(ind => {
                const row = createIndustryRow(ind);
                industriesList.appendChild(row);
            });
        }
        
    } catch (e) {
        console.error("Error loading insights:", e);
        if (growingList) growingList.innerHTML = '<p style="color:var(--danger);font-size:0.9rem;padding:10px;">Failed to load growing stocks.</p>';
        if (fallingList) fallingList.innerHTML = '<p style="color:var(--danger);font-size:0.9rem;padding:10px;">Failed to load falling stocks.</p>';
        if (industriesList) industriesList.innerHTML = '<p style="color:var(--danger);font-size:0.9rem;padding:10px;">Failed to load trending industries.</p>';
        showToast('Failed to load market insights.', 'error');
    }
}

function createMoverRow(stock) {
    const div = document.createElement('div');
    div.className = 'mover-row';
    const isUp = stock.percent_change >= 0;
    const pctSign = isUp ? '+' : '';
    const symbolBase = stock.symbol.replace('.NS', '');
    
    div.innerHTML = `
        <div class="mover-info">
            <span class="mover-name" title="${stock.shortName}">${stock.shortName}</span>
            <span class="mover-symbol">${symbolBase} • ${stock.industry}</span>
        </div>
        <div class="mover-trend">
            <span class="mover-price">${formatINR(stock.price)}</span>
            <span class="mover-pct ${isUp ? 'up' : 'down'}">
                ${isUp ? '▲' : '▼'} ${pctSign}${stock.percent_change.toFixed(2)}%
            </span>
        </div>
    `;
    
    // Clicking a mover row updates the main stock tracker search
    div.addEventListener('click', () => {
        // Switch to dashboard first
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        const dashTab = document.querySelector('[data-target="view-dashboard"]');
        if (dashTab) dashTab.classList.add('active');
        
        document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
        const dashView = document.getElementById('view-dashboard');
        if (dashView) dashView.classList.add('active');
        
        symbolInput.value = stock.symbol;
        searchBtn.click();
    });
    
    return div;
}

function createIndustryRow(ind) {
    const div = document.createElement('div');
    div.className = 'industry-row';
    const isUp = ind.change >= 0;
    const changeSign = isUp ? '+' : '';
    
    // Calculate a relative width for the bar: Magnitude * 30 capped at 100%
    const fillWidth = Math.min(100, Math.max(5, Math.abs(ind.change) * 30));
    const statusClass = ind.change > 0.1 ? 'up' : (ind.change < -0.1 ? 'down' : 'flat');
    
    div.innerHTML = `
        <div class="industry-info">
            <span class="industry-name">${ind.name}</span>
            <span class="industry-change ${statusClass}">
                ${isUp ? '▲' : '▼'} ${changeSign}${ind.change.toFixed(2)}%
            </span>
        </div>
        <div class="industry-progress-bar">
            <div class="industry-progress-fill ${statusClass}" style="width: 0%"></div>
        </div>
    `;
    
    div.addEventListener('click', () => {
        openIndustryBreakdown(ind.name, ind.change);
    });
    
    // Animate progress fill width on load
    setTimeout(() => {
        const fill = div.querySelector('.industry-progress-fill');
        if (fill) fill.style.width = `${fillWidth}%`;
    }, 50);
    
    return div;
}

function openIndustryBreakdown(industryName, avgChange) {
    const modal = document.getElementById('industry-modal');
    const modalTitle = document.getElementById('modal-industry-name');
    const modalPerf = document.getElementById('modal-industry-performance');
    const gainersList = document.getElementById('modal-gainers-list');
    const losersList = document.getElementById('modal-losers-list');
    
    if (!modal || !modalTitle || !modalPerf || !gainersList || !losersList) return;
    
    modalTitle.textContent = industryName;
    
    const isUp = avgChange >= 0;
    const sign = isUp ? '+' : '';
    modalPerf.textContent = `${isUp ? '▲' : '▼'} ${sign}${avgChange.toFixed(2)}%`;
    
    if (isUp) {
        modalPerf.className = 'modal-industry-performance up';
    } else if (avgChange < -0.1) {
        modalPerf.className = 'modal-industry-performance down';
    } else {
        modalPerf.className = 'modal-industry-performance flat';
    }
    
    // Filter stocks by this industry
    const sectorStocks = insightsStockData.filter(stock => stock.industry === industryName);
    
    // Separate into profit makers (>= 0) and loss makers (< 0)
    const gainers = sectorStocks.filter(stock => stock.percent_change >= 0).sort((a, b) => b.percent_change - a.percent_change);
    const losers = sectorStocks.filter(stock => stock.percent_change < 0).sort((a, b) => a.percent_change - b.percent_change);
    
    // Populate lists
    gainersList.innerHTML = '';
    if (gainers.length === 0) {
        gainersList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:12px 10px;text-align:center;">No gainers today.</p>';
    } else {
        gainers.forEach(stock => {
            gainersList.appendChild(createModalStockRow(stock));
        });
    }
    
    losersList.innerHTML = '';
    if (losers.length === 0) {
        losersList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:12px 10px;text-align:center;">No losers today.</p>';
    } else {
        losers.forEach(stock => {
            losersList.appendChild(createModalStockRow(stock));
        });
    }
    
    // Display Modal
    modal.classList.remove('hidden');
}

function createModalStockRow(stock) {
    const div = document.createElement('div');
    div.className = 'mover-row';
    const isUp = stock.percent_change >= 0;
    const pctSign = isUp ? '+' : '';
    const symbolBase = stock.symbol.replace('.NS', '');
    
    div.innerHTML = `
        <div class="mover-info">
            <span class="mover-name" style="font-size:0.9rem;" title="${stock.shortName}">${stock.shortName}</span>
            <span class="mover-symbol" style="font-size:0.75rem;">${symbolBase}</span>
        </div>
        <div class="mover-trend">
            <span class="mover-price" style="font-size:0.9rem;">${formatINR(stock.price)}</span>
            <span class="mover-pct ${isUp ? 'up' : 'down'}" style="font-size:0.8rem;">
                ${isUp ? '▲' : '▼'} ${pctSign}${stock.percent_change.toFixed(2)}%
            </span>
        </div>
    `;
    
    div.addEventListener('click', () => {
        // Close modal
        const modal = document.getElementById('industry-modal');
        if (modal) modal.classList.add('hidden');
        
        // Navigate to dashboard
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        const dashTab = document.querySelector('[data-target="view-dashboard"]');
        if (dashTab) dashTab.classList.add('active');
        
        document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
        const dashView = document.getElementById('view-dashboard');
        if (dashView) dashView.classList.add('active');
        
        symbolInput.value = stock.symbol;
        searchBtn.click();
    });
    
    return div;
}

// --- GLOBAL MARKETS LOGIC ---
const GLOBAL_INDICES = [
    { symbol: '^NSEI', name: 'Nifty 50', country: 'India', flag: '🇮🇳', currency: 'INR' },
    { symbol: '^BSESN', name: 'BSE Sensex', country: 'India', flag: '🇮🇳', currency: 'INR' },
    { symbol: '^GSPC', name: 'S&P 500', country: 'United States', flag: '🇺🇸', currency: 'USD' },
    { symbol: '^IXIC', name: 'Nasdaq Composite', country: 'United States', flag: '🇺🇸', currency: 'USD' },
    { symbol: '^FTSE', name: 'FTSE 100', country: 'United Kingdom', flag: '🇬🇧', currency: 'GBP' },
    { symbol: '^N225', name: 'Nikkei 225', country: 'Japan', flag: '🇯🇵', currency: 'JPY' },
    { symbol: '^GDAXI', name: 'DAX Performance Index', country: 'Germany', flag: '🇩🇪', currency: 'EUR' },
    { symbol: '^FCHI', name: 'CAC 40', country: 'France', flag: '🇫🇷', currency: 'EUR' }
];

const GLOBAL_INDEX_STOCKS = {
    '^NSEI': [
        { symbol: 'RELIANCE.NS', name: 'Reliance Industries' },
        { symbol: 'TCS.NS', name: 'Tata Consultancy Services' },
        { symbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
        { symbol: 'ICICIBANK.NS', name: 'ICICI Bank' },
        { symbol: 'INFY.NS', name: 'Infosys' },
        { symbol: 'SBIN.NS', name: 'State Bank of India' },
        { symbol: 'ITC.NS', name: 'ITC Limited' },
        { symbol: 'LT.NS', name: 'Larsen & Toubro' }
    ],
    '^BSESN': [
        { symbol: 'RELIANCE.NS', name: 'Reliance Industries' },
        { symbol: 'TCS.NS', name: 'Tata Consultancy Services' },
        { symbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
        { symbol: 'ICICIBANK.NS', name: 'ICICI Bank' },
        { symbol: 'INFY.NS', name: 'Infosys' },
        { symbol: 'SBIN.NS', name: 'State Bank of India' },
        { symbol: 'ITC.NS', name: 'ITC Limited' },
        { symbol: 'LT.NS', name: 'Larsen & Toubro' }
    ],
    '^GSPC': [
        { symbol: 'AAPL', name: 'Apple Inc.' },
        { symbol: 'MSFT', name: 'Microsoft Corp.' },
        { symbol: 'NVDA', name: 'NVIDIA Corp.' },
        { symbol: 'GOOGL', name: 'Alphabet Inc.' },
        { symbol: 'AMZN', name: 'Amazon.com Inc.' },
        { symbol: 'META', name: 'Meta Platforms' },
        { symbol: 'TSLA', name: 'Tesla Inc.' },
        { symbol: 'JPM', name: 'JPMorgan Chase' }
    ],
    '^IXIC': [
        { symbol: 'AAPL', name: 'Apple Inc.' },
        { symbol: 'MSFT', name: 'Microsoft Corp.' },
        { symbol: 'NVDA', name: 'NVIDIA Corp.' },
        { symbol: 'GOOGL', name: 'Alphabet Inc.' },
        { symbol: 'AMZN', name: 'Amazon.com Inc.' },
        { symbol: 'META', name: 'Meta Platforms' },
        { symbol: 'TSLA', name: 'Tesla Inc.' },
        { symbol: 'AVGO', name: 'Broadcom Inc.' }
    ],
    '^FTSE': [
        { symbol: 'SHEL.L', name: 'Shell Plc' },
        { symbol: 'AZN.L', name: 'AstraZeneca Plc' },
        { symbol: 'HSBA.L', name: 'HSBC Holdings' },
        { symbol: 'ULVR.L', name: 'Unilever Plc' },
        { symbol: 'BP.L', name: 'BP Plc' },
        { symbol: 'GSK.L', name: 'GSK Plc' },
        { symbol: 'DGE.L', name: 'Diageo Plc' },
        { symbol: 'RIO.L', name: 'Rio Tinto' }
    ],
    '^N225': [
        { symbol: '7203.T', name: 'Toyota Motor' },
        { symbol: '9984.T', name: 'SoftBank Group' },
        { symbol: '6758.T', name: 'Sony Group' },
        { symbol: '6861.T', name: 'Keyence Corp' },
        { symbol: '8035.T', name: 'Tokyo Electron' },
        { symbol: '9432.T', name: 'NTT' },
        { symbol: '4502.T', name: 'Takeda Pharma' },
        { symbol: '8306.T', name: 'MUFG Financial' }
    ],
    '^GDAXI': [
        { symbol: 'SAP.DE', name: 'SAP SE' },
        { symbol: 'SIE.DE', name: 'Siemens AG' },
        { symbol: 'ALV.DE', name: 'Allianz SE' },
        { symbol: 'DTG.DE', name: 'Daimler Truck' },
        { symbol: 'VOW3.DE', name: 'Volkswagen' },
        { symbol: 'BAYN.DE', name: 'Bayer AG' },
        { symbol: 'BAS.DE', name: 'BASF SE' },
        { symbol: 'BMW.DE', name: 'BMW AG' }
    ],
    '^FCHI': [
        { symbol: 'MC.PA', name: 'LVMH Moet Hennessy' },
        { symbol: 'OR.PA', name: 'L\'Oreal SA' },
        { symbol: 'RMS.PA', name: 'Hermes International' },
        { symbol: 'TTE.PA', name: 'TotalEnergies SE' },
        { symbol: 'SAN.PA', name: 'Sanofi SA' },
        { symbol: 'SU.PA', name: 'Schneider Electric' },
        { symbol: 'AIR.PA', name: 'Airbus SE' },
        { symbol: 'BNP.PA', name: 'BNP Paribas' }
    ]
};

function formatIndexOrCurrency(price, symbol, currency) {
    if (symbol && symbol.startsWith('^')) {
        return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);
    }
    if (!currency) return formatINR(price);
    const upperCurr = currency.toUpperCase();
    if (upperCurr === 'INR') {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(price);
    } else if (upperCurr === 'USD') {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
    } else if (upperCurr === 'EUR') {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(price);
    } else if (upperCurr === 'GBP') {
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(price);
    } else if (upperCurr === 'GBp') {
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(price / 100);
    } else if (upperCurr === 'JPY') {
        return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(price);
    } else {
        return `${currency} ${price.toFixed(2)}`;
    }
}

async function loadGlobalMarkets() {
    const grid = document.getElementById('global-indices-grid');
    if (!grid) return;
    
    grid.innerHTML = '<div class="loader-small"></div>';
    
    const breakdownCard = document.getElementById('index-breakdown-card');
    if (breakdownCard) breakdownCard.classList.add('hidden');
    
    try {
        const symbols = GLOBAL_INDICES.map(idx => idx.symbol).join(',');
        const url = `/.netlify/functions/stock?action=top10&symbols=${symbols}&raw=1`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch global indices');
        const data = await response.json();
        
        grid.innerHTML = '';
        GLOBAL_INDICES.forEach(indexMeta => {
            const quote = data.find(q => q.symbol === indexMeta.symbol);
            if (!quote) return;
            
            const card = createIndexCard(indexMeta, quote);
            grid.appendChild(card);
        });
        
    } catch (e) {
        console.error("Error loading global markets:", e);
        grid.innerHTML = '<p style="color:var(--danger);font-size:0.9rem;padding:10px;text-align:center;">Failed to load world stock indices.</p>';
        showToast('Failed to load global market index feeds.', 'error');
    }
}

function createIndexCard(indexMeta, quote) {
    const div = document.createElement('div');
    div.className = 'index-card';
    const isUp = quote.percent_change >= 0;
    const sign = isUp ? '+' : '';
    
    div.innerHTML = `
        <div class="index-card-top">
            <span class="index-card-title">${indexMeta.name}</span>
            <span class="index-card-flag">${indexMeta.flag}</span>
        </div>
        <div class="index-card-bottom">
            <span class="index-card-points">${formatIndexOrCurrency(quote.price, indexMeta.symbol, quote.currency)}</span>
            <span class="index-card-change ${isUp ? 'up' : 'down'}">
                ${isUp ? '▲' : '▼'} ${sign}${quote.percent_change.toFixed(2)}%
            </span>
        </div>
    `;
    
    div.addEventListener('click', () => {
        document.querySelectorAll('.index-card').forEach(c => c.classList.remove('active'));
        div.classList.add('active');
        
        loadIndexBreakdown(indexMeta, quote);
    });
    
    return div;
}

async function loadIndexBreakdown(indexMeta, indexQuote) {
    const breakdownCard = document.getElementById('index-breakdown-card');
    const flagEl = document.getElementById('breakdown-country-flag');
    const nameEl = document.getElementById('breakdown-index-name');
    const symEl = document.getElementById('breakdown-index-symbol');
    const perfEl = document.getElementById('breakdown-index-performance');
    const gainersList = document.getElementById('index-gainers-list');
    const losersList = document.getElementById('index-losers-list');
    
    if (!breakdownCard || !gainersList || !losersList) return;
    
    flagEl.textContent = indexMeta.flag;
    nameEl.textContent = `${indexMeta.name} Companies`;
    symEl.textContent = indexMeta.symbol;
    
    const isUp = indexQuote.percent_change >= 0;
    const sign = isUp ? '+' : '';
    perfEl.textContent = `${isUp ? '▲' : '▼'} ${sign}${indexQuote.percent_change.toFixed(2)}%`;
    perfEl.className = isUp ? 'positive' : 'negative';
    
    gainersList.innerHTML = '<div class="loader-small"></div>';
    losersList.innerHTML = '<div class="loader-small"></div>';
    breakdownCard.classList.remove('hidden');
    
    breakdownCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    try {
        const stocks = GLOBAL_INDEX_STOCKS[indexMeta.symbol] || [];
        if (stocks.length === 0) {
            gainersList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:10px;text-align:center;">No stocks mapped.</p>';
            losersList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:10px;text-align:center;">No stocks mapped.</p>';
            return;
        }
        
        const symbols = stocks.map(s => s.symbol).join(',');
        const url = `/.netlify/functions/stock?action=top10&symbols=${symbols}&raw=1`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch index stock quotes');
        const data = await response.json();
        
        const gainers = data.filter(stock => stock.percent_change >= 0).sort((a, b) => b.percent_change - a.percent_change);
        const losers = data.filter(stock => stock.percent_change < 0).sort((a, b) => a.percent_change - b.percent_change);
        
        gainersList.innerHTML = '';
        if (gainers.length === 0) {
            gainersList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:12px 10px;text-align:center;">No gainers today.</p>';
        } else {
            gainers.forEach(stock => {
                gainersList.appendChild(createIndexStockRow(stock));
            });
        }
        
        losersList.innerHTML = '';
        if (losers.length === 0) {
            losersList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:12px 10px;text-align:center;">No losers today.</p>';
        } else {
            losers.forEach(stock => {
                losersList.appendChild(createIndexStockRow(stock));
            });
        }
        
    } catch (e) {
        console.error("Error loading index breakdown:", e);
        gainersList.innerHTML = '<p style="color:var(--danger);font-size:0.85rem;padding:10px;text-align:center;">Failed to load gainers.</p>';
        losersList.innerHTML = '<p style="color:var(--danger);font-size:0.85rem;padding:10px;text-align:center;">Failed to load losers.</p>';
    }
}

function createIndexStockRow(stock) {
    const div = document.createElement('div');
    div.className = 'mover-row';
    const isUp = stock.percent_change >= 0;
    const pctSign = isUp ? '+' : '';
    const symbolBase = stock.symbol.replace('.NS', '');
    
    div.innerHTML = `
        <div class="mover-info">
            <span class="mover-name" style="font-size:0.9rem;" title="${stock.shortName}">${stock.shortName}</span>
            <span class="mover-symbol" style="font-size:0.75rem;">${symbolBase}</span>
        </div>
        <div class="mover-trend">
            <span class="mover-price" style="font-size:0.9rem;">${formatIndexOrCurrency(stock.price, stock.symbol, stock.currency)}</span>
            <span class="mover-pct ${isUp ? 'up' : 'down'}" style="font-size:0.8rem;">
                ${isUp ? '▲' : '▼'} ${pctSign}${stock.percent_change.toFixed(2)}%
            </span>
        </div>
    `;
    
    div.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        const dashTab = document.querySelector('[data-target="view-dashboard"]');
        if (dashTab) dashTab.classList.add('active');
        
        document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
        const dashView = document.getElementById('view-dashboard');
        if (dashView) dashView.classList.add('active');
        
        symbolInput.value = stock.symbol;
        searchBtn.click();
    });
    
    return div;
}

// Bind modal close triggers
const modalCloseBtn = document.getElementById('industry-modal-close');
const modalOverlay = document.getElementById('industry-modal');
if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => modalOverlay.classList.add('hidden'));
}
if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) modalOverlay.classList.add('hidden');
    });
}

// Initialize application on DOM load
document.addEventListener('DOMContentLoaded', () => {
    const savedMode = sessionStorage.getItem('auth_mode');
    const savedUsername = sessionStorage.getItem('auth_username') || '';
    
    if (savedMode) {
        enterDashboard(savedMode, savedUsername);
    } else {
        showAuthScreen('selection');
    }
});
