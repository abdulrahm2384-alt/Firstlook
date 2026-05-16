-- CLEAN SLATE SETUP: Run this in your Supabase SQL Editor to enable persistence
-- This will delete existing tables to ensure a clean state with correct schemas.

-- 1. Drop existing tables if they exist to avoid schema mismatches
DROP TABLE IF EXISTS public.user_sessions;
DROP TABLE IF EXISTS public.user_backtest_sessions;
DROP TABLE IF EXISTS public.user_trades;
DROP TABLE IF EXISTS public.user_watchlist;
DROP TABLE IF EXISTS public.user_preferences;
DROP TABLE IF EXISTS public.user_drawings;
DROP TABLE IF EXISTS public.setups;

-- 2. Create Table for Drawings
CREATE TABLE public.user_drawings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    drawings JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Table for Preferences (Theme, Indicators, etc.)
CREATE TABLE public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    settings JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Table for Watchlist
CREATE TABLE public.user_watchlist (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    items JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create Table for Trade Journal
CREATE TABLE public.user_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    type TEXT NOT NULL, -- 'LONG' | 'SHORT'
    entry_time BIGINT NOT NULL,
    exit_time BIGINT NOT NULL,
    entry_price DOUBLE PRECISION NOT NULL,
    exit_price DOUBLE PRECISION NOT NULL,
    rr DOUBLE PRECISION NOT NULL,
    status TEXT NOT NULL, -- 'TP' | 'SL'
    timeframe TEXT NOT NULL,
    duration TEXT NOT NULL,
    pips DOUBLE PRECISION,
    prefix TEXT,
    drawing_id TEXT, -- Added column
    realized_at TIMESTAMP WITH TIME ZONE, -- Added column
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create Table for Backtest Sessions
CREATE TABLE public.user_backtest_sessions (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    sessions JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Create Table for Device Sync / Active Session
CREATE TABLE public.user_sessions (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    active_session_id TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Create Table for Setups
CREATE TABLE public.setups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    grade TEXT NOT NULL, -- 'A+' | 'B' | 'C'
    image_url TEXT,
    confluences JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, grade)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_drawings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_backtest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setups ENABLE ROW LEVEL SECURITY;

-- Create Policies (Users can only see/edit their own data)
CREATE POLICY "Manage own drawings" ON public.user_drawings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage own preferences" ON public.user_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage own watchlist" ON public.user_watchlist FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage own trades" ON public.user_trades FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage own backtest sessions" ON public.user_backtest_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage own sessions" ON public.user_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage own setups" ON public.setups FOR ALL USING (auth.uid() = user_id);

-- Explicitly grant permissions to common roles if needed
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role, authenticated;
