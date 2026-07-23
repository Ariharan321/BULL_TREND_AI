import http.server
import socketserver
import urllib.request
import urllib.parse
import json
import os
import datetime
import threading
import time
import uuid
import database

# --- AUTOMATIC .ENV CONFIG LOADER ---
env_path = os.path.join(os.path.dirname(__file__) or '.', '.env')
if os.path.exists(env_path):
    try:
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    os.environ[key.strip()] = val.strip().strip('"').strip("'")
    except Exception as e:
        print(f"Error loading .env file: {e}")

PORT = int(os.environ.get('PORT', 8000))

def safe_print(msg):
    try:
        print(msg)
    except UnicodeEncodeError:
        try:
            print(msg.encode('ascii', 'ignore').decode('ascii'))
        except Exception:
            pass

# Active Session store (Token -> User database record)
sessions = {}

# Exchange rate cache
cached_exchange_rate = {"rate": 83.5, "timestamp": 0}

def get_exchange_rate_cached():
    now = time.time()
    # Cache USD/INR rate for 10 minutes
    if now - cached_exchange_rate["timestamp"] > 600:
        try:
            url = 'https://query1.finance.yahoo.com/v8/finance/chart/USDINR=X?interval=1d&range=1d'
            headers = {"User-Agent": "Mozilla/5.0"}
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
                result = data['chart']['result'][0]
                closes = [p for p in result['indicators']['quote'][0]['close'] if p is not None]
                if closes:
                    cached_exchange_rate["rate"] = closes[-1]
                    cached_exchange_rate["timestamp"] = now
        except Exception as e:
            print(f"Error fetching USD/INR exchange rate: {e}")
    return cached_exchange_rate["rate"]

def fetch_stock_quote(symbol):
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(symbol)}?interval=1d&range=1d"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            result = data['chart']['result'][0]
            meta = result['meta']
            
            is_indian = '.NS' in symbol or '.BO' in symbol
            rate = 1.0 if is_indian else get_exchange_rate_cached()
            
            price = (meta.get('regularMarketPrice') or meta.get('chartPreviousClose') or 0.0) * rate
            prev_close = (meta.get('chartPreviousClose') or price) * rate
            day_high = (meta.get('regularMarketDayHigh') or price) * rate
            day_low = (meta.get('regularMarketDayLow') or price) * rate
            
            change = price - prev_close
            pct = (change / prev_close * 100) if prev_close else 0.0
            
            market_state = meta.get('marketState', 'CLOSED')
            market_open = market_state in ['REGULAR', 'PREPRE', 'PRE', 'POST', 'POSTPOST']
            
            return {
                "symbol": meta.get('symbol', symbol),
                "name": meta.get('shortName') or meta.get('longName') or meta.get('symbol', symbol),
                "price": price,
                "prevClose": prev_close,
                "change": change,
                "percent_change": pct,
                "high": day_high,
                "low": day_low,
                "market_status": "Open" if market_open else "Closed"
            }
    except Exception as e:
        print(f"Error fetching quote for {symbol}: {e}")
        return None

# --- WORKER HEARTBEAT STATE ---
last_scheduler_check_time = 0.0
dynamic_app_url = None

def update_dynamic_app_url(headers):
    global dynamic_app_url
    host_header = headers.get('Host')
    if host_header:
        proto = headers.get('X-Forwarded-Proto', 'http')
        dynamic_app_url = f"{proto}://{host_header}"

class EmailService:
    @staticmethod
    def send_email(to_email, subject, html_content):
        api_key = os.environ.get('RESEND_API_KEY')
        sender = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
        
        if not api_key:
            err = "RESEND_API_KEY environment variable is not configured."
            safe_print(f"[Email Failed] Failed to deliver to {to_email} | Subject: {subject} | Error: {err}")
            return False, err
            
        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "from": f"Bull Trend AI <{sender}>" if "@" in sender else sender,
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        
        last_error = None
        for attempt in range(1, 4):
            safe_print(f"[Email Service] Attempt {attempt}/3: Sending email request to {to_email}...")
            try:
                req = urllib.request.Request(
                    url, 
                    data=json.dumps(payload).encode('utf-8'),
                    headers=headers,
                    method='POST'
                )
                with urllib.request.urlopen(req) as response:
                    res_body = json.loads(response.read().decode('utf-8'))
                    safe_print(f"[Email Sent Successfully] Delivered to {to_email} | Response: {res_body}")
                    return True, json.dumps(res_body)
            except Exception as e:
                if hasattr(e, 'read'):
                    try:
                        err_body = e.read().decode('utf-8')
                        last_error = f"HTTP {e.code}: {err_body}"
                    except Exception:
                        last_error = str(e)
                else:
                    last_error = str(e)
                safe_print(f"[Email Service] Attempt {attempt}/3 failed: {last_error}")
                if attempt < 3:
                    time.sleep(1)
        
        safe_print(f"[Email Failed] Failed to deliver to {to_email} | Subject: {subject} | Error: {last_error}")
        return False, last_error

# --- BACKGROUND ALERT MONITOR SCHEDULER ---
def check_and_trigger_alerts():
    global last_scheduler_check_time
    last_scheduler_check_time = time.time()
    try:
        pending_alerts = database.get_pending_alerts()
        if not pending_alerts:
            return
            
        # Cache quotes to avoid multi-request duplicate lookups for the same symbol
        quote_cache = {}
        
        for alert in pending_alerts:
            symbol = alert['symbol']
            if symbol not in quote_cache:
                quote_cache[symbol] = fetch_stock_quote(symbol)
                
            quote = quote_cache[symbol]
            if not quote:
                # fetch_stock_quote prints [Stock API Error]
                continue
                
            current_price = quote['price']
            target_price = alert['target_price']
            condition = alert['condition']
            
            # Print live price check log
            safe_print(f"[Live Price Checked] Checked price for {symbol}: Rs.{current_price:.2f} (Market: {quote['market_status']})")
            
            triggered = False
            if condition == 'above' and current_price >= target_price:
                triggered = True
            elif condition == 'below' and current_price <= target_price:
                triggered = True
            elif condition == 'equals':
                # Allow 0.2% tolerance threshold
                tolerance = target_price * 0.002
                if abs(current_price - target_price) <= tolerance:
                    triggered = True
                    
            if triggered:
                safe_print(f"[Alert Triggered] Alert ID: {alert['id']} | Symbol: {symbol} | Target: Rs.{target_price:.2f} | Current: Rs.{current_price:.2f} | Condition: {condition}")
                
                # 1. Update SQLite database record first (Prevents duplicates as subsequent checks won't pick up 'triggered' status)
                database.trigger_alert(alert['id'], status='triggered', email_status='Pending')
                
                # 2. Construct Template
                user_name = alert.get('user_name', 'User')
                condition_text = "Goes Above" if condition == 'above' else ("Drops Below" if condition == 'below' else "Equals To")
                triggered_time = datetime.datetime.now().strftime('%d %b %Y, %I:%M %p')
                
                subject = "📈 Bull Trend AI – Stock Price Alert Triggered"
                app_url = os.environ.get('APP_URL') or dynamic_app_url or f"http://localhost:{PORT}"
                html_body = f"""<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: 'Outfit', -apple-system, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 24px; }}
        .card {{ background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 30px; max-width: 600px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
        .logo {{ font-size: 26px; font-weight: 700; color: #3b82f6; text-align: center; margin-bottom: 24px; letter-spacing: -0.5px; }}
        .body-text {{ font-size: 15px; color: #cbd5e1; line-height: 1.6; margin-bottom: 20px; }}
        .footer {{ text-align: center; font-size: 12px; color: #64748b; margin-top: 30px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; }}
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">Bull Trend <span style="color:#8b5cf6">AI</span></div>
        <div class="body-text">
            Hello {user_name},<br><br>
            Your stock price alert has been triggered.<br><br>
            Stock: {quote.get('name', symbol)} ({symbol})<br>
            Current Price: ₹{current_price:.2f}<br>
            Target Price: ₹{target_price:.2f}<br>
            Condition: {condition_text}<br>
            Triggered At: {triggered_time}<br><br>
            <a href="{app_url}" style="color: #3b82f6; text-decoration: underline;">Click here to view your dashboard and market details.</a><br><br>
            Thank you,<br>
            Bull Trend AI Team
        </div>
    </div>
</body>
</html>
"""
                # Send email immediately
                sent_ok, response_detail = EmailService.send_email(alert['email'], subject, html_body)
                if sent_ok:
                    database.trigger_alert(alert['id'], status='triggered', email_status='Sent')
                else:
                    database.trigger_alert(alert['id'], status='triggered', email_status='Failed', email_error=response_detail)
    except Exception as exc:
        safe_print(f"[Scheduler Error] Exception in check_and_trigger_alerts: {exc}")

def start_alert_scheduler():
    def run_scheduler():
        # Delay startup check
        time.sleep(5)
        while True:
            try:
                check_and_trigger_alerts()
            except Exception as e:
                print(f"[Scheduler Error] Exception in checker loop: {e}")
            time.sleep(30)
            
    t = threading.Thread(target=run_scheduler, daemon=True)
    t.start()

POPULAR_STOCKS = [
    {"symbol": "AAPL", "name": "Apple Inc.", "exchange": "NASDAQ"},
    {"symbol": "AMZN", "name": "Amazon.com, Inc.", "exchange": "NASDAQ"},
    {"symbol": "ADANIENT.NS", "name": "Adani Enterprises Limited", "exchange": "NSE"},
    {"symbol": "AXISBANK.NS", "name": "Axis Bank Limited", "exchange": "NSE"},
    {"symbol": "ASIANPAINT.NS", "name": "Asian Paints Limited", "exchange": "NSE"},
    {"symbol": "APOLLOHOSP.NS", "name": "Apollo Hospitals Enterprise Limited", "exchange": "NSE"},
    {"symbol": "ADANIPORTS.NS", "name": "Adani Ports and Special Economic Zone Limited", "exchange": "NSE"},
    {"symbol": "AMD", "name": "Advanced Micro Devices, Inc.", "exchange": "NASDAQ"},
    {"symbol": "ABNB", "name": "Airbnb, Inc.", "exchange": "NASDAQ"},
    {"symbol": "ASML", "name": "ASML Holding N.V.", "exchange": "NASDAQ"},
    {"symbol": "BHARTIARTL.NS", "name": "Bharti Airtel Limited", "exchange": "NSE"},
    {"symbol": "BPCL.NS", "name": "Bharat Petroleum Corporation Limited", "exchange": "NSE"},
    {"symbol": "BRK.B", "name": "Berkshire Hathaway Inc.", "exchange": "NYSE"},
    {"symbol": "BABA", "name": "Alibaba Group Holding Limited", "exchange": "NYSE"},
    {"symbol": "BA", "name": "The Boeing Company", "exchange": "NYSE"},
    {"symbol": "CIPLA.NS", "name": "Cipla Limited", "exchange": "NSE"},
    {"symbol": "COALINDIA.NS", "name": "Coal India Limited", "exchange": "NSE"},
    {"symbol": "COF", "name": "Capital One Financial Corporation", "exchange": "NYSE"},
    {"symbol": "CRM", "name": "Salesforce, Inc.", "exchange": "NYSE"},
    {"symbol": "CSCO", "name": "Cisco Systems, Inc.", "exchange": "NASDAQ"},
    {"symbol": "DIVISLAB.NS", "name": "Divi's Laboratories Limited", "exchange": "NSE"},
    {"symbol": "DRREDDY.NS", "name": "Dr. Reddy's Laboratories Limited", "exchange": "NSE"},
    {"symbol": "DIS", "name": "The Walt Disney Company", "exchange": "NYSE"},
    {"symbol": "GOOGL", "name": "Alphabet Inc.", "exchange": "NASDAQ"},
    {"symbol": "GS", "name": "The Goldman Sachs Group, Inc.", "exchange": "NYSE"},
    {"symbol": "GRASIM.NS", "name": "Grasim Industries Limited", "exchange": "NSE"},
    {"symbol": "HDFCBANK.NS", "name": "HDFC Bank Limited", "exchange": "NSE"},
    {"symbol": "HCLTECH.NS", "name": "HCL Technologies Limited", "exchange": "NSE"},
    {"symbol": "HINDUNILVR.NS", "name": "Hindustan Unilever Limited", "exchange": "NSE"},
    {"symbol": "HD", "name": "The Home Depot, Inc.", "exchange": "NYSE"},
    {"symbol": "HON", "name": "Honeywell International Inc.", "exchange": "NYSE"},
    {"symbol": "ICICIBANK.NS", "name": "ICICI Bank Limited", "exchange": "NSE"},
    {"symbol": "INFY.NS", "name": "Infosys Limited", "exchange": "NSE"},
    {"symbol": "ITC.NS", "name": "ITC Limited", "exchange": "NSE"},
    {"symbol": "INTC", "name": "Intel Corporation", "exchange": "NASDAQ"},
    {"symbol": "IBM", "name": "International Business Machines Corporation", "exchange": "NYSE"},
    {"symbol": "JSWSTEEL.NS", "name": "JSW Steel Limited", "exchange": "NSE"},
    {"symbol": "JNJ", "name": "Johnson & Johnson", "exchange": "NYSE"},
    {"symbol": "JPM", "name": "JPMorgan Chase & Co.", "exchange": "NYSE"},
    {"symbol": "KOTAKBANK.NS", "name": "Kotak Mahindra Bank Limited", "exchange": "NSE"},
    {"symbol": "KO", "name": "The Coca-Cola Company", "exchange": "NYSE"},
    {"symbol": "LT.NS", "name": "Larsen & Toubro Limited", "exchange": "NSE"},
    {"symbol": "LRCX", "name": "Lam Research Corporation", "exchange": "NASDAQ"},
    {"symbol": "LLY", "name": "Eli Lilly and Company", "exchange": "NYSE"},
    {"symbol": "MSFT", "name": "Microsoft Corporation", "exchange": "NASDAQ"},
    {"symbol": "META", "name": "Meta Platforms, Inc.", "exchange": "NASDAQ"},
    {"symbol": "M&M.NS", "name": "Mahindra & Mahindra Limited", "exchange": "NSE"},
    {"symbol": "MARUTI.NS", "name": "Maruti Suzuki India Limited", "exchange": "NSE"},
    {"symbol": "MRF.NS", "name": "MRF Limited", "exchange": "NSE"},
    {"symbol": "NVDA", "name": "NVIDIA Corporation", "exchange": "NASDAQ"},
    {"symbol": "NFLX", "name": "Netflix, Inc.", "exchange": "NASDAQ"},
    {"symbol": "NTPC.NS", "name": "NTPC Limited", "exchange": "NSE"},
    {"symbol": "NESTLEIND.NS", "name": "Nestle India Limited", "exchange": "NSE"},
    {"symbol": "ONGC.NS", "name": "Oil and Natural Gas Corporation Limited", "exchange": "NSE"},
    {"symbol": "ORCL", "name": "Oracle Corporation", "exchange": "NYSE"},
    {"symbol": "POWERGRID.NS", "name": "Power Grid Corporation of India Limited", "exchange": "NSE"},
    {"symbol": "PYPL", "name": "PayPal Holdings, Inc.", "exchange": "NASDAQ"},
    {"symbol": "PEP", "name": "PepsiCo, Inc.", "exchange": "NASDAQ"},
    {"symbol": "PFE", "name": "Pfizer Inc.", "exchange": "NYSE"},
    {"symbol": "RELIANCE.NS", "name": "Reliance Industries Limited", "exchange": "NSE"},
    {"symbol": "SBIN.NS", "name": "State Bank of India", "exchange": "NSE"},
    {"symbol": "SUNPHARMA.NS", "name": "Sun Pharmaceutical Industries Limited", "exchange": "NSE"},
    {"symbol": "SBUX", "name": "Starbucks Corporation", "exchange": "NASDAQ"},
    {"symbol": "SHOP", "name": "Shopify Inc.", "exchange": "NYSE"},
    {"symbol": "TCS.NS", "name": "Tata Consultancy Services Limited", "exchange": "NSE"},
    {"symbol": "TATAMOTORS.NS", "name": "Tata Motors Limited", "exchange": "NSE"},
    {"symbol": "TATASTEEL.NS", "name": "Tata Steel Limited", "exchange": "NSE"},
    {"symbol": "TECHM.NS", "name": "Tech Mahindra Limited", "exchange": "NSE"},
    {"symbol": "TSLA", "name": "Tesla, Inc.", "exchange": "NASDAQ"},
    {"symbol": "TXN", "name": "Texas Instruments Incorporated", "exchange": "NASDAQ"},
    {"symbol": "ULTRACEMCO.NS", "name": "UltraTech Cement Limited", "exchange": "NSE"},
    {"symbol": "UNH", "name": "UnitedHealth Group Incorporated", "exchange": "NYSE"},
    {"symbol": "UPS", "name": "United Parcel Service, Inc.", "exchange": "NYSE"},
    {"symbol": "V", "name": "Visa Inc.", "exchange": "NYSE"},
    {"symbol": "VZ", "name": "Verizon Communications Inc.", "exchange": "NYSE"},
    {"symbol": "WIPRO.NS", "name": "Wipro Limited", "exchange": "NSE"},
    {"symbol": "WMT", "name": "Walmart Inc.", "exchange": "NYSE"}
]

# --- HTTP CUSTOM HANDLER ---
class StockProxyHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def get_auth_user(self):
        auth_header = self.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
            return sessions.get(token)
        return None

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):
        # Handle CORS preflight requests
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.end_headers()

    def do_GET(self):
        update_dynamic_app_url(self.headers)
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)
        
        # 1. Proxied Netlify stock queries
        if '/.netlify/functions/stock' in path:
            self.handle_netlify_stock(query_params)
            
        # 2. REST: Fetch current user profile
        elif path == '/api/auth/me':
            user = self.get_auth_user()
            if user:
                user_db = database.get_user_by_id(user["id"])
                if user_db:
                    self.send_json({
                        "id": user_db["id"],
                        "name": user_db["name"],
                        "username": user_db["username"],
                        "created_at": user_db["created_at"],
                        "profile_picture": user_db.get("profile_picture")
                    })
                else:
                    self.send_json({"error": "User not found"}, 404)
            else:
                self.send_json({"error": "Unauthorized"}, 401)
                
        # 3. REST: Get user watchlist
        elif path == '/api/watchlist':
            user = self.get_auth_user()
            if not user:
                self.send_json({"error": "Unauthorized"}, 401)
                return
            
            watchlist_items = database.get_watchlist(user['id'])
            results = []
            for item in watchlist_items:
                quote = fetch_stock_quote(item['symbol'])
                if quote:
                    results.append({
                        "id": item['id'],
                        "symbol": item['symbol'],
                        "company_name": item['company_name'],
                        "price": quote['price'],
                        "change": quote['change'],
                        "percent_change": quote['percent_change'],
                        "high": quote['high'],
                        "low": quote['low'],
                        "market_status": quote['market_status']
                    })
                else:
                    results.append({
                        "id": item['id'],
                        "symbol": item['symbol'],
                        "company_name": item['company_name'],
                        "price": 0.0,
                        "change": 0.0,
                        "percent_change": 0.0,
                        "high": 0.0,
                        "low": 0.0,
                        "market_status": "Closed"
                    })
            self.send_json(results)
            
        # 4. REST: Get user alerts
        elif path == '/api/alerts':
            user = self.get_auth_user()
            if not user:
                self.send_json({"error": "Unauthorized"}, 401)
                return
            alerts = database.get_user_alerts(user['id'])
            self.send_json(alerts)
            

        # 5. Serve static files from workspace root
        else:
            super().do_GET()

    def do_POST(self):
        update_dynamic_app_url(self.headers)
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8')
        try:
            body = json.loads(post_data) if post_data else {}
        except Exception:
            body = {}
            
        # 1. Auth: User registration
        if path == '/api/auth/signup':
            name = body.get('name', '').strip()
            username = body.get('username', '').strip()
            password = body.get('password', '')
            
            if not name or not username or len(password) < 4:
                self.send_json({"error": "Invalid registration data. Password must be >= 4 chars."}, 400)
                return
                
            user = database.create_user(name, username, password)
            if user:
                token = str(uuid.uuid4())
                sessions[token] = user
                self.send_json({
                    "token": token, 
                    "username": user["username"], 
                    "name": user["name"],
                    "profile_picture": None
                })
            else:
                self.send_json({"error": "Email/Username already registered."}, 400)
                
        # 2. Auth: User Login
        elif path == '/api/auth/login':
            username = body.get('username', '').strip()
            password = body.get('password', '')
            
            user = database.get_user_by_username(username)
            if user and database.verify_password(user['password_hash'], password):
                token = str(uuid.uuid4())
                sessions[token] = user
                self.send_json({
                    "token": token, 
                    "username": user["username"], 
                    "name": user["name"],
                    "profile_picture": user.get("profile_picture")
                })
            else:
                self.send_json({"error": "Invalid username or password."}, 400)
                
        # 3. Auth: Change Password
        elif path == '/api/auth/change-password':
            user = self.get_auth_user()
            if not user:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            current_pwd = body.get('current_password', '')
            new_pwd = body.get('new_password', '')
            
            user_db = database.get_user_by_id(user['id'])
            if user_db and database.verify_password(user_db['password_hash'], current_pwd):
                if len(new_pwd) < 4:
                    self.send_json({"error": "New password must be at least 4 characters long."}, 400)
                    return
                database.change_user_password(user['id'], new_pwd)
                self.send_json({"success": True})
            else:
                self.send_json({"error": "Current password is incorrect."}, 400)
                
        # 3b. Auth: Edit Profile Info
        elif path == '/api/auth/edit-profile':
            user = self.get_auth_user()
            if not user:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            name = body.get('name', '').strip()
            if not name:
                self.send_json({"error": "Name cannot be empty"}, 400)
                return
                
            database.update_profile_info(user['id'], name)
            
            # Update user memory cache in active sessions
            token = self.headers.get('Authorization', '')[7:]
            if token in sessions:
                sessions[token]['name'] = name
            self.send_json({"success": True})
            
        # 3c. Auth: Upload Profile Picture
        elif path == '/api/auth/profile-pic':
            user = self.get_auth_user()
            if not user:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            profile_pic = body.get('profile_picture', '')
            database.update_profile_picture(user['id'], profile_pic if profile_pic else None)
            
            # Update sessions cache
            token = self.headers.get('Authorization', '')[7:]
            if token in sessions:
                sessions[token]['profile_picture'] = profile_pic if profile_pic else None
            self.send_json({"success": True})
            
        # 3d. Auth: Send Test Email
        elif path == '/api/auth/test-email':
            user = self.get_auth_user()
            if not user:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            subject = "🧪 Bull Trend AI - Test Email Connection"
            html_body = f"""<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: 'Outfit', -apple-system, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 24px; }}
        .card {{ background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 30px; max-width: 600px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
        .logo {{ font-size: 26px; font-weight: 700; color: #3b82f6; text-align: center; margin-bottom: 24px; letter-spacing: -0.5px; }}
        .body-text {{ font-size: 15px; color: #cbd5e1; line-height: 1.6; margin-bottom: 20px; }}
        .footer {{ text-align: center; font-size: 12px; color: #64748b; margin-top: 30px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; }}
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">Bull Trend <span style="color:#8b5cf6">AI</span></div>
        <div class="body-text">
            Hello {user['name']},<br><br>
            This is a test email from <strong>Bull Trend AI</strong>.<br><br>
            Your email alert integration is successfully configured. You will now receive responsive HTML reports when your custom target stock thresholds are met.<br><br>
            Log in to Bull Trend AI to manage your stock watchlists and analyses.
        </div>
        <div class="footer">
            Thank you,<br>
            <strong>Bull Trend AI Team</strong>
        </div>
    </div>
</body>
</html>
"""
            sent_ok, response_detail = EmailService.send_email(user['username'], subject, html_body)
            if sent_ok:
                self.send_json({"success": True, "detail": response_detail})
            else:
                self.send_json({"error": "Failed to deliver email through SMTP/API provider.", "detail": response_detail}, 500)
                
        # 4. REST: Add to Watchlist
        elif path == '/api/watchlist':
            user = self.get_auth_user()
            if not user:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            symbol = body.get('symbol', '').strip().upper()
            if not symbol:
                self.send_json({"error": "Symbol required"}, 400)
                return
                
            quote = fetch_stock_quote(symbol)
            company_name = quote['name'] if quote else symbol
            
            database.add_to_watchlist(user['id'], symbol, company_name)
            self.send_json({"success": True})
            
        # 5. REST: Create Price Alert
        elif path == '/api/alerts':
            user = self.get_auth_user()
            if not user:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            symbol = body.get('symbol', '').strip().upper()
            target_price_val = body.get('target_price')
            condition = body.get('condition', 'above').strip().lower()
            email = body.get('email', '').strip()
            
            if not symbol or target_price_val is None or not email:
                self.send_json({"error": "Missing alert configurations"}, 400)
                return
                
            try:
                target_price = float(target_price_val)
            except ValueError:
                self.send_json({"error": "Target price must be numeric"}, 400)
                return
                
            quote = fetch_stock_quote(symbol)
            company_name = quote['name'] if quote else symbol
            
            database.create_alert(user['id'], symbol, company_name, target_price, condition, email)
            safe_print(f"[Alert Created] User ID: {user['id']} | Symbol: {symbol} | Target: Rs.{target_price} | Condition: {condition} | Email: {email}")
            self.send_json({"success": True})
            
        # 6. REST: Recreate Alert (restore triggered/cancelled alerts to pending)
        elif path == '/api/alerts/recreate':
            user = self.get_auth_user()
            if not user:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            alert_id_val = body.get('id')
            if alert_id_val is None:
                self.send_json({"error": "Alert ID required"}, 400)
                return
                
            database.recreate_alert(user['id'], int(alert_id_val))
            self.send_json({"success": True})
            
        else:
            self.send_json({"error": "Path not found"}, 404)

    def do_DELETE(self):
        update_dynamic_app_url(self.headers)
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)
        
        # 1. REST: Remove from watchlist
        if path == '/api/watchlist':
            user = self.get_auth_user()
            if not user:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            symbol = query_params.get('symbol', [''])[0].upper()
            if not symbol:
                self.send_json({"error": "Symbol required"}, 400)
                return
                
            database.remove_from_watchlist(user['id'], symbol)
            self.send_json({"success": True})
            
        # 2. REST: Cancel/delete price alert
        elif path == '/api/alerts':
            user = self.get_auth_user()
            if not user:
                self.send_json({"error": "Unauthorized"}, 401)
                return
                
            alert_id_str = query_params.get('id', [''])[0]
            action = query_params.get('action', ['cancel'])[0]
            
            if not alert_id_str:
                self.send_json({"error": "Alert ID required"}, 400)
                return
                
            alert_id = int(alert_id_str)
            if action == 'delete':
                database.delete_alert(user['id'], alert_id)
            else:
                database.cancel_alert(user['id'], alert_id)
            self.send_json({"success": True})
        else:
            self.send_json({"error": "Path not found"}, 404)

    def handle_netlify_stock(self, query_params):
        action = query_params.get('action', ['chart'])[0]
        
        # Internal downloader helper
        def fetch_json(url):
            headers = {"User-Agent": "Mozilla/5.0"}
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode('utf-8'))

        try:
            if action == 'chart':
                symbol = query_params.get('symbol', ['RELIANCE.NS'])[0].upper()
                is_indian = '.NS' in symbol or '.BO' in symbol
                exchange_rate = 1.0 if is_indian else get_exchange_rate_cached()
                
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
                    raise Exception('Empty chart prices data')
                    
                meta = result['meta']
                meta_price = (meta.get('regularMarketPrice') or prices[-1]) * exchange_rate
                meta_prev_close = (meta.get('chartPreviousClose') or meta.get('previousClose') or prices[0]) * exchange_rate
                
                self.send_json({
                    "symbol": meta.get('symbol', symbol),
                    "name": meta.get('shortName') or meta.get('longName') or meta.get('symbol', symbol),
                    "price": meta_price,
                    "prevClose": meta_prev_close,
                    "labels": labels,
                    "prices": prices
                })
                
            elif action == 'top10':
                symbols_param = query_params.get('symbols', ['RELIANCE.NS'])[0]
                symbols = [s.strip() for s in symbols_param.split(',')]
                
                has_us = any('.NS' not in s and '.BO' not in s for s in symbols)
                exchange_rate = get_exchange_rate_cached() if has_us else 1.0
                
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
                q = query_params.get('q', [''])[0]
                if not q.strip():
                    self.send_json([])
                    return
                    
                q_lower = q.lower()
                
                # Step 1: Pre-populate and match from POPULAR_STOCKS locally
                local_matches = []
                for stock in POPULAR_STOCKS:
                    symbol = stock["symbol"]
                    name = stock["name"]
                    s_lower = symbol.lower()
                    n_lower = name.lower()
                    clean_symbol = s_lower.split('.')[0]
                    
                    matched = False
                    priority = 99
                    
                    if s_lower.startswith(q_lower) or clean_symbol.startswith(q_lower):
                        matched = True
                        priority = 0
                    elif n_lower.startswith(q_lower):
                        matched = True
                        priority = 1
                        
                    if matched:
                        popularity = 80
                        if stock["exchange"] == "NSE":
                            popularity = 100
                        elif stock["exchange"] == "BSE":
                            popularity = 90
                        elif stock["exchange"] == "NYSE":
                            popularity = 75
                            
                        local_matches.append({
                            "symbol": symbol,
                            "name": name,
                            "exchange": stock["exchange"],
                            "priority": priority,
                            "popularity": popularity
                        })
                
                # Step 2: Query Yahoo Finance search API
                url = f"https://query1.finance.yahoo.com/v1/finance/search?q={urllib.parse.quote(q)}&quotesCount=50&newsCount=0"
                data = fetch_json(url)
                quotes = data.get('quotes', [])
                
                results = local_matches
                seen_symbols = {r["symbol"].upper() for r in results}
                
                for item in quotes:
                    if item.get('quoteType') == 'EQUITY':
                        symbol = item.get('symbol', '')
                        if symbol.upper() in seen_symbols:
                            continue
                            
                        name = item.get('longname') or item.get('shortname') or item.get('symbol', '')
                        exchange = item.get('exchDisp') or item.get('exchange', '')
                        
                        s_lower = symbol.lower()
                        n_lower = name.lower()
                        
                        matched = False
                        priority = 99
                        
                        if s_lower.startswith(q_lower):
                            matched = True
                            priority = 0
                        else:
                            clean_symbol = s_lower.split('.')[0]
                            if clean_symbol.startswith(q_lower):
                                matched = True
                                priority = 0
                                
                        if not matched and n_lower.startswith(q_lower):
                            matched = True
                            priority = 1
                            
                        if not matched:
                            continue
                            
                        popularity = 50
                        sym_upper = symbol.upper()
                        exch_upper = exchange.upper()
                        
                        if sym_upper.endswith('.NS') or 'NSI' in exch_upper or 'NSE' in exch_upper:
                            popularity = 100
                        elif sym_upper.endswith('.BO') or 'BSE' in exch_upper:
                            popularity = 90
                        elif 'NAS' in exch_upper or 'NMS' in exch_upper or 'NMS' in sym_upper:
                            popularity = 80
                        elif 'NYS' in exch_upper or 'NYQ' in exch_upper:
                            popularity = 70
                        elif 'PNK' in exch_upper or 'OBB' in exch_upper or 'OTC' in exch_upper:
                            popularity = 0
                            
                        results.append({
                            "symbol": symbol,
                            "name": name,
                            "exchange": exchange,
                            "priority": priority,
                            "popularity": popularity
                        })
                        seen_symbols.add(symbol.upper())
                        
                results.sort(key=lambda x: (x['priority'], -x['popularity'], x['name'].lower()))
                
                cleaned_results = []
                for r in results:
                    cleaned_results.append({
                        "symbol": r["symbol"],
                        "name": r["name"],
                        "exchange": r["exchange"]
                    })
                self.send_json(cleaned_results[:8])
                
        except Exception as e:
            self.send_json({"error": str(e)}, 500)

if __name__ == '__main__':
    # Initialize background scheduler checking pending stock alerts every 30 seconds
    start_alert_scheduler()
    
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    handler = StockProxyHandler
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"Bull Trend AI database-backed proxy server running at http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
