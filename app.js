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

// Modal Elements
const knowMoreBtn = document.getElementById('know-more-btn');
const companyModal = document.getElementById('company-details-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');

const modalCompanyName = document.getElementById('modal-company-name');
const modalCompanyTicker = document.getElementById('modal-company-ticker');
const modalCompanyExchange = document.getElementById('modal-company-exchange');
const modalMarketCap = document.getElementById('modal-market-cap');
const modalPeRatio = document.getElementById('modal-pe-ratio');
const modalDivYield = document.getElementById('modal-div-yield');
const modalVolume = document.getElementById('modal-volume');
const modalDayRange = document.getElementById('modal-day-range');
const modal52wRange = document.getElementById('modal-52w-range');
const modalPrevClose = document.getElementById('modal-prev-close');
const modalCurrentPrice = document.getElementById('modal-current-price');
const modalCompanyDesc = document.getElementById('modal-company-desc');
const modalBookValue = document.getElementById('modal-book-value');
const modalFaceValue = document.getElementById('modal-face-value');
const modalRoce = document.getElementById('modal-roce');
const modalRoe = document.getElementById('modal-roe');
const modalCompanyOwner = document.getElementById('modal-company-owner');

// Top 10 Elements
const top10ListEl = document.getElementById('top10-list');

// Alert Elements
const alertPriceInput = document.getElementById('alert-price');
const alertConditionSelect = document.getElementById('alert-condition');
const alertEmailInput = document.getElementById('alert-email');
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
let activeStockDetails = null; // Stores current stock full metadata response

// Old TOP_10_SYMBOLS declaration removed to fix SyntaxError

// Initialize Chart.js with custom dark theme colors
if (typeof Chart !== 'undefined') {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Outfit', sans-serif";
}

function initChart() {
    if (typeof Chart === 'undefined') {
        console.error("Chart.js is not loaded.");
        return;
    }
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
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x',
                        threshold: 10
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.1
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x'
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false,
                        drawBorder: true
                    },
                    border: {
                        display: true,
                        color: 'rgba(255, 255, 255, 0.12)'
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: "'Outfit', sans-serif", size: 10 },
                        maxTicksLimit: 8
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: true
                    },
                    border: {
                        display: true,
                        color: 'rgba(255, 255, 255, 0.12)'
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: "'Outfit', sans-serif", size: 10 },
                        callback: function(value) {
                            if (value >= 1000) {
                                return '₹' + (value / 1000).toFixed(0) + 'K';
                            }
                            return '₹' + value;
                        }
                    }
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
    });

    // Reset zoom on double click
    ctx.canvas.addEventListener('dblclick', () => {
        if (stockChart && typeof stockChart.resetZoom === 'function') {
            stockChart.resetZoom();
        }
    });
}

// Format Currency
const formatINR = (num) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(num);

function getCurrencySymbol(currency) {
    if (!currency) return '₹';
    const upperCurr = currency.toUpperCase();
    if (upperCurr === 'INR') return '₹';
    if (upperCurr === 'USD') return '$';
    if (upperCurr === 'EUR') return '€';
    if (upperCurr === 'GBP' || upperCurr === 'GBP') return '£';
    if (upperCurr === 'JPY') return '¥';
    return currency;
}

function formatStockCurrency(price, currency = 'INR') {
    if (!currency) return formatINR(price);
    if (price === undefined || price === null || isNaN(price)) return 'N/A';
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

// Top 10 Symbols (Mixed Indian & US Stocks)
const TOP_10_SYMBOLS = [
    'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'INFY.NS', 
    'AAPL', 'TSLA', 'MSFT', 'NVDA', 'GOOGL'
];

let currentChartRange = '2y';

function filterChartDataByRange(labels, prices, range) {
    let filteredPrices = [...prices];
    let filteredLabels = [...labels];
    
    if (range === '1d' || range === '2y') {
        return { labels: filteredLabels, prices: filteredPrices };
    } else if (range === '1m') {
        const count = Math.min(filteredPrices.length, 20);
        return { labels: filteredLabels.slice(-count), prices: filteredPrices.slice(-count) };
    } else if (range === '3m') {
        const count = Math.min(filteredPrices.length, 60);
        return { labels: filteredLabels.slice(-count), prices: filteredPrices.slice(-count) };
    } else if (range === '6m') {
        const count = Math.min(filteredPrices.length, 120);
        return { labels: filteredLabels.slice(-count), prices: filteredPrices.slice(-count) };
    } else if (range === '1y') {
        const count = Math.min(filteredPrices.length, 250);
        return { labels: filteredLabels.slice(-count), prices: filteredPrices.slice(-count) };
    }
    return { labels: filteredLabels, prices: filteredPrices };
}

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
        const range = (currentChartRange === '1d') ? '1d' : '2y';
        const interval = (currentChartRange === '1d') ? '2m' : '1d';
        const url = `/.netlify/functions/stock?action=chart&symbol=${cleanSymbol}&range=${range}&interval=${interval}`;
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
        
        activeStockDetails = data;
        knowMoreBtn.classList.remove('hidden');
        updateDashboardUI(data.symbol.replace('.NS', ''), data.name, currentPrice, changeValue, changePercent, data.currency);
        
        if (!isBackgroundUpdate && !isInitialLoad) {
            symbolInput.value = '';
        }
        
        // Ensure the correct filter button is marked active
        document.querySelectorAll('.filter-btn').forEach(b => {
            if (b.getAttribute('data-range') === currentChartRange) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });
        
        if (data.prices && data.prices.length > 0) {
            const filteredData = filterChartDataByRange(data.labels, data.prices, currentChartRange);
            updateChart(filteredData.labels, filteredData.prices, changeValue >= 0, data.currency);
        }
        
        checkAlerts(currentPrice);
        
        currentStockData = data;
        if (typeof updateWatchlistButtonState === 'function') {
            updateWatchlistButtonState(data.symbol);
        }
        
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
                    <span class="top10-price">${symbolBase} • ${formatStockCurrency(price, stockData.currency)}</span>
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

function updateDashboardUI(symbol, name, price, changeVal, changePct, currency = 'INR') {
    stockTickerEl.textContent = symbol;
    stockNameEl.textContent = name || symbol;
    
    currentPriceEl.textContent = formatStockCurrency(price, currency);
    
    const isPositive = changeVal >= 0;
    const sign = isPositive ? '+' : '';
    const formattedChange = formatStockCurrency(Math.abs(changeVal), currency);
    const sym = getCurrencySymbol(currency);
    changePercentEl.textContent = `${sign}${formattedChange.replace(sym, sym + ' ')} (${sign}${changePct.toFixed(2)}%)`;
    
    if (isPositive) {
        priceChangeEl.className = 'price-change positive';
        trendIconEl.innerHTML = `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>`;
    } else {
        priceChangeEl.className = 'price-change negative';
        trendIconEl.innerHTML = `<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline>`;
    }
    
    lastUpdatedEl.textContent = `Last updated: ${new Date().toLocaleTimeString('en-IN')}`;
}

function updateChart(labels, data, isPositive, currency = 'INR') {
    if (!stockChart) return;
    if (typeof stockChart.resetZoom === 'function') {
        stockChart.resetZoom('none');
    }
    
    const symbolChar = getCurrencySymbol(currency);
    
    stockChart.data.labels = labels;
    stockChart.data.datasets[0].data = data;
    stockChart.data.datasets[0].label = `Price (${symbolChar})`;
    
    // Update tooltip callback
    stockChart.options.plugins.tooltip.callbacks.label = function(context) {
        return `${symbolChar} ${context.parsed.y.toFixed(2)}`;
    };
    
    // Update y-axis scale callback
    stockChart.options.scales.y.ticks.callback = function(value) {
        return `${symbolChar} ${value}`;
    };
    
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
        targetEl.textContent = formatStockCurrency(prediction.predictedPrice, currentStockData ? currentStockData.currency : 'INR');
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
        } else if (targetId === 'view-trade') {
            populateTradeForm();
            updateTradeUI();
        }
    });
});


// Alert System
function setAlert() {
    const priceStr = alertPriceInput.value;
    const condition = alertConditionSelect.value;
    const email = alertEmailInput.value.trim();
    
    if (!priceStr || isNaN(priceStr)) { showToast('Please enter a valid price.', 'error'); return; }
    if (!email) { showToast('Please enter an email address for notifications.', 'error'); return; }
    
    // Simple email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address (e.g. user@example.com).', 'error');
        return;
    }
    
    const targetPrice = parseFloat(priceStr);
    activeAlert = { price: targetPrice, condition, email, currency: currentStockData ? currentStockData.currency : 'INR' };
    activeAlertText.innerHTML = `Alert when price goes <strong>${condition}</strong> ${formatStockCurrency(targetPrice, activeAlert.currency)} (Email to: <strong>${email}</strong>)`;
    activeAlertContainer.classList.remove('hidden');
    alertPriceInput.value = '';
    alertEmailInput.value = '';
    showToast('Alert created successfully with email notifications!', 'success');
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
        const msg = `🎯 TARGET HIT: ${symbolStr} is now ${formatStockCurrency(currentPrice, activeAlert.currency || 'INR')}`;
        
        // App Notification Toast
        showToast(msg, 'alert');
        
        // Email Notification Trigger
        const email = activeAlert.email;
        console.log(`[Email Gateway] Triggering alert Email to ${email}: "${msg}"`);
        showToast(`📧 Sending email alert to ${email}...`, 'success');
        const emailUrl = `/.netlify/functions/stock?action=send_email&to=${encodeURIComponent(email)}&subject=${encodeURIComponent('Bull Trend AI Price Alert')}&message=${encodeURIComponent(msg)}`;
        fetch(emailUrl)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    if (data.simulated) {
                        showToast(`📧 Email alert simulated & logged for ${email}!`, 'success');
                        showToast(`⚠️ Server SMTP is not configured. Real email NOT sent.`, 'warning');
                    } else {
                        showToast(`📧 Email alert sent successfully to ${email}!`, 'success');
                    }
                } else {
                    console.error('Email server error:', data.error);
                    showToast(`⚠️ Email alert failed: ${data.error}`, 'error');
                }
            })
            .catch(err => {
                console.error('Failed to trigger email notification:', err);
                showToast(`📧 Email simulated & logged locally for ${email}.`, 'success');
                showToast(`⚠️ Server is offline/unreachable. Real email NOT sent.`, 'warning');
            });
        
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator(); osc.connect(ctx.destination);
            osc.frequency.setValueAtTime(880, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.1);
            setTimeout(() => {
                const osc2 = ctx.createOscillator(); osc2.connect(ctx.destination);
                osc2.frequency.setValueAtTime(1046.50, ctx.currentTime); osc2.start(); osc2.stop(ctx.currentTime + 0.2);
            }, 150);
        } catch (e) {}
        
        if (typeof addAlertHistoryRecord === 'function') {
            addAlertHistoryRecord(symbolStr, currentPrice, activeAlert.condition, activeAlert.price);
        }
        
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
    else if (type === 'warning') icon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
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

const POPULAR_STOCKS = [
    // A
    { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
    { symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ' },
    { symbol: 'ADBE', name: 'Adobe Inc.', exchange: 'NASDAQ' },
    { symbol: 'AMD', name: 'Advanced Micro Devices, Inc.', exchange: 'NASDAQ' },
    { symbol: 'ADANIPORTS.NS', name: 'Adani Ports & SEZ Ltd', exchange: 'NSE' },
    { symbol: 'ASIANPAINT.NS', name: 'Asian Paints Ltd', exchange: 'NSE' },
    { symbol: 'AXISBANK.NS', name: 'Axis Bank Ltd', exchange: 'NSE' },
    // B
    { symbol: 'BA', name: 'Boeing Company', exchange: 'NYSE' },
    { symbol: 'BABA', name: 'Alibaba Group Holding Ltd', exchange: 'NYSE' },
    { symbol: 'BAC', name: 'Bank of America Corp', exchange: 'NYSE' },
    { symbol: 'BAJAJ-AUTO.NS', name: 'Bajaj Auto Ltd', exchange: 'NSE' },
    { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel Ltd', exchange: 'NSE' },
    { symbol: 'BPCL.NS', name: 'Bharat Petroleum Corp Ltd', exchange: 'NSE' },
    // C
    { symbol: 'C', name: 'Citigroup Inc.', exchange: 'NYSE' },
    { symbol: 'CSCO', name: 'Cisco Systems, Inc.', exchange: 'NASDAQ' },
    { symbol: 'CAT', name: 'Caterpillar Inc.', exchange: 'NYSE' },
    { symbol: 'CVX', name: 'Chevron Corporation', exchange: 'NYSE' },
    { symbol: 'KO', name: 'Coca-Cola Company', exchange: 'NYSE' },
    { symbol: 'COALINDIA.NS', name: 'Coal India Ltd', exchange: 'NSE' },
    { symbol: 'CIPLA.NS', name: 'Cipla Ltd', exchange: 'NSE' },
    { symbol: 'COLPAL.NS', name: 'Colgate-Palmolive (India) Ltd', exchange: 'NSE' },
    // D
    { symbol: 'DIS', name: 'Walt Disney Company', exchange: 'NYSE' },
    { symbol: 'DHR', name: 'Danaher Corporation', exchange: 'NYSE' },
    { symbol: 'DIVISLAB.NS', name: 'Divi\'s Laboratories Ltd', exchange: 'NSE' },
    { symbol: 'DRREDDY.NS', name: 'Dr. Reddy\'s Laboratories Ltd', exchange: 'NSE' },
    { symbol: 'DE', name: 'Deere & Company', exchange: 'NYSE' },
    // E
    { symbol: 'EXC', name: 'Exelon Corporation', exchange: 'NASDAQ' },
    { symbol: 'EICHERMOT.NS', name: 'Eicher Motors Ltd', exchange: 'NSE' },
    { symbol: 'ENPH', name: 'Enphase Energy, Inc.', exchange: 'NASDAQ' },
    { symbol: 'EL', name: 'Estee Lauder Companies Inc.', exchange: 'NYSE' },
    // F
    { symbol: 'F', name: 'Ford Motor Company', exchange: 'NYSE' },
    { symbol: 'FDX', name: 'FedEx Corporation', exchange: 'NYSE' },
    { symbol: 'FCX', name: 'Freeport-McMoRan Inc.', exchange: 'NYSE' },
    // G
    { symbol: 'GOOGL', name: 'Alphabet Inc. (Google)', exchange: 'NASDAQ' },
    { symbol: 'GE', name: 'General Electric Company', exchange: 'NYSE' },
    { symbol: 'GRASIM.NS', name: 'Grasim Industries Ltd', exchange: 'NSE' },
    { symbol: 'GILD', name: 'Gilead Sciences, Inc.', exchange: 'NASDAQ' },
    { symbol: 'GS', name: 'Goldman Sachs Group, Inc.', exchange: 'NYSE' },
    // H
    { symbol: 'HDFCBANK.NS', name: 'HDFC Bank Ltd', exchange: 'NSE' },
    { symbol: 'HINDALCO.NS', name: 'Hindalco Industries Ltd', exchange: 'NSE' },
    { symbol: 'HINDUNILVR.NS', name: 'Hindustan Unilever Ltd', exchange: 'NSE' },
    { symbol: 'HON', name: 'Honeywell International Inc.', exchange: 'NASDAQ' },
    { symbol: 'HPQ', name: 'HP Inc.', exchange: 'NYSE' },
    { symbol: 'HD', name: 'Home Depot, Inc.', exchange: 'NYSE' },
    // I
    { symbol: 'INFY.NS', name: 'Infosys Ltd', exchange: 'NSE' },
    { symbol: 'ICICIBANK.NS', name: 'ICICI Bank Ltd', exchange: 'NSE' },
    { symbol: 'IBM', name: 'International Business Machines Corp', exchange: 'NYSE' },
    { symbol: 'INTC', name: 'Intel Corporation', exchange: 'NASDAQ' },
    { symbol: 'INDUSINDBK.NS', name: 'IndusInd Bank Ltd', exchange: 'NSE' },
    { symbol: 'ITC.NS', name: 'ITC Ltd', exchange: 'NSE' },
    { symbol: 'IOC.NS', name: 'Indian Oil Corporation Ltd', exchange: 'NSE' },
    // J
    { symbol: 'JNJ', name: 'Johnson & Johnson', exchange: 'NYSE' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE' },
    { symbol: 'JSWSTEEL.NS', name: 'JSW Steel Ltd', exchange: 'NSE' },
    { symbol: 'JD', name: 'JD.com, Inc.', exchange: 'NASDAQ' },
    // K
    { symbol: 'KOTAKBANK.NS', name: 'Kotak Mahindra Bank Ltd', exchange: 'NSE' },
    { symbol: 'K', name: 'Kellogg Company', exchange: 'NYSE' },
    { symbol: 'KEY', name: 'KeyCorp', exchange: 'NYSE' },
    { symbol: 'KMB', name: 'Kimberly-Clark Corporation', exchange: 'NYSE' },
    // L
    { symbol: 'LT.NS', name: 'Larsen & Toubro Ltd', exchange: 'NSE' },
    { symbol: 'LTIM.NS', name: 'LTIMindtree Ltd', exchange: 'NSE' },
    { symbol: 'LLY', name: 'Eli Lilly and Company', exchange: 'NYSE' },
    { symbol: 'LMT', name: 'Lockheed Martin Corporation', exchange: 'NYSE' },
    { symbol: 'LOW', name: 'Lowe\'s Companies, Inc.', exchange: 'NYSE' },
    // M
    { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
    { symbol: 'META', name: 'Meta Platforms, Inc.', exchange: 'NASDAQ' },
    { symbol: 'MRF.NS', name: 'MRF Ltd', exchange: 'NSE' },
    { symbol: 'MARUTI.NS', name: 'Maruti Suzuki India Ltd', exchange: 'NSE' },
    { symbol: 'MCD', name: 'McDonald\'s Corporation', exchange: 'NYSE' },
    { symbol: 'MRK', name: 'Merck & Co., Inc.', exchange: 'NYSE' },
    // N
    { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
    { symbol: 'NFLX', name: 'Netflix, Inc.', exchange: 'NASDAQ' },
    { symbol: 'NKE', name: 'NIKE, Inc.', exchange: 'NYSE' },
    { symbol: 'NESTLEIND.NS', name: 'Nestle India Ltd', exchange: 'NSE' },
    { symbol: 'NTPC.NS', name: 'NTPC Ltd', exchange: 'NSE' },
    { symbol: 'NARMADA.BO', name: 'Narmada Agrobase Limited', exchange: 'BSE' },
    // O
    { symbol: 'ONGC.NS', name: 'Oil & Natural Gas Corp Ltd', exchange: 'NSE' },
    { symbol: 'ORCL', name: 'Oracle Corporation', exchange: 'NYSE' },
    { symbol: 'ODFL', name: 'Old Dominion Freight Line', exchange: 'NASDAQ' },
    { symbol: 'O', name: 'Realty Income Corporation', exchange: 'NYSE' },
    // P
    { symbol: 'PFE', name: 'Pfizer Inc.', exchange: 'NYSE' },
    { symbol: 'PG', name: 'Procter & Gamble Co.', exchange: 'NYSE' },
    { symbol: 'PEP', name: 'PepsiCo, Inc.', exchange: 'NASDAQ' },
    { symbol: 'PYPL', name: 'PayPal Holdings, Inc.', exchange: 'NASDAQ' },
    { symbol: 'POWERGRID.NS', name: 'Power Grid Corp of India Ltd', exchange: 'NSE' },
    // Q
    { symbol: 'QCOM', name: 'Qualcomm Inc.', exchange: 'NASDAQ' },
    { symbol: 'QSR', name: 'Restaurant Brands International', exchange: 'NYSE' },
    // R
    { symbol: 'RELIANCE.NS', name: 'Reliance Industries Ltd', exchange: 'NSE' },
    { symbol: 'RTX', name: 'Raytheon Technologies Corp', exchange: 'NYSE' },
    // S
    { symbol: 'SUNPHARMA.NS', name: 'Sun Pharmaceutical Industries Ltd', exchange: 'NSE' },
    { symbol: 'SBIN.NS', name: 'State Bank of India', exchange: 'NSE' },
    { symbol: 'SBUX', name: 'Starbucks Corporation', exchange: 'NASDAQ' },
    { symbol: 'SONY', name: 'Sony Group Corporation', exchange: 'NYSE' },
    { symbol: 'CRM', name: 'Salesforce, Inc.', exchange: 'NYSE' },
    // T
    { symbol: 'TCS.NS', name: 'Tata Consultancy Services Ltd', exchange: 'NSE' },
    { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ' },
    { symbol: 'TATAMOTORS.NS', name: 'Tata Motors Ltd', exchange: 'NSE' },
    { symbol: 'TECHM.NS', name: 'Tech Mahindra Ltd', exchange: 'NSE' },
    { symbol: 'TITAN.NS', name: 'Titan Company Ltd', exchange: 'NSE' },
    { symbol: 'TATASTEEL.NS', name: 'Tata Steel Ltd', exchange: 'NSE' },
    { symbol: 'TXN', name: 'Texas Instruments Inc.', exchange: 'NASDAQ' },
    // U
    { symbol: 'ULTRACEMCO.NS', name: 'UltraTech Cement Ltd', exchange: 'NSE' },
    { symbol: 'UPL.NS', name: 'UPL Ltd', exchange: 'NSE' },
    { symbol: 'UNH', name: 'UnitedHealth Group Inc.', exchange: 'NYSE' },
    { symbol: 'UPS', name: 'United Parcel Service, Inc.', exchange: 'NYSE' },
    { symbol: 'UBER', name: 'Uber Technologies, Inc.', exchange: 'NYSE' },
    // W
    { symbol: 'WIPRO.NS', name: 'Wipro Ltd', exchange: 'NSE' },
    { symbol: 'WMT', name: 'Walmart Inc.', exchange: 'NYSE' },
    { symbol: 'WFC', name: 'Wells Fargo & Company', exchange: 'NYSE' },
    // X
    { symbol: 'XOM', name: 'Exxon Mobil Corporation', exchange: 'NYSE' },
    { symbol: 'XPEV', name: 'XPeng Inc.', exchange: 'NYSE' },
    // Y
    { symbol: 'YUM', name: 'Yum! Brands, Inc.', exchange: 'NYSE' },
    // Z
    { symbol: 'ZTS', name: 'Zoetis Inc.', exchange: 'NYSE' },
    { symbol: 'ZEEL.NS', name: 'Zee Entertainment Enterprises Ltd', exchange: 'NSE' }
];

const SEARCH_CACHE = {};

function renderSuggestions(results) {
    if (results && results.length > 0) {
        suggestionsBox.innerHTML = '';
        results.forEach((item) => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            
            const name = item.name.length > 25 ? item.name.slice(0, 22) + '...' : item.name;
            const cleanSymbol = item.symbol.replace('.NS', '').replace('.BO', '');
            
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
}

symbolInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    activeSuggestionIndex = -1;
    const query = symbolInput.value.trim().toLowerCase();
    
    if (query.length < 1) {
        suggestionsBox.classList.add('hidden');
        return;
    }
    
    // 1. Get instant matches from our local popular stocks database
    let localMatches = [];
    if (query.length === 1) {
        // For single-letter queries, ONLY return matches where the symbol or the company name starts with the letter.
        // This prevents loose inner-word matching of common terms (e.g. 'c' matching 'Microsoft Corporation' because of 'Corporation').
        localMatches = POPULAR_STOCKS.filter(item => 
            item.symbol.toLowerCase().startsWith(query) || 
            item.name.toLowerCase().startsWith(query)
        );
    } else {
        // For longer queries, rank matches: StartsWith Symbol -> StartsWith Name/Word -> Contains
        const startsWithSymbol = [];
        const startsWithName = [];
        const containsMatches = [];
        
        POPULAR_STOCKS.forEach(item => {
            const sym = item.symbol.toLowerCase();
            const name = item.name.toLowerCase();
            
            if (sym.startsWith(query)) {
                startsWithSymbol.push(item);
            } else if (name.startsWith(query) || name.split(' ').some(word => word.startsWith(query))) {
                startsWithName.push(item);
            } else if (sym.includes(query) || name.includes(query)) {
                containsMatches.push(item);
            }
        });
        
        localMatches = [...startsWithSymbol, ...startsWithName, ...containsMatches];
    }
    
    // Render local matches instantly to eliminate any lag!
    renderSuggestions(localMatches.slice(0, 10));
    
    // 2. Fetch from backend API with short debounce and client caching
    searchTimeout = setTimeout(async () => {
        if (query.length < 1) return;
        
        try {
            let results;
            if (SEARCH_CACHE[query]) {
                results = SEARCH_CACHE[query];
            } else {
                const res = await fetch(`/.netlify/functions/stock?action=search&q=${encodeURIComponent(query)}`);
                results = await res.json();
                SEARCH_CACHE[query] = results;
            }
            
            // Merge local matches and backend results, removing duplicates
            const merged = [...localMatches];
            const seenSymbols = new Set(merged.map(item => item.symbol.toLowerCase()));
            
            // Clean/filter backend results to follow the same relevance rules
            results.forEach(item => {
                const sym = item.symbol.toLowerCase();
                const name = item.name.toLowerCase();
                
                // For single-letter queries, strictly enforce starting with the letter
                if (query.length === 1) {
                    const matchesRule = sym.startsWith(query) || 
                                        name.startsWith(query) || 
                                        name.split(' ').some(word => word.startsWith(query));
                    if (!matchesRule) return;
                }
                
                if (!seenSymbols.has(sym)) {
                    merged.push(item);
                    seenSymbols.add(sym);
                }
            });
            
            // Render the final combined list (up to 10 items)
            renderSuggestions(merged.slice(0, 10));
        } catch(e) {
            console.error("Suggestions error:", e);
        }
    }, 350); // Optimized to 350ms debounce to filter out intermediate keystrokes
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
        currentChartRange = '2y'; // Reset to default 2y range on new search
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

// Chart range filtering
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const range = e.target.getAttribute('data-range');
        
        // Remove active class from all filters and add to this one
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        const oldRange = currentChartRange;
        currentChartRange = range;
        
        // If switching to/from 1d, we MUST fetch fresh data since intraday and historical data are different API payloads
        const needsFetch = (oldRange === '1d' || range === '1d');
        
        if (needsFetch) {
            fetchStockData(currentSymbol);
        } else {
            // Otherwise, we can just slice the existing currentStockData on the client side instantly
            if (!currentStockData || !currentStockData.prices || currentStockData.prices.length === 0) return;
            const filteredData = filterChartDataByRange(currentStockData.labels, currentStockData.prices, currentChartRange);
            const changeValue = currentPrice - previousClose;
            updateChart(filteredData.labels, filteredData.prices, changeValue >= 0, currentStockData.currency);
        }
    });
});

// Chart expand/zoom toggle
const chartCard = document.querySelector('.chart-card');
const expandBtn = document.getElementById('chart-expand-btn');
if (expandBtn && chartCard) {
    expandBtn.addEventListener('click', () => {
        const isMaximized = chartCard.classList.toggle('maximized');
        const iconSvg = document.getElementById('expand-icon');
        
        if (isMaximized) {
            // Block page scroll
            document.body.style.overflow = 'hidden';
            // Set minimize SVG icon
            iconSvg.innerHTML = `
                <polyline points="4 14 10 14 10 20"></polyline>
                <polyline points="20 10 14 10 14 4"></polyline>
                <line x1="14" y1="10" x2="21" y2="3"></line>
                <line x1="10" y1="14" x2="3" y2="21"></line>
            `;
            expandBtn.title = "Minimize Chart";
        } else {
            // Restore page scroll
            document.body.style.overflow = '';
            // Restore expand SVG icon
            iconSvg.innerHTML = `
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
            `;
            expandBtn.title = "Expand Chart";
        }
        
        // Allow CSS transitions/layout flow recalculations to complete before resizing
        setTimeout(() => {
            if (stockChart) {
                stockChart.resize();
                stockChart.update();
            }
            window.dispatchEvent(new Event('resize'));
        }, 150);
    });
}

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

function enterDashboard(mode, name = '', username = '') {
    authOverlay.classList.add('hidden');
    
    headerAuthButtons.classList.add('hidden');
    headerUserProfile.classList.remove('hidden');
    
    // Perform initial profile UI update
    updateProfileUI();
    
    if (!appInitialized) {
        appInitialized = true;
        initChart();
        currentChartRange = '2y'; // Set default 2y range on initial load
        fetchStockData(currentSymbol, false, true);
        loadTop10();
        
        // Initialize Watchlist
        loadWatchlist();
        
        // Watchlist toggle handler
        const addToWatchlistBtn = document.getElementById('add-to-watchlist-btn');
        if (addToWatchlistBtn) {
            addToWatchlistBtn.addEventListener('click', () => {
                if (currentStockData && currentStockData.symbol) {
                    toggleWatchlist(currentStockData.symbol);
                }
            });
        }
        
        if (updateInterval) clearInterval(updateInterval);
        updateInterval = setInterval(() => {
            fetchStockData(currentSymbol, true);
            loadWatchlist(); // Auto-refresh watchlist prices in the background
        }, 5000);
    }
}

function handleLogin() {
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value;
    
    if (!username) { showToast('Please enter your username or email.', 'error'); return; }
    if (password.length < 4) { showToast('Password must be at least 4 characters long.', 'error'); return; }
    
    sessionStorage.setItem('auth_mode', 'logged_in');
    sessionStorage.setItem('auth_name', username);
    sessionStorage.setItem('auth_username', username);
    showToast(`Welcome back, ${username}!`, 'success');
    
    loginUsernameInput.value = '';
    loginPasswordInput.value = '';
    
    enterDashboard('logged_in', username, username);
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
    sessionStorage.setItem('auth_name', name);
    sessionStorage.setItem('auth_username', username);
    showToast('Account created successfully!', 'success');
    
    signupNameInput.value = '';
    signupUsernameInput.value = '';
    signupPasswordInput.value = '';
    signupConfirmPasswordInput.value = '';
    
    enterDashboard('logged_in', name, username);
}

function handleGuestMode() {
    sessionStorage.setItem('auth_mode', 'guest');
    sessionStorage.removeItem('auth_name');
    sessionStorage.removeItem('auth_username');
    showToast('Continuing as guest. Log in anytime to save settings.', 'success');
    enterDashboard('guest');
}

function handleLogout() {
    sessionStorage.removeItem('auth_mode');
    sessionStorage.removeItem('auth_name');
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

// Modal & Company Database Helpers
const companyDatabase = {
    'RELIANCE.NS': {
        shares: 13530000000,
        pe: 23.4,
        yield: '0.46%',
        book: 668,
        face: 10.0,
        roce: '10.3%',
        roe: '8.91%',
        owner: 'Mukesh Ambani (Chairman & MD)',
        desc: "Reliance was founded by Dhirubhai Ambani and is now promoted and managed by his elder son, Mukesh Dhirubhai Ambani. Ambani's family has about 50% shareholding in the conglomerate. It is India's largest private sector enterprise, spanning energy, petrochemicals, natural gas, retail, telecommunications, and media."
    },
    'TCS.NS': {
        shares: 3618000000,
        pe: 30.1,
        yield: '1.20%',
        book: 282,
        face: 1.0,
        roce: '62.5%',
        roe: '50.8%',
        owner: 'N. Chandrasekaran (Chairman) / K. Krithivasan (CEO)',
        desc: "Tata Consultancy Services Limited (TCS) is a leading global IT services, consulting, and business solutions organization. Part of the Tata Group, India's largest multinational business group, TCS has over 600,000 consultants worldwide."
    },
    'HDFCBANK.NS': {
        shares: 7600000000,
        pe: 18.5,
        yield: '1.10%',
        book: 560,
        face: 1.0,
        roce: '8.2%',
        roe: '15.4%',
        owner: 'Sashidhar Jagdishan (CEO & MD)',
        desc: "HDFC Bank Limited is India's leading private sector bank and was nearly the first to receive an 'in principle' approval from the RBI to set up a private bank. It is headquartered in Mumbai and offers a range of financial services."
    },
    'ICICIBANK.NS': {
        shares: 7010000000,
        pe: 17.8,
        yield: '0.70%',
        book: 320,
        face: 2.0,
        roce: '7.8%',
        roe: '18.5%',
        owner: 'Sandeep Bakhshi (CEO & MD)',
        desc: "ICICI Bank Limited is a leading private sector bank in India, offering commercial banking, investment banking, life/non-life insurance, venture capital, and asset management services through various channels and subsidiaries."
    },
    'INFY.NS': {
        shares: 4150000000,
        pe: 24.2,
        yield: '2.40%',
        book: 210,
        face: 5.0,
        roce: '40.5%',
        roe: '32.1%',
        owner: 'Salil Parekh (CEO) / N. R. Narayana Murthy (Founder)',
        desc: "Infosys Limited is a global leader in next-generation digital services and consulting. It enables clients in more than 56 countries to navigate their digital transformation, founded in Pune and headquartered in Bengaluru."
    },
    'AAPL': {
        shares: 15330000000,
        pe: 31.2,
        yield: '0.52%',
        book: 400.8,
        face: 0.08,
        roce: '58.2%',
        roe: '150%',
        owner: 'Tim Cook (CEO) / Steve Jobs (Founder)',
        desc: "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories, and sells a variety of related services globally. Apple is the world's largest technology company by revenue."
    },
    'TSLA': {
        shares: 3189000000,
        pe: 58.7,
        yield: 'N/A',
        book: 1711.5,
        face: 0.08,
        roce: '12.5%',
        roe: '14.2%',
        owner: 'Elon Musk (CEO / Technoking)',
        desc: "Tesla, Inc. designs, develops, manufactures, leases, and sells electric vehicles, and energy generation and storage systems in the United States, China, and internationally, operating under automotive and energy segments."
    },
    'MSFT': {
        shares: 7432000000,
        pe: 35.4,
        yield: '0.72%',
        book: 2212.8,
        face: 0.08,
        roce: '28.5%',
        roe: '38.2%',
        owner: 'Satya Nadella (Chairman & CEO) / Bill Gates (Founder)',
        desc: "Microsoft Corporation develops, licenses, and supports software, services, devices, and solutions worldwide, well known for its Windows operating system, Microsoft 365, Azure, and Xbox gaming."
    },
    'NVDA': {
        shares: 24600000000,
        pe: 68.2,
        yield: '0.02%',
        book: 310.5,
        face: 0.08,
        roce: '48.2%',
        roe: '52.1%',
        owner: 'Jensen Huang (Founder & CEO)',
        desc: "NVIDIA Corporation focuses on personal computer graphics, graphics processing units, and also on artificial intelligence solutions, headquartered in Santa Clara, California."
    },
    'GOOGL': {
        shares: 12000000000,
        pe: 26.8,
        yield: '0.45%',
        book: 1410.8,
        face: 0.08,
        roce: '20.3%',
        roe: '22.8%',
        owner: 'Sundar Pichai (CEO) / Larry Page & Sergey Brin (Founders)',
        desc: "Alphabet Inc. offers Google Services, Google Cloud, and Other Bets. Its Google Services segment includes products and services such as Ads, Android, Chrome, Hardware, Gmail, Google Drive, Google Maps, Google Play, Search, and YouTube."
    }
};

function getCompanyDetails(symbol, name) {
    const key = symbol.toUpperCase();
    
    if (companyDatabase[key]) {
        return companyDatabase[key];
    }
    
    const cleanKey = key.split('.')[0];
    const baseSymbols = Object.keys(companyDatabase).map(k => k.split('.')[0]);
    const idx = baseSymbols.indexOf(cleanKey);
    if (idx !== -1) {
        return companyDatabase[Object.keys(companyDatabase)[idx]];
    }
    
    const isIndian = key.includes('.NS') || key.includes('.BO') || ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'].includes(cleanKey);
    const exchange = isIndian ? 'NSE' : 'US Market';

    let hash = 0;
    for (let i = 0; i < cleanKey.length; i++) {
        hash = cleanKey.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);
    
    const simulatedPE = Number(((hash % 30) + 12).toFixed(1));
    const yields = ['N/A', '0.40%', '0.85%', '1.20%', '1.50%', '2.10%'];
    const simulatedYield = yields[hash % yields.length];
    const simulatedShares = ((hash % 15) + 1) * 500000000;
    
    const simulatedBook = ((hash % 400) + 50);
    const simulatedFace = isIndian ? [1.0, 2.0, 5.0, 10.0][hash % 4] : 0.08;
    const simulatedROCE = ((hash % 25) + 5).toFixed(1) + '%';
    const simulatedROE = ((hash % 20) + 4).toFixed(1) + '%';
    
    const owners = ['Promoter Group', 'Institutional Founders', 'Board of Directors', 'Key Executives'];
    const simulatedOwner = owners[hash % owners.length];
    
    const simulatedDesc = `${name || cleanKey} is a publicly traded enterprise listed on the ${exchange}. The firm focuses on operations in its sector, contributing to global markets, and is tracked as part of our stock price monitoring index.`;
    
    return {
        shares: simulatedShares,
        pe: simulatedPE,
        yield: simulatedYield,
        book: simulatedBook,
        face: simulatedFace,
        roce: simulatedROCE,
        roe: simulatedROE,
        owner: simulatedOwner,
        desc: simulatedDesc
    };
}

function formatMarketCap(val, currency = 'INR') {
    if (!val) return '--';
    const upperCurr = currency.toUpperCase();
    if (upperCurr === 'INR') {
        const croreVal = val / 10000000;
        if (croreVal >= 100000) {
            return `₹ ${(croreVal / 100000).toFixed(2)} Lakh Cr`;
        } else {
            return `₹ ${Math.round(croreVal).toLocaleString('en-IN')} Cr`;
        }
    } else {
        const symbolChar = getCurrencySymbol(currency);
        if (val >= 1000000000000) {
            return `${symbolChar}${(val / 1000000000000).toFixed(2)} Trillion`;
        } else if (val >= 1000000000) {
            return `${symbolChar}${(val / 1000000000).toFixed(2)} Billion`;
        } else if (val >= 1000000) {
            return `${symbolChar}${(val / 1000000).toFixed(2)} Million`;
        } else {
            return `${symbolChar}${val.toLocaleString('en-US')}`;
        }
    }
}

function showCompanyDetailsModal() {
    if (!activeStockDetails) return;
    
    const data = activeStockDetails;
    const details = getCompanyDetails(data.symbol, data.name);
    const isIndian = data.symbol.includes('.NS') || data.symbol.includes('.BO');

    modalCompanyName.textContent = data.name || data.symbol.split('.')[0];
    modalCompanyTicker.textContent = data.symbol;
    modalCompanyExchange.textContent = isIndian ? 'NSE' : (data.symbol.includes('.BO') ? 'BSE' : 'NASDAQ / NYSE');
    
    // 1. Market Cap (live from backend yfinance OR computed from fallback)
    const marketCapVal = data.marketCap !== undefined && data.marketCap !== null ? data.marketCap : (details.shares * data.price);
    modalMarketCap.textContent = formatMarketCap(marketCapVal, data.currency);
    
    // 2. PE Ratio
    modalPeRatio.textContent = data.peRatio !== undefined && data.peRatio !== null ? Number(data.peRatio).toFixed(2) : details.pe;
    
    // 3. Dividend Yield
    modalDivYield.textContent = data.dividendYield !== undefined && data.dividendYield !== null ? data.dividendYield : details.yield;
    
    // 4. Volume
    modalVolume.textContent = data.regularMarketVolume ? data.regularMarketVolume.toLocaleString(data.currency === 'INR' ? 'en-IN' : 'en-US') : 'N/A';
    
    // 5. Day Range
    const dayLowVal = data.regularMarketDayLow ? formatStockCurrency(data.regularMarketDayLow, data.currency) : 'N/A';
    const dayHighVal = data.regularMarketDayHigh ? formatStockCurrency(data.regularMarketDayHigh, data.currency) : 'N/A';
    modalDayRange.textContent = (data.regularMarketDayLow && data.regularMarketDayHigh) ? `${dayLowVal} - ${dayHighVal}` : 'N/A';
    
    // 6. 52-Week Range
    const low52Val = data.fiftyTwoWeekLow ? formatStockCurrency(data.fiftyTwoWeekLow, data.currency) : 'N/A';
    const high52Val = data.fiftyTwoWeekHigh ? formatStockCurrency(data.fiftyTwoWeekHigh, data.currency) : 'N/A';
    modal52wRange.textContent = (data.fiftyTwoWeekLow && data.fiftyTwoWeekHigh) ? `${low52Val} - ${high52Val}` : 'N/A';
    
    modalPrevClose.textContent = data.prevClose ? formatStockCurrency(data.prevClose, data.currency) : 'N/A';
    modalCurrentPrice.textContent = data.price ? formatStockCurrency(data.price, data.currency) : 'N/A';
    
    // 7. Book Value
    const bookVal = data.bookValue !== undefined && data.bookValue !== null ? data.bookValue : details.book;
    modalBookValue.textContent = formatStockCurrency(bookVal, data.currency);
    
    // 8. Face Value
    const faceVal = data.faceValue !== undefined && data.faceValue !== null ? data.faceValue : details.face;
    modalFaceValue.textContent = formatStockCurrency(faceVal, data.currency);
    
    // 9. ROCE
    modalRoce.textContent = data.roce !== undefined && data.roce !== null ? data.roce : details.roce;
    
    // 10. ROE
    modalRoe.textContent = data.roe !== undefined && data.roe !== null ? data.roe : details.roe;
    
    // 11. Owner
    modalCompanyOwner.textContent = data.owner !== undefined && data.owner !== null ? data.owner : details.owner;
    
    // 12. Description
    modalCompanyDesc.textContent = data.description !== undefined && data.description !== null ? data.description : details.desc;
    
    companyModal.classList.remove('hidden');
}

function closeCompanyDetailsModal() {
    companyModal.classList.add('hidden');
}

knowMoreBtn.addEventListener('click', showCompanyDetailsModal);
modalCloseBtn.addEventListener('click', closeCompanyDetailsModal);
companyModal.addEventListener('click', (e) => {
    if (e.target === companyModal) {
        closeCompanyDetailsModal();
    }
});

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
            <span class="mover-price">${formatStockCurrency(stock.price, stock.currency)}</span>
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
            <span class="mover-price" style="font-size:0.9rem;">${formatStockCurrency(stock.price, stock.currency)}</span>
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
    if (!currency) return formatStockCurrency(price, 'INR');
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
const industryModalCloseBtn = document.getElementById('industry-modal-close');
const modalOverlay = document.getElementById('industry-modal');
if (industryModalCloseBtn) {
    industryModalCloseBtn.addEventListener('click', () => modalOverlay.classList.add('hidden'));
}
if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) modalOverlay.classList.add('hidden');
    });
}

// Initialize application on DOM load
document.addEventListener('DOMContentLoaded', () => {
    const savedMode = sessionStorage.getItem('auth_mode');
    const savedName = sessionStorage.getItem('auth_name') || '';
    const savedUsername = sessionStorage.getItem('auth_username') || '';
    
    if (savedMode) {
        enterDashboard(savedMode, savedName, savedUsername);
    } else {
        showAuthScreen('selection');
    }

    // Initialize Simulated Trading
    loadTradingState();
    initTradingSimulator();
});

// --- SIMULATED TRADING ENGINE ---
let tradingState = {
    cash: 1000000.0, // 10 Lakhs starting cash
    positions: {},  // e.g. { "AAPL": { shares: 10, avgPrice: 150.0 } }
    history: []     // e.g. [{ type: "buy", symbol: "AAPL", shares: 10, price: 150.0, time: "DateString" }]
};

// Load trading state from localStorage if it exists
function loadTradingState() {
    const saved = localStorage.getItem('bt_trading_state');
    if (saved) {
        try {
            tradingState = JSON.parse(saved);
        } catch(e) {
            console.error("Failed to parse saved trade state:", e);
        }
    }
    updateTradeUI();
}

// Save trading state
function saveTradingState() {
    localStorage.setItem('bt_trading_state', JSON.stringify(tradingState));
    updateTradeUI();
}

// Calculate totals and update the UI
function updateTradeUI() {
    // Available Cash
    const cashEl = document.getElementById('portfolio-cash');
    if (cashEl) cashEl.textContent = formatINR(tradingState.cash);

    // Calculate Portfolio Value
    let positionsValue = 0;
    let totalInvested = 0;
    
    const positionsList = document.getElementById('positions-list');
    if (positionsList) {
        positionsList.innerHTML = '';
        
        const symbols = Object.keys(tradingState.positions);
        if (symbols.length === 0) {
            positionsList.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">No open positions</td>
                </tr>
            `;
        } else {
            symbols.forEach(sym => {
                const pos = tradingState.positions[sym];
                if (pos.shares <= 0) return;
                
                // Fetch current price (use live price if matching currentSymbol, fallback to avgPrice)
                let livePrice = pos.avgPrice;
                const activeSym = currentSymbol ? currentSymbol.replace('.NS', '').replace('.BO', '').toUpperCase() : '';
                if (activeSym === sym.toUpperCase()) {
                    livePrice = currentPrice;
                }
                
                const curVal = pos.shares * livePrice;
                positionsValue += curVal;
                totalInvested += pos.shares * pos.avgPrice;
                
                const pnl = curVal - (pos.shares * pos.avgPrice);
                const pnlPct = pos.avgPrice > 0 ? (pnl / (pos.shares * pos.avgPrice) * 100) : 0.0;
                
                const tr = document.createElement('tr');
                const pnlArrow = pnl >= 0 ? '▲' : '▼';
                tr.innerHTML = `
                    <td><strong>${sym}</strong></td>
                    <td>${pos.shares}</td>
                    <td>${formatINR(pos.avgPrice)}</td>
                    <td>${formatINR(curVal)}</td>
                    <td class="trade-pnl ${pnl >= 0 ? 'positive' : 'negative'}">
                        ${pnl >= 0 ? '+' : ''}${formatINR(pnl)} (${pnlPct.toFixed(2)}%)
                    </td>
                `;
                positionsList.appendChild(tr);
            });
        }
    } else {
        Object.keys(tradingState.positions).forEach(sym => {
            const pos = tradingState.positions[sym];
            let livePrice = pos.avgPrice;
            const activeSym = currentSymbol ? currentSymbol.replace('.NS', '').replace('.BO', '').toUpperCase() : '';
            if (activeSym === sym.toUpperCase()) {
                livePrice = currentPrice;
            }
            positionsValue += pos.shares * livePrice;
            totalInvested += pos.shares * pos.avgPrice;
        });
    }

    const totalPortfolio = tradingState.cash + positionsValue;
    const portfolioValueEl = document.getElementById('portfolio-value');
    if (portfolioValueEl) portfolioValueEl.textContent = formatINR(totalPortfolio);

    const totalPnl = totalPortfolio - 1000000.0;
    const totalPnlPct = (totalPnl / 1000000.0) * 100;
    
    const pnlEl = document.getElementById('portfolio-pnl');
    if (pnlEl) {
        pnlEl.textContent = `${totalPnl >= 0 ? '+' : ''}${formatINR(totalPnl)} (${totalPnlPct.toFixed(2)}%)`;
        pnlEl.className = `box-val ${totalPnl >= 0 ? 'positive' : 'negative'}`;
    }

    // Update Transaction History
    const historyList = document.getElementById('trade-history-list');
    if (historyList) {
        historyList.innerHTML = '';
        if (tradingState.history.length === 0) {
            historyList.innerHTML = `<li style="text-align: center; color: var(--text-muted); padding: 15px;">No transactions recorded</li>`;
        } else {
            const recent = [...tradingState.history].reverse().slice(0, 10);
            recent.forEach(tx => {
                const li = document.createElement('li');
                li.className = 'history-item';
                li.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="history-type-tag ${tx.type}">${tx.type}</span>
                        <strong>${tx.symbol}</strong>
                    </div>
                    <div>${tx.shares} @ ${formatINR(tx.price)}</div>
                    <div style="color:var(--text-muted); font-size:0.75rem;">${tx.time}</div>
                `;
                historyList.appendChild(li);
            });
        }
    }
}

// Bind Simulator Button triggers
let selectedTradeAction = 'buy'; // default

function initTradingSimulator() {
    const buyActionBtn = document.getElementById('btn-action-buy');
    const sellActionBtn = document.getElementById('btn-action-sell');
    const executeBtn = document.getElementById('execute-trade-btn');
    const qtyInput = document.getElementById('trade-quantity');
    const estCostEl = document.getElementById('estimated-cost');
    
    if (!buyActionBtn || !sellActionBtn) return;
    
    buyActionBtn.addEventListener('click', () => {
        selectedTradeAction = 'buy';
        buyActionBtn.classList.add('active');
        sellActionBtn.classList.remove('active');
        executeBtn.className = 'confirm-trade-btn buy';
        executeBtn.textContent = 'Confirm Purchase';
        document.querySelector('.trade-summary .summary-row span:first-child').textContent = 'Estimated Cost';
        recalcEstCost();
    });

    sellActionBtn.addEventListener('click', () => {
        selectedTradeAction = 'sell';
        sellActionBtn.classList.add('active');
        buyActionBtn.classList.remove('active');
        executeBtn.className = 'confirm-trade-btn sell';
        executeBtn.textContent = 'Confirm Sale';
        document.querySelector('.trade-summary .summary-row span:first-child').textContent = 'Estimated Revenue';
        recalcEstCost();
    });

    qtyInput.addEventListener('input', recalcEstCost);
    qtyInput.addEventListener('change', recalcEstCost);

    // Percentage shortcuts
    document.querySelectorAll('.pct-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const pct = parseInt(e.target.getAttribute('data-pct'));
            if (!currentPrice || currentPrice <= 0) return;
            
            if (selectedTradeAction === 'buy') {
                const maxBuyCash = tradingState.cash * (pct / 100);
                const qty = Math.floor(maxBuyCash / currentPrice);
                qtyInput.value = qty > 0 ? qty : '';
            } else {
                const sym = currentSymbol ? currentSymbol.replace('.NS', '').replace('.BO', '').toUpperCase() : '';
                const pos = tradingState.positions[sym];
                const ownedShares = pos ? pos.shares : 0;
                const qty = Math.floor(ownedShares * (pct / 100));
                qtyInput.value = qty > 0 ? qty : '';
            }
            recalcEstCost();
        });
    });

    // Execute order
    executeBtn.addEventListener('click', () => {
        const symbol = document.getElementById('trade-symbol').value;
        const qty = parseInt(qtyInput.value);
        
        if (!symbol || !currentPrice || currentPrice <= 0) {
            showToast('Please select a valid stock first.', 'error');
            return;
        }
        
        if (isNaN(qty) || qty <= 0) {
            showToast('Please enter a valid positive quantity.', 'error');
            return;
        }

        const cost = qty * currentPrice;
        const symKey = symbol.toUpperCase();

        if (selectedTradeAction === 'buy') {
            if (cost > tradingState.cash) {
                showToast('Insufficient funds to complete purchase.', 'error');
                return;
            }
            
            tradingState.cash -= cost;
            
            if (!tradingState.positions[symKey]) {
                tradingState.positions[symKey] = { shares: 0, avgPrice: 0.0 };
            }
            
            const pos = tradingState.positions[symKey];
            const oldCost = pos.shares * pos.avgPrice;
            pos.shares += qty;
            pos.avgPrice = (oldCost + cost) / pos.shares;
            
            tradingState.history.push({
                type: 'buy',
                symbol: symKey,
                shares: qty,
                price: currentPrice,
                time: new Date().toLocaleTimeString('en-IN') + ' ' + new Date().toLocaleDateString('en-IN')
            });
            
            showToast(`Purchased ${qty} shares of ${symKey} successfully!`, 'success');
            
        } else {
            const pos = tradingState.positions[symKey];
            const ownedShares = pos ? pos.shares : 0;
            
            if (qty > ownedShares) {
                showToast(`You only own ${ownedShares} shares. Cannot sell ${qty} shares.`, 'error');
                return;
            }
            
            tradingState.cash += cost;
            pos.shares -= qty;
            if (pos.shares === 0) {
                delete tradingState.positions[symKey];
            }
            
            tradingState.history.push({
                type: 'sell',
                symbol: symKey,
                shares: qty,
                price: currentPrice,
                time: new Date().toLocaleTimeString('en-IN') + ' ' + new Date().toLocaleDateString('en-IN')
            });
            
            showToast(`Sold ${qty} shares of ${symKey} successfully!`, 'success');
        }
        
        qtyInput.value = '';
        recalcEstCost();
        saveTradingState();
    });
}

function recalcEstCost() {
    const qtyInput = document.getElementById('trade-quantity');
    const estCostEl = document.getElementById('estimated-cost');
    if (!qtyInput || !estCostEl) return;
    
    const qty = parseInt(qtyInput.value);
    if (isNaN(qty) || qty <= 0 || !currentPrice || currentPrice <= 0) {
        estCostEl.textContent = '₹0.00';
    } else {
        estCostEl.textContent = formatINR(qty * currentPrice);
    }
}

// Populate the trade order form with the active stock info
function populateTradeForm() {
    const symbolField = document.getElementById('trade-symbol');
    const priceField = document.getElementById('trade-price');
    const executeBtn = document.getElementById('execute-trade-btn');
    
    if (!symbolField || !priceField) return;
    
    if (currentSymbol) {
        const cleanSym = currentSymbol.replace('.NS', '').replace('.BO', '');
        symbolField.value = cleanSym;
        priceField.value = formatINR(currentPrice);
        
        if (executeBtn) {
            executeBtn.disabled = false;
        }
    } else {
        symbolField.value = '';
        priceField.value = '₹0.00';
        if (executeBtn) {
            executeBtn.disabled = true;
        }
    }
    recalcEstCost();
}

// --- NEW FEATURES LOGIC ---

// 1. Profile Dropdown Logic
const profileDropdownBtn = document.getElementById('profile-dropdown-btn');
const profileDropdownMenu = document.getElementById('profile-dropdown-menu');

if (profileDropdownBtn && profileDropdownMenu) {
    profileDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdownMenu.classList.toggle('hidden');
        const expanded = profileDropdownMenu.classList.contains('hidden') ? 'false' : 'true';
        profileDropdownBtn.setAttribute('aria-expanded', expanded);
    });

    document.addEventListener('click', (e) => {
        if (!profileDropdownMenu.contains(e.target) && !profileDropdownBtn.contains(e.target)) {
            profileDropdownMenu.classList.add('hidden');
            profileDropdownBtn.setAttribute('aria-expanded', 'false');
        }
    });
}

// 2. Alert History & Logs Logic
const alertHistoryList = document.getElementById('alert-history-list');
const alertHistorySearch = document.getElementById('alert-history-search');

let alertHistoryLogs = JSON.parse(localStorage.getItem('alertHistoryLogs') || '[]');

function renderAlertHistory(filterText = '') {
    if (!alertHistoryList) return;
    
    alertHistoryList.innerHTML = '';
    const filteredLogs = alertHistoryLogs.filter(log => 
        log.symbol.toLowerCase().includes(filterText.toLowerCase())
    );

    if (filteredLogs.length === 0) {
        alertHistoryList.innerHTML = `<li style="text-align: center; color: var(--text-muted); padding: 20px;">No alerts found matching filter</li>`;
        return;
    }

    // Render most recent first
    [...filteredLogs].reverse().forEach(log => {
        const li = document.createElement('li');
        li.style.padding = '12px 16px';
        li.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        li.style.display = 'flex';
        li.style.flexDirection = 'column';
        li.style.gap = '4px';

        const dateStr = new Date(log.timestamp).toLocaleString();
        const icon = log.condition === 'above' ? 
            `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="var(--success)" stroke-width="2" style="margin-right:4px;"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>` : 
            `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="var(--danger)" stroke-width="2" style="margin-right:4px;"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>`;

        li.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong style="color: var(--text-main); font-size: 0.95rem;">${log.symbol}</strong>
                <span style="font-size: 0.75rem; color: var(--text-muted);">${dateStr}</span>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-light); display: flex; align-items: center;">
                ${icon} Triggered at <strong>${formatINR(log.triggeredPrice)}</strong> (Target: ${log.condition} ${formatINR(log.targetPrice)})
            </div>
        `;
        alertHistoryList.appendChild(li);
    });
}

function addAlertHistoryRecord(symbol, triggeredPrice, condition, targetPrice) {
    alertHistoryLogs.push({
        symbol,
        triggeredPrice,
        condition,
        targetPrice,
        timestamp: Date.now()
    });
    // Keep only last 50 alerts
    if (alertHistoryLogs.length > 50) alertHistoryLogs.shift();
    localStorage.setItem('alertHistoryLogs', JSON.stringify(alertHistoryLogs));
    
    // Refresh UI if alerts view is active
    if (document.getElementById('view-alerts').classList.contains('active')) {
        renderAlertHistory(alertHistorySearch ? alertHistorySearch.value : '');
    }
}

if (alertHistorySearch) {
    alertHistorySearch.addEventListener('input', (e) => {
        renderAlertHistory(e.target.value);
    });
}

// 3. Marquee Ticker Logic
const MARQUEE_FALLBACK_DATA = [
    { symbol: '^NSEI', name: 'NIFTY 50', price: 24300.50, change: 120.30, percent_change: 0.50, currency: 'INR' },
    { symbol: '^BSESN', name: 'SENSEX', price: 79800.20, change: -350.40, percent_change: -0.44, currency: 'INR' },
    { symbol: '^IXIC', name: 'NASDAQ', price: 17850.80, change: 85.20, percent_change: 0.48, currency: 'USD' },
    { symbol: '^GSPC', name: 'S&P 500', price: 5560.10, change: 12.40, percent_change: 0.22, currency: 'USD' },
    { symbol: '^DJI', name: 'DOW JONES', price: 40130.60, change: -95.80, percent_change: -0.24, currency: 'USD' },
    { symbol: 'RELIANCE.NS', name: 'RELIANCE', price: 2950.40, change: 15.20, percent_change: 0.52, currency: 'INR' },
    { symbol: 'TCS.NS', name: 'TCS', price: 3910.15, change: -42.30, percent_change: -1.07, currency: 'INR' },
    { symbol: 'HDFCBANK.NS', name: 'HDFCBANK', price: 1610.80, change: 8.90, percent_change: 0.56, currency: 'INR' },
    { symbol: 'AAPL', name: 'APPLE', price: 224.30, change: 3.15, percent_change: 1.42, currency: 'USD' },
    { symbol: 'MSFT', name: 'MICROSOFT', price: 420.55, change: -2.40, percent_change: -0.57, currency: 'USD' },
    { symbol: 'NVDA', name: 'NVIDIA', price: 118.25, change: 4.80, percent_change: 4.23, currency: 'USD' },
    { symbol: 'GOOG', name: 'ALPHABET', price: 175.40, change: -0.90, percent_change: -0.51, currency: 'USD' }
];

let marqueeData = [];
let marqueeSimInterval = null;

function renderMarqueeHTML() {
    const marqueeContainer = document.getElementById('stock-ticker-marquee');
    if (!marqueeContainer || !marqueeData || marqueeData.length === 0) return;
    
    const itemsHTML = marqueeData.map(item => {
        const isPositive = item.change >= 0;
        const changeClass = isPositive ? 'positive' : 'negative';
        const arrow = isPositive ? '▲' : '▼';
        return `
            <div class="ticker-item">
                <span class="ticker-symbol">${item.symbol.replace('.NS', '')}</span>
                <span class="ticker-price">${item.currency === 'INR' ? '₹' : '$'}${item.price.toFixed(2)}</span>
                <span class="ticker-change ${changeClass}">${arrow} ${Math.abs(item.change).toFixed(2)} (${arrow} ${Math.abs(item.percent_change).toFixed(2)}%)</span>
            </div>
        `;
    }).join('');
    
    // Duplicate the items twice to ensure seamless scrolling loop
    marqueeContainer.innerHTML = itemsHTML + itemsHTML + itemsHTML;
}

function simulateMarqueeTicks() {
    if (!marqueeData || marqueeData.length === 0) return;
    
    // Randomly select 1-3 items to fluctuate slightly
    const numToUpdate = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < numToUpdate; i++) {
        const idx = Math.floor(Math.random() * marqueeData.length);
        const item = marqueeData[idx];
        
        // Small fluctuation between -0.15% and +0.15%
        const percentChange = (Math.random() * 0.3 - 0.15) / 100;
        const priceTick = item.price * percentChange;
        
        item.price += priceTick;
        item.change += priceTick;
        item.percent_change = (item.change / (item.price - item.change)) * 100;
    }
    
    renderMarqueeHTML();
}

async function initMarquee() {
    const marqueeContainer = document.getElementById('stock-ticker-marquee');
    if (!marqueeContainer) return;
    
    try {
        const response = await fetch('/.netlify/functions/stock?action=top10&symbols=^NSEI,^BSESN,^IXIC,^GSPC,^DJI,RELIANCE.NS,TCS.NS,HDFCBANK.NS,AAPL,MSFT,NVDA,GOOG');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        if (data && data.length > 0) {
            marqueeData = data.map(item => ({
                symbol: item.symbol,
                name: item.shortName || item.symbol,
                price: parseFloat(item.price),
                change: parseFloat(item.change),
                percent_change: parseFloat(item.percent_change),
                currency: item.currency || (item.symbol.endsWith('.NS') ? 'INR' : 'USD')
            }));
        } else {
            throw new Error('Empty data');
        }
        
        renderMarqueeHTML();
        if (!marqueeSimInterval) {
            marqueeSimInterval = setInterval(simulateMarqueeTicks, 5000);
        }
    } catch (e) {
        console.error("Failed to load marquee data:", e);
        // Fallback to simulated data if marqueeData is empty
        if (!marqueeData || marqueeData.length === 0) {
            marqueeData = JSON.parse(JSON.stringify(MARQUEE_FALLBACK_DATA));
        }
        renderMarqueeHTML();
        if (!marqueeSimInterval) {
            marqueeSimInterval = setInterval(simulateMarqueeTicks, 5000);
        }
    }
}


// Call on startup
document.addEventListener('DOMContentLoaded', () => {
    initMarquee();
    renderAlertHistory();
    // Refresh marquee every 60 seconds
    setInterval(initMarquee, 60000);
    
    // Initial profile display updates
    updateProfileUI();
});

// --- PROFILE SETTINGS MODAL ENGINE ---
function updateProfileUI() {
    const name = sessionStorage.getItem('auth_name') || 'Guest User';
    const username = sessionStorage.getItem('auth_username') || 'guest';
    const mode = sessionStorage.getItem('auth_mode') || 'guest';
    const avatar = sessionStorage.getItem('auth_avatar') || '';
    
    // Update header profile display
    if (userDisplayName) userDisplayName.textContent = mode === 'logged_in' ? name : 'Guest';
    
    const ddName = document.getElementById('dropdown-name');
    const ddUser = document.getElementById('dropdown-username');
    if (ddName) ddName.textContent = mode === 'logged_in' ? name : 'Guest User';
    if (ddUser) ddUser.textContent = mode === 'logged_in' ? `@${username}` : 'guest';
    
    const viewName = document.getElementById('profile-view-name');
    const viewUser = document.getElementById('profile-view-username');
    const viewMode = document.getElementById('profile-view-mode');
    
    if (viewName) viewName.textContent = name;
    if (viewUser) viewUser.textContent = username ? `@${username}` : 'guest';
    if (viewMode) viewMode.textContent = mode === 'logged_in' ? 'Registered User' : 'Guest Mode';
    
    // Update inputs in edit tab
    const editNameInput = document.getElementById('edit-profile-name');
    const editUserInput = document.getElementById('edit-profile-username');
    if (editNameInput) editNameInput.value = name;
    if (editUserInput) editUserInput.value = username;
    
    // Apply avatars
    const headerAvatar = document.getElementById('header-profile-avatar-container');
    const dropdownAvatar = document.getElementById('dropdown-profile-avatar-container');
    const viewAvatar = document.getElementById('profile-view-avatar');
    const editAvatar = document.getElementById('profile-edit-avatar');
    
    const initial = (name || username || 'G').charAt(0).toUpperCase();
    
    const applyAvatar = (container, size) => {
        if (!container) return;
        if (avatar && avatar.startsWith('data:image')) {
            container.innerHTML = `<img src="${avatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            container.style.background = 'transparent';
        } else if (avatar && avatar.startsWith('linear-gradient')) {
            container.innerHTML = `<div style="font-weight: 700; color: #fff; font-size: ${size === 'large' ? '1.5rem' : size === 'medium' ? '1.25rem' : '0.9rem'};">${initial}</div>`;
            container.style.background = avatar;
        } else {
            const svgSize = size === 'large' ? 44 : size === 'medium' ? 22 : 16;
            container.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgSize}" height="${svgSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
            container.style.background = 'rgba(59, 130, 246, 0.1)';
        }
    };
    
    applyAvatar(headerAvatar, 'small');
    applyAvatar(dropdownAvatar, 'medium');
    applyAvatar(viewAvatar, 'medium');
    applyAvatar(editAvatar, 'large');
}

function showProfileTab(tabId) {
    // Hide all tab contents
    document.querySelectorAll('.profile-tab-content').forEach(content => content.classList.add('hidden'));
    // Deactivate all sidebar tab buttons
    document.querySelectorAll('.profile-tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // Show chosen tab content
    const selectedContent = document.getElementById(`tab-${tabId}`);
    if (selectedContent) selectedContent.classList.remove('hidden');
    
    // Activate chosen sidebar button
    const selectedBtn = document.querySelector(`.profile-tab-btn[data-tab="${tabId}"]`);
    if (selectedBtn) selectedBtn.classList.add('active');
}

const profileSettingsModal = document.getElementById('profile-settings-modal');

function openProfileModal(tabId) {
    if (!profileSettingsModal) return;
    profileSettingsModal.classList.remove('hidden');
    showProfileTab(tabId);
    updateProfileUI();
    
    // Set preset selection borders
    const currentAvatar = sessionStorage.getItem('auth_avatar') || '';
    document.querySelectorAll('.avatar-preset').forEach(p => p.classList.remove('selected'));
    if (currentAvatar && currentAvatar.startsWith('linear-gradient')) {
        const selectedPreset = document.querySelector(`.avatar-preset[data-gradient="${currentAvatar}"]`);
        if (selectedPreset) selectedPreset.classList.add('selected');
    }
    
    // Reset password fields
    const pwdCurrent = document.getElementById('change-pwd-current');
    const pwdNew = document.getElementById('change-pwd-new');
    const pwdConfirm = document.getElementById('change-pwd-confirm');
    if (pwdCurrent) pwdCurrent.value = '';
    if (pwdNew) pwdNew.value = '';
    if (pwdConfirm) pwdConfirm.value = '';
    
    // Set notification checkbox states
    const emailAlerts = document.getElementById('notify-email-alerts');
    const smsAlerts = document.getElementById('notify-sms-alerts');
    const dailyDigest = document.getElementById('notify-daily-digest');
    
    if (emailAlerts) emailAlerts.checked = sessionStorage.getItem('notify_email') !== 'false';
    if (smsAlerts) smsAlerts.checked = sessionStorage.getItem('notify_sms') !== 'false';
    if (dailyDigest) dailyDigest.checked = sessionStorage.getItem('notify_digest') === 'true';
}

// Bind dropdown options click events
const btnViewProfile = document.getElementById('btn-view-profile');
const btnEditProfile = document.getElementById('btn-edit-profile');
const btnChangePic = document.getElementById('btn-change-pic');
const btnChangePwd = document.getElementById('btn-change-pwd');
const btnNotifySettings = document.getElementById('btn-notify-settings');

if (btnViewProfile) btnViewProfile.addEventListener('click', (e) => { e.stopPropagation(); openProfileModal('view-profile'); });
if (btnEditProfile) btnEditProfile.addEventListener('click', (e) => { e.stopPropagation(); openProfileModal('edit-profile'); });
if (btnChangePic) btnChangePic.addEventListener('click', (e) => { e.stopPropagation(); openProfileModal('change-pic'); });
if (btnChangePwd) btnChangePwd.addEventListener('click', (e) => { e.stopPropagation(); openProfileModal('change-password'); });
if (btnNotifySettings) btnNotifySettings.addEventListener('click', (e) => { e.stopPropagation(); openProfileModal('notify-settings'); });

// Bind sidebar button clicks
document.querySelectorAll('.profile-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const tabId = e.currentTarget.getAttribute('data-tab');
        showProfileTab(tabId);
    });
});

// Close modal handlers
const profileModalCloseBtn = document.getElementById('profile-modal-close-btn');
if (profileModalCloseBtn) {
    profileModalCloseBtn.addEventListener('click', () => {
        profileSettingsModal.classList.add('hidden');
    });
}
if (profileSettingsModal) {
    profileSettingsModal.addEventListener('click', (e) => {
        if (e.target === profileSettingsModal) {
            profileSettingsModal.classList.add('hidden');
        }
    });
}

// Save Profile Edit Changes
const saveProfileBtn = document.getElementById('save-profile-btn');
if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', () => {
        const nameInput = document.getElementById('edit-profile-name');
        const newName = nameInput ? nameInput.value.trim() : '';
        if (!newName) {
            showToast('Full Name cannot be empty.', 'error');
            return;
        }
        
        sessionStorage.setItem('auth_name', newName);
        updateProfileUI();
        showToast('Profile info updated successfully.', 'success');
    });
}

// Save Notification Preferences
const saveNotifyBtn = document.getElementById('save-notify-btn');
if (saveNotifyBtn) {
    saveNotifyBtn.addEventListener('click', () => {
        const emailAlerts = document.getElementById('notify-email-alerts');
        const smsAlerts = document.getElementById('notify-sms-alerts');
        const dailyDigest = document.getElementById('notify-daily-digest');
        
        if (emailAlerts) sessionStorage.setItem('notify_email', emailAlerts.checked);
        if (smsAlerts) sessionStorage.setItem('notify_sms', smsAlerts.checked);
        if (dailyDigest) sessionStorage.setItem('notify_digest', dailyDigest.checked);
        
        showToast('Notification preferences saved.', 'success');
    });
}

// Update Password Handler (Simulated)
const savePasswordBtn = document.getElementById('save-password-btn');
if (savePasswordBtn) {
    savePasswordBtn.addEventListener('click', () => {
        const pwdCurrent = document.getElementById('change-pwd-current');
        const pwdNew = document.getElementById('change-pwd-new');
        const pwdConfirm = document.getElementById('change-pwd-confirm');
        
        const currentVal = pwdCurrent ? pwdCurrent.value : '';
        const newVal = pwdNew ? pwdNew.value : '';
        const confirmVal = pwdConfirm ? pwdConfirm.value : '';
        
        const mode = sessionStorage.getItem('auth_mode') || 'guest';
        if (mode === 'guest') {
            showToast('Passwords cannot be changed in guest mode. Create an account to save settings.', 'error');
            return;
        }
        
        if (!currentVal || !newVal || !confirmVal) {
            showToast('Please fill out all password fields.', 'error');
            return;
        }
        
        if (newVal.length < 4) {
            showToast('New password must be at least 4 characters long.', 'error');
            return;
        }
        
        if (newVal !== confirmVal) {
            showToast('New passwords do not match.', 'error');
            return;
        }
        
        showToast('Password updated successfully.', 'success');
        pwdCurrent.value = '';
        pwdNew.value = '';
        pwdConfirm.value = '';
    });
}

// Change Profile Picture (Gradients & Custom Image Upload)
const triggerFileInputBtn = document.getElementById('trigger-file-input-btn');
const profilePicFileInput = document.getElementById('profile-pic-file-input');
const removeProfilePicBtn = document.getElementById('remove-profile-pic-btn');

if (triggerFileInputBtn && profilePicFileInput) {
    triggerFileInputBtn.addEventListener('click', () => {
        profilePicFileInput.click();
    });
}

if (profilePicFileInput) {
    profilePicFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                showToast('Image size must be less than 2MB.', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = function(evt) {
                const base64Image = evt.target.result;
                sessionStorage.setItem('auth_avatar', base64Image);
                
                // Remove selected border from presets
                document.querySelectorAll('.avatar-preset').forEach(p => p.classList.remove('selected'));
                
                updateProfileUI();
                showToast('Profile photo uploaded successfully.', 'success');
            };
            reader.readAsDataURL(file);
        }
    });
}

if (removeProfilePicBtn) {
    removeProfilePicBtn.addEventListener('click', () => {
        sessionStorage.removeItem('auth_avatar');
        document.querySelectorAll('.avatar-preset').forEach(p => p.classList.remove('selected'));
        updateProfileUI();
        showToast('Profile photo removed.', 'success');
    });
}

// Preset Gradient clicks
document.querySelectorAll('.avatar-preset').forEach(preset => {
    preset.addEventListener('click', (e) => {
        const gradient = e.currentTarget.getAttribute('data-gradient');
        sessionStorage.setItem('auth_avatar', gradient);
        
        document.querySelectorAll('.avatar-preset').forEach(p => p.classList.remove('selected'));
        preset.classList.add('selected');
        
        updateProfileUI();
        showToast('Profile theme updated.', 'success');
    });
});

// ==========================================
// WATCHLIST SECTION SYSTEM
// ==========================================
let watchlist = JSON.parse(localStorage.getItem('bt_watchlist') || '[]');
if (watchlist.length === 0) {
    watchlist = ['RELIANCE.NS', 'AAPL', 'GOOGL'];
    localStorage.setItem('bt_watchlist', JSON.stringify(watchlist));
}

async function loadWatchlist() {
    const container = document.getElementById('watchlist-container');
    if (!container) return;
    
    if (watchlist.length === 0) {
        container.innerHTML = `
            <div class="watchlist-empty-state" style="text-align: center; padding: 24px; color: var(--text-muted);">
                Your watchlist is empty. Search a stock and click "Track" to add it here.
            </div>
        `;
        return;
    }
    
    try {
        const symbolsParam = watchlist.join(',');
        const res = await fetch(`/.netlify/functions/stock?action=top10&symbols=${encodeURIComponent(symbolsParam)}`);
        const data = await res.json();
        
        // Preserve open item class if loaded
        const openSymbol = document.querySelector('.watchlist-item.expanded')?.getAttribute('data-symbol') || null;
        
        container.innerHTML = '';
        
        data.forEach(item => {
            const symbolBase = item.symbol.replace('.NS', '').replace('.BO', '');
            const isPositive = item.percent_change >= 0;
            const changeClass = isPositive ? 'positive' : 'negative';
            const prefix = isPositive ? '+' : '';
            
            const div = document.createElement('div');
            // If the item was expanded, keep it expanded
            div.className = `watchlist-item glass-panel${openSymbol === item.symbol ? ' expanded' : ''}`;
            div.setAttribute('data-symbol', item.symbol);
            
            div.innerHTML = `
                <div class="watchlist-item-header">
                    <span class="watchlist-item-title"><strong>${symbolBase}</strong> - ${item.shortName || item.name}</span>
                    <span class="watchlist-expand-arrow" style="transform: ${openSymbol === item.symbol ? 'rotate(180deg)' : 'rotate(0deg)'}">▼</span>
                </div>
                
                <div class="watchlist-item-details">
                    <div class="watchlist-details-grid">
                        <div class="detail-box">
                            <span class="detail-label">Current Price</span>
                            <span class="detail-val">${formatStockCurrency(item.price, item.currency)}</span>
                        </div>
                        <div class="detail-box">
                            <span class="detail-label">24h Change</span>
                            <span class="detail-val ${changeClass}">${prefix}${item.change.toFixed(2)} (${prefix}${item.percent_change.toFixed(2)}%)</span>
                        </div>
                        <div class="detail-box">
                            <span class="detail-label">Prev Close</span>
                            <span class="detail-val">${formatStockCurrency(item.prevClose, item.currency)}</span>
                        </div>
                        <div class="detail-box">
                            <span class="detail-label">Exchange</span>
                            <span class="detail-val">${item.currency === 'INR' ? 'NSE' : 'NASDAQ'}</span>
                        </div>
                    </div>
                    <div class="watchlist-actions-row">
                        <button class="btn-watchlist-action btn-details" data-symbol="${item.symbol}">Details</button>
                        <button class="btn-watchlist-action btn-alert" data-symbol="${item.symbol}">Set Alert</button>
                        <button class="btn-watchlist-action btn-remove text-danger" data-symbol="${item.symbol}">Remove</button>
                    </div>
                </div>
            `;
            
            // Toggle expanded on click
            div.querySelector('.watchlist-item-header').addEventListener('click', (e) => {
                // Toggle clicked item
                const isExpanding = !div.classList.contains('expanded');
                
                // Close all others
                document.querySelectorAll('.watchlist-item').forEach(other => {
                    other.classList.remove('expanded');
                    const otherArrow = other.querySelector('.watchlist-expand-arrow');
                    if (otherArrow) otherArrow.style.transform = 'rotate(0deg)';
                });
                
                if (isExpanding) {
                    div.classList.add('expanded');
                    const arrow = div.querySelector('.watchlist-expand-arrow');
                    if (arrow) arrow.style.transform = 'rotate(180deg)';
                }
            });
            
            // Wire up actions
            div.querySelector('.btn-details').addEventListener('click', (e) => {
                e.stopPropagation();
                currentSymbol = item.symbol;
                fetchStockData(currentSymbol);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            
            div.querySelector('.btn-alert').addEventListener('click', (e) => {
                e.stopPropagation();
                currentSymbol = item.symbol;
                fetchStockData(currentSymbol);
                const alertsTab = document.querySelector('[data-target="view-alerts"]');
                if (alertsTab) alertsTab.click();
            });
            
            div.querySelector('.btn-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                removeFromWatchlist(item.symbol);
            });
            
            container.appendChild(div);
        });
    } catch (e) {
        console.error("Watchlist fetch error:", e);
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--danger);">
                Failed to load watchlist data.
            </div>
        `;
    }
}

function removeFromWatchlist(symbol) {
    const idx = watchlist.indexOf(symbol);
    if (idx > -1) {
        watchlist.splice(idx, 1);
        localStorage.setItem('bt_watchlist', JSON.stringify(watchlist));
        const symbolBase = symbol.replace('.NS', '').replace('.BO', '');
        showToast(`${symbolBase} removed from watchlist.`, 'success');
        updateWatchlistButtonState(symbol);
        loadWatchlist();
    }
}

function toggleWatchlist(symbol) {
    const idx = watchlist.indexOf(symbol);
    const symbolBase = symbol.replace('.NS', '').replace('.BO', '');
    
    if (idx > -1) {
        watchlist.splice(idx, 1);
        localStorage.setItem('bt_watchlist', JSON.stringify(watchlist));
        showToast(`${symbolBase} removed from watchlist.`, 'success');
    } else {
        watchlist.push(symbol);
        localStorage.setItem('bt_watchlist', JSON.stringify(watchlist));
        showToast(`${symbolBase} added to watchlist.`, 'success');
    }
    updateWatchlistButtonState(symbol);
    loadWatchlist();
}

function updateWatchlistButtonState(symbol) {
    const btn = document.getElementById('add-to-watchlist-btn');
    if (!btn) return;
    
    if (watchlist.includes(symbol)) {
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg><span>Watching</span>`;
        btn.classList.add('active');
    } else {
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg><span>Watch</span>`;
        btn.classList.remove('active');
    }
}
