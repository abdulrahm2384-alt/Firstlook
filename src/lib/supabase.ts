import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

const isPlaceholder = !supabaseUrl || supabaseUrl.includes('placeholder');

if (isPlaceholder) {
  console.warn('Supabase credentials missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Settings menu.');
}

export const isSupabasePlaceholder = isPlaceholder;

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-please-set-your-url.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
