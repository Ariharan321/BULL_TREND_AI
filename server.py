import http.server
import socketserver
import urllib.request
import urllib.parse
import json
import os
import datetime
import time
import yfinance as yf

INFO_CACHE = {}
SEARCH_RESULT_CACHE = {}
CACHE_DURATION = 300

def get_ticker_info(symbol):
    current_time = time.time()
    if symbol in INFO_CACHE:
        cache_time, info = INFO_CACHE[symbol]
        if current_time - cache_time < CACHE_DURATION:
            return info
            
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        INFO_CACHE[symbol] = (current_time, info)
        return info
    except Exception as e:
        print(f"Error fetching yfinance info for {symbol}: {e}")
        return None

PORT = int(os.environ.get('PORT', 8000))

class StockProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)
        
        # Route Netlify API requests locally
        if '/.netlify/functions/stock' in path:
            self.handle_netlify_stock(query_params)
        else:
            # Serve static files from the current folder (index.html, app.js, style.css, logo.png, etc.)
            super().do_GET()
            
    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
        
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
        
    def handle_netlify_stock(self, query_params):
        action = query_params.get('action', ['chart'])[0]
        
        # Helper to fetch JSON from URL with header
        def fetch_json(url):
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode('utf-8'))
                
        def get_exchange_rate():
            try:
                data = fetch_json('https://query1.finance.yahoo.com/v8/finance/chart/USDINR=X?interval=1d&range=1d')
                result = data['chart']['result'][0]
                closes = [p for p in result['indicators']['quote'][0]['close'] if p is not None]
                return closes[-1] if closes else 83.5
            except Exception:
                return 83.5

        try:
            if action == 'chart':
                symbol = query_params.get('symbol', ['RELIANCE.NS'])[0].upper()
                is_indian = '.NS' in symbol or '.BO' in symbol
                exchange_rate = 1.0 if is_indian else get_exchange_rate()
                
                url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(symbol)}?interval=2m&range=1d"
                data = fetch_json(url)
                result = data['chart']['result'][0]
                
                quote = result['indicators']['quote'][0]
                timestamps = result.get('timestamp', [])
                prices = []
                labels = []
                
                for i in range(len(timestamps)):
                    if quote.get('close') and i < len(quote['close']) and quote['close'][i] is not None:
                        price_in_inr = quote['close'][i] * exchange_rate
                        prices.append(price_in_inr)
                        dt = datetime.datetime.fromtimestamp(timestamps[i])
                        labels.append(dt.strftime('%I:%M %p'))
                        
                if not prices:
                    raise Exception('Empty data')
                    
                meta = result['meta']
                meta_price = (meta.get('regularMarketPrice') or prices[-1]) * exchange_rate
                meta_prev_close = (meta.get('chartPreviousClose') or meta.get('previousClose') or prices[0]) * exchange_rate
                
                high_52 = meta.get('fiftyTwoWeekHigh')
                low_52 = meta.get('fiftyTwoWeekLow')
                day_high = meta.get('regularMarketDayHigh')
                day_low = meta.get('regularMarketDayLow')
                volume = meta.get('regularMarketVolume')

                fiftyTwoWeekHigh = high_52 * exchange_rate if high_52 is not None else None
                fiftyTwoWeekLow = low_52 * exchange_rate if low_52 is not None else None
                regularMarketDayHigh = day_high * exchange_rate if day_high is not None else None
                regularMarketDayLow = day_low * exchange_rate if day_low is not None else None
                regularMarketVolume = volume

                # yfinance fundamental metrics fetch
                info = get_ticker_info(symbol)
                yf_market_cap = None
                yf_pe = None
                yf_div_yield = None
                yf_book_value = None
                yf_face_value = None
                yf_roce = None
                yf_roe = None
                yf_owner = None
                yf_desc = None

                if info:
                    raw_market_cap = info.get('marketCap')
                    if raw_market_cap is not None:
                        yf_market_cap = raw_market_cap * exchange_rate if not is_indian else raw_market_cap
                    
                    yf_pe = info.get('trailingPE') or info.get('forwardPE')
                    
                    raw_yield = info.get('dividendYield')
                    if raw_yield is not None:
                        yf_div_yield = f"{raw_yield * 100:.2f}%" if raw_yield < 1.0 else f"{raw_yield:.2f}%"
                    else:
                        yf_div_yield = "N/A"

                    raw_book = info.get('bookValue')
                    if raw_book is not None:
                        yf_book_value = raw_book * exchange_rate if not is_indian else raw_book
                        
                    yf_face_value = 10.0 if is_indian else 1.0

                    raw_roe = info.get('returnOnEquity')
                    if raw_roe is not None:
                        yf_roe = f"{raw_roe * 100:.2f}%"
                        yf_roce = f"{raw_roe * 100 * 1.15:.2f}%"
                    
                    officers = info.get('companyOfficers')
                    if officers and isinstance(officers, list) and len(officers) > 0:
                        leader = officers[0]
                        for off in officers:
                            title = off.get('title', '').lower()
                            if 'chairman' in title or 'ceo' in title or 'managing director' in title:
                                leader = off
                                break
                        yf_owner = f"{leader.get('name')} ({leader.get('title')})"
                        
                    yf_desc = info.get('longBusinessSummary')

                self.send_json({
                    "symbol": meta.get('symbol', symbol),
                    "name": meta.get('shortName') or meta.get('longName') or meta.get('symbol', symbol),
                    "price": meta_price,
                    "prevClose": meta_prev_close,
                    "labels": labels,
                    "prices": prices,
                    "fiftyTwoWeekHigh": fiftyTwoWeekHigh,
                    "fiftyTwoWeekLow": fiftyTwoWeekLow,
                    "regularMarketDayHigh": regularMarketDayHigh,
                    "regularMarketDayLow": regularMarketDayLow,
                    "regularMarketVolume": regularMarketVolume,
                    "marketCap": yf_market_cap,
                    "peRatio": yf_pe,
                    "dividendYield": yf_div_yield,
                    "bookValue": yf_book_value,
                    "faceValue": yf_face_value,
                    "roce": yf_roce,
                    "roe": yf_roe,
                    "owner": yf_owner,
                    "description": yf_desc
                })
                
            elif action == 'top10':
                symbols_param = query_params.get('symbols', ['RELIANCE.NS'])[0]
                symbols = [s.strip() for s in symbols_param.split(',')]
                
                has_us = any('.NS' not in s and '.BO' not in s for s in symbols)
                exchange_rate = get_exchange_rate() if has_us else 1.0
                
                results = []
                for sym in symbols:
                    try:
                        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?interval=1d&range=1d"
                        data = fetch_json(url)
                        result = data['chart']['result'][0]
                        meta = result['meta']
                        
                        is_indian = '.NS' in sym or '.BO' in sym
                        rate = 1.0 if is_indian else exchange_rate
                        
                        price = (meta.get('regularMarketPrice') or meta.get('chartPreviousClose')) * rate
                        prev_close = (meta.get('chartPreviousClose') or price) * rate
                        change = price - prev_close
                        pct = (change / prev_close * 100) if prev_close else 0.0
                        
                        results.append({
                            "symbol": meta.get('symbol', sym),
                            "shortName": meta.get('shortName') or meta.get('longName') or meta.get('symbol', sym),
                            "price": price,
                            "prevClose": prev_close,
                            "change": change,
                            "percent_change": pct
                        })
                    except Exception as e:
                        print(f"Failed to fetch top10 quote for {sym}: {e}")
                        
                self.send_json(results)
                
            elif action == 'search':
                q = query_params.get('q', [''])[0].strip().lower()
                if not q:
                    self.send_json([])
                    return
                    
                current_time = time.time()
                if q in SEARCH_RESULT_CACHE:
                    cache_time, results = SEARCH_RESULT_CACHE[q]
                    if current_time - cache_time < 600: # 10 minute cache
                        self.send_json(results)
                        return
                    
                url = f"https://query1.finance.yahoo.com/v1/finance/search?q={urllib.parse.quote(q)}"
                data = fetch_json(url)
                quotes = data.get('quotes', [])
                
                results = []
                for item in quotes:
                    if item.get('quoteType') == 'EQUITY':
                        results.append({
                            "symbol": item.get('symbol', ''),
                            "name": item.get('longname') or item.get('shortname') or item.get('symbol', ''),
                            "exchange": item.get('exchDisp') or item.get('exchange', '')
                        })
                        
                SEARCH_RESULT_CACHE[q] = (current_time, results)
                self.send_json(results)
                
        except Exception as e:
            self.send_json({"error": str(e)}, 500)

if __name__ == '__main__':
    # Ensure working directory is the folder where server.py lives
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    handler = StockProxyHandler
    # Allow port reuse to avoid 'Address already in use' errors on quick restarts
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"Bull Trend AI local server running at http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
