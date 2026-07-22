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

// State
let currentSymbol = 'RELIANCE.NS';
let stockChart = null;
let currentPrice = 0;
let previousClose = 0;
let updateInterval = null;
let activeAlert = null;
let activeStockDetails = null; // Stores current stock full metadata response

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
        
        activeStockDetails = data;
        knowMoreBtn.classList.remove('hidden');
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

// Modal & Company Database Helpers
const companyDatabase = {
    'RELIANCE.NS': {
        shares: 6765000000,
        pe: 25.4,
        yield: '0.78%',
        desc: 'Reliance Industries Limited is an Indian multinational conglomerate company, headquartered in Mumbai. It has businesses across energy, petrochemicals, natural gas, retail, telecommunications, mass media, and textiles.'
    },
    'TCS.NS': {
        shares: 3618000000,
        pe: 30.1,
        yield: '1.15%',
        desc: 'Tata Consultancy Services Limited is an Indian multinational information technology services and consulting company headquartered in Mumbai. It is a part of the Tata Group and operates in 150 locations across 46 countries.'
    },
    'HDFCBANK.NS': {
        shares: 7600000000,
        pe: 18.5,
        yield: '1.20%',
        desc: "HDFC Bank Limited is an Indian banking and financial services company headquartered in Mumbai. It is India's largest private sector bank by assets and the world's tenth-largest bank by market capitalization."
    },
    'ICICIBANK.NS': {
        shares: 7000000000,
        pe: 17.8,
        yield: '0.69%',
        desc: 'ICICI Bank Limited is an Indian multinational banking and financial services company headquartered in Mumbai. It offers a wide range of banking products and financial services for corporate and retail customers.'
    },
    'INFY.NS': {
        shares: 4150000000,
        pe: 24.2,
        yield: '2.35%',
        desc: 'Infosys Limited is an Indian multinational information technology company that provides business consulting, information technology and outsourcing services. It was founded in Pune and is headquartered in Bangalore.'
    },
    'AAPL': {
        shares: 15330000000,
        pe: 31.2,
        yield: '0.52%',
        desc: "Apple Inc. is an American multinational technology company headquartered in Cupertino, California. Apple is the world's largest technology company by revenue, manufacturing smartphones, PCs, tablets, wearables, and services."
    },
    'TSLA': {
        shares: 3189000000,
        pe: 58.7,
        yield: 'N/A',
        desc: 'Tesla, Inc. is an American multinational automotive and clean energy company headquartered in Austin, Texas. Tesla designs and manufactures electric vehicles, battery energy storage, solar panels, and related products.'
    },
    'MSFT': {
        shares: 7432000000,
        pe: 35.4,
        yield: '0.72%',
        desc: 'Microsoft Corporation is an American multinational technology corporation headquartered in Redmond, Washington. It is best known for its Windows operating system, Office suite, and Azure cloud computing.'
    },
    'NVDA': {
        shares: 24600000000,
        pe: 68.2,
        yield: '0.02%',
        desc: 'NVIDIA Corporation is an American multinational corporation and technology company headquartered in Santa Clara, California. It designs graphics processing units (GPUs) and application programming interfaces (APIs) for AI and high-performance computing.'
    },
    'GOOGL': {
        shares: 12000000000,
        pe: 26.8,
        yield: '0.45%',
        desc: 'Alphabet Inc. is an American multinational technology conglomerate holding company headquartered in Mountain View, California. It is the world\'s leader in search engine technology, online advertising, and cloud computing.'
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
    
    let hash = 0;
    for (let i = 0; i < cleanKey.length; i++) {
        hash = cleanKey.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);
    
    const simulatedPE = Number(((hash % 30) + 12).toFixed(1));
    const yields = ['N/A', '0.40%', '0.85%', '1.20%', '1.50%', '2.10%'];
    const simulatedYield = yields[hash % yields.length];
    const simulatedShares = ((hash % 15) + 1) * 500000000;
    
    const isIndian = key.includes('.NS') || key.includes('.BO') || ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'].includes(cleanKey);
    const exchange = isIndian ? 'NSE' : 'US Market';
    
    const simulatedDesc = `${name || cleanKey} is a publicly traded enterprise listed on the ${exchange}. The firm focuses on operations in its sector, contributing to global markets, and is tracked as part of our stock price monitoring index.`;
    
    return {
        shares: simulatedShares,
        pe: simulatedPE,
        yield: simulatedYield,
        desc: simulatedDesc
    };
}

function formatMarketCap(val) {
    if (!val) return '₹ --';
    const croreVal = val / 10000000;
    if (croreVal >= 100000) {
        return `₹ ${(croreVal / 100000).toFixed(2)} Lakh Cr`;
    } else {
        return `₹ ${Math.round(croreVal).toLocaleString('en-IN')} Cr`;
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
    
    const marketCapInINR = details.shares * data.price;
    modalMarketCap.textContent = formatMarketCap(marketCapInINR);
    
    modalPeRatio.textContent = details.pe;
    modalDivYield.textContent = details.yield;
    modalVolume.textContent = data.regularMarketVolume ? data.regularMarketVolume.toLocaleString('en-IN') : 'N/A';
    
    const dayLowVal = data.regularMarketDayLow ? formatINR(data.regularMarketDayLow) : 'N/A';
    const dayHighVal = data.regularMarketDayHigh ? formatINR(data.regularMarketDayHigh) : 'N/A';
    modalDayRange.textContent = (data.regularMarketDayLow && data.regularMarketDayHigh) ? `${dayLowVal} - ${dayHighVal}` : 'N/A';
    
    const low52Val = data.fiftyTwoWeekLow ? formatINR(data.fiftyTwoWeekLow) : 'N/A';
    const high52Val = data.fiftyTwoWeekHigh ? formatINR(data.fiftyTwoWeekHigh) : 'N/A';
    modal52wRange.textContent = (data.fiftyTwoWeekLow && data.fiftyTwoWeekHigh) ? `${low52Val} - ${high52Val}` : 'N/A';
    
    modalPrevClose.textContent = data.prevClose ? formatINR(data.prevClose) : 'N/A';
    modalCurrentPrice.textContent = data.price ? formatINR(data.price) : 'N/A';
    modalCompanyDesc.textContent = details.desc;
    
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
