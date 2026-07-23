import sqlite3
import os
import hashlib
import binascii
from datetime import datetime

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db.sqlite3")

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def db_init():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        profile_picture TEXT,
        created_at TEXT NOT NULL
    );
    """)
    
    # Migration: Ensure profile_picture column exists
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN profile_picture TEXT;")
    except sqlite3.OperationalError:
        pass # Column already exists
    
    # 2. Watchlist Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS watchlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        symbol TEXT NOT NULL,
        company_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, symbol)
    );
    """)
    
    # 3. Alerts Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        user_name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        company_name TEXT NOT NULL,
        target_price REAL NOT NULL,
        condition TEXT NOT NULL,
        email TEXT NOT NULL,
        status TEXT NOT NULL, -- 'pending', 'triggered', 'cancelled'
        email_status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Sent', 'Failed'
        created_at TEXT NOT NULL,
        triggered_at TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)
    
    # Migration: Ensure user_name column exists in alerts
    try:
        cursor.execute("ALTER TABLE alerts ADD COLUMN user_name TEXT;")
    except sqlite3.OperationalError:
        pass # Column already exists

    # Migration: Ensure email_status column exists in alerts
    try:
        cursor.execute("ALTER TABLE alerts ADD COLUMN email_status TEXT DEFAULT 'Pending';")
    except sqlite3.OperationalError:
        pass # Column already exists

    # Migration: Ensure email_error column exists in alerts
    try:
        cursor.execute("ALTER TABLE alerts ADD COLUMN email_error TEXT;")
    except sqlite3.OperationalError:
        pass # Column already exists
    
    conn.commit()
    conn.close()
    print("Database initialized successfully.")

# --- PASSWORD HASHING HELPER ---
def hash_password(password):
    """Hash a password for storing in the database."""
    salt = hashlib.sha256(os.urandom(60)).hexdigest().encode('ascii')
    pwdhash = hashlib.pbkdf2_hmac('sha512', password.encode('utf-8'), salt, 100000)
    pwdhash = binascii.hexlify(pwdhash)
    return (salt + pwdhash).decode('ascii')

def verify_password(stored_password, provided_password):
    """Verify a stored password against one provided by user."""
    salt = stored_password[:64].encode('ascii')
    stored_hash = stored_password[64:]
    pwdhash = hashlib.pbkdf2_hmac('sha512', provided_password.encode('utf-8'), salt, 100000)
    pwdhash = binascii.hexlify(pwdhash).decode('ascii')
    return pwdhash == stored_hash

# --- USER MANAGEMENT ---
def create_user(name, username, password):
    conn = get_db_connection()
    cursor = conn.cursor()
    pwd_hash = hash_password(password)
    created_at = datetime.now().isoformat()
    try:
        cursor.execute(
            "INSERT INTO users (name, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (name, username.lower(), pwd_hash, created_at)
        )
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()
        return {"id": user_id, "name": name, "username": username, "created_at": created_at, "profile_picture": None}
    except sqlite3.IntegrityError:
        conn.close()
        return None  # Username already exists

def get_user_by_username(username):
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username.lower(),)).fetchone()
    conn.close()
    return dict(row) if row else None

def get_user_by_id(user_id):
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def change_user_password(user_id, new_password):
    conn = get_db_connection()
    cursor = conn.cursor()
    pwd_hash = hash_password(new_password)
    cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (pwd_hash, user_id))
    conn.commit()
    conn.close()
    return True

def update_profile_picture(user_id, base64_image):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET profile_picture = ? WHERE id = ?", (base64_image, user_id))
    conn.commit()
    conn.close()
    return True

def update_profile_info(user_id, name):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET name = ? WHERE id = ?", (name, user_id))
    conn.commit()
    conn.close()
    return True

# --- WATCHLIST MANAGEMENT ---
def add_to_watchlist(user_id, symbol, company_name):
    conn = get_db_connection()
    cursor = conn.cursor()
    created_at = datetime.now().isoformat()
    try:
        cursor.execute(
            "INSERT INTO watchlist (user_id, symbol, company_name, created_at) VALUES (?, ?, ?, ?)",
            (user_id, symbol.upper(), company_name, created_at)
        )
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        conn.close()
        return True  # Already on watchlist

def remove_from_watchlist(user_id, symbol):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM watchlist WHERE user_id = ? AND symbol = ?", (user_id, symbol.upper()))
    conn.commit()
    conn.close()
    return True

def get_watchlist(user_id):
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM watchlist WHERE user_id = ? ORDER BY created_at DESC", (user_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# --- ALERTS MANAGEMENT ---
def create_alert(user_id, symbol, company_name, target_price, condition, email):
    conn = get_db_connection()
    cursor = conn.cursor()
    created_at = datetime.now().isoformat()
    # Fetch current user name
    row = cursor.execute("SELECT name FROM users WHERE id = ?", (user_id,)).fetchone()
    user_name = row['name'] if row else 'User'
    
    cursor.execute(
        "INSERT INTO alerts (user_id, user_name, symbol, company_name, target_price, condition, email, status, email_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (user_id, user_name, symbol.upper(), company_name, target_price, condition.lower(), email, 'pending', 'Pending', created_at)
    )
    conn.commit()
    conn.close()
    return True

def cancel_alert(user_id, alert_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE alerts SET status = 'cancelled' WHERE user_id = ? AND id = ?", (user_id, alert_id))
    conn.commit()
    conn.close()
    return True

def delete_alert(user_id, alert_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM alerts WHERE user_id = ? AND id = ?", (user_id, alert_id))
    conn.commit()
    conn.close()
    return True

def recreate_alert(user_id, alert_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE alerts SET status = 'pending', email_status = 'Pending', email_error = NULL, triggered_at = NULL WHERE user_id = ? AND id = ?",
        (user_id, alert_id)
    )
    conn.commit()
    conn.close()
    return True

def get_user_alerts(user_id):
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC", (user_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_pending_alerts():
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT a.*, u.name as user_name 
        FROM alerts a 
        JOIN users u ON a.user_id = u.id 
        WHERE a.status = 'pending'
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def trigger_alert(alert_id, status='triggered', email_status='Pending', email_error=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    triggered_at = datetime.now().isoformat()
    cursor.execute(
        "UPDATE alerts SET status = ?, email_status = ?, email_error = ?, triggered_at = ? WHERE id = ?",
        (status, email_status, email_error, triggered_at, alert_id)
    )
    conn.commit()
    conn.close()
    return True

# Initialize database schema immediately on import
db_init()
