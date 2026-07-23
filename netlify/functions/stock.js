exports.handler = async function(event, context) {
    const action = event.queryStringParameters.action || 'chart';
    
    // Helper to fetch JSON
    async function fetchJson(url) {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        return await response.json();
    }

    // Helper to fetch live USD/INR exchange rate
    async function getExchangeRate() {
        try {
            const data = await fetchJson('https://query1.finance.yahoo.com/v8/finance/chart/USDINR=X?interval=1d&range=1d');
            const quote = data.chart.result[0].indicators.quote[0];
            const prices = quote.close.filter(p => p !== null);
            return prices[prices.length - 1] || 83.5; // fallback to 83.5 if fails
        } catch(e) {
            return 83.5; 
        }
    }

    try {
        if (action === 'chart') {
            let symbol = event.queryStringParameters.symbol || 'RELIANCE.NS';
            symbol = symbol.toUpperCase();
            
            // Check if US stock
            const isIndian = symbol.includes('.NS') || symbol.includes('.BO');
            const exchangeRate = isIndian ? 1 : await getExchangeRate();
            
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=2m&range=1d`;
            const data = await fetchJson(url);
            const result = data.chart.result[0];
            
            const quote = result.indicators.quote[0];
            const timestamps = result.timestamp || [];
            const prices = [];
            const labels = [];
            
            for (let i = 0; i < timestamps.length; i++) {
                if (quote.close && quote.close[i] !== null && quote.close[i] !== undefined) {
                    const priceInINR = quote.close[i] * exchangeRate;
                    prices.push(priceInINR);
                    const date = new Date(timestamps[i] * 1000);
                    labels.push(date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
                }
            }
            
            if (prices.length === 0) throw new Error('Empty data');
            
            let metaPrice = result.meta.regularMarketPrice || prices[prices.length - 1];
            let metaPrevClose = result.meta.chartPreviousClose || result.meta.previousClose || prices[0];
            
            metaPrice *= exchangeRate;
            metaPrevClose *= exchangeRate;
            
            return {
                statusCode: 200,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({
                    symbol: result.meta.symbol,
                    name: result.meta.shortName || result.meta.longName || result.meta.symbol,
                    price: metaPrice,
                    prevClose: metaPrevClose,
                    labels,
                    prices
                })
            };
        } 
        else if (action === 'top10') {
            const symbolsParam = event.queryStringParameters.symbols || 'RELIANCE.NS';
            const symbols = symbolsParam.split(',');
            
            // Fetch exchange rate in case there are US stocks
            const hasUSStocks = symbols.some(s => !s.includes('.NS') && !s.includes('.BO'));
            const exchangeRate = hasUSStocks ? await getExchangeRate() : 1;
            
            // Yahoo's quote API is unauthorized, so we request /chart for each in parallel
            const promises = symbols.map(async (symbol) => {
                try {
                    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
                    const data = await fetchJson(url);
                    const result = data.chart.result[0];
                    const meta = result.meta;
                    
                    const isIndian = symbol.includes('.NS') || symbol.includes('.BO');
                    const rate = isIndian ? 1 : exchangeRate;
                    
                    const price = (meta.regularMarketPrice || meta.chartPreviousClose) * rate;
                    const prevClose = meta.chartPreviousClose * rate;
                    const change = price - prevClose;
                    const pct = prevClose !== 0 ? (change / prevClose) * 100 : 0;
                    
                    return {
                        symbol: meta.symbol,
                        shortName: meta.shortName || meta.longName || meta.symbol,
                        price: price,
                        prevClose: prevClose,
                        change: change,
                        percent_change: pct
                    };
                } catch(e) {
                    console.error(`Failed to fetch quote for ${symbol}:`, e.message);
                    return null;
                }
            });
            
            const results = (await Promise.all(promises)).filter(r => r !== null);
            
            return {
                statusCode: 200,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify(results)
            };
        }
        else if (action === 'search') {
            const query = event.queryStringParameters.q || '';
            if (!query) {
                return {
                    statusCode: 200,
                    headers: { 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify([])
                };
            }
            
            const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}`;
            const data = await fetchJson(url);
            const quotes = data.quotes || [];
            
            const results = quotes
                .filter(q => q.quoteType === 'EQUITY')
                .map(q => ({
                    symbol: q.symbol,
                    name: q.longname || q.shortname || q.symbol,
                    exchange: q.exchDisp || q.exchange
                }));
                
            return {
                statusCode: 200,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify(results)
            };
        }

    } catch (error) {
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};
