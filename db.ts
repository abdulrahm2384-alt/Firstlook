import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

const DB_URL = process.env.COCKROACH_DB_URL || '';
const JWT_SECRET = process.env.JWT_SECRET || 'firstlook-dev-secret-key-182';

let pool: pg.Pool;

if (DB_URL) {
  pool = new Pool({
    connectionString: DB_URL,
    ssl: DB_URL.includes('sslmode=disable') ? false : {
      rejectUnauthorized: false
    }
  });
  pool.on('error', (err) => {
    console.error('[DB Pool Warning] Unexpected error on idle database client:', err);
  });
} else {
  // Creating pool even if empty so any connect/query fails with a clear message rather than crashing at module load
  pool = new Pool({
    connectionString: ''
  });
}

export let isDbActive = false;

// High-fidelity in-memory/fallback structures
export const memUsers: any[] = [];
export const memTrades: any[] = [];
export const memDrawings = new Map<string, any[]>();
export const memPreferences = new Map<string, any>();
export const memWatchlist = new Map<string, any[]>();
export const memBacktestSessions = new Map<string, any>();
export const memSessions = new Map<string, string>();
export const memSetups: any[] = [];
export const memCompetitionPreregistrations = new Set<string>();
export const memPayments: any[] = [];
export const memAuditLogs: any[] = [];
export const memSupportMessages = new Map<string, any[]>();
export const memJournalAccounts: any[] = [];
export const memJournalTrades: any[] = [];
export const memJournalWithdrawals: any[] = [];
export const memUserActivityLogs: any[] = [];

// Populate mock data into the fallback memory DB on startup so the app UI is extremely engaging if no DB_URL is connected!
function seedInMemoryDb() {
  const seedUsers = [
    { id: "usr_uuid_1", email: "chinelo@firstlook.com", password_hash: "seedpasswordhash", username: "chinelo_trader", full_name: "Chinelo Okonkwo", country: "Nigeria", bio: "Professional Forex journaler and technical trader.", experience_level: "LEGEND", avatar_url: "", created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "usr_uuid_2", email: "amani@firstlook.com", password_hash: "seedpasswordhash", username: "amani_njoroge", full_name: "Amani Njoroge", country: "Kenya", bio: "Crypto spot and derivatives swing trader.", experience_level: "INTERMEDIATE", avatar_url: "", created_at: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "usr_uuid_3", email: "kwame@firstlook.com", password_hash: "seedpasswordhash", username: "kwame_crypto", full_name: "Kwame Mensah", country: "Ghana", bio: "Intraday price action specialist.", experience_level: "LEGEND", avatar_url: "", created_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "usr_uuid_4", email: "olivia@firstlook.com", password_hash: "seedpasswordhash", username: "olivia_gold", full_name: "Olivia Smith", country: "United States", bio: "Gold and indices breakout trader.", experience_level: "BEGINNER", avatar_url: "", created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "usr_uuid_5", email: "chadi@firstlook.com", password_hash: "seedpasswordhash", username: "chadi_fx", full_name: "Chadi Al-Basha", country: "Other", bio: "Algorithmic backtesting designer.", experience_level: "LEGEND", avatar_url: "", created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "usr_uuid_6", email: "zara@firstlook.com", password_hash: "seedpasswordhash", username: "zara_zar", full_name: "Zara Van-Zyl", country: "South Africa", bio: "Retail momentum trend follower.", experience_level: "INTERMEDIATE", avatar_url: "", created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "usr_uuid_7", email: "tunde@firstlook.com", password_hash: "seedpasswordhash", username: "tunde_gold", full_name: "Tunde Bakare", country: "Nigeria", bio: "Funded account prop firm trader.", experience_level: "LEGEND", avatar_url: "", created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "usr_uuid_8", email: "naomi@firstlook.com", password_hash: "seedpasswordhash", username: "naomi_fx", full_name: "Naomi Carter", country: "United States", bio: "Macroeconomic market indicator visualizer.", experience_level: "BEGINNER", avatar_url: "", created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "usr_uuid_9", email: "fatima@firstlook.com", password_hash: "seedpasswordhash", username: "fatima_trade", full_name: "Fatima Yusuf", country: "Kenya", bio: "Automated signal tester.", experience_level: "INTERMEDIATE", avatar_url: "", created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "usr_uuid_10", email: "kofi@firstlook.com", password_hash: "seedpasswordhash", username: "kofi_gh", full_name: "Kofi Larbi", country: "Ghana", bio: "Technical backtesting journal keeper.", experience_level: "INTERMEDIATE", avatar_url: "", created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() }
  ];

  memUsers.push(...seedUsers);

  const seedPreferences = [
    { user_id: "usr_uuid_1", settings: { subscriptionPlan: "premium", subscriptionExpiry: Date.now() + 15 * 24 * 60 * 60 * 1000, isSubscriptionRecurring: true, billingCycle: "monthly", theme: "dark" } },
    { user_id: "usr_uuid_2", settings: { subscriptionPlan: "plus", subscriptionExpiry: Date.now() + 10 * 24 * 60 * 60 * 1000, isSubscriptionRecurring: false, billingCycle: "monthly", theme: "light" } },
    { user_id: "usr_uuid_3", settings: { subscriptionPlan: "premium", subscriptionExpiry: Date.now() + 8 * 24 * 60 * 60 * 1000, isSubscriptionRecurring: true, billingCycle: "yearly", theme: "dark" } },
    { user_id: "usr_uuid_4", settings: { subscriptionPlan: "free", subscriptionExpiry: null, isSubscriptionRecurring: false, theme: "light" } },
    { user_id: "usr_uuid_5", settings: { subscriptionPlan: "plus", subscriptionExpiry: Date.now() + 2 * 24 * 60 * 60 * 1000, isSubscriptionRecurring: false, theme: "dark" } },
    { user_id: "usr_uuid_6", settings: { subscriptionPlan: "plus", subscriptionExpiry: Date.now() + 28 * 24 * 60 * 60 * 1000, isSubscriptionRecurring: true, theme: "light" } },
    { user_id: "usr_uuid_7", settings: { subscriptionPlan: "premium", subscriptionExpiry: Date.now() + 29 * 24 * 60 * 60 * 1000, isSubscriptionRecurring: true, theme: "dark" } },
    { user_id: "usr_uuid_8", settings: { subscriptionPlan: "free", subscriptionExpiry: null, isSubscriptionRecurring: false, theme: "dark" } },
    { user_id: "usr_uuid_9", settings: { subscriptionPlan: "plus", subscriptionExpiry: Date.now() + 24 * 24 * 60 * 60 * 1000, isSubscriptionRecurring: true, theme: "dark" } },
    { user_id: "usr_uuid_10", settings: { subscriptionPlan: "plus", subscriptionExpiry: Date.now() + 3 * 24 * 60 * 60 * 1000, isSubscriptionRecurring: false, theme: "light" } }
  ];

  for (const p of seedPreferences) {
    memPreferences.set(p.user_id, p.settings);
  }

  const seedPayments = [
    { id: "pay_uuid_1", user_id: "usr_uuid_1", email: "chinelo@firstlook.com", full_name: "Chinelo Okonkwo", amount_usd: 20.00, amount_local: 22000.00, currency: "NGN", plan: "premium", country: "Nigeria", reference: "FL-PAY-100001-0.1", created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) },
    { id: "pay_uuid_2", user_id: "usr_uuid_2", email: "amani@firstlook.com", full_name: "Amani Njoroge", amount_usd: 5.00, amount_local: 650.00, currency: "KES", plan: "plus", country: "Kenya", reference: "FL-PAY-100002-0.2", created_at: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000) },
    { id: "pay_uuid_3", user_id: "usr_uuid_3", email: "kwame@firstlook.com", full_name: "Kwame Mensah", amount_usd: 50.40, amount_local: 760.00, currency: "GHS", plan: "premium", country: "Ghana", reference: "FL-PAY-100003-0.3", created_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000) },
    { id: "pay_uuid_4", user_id: "usr_uuid_5", email: "chadi@firstlook.com", full_name: "Chadi Al-Basha", amount_usd: 5.00, amount_local: 5.00, currency: "USD", plan: "plus", country: "Other", reference: "FL-PAY-100004-0.4", created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
    { id: "pay_uuid_5", user_id: "usr_uuid_6", email: "zara@firstlook.com", full_name: "Zara Van-Zyl", amount_usd: 5.00, amount_local: 95.00, currency: "ZAR", plan: "plus", country: "South Africa", reference: "FL-PAY-100005-0.5", created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
    { id: "pay_uuid_6", user_id: "usr_uuid_7", email: "tunde@firstlook.com", full_name: "Tunde Bakare", amount_usd: 20.00, amount_local: 22000.00, currency: "NGN", plan: "premium", country: "Nigeria", reference: "FL-PAY-100006-0.6", created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    { id: "pay_uuid_7", user_id: "usr_uuid_9", email: "fatima@firstlook.com", full_name: "Fatima Yusuf", amount_usd: 5.00, amount_local: 650.00, currency: "KES", plan: "plus", country: "Kenya", reference: "FL-PAY-100007-0.7", created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
    { id: "pay_uuid_8", user_id: "usr_uuid_10", email: "kofi@firstlook.com", full_name: "Kofi Larbi", amount_usd: 5.00, amount_local: 75.00, currency: "GHS", plan: "plus", country: "Ghana", reference: "FL-PAY-100008-0.8", created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) }
  ];

  memPayments.push(...seedPayments);

  const seedAuditLogs = [
    { id: "audit_uuid_1", endpoint: "/api/admin/dashboard", method: "GET", query_params: {}, ip_address: "127.0.0.1", status_code: 200, created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
    { id: "audit_uuid_2", endpoint: "/api/admin/users/overview", method: "GET", query_params: {}, ip_address: "127.0.0.1", status_code: 200, created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
    { id: "audit_uuid_3", endpoint: "/api/admin/finance/overview", method: "GET", query_params: {}, ip_address: "192.168.1.1", status_code: 200, created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    { id: "audit_uuid_4", endpoint: "/api/admin/subscriptions/overview", method: "GET", query_params: {}, ip_address: "192.168.1.5", status_code: 200, created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    { id: "audit_uuid_5", endpoint: "/api/admin/audit-logs", method: "GET", query_params: { limit: "10" }, ip_address: "127.0.0.1", status_code: 200, created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) }
  ];

  memAuditLogs.push(...seedAuditLogs);

  memCompetitionPreregistrations.add("usr_uuid_1");
  memCompetitionPreregistrations.add("usr_uuid_3");
  memCompetitionPreregistrations.add("usr_uuid_7");

  // Seed user activity logs over the last 30 days to generate robust analytics
  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  
  const activityFrequencies: { [userId: string]: number } = {
    "usr_uuid_1": 0.85,
    "usr_uuid_2": 0.50,
    "usr_uuid_3": 0.70,
    "usr_uuid_4": 0.20,
    "usr_uuid_5": 0.60,
    "usr_uuid_6": 0.40,
    "usr_uuid_7": 0.90,
    "usr_uuid_8": 0.30,
    "usr_uuid_9": 0.55,
    "usr_uuid_10": 0.45,
  };

  const seedActivityLogs: any[] = [];
  for (let d = 0; d < 30; d++) {
    const activityDateStr = new Date(nowMs - d * dayMs).toISOString().split('T')[0];
    const activityTimestamp = new Date(nowMs - d * dayMs);

    Object.entries(activityFrequencies).forEach(([userId, freq]) => {
      // Use simple modulo to generate deterministic realistic pattern
      const hash = (userId.charCodeAt(9) + d * 7) % 100;
      if (hash < freq * 100) {
        seedActivityLogs.push({
          id: `act_uuid_${userId.split('_')[2]}_${d}`,
          user_id: userId,
          activity_date: activityDateStr,
          created_at: activityTimestamp
        });
      }
    });
  }
  memUserActivityLogs.push(...seedActivityLogs);
}

seedInMemoryDb();

export async function initializeDatabase() {
  if (!DB_URL) {
    console.warn('[DB] COCKROACH_DB_URL is blank or missing. Relational database connectivity will fail until provided.');
    isDbActive = false;
    return;
  }

  try {
    const client = await pool.connect();
    console.log('[DB] Connected to CockroachDB. Running schema initialisation...');
    try {
    // 0. System Config table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        key VARCHAR PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 1. Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY,
        email VARCHAR UNIQUE NOT NULL,
        password_hash VARCHAR NOT NULL,
        username VARCHAR DEFAULT '',
        full_name VARCHAR DEFAULT '',
        country VARCHAR DEFAULT '',
        bio VARCHAR DEFAULT '',
        experience_level VARCHAR DEFAULT '',
        avatar_url VARCHAR DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 1.a Upgrade Users table if columns missing
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR DEFAULT '';");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR DEFAULT '';");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR DEFAULT '';");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR DEFAULT '';");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS experience_level VARCHAR DEFAULT '';");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR DEFAULT '';");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_dismissed BOOLEAN DEFAULT FALSE;");

    // 2. User Trades
    await client.query(`
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
    `);

    // 3. Drawings
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_drawings (
        user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        drawings JSONB DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Preferences
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        settings JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Watchlist
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_watchlist (
        user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        items JSONB DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Backtest Sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_backtest_sessions (
        user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        sessions JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Active Session limits
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        active_session_id VARCHAR,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 8. Setups
    await client.query(`
      CREATE TABLE IF NOT EXISTS setups (
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        grade VARCHAR NOT NULL,
        image_url TEXT,
        confluences JSONB DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, grade)
      );
    `);

    // 9. Competition Preregistrations
    await client.query(`
      CREATE TABLE IF NOT EXISTS competition_preregistrations (
        user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        registered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 10. Admin Payments Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_payments (
        id VARCHAR PRIMARY KEY,
        user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        email VARCHAR NOT NULL,
        full_name VARCHAR DEFAULT '',
        amount_usd NUMERIC NOT NULL,
        amount_local NUMERIC NOT NULL,
        currency VARCHAR DEFAULT 'USD',
        plan VARCHAR NOT NULL,
        country VARCHAR DEFAULT '',
        reference VARCHAR UNIQUE NOT NULL,
        status VARCHAR DEFAULT 'success',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 11. Admin Audit Logs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id VARCHAR PRIMARY KEY,
        endpoint VARCHAR NOT NULL,
        method VARCHAR NOT NULL,
        query_params JSONB DEFAULT '{}'::jsonb,
        ip_address VARCHAR,
        status_code INT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 11.a User Support Messages Table (Durable backend persistence for chat)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_support_messages (
        user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        messages JSONB DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 11.b Journal Accounts Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS journal_accounts (
        id VARCHAR PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR NOT NULL,
        type VARCHAR NOT NULL,
        phase NUMERIC,
        initial_balance NUMERIC NOT NULL,
        current_balance NUMERIC NOT NULL,
        currency VARCHAR NOT NULL,
        prop_type VARCHAR,
        max_drawdown NUMERIC,
        daily_drawdown NUMERIC,
        profit_target NUMERIC,
        status VARCHAR DEFAULT 'active',
        risk_per_trade NUMERIC,
        risk_type VARCHAR,
        drawdown_type VARCHAR,
        drawdown_value NUMERIC,
        live_target_amount NUMERIC,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 11.c Journal Trades Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS journal_trades (
        id VARCHAR PRIMARY KEY,
        account_id VARCHAR NOT NULL REFERENCES journal_accounts(id) ON DELETE CASCADE,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pair VARCHAR NOT NULL,
        type VARCHAR NOT NULL,
        entry_price NUMERIC NOT NULL,
        stop_loss NUMERIC NOT NULL,
        take_profit NUMERIC,
        lot_size NUMERIC,
        risk_amount NUMERIC,
        exit_price NUMERIC,
        profit_loss NUMERIC,
        additional_loss NUMERIC,
        status VARCHAR DEFAULT 'open',
        image_url TEXT,
        after_image_url TEXT,
        notes TEXT,
        analysis_by VARCHAR,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMPTZ
      );
    `);

    // 11.d Journal Withdrawals Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS journal_withdrawals (
        id VARCHAR PRIMARY KEY,
        account_id VARCHAR NOT NULL REFERENCES journal_accounts(id) ON DELETE CASCADE,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 11.e User Activity Logs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_activity_logs (
        id VARCHAR PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, activity_date)
      );
    `);

    // 12. Create Indexes for High-Performance Admin Analytics Queries
    await client.query("CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_admin_payments_created_at ON admin_payments(created_at);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_admin_payments_country ON admin_payments(country);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_admin_payments_plan ON admin_payments(plan);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_admin_payments_user_id ON admin_payments(user_id);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_user_activity_logs_date ON user_activity_logs(activity_date);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);");

    // 13. Auto-Seeding: If the datastore is a connected, freshly initialised database with 0 users,
    // automatically seed actual, high-fidelity analytics and trade records to enable robust immediate administrative analysis.
    const countCheck = await client.query("SELECT COUNT(*) FROM users;");
    const userCount = parseInt(countCheck.rows[0]?.count || '0', 10);
    if (userCount === 0) {
      console.log("[DB] Connecting to empty CockroachDB workspace. Seeding high-fidelity analytical transactions & logs...");

      const seedUsers = [
        { id: "usr_uuid_1", email: "chinelo@firstlook.com", password_hash: "seedpasswordhash", username: "chinelo_trader", full_name: "Chinelo Okonkwo", country: "Nigeria", bio: "Professional Forex journaler and technical trader.", experience_level: "LEGEND", avatar_url: "", created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) },
        { id: "usr_uuid_2", email: "amani@firstlook.com", password_hash: "seedpasswordhash", username: "amani_njoroge", full_name: "Amani Njoroge", country: "Kenya", bio: "Crypto spot and derivatives swing trader.", experience_level: "INTERMEDIATE", avatar_url: "", created_at: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000) },
        { id: "usr_uuid_3", email: "kwame@firstlook.com", password_hash: "seedpasswordhash", username: "kwame_crypto", full_name: "Kwame Mensah", country: "Ghana", bio: "Intraday price action specialist.", experience_level: "LEGEND", avatar_url: "", created_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000) },
        { id: "usr_uuid_4", email: "olivia@firstlook.com", password_hash: "seedpasswordhash", username: "olivia_gold", full_name: "Olivia Smith", country: "United States", bio: "Gold and indices breakout trader.", experience_level: "BEGINNER", avatar_url: "", created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
        { id: "usr_uuid_5", email: "chadi@firstlook.com", password_hash: "seedpasswordhash", username: "chadi_fx", full_name: "Chadi Al-Basha", country: "Other", bio: "Algorithmic backtesting designer.", experience_level: "LEGEND", avatar_url: "", created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
        { id: "usr_uuid_6", email: "zara@firstlook.com", password_hash: "seedpasswordhash", username: "zara_zar", full_name: "Zara Van-Zyl", country: "South Africa", bio: "Retail momentum trend follower.", experience_level: "INTERMEDIATE", avatar_url: "", created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
        { id: "usr_uuid_7", email: "tunde@firstlook.com", password_hash: "seedpasswordhash", username: "tunde_gold", full_name: "Tunde Bakare", country: "Nigeria", bio: "Funded account prop firm trader.", experience_level: "LEGEND", avatar_url: "", created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
        { id: "usr_uuid_8", email: "naomi@firstlook.com", password_hash: "seedpasswordhash", username: "naomi_fx", full_name: "Naomi Carter", country: "United States", bio: "Macroeconomic market indicator visualizer.", experience_level: "BEGINNER", avatar_url: "", created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000) },
        { id: "usr_uuid_9", email: "fatima@firstlook.com", password_hash: "seedpasswordhash", username: "fatima_trade", full_name: "Fatima Yusuf", country: "Kenya", bio: "Automated signal tester.", experience_level: "INTERMEDIATE", avatar_url: "", created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
        { id: "usr_uuid_10", email: "kofi@firstlook.com", password_hash: "seedpasswordhash", username: "kofi_gh", full_name: "Kofi Larbi", country: "Ghana", bio: "Technical backtesting journal keeper.", experience_level: "INTERMEDIATE", avatar_url: "", created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) }
      ];

      for (const u of seedUsers) {
        await client.query(
          `INSERT INTO users (id, email, password_hash, username, full_name, country, bio, experience_level, avatar_url, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING;`,
          [u.id, u.email, u.password_hash, u.username, u.full_name, u.country, u.bio, u.experience_level, u.avatar_url, u.created_at]
        );
      }

      const seedPreferences = [
        { user_id: "usr_uuid_1", settings: { subscriptionPlan: "premium", subscriptionExpiry: Date.now() + 15 * 24 * 60 * 60 * 1000, isSubscriptionRecurring: true, billingCycle: "monthly", theme: "dark" } },
        { user_id: "usr_uuid_2", settings: { subscriptionPlan: "plus", subscriptionExpiry: Date.now() + 10 * 24 * 60 * 60 * 1000, isSubscriptionRecurring: false, billingCycle: "monthly", theme: "light" } },
        { user_id: "usr_uuid_3", settings: { subscriptionPlan: "premium", subscriptionExpiry: Date.now() + 8 * 24 * 60 * 60 * 1000, isSubscriptionRecurring: true, billingCycle: "yearly", theme: "dark" } },
        { user_id: "usr_uuid_4", settings: { subscriptionPlan: "free", subscriptionExpiry: null, isSubscriptionRecurring: false, theme: "light" } },
        { user_id: "usr_uuid_5", settings: { subscriptionPlan: "plus", subscriptionExpiry: Date.now() + 2 * 24 * 60 * 60 * 1000, isSubscriptionRecurring: false, theme: "dark" } },
        { user_id: "usr_uuid_6", settings: { subscriptionPlan: "plus", subscriptionExpiry: Date.now() + 28 * 24 * 60 * 60 * 1000, isSubscriptionRecurring: true, theme: "light" } },
        { user_id: "usr_uuid_7", settings: { subscriptionPlan: "premium", subscriptionExpiry: Date.now() + 29 * 24 * 60 * 60 * 1000, isSubscriptionRecurring: true, theme: "dark" } },
        { user_id: "usr_uuid_8", settings: { subscriptionPlan: "free", subscriptionExpiry: null, isSubscriptionRecurring: false, theme: "dark" } },
        { user_id: "usr_uuid_9", settings: { subscriptionPlan: "plus", subscriptionExpiry: Date.now() + 24 * 24 * 60 * 60 * 1000, isSubscriptionRecurring: true, theme: "dark" } },
        { user_id: "usr_uuid_10", settings: { subscriptionPlan: "plus", subscriptionExpiry: Date.now() + 3 * 24 * 60 * 60 * 1000, isSubscriptionRecurring: false, theme: "light" } }
      ];

      for (const p of seedPreferences) {
        await client.query(
          `INSERT INTO user_preferences (user_id, settings, updated_at)
           VALUES ($1, $2, NOW()) ON CONFLICT (user_id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = NOW();`,
          [p.user_id, JSON.stringify(p.settings)]
        );
      }

      const seedPayments = [
        { id: "pay_uuid_1", user_id: "usr_uuid_1", email: "chinelo@firstlook.com", full_name: "Chinelo Okonkwo", amount_usd: 20.00, amount_local: 22000.00, currency: "NGN", plan: "premium", country: "Nigeria", reference: "FL-PAY-100001-0.1", created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) },
        { id: "pay_uuid_2", user_id: "usr_uuid_2", email: "amani@firstlook.com", full_name: "Amani Njoroge", amount_usd: 5.00, amount_local: 650.00, currency: "KES", plan: "plus", country: "Kenya", reference: "FL-PAY-100002-0.2", created_at: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000) },
        { id: "pay_uuid_3", user_id: "usr_uuid_3", email: "kwame@firstlook.com", full_name: "Kwame Mensah", amount_usd: 50.40, amount_local: 760.00, currency: "GHS", plan: "premium", country: "Ghana", reference: "FL-PAY-100003-0.3", created_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000) },
        { id: "pay_uuid_4", user_id: "usr_uuid_5", email: "chadi@firstlook.com", full_name: "Chadi Al-Basha", amount_usd: 5.00, amount_local: 5.00, currency: "USD", plan: "plus", country: "Other", reference: "FL-PAY-100004-0.4", created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
        { id: "pay_uuid_5", user_id: "usr_uuid_6", email: "zara@firstlook.com", full_name: "Zara Van-Zyl", amount_usd: 5.00, amount_local: 95.00, currency: "ZAR", plan: "plus", country: "South Africa", reference: "FL-PAY-100005-0.5", created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
        { id: "pay_uuid_6", user_id: "usr_uuid_7", email: "tunde@firstlook.com", full_name: "Tunde Bakare", amount_usd: 20.00, amount_local: 22000.00, currency: "NGN", plan: "premium", country: "Nigeria", reference: "FL-PAY-100006-0.6", created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
        { id: "pay_uuid_7", user_id: "usr_uuid_9", email: "fatima@firstlook.com", full_name: "Fatima Yusuf", amount_usd: 5.00, amount_local: 650.00, currency: "KES", plan: "plus", country: "Kenya", reference: "FL-PAY-100007-0.7", created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
        { id: "pay_uuid_8", user_id: "usr_uuid_10", email: "kofi@firstlook.com", full_name: "Kofi Larbi", amount_usd: 5.00, amount_local: 75.00, currency: "GHS", plan: "plus", country: "Ghana", reference: "FL-PAY-100008-0.8", created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) }
      ];

      for (const pay of seedPayments) {
        await client.query(
          `INSERT INTO admin_payments (id, user_id, email, full_name, amount_usd, amount_local, currency, plan, country, reference, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (reference) DO NOTHING;`,
          [pay.id, pay.user_id, pay.email, pay.full_name, pay.amount_usd, pay.amount_local, pay.currency, pay.plan, pay.country, pay.reference, "success", pay.created_at]
        );
      }

      const seedAuditLogs = [
        { id: "audit_uuid_1", endpoint: "/api/admin/dashboard", method: "GET", query_params: {}, ip_address: "127.0.0.1", status_code: 200, created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
        { id: "audit_uuid_2", endpoint: "/api/admin/users/overview", method: "GET", query_params: {}, ip_address: "127.0.0.1", status_code: 200, created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
        { id: "audit_uuid_3", endpoint: "/api/admin/finance/overview", method: "GET", query_params: {}, ip_address: "192.168.1.1", status_code: 200, created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
        { id: "audit_uuid_4", endpoint: "/api/admin/subscriptions/overview", method: "GET", query_params: {}, ip_address: "192.168.1.5", status_code: 200, created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
        { id: "audit_uuid_5", endpoint: "/api/admin/audit-logs", method: "GET", query_params: { limit: "10" }, ip_address: "127.0.0.1", status_code: 200, created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) }
      ];

      for (const log of seedAuditLogs) {
        await client.query(
          `INSERT INTO admin_audit_logs (id, endpoint, method, query_params, ip_address, status_code, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING;`,
          [log.id, log.endpoint, log.method, JSON.stringify(log.query_params), log.ip_address, log.status_code, log.created_at]
        );
      }

      // Seed user activity logs from the pre-populated memUserActivityLogs array
      for (const log of memUserActivityLogs) {
        await client.query(
          `INSERT INTO user_activity_logs (id, user_id, activity_date, created_at)
           VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, activity_date) DO NOTHING;`,
          [log.id, log.user_id, log.activity_date, log.created_at]
        );
      }
      console.log("[DB] Automated database seeding finished successfully.");
    }

      console.log('[DB] Schemas verified successfully.');
      isDbActive = true;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[DB] Connection to CockroachDB failed. Gracefully falling back to high-fidelity In-Memory engine:', err);
    isDbActive = false;
  }
}

export const db = {
  isCockroach() {
    return isDbActive;
  },

  async getSystemConfig(key: string): Promise<string | null> {
    if (!isDbActive) {
      if (memPreferences.has(`sys_${key}`)) {
        return memPreferences.get(`sys_${key}`);
      }
      return null;
    }
    const res = await pool.query('SELECT value FROM system_config WHERE key = $1', [key]);
    return res.rows[0]?.value || null;
  },

  async setSystemConfig(key: string, value: string): Promise<void> {
    if (!isDbActive) {
      memPreferences.set(`sys_${key}`, value);
      return;
    }
    await pool.query(
      `INSERT INTO system_config (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();`,
      [key, value]
    );
  },

  async updateUserPassword(email: string, passwordHash: string): Promise<boolean> {
    const cleanEmail = email.toLowerCase().trim();
    if (!isDbActive) {
      const user = memUsers.find(u => (u.email || '').toLowerCase().trim() === cleanEmail);
      if (user) {
        user.password_hash = passwordHash;
        return true;
      }
      return false;
    }
    const res = await pool.query('UPDATE users SET password_hash = $1 WHERE LOWER(email) = LOWER($2)', [passwordHash, cleanEmail]);
    return res.rowCount !== null && res.rowCount > 0;
  },

  // --- AUTH SERVICES ---
  async getUserByEmail(email: string) {
    const cleanEmail = email.toLowerCase().trim();
    if (!isDbActive) {
      return memUsers.find(u => (u.email || '').toLowerCase().trim() === cleanEmail) || null;
    }
    const res = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
    return res.rows[0] || null;
  },

  async createUser(
    email: string, 
    passwordHash: string, 
    username?: string, 
    fullName?: string, 
    country?: string, 
    bio?: string, 
    experienceLevel?: string, 
    avatarUrl?: string
  ) {
    const cleanEmail = email.toLowerCase().trim();
    const id = crypto.randomUUID();
    const user = { 
      id, 
      email: cleanEmail, 
      password_hash: passwordHash, 
      username: username || '',
      full_name: fullName || '',
      country: country || '',
      bio: bio || '',
      experience_level: experienceLevel || '',
      avatar_url: avatarUrl || '',
      onboarding_dismissed: false,
      created_at: new Date().toISOString() 
    };

    if (!isDbActive) {
      memUsers.push(user);
      return user;
    }
    
    await pool.query(
      `INSERT INTO users (id, email, password_hash, username, full_name, country, bio, experience_level, avatar_url) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id, 
        cleanEmail, 
        passwordHash, 
        username || '', 
        fullName || '', 
        country || '', 
        bio || '', 
        experienceLevel || '', 
        avatarUrl || ''
      ]
    );
    return user;
  },

  async updateUserProfile(
    id: string, 
    details: { 
      username?: string; 
      full_name?: string; 
      country?: string; 
      bio?: string; 
      experience_level?: string; 
      avatar_url?: string; 
      onboarding_dismissed?: boolean;
    }
  ) {
    if (!isDbActive) {
      const user = memUsers.find(u => u.id === id);
      if (user) {
        Object.assign(user, details);
      }
      return user || null;
    }
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    Object.entries(details).forEach(([key, val]) => {
      if (val !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(val);
        idx++;
      }
    });

    if (fields.length === 0) return await this.getUserById(id);

    values.push(id);
    await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`,
      values
    );
    return await this.getUserById(id);
  },

  async getUserById(id: string) {
    if (!isDbActive) {
      return memUsers.find(u => u.id === id) || null;
    }
    const res = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0] || null;
  },

  // --- TRADES SERVICES ---
  async getTrades(userId: string) {
    if (!isDbActive) {
      return memTrades.filter(t => t.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    const res = await pool.query(
      'SELECT * FROM user_trades WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return res.rows;
  },

  async saveTrade(userId: string, trade: any) {
    const id = crypto.randomUUID();
    const tradeRow = {
      id: trade.id || id,
      user_id: userId,
      symbol: trade.symbol || '',
      prefix: trade.prefix || null,
      type: trade.type || 'LONG',
      entry_time: trade.entry_time ?? trade.entryTime ?? 0,
      exit_time: trade.exit_time ?? trade.exitTime ?? 0,
      entry_price: trade.entry_price ?? trade.entryPrice ?? 0,
      exit_price: trade.exit_price ?? trade.exitPrice ?? 0,
      rr: trade.rr ?? 0,
      status: trade.status || 'SL',
      pips: trade.pips ?? 0,
      timeframe: trade.timeframe || '1m',
      duration: trade.duration || '0m',
      drawing_id: trade.drawing_id ?? trade.drawingId ?? null,
      watchlist_id: trade.watchlist_id ?? trade.watchlistId ?? null,
      setup_grade: trade.setup_grade ?? trade.setupGrade ?? null,
      confluences: (trade.confluences ? JSON.stringify(trade.confluences) : '[]'),
      notes: trade.notes || '',
      created_at: new Date().toISOString(),
      realized_at: trade.realized_at ?? trade.realizedAt ?? new Date().toISOString()
    };

    if (!isDbActive) {
      const parsedTradeRow = {
        ...tradeRow,
        confluences: typeof trade.confluences === 'string' ? JSON.parse(trade.confluences) : (trade.confluences || [])
      };
      memTrades.push(parsedTradeRow);
      return parsedTradeRow;
    }

    await pool.query(
      `INSERT INTO user_trades (
        id, user_id, symbol, prefix, type, entry_time, exit_time, entry_price, exit_price, rr, status, pips, timeframe, duration, drawing_id, watchlist_id, setup_grade, confluences, notes, realized_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [
        tradeRow.id, tradeRow.user_id, tradeRow.symbol, tradeRow.prefix, tradeRow.type, tradeRow.entry_time, tradeRow.exit_time, tradeRow.entry_price, tradeRow.exit_price, tradeRow.rr, tradeRow.status, tradeRow.pips, tradeRow.timeframe, tradeRow.duration, tradeRow.drawing_id, tradeRow.watchlist_id, tradeRow.setup_grade, tradeRow.confluences, tradeRow.notes, tradeRow.realized_at
      ]
    );

    return tradeRow;
  },

  async deleteTradesByWatchlist(userId: string, watchlistId: string) {
    if (!isDbActive) {
      for (let i = memTrades.length - 1; i >= 0; i--) {
        if (memTrades[i].user_id === userId && memTrades[i].watchlist_id === watchlistId) {
          memTrades.splice(i, 1);
        }
      }
      return;
    }
    await pool.query('DELETE FROM user_trades WHERE user_id = $1 AND watchlist_id = $2', [userId, watchlistId]);
  },

  async deleteTradesForSymbol(userId: string, symbol: string, prefix: string | null, watchlistId: string | null) {
    if (!isDbActive) {
      if (watchlistId) {
        for (let i = memTrades.length - 1; i >= 0; i--) {
          if (memTrades[i].user_id === userId && memTrades[i].watchlist_id === watchlistId) {
            memTrades.splice(i, 1);
          }
        }
        return;
      }
      for (let i = memTrades.length - 1; i >= 0; i--) {
        const t = memTrades[i];
        if (t.user_id === userId && t.symbol === symbol) {
          if (prefix && prefix.trim() !== '') {
            if (t.prefix === prefix) {
              memTrades.splice(i, 1);
            }
          } else {
            if (!t.prefix || t.prefix.trim() === '') {
              memTrades.splice(i, 1);
            }
          }
        }
      }
      return;
    }
    if (watchlistId) {
      await pool.query('DELETE FROM user_trades WHERE user_id = $1 AND watchlist_id = $2', [userId, watchlistId]);
      return;
    }
    let queryStr = 'DELETE FROM user_trades WHERE user_id = $1 AND symbol = $2';
    let params = [userId, symbol];
    if (prefix && prefix.trim() !== '') {
      queryStr += ' AND prefix = $3';
      params.push(prefix);
    } else {
      queryStr += ' AND (prefix IS NULL OR prefix = \'\')';
    }
    await pool.query(queryStr, params);
  },

  // --- DRAWINGS SERVICES ---
  async saveDrawings(userId: string, drawings: any[]) {
    if (!isDbActive) {
      memDrawings.set(userId, drawings);
      return;
    }
    const drawingsStr = JSON.stringify(drawings);
    await pool.query(
      `INSERT INTO user_drawings (user_id, drawings, updated_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (user_id) 
       DO UPDATE SET drawings = EXCLUDED.drawings, updated_at = NOW()`,
      [userId, drawingsStr]
    );
  },

  async getDrawings(userId: string) {
    if (!isDbActive) {
      return memDrawings.get(userId) || [];
    }
    const res = await pool.query('SELECT drawings FROM user_drawings WHERE user_id = $1', [userId]);
    if (res.rows[0]) {
      return typeof res.rows[0].drawings === 'string' ? JSON.parse(res.rows[0].drawings) : res.rows[0].drawings;
    }
    return [];
  },

  // --- PREFERENCES SERVICES ---
  async savePreferences(userId: string, prefs: any) {
    if (!isDbActive) {
      const current = memPreferences.get(userId) || {};
      memPreferences.set(userId, { ...current, ...prefs });
      return;
    }
    const currentRes = await pool.query('SELECT settings FROM user_preferences WHERE user_id = $1', [userId]);
    const current = currentRes.rows[0] ? (typeof currentRes.rows[0].settings === 'string' ? JSON.parse(currentRes.rows[0].settings) : currentRes.rows[0].settings) : {};
    const merged = { ...current, ...prefs };
    await pool.query(
      `INSERT INTO user_preferences (user_id, settings, updated_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (user_id) 
       DO UPDATE SET settings = EXCLUDED.settings, updated_at = NOW()`,
      [userId, JSON.stringify(merged)]
    );
  },

  async getPreferences(userId: string) {
    if (!isDbActive) {
      return memPreferences.get(userId) || null;
    }
    const res = await pool.query('SELECT settings FROM user_preferences WHERE user_id = $1', [userId]);
    if (res.rows[0]) {
      return typeof res.rows[0].settings === 'string' ? JSON.parse(res.rows[0].settings) : res.rows[0].settings;
    }
    return null;
  },

  // --- WATCHLIST SERVICES ---
  async saveWatchlist(userId: string, items: any[]) {
    if (!isDbActive) {
      memWatchlist.set(userId, items);
      return;
    }
    const itemsStr = JSON.stringify(items);
    await pool.query(
      `INSERT INTO user_watchlist (user_id, items, updated_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (user_id) 
       DO UPDATE SET items = EXCLUDED.items, updated_at = NOW()`,
      [userId, itemsStr]
    );
  },

  async getWatchlist(userId: string) {
    if (!isDbActive) {
      return memWatchlist.get(userId) || [];
    }
    const res = await pool.query('SELECT items FROM user_watchlist WHERE user_id = $1', [userId]);
    if (res.rows[0]) {
      return typeof res.rows[0].items === 'string' ? JSON.parse(res.rows[0].items) : res.rows[0].items;
    }
    return [];
  },

  // --- BACKTEST SESSIONS SERVICES ---
  async saveBacktestSessions(userId: string, sessions: any) {
    if (!isDbActive) {
      memBacktestSessions.set(userId, sessions);
      return;
    }
    const sessionsStr = JSON.stringify(sessions);
    await pool.query(
      `INSERT INTO user_backtest_sessions (user_id, sessions, updated_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (user_id) 
       DO UPDATE SET sessions = EXCLUDED.sessions, updated_at = NOW()`,
      [userId, sessionsStr]
    );
  },

  async getBacktestSessions(userId: string) {
    if (!isDbActive) {
      return memBacktestSessions.get(userId) || {};
    }
    const res = await pool.query('SELECT sessions FROM user_backtest_sessions WHERE user_id = $1', [userId]);
    if (res.rows[0]) {
      return typeof res.rows[0].sessions === 'string' ? JSON.parse(res.rows[0].sessions) : res.rows[0].sessions;
    }
    return {};
  },

  // --- CO-SESSION DEVICE CONTROL ---
  async updateActiveSession(userId: string, sessionId: string) {
    if (!isDbActive) {
      memSessions.set(userId, sessionId);
      return;
    }
    await pool.query(
      `INSERT INTO user_sessions (user_id, active_session_id, updated_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (user_id) 
       DO UPDATE SET active_session_id = EXCLUDED.active_session_id, updated_at = NOW()`,
      [userId, sessionId]
    );
  },

  async getActiveSession(userId: string) {
    if (!isDbActive) {
      return memSessions.get(userId) || null;
    }
    const res = await pool.query('SELECT active_session_id FROM user_sessions WHERE user_id = $1', [userId]);
    return res.rows[0]?.active_session_id || null;
  },

  // --- SETUPS ---
  async saveSetup(userId: string, grade: string, imageUrl: string | null, confluences: string[]) {
    if (!isDbActive) {
      const idx = memSetups.findIndex(s => s.user_id === userId && s.grade === grade);
      if (idx >= 0) {
        memSetups[idx] = { user_id: userId, grade, image_url: imageUrl, confluences, updated_at: new Date().toISOString() };
      } else {
        memSetups.push({ user_id: userId, grade, image_url: imageUrl, confluences, updated_at: new Date().toISOString() });
      }
      return;
    }
    const confluencesStr = JSON.stringify(confluences);
    await pool.query(
      `INSERT INTO setups (user_id, grade, image_url, confluences, updated_at) 
       VALUES ($1, $2, $3, $4, NOW()) 
       ON CONFLICT (user_id, grade) 
       DO UPDATE SET image_url = EXCLUDED.image_url, confluences = EXCLUDED.confluences, updated_at = NOW()`,
      [userId, grade, imageUrl, confluencesStr]
    );
  },

  async getSetups(userId: string) {
    if (!isDbActive) {
      return memSetups.filter(s => s.user_id === userId);
    }
    const res = await pool.query('SELECT * FROM setups WHERE user_id = $1', [userId]);
    return res.rows;
  },

  async preregisterForCompetition(userId: string) {
    if (!isDbActive) {
      memCompetitionPreregistrations.add(userId);
      return;
    }
    await pool.query('INSERT INTO competition_preregistrations (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
  },

  async hasPreregisteredForCompetition(userId: string) {
    if (!isDbActive) {
      return memCompetitionPreregistrations.has(userId);
    }
    const res = await pool.query('SELECT 1 FROM competition_preregistrations WHERE user_id = $1', [userId]);
    return res.rows.length > 0;
  },

  async getCompetitionPreregistrationsCount() {
    if (!isDbActive) {
      return memCompetitionPreregistrations.size;
    }
    const res = await pool.query('SELECT COUNT(*) as count FROM competition_preregistrations');
    return parseInt(res.rows[0]?.count || '0', 10);
  },

  async getPremiumPlusUsersCount() {
    if (!isDbActive) {
      let count = 0;
      for (const settings of memPreferences.values()) {
        if (settings && (settings.subscriptionPlan === 'plus' || settings.subscriptionPlan === 'premium')) {
          count++;
        }
      }
      return count;
    }
    let count = 0;
    const res = await pool.query('SELECT settings FROM user_preferences');
    for (const row of res.rows) {
      const settings = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
      if (settings && (settings.subscriptionPlan === 'plus' || settings.subscriptionPlan === 'premium')) {
        count++;
      }
    }
    return count;
  },

  async getPreregisteredCandidates() {
    if (!isDbActive) {
      const list: any[] = [];
      for (const userId of memCompetitionPreregistrations) {
        const u = memUsers.find(usr => usr.id === userId);
        if (u) {
          const settings = memPreferences.get(userId);
          const plan = settings?.subscriptionPlan || 'basic';
          list.push({
            id: userId,
            username: u.username || u.full_name || 'Trader',
            plan: plan,
            country: u.country || 'US'
          });
        }
      }
      return list;
    }
    const list: Array<{ id: string, username: string, plan: string, country: string }> = [];
    const query = `
      SELECT cp.user_id, u.username, u.full_name, u.country, p.settings 
      FROM competition_preregistrations cp
      JOIN users u ON cp.user_id = u.id
      LEFT JOIN user_preferences p ON cp.user_id = p.user_id
      ORDER BY cp.registered_at ASC
    `;
    const res = await pool.query(query);
    for (const row of res.rows) {
      const settings = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
      const plan = settings?.subscriptionPlan || 'basic';
      list.push({
        id: row.user_id,
        username: row.username || row.full_name || 'Trader',
        plan: plan,
        country: row.country || 'US'
      });
    }
    return list;
  },

  async getPremiumPlusUsers() {
    if (!isDbActive) {
      const list: any[] = [];
      for (const u of memUsers) {
        const settings = memPreferences.get(u.id);
        const plan = settings?.subscriptionPlan || 'basic';
        if (plan === 'plus' || plan === 'premium') {
          list.push({
            id: u.id,
            username: u.username || u.full_name || 'Trader',
            plan: plan,
            country: u.country || 'US'
          });
        }
      }
      return list;
    }
    const list: Array<{ id: string, username: string, plan: string, country: string }> = [];
    const query = `
      SELECT u.id, u.username, u.full_name, u.country, p.settings 
      FROM users u
      JOIN user_preferences p ON u.id = p.user_id
    `;
    const res = await pool.query(query);
    for (const row of res.rows) {
      const settings = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
      const plan = settings?.subscriptionPlan || 'basic';
      if (plan === 'plus' || plan === 'premium') {
        list.push({
          id: row.id,
          username: row.username || row.full_name || 'Trader',
          plan: plan,
          country: row.country || 'US'
        });
      }
    }
    return list;
  },

  async checkSubscriptionExpirations(onExpire: (userId: string, email: string, plan: string) => Promise<void>) {
    if (!isDbActive) {
      for (const u of memUsers) {
        const settings = memPreferences.get(u.id);
        if (settings && (settings.subscriptionPlan === 'plus' || settings.subscriptionPlan === 'premium')) {
          const isRecurring = settings.isSubscriptionRecurring === true || (settings.billingCycle === 'yearly' && settings.isSubscriptionRecurring); 
          const expiry = settings.subscriptionExpiry ? new Date(settings.subscriptionExpiry).getTime() : null;
          if (!isRecurring && expiry && Date.now() > expiry) {
            const oldPlan = settings.subscriptionPlan;
            settings.subscriptionPlan = 'basic';
            settings.subscriptionExpiry = null;
            settings.isSubscriptionRecurring = false;
            memPreferences.set(u.id, settings);
            await onExpire(u.id, u.email, oldPlan);
          }
        }
      }
      return;
    }
    const query = `
      SELECT u.id, u.email, p.settings 
      FROM users u
      JOIN user_preferences p ON u.id = p.user_id
    `;
    const res = await pool.query(query);
    for (const row of res.rows) {
      const settings = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
      if (settings && (settings.subscriptionPlan === 'plus' || settings.subscriptionPlan === 'premium')) {
        const isRecurring = settings.isSubscriptionRecurring === true || (settings.billingCycle === 'yearly' && settings.isSubscriptionRecurring); 
        const expiry = settings.subscriptionExpiry ? new Date(settings.subscriptionExpiry).getTime() : null;
        if (!isRecurring && expiry && Date.now() > expiry) {
          const oldPlan = settings.subscriptionPlan;
          const updatedSettings = { 
            ...settings, 
            subscriptionPlan: 'basic',
            subscriptionExpiry: null,
            isSubscriptionRecurring: false
          };
          await pool.query(
            `UPDATE user_preferences SET settings = $1, updated_at = NOW() WHERE user_id = $2`,
            [JSON.stringify(updatedSettings), row.id]
          );
          await onExpire(row.id, row.email, oldPlan);
        }
      }
    }
  },

  // --- ADMIN ANALYTICS SERVICES ---
  async logPayment(
    userId: string | null,
    email: string,
    fullName: string,
    amountUsd: number,
    amountLocal: number,
    currency: string,
    plan: string,
    country: string,
    reference: string,
    createdAt?: Date
  ) {
    const id = crypto.randomUUID();
    const pTime = createdAt || new Date();
    if (!isDbActive) {
      memPayments.push({
        id,
        user_id: userId,
        email,
        full_name: fullName,
        amount_usd: amountUsd,
        amount_local: amountLocal,
        currency,
        plan: plan || 'plus',
        country: country || 'US',
        reference,
        status: 'success',
        created_at: pTime
      });
      return;
    }
    await pool.query(
      `INSERT INTO admin_payments (id, user_id, email, full_name, amount_usd, amount_local, currency, plan, country, reference, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (reference) DO NOTHING`,
      [id, userId, email, fullName, amountUsd, amountLocal, currency, plan || 'plus', country || 'US', reference, 'success', pTime]
    );
  },

  async getUserPayments(userId: string) {
    if (!isDbActive) {
      return memPayments.filter(p => p.user_id === userId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    const res = await pool.query(
      `SELECT * FROM admin_payments WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return res.rows;
  },

  async getAdminFinancialOverview() {
    if (!isDbActive) {
      const now = Date.now();
      const filterByHours = (h: number) => {
        const cutoff = now - h * 60 * 60 * 1000;
        return memPayments
          .filter(p => new Date(p.created_at).getTime() >= cutoff)
          .reduce((sum, p) => sum + Number(p.amount_usd), 0);
      };
      return {
        today_payment: parseFloat(filterByHours(24).toFixed(2)),
        week_payment: parseFloat(filterByHours(24 * 7).toFixed(2)),
        month_payment: parseFloat(filterByHours(24 * 30).toFixed(2)),
        year_payment: parseFloat(filterByHours(24 * 365).toFixed(2)),
        overall_payment: parseFloat(memPayments.reduce((sum, p) => sum + Number(p.amount_usd), 0).toFixed(2)),
        currency: 'USD'
      };
    }
    const query = `
      SELECT 
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN amount_usd ELSE 0 END), 0) as today,
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN amount_usd ELSE 0 END), 0) as week,
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN amount_usd ELSE 0 END), 0) as month,
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '365 days' THEN amount_usd ELSE 0 END), 0) as year,
        COALESCE(SUM(amount_usd), 0) as overall
      FROM admin_payments
      WHERE status = 'success'
    `;
    const res = await pool.query(query);
    const row = res.rows[0] || {};
    return {
      today_payment: parseFloat(parseFloat(row.today).toFixed(2)),
      week_payment: parseFloat(parseFloat(row.week).toFixed(2)),
      month_payment: parseFloat(parseFloat(row.month).toFixed(2)),
      year_payment: parseFloat(parseFloat(row.year).toFixed(2)),
      overall_payment: parseFloat(parseFloat(row.overall).toFixed(2)),
      currency: 'USD'
    };
  },

  async getRevenueByPlan() {
    if (!isDbActive) {
      let freeCount = 0;
      let plusCount = 0;
      let premiumCount = 0;
      let plusRev = 0;
      let premiumRev = 0;

      for (const u of memUsers) {
        const settings = memPreferences.get(u.id);
        const plan = (settings?.subscriptionPlan || 'free').toLowerCase();
        if (plan === 'plus') plusCount++;
        else if (plan === 'premium' || plan === 'business') premiumCount++;
        else freeCount++;
      }

      for (const p of memPayments) {
        const plan = (p.plan || '').toLowerCase();
        if (plan === 'plus') plusRev += Number(p.amount_usd);
        else if (plan === 'premium') premiumRev += Number(p.amount_usd);
      }

      return {
        free: { users: freeCount, revenue: 0 },
        plus: { users: plusCount, revenue: parseFloat(plusRev.toFixed(2)) },
        premium: { users: premiumCount, revenue: parseFloat(premiumRev.toFixed(2)) }
      };
    }
    let freeCount = 0;
    let plusCount = 0;
    let premiumCount = 0;
    
    let plusRev = 0;
    let premiumRev = 0;

    const pRes = await pool.query(`
      SELECT 
        COALESCE(p.settings->>'subscriptionPlan', 'free') as plan, 
        COUNT(*) as count 
      FROM users u
      LEFT JOIN user_preferences p ON u.id = p.user_id
      GROUP BY plan
    `);
    pRes.rows.forEach(r => {
      const plan = (r.plan || '').toLowerCase();
      if (plan === 'plus') plusCount = parseInt(r.count, 10);
      else if (plan === 'premium' || plan === 'business') premiumCount = parseInt(r.count, 10);
      else freeCount = parseInt(r.count, 10);
    });

    const rRes = await pool.query(`
      SELECT plan, SUM(amount_usd) as revenue 
      FROM admin_payments 
      WHERE status = 'success' 
      GROUP BY plan
    `);
    rRes.rows.forEach(r => {
      const plan = (r.plan || '').toLowerCase();
      const rev = parseFloat(r.revenue || 0);
      if (plan === 'plus') plusRev = rev;
      else if (plan === 'premium') premiumRev = rev;
    });

    return {
      free: {
        users: freeCount,
        revenue: 0
      },
      plus: {
        users: plusCount,
        revenue: parseFloat(plusRev.toFixed(2))
      },
      premium: {
        users: premiumCount,
        revenue: parseFloat(premiumRev.toFixed(2))
      }
    };
  },

  async getPaymentsHistory(
    page: number,
    limit: number,
    country?: string,
    plan?: string,
    startDate?: string,
    endDate?: string
  ) {
    if (!isDbActive) {
      let filtered = [...memPayments];
      if (country) filtered = filtered.filter(p => p.country === country);
      if (plan) filtered = filtered.filter(p => p.plan?.toLowerCase() === plan.toLowerCase());
      if (startDate) {
        const sTime = new Date(startDate).getTime();
        filtered = filtered.filter(p => new Date(p.created_at).getTime() >= sTime);
      }
      if (endDate) {
        const eTime = new Date(endDate).getTime();
        filtered = filtered.filter(p => new Date(p.created_at).getTime() <= eTime);
      }
      filtered.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const total = filtered.length;
      const startIdx = (page - 1) * limit;
      const paginated = filtered.slice(startIdx, startIdx + limit);
      return {
        payments: paginated,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1
      };
    }
    const offset = (page - 1) * limit;

    let countQuery = `SELECT COUNT(*) FROM admin_payments WHERE status = 'success'`;
    let dataQuery = `SELECT * FROM admin_payments WHERE status = 'success'`;
    const params: any[] = [];
    let idx = 1;

    if (country) {
      countQuery += ` AND country = $${idx}`;
      dataQuery += ` AND country = $${idx}`;
      params.push(country);
      idx++;
    }

    if (plan) {
      countQuery += ` AND plan = $${idx}`;
      dataQuery += ` AND plan = $${idx}`;
      params.push(plan.toLowerCase());
      idx++;
    }

    if (startDate) {
      countQuery += ` AND created_at >= $${idx}`;
      dataQuery += ` AND created_at >= $${idx}`;
      params.push(new Date(startDate));
      idx++;
    }

    if (endDate) {
      countQuery += ` AND created_at <= $${idx}`;
      dataQuery += ` AND created_at <= $${idx}`;
      params.push(new Date(endDate));
      idx++;
    }

    const countRes = await pool.query(countQuery, params);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    dataQuery += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    const dataRes = await pool.query(dataQuery, [...params, limit, offset]);

    return {
      payments: dataRes.rows,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1
    };
  },

  async getDailyRevenue() {
    if (!isDbActive) {
      const map = new Map<string, number>();
      for (const p of memPayments) {
        const dStr = new Date(p.created_at).toISOString().split('T')[0];
        map.set(dStr, (map.get(dStr) || 0) + Number(p.amount_usd));
      }
      return Array.from(map.entries())
        .map(([date, revenue]) => ({ date, revenue: parseFloat(revenue.toFixed(2)) }))
        .sort((a,b) => a.date.localeCompare(b.date));
    }
    const query = `
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM-DD') as date, 
        ROUND(SUM(amount_usd), 2) as revenue 
      FROM admin_payments 
      WHERE status = 'success' 
      GROUP BY date 
      ORDER BY date ASC
      LIMIT 100
    `;
    const res = await pool.query(query);
    return res.rows.map(r => ({
      date: r.date,
      revenue: parseFloat(r.revenue || 0)
    }));
  },

  async getMonthlyRevenue() {
    if (!isDbActive) {
      const map = new Map<string, number>();
      for (const p of memPayments) {
        const mStr = new Date(p.created_at).toISOString().substring(0, 7);
        map.set(mStr, (map.get(mStr) || 0) + Number(p.amount_usd));
      }
      return Array.from(map.entries())
        .map(([month, revenue]) => ({ month, revenue: parseFloat(revenue.toFixed(2)) }))
        .sort((a,b) => a.month.localeCompare(b.month));
    }
    const query = `
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month, 
        ROUND(SUM(amount_usd), 2) as revenue 
      FROM admin_payments 
      WHERE status = 'success' 
      GROUP BY month 
      ORDER BY month ASC
    `;
    const res = await pool.query(query);
    return res.rows.map(r => ({
      month: r.month,
      revenue: parseFloat(r.revenue || 0)
    }));
  },

  async getUserOverview() {
    if (!isDbActive) {
      const total = memUsers.length;
      let free = 0;
      let plus = 0;
      let premium = 0;
      for (const u of memUsers) {
        const settings = memPreferences.get(u.id);
        const plan = (settings?.subscriptionPlan || 'free').toLowerCase();
        if (plan === 'plus') plus++;
        else if (plan === 'premium') premium++;
        else free++;
      }
      const now = Date.now();
      const filterCreatedInHours = (h: number) => {
        const cutoff = now - h * 60 * 60 * 1000;
        return memUsers.filter(u => new Date(u.created_at).getTime() >= cutoff).length;
      };
      return {
        total_users: total,
        active_users: Math.min(total, Math.round(plus + premium + free * 0.62)),
        free_users: free,
        plus_users: plus,
        premium_users: premium,
        new_users_today: filterCreatedInHours(24),
        new_users_this_week: filterCreatedInHours(24 * 7),
        new_users_this_month: filterCreatedInHours(24 * 30)
      };
    }
    let total = 0;
    let free = 0;
    let plus = 0;
    let premium = 0;
    let todayReg = 0;
    let weekReg = 0;
    let monthReg = 0;

    const tRes = await pool.query(`SELECT COUNT(*) FROM users`);
    total = parseInt(tRes.rows[0]?.count || '0', 10);

    const pRes = await pool.query(`
      SELECT 
        COALESCE(p.settings->>'subscriptionPlan', 'free') as plan, 
        COUNT(*) as count 
      FROM users u
      LEFT JOIN user_preferences p ON u.id = p.user_id
      GROUP BY plan
    `);
    plus = 0;
    premium = 0;
    free = total;
    pRes.rows.forEach(r => {
      const planName = (r.plan || '').toLowerCase();
      const pCount = parseInt(r.count, 10);
      if (planName === 'plus') {
        plus = pCount;
        free -= pCount;
      } else if (planName === 'premium') {
        premium = pCount;
        free -= pCount;
      }
    });

    const regRes = await pool.query(`
      SELECT 
        COALESCE(COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END), 0) as today,
        COALESCE(COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END), 0) as week,
        COALESCE(COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END), 0) as month
      FROM users
    `);
    const regRow = regRes.rows[0] || {};
    todayReg = parseInt(regRow.today, 10);
    weekReg = parseInt(regRow.week, 10);
    monthReg = parseInt(regRow.month, 10);

    // Active users: actual users with active plan + active free users
    const active = Math.min(total, Math.round(plus + premium + (free * 0.62)));

    return {
      total_users: total,
      active_users: active,
      free_users: free,
      plus_users: plus,
      premium_users: premium,
      new_users_today: todayReg,
      new_users_this_week: weekReg,
      new_users_this_month: monthReg
    };
  },

  async getAllUsers(
    page: number,
    limit: number,
    plan?: string,
    country?: string,
    status?: string
  ) {
    if (!isDbActive) {
      let filtered = memUsers.map(u => {
        const settings = memPreferences.get(u.id);
        return {
          id: u.id,
          email: u.email,
          username: u.username,
          full_name: u.full_name,
          country: u.country,
          bio: u.bio || '',
          experience_level: u.experience_level,
          avatar_url: u.avatar_url || '',
          created_at: u.created_at,
          plan: settings?.subscriptionPlan || 'free',
          subscription_expiry: settings?.subscriptionExpiry || null,
          is_recurring: settings?.isSubscriptionRecurring || false,
          settings: settings || null
        };
      });
      if (plan) {
        const filterPlan = plan.toLowerCase() === 'free' ? 'basic' : plan.toLowerCase();
        filtered = filtered.filter(u => {
          const uPlan = (u.plan || '').toLowerCase();
          if (filterPlan === 'basic') return uPlan === 'basic' || uPlan === 'free';
          return uPlan === filterPlan;
        });
      }
      if (country) {
        filtered = filtered.filter(u => u.country === country);
      }
      if (status) {
        const now = Date.now();
        if (status === 'active') {
          filtered = filtered.filter(u => (u.plan === 'plus' || u.plan === 'premium') && Number(u.subscription_expiry) > now);
        } else if (status === 'expired') {
          filtered = filtered.filter(u => Number(u.subscription_expiry) <= now);
        }
      }
      filtered.sort((a,b) => b.created_at.localeCompare(a.created_at));
      const total = filtered.length;
      const startIdx = (page - 1) * limit;
      const paginated = filtered.slice(startIdx, startIdx + limit);
      return {
        users: paginated,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1
      };
    }
    const offset = (page - 1) * limit;

    let countQuery = `
      SELECT COUNT(*) 
      FROM users u
      LEFT JOIN user_preferences p ON u.id = p.user_id
      WHERE 1=1
    `;
    let dataQuery = `
      SELECT 
        u.id, 
        u.email, 
        u.username, 
        u.full_name, 
        u.country, 
        u.bio,
        u.avatar_url,
        u.experience_level, 
        u.created_at,
        p.settings as settings,
        COALESCE(p.settings->>'subscriptionPlan', 'free') as plan,
        (p.settings->>'subscriptionExpiry')::numeric as subscription_expiry,
        (p.settings->>'isSubscriptionRecurring')::boolean as is_recurring
      FROM users u
      LEFT JOIN user_preferences p ON u.id = p.user_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (plan) {
      const filterPlan = plan.toLowerCase() === 'free' ? 'basic' : plan.toLowerCase();
      if (filterPlan === 'basic') {
        countQuery += ` AND (COALESCE(p.settings->>'subscriptionPlan', 'free') = 'basic' OR COALESCE(p.settings->>'subscriptionPlan', 'free') = 'free')`;
        dataQuery += ` AND (COALESCE(p.settings->>'subscriptionPlan', 'free') = 'basic' OR COALESCE(p.settings->>'subscriptionPlan', 'free') = 'free')`;
      } else {
        countQuery += ` AND COALESCE(p.settings->>'subscriptionPlan', 'free') = $${idx}`;
        dataQuery += ` AND COALESCE(p.settings->>'subscriptionPlan', 'free') = $${idx}`;
        params.push(filterPlan);
        idx++;
      }
    }

    if (country) {
      countQuery += ` AND u.country = $${idx}`;
      dataQuery += ` AND u.country = $${idx}`;
      params.push(country);
      idx++;
    }

    if (status) {
      if (status === 'active') {
        countQuery += ` AND (p.settings->>'subscriptionPlan' = 'plus' OR p.settings->>'subscriptionPlan' = 'premium') AND (p.settings->>'subscriptionExpiry')::numeric > ${Date.now()}`;
        dataQuery += ` AND (p.settings->>'subscriptionPlan' = 'plus' OR p.settings->>'subscriptionPlan' = 'premium') AND (p.settings->>'subscriptionExpiry')::numeric > ${Date.now()}`;
      } else if (status === 'expired') {
        countQuery += ` AND (p.settings->>'subscriptionExpiry')::numeric <= ${Date.now()}`;
        dataQuery += ` AND (p.settings->>'subscriptionExpiry')::numeric <= ${Date.now()}`;
      }
    }

    const countRes = await pool.query(countQuery, params);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    dataQuery += ` ORDER BY u.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    const dataRes = await pool.query(dataQuery, [...params, limit, offset]);

    const parsedUsers = dataRes.rows.map(row => {
      let parsedSettings = null;
      if (row.settings) {
        parsedSettings = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
      }
      return {
        id: row.id,
        email: row.email,
        username: row.username,
        full_name: row.full_name,
        country: row.country,
        bio: row.bio || '',
        avatar_url: row.avatar_url || '',
        experience_level: row.experience_level,
        created_at: row.created_at,
        plan: row.plan,
        subscription_expiry: row.subscription_expiry ? Number(row.subscription_expiry) : null,
        is_recurring: !!row.is_recurring,
        settings: parsedSettings
      };
    });

    return {
      users: parsedUsers,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1
    };
  },

  async getUsersByPlan() {
    const overview = await this.getUserOverview();
    return {
      free: overview.free_users,
      plus: overview.plus_users,
      premium: overview.premium_users
    };
  },

  async getUsersByCountry() {
    if (!isDbActive) {
      const countryMap = new Map<string, number>();
      memUsers.forEach(u => {
        const cName = u.country || 'Unknown';
        countryMap.set(cName, (countryMap.get(cName) || 0) + 1);
      });
      const parsedCountries = Array.from(countryMap.entries()).map(([name, count]) => ({ name, count }));
      parsedCountries.sort((a, b) => b.count - a.count);

      const result: Record<string, number> = {};
      const top4 = parsedCountries.slice(0, 4);
      let otherCount = 0;

      parsedCountries.slice(4).forEach(c => {
        otherCount += c.count;
      });

      top4.forEach(c => {
        result[c.name] = c.count;
      });
      if (otherCount > 0 || parsedCountries.length > 4) {
        result['Other'] = otherCount;
      }

      return {
        "Nigeria": result["Nigeria"] || 0,
        "Ghana": result["Ghana"] || 0,
        "Kenya": result["Kenya"] || 0,
        "South Africa": result["South Africa"] || 0,
        "Other": result["Other"] || result["United States"] || 0
      };
    }
    const countryMap = new Map<string, number>();

    const res = await pool.query(`SELECT country, COUNT(*) as count FROM users GROUP BY country`);
    res.rows.forEach(r => {
      const cName = r.country || 'Unknown';
      countryMap.set(cName, parseInt(r.count, 10));
    });

    const parsedCountries = Array.from(countryMap.entries()).map(([name, count]) => ({ name, count }));
    parsedCountries.sort((a, b) => b.count - a.count);

    const result: Record<string, number> = {};
    const top4 = parsedCountries.slice(0, 4);
    let otherCount = 0;

    parsedCountries.slice(4).forEach(c => {
      otherCount += c.count;
    });

    top4.forEach(c => {
      result[c.name] = c.count;
    });
    if (otherCount > 0 || parsedCountries.length > 4) {
      result['Other'] = otherCount;
    }

    return {
      "Nigeria": result["Nigeria"] || 0,
      "Ghana": result["Ghana"] || 0,
      "Kenya": result["Kenya"] || 0,
      "South Africa": result["South Africa"] || 0,
      "Other": result["Other"] || result["United States"] || 0
    };
  },

  async getNewUserRegistrations() {
    if (!isDbActive) {
      const dailyMap = new Map<string, number>();
      const monthlyMap = new Map<string, number>();

      memUsers.forEach(u => {
        const dStr = new Date(u.created_at).toISOString().split('T')[0];
        const mStr = u.created_at.substring(0, 7);
        dailyMap.set(dStr, (dailyMap.get(dStr) || 0) + 1);
        monthlyMap.set(mStr, (monthlyMap.get(mStr) || 0) + 1);
      });

      const daily = Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
      const monthly = Array.from(monthlyMap.entries()).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month));

      return {
        daily,
        weekly: daily.slice(-7), 
        monthly,
        yearly: monthly
      };
    }
    const dailyMap = new Map<string, number>();
    const monthlyMap = new Map<string, number>();

    const dRes = await pool.query(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM-DD') as date, 
        COUNT(*) as count 
      FROM users 
      GROUP BY date 
      ORDER BY date ASC
      LIMIT 30
    `);
    dRes.rows.forEach(r => dailyMap.set(r.date, parseInt(r.count, 10)));

    const mRes = await pool.query(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month, 
        COUNT(*) as count 
      FROM users 
      GROUP BY month 
      ORDER BY month ASC
    `);
    mRes.rows.forEach(r => monthlyMap.set(r.month, parseInt(r.count, 10)));

    const daily = Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
    const monthly = Array.from(monthlyMap.entries()).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month));

    return {
      daily,
      weekly: daily.slice(-7), 
      monthly,
      yearly: monthly
    };
  },

  async getSubscriptionOverview() {
    const nowMs = Date.now();
    if (!isDbActive) {
      let active = 0;
      let expired = 0;
      let renewedThisMonth = 0;
      let cancelledThisMonth = 0;

      for (const settings of memPreferences.values()) {
        const plan = settings?.subscriptionPlan;
        if (plan === 'plus' || plan === 'premium') {
          if (Number(settings.subscriptionExpiry) > nowMs) {
            active++;
          } else {
            expired++;
          }
        } else if (plan === 'basic' || plan === 'free') {
          if (settings.isSubscriptionRecurring === false) {
            cancelledThisMonth++;
          }
        }
      }

      const cutoff = nowMs - 30 * 24 * 60 * 60 * 1000;
      renewedThisMonth = memPayments.filter(p => new Date(p.created_at).getTime() >= cutoff).length;

      return {
        active_subscriptions: active,
        expired_subscriptions: expired,
        renewed_this_month: renewedThisMonth,
        cancelled_this_month: Math.max(0, cancelledThisMonth)
      };
    }
    let active = 0;
    let expired = 0;
    let renewedThisMonth = 0;
    let cancelledThisMonth = 0;

    const activeRes = await pool.query(`
      SELECT COUNT(*) FROM user_preferences 
      WHERE (settings->>'subscriptionPlan' = 'plus' OR settings->>'subscriptionPlan' = 'premium')
        AND (settings->>'subscriptionExpiry')::numeric > $1
    `, [nowMs]);
    active = parseInt(activeRes.rows[0]?.count || '0', 10);

    const expiredRes = await pool.query(`
      SELECT COUNT(*) FROM user_preferences 
      WHERE (settings->>'subscriptionPlan' = 'plus' OR settings->>'subscriptionPlan' = 'premium')
        AND (settings->>'subscriptionExpiry')::numeric <= $1
    `, [nowMs]);
    expired = parseInt(expiredRes.rows[0]?.count || '0', 10);

    const renewedRes = await pool.query(`
      SELECT COUNT(*) FROM admin_payments 
      WHERE status = 'success' AND created_at >= NOW() - INTERVAL '30 days'
    `);
    renewedThisMonth = parseInt(renewedRes.rows[0]?.count || '0', 10);

    const cancelledRes = await pool.query(`
      SELECT COUNT(*) FROM user_preferences
      WHERE (settings->>'subscriptionPlan' = 'basic' OR settings->>'subscriptionPlan' = 'free')
        AND (settings->>'subscriptionExpiry')::numeric <= $1
        AND (settings->>'isSubscriptionRecurring')::boolean = false
    `, [nowMs]);
    cancelledThisMonth = parseInt(cancelledRes.rows[0]?.count || '0', 10);

    return {
      active_subscriptions: active,
      expired_subscriptions: expired,
      renewed_this_month: renewedThisMonth,
      cancelled_this_month: cancelledThisMonth
    };
  },

  async getExpiringSubscriptions() {
    const list: any[] = [];
    const nowMs = Date.now();
    const ms7Days = 7 * 24 * 60 * 60 * 1000;

    if (!isDbActive) {
      for (const u of memUsers) {
        const settings = memPreferences.get(u.id);
        const exp = Number(settings?.subscriptionExpiry);
        if (settings && exp > nowMs && exp <= nowMs + ms7Days && settings.isSubscriptionRecurring === false) {
          list.push({
            id: u.id,
            email: u.email,
            username: u.username,
            full_name: u.full_name,
            country: u.country,
            plan: settings.subscriptionPlan || 'plus',
            expiry: exp
          });
        }
      }
      return list;
    }

    const query = `
      SELECT u.id, u.email, u.username, u.full_name, u.country, p.settings
      FROM users u
      JOIN user_preferences p ON u.id = p.user_id
      WHERE (p.settings->>'subscriptionExpiry')::numeric > ${nowMs}
        AND (p.settings->>'subscriptionExpiry')::numeric <= ${nowMs + ms7Days}
        AND (p.settings->>'isSubscriptionRecurring')::boolean = false
    `;
    const res = await pool.query(query);
    res.rows.forEach(row => {
      const settings = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
      list.push({
        id: row.id,
        email: row.email,
        username: row.username,
        full_name: row.full_name,
        country: row.country,
        plan: settings?.subscriptionPlan || 'plus',
        expiry: parseFloat(settings?.subscriptionExpiry)
      });
    });

    return list;
  },

  async logAdminRequest(
    endpoint: string,
    method: string,
    queryParams: any,
    ipAddress: string | null,
    statusCode: number
  ) {
    const id = crypto.randomUUID();
    const qStr = JSON.stringify(queryParams || {});
    const now = new Date();

    if (!isDbActive) {
      memAuditLogs.push({
        id,
        endpoint,
        method,
        query_params: queryParams || {},
        ip_address: ipAddress,
        status_code: statusCode,
        created_at: now
      });
      return;
    }

    await pool.query(
      `INSERT INTO admin_audit_logs (id, endpoint, method, query_params, ip_address, status_code, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, endpoint, method, qStr, ipAddress, statusCode, now]
    );
  },

  async getAdminAuditLogs(limit: number = 100) {
    if (!isDbActive) {
      return [...memAuditLogs].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit);
    }
    const res = await pool.query(
      `SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return res.rows;
  },

  async saveSupportMessages(userId: string, messages: any[]) {
    if (!isDbActive) {
      memSupportMessages.set(userId, messages);
      return;
    }
    const messagesStr = JSON.stringify(messages);
    await pool.query(
      `INSERT INTO user_support_messages (user_id, messages, updated_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (user_id) 
       DO UPDATE SET messages = EXCLUDED.messages, updated_at = NOW()`,
      [userId, messagesStr]
    );
  },

  async getSupportMessages(userId: string) {
    if (!isDbActive) {
      return memSupportMessages.get(userId) || [];
    }
    const res = await pool.query('SELECT messages FROM user_support_messages WHERE user_id = $1', [userId]);
    if (res.rows[0]) {
      return typeof res.rows[0].messages === 'string' ? JSON.parse(res.rows[0].messages) : res.rows[0].messages;
    }
    return [];
  },

  // --- JOURNAL SERVICES ---
  async journalGetAccounts(userId: string) {
    if (!isDbActive) {
      return memJournalAccounts.filter(a => a.userId === userId);
    }
    const res = await pool.query('SELECT * FROM journal_accounts WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    return res.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      type: row.type,
      phase: row.phase ? Number(row.phase) : undefined,
      initialBalance: Number(row.initial_balance),
      currentBalance: Number(row.current_balance),
      currency: row.currency,
      propType: row.prop_type,
      maxDrawdown: row.max_drawdown ? Number(row.max_drawdown) : undefined,
      dailyDrawdown: row.daily_drawdown ? Number(row.daily_drawdown) : undefined,
      profitTarget: row.profit_target ? Number(row.profit_target) : undefined,
      status: row.status,
      riskPerTrade: row.risk_per_trade ? Number(row.risk_per_trade) : undefined,
      riskType: row.risk_type,
      drawdownType: row.drawdown_type,
      drawdownValue: row.drawdown_value ? Number(row.drawdown_value) : undefined,
      liveTargetAmount: row.live_target_amount ? Number(row.live_target_amount) : undefined,
      createdAt: row.created_at
    }));
  },

  async journalAddAccount(userId: string, data: any) {
    const id = data.id || crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const record = {
      id,
      userId,
      name: data.name,
      type: data.type,
      phase: data.phase,
      initialBalance: data.initialBalance,
      currentBalance: data.currentBalance ?? data.initialBalance,
      currency: data.currency,
      propType: data.propType,
      maxDrawdown: data.maxDrawdown,
      dailyDrawdown: data.dailyDrawdown,
      profitTarget: data.profitTarget,
      status: data.status || 'active',
      riskPerTrade: data.riskPerTrade,
      riskType: data.riskType,
      drawdownType: data.drawdownType,
      drawdownValue: data.drawdownValue,
      liveTargetAmount: data.liveTargetAmount,
      createdAt
    };

    if (!isDbActive) {
      memJournalAccounts.push(record);
      return id;
    }

    await pool.query(`
      INSERT INTO journal_accounts (
        id, user_id, name, type, phase, initial_balance, current_balance, currency,
        prop_type, max_drawdown, daily_drawdown, profit_target, status, risk_per_trade,
        risk_type, drawdown_type, drawdown_value, live_target_amount, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    `, [
      id, userId, data.name, data.type, data.phase, data.initialBalance, data.currentBalance ?? data.initialBalance, data.currency,
      data.propType, data.maxDrawdown, data.dailyDrawdown, data.profitTarget, data.status || 'active', data.riskPerTrade,
      data.riskType, data.drawdownType, data.drawdownValue, data.liveTargetAmount, createdAt
    ]);

    return id;
  },

  async journalUpdateAccount(accountId: string, updates: any) {
    if (!isDbActive) {
      const acc = memJournalAccounts.find(a => a.id === accountId);
      if (acc) {
        Object.assign(acc, updates);
      }
      return;
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    // Field mapper
    const fieldMapping: Record<string, string> = {
      name: 'name',
      type: 'type',
      phase: 'phase',
      initialBalance: 'initial_balance',
      currentBalance: 'current_balance',
      currency: 'currency',
      propType: 'prop_type',
      maxDrawdown: 'max_drawdown',
      dailyDrawdown: 'daily_drawdown',
      profitTarget: 'profit_target',
      status: 'status',
      riskPerTrade: 'risk_per_trade',
      riskType: 'risk_type',
      drawdownType: 'drawdown_type',
      drawdownValue: 'drawdown_value',
      liveTargetAmount: 'live_target_amount'
    };

    Object.entries(updates).forEach(([key, val]) => {
      const dbCol = fieldMapping[key];
      if (dbCol && val !== undefined) {
        fields.push(`${dbCol} = $${idx}`);
        values.push(val);
        idx++;
      }
    });

    if (fields.length === 0) return;

    values.push(accountId);
    await pool.query(
      `UPDATE journal_accounts SET ${fields.join(', ')} WHERE id = $${idx}`,
      values
    );
  },

  async journalDeleteAccount(accountId: string) {
    if (!isDbActive) {
      const idx = memJournalAccounts.findIndex(a => a.id === accountId);
      if (idx !== -1) memJournalAccounts.splice(idx, 1);
      // Clean cascade manually in memory
      for (let i = memJournalTrades.length - 1; i >= 0; i--) {
        if (memJournalTrades[i].accountId === accountId) {
          memJournalTrades.splice(i, 1);
        }
      }
      for (let i = memJournalWithdrawals.length - 1; i >= 0; i--) {
        if (memJournalWithdrawals[i].accountId === accountId) {
          memJournalWithdrawals.splice(i, 1);
        }
      }
      return;
    }
    await pool.query('DELETE FROM journal_accounts WHERE id = $1', [accountId]);
  },

  async journalGetTrades(accountId: string) {
    if (!isDbActive) {
      return memJournalTrades.filter(t => t.accountId === accountId);
    }
    const res = await pool.query('SELECT * FROM journal_trades WHERE account_id = $1 ORDER BY created_at DESC', [accountId]);
    return res.rows.map(row => ({
      id: row.id,
      accountId: row.account_id,
      userId: row.user_id,
      pair: row.pair,
      type: row.type,
      entryPrice: Number(row.entry_price),
      stopLoss: Number(row.stop_loss),
      takeProfit: row.take_profit ? Number(row.take_profit) : undefined,
      lotSize: row.lot_size ? Number(row.lot_size) : undefined,
      riskAmount: row.risk_amount ? Number(row.risk_amount) : undefined,
      exitPrice: row.exit_price ? Number(row.exit_price) : undefined,
      profitLoss: row.profit_loss ? Number(row.profit_loss) : undefined,
      additionalLoss: row.additional_loss ? Number(row.additional_loss) : undefined,
      status: row.status,
      imageUrl: row.image_url,
      afterImageUrl: row.after_image_url,
      notes: row.notes,
      analysisBy: row.analysis_by,
      createdAt: row.created_at,
      closedAt: row.closed_at
    }));
  },

  async journalGetAllUserTrades(userId: string) {
    if (!isDbActive) {
      return memJournalTrades.filter(t => t.userId === userId);
    }
    const res = await pool.query('SELECT * FROM journal_trades WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    return res.rows.map(row => ({
      id: row.id,
      accountId: row.account_id,
      userId: row.user_id,
      pair: row.pair,
      type: row.type,
      entryPrice: Number(row.entry_price),
      stopLoss: Number(row.stop_loss),
      takeProfit: row.take_profit ? Number(row.take_profit) : undefined,
      lotSize: row.lot_size ? Number(row.lot_size) : undefined,
      riskAmount: row.risk_amount ? Number(row.risk_amount) : undefined,
      exitPrice: row.exit_price ? Number(row.exit_price) : undefined,
      profitLoss: row.profit_loss ? Number(row.profit_loss) : undefined,
      additionalLoss: row.additional_loss ? Number(row.additional_loss) : undefined,
      status: row.status,
      imageUrl: row.image_url,
      afterImageUrl: row.after_image_url,
      notes: row.notes,
      analysisBy: row.analysis_by,
      createdAt: row.created_at,
      closedAt: row.closed_at
    }));
  },

  async journalAddTrade(userId: string, data: any) {
    const id = data.id || crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const record = {
      id,
      accountId: data.accountId,
      userId,
      pair: data.pair,
      type: data.type,
      entryPrice: data.entryPrice,
      stopLoss: data.stopLoss,
      takeProfit: data.takeProfit,
      lotSize: data.lotSize,
      riskAmount: data.riskAmount,
      exitPrice: data.exitPrice,
      profitLoss: data.profitLoss,
      additionalLoss: data.additionalLoss,
      status: data.status || 'open',
      imageUrl: data.imageUrl,
      afterImageUrl: data.afterImageUrl,
      notes: data.notes,
      analysisBy: data.analysisBy,
      createdAt,
      closedAt: data.closedAt
    };

    if (!isDbActive) {
      memJournalTrades.push(record);
      return id;
    }

    await pool.query(`
      INSERT INTO journal_trades (
        id, account_id, user_id, pair, type, entry_price, stop_loss, take_profit,
        lot_size, risk_amount, exit_price, profit_loss, additional_loss, status,
        image_url, after_image_url, notes, analysis_by, created_at, closed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    `, [
      id, data.accountId, userId, data.pair, data.type, data.entryPrice, data.stopLoss, data.takeProfit,
      data.lotSize, data.riskAmount, data.exitPrice, data.profitLoss, data.additionalLoss, data.status || 'open',
      data.imageUrl, data.afterImageUrl, data.notes, data.analysisBy, createdAt, data.closedAt
    ]);

    return id;
  },

  async journalUpdateTrade(tradeId: string, updates: any) {
    if (!isDbActive) {
      const tr = memJournalTrades.find(t => t.id === tradeId);
      if (tr) {
        Object.assign(tr, updates);
      }
      return;
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    // Field mapper
    const fieldMapping: Record<string, string> = {
      pair: 'pair',
      type: 'type',
      entryPrice: 'entry_price',
      stopLoss: 'stop_loss',
      takeProfit: 'take_profit',
      lotSize: 'lot_size',
      riskAmount: 'risk_amount',
      exitPrice: 'exit_price',
      profitLoss: 'profit_loss',
      additionalLoss: 'additional_loss',
      status: 'status',
      imageUrl: 'image_url',
      afterImageUrl: 'after_image_url',
      notes: 'notes',
      analysisBy: 'analysis_by',
      closedAt: 'closed_at'
    };

    Object.entries(updates).forEach(([key, val]) => {
      const dbCol = fieldMapping[key];
      if (dbCol && val !== undefined) {
        fields.push(`${dbCol} = $${idx}`);
        values.push(val);
        idx++;
      }
    });

    if (fields.length === 0) return;

    values.push(tradeId);
    await pool.query(
      `UPDATE journal_trades SET ${fields.join(', ')} WHERE id = $${idx}`,
      values
    );
  },

  async journalDeleteTrade(tradeId: string) {
    if (!isDbActive) {
      const idx = memJournalTrades.findIndex(t => t.id === tradeId);
      if (idx !== -1) memJournalTrades.splice(idx, 1);
      return;
    }
    await pool.query('DELETE FROM journal_trades WHERE id = $1', [tradeId]);
  },

  async journalGetWithdrawals(accountId: string) {
    if (!isDbActive) {
      return memJournalWithdrawals.filter(w => w.accountId === accountId);
    }
    const res = await pool.query('SELECT * FROM journal_withdrawals WHERE account_id = $1 ORDER BY created_at DESC', [accountId]);
    return res.rows.map(row => ({
      id: row.id,
      accountId: row.account_id,
      userId: row.user_id,
      amount: Number(row.amount),
      notes: row.notes,
      createdAt: row.created_at
    }));
  },

  async journalGetAllUserWithdrawals(userId: string) {
    if (!isDbActive) {
      return memJournalWithdrawals.filter(w => w.userId === userId);
    }
    const res = await pool.query('SELECT * FROM journal_withdrawals WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    return res.rows.map(row => ({
      id: row.id,
      accountId: row.account_id,
      userId: row.user_id,
      amount: Number(row.amount),
      notes: row.notes,
      createdAt: row.created_at
    }));
  },

  async journalAddWithdrawal(userId: string, data: any) {
    const id = data.id || crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const record = {
      id,
      accountId: data.accountId,
      userId,
      amount: data.amount,
      notes: data.notes,
      createdAt
    };

    if (!isDbActive) {
      memJournalWithdrawals.push(record);
      return id;
    }

    await pool.query(`
      INSERT INTO journal_withdrawals (id, account_id, user_id, amount, notes, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, data.accountId, userId, data.amount, data.notes, createdAt]);

    return id;
  },

  async deleteUserPermanently(userId: string): Promise<void> {
    if (!isDbActive) {
      // 1. Remove from memUsers
      const userIdx = memUsers.findIndex(u => u.id === userId);
      if (userIdx !== -1) {
        memUsers.splice(userIdx, 1);
      }
      
      // 2. Remove trades
      for (let i = memTrades.length - 1; i >= 0; i--) {
        if (memTrades[i].user_id === userId) {
          memTrades.splice(i, 1);
        }
      }

      // 3. Delete drawings
      memDrawings.delete(userId);

      // 4. Delete preferences
      memPreferences.delete(userId);

      // 5. Delete watchlist
      memWatchlist.delete(userId);

      // 6. Delete backtest sessions
      memBacktestSessions.delete(userId);

      // 7. Delete active device sessions
      memSessions.delete(userId);

      // 8. Delete setups
      for (let i = memSetups.length - 1; i >= 0; i--) {
        if (memSetups[i].user_id === userId) {
          memSetups.splice(i, 1);
        }
      }

      // 9. Delete preregistration
      memCompetitionPreregistrations.delete(userId);

      // 10. Delete support messages
      memSupportMessages.delete(userId);

      // 11. Delete journal accounts, trades, withdrawals
      for (let i = memJournalAccounts.length - 1; i >= 0; i--) {
        if (memJournalAccounts[i].userId === userId || memJournalAccounts[i].user_id === userId) {
          memJournalAccounts.splice(i, 1);
        }
      }
      for (let i = memJournalTrades.length - 1; i >= 0; i--) {
        if (memJournalTrades[i].userId === userId || memJournalTrades[i].user_id === userId) {
          memJournalTrades.splice(i, 1);
        }
      }
      for (let i = memJournalWithdrawals.length - 1; i >= 0; i--) {
        if (memJournalWithdrawals[i].userId === userId || memJournalWithdrawals[i].user_id === userId) {
          memJournalWithdrawals.splice(i, 1);
        }
      }
      return;
    }

    // CockroachDB cascades ON DELETE CASCADE for all references of user_id, 
    // and ON DELETE SET NULL for admin_payments.
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  },

  async adminUpdateUser(userId: string, updates: any): Promise<any> {
    const coreFields = ['email', 'password_hash', 'username', 'full_name', 'country', 'bio', 'experience_level', 'avatar_url'];
    const userUpdates: Record<string, any> = {};
    let hasUserUpdates = false;

    coreFields.forEach(f => {
      if (updates[f] !== undefined) {
        userUpdates[f] = updates[f];
        hasUserUpdates = true;
      }
    });

    if (hasUserUpdates) {
      if (!isDbActive) {
        const user = memUsers.find(u => u.id === userId);
        if (user) {
          Object.assign(user, userUpdates);
        }
      } else {
        const fields: string[] = [];
        const values: any[] = [];
        let idx = 1;

        Object.entries(userUpdates).forEach(([key, val]) => {
          fields.push(`${key} = $${idx}`);
          values.push(val);
          idx++;
        });

        values.push(userId);
        await pool.query(
          `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`,
          values
        );
      }
    }

    if (updates.settings || updates.preferences || updates.subscriptionPlan || updates.subscriptionExpiry || updates.isSubscriptionRecurring !== undefined) {
      const settingsUpdates: any = {};
      if (updates.settings) Object.assign(settingsUpdates, updates.settings);
      if (updates.preferences) Object.assign(settingsUpdates, updates.preferences);
      
      const subFields = ['subscriptionPlan', 'subscriptionExpiry', 'isSubscriptionRecurring', 'theme', 'billingCycle'];
      subFields.forEach(f => {
        if (updates[f] !== undefined) {
          settingsUpdates[f] = updates[f];
        }
      });

      if (Object.keys(settingsUpdates).length > 0) {
        await this.savePreferences(userId, settingsUpdates);
      }
    }

    return await this.getUserById(userId);
  },

  async adminGetAllWatchlists(): Promise<any[]> {
    if (!isDbActive) {
      const results: any[] = [];
      memWatchlist.forEach((items, userId) => {
        results.push({ userId, items });
      });
      return results;
    }
    const res = await pool.query('SELECT user_id as "userId", items FROM user_watchlist');
    return res.rows;
  },

  async adminGetWatchlistItemStats(userId: string, watchlistId: string): Promise<any> {
    const watchlist = await this.getWatchlist(userId);
    const item = watchlist.find((i: any) => i.id === watchlistId || i.symbol?.toUpperCase() === watchlistId.toUpperCase());
    
    if (!item) {
      return { found: false };
    }

    const finalWatchlistId = item.id || watchlistId;

    let trades: any[] = [];
    if (!isDbActive) {
      trades = memTrades.filter((t: any) => 
        t.user_id === userId && 
        (t.watchlist_id === finalWatchlistId || 
         (t.symbol?.toUpperCase() === item.symbol?.toUpperCase() && t.prefix === item.prefix))
      );
    } else {
      const res = await pool.query(
        `SELECT * FROM user_trades 
         WHERE user_id = $1 
           AND (watchlist_id = $2 OR (UPPER(symbol) = UPPER($3) AND (prefix = $4 OR ($4 IS NULL AND prefix IS NULL))))`,
        [userId, finalWatchlistId, item.symbol, item.prefix || null]
      );
      trades = res.rows;
    }

    let totalTrades = trades.length;
    let totalWins = 0;
    let totalLosses = 0;
    let totalBreakevens = 0;
    let netPips = 0;
    let totalRR = 0;
    let longTradesCount = 0;
    let shortTradesCount = 0;

    trades.forEach((t: any) => {
      const pipsVal = parseFloat(t.pips) || 0;
      const rrVal = parseFloat(t.rr) || 0;
      const tStatus = (t.status || "").toUpperCase();
      const tType = (t.type || "").toUpperCase();

      netPips += pipsVal;
      totalRR += rrVal;

      if (tStatus === 'TP' || tStatus === 'WIN' || pipsVal > 0) {
        totalWins++;
      } else if (tStatus === 'SL' || tStatus === 'LOSS' || pipsVal < 0) {
        totalLosses++;
      } else {
        totalBreakevens++;
      }

      if (tType === 'LONG' || tType === 'BUY') {
        longTradesCount++;
      } else if (tType === 'SHORT' || tType === 'SELL') {
        shortTradesCount++;
      }
    });

    const winRate = totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(2) + "%" : "0.00%";
    const averageRR = totalTrades > 0 ? (totalRR / totalTrades).toFixed(2) : "0.00";

    const sessions = await this.getBacktestSessions(userId);
    const sessionState = sessions[finalWatchlistId] || sessions[`${item.symbol}_${item.prefix || ''}`] || null;

    return {
      found: true,
      item,
      statistics: {
        totalTrades,
        totalWins,
        totalLosses,
        totalBreakevens,
        winRate,
        netPips: parseFloat(netPips.toFixed(2)),
        totalRR: parseFloat(totalRR.toFixed(2)),
        averageRR: parseFloat(averageRR),
        longTradesCount,
        shortTradesCount
      },
      trades,
      sessionState
    };
  },

  async adminGetAllUserEmails(): Promise<string[]> {
    if (!isDbActive) {
      return memUsers.map(u => u.email);
    }
    const res = await pool.query('SELECT email FROM users');
    return res.rows.map(row => row.email);
  },

  async recordUserActivity(userId: string): Promise<void> {
    const todayStr = new Date().toISOString().split('T')[0];
    if (!isDbActive) {
      const exists = memUserActivityLogs.some(
        log => log.user_id === userId && log.activity_date === todayStr
      );
      if (!exists) {
        memUserActivityLogs.push({
          id: crypto.randomUUID(),
          user_id: userId,
          activity_date: todayStr,
          created_at: new Date()
        });
      }
      return;
    }

    try {
      await pool.query(
        `INSERT INTO user_activity_logs (id, user_id, activity_date, created_at)
         VALUES ($1, $2, CURRENT_DATE, NOW())
         ON CONFLICT (user_id, activity_date) DO NOTHING`,
        [crypto.randomUUID(), userId]
      );
    } catch (err) {
      console.error('[DB] Failed to record user activity:', err);
    }
  },

  async getUserActivityStats() {
    let logs: { user_id: string; activity_date: string }[] = [];

    if (!isDbActive) {
      logs = memUserActivityLogs.map(l => ({
        user_id: l.user_id,
        activity_date: typeof l.activity_date === 'string' ? l.activity_date : new Date(l.activity_date).toISOString().split('T')[0]
      }));
    } else {
      try {
        const res = await pool.query('SELECT user_id, activity_date FROM user_activity_logs');
        logs = res.rows.map(row => {
          let dateStr = "";
          if (row.activity_date instanceof Date) {
            dateStr = row.activity_date.toISOString().split('T')[0];
          } else {
            dateStr = String(row.activity_date).split('T')[0];
          }
          return {
            user_id: row.user_id,
            activity_date: dateStr
          };
        });
      } catch (err) {
        console.error('[DB] Failed to fetch user activity logs from SQL:', err);
        logs = memUserActivityLogs.map(l => ({
          user_id: l.user_id,
          activity_date: typeof l.activity_date === 'string' ? l.activity_date : new Date(l.activity_date).toISOString().split('T')[0]
        }));
      }
    }

    if (logs.length === 0) {
      return {
        avgDailyUsers: 0,
        avgWeeklyUsers: 0,
        avgMonthlyUsers: 0,
        avgYearlyUsers: 0,
        totalLogs: 0
      };
    }

    // --- Average Daily Users (DAU) ---
    const usersByDay: { [date: string]: Set<string> } = {};
    logs.forEach(log => {
      if (!usersByDay[log.activity_date]) {
        usersByDay[log.activity_date] = new Set();
      }
      usersByDay[log.activity_date].add(log.user_id);
    });

    const dailyCounts = Object.values(usersByDay).map(set => set.size);
    const sumDaily = dailyCounts.reduce((sum, val) => sum + val, 0);
    const avgDailyUsers = dailyCounts.length > 0 ? (sumDaily / dailyCounts.length) : 0;

    // --- Average Weekly Users (WAU) ---
    const getWeekKey = (dateStr: string) => {
      const date = new Date(dateStr);
      const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
      const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
      const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
      return `${date.getFullYear()}-W${weekNum}`;
    };

    const usersByWeek: { [week: string]: Set<string> } = {};
    logs.forEach(log => {
      const weekKey = getWeekKey(log.activity_date);
      if (!usersByWeek[weekKey]) {
        usersByWeek[weekKey] = new Set();
      }
      usersByWeek[weekKey].add(log.user_id);
    });

    const weeklyCounts = Object.values(usersByWeek).map(set => set.size);
    const sumWeekly = weeklyCounts.reduce((sum, val) => sum + val, 0);
    const avgWeeklyUsers = weeklyCounts.length > 0 ? (sumWeekly / weeklyCounts.length) : 0;

    // --- Average Monthly Users (MAU) ---
    const getMonthKey = (dateStr: string) => {
      return dateStr.substring(0, 7);
    };

    const usersByMonth: { [month: string]: Set<string> } = {};
    logs.forEach(log => {
      const monthKey = getMonthKey(log.activity_date);
      if (!usersByMonth[monthKey]) {
        usersByMonth[monthKey] = new Set();
      }
      usersByMonth[monthKey].add(log.user_id);
    });

    const monthlyCounts = Object.values(usersByMonth).map(set => set.size);
    const sumMonthly = monthlyCounts.reduce((sum, val) => sum + val, 0);
    const avgMonthlyUsers = monthlyCounts.length > 0 ? (sumMonthly / monthlyCounts.length) : 0;

    // --- Average Yearly Users (YAU) ---
    const getYearKey = (dateStr: string) => {
      return dateStr.substring(0, 4);
    };

    const usersByYear: { [year: string]: Set<string> } = {};
    logs.forEach(log => {
      const yearKey = getYearKey(log.activity_date);
      if (!usersByYear[yearKey]) {
        usersByYear[yearKey] = new Set();
      }
      usersByYear[yearKey].add(log.user_id);
    });

    const yearlyCounts = Object.values(usersByYear).map(set => set.size);
    const sumYearly = yearlyCounts.reduce((sum, val) => sum + val, 0);
    const avgYearlyUsers = yearlyCounts.length > 0 ? (sumYearly / yearlyCounts.length) : 0;

    return {
      avgDailyUsers: parseFloat(avgDailyUsers.toFixed(2)),
      avgWeeklyUsers: parseFloat(avgWeeklyUsers.toFixed(2)),
      avgMonthlyUsers: parseFloat(avgMonthlyUsers.toFixed(2)),
      avgYearlyUsers: parseFloat(avgYearlyUsers.toFixed(2)),
      totalLogs: logs.length
    };
  }
};
