let EXCHANGE_RATE_CACHE = {};
let CACHE_TIME = {};

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

    // Helper to fetch live exchange rate
    async function getExchangeRate(fromCurrency = 'USD') {
        if (fromCurrency === 'INR') return 1.0;
        const now = Date.now();
        if (EXCHANGE_RATE_CACHE[fromCurrency] && (now - CACHE_TIME[fromCurrency] < 3600000)) {
            return EXCHANGE_RATE_CACHE[fromCurrency];
        }
        try {
            const data = await fetchJson(`https://query1.finance.yahoo.com/v8/finance/chart/${fromCurrency}INR=X?interval=1d&range=1d`);
            const quote = data.chart.result[0].indicators.quote[0];
            const prices = quote.close.filter(p => p !== null);
            const rate = prices[prices.length - 1] || 83.5;
            EXCHANGE_RATE_CACHE[fromCurrency] = rate;
            CACHE_TIME[fromCurrency] = now;
            return rate;
        } catch(e) {
            console.error(`Error fetching exchange rate for ${fromCurrency}:`, e.message);
            return 83.5; 
        }
    }

    try {
        if (action === 'chart') {
            let symbol = event.queryStringParameters.symbol || 'RELIANCE.NS';
            symbol = symbol.toUpperCase();
            
            const range = event.queryStringParameters.range || '2y';
            const interval = event.queryStringParameters.interval || '1d';
            
            // Check if US stock
            const isIndian = symbol.includes('.NS') || symbol.includes('.BO');
            
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
            const data = await fetchJson(url);
            const result = data.chart.result[0];
            
            const currency = result.meta.currency || (isIndian ? 'INR' : 'USD');
            const exchangeRate = await getExchangeRate(currency);
            
            const quote = result.indicators.quote[0];
            const timestamps = result.timestamp || [];
            const prices = [];
            const labels = [];
            
            const isIntraday = interval.endsWith('m') || interval.endsWith('h') || range === '1d';
            for (let i = 0; i < timestamps.length; i++) {
                if (quote.close && quote.close[i] !== null && quote.close[i] !== undefined) {
                    const priceInNative = quote.close[i];
                    prices.push(priceInNative * exchangeRate);
                    const date = new Date(timestamps[i] * 1000);
                    if (isIntraday) {
                        labels.push(date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }));
                    } else {
                        labels.push(date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }));
                    }
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
                    currency: 'INR'
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
                    const currency = meta.currency || (isIndian ? 'INR' : 'USD');
                    const rate = await getExchangeRate(currency);
                    
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
                        currency: 'INR'
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
            
            const resendApiKey = process.env.RESEND_API_KEY || 're_RcTptMHS_KwvT8v4KHzHfSgobJ6ngdR53';
            if (resendApiKey) {
                try {
                    const resendUrl = "https://api.resend.com/emails";
                    const response = await fetch(resendUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${resendApiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            from: "Bull Trend AI <onboarding@resend.dev>",
                            to: toAddr,
                            subject: subject,
                            text: message
                        })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        console.log(`[Resend API Netlify] Email successfully sent to ${toAddr}:`, data);
                        return {
                            statusCode: 200,
                            headers: { 'Access-Control-Allow-Origin': '*' },
                            body: JSON.stringify({ success: true, simulated: false })
                        };
                    } else {
                        const errText = await response.text();
                        console.error(`[Resend API Netlify Error] Response not OK: ${errText}`);
                        return {
                            statusCode: 500,
                            headers: { 'Access-Control-Allow-Origin': '*' },
                            body: JSON.stringify({ error: `Resend API Error: ${errText}` })
                        };
                    }
                } catch (err) {
                    console.error(`[Resend API Netlify Exception] Failed to send email to ${toAddr}:`, err.message);
                    return {
                        statusCode: 500,
                        headers: { 'Access-Control-Allow-Origin': '*' },
                        body: JSON.stringify({ error: err.message })
                    };
                }
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
