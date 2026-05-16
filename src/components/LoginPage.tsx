import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { LogIn, Mail, Lock, Loader2, Database } from 'lucide-react';

export function LoginPage({ onWarehouseClick }: { onWarehouseClick?: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
  const isMissingConfig = !supabaseUrl || supabaseUrl.includes('placeholder');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMissingConfig) {
      setError('Supabase keys missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Settings.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        
        const isEmailConfirmationRequired = data.user && !data.session;

        // If the sign up automatically logs the user in, we want to sign them out 
        // to follow the user's requested flow of "success -> login manual"
        if (data.session) {
          await supabase.auth.signOut();
        }

        if (isEmailConfirmationRequired) {
          setSuccessMessage('Account created. Please check your email and confirm your account before logging in.');
        } else {
          setSuccessMessage('Workspace initialized successfully. You can now log in.');
        }
        setIsSignUp(false);
        setPassword('');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          if (signInError.message.includes('Invalid login credentials')) {
            throw new Error('Authentication failed. Please verify your email and password. If you just signed up, ensure your account is confirmed.');
          }
          throw signInError;
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-dvh bg-white flex flex-col items-center justify-center p-6 text-slate-900 overflow-y-auto overflow-x-hidden">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-sm space-y-8 md:space-y-12 py-10"
      >
        <div className="text-center space-y-8">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-2xl shadow-black/10">
              <LogIn size={24} className="text-white" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tighter">FirstLook</h1>
          </div>
          
          <div className="space-y-3">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
              Look Before You Leap
            </h2>
            <p className="text-slate-400 text-[10px] uppercase font-black tracking-[0.2em]">
              {isSignUp ? 'Initialize your analysis' : 'Backtest and analyze your data'}
            </p>
          </div>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          <div className="space-y-3">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors" size={16} />
              <input
                type="email"
                placeholder="EMAIL ADDRESS"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 pl-12 pr-4 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-slate-200 transition-all placeholder:text-slate-300 focus:bg-white"
              />
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors" size={16} />
              <input
                type="password"
                placeholder="PASSWORD"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 pl-12 pr-4 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-slate-200 transition-all placeholder:text-slate-300 focus:bg-white"
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-red-500 text-[9px] font-black uppercase tracking-widest px-1 text-center"
              >
                {error}
              </motion.div>
            )}
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-emerald-500 text-[9px] font-black uppercase tracking-widest px-1 text-center bg-emerald-50/50 py-3 rounded-xl border border-emerald-100/50"
              >
                {successMessage}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50 shadow-2xl shadow-black/10"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              isSignUp ? 'Sign Up' : 'Sign In'
            )}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setSuccessMessage(null);
            }}
            className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>

        <div className="pt-8 text-center border-t border-slate-50 space-y-4">
          {isMissingConfig && (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-[9px] text-slate-500 font-bold leading-relaxed uppercase tracking-widest">
              ⚠️ <span className="font-black text-slate-900">Configuration Required:</span> Add VITE_SUPABASE keys in Settings &gt; Secrets
            </div>
          )}
          <p className="text-slate-200 text-[8px] uppercase font-black tracking-[0.3em] flex items-center justify-center gap-1.5">
            <Database 
              size={10} 
              className="opacity-50 cursor-pointer hover:opacity-100 transition-opacity" 
              onDoubleClick={(e) => {
                e.preventDefault();
                onWarehouseClick?.();
              }}
            />
            Precision Infrastructure &copy; 2026
          </p>
        </div>
      </motion.div>
    </div>
  );
}
