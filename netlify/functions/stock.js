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
            const exchangeRate = 1;
            
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=2m&range=1d`;
            const data = await fetchJson(url);
            const result = data.chart.result[0];
            
            const quote = result.indicators.quote[0];
            const timestamps = result.timestamp || [];
            const prices = [];
            const labels = [];
            
            for (let i = 0; i < timestamps.length; i++) {
                if (quote.close && quote.close[i] !== null && quote.close[i] !== undefined) {
                    const priceInNative = quote.close[i];
                    prices.push(priceInNative);
                    const date = new Date(timestamps[i] * 1000);
                    labels.push(date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
                }
            }
            
            if (prices.length === 0) throw new Error('Empty data');
            
            let metaPrice = result.meta.regularMarketPrice || prices[prices.length - 1];
            let metaPrevClose = result.meta.chartPreviousClose || result.meta.previousClose || prices[0];
            
            metaPrice *= exchangeRate;
            metaPrevClose *= exchangeRate;
            
            let fiftyTwoWeekHigh = result.meta.fiftyTwoWeekHigh ? result.meta.fiftyTwoWeekHigh : null;
            let fiftyTwoWeekLow = result.meta.fiftyTwoWeekLow ? result.meta.fiftyTwoWeekLow : null;
            let regularMarketDayHigh = result.meta.regularMarketDayHigh ? result.meta.regularMarketDayHigh : null;
            let regularMarketDayLow = result.meta.regularMarketDayLow ? result.meta.regularMarketDayLow : null;
            let regularMarketVolume = result.meta.regularMarketVolume || null;
            
            return {
                statusCode: 200,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({
                    symbol: result.meta.symbol,
                    name: result.meta.shortName || result.meta.longName || result.meta.symbol,
                    price: metaPrice,
                    prevClose: metaPrevClose,
                    labels,
                    prices,
                    fiftyTwoWeekHigh,
                    fiftyTwoWeekLow,
                    regularMarketDayHigh,
                    regularMarketDayLow,
                    regularMarketVolume,
                    currency: result.meta.currency || (isIndian ? 'INR' : 'USD')
                })
            };
        } 
        else if (action === 'top10') {
            const symbolsParam = event.queryStringParameters.symbols || 'RELIANCE.NS';
            const symbols = symbolsParam.split(',');
            
            const exchangeRate = 1;
            
            // Yahoo's quote API is unauthorized, so we request /chart for each in parallel
            const promises = symbols.map(async (symbol) => {
                try {
                    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
                    const data = await fetchJson(url);
                    const result = data.chart.result[0];
                    const meta = result.meta;
                    
                    const isIndian = symbol.includes('.NS') || symbol.includes('.BO');
                    const rate = 1;
                    
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
                        percent_change: pct,
                        currency: meta.currency || (isIndian ? 'INR' : 'USD')
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
        else if (action === 'send_email') {
            const toAddr = event.queryStringParameters.to || '';
            const subject = event.queryStringParameters.subject || 'Bull Trend AI Price Alert';
            const message = event.queryStringParameters.message || 'Price target reached.';
            
            if (!toAddr) {
                return {
                    statusCode: 400,
                    headers: { 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: "Missing recipient email address ('to')" })
                };
            }
            
            console.log("==========================================================================");
            console.log(`📧 [NETLIFY MOCK EMAIL GATEWAY] Sending Alert Email`);
            console.log(`   To:      ${toAddr}`);
            console.log(`   Subject: ${subject}`);
            console.log(`   Message: ${message}`);
            console.log("==========================================================================");
            
            return {
                statusCode: 200,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ success: true, simulated: true })
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
