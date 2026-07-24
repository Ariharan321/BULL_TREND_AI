import http.server
import socketserver
import urllib.request
import urllib.parse
import json
import os
import datetime
import concurrent.futures
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
        elif '/api/top10' in path:
            self.handle_top10(query_params)
        else:
            # Serve static files from the current folder (index.html, app.js, style.css, logo.png, etc.)
            super().do_GET()
            
    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
        
    def handle_top10(self, query_params):
        try:
            symbols = query_params.get('symbols', [''])[0]
            if not symbols:
                return self.send_json([])
            symbol_list = [s.strip() for s in symbols.split(',') if s.strip()]
            
            # Use threads for faster downloading of multiple tickers
            data = yf.download(tickers=symbol_list, period='2d', group_by='ticker', threads=True, progress=False)
            results = []
            
            for sym in symbol_list:
                try:
                    if len(symbol_list) == 1:
                        df = data
                    else:
                        df = data[sym]
                        
                    df = df.dropna(subset=['Close'])
                    if len(df) >= 1:
                        current_price = df['Close'].iloc[-1]
                        # Use pandas checking for scalar values
                        current_price = current_price.item() if hasattr(current_price, 'item') else float(current_price)
                        
                        if len(df) >= 2:
                            prev_close = df['Close'].iloc[-2]
                            prev_close = prev_close.item() if hasattr(prev_close, 'item') else float(prev_close)
                            change = current_price - prev_close
                            pct_change = (change / prev_close) * 100
                        else:
                            change = 0.0
                            pct_change = 0.0
                            
                        currency = 'INR' if sym.endswith('.NS') or sym.endswith('.BO') else 'USD'
                        results.append({
                            'symbol': sym,
                            'price': float(current_price),
                            'change': float(change),
                            'percent_change': float(pct_change),
                            'currency': currency
                        })
                except Exception as e:
                    print(f"Error processing ticker {sym}: {e}")
                    
            self.send_json(results)
        except Exception as e:
            self.send_json({"error": str(e)}, status=500)

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
                exchange_rate = 1.0
                
                range_param = query_params.get('range', ['2y'])[0]
                interval_param = query_params.get('interval', ['1d'])[0]
                
                url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(symbol)}?interval={interval_param}&range={range_param}"
                data = fetch_json(url)
                result = data['chart']['result'][0]
                
                quote = result['indicators']['quote'][0]
                timestamps = result.get('timestamp', [])
                prices = []
                labels = []
                
                is_intraday = interval_param.endswith('m') or interval_param.endswith('h') or range_param == '1d'
                for i in range(len(timestamps)):
                    if quote.get('close') and i < len(quote['close']) and quote['close'][i] is not None:
                        price_in_native = quote['close'][i]
                        prices.append(price_in_native)
                        dt = datetime.datetime.fromtimestamp(timestamps[i])
                        if is_intraday:
                            labels.append(dt.strftime('%H:%M'))
                        else:
                            labels.append(dt.strftime('%d %b %Y'))
                        
                if not prices:
                    raise Exception('Empty data')
                    
                meta = result['meta']
                raw_price = meta.get('regularMarketPrice')
                if raw_price is not None:
                    meta_price = raw_price * exchange_rate
                else:
                    meta_price = prices[-1]
                
                raw_prev_close = meta.get('chartPreviousClose') or meta.get('previousClose')
                if raw_prev_close is not None:
                    meta_prev_close = raw_prev_close * exchange_rate
                else:
                    meta_prev_close = prices[0]
                
                high_52 = meta.get('fiftyTwoWeekHigh')
                low_52 = meta.get('fiftyTwoWeekLow')
                day_high = meta.get('regularMarketDayHigh')
                day_low = meta.get('regularMarketDayLow')
                volume = meta.get('regularMarketVolume')
 
                fiftyTwoWeekHigh = high_52 if high_52 is not None else None
                fiftyTwoWeekLow = low_52 if low_52 is not None else None
                regularMarketDayHigh = day_high if day_high is not None else None
                regularMarketDayLow = day_low if day_low is not None else None
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
                        yf_market_cap = raw_market_cap
                    
                    yf_pe = info.get('trailingPE') or info.get('forwardPE')
                    
                    raw_yield = info.get('dividendYield')
                    if raw_yield is not None:
                        yf_div_yield = f"{raw_yield * 100:.2f}%" if raw_yield < 1.0 else f"{raw_yield:.2f}%"
                    else:
                        yf_div_yield = "N/A"
 
                    raw_book = info.get('bookValue')
                    if raw_book is not None:
                        yf_book_value = raw_book
                        
                    yf_face_value = info.get('faceValue')
                    if yf_face_value is None:
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
                    "description": yf_desc,
                    "currency": meta.get('currency', 'INR' if is_indian else 'USD')
                })
                
            elif action == 'top10':
                symbols_param = query_params.get('symbols', ['RELIANCE.NS'])[0]
                symbols = [s.strip() for s in symbols_param.split(',')]
                raw = query_params.get('raw', ['0'])[0] == '1'
                
                exchange_rate = 1.0
                
                def fetch_single_quote(sym):
                    try:
                        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?interval=1d&range=1d"
                        data = fetch_json(url)
                        result = data['chart']['result'][0]
                        meta = result['meta']
                        
                        is_indian = '.NS' in sym or '.BO' in sym
                        rate = 1.0
                        
                        raw_price = meta.get('regularMarketPrice') or meta.get('chartPreviousClose')
                        raw_prev_close = meta.get('chartPreviousClose') or raw_price
                        
                        price = raw_price * rate if raw_price is not None else None
                        prev_close = raw_prev_close * rate if raw_prev_close is not None else None
                        change = price - prev_close
                        pct = (change / prev_close * 100) if prev_close else 0.0
                        
                        return {
                            "symbol": meta.get('symbol', sym),
                            "shortName": meta.get('shortName') or meta.get('longName') or meta.get('symbol', sym),
                            "price": price,
                            "prevClose": prev_close,
                            "change": change,
                            "percent_change": pct,
                            "currency": meta.get('currency', 'USD')
                        }
                    except Exception as e:
                        print(f"Failed to fetch quote for {sym}: {e}")
                        return None

                results = []
                with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(symbols), 40)) as executor:
                    futures = [executor.submit(fetch_single_quote, sym) for sym in symbols]
                    for f in concurrent.futures.as_completed(futures):
                        res = f.result()
                        if res is not None:
                            results.append(res)
                            
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
                
            elif action == 'send_email':
                to_addr = query_params.get('to', [''])[0]
                subject = query_params.get('subject', ['Bull Trend AI Price Alert'])[0]
                message = query_params.get('message', ['Price target reached.'])[0]
                
                if not to_addr:
                    self.send_json({"error": "Missing recipient email address ('to')"}, 400)
                    return
                
                smtp_server = os.environ.get('SMTP_SERVER', '')
                smtp_port = int(os.environ.get('SMTP_PORT', '587'))
                smtp_user = os.environ.get('SMTP_USER', '')
                smtp_password = os.environ.get('SMTP_PASSWORD', '')
                
                # Check if real SMTP credentials are set
                if smtp_server and smtp_user and smtp_password:
                    try:
                        import smtplib
                        from email.mime.text import MIMEText
                        from email.mime.multipart import MIMEMultipart
                        
                        msg = MIMEMultipart()
                        msg['From'] = smtp_user
                        msg['To'] = to_addr
                        msg['Subject'] = subject
                        msg.attach(MIMEText(message, 'plain'))
                        
                        # Set up connection
                        server = smtplib.SMTP(smtp_server, smtp_port)
                        server.starttls()
                        server.login(smtp_user, smtp_password)
                        server.sendmail(smtp_user, to_addr, msg.as_string())
                        server.quit()
                        
                        print(f"[SMTP Server] Real email alert successfully sent to {to_addr}")
                        self.send_json({"success": True, "simulated": False})
                    except Exception as err:
                        print(f"[SMTP Server Error] Failed to send real email to {to_addr}: {err}")
                        self.send_json({"success": False, "error": str(err)}, 500)
                else:
                    # Simulation/Fallback Mode
                    print("==========================================================================", flush=True)
                    print(f"[MOCK EMAIL GATEWAY] Sending Alert Email", flush=True)
                    print(f"   To:      {to_addr}", flush=True)
                    print(f"   Subject: {subject}", flush=True)
                    print(f"   Message: {message}", flush=True)
                    print("--------------------------------------------------------------------------", flush=True)
                    print("   [TIP] Setup environment variables to send real emails locally:", flush=True)
                    print("      set SMTP_SERVER=smtp.gmail.com", flush=True)
                    print("      set SMTP_PORT=587", flush=True)
                    print("      set SMTP_USER=your_email@gmail.com", flush=True)
                    print("      set SMTP_PASSWORD=your_app_password", flush=True)
                    print("==========================================================================", flush=True)
                    self.send_json({"success": True, "simulated": True})
                
        except Exception as e:
            self.send_json({"error": str(e)}, 500)

if __name__ == '__main__':
    # Ensure working directory is the folder where server.py lives
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Fix Windows registry MIME type corruption
    import mimetypes
    mimetypes.init()
    mimetypes.add_type('text/css', '.css')
    mimetypes.add_type('application/javascript', '.js')
    mimetypes.add_type('image/svg+xml', '.svg')
    
    handler = StockProxyHandler
    handler.extensions_map.update({
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.svg': 'image/svg+xml'
    })
    
    # Allow port reuse to avoid 'Address already in use' errors on quick restarts
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), handler) as httpd:
        print(f"Bull Trend AI local server running at http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
