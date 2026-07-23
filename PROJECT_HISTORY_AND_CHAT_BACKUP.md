# StockAlertPro - Development History & Chat Backup

This document serves as a complete record of the changes made, the engineering design decisions, and the code structure for your custom stock market dashboard. Transfer this folder to your personal laptop to keep all project files and history intact.

---

## 📅 Project Journey Summary

### 1. The Proxy & API Blocking Problem
Initially, the website fetched data directly from Yahoo Finance in the browser. Due to strict CORS restrictions and Yahoo blocking public proxy servers (like `allorigins` and `codetabs`), the chart would frequently fail to load. 

### 2. TwelveData API Key Integration
We attempted to migrate to a professional API provider (**TwelveData**). However, we discovered that TwelveData blocks Indian NSE/BSE stock quotes on their free tier, making it impossible to retrieve Indian stock data for free.

### 3. The Netlify Serverless Backend (The Solution)
To bypass CORS and API blocks permanently, we moved data-fetching logic from the browser to a secure serverless environment. We created a custom backend function (`netlify/functions/stock.js`) that queries Yahoo Finance directly. Netlify server-to-server requests are not blocked by browser CORS.

### 4. Features Implemented:
* **Indian & US Stocks in INR:** The backend automatically pulls the live USD/INR exchange rate and converts US stock prices (Apple, Tesla, Microsoft, etc.) into Indian Rupees (₹) dynamically.
* **Responsive Search Autocomplete:** Added a dropdown that triggers suggestions instantly as you type (starting from a single character) and supports keyboard arrow keys + Enter for selection.
* **Top 10 Movers Panel:** Displays live company names (rather than raw tickers) by fetching quotes in parallel on the backend.
* **Formal Data Attribution:** Placed a bold white "Powered by Yahoo Finance API" label at the bottom right of the page background.

---

## 📂 Code Files Created / Modified

### 1. `netlify/functions/stock.js`
The serverless function handling queries for charts, parallel Top 10 quotes, and search autocompletes with automatic currency conversion.

### 2. `netlify.toml`
Tells Netlify's deployment engine to bundle and run the serverless function.

### 3. `app.js`
Handles frontend rendering, suggestion box interactions, Chart.js updates, and calls the Netlify backend endpoint (`/.netlify/functions/stock`).

### 4. `index.html`
Defines the main glassmorphism page layouts, search input, and sidebar panels.

### 5. `style.css`
Applies modern glassmorphism styling, alert toast animations, search suggestion dropdown overlays, and data attribution positioning.

---

## 📅 Session 2 Updates (July 20, 2026)

### 1. UI Layering & Search Input Fixes
* **Z-Index Correction:** Resolved a bug where autocomplete suggestions were slipping beneath the "Top 10 Movers" panel (caused by backdrop-filter stacking context rules). Added `position: relative` and `z-index: 100` to `.header` in `style.css`.
* **Search Input Lifecycle:** Removed the hardcoded default search input value. Added `isInitialLoad` checks to `fetchStockData` in `app.js` to ensure the search field starts empty on page load but displays full company names on subsequent searches.

### 2. Branding & Logo Upgrades
* **Custom Logo Badge:** Replaced the previous placeholder logo with the high-resolution bull/bear branding image (`logo.png`). Used CSS crop filters (`scale(1.75)` and `translateY(-3px)`) to focus solely on the graphics.
* **Bull Trend AI Typography:** Updated `index.html` to load the modern geometric **Space Grotesk** font and styled the title text with neon metallic double-gradients in `style.css`.

### 3. SMS Alert Engine
* **Mobile Field:** Integrated a `tel` input element in the alerts UI.
* **SMS Simulation:** Enabled active alert configurations to store phone numbers and trigger simulated SMS notifications (visual status toasts + console logs) when price targets are crossed.

### 4. Zero-Dependency Local Backend (`server.py`)
* Overwrote the mock Python backend with a functional HTTP handler that intercepts `/.netlify/functions/stock` routes and replicates the Netlify serverless routing locally using Python's standard library. Testing locally now has **zero Node.js dependencies**!

---

## 🚀 How to Run / Deploy on Your Laptop

### Local Testing (Python Server - Recommended)
1. Double-click `run.bat` or run: `python server.py`
2. Open **http://localhost:8000** in your browser. Live stock prices, autocompletes, and alerts will run locally.

### Local Testing (Netlify CLI - Node.js Alternative)
1. Install Netlify CLI: `npm install -g netlify-cli`
2. Start the server: `netlify dev` (Runs the backend from `netlify/functions/stock.js`).

### Deploying to Netlify (Free hosting)
1. Zip this entire folder.
2. Drag and drop the zip file onto [app.netlify.com/drop](https://app.netlify.com/drop).
3. The site and its serverless functions will be deployed instantly!
