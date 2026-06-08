# CockroachDB Schema & Database Reference

This application uses **CockroachDB Cluster** (fully PostgreSQL compatible) as its primary SQL database engine for robust, multi-session user persistence and authentication.

---

## 🚀 Automated Auto-Bootstrapping / Schema Updates

The database contains an automatic schema manager (`/db.ts`) that runs **on server startup**. If the CockroachDB database is empty or missing those tables, they are automatically created instantly to prevent configuration or query runtime errors.

If no `COCKROACH_DB_URL` environment variable is provided, the backend automatically fails-soft to an **In-Memory Secure SQLite-Equivalent Mock Storage**, allowing you to preview or prototype the application perfectly without any dependencies!

---

## 📊 Database Schema Definition (SQL)

The tables below are defined with PostgreSQL/CockroachDB types:

```sql
-- 1. Users table (Handles password hashing securely and maps unique IDs)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. User Trades Journal (Main transaction journal)
CREATE TABLE IF NOT EXISTS user_trades (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR DEFAULT '',
  prefix VARCHAR,
  type VARCHAR DEFAULT 'LONG',
  entry_time NUMERIC DEFAULT 0,
  exit_time NUMERIC DEFAULT 0,
  entry_price NUMERIC DEFAULT 0,
  exit_price NUMERIC DEFAULT 0,
  rr NUMERIC DEFAULT 0,
  status VARCHAR DEFAULT 'SL',
  pips NUMERIC DEFAULT 0,
  timeframe VARCHAR DEFAULT '1m',
  duration VARCHAR DEFAULT '0m',
  drawing_id VARCHAR,
  watchlist_id VARCHAR,
  setup_grade VARCHAR,
  confluences JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  realized_at TIMESTAMPTZ
);

-- 3. Drawings Table (Saves chart drawings in JSONB format)
CREATE TABLE IF NOT EXISTS user_drawings (
  user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  drawings JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. User Preferences Settings (Themes, indicator states, and positions)
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. User Watchlist Table
CREATE TABLE IF NOT EXISTS user_watchlist (
  user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  items JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Backtest Sessions Table
CREATE TABLE IF NOT EXISTS user_backtest_sessions (
  user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sessions JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. Device Multi-Session Sync Link
CREATE TABLE IF NOT EXISTS user_sessions (
  user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  active_session_id VARCHAR,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. Customized Trade Setups Table
CREATE TABLE IF NOT EXISTS setups (
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grade VARCHAR NOT NULL,
  image_url TEXT,
  confluences JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, grade)
);
```

---

## 🔑 Authentication Settings & Keys

### 1. What is the `JWT_SECRET`?
The `JWT_SECRET` is a private, secure cryptographic secret key used by the custom authentication server (running on the Express backend `/api/auth/*` endpoints) to sign and verify JSON Web Tokens (JWT). This JWT securely authenticates user requests and represents their logged-in session, completely replacing third-party auth providers like Supabase Auth with standard, high-performance local tokens.

### 2. How to get or generate a `JWT_SECRET`?
You do not need to request this from a third party! It is a string key of your own choice. 

To generate a secure, industry-standard 256-bit cryptographically strong secret:
- Open your terminal and run:
  ```bash
  openssl rand -hex 32
  ```
- Copy the resulting string (looks like `d3a2e7c4f128...`) and save it as your `JWT_SECRET` variable in your settings page inside Google AI Studio, or paste it inside your `.env` file as:
  ```env
  JWT_SECRET="YOUR_GENERATED_SECRET_HERE"
  ```
- If not provided, the application will default to a secure development placeholder string so it still works seamlessly in-browser!
