import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { 
  LogIn, 
  Mail, 
  Lock, 
  Loader2, 
  User, 
  AtSign, 
  Globe, 
  FileText, 
  X, 
  ArrowRight,
  ShieldCheck,
  Send,
  Timer,
  TrendingUp,
  History,
  BookOpen,
  Beaker,
  Layers,
  BarChart3,
  ChevronDown
} from 'lucide-react';
import { COUNTRIES } from '../constants/countries';
import { clearAllLocalChartCaches } from '../services/chartCacheService';

const FAQS_DATA = [
  {
    q: "What is FirstLook?",
    a: "An integrated charting, replay, journaling, and analytics sandbox to backtest strategies without financial risk."
  },
  {
    q: "Is FirstLook suitable for beginners?",
    a: "Yes, it provides a safe, real-data environment for beginners to build chart execution routines and psychological discipline."
  },
  {
    q: "Can I test trading strategies?",
    a: "Yes, you can step charts forward bar-by-bar, log setups, and review automatically generated metrics like win rates."
  },
  {
    q: "Does FirstLook include trade journaling?",
    a: "Yes, log custom confluences, sizes, and mental notes directly on the sidebar chart mapped next to your setups."
  },
  {
    q: "What markets can be analyzed?",
    a: "FirstLook supports cross-market technical analysis of major forex pairs, global indices, commodities, and leading crypto assets."
  },
  {
    q: "Can I use FirstLook on mobile devices?",
    a: "Yes, we supply custom resizable interface views developed specifically for mobile touch devices both in portrait and landscape."
  },
  {
    q: "How does performance tracking work?",
    a: "The analytics dashboard calculates your metrics, drawdowns, equity growth curves, and weekday performance heatmaps."
  },
  {
    q: "Is my data securely stored?",
    a: "Yes, your setups, watchlists, and journals are hosted securely and remain completely private to your profile."
  }
];

export function LoginPage() {
  const [stage, setStage] = useState<'home' | 'login' | 'signup'>('home');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('United States');
  const [bio, setBio] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('Intermediate');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);

  // Stepping controls for Login & Sign up
  const [loginStep, setLoginStep] = useState<'email' | 'passcode'>('email');

  const sortedCountries = useMemo(() => {
    const others = COUNTRIES.filter(c => c.name === 'Other');
    const rest = COUNTRIES.filter(c => c.name !== 'Other');
    const sortedRest = [...rest].sort((a, b) => a.name.localeCompare(b.name));
    return [...sortedRest, ...others];
  }, []);

  // Login - Step 1: Check if registered email exists on FirstLook
  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const res = await response.json();
      if (!response.ok || res.error) {
        throw new Error(res.error?.message || 'Access identification failed. This email is not registered on FirstLook.');
      }

      setLoginStep('passcode');
    } catch (err: any) {
      console.error('Email check error:', err);
      setError(err.message || 'Verification of system handle failed');
    } finally {
      setLoading(false);
    }
  };

  // Login - Step 2: Sign-in process
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Clear legacy storage and chart cache first to prevent any old user's data bleed
      localStorage.removeItem('symbolViewStates');
      try {
        await clearAllLocalChartCaches();
      } catch (cacheErr) {
        console.error('Failed to clear old chart cache:', cacheErr);
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        throw signInError;
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Authentication failed. Incorrect passcode provided.');
    } finally {
      setLoading(false);
    }
  };

  // Signup: Direct profile registration
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/auth/register-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          username,
          fullName,
          country,
          bio,
          experienceLevel
        })
      });

      const res = await response.json();
      if (!response.ok || res.error) {
        throw new Error(res.error?.message || 'Failed to initialize system registration');
      }

      setSuccessMessage('System profile created successfully! Redirecting you to the security clearance login...');
      
      // Delay to show success notification and redirect to Login
      setTimeout(() => {
        setStage('login');
        setLoginStep('email');
        setError(null);
        setSuccessMessage(null);
      }, 2500);

    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to initialize profile. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative w-full ${stage === 'home' ? 'min-h-screen overflow-y-auto' : 'h-screen overflow-hidden'} flex flex-col text-white bg-black font-sans select-none`}>
      
      {/* BACKGROUND IMAGE CONTAINER */}
      <div className={`${stage === 'home' ? 'fixed' : 'absolute'} inset-0 z-0`}>
        <img 
          src="/peeking_moon_bg.png" 
          alt="Peeking Silhouette Under Moon" 
          className="w-full h-full object-cover opacity-80"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/85 z-1" />
      </div>

      {/* PLOT HEADER AREA */}
      <header className="relative z-10 w-full h-16 bg-black flex items-center justify-between pl-6 pr-3 border-b border-white/5 shadow-lg select-none">
        <div 
          onClick={() => {
            setStage('home');
            setLoginStep('email');
            setError(null);
            setSuccessMessage(null);
          }}
          className="flex items-center gap-2 cursor-pointer active:scale-95 transition-transform"
          title="FirstLook Home"
        >
          <img 
            src="/logo.svg" 
            alt="FirstLook Logo" 
            className="w-7 h-7 rounded-lg object-contain bg-slate-950 p-0.5 border border-white/10" 
          />
        </div>

        <div className="flex items-center gap-2 text-[10.5px] font-black tracking-[0.16em] uppercase font-mono">
          <button 
            onClick={() => {
              setStage('login');
              setLoginStep('email');
              setError(null);
              setSuccessMessage(null);
            }}
            className={`transition-colors duration-200 px-2.5 py-1.5 rounded-md border border-transparent ${
              stage === 'login' ? 'text-indigo-400 bg-white/5 border-white/10' : 'text-slate-300 hover:text-white'
            }`}
          >
            Login
          </button>
          
          <button 
            onClick={() => {
              setStage('signup');
              setError(null);
              setSuccessMessage(null);
            }}
            className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 font-extrabold transition-all text-white shadow-md active:scale-95 border border-indigo-500/30"
          >
            Sign Up
          </button>
        </div>
      </header>

      {/* MAIN SCREEN AREA */}
      <main className={`relative z-10 flex-1 w-full max-w-7xl mx-auto px-0 sm:px-4 md:px-8 select-none flex flex-col ${
        stage === 'home' ? 'pt-6 pb-24' : 'pt-20 md:pt-16 pb-12 justify-center'
      }`}>
        <AnimatePresence mode="wait">
          {stage === 'home' && (
            <div className="w-full flex flex-col" key="home_screen">
              {/* HERO CONTAINER */}
              <div className="min-h-[70vh] md:min-h-[75vh] flex flex-col items-center justify-center text-center py-12 px-4 sm:px-0">
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.6 }}
                  className="flex flex-col items-center"
                >
                  <h1 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight leading-tight uppercase font-mono text-white mb-4">
                    Verify the Depth <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-100 via-indigo-400 to-gray-350">
                      Before You Take the Leap
                    </span>
                  </h1>

                  <p className="text-[11px] sm:text-xs md:text-base text-slate-400 font-medium leading-relaxed mb-10 max-w-lg tracking-wide">
                    Test your trading strategy and understand success before going live.
                  </p>

                  <div className="flex flex-col items-center gap-4">
                    <button
                      onClick={() => {
                        setStage('signup');
                        setError(null);
                        setSuccessMessage(null);
                      }}
                      className="group relative flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs uppercase tracking-[0.25em] transition-all active:scale-[0.98] shadow-lg hover:shadow-indigo-500/25 rounded-xl border border-indigo-400/25 cursor-pointer font-black"
                    >
                      Get Started
                      <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                    </button>
                    
                    <span className="text-[10px] font-mono tracking-[0.3em] font-black text-slate-500 uppercase">
                      $0 Free Forever
                    </span>
                  </div>
                </motion.div>
              </div>

              {/* SECTIONS WRAPPER */}
              <div className="space-y-4 sm:space-y-6 mt-6 max-w-5xl mx-auto w-full px-0 sm:px-4 md:px-0">
                
                {/* 1. PLATFORM OVERVIEW */}
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  className="bg-white text-slate-900 rounded-none sm:rounded-xl p-3.5 sm:p-5 md:p-6 shadow-sm sm:shadow-[0_15px_30px_rgba(0,0,0,0.25)] border-y border-x-0 sm:border border-slate-150 relative overflow-hidden text-left"
                >
                  <div className="border-b border-slate-100 pb-3">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-[8.5px] font-mono tracking-wider uppercase mb-1.5">
                      Platform Overview
                    </div>
                    <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight uppercase font-mono mb-2 leading-tight">
                      Professional Trading Analysis <br />
                      <span className="text-indigo-600">Without Guesswork</span>
                    </h2>
                    <div className="text-slate-600 text-[10px] sm:text-[10.5px] leading-relaxed font-normal">
                      <p>
                        FirstLook is a professional trading workspace to test and optimize strategies. We isolate execution habits and track performance metrics using historical data, helping you build genuine consistency before risking real capital.
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* 2. CORE FEATURES */}
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  className="bg-white text-slate-900 rounded-none sm:rounded-xl p-3.5 sm:p-5 md:p-6 shadow-sm sm:shadow-[0_15px_30px_rgba(0,0,0,0.25)] border-y border-x-0 sm:border border-slate-150 relative overflow-hidden text-left"
                >
                  <div className="space-y-3">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-[8.5px] font-mono tracking-wider uppercase mb-1.5">
                        Core Features
                      </div>
                      <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight uppercase font-mono">
                        Engineered for Deep Analysis
                      </h2>
                      <p className="text-slate-500 text-[10px] sm:text-[10.5px] font-medium mt-1 max-w-xl">
                        A robust, integrated suite of technical utilities delivering precise analytical feedback.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {/* Feature 1 */}
                      <div className="bg-slate-50 hover:bg-slate-100/85 transition-all rounded-lg p-3 sm:p-3.5 border border-slate-200/50 flex flex-col justify-between space-y-2 shadow-sm group">
                        <div>
                          <div className="w-7 h-7 rounded bg-indigo-600 text-white flex items-center justify-center mb-2 shadow shadow-indigo-650/10 group-hover:scale-105 transition-transform">
                            <TrendingUp size={14} />
                          </div>
                          <h3 className="font-mono text-[10px] font-bold text-slate-900 uppercase tracking-tight mb-0.5">
                            High-Fidelity Charts
                          </h3>
                          <p className="text-[10px] sm:text-[10.5px] text-slate-505 leading-relaxed font-normal">
                            Interactive charts with multiple timeframe layouts, custom drawings, specialized indicators, and smooth rendering.
                          </p>
                        </div>
                      </div>

                      {/* Feature 2 */}
                      <div className="bg-slate-50 hover:bg-slate-100/85 transition-all rounded-lg p-3 sm:p-3.5 border border-slate-200/50 flex flex-col justify-between space-y-2 shadow-sm group">
                        <div>
                          <div className="w-7 h-7 rounded bg-indigo-600 text-white flex items-center justify-center mb-2 shadow shadow-indigo-650/10 group-hover:scale-105 transition-transform">
                            <History size={14} />
                          </div>
                          <h3 className="font-mono text-[10px] font-bold text-slate-900 uppercase tracking-tight mb-0.5">
                            Market Replay Mode
                          </h3>
                          <p className="text-[10px] sm:text-[10.5px] text-slate-505 leading-relaxed font-normal">
                            Rewind price action to simulate live environments bar-by-bar. Refine trigger timing, pattern recognition, and execution speed without financial exposure.
                          </p>
                        </div>
                      </div>

                      {/* Feature 3 */}
                      <div className="bg-slate-50 hover:bg-slate-100/85 transition-all rounded-lg p-3 sm:p-3.5 border border-slate-200/50 flex flex-col justify-between space-y-2 shadow-sm group">
                        <div>
                          <div className="w-7 h-7 rounded bg-indigo-600 text-white flex items-center justify-center mb-2 shadow shadow-indigo-650/10 group-hover:scale-105 transition-transform">
                            <BookOpen size={14} />
                          </div>
                          <h3 className="font-mono text-[10px] font-bold text-slate-900 uppercase tracking-tight mb-0.5">
                            Intuitive Journaling
                          </h3>
                          <p className="text-[10px] sm:text-[10.5px] text-slate-505 leading-relaxed font-normal">
                            Log simulated setups, confluences, position sizing, and emotional ratings directly mapped inline with physical candle bars.
                          </p>
                        </div>
                      </div>

                      {/* Feature 4 */}
                      <div className="bg-slate-50 hover:bg-slate-100/85 transition-all rounded-lg p-3 sm:p-3.5 border border-slate-200/50 flex flex-col justify-between space-y-2 shadow-sm group">
                        <div>
                          <div className="w-7 h-7 rounded bg-indigo-600 text-white flex items-center justify-center mb-2 shadow shadow-indigo-650/10 group-hover:scale-105 transition-transform">
                            <Beaker size={14} />
                          </div>
                          <h3 className="font-mono text-[10px] font-bold text-slate-900 uppercase tracking-tight mb-0.5">
                            Strategy Testing
                          </h3>
                          <p className="text-[10px] sm:text-[10.5px] text-slate-505 leading-relaxed font-normal">
                            Test customized trading rules across deep historical datasets to gauge expectancy and establish reliable win ratios.
                          </p>
                        </div>
                      </div>

                      {/* Feature 5 */}
                      <div className="bg-slate-50 hover:bg-slate-100/85 transition-all rounded-lg p-3 sm:p-3.5 border border-slate-200/50 flex flex-col justify-between space-y-2 shadow-sm group">
                        <div>
                          <div className="w-7 h-7 rounded bg-indigo-600 text-white flex items-center justify-center mb-2 shadow shadow-indigo-650/10 group-hover:scale-105 transition-transform">
                            <Layers size={14} />
                          </div>
                          <h3 className="font-mono text-[10px] font-bold text-slate-900 uppercase tracking-tight mb-0.5">
                            Custom Watchlists
                          </h3>
                          <p className="text-[10px] sm:text-[10.5px] text-slate-505 leading-relaxed font-normal">
                            Structure and cycle watchlists seamlessly. Drawing directories, templates, and key coordinate markers synchronize instantly as you switch assets.
                          </p>
                        </div>
                      </div>

                      {/* Feature 6 */}
                      <div className="bg-slate-50 hover:bg-slate-100/85 transition-all rounded-lg p-3 sm:p-3.5 border border-slate-200/50 flex flex-col justify-between space-y-2 shadow-sm group">
                        <div>
                          <div className="w-7 h-7 rounded bg-indigo-600 text-white flex items-center justify-center mb-2 shadow shadow-indigo-655/10 group-hover:scale-105 transition-transform">
                            <BarChart3 size={14} />
                          </div>
                          <h3 className="font-mono text-[10px] font-bold text-slate-900 uppercase tracking-tight mb-0.5">
                            Detailed Analytics
                          </h3>
                          <p className="text-[10px] sm:text-[10.5px] text-slate-550 leading-relaxed font-normal">
                            Analyze detailed metrics including drawdowns, profit factors, equity curves, strike rates, and weekday performance trends.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* 3. WHY TRADERS USE FIRSTLOOK */}
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  className="bg-white text-slate-900 rounded-none sm:rounded-xl p-3.5 sm:p-5 md:p-6 shadow-sm sm:shadow-[0_15px_30px_rgba(0,0,0,0.25)] border-y border-x-0 sm:border border-slate-150 relative overflow-hidden text-left"
                >
                  <div className="pb-1.5">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-[8.5px] font-mono tracking-wider uppercase mb-1.5">
                      Why FirstLook
                    </div>
                    <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight uppercase font-mono mb-2">
                      Deliberate Practice over Pure Speculation
                    </h2>
                    <div className="text-slate-600 text-[10px] sm:text-[10.5px] leading-relaxed font-normal max-w-4xl">
                      <p>
                        Professional consistency is born from structured self-correction. Successful traders use FirstLook to practice routine execution under realistic backtesting, helping to isolate critical emotional errors (like overtrading and poor risk habits) and secure a reliable mathematical edge.
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* 4. HOW THE PLATFORM WORKS */}
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  className="bg-white text-slate-900 rounded-none sm:rounded-xl p-3.5 sm:p-5 md:p-6 shadow-sm sm:shadow-[0_15px_30px_rgba(0,0,0,0.25)] border-y border-x-0 sm:border border-slate-150 relative overflow-hidden text-left"
                >
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-[8.5px] font-mono tracking-wider uppercase mb-1.5">
                      How It Works
                    </div>
                    <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight uppercase font-mono mb-3">
                      Four Steps to Consistency
                    </h2>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 relative">
                      {/* Step 1 */}
                      <div className="space-y-1 relative group text-left">
                        <div className="text-2xl font-mono font-black text-indigo-100 group-hover:text-indigo-200 transition-colors">01</div>
                        <h3 className="font-mono text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-0.5">
                          Analyze Charts
                        </h3>
                        <p className="text-[10px] sm:text-[10.5px] text-slate-500 leading-relaxed font-normal">
                          Load watchlist symbols and chart structural key levels using drawing markers, technical metrics, and custom layouts.
                        </p>
                      </div>

                      {/* Step 2 */}
                      <div className="space-y-1 relative group text-left">
                        <div className="text-2xl font-mono font-black text-indigo-100 group-hover:text-indigo-200 transition-colors">02</div>
                        <h3 className="font-mono text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-0.5">
                          Replay & Test
                        </h3>
                        <p className="text-[10px] sm:text-[10.5px] text-slate-500 leading-relaxed font-normal">
                          Initiate Market Replay Mode. Step price actions forward bar-by-bar to test critical entry confluences under blind conditions.
                        </p>
                      </div>

                      {/* Step 3 */}
                      <div className="space-y-1 relative group text-left">
                        <div className="text-2xl font-mono font-black text-indigo-100 group-hover:text-indigo-200 transition-colors">03</div>
                        <h3 className="font-mono text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-0.5">
                          Log Execution
                        </h3>
                        <p className="text-[10px] sm:text-[10.5px] text-slate-500 leading-relaxed font-normal">
                          Log details including risk-to-reward ratios, setups, confluences, and subjective psychological ratings side-by-side with your canvas.
                        </p>
                      </div>

                      {/* Step 4 */}
                      <div className="space-y-1 relative group text-left">
                        <div className="text-2xl font-mono font-black text-indigo-100 group-hover:text-indigo-200 transition-colors">04</div>
                        <h3 className="font-mono text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-0.5">
                          Study Metrics
                        </h3>
                        <p className="text-[10px] sm:text-[10.5px] text-slate-500 leading-relaxed font-normal">
                          Instantly review metrics including strike rates, curves, and drawdowns to mathematically evaluate your rules-based trading.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* 5. FREQUENTLY ASKED QUESTIONS */}
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  className="bg-white text-slate-900 rounded-none sm:rounded-xl p-3.5 sm:p-5 md:p-6 shadow-sm sm:shadow-[0_15px_30px_rgba(0,0,0,0.25)] border-y border-x-0 sm:border border-slate-150 relative overflow-hidden text-left"
                >
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-[8.5px] font-mono tracking-wider uppercase mb-1.5">
                      Frequently Asked Questions
                    </div>
                    <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight uppercase font-mono mb-2.5">
                      General Inquiries
                    </h2>
                    
                    <div className="space-y-1.5">
                      {FAQS_DATA.map((faq, idx) => {
                        const isOpen = openFaqId === idx;
                        return (
                          <div key={idx} className="border border-slate-200/50 rounded-lg bg-slate-50 overflow-hidden transition-all duration-300">
                            <button
                               onClick={() => setOpenFaqId(isOpen ? null : idx)}
                               className="w-full text-left px-3 py-2 flex justify-between items-center text-slate-900 hover:text-indigo-650 transition-colors font-mono font-bold text-[10px] uppercase cursor-pointer animate-none bg-transparent"
                            >
                              <span className="pr-4">{faq.q}</span>
                              <ChevronDown size={11} className={`text-slate-400 font-black shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} />
                            </button>
                            
                            <AnimatePresence initial={false}>
                              {isOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <div className="px-3 pb-2.5 pt-0.5 text-[10px] sm:text-[10.5px] text-slate-500 leading-relaxed border-t border-slate-200/30 font-normal">
                                    {faq.a}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>

                {/* 6. ABOUT FIRSTLOOK */}
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  className="bg-white text-slate-900 rounded-none sm:rounded-xl p-3.5 sm:p-5 md:p-6 shadow-sm sm:shadow-[0_15px_30px_rgba(0,0,0,0.25)] border-y border-x-0 sm:border border-slate-150 relative overflow-hidden text-left"
                >
                  <div className="pb-1.5">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-[8.5px] font-mono tracking-wider uppercase mb-1.5">
                      About Us
                    </div>
                    <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight uppercase font-mono mb-2">
                      Deliberate Practice for Deliberate Results
                    </h2>
                    <div className="text-slate-600 text-[10px] sm:text-[10.5px] leading-relaxed font-normal">
                      <p>
                        FirstLook provides independent traders with institutional-grade strategy backtesting, journaling, and metrics diagnostics. Our mission is to strip guesswork from executions and guide traders toward deliberate, statistical discipline.
                      </p>
                    </div>
                  </div>
                </motion.div>

              </div>

              {/* 7. TRUST & INFORMATION FOOTER */}
              <footer className="mt-16 pt-10 border-t border-white/10 text-slate-400 w-full px-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10 text-left max-w-5xl mx-auto w-full">
                  <div className="space-y-3 md:col-span-2">
                    <div className="flex items-center gap-2">
                      <img 
                        src="/logo.svg" 
                        alt="FirstLook Logo" 
                        className="w-5 h-5 rounded-md object-contain bg-slate-950 p-0.5 border border-white/10" 
                      />
                      <span className="font-mono text-[11px] font-black uppercase tracking-wider text-white">FirstLook</span>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-relaxed max-w-sm">
                      FirstLook supplies historical simulation engines, deep trade journaling records, and quantitative analytics to develop edge in financial markets.
                    </p>
                  </div>

                  <div className="space-y-2 font-mono">
                    <h4 className="text-[9px] uppercase font-black tracking-widest text-white">Sitemap</h4>
                    <div className="flex flex-col space-y-1.5 text-[10px] uppercase tracking-wider text-slate-400">
                      <button onClick={() => { setStage('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-indigo-400 transition-colors text-left cursor-pointer font-bold">Landing Overview</button>
                      <button onClick={() => { setStage('login'); setLoginStep('email'); }} className="hover:text-indigo-400 transition-colors text-left cursor-pointer font-bold">Login Entrance</button>
                      <button onClick={() => { setStage('signup'); }} className="hover:text-indigo-400 transition-colors text-left cursor-pointer font-bold">Request Access Handle</button>
                    </div>
                  </div>

                  <div className="space-y-2 font-mono">
                    <h4 className="text-[9px] uppercase font-black tracking-widest text-white">Support & Legal</h4>
                    <div className="flex flex-col space-y-1.5 text-[10px] uppercase tracking-wider text-slate-400">
                      <span className="hover:text-indigo-400 transition-colors cursor-pointer font-bold" onClick={() => alert("FirstLook Support Node can be requested via credentials support@firstlook.trading")}>Technical Support</span>
                      <span className="hover:text-indigo-400 transition-colors cursor-pointer font-bold" onClick={() => alert("Privacy Policies active under FirstLook Cloud Server parameters.")}>Privacy Policy</span>
                      <span className="hover:text-indigo-400 transition-colors cursor-pointer font-bold" onClick={() => alert("Terms of Service bound to deliberate practice software simulation.")}>Terms of Service</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/5 py-6 text-center space-y-3 max-w-5xl mx-auto w-full">
                  <p className="text-[9.5px] text-slate-600 max-w-3xl mx-auto leading-relaxed font-normal">
                    DISCLAIMER: FirstLook provides analysis, education, strategy testing, and performance reviews. All statistics represent historical simulation and research purposes only. Risk of loss is substantial.
                  </p>
                  <div className="text-[9.5px] tracking-widest font-mono text-slate-500 uppercase font-bold">
                    © {new Date().getFullYear()} FIRSTLOOK. ALL SERVICES RESERVED.
                  </div>
                </div>
              </footer>

            </div>
          )}

          {stage !== 'home' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center w-full" key="auth_screen">
              
              {/* DESKTOP LEFT PANE */}
              <div className="hidden md:flex md:col-span-6 lg:col-span-7 flex-col items-start text-left pr-4">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                  className="max-w-md"
                >
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-600/10 border border-indigo-505 bg-indigo-950/40 text-indigo-400 text-[10px] font-mono tracking-widest uppercase mb-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-450 animate-pulse" />
                    FirstLook Alpha Gate
                  </div>

                  <h1 className="text-3xl lg:text-4xl font-black tracking-tight leading-tight uppercase font-mono text-white mb-4">
                    Verify the Depth <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-100 via-indigo-400 to-gray-350">
                      Before You Take the Leap
                    </span>
                  </h1>

                  <p className="text-xs lg:text-sm text-slate-400 font-medium leading-relaxed mb-8 max-w-sm tracking-wide">
                    Test your trading strategy and understand success before going live.
                  </p>

                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-mono tracking-[0.25em] font-black text-slate-500 uppercase bg-slate-900/50 px-3 py-1.5 rounded border border-white/5">
                      $0 Free Forever
                    </span>
                  </div>
                </motion.div>
              </div>

              {/* FORM PANE */}
              <div className="col-span-1 md:col-span-6 lg:col-span-5 flex justify-center md:justify-end">
                <AnimatePresence mode="wait">
                  {stage === 'login' ? (
                    <motion.div
                      key="login_panel"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      className="w-full max-w-md bg-white border border-slate-100 rounded-2xl p-6 md:p-8 shadow-2xl relative text-left"
                    >
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider font-mono">
                            System Ingress
                          </h2>
                          <p className="text-[9px] font-mono text-slate-500 tracking-widest uppercase mt-0.5">
                            {loginStep === 'email' ? 'VERIFY VALID ADDRESS' : 'PROVIDE SECURE PASSKEY'}
                          </p>
                        </div>
                        <button 
                          onClick={() => {
                            setStage('home');
                            setLoginStep('email');
                            setError(null);
                            setSuccessMessage(null);
                          }}
                          className="text-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
                          title="Close and return to home"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <AnimatePresence mode="wait">
                        {loginStep === 'email' ? (
                          <motion.form 
                            key="login_step_email"
                            initial={{ opacity: 0, x: -15 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 15 }}
                            transition={{ duration: 0.25 }}
                            onSubmit={handleCheckEmail} 
                            className="space-y-4"
                          >
                            <div className="bg-slate-50 border border-slate-200 focus-within:border-indigo-600 focus-within:ring-1 focus-within:ring-indigo-600 transition-all p-3 rounded-xl">
                              <div className="flex justify-between items-center mb-1 text-[8px] font-mono font-bold tracking-wider text-slate-500">
                                <span>SYS.LOGIN / IDENTITY</span>
                                <span>REQ // EMAIL</span>
                              </div>
                              <div className="flex items-center">
                                <Mail className="text-indigo-600 mr-2.5" size={13} />
                                <input
                                  type="email"
                                  placeholder="ENTER REGISTERED EMAIL"
                                  required
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                  className="w-full bg-transparent text-slate-900 text-xs font-mono tracking-wider focus:outline-none placeholder:text-slate-400 py-0.5 uppercase"
                                />
                              </div>
                            </div>

                            {error && (
                              <div className="text-red-700 text-[9px] font-mono leading-relaxed tracking-wider px-2 py-2 bg-red-50 border border-red-200 rounded text-center uppercase">
                                [ACCESS DENIED] {error}
                              </div>
                            )}

                            <button
                              type="submit"
                              disabled={loading}
                              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[9.5px] uppercase tracking-[0.25em] transition-all active:scale-[0.98] disabled:opacity-50 shadow-md rounded-xl font-bold cursor-pointer"
                            >
                              {loading ? (
                                <Loader2 className="animate-spin" size={13} />
                              ) : (
                                'IDENTIFY EMAIL ADDRESS'
                              )}
                            </button>
                          </motion.form>
                        ) : (
                          <motion.form 
                            key="login_step_passcode"
                            initial={{ opacity: 0, x: 15 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -15 }}
                            transition={{ duration: 0.25 }}
                            onSubmit={handleLoginSubmit} 
                            className="space-y-4 relative"
                          >
                            {/* COMPACT VERIFIED EMAIL badge */}
                            <div className="flex items-center justify-between text-[9px] font-mono px-3 py-1.5 bg-indigo-55 border border-indigo-100 rounded-lg text-indigo-700 mb-2">
                              <span className="flex items-center gap-1.5 font-bold truncate">
                                <ShieldCheck size={11} className="text-indigo-650" />
                                {email.toUpperCase()}
                              </span>
                              <button
                                type="button"
                                onClick={() => setLoginStep('email')}
                                className="text-slate-500 hover:text-indigo-650 font-extrabold underline cursor-pointer select-none"
                              >
                                EDIT
                              </button>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 focus-within:border-indigo-600 focus-within:ring-1 focus-within:ring-indigo-600 transition-all p-3 rounded-xl">
                              <div className="flex justify-between items-center mb-1 text-[8px] font-mono font-bold tracking-wider text-slate-500">
                                <span>SYS.KEY / PASSCODE</span>
                                <span>SECKEY // 0x***</span>
                              </div>
                              <div className="flex items-center">
                                <Lock className="text-indigo-600 mr-2.5" size={13} />
                                <input
                                  type="password"
                                  placeholder="ENTER ACCESS PASSCODE"
                                  required
                                  autoFocus
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  className="w-full bg-transparent text-slate-900 text-xs font-mono tracking-wider focus:outline-none placeholder:text-slate-400 py-0.5 uppercase"
                                />
                              </div>
                            </div>

                            {error && (
                              <div className="text-red-700 text-[9px] font-mono leading-relaxed tracking-wider px-2 py-2 bg-red-50 border border-red-200 rounded text-center uppercase">
                                [CREDENTIAL DENIED] {error}
                              </div>
                            )}

                            <button
                              type="submit"
                              disabled={loading}
                              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[9.5px] uppercase tracking-[0.25em] transition-all disabled:opacity-50 shadow-md rounded-xl font-bold cursor-pointer"
                            >
                              {loading ? (
                                <Loader2 className="animate-spin" size={13} />
                              ) : (
                                'AUTHORIZE INGRESS'
                              )}
                            </button>

                            {/* FLOATING ACTION BUTTON - dynamically showing when password has input */}
                            <AnimatePresence>
                              {password.length > 0 && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.8, y: 15 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.8, y: 15 }}
                                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                  className="fixed bottom-6 right-6 md:absolute md:bottom-[-20px] md:right-[-20px] z-50 pointer-events-auto"
                                >
                                  <button
                                    type="submit"
                                    title="Submit terminal auth credentials"
                                    className="cursor-pointer relative flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 text-white rounded-full shadow-[0_12px_24px_rgba(99,102,241,0.5)] border border-indigo-400/20 font-mono text-[10px] uppercase font-black tracking-widest active:scale-95 hover:brightness-110 select-none animate-pulse"
                                  >
                                    <Send size={12} />
                                    <span>SUBMIT KEY</span>
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.form>
                        )}
                      </AnimatePresence>

                      <div className="text-center pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setStage('signup');
                            setError(null);
                            setSuccessMessage(null);
                          }}
                          className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest hover:text-indigo-600 transition-colors cursor-pointer"
                        >
                          Register new system handle
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="signup_panel"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      className="w-full max-w-lg bg-white border border-slate-100 rounded-2xl p-5 md:p-6 shadow-2xl relative text-left"
                    >
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider font-mono">
                            Initialize Access
                          </h2>
                          <p className="text-[9px] font-mono text-slate-500 tracking-widest uppercase mt-0.5">
                            CREATE YOUR TRADER PROFILE
                          </p>
                        </div>
                        <button 
                          onClick={() => {
                            setStage('home');
                            setError(null);
                            setSuccessMessage(null);
                          }}
                          className="text-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
                          title="Close and return to home"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <form 
                        onSubmit={handleSignupSubmit} 
                        className="space-y-3 max-h-[62vh] overflow-y-auto pr-0.5 scrollbar-thin"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Email Field */}
                          <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                            <div className="flex justify-between items-center mb-1 text-[8px] font-mono font-bold tracking-wider text-slate-500">
                              <span>SYS.LOGIN / EMAIL</span>
                              <span>REQ</span>
                            </div>
                            <div className="flex items-center">
                              <Mail className="text-indigo-600 mr-2" size={12} />
                              <input
                                type="email"
                                placeholder="ENTER EMAIL ADDRESS"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-transparent text-slate-900 text-[11px] font-mono tracking-wider focus:outline-none placeholder:text-slate-400 py-0.5 uppercase"
                              />
                            </div>
                          </div>

                          {/* Password Field */}
                          <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                            <div className="flex justify-between items-center mb-1 text-[8px] font-mono font-bold tracking-wider text-slate-500">
                              <span>SYS.KEY / PASSCODE</span>
                              <span>REQ</span>
                            </div>
                            <div className="flex items-center">
                              <Lock className="text-indigo-600 mr-2" size={12} />
                              <input
                                type="password"
                                placeholder="CREATE SECURE KEY"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-transparent text-slate-900 text-[11px] font-mono tracking-wider focus:outline-none placeholder:text-slate-400 py-0.5 uppercase"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Full Name */}
                          <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                            <div className="flex justify-between items-center mb-1 text-[8px] font-mono font-bold tracking-wider text-slate-500">
                              <span>PROFILE / FULLNAME</span>
                              <span>REQ</span>
                            </div>
                            <div className="flex items-center">
                              <User className="text-indigo-600 mr-2" size={12} />
                              <input
                                type="text"
                                placeholder="ENTER FULL NAME"
                                required
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full bg-transparent text-slate-900 text-[11px] font-mono tracking-wider focus:outline-none placeholder:text-slate-400 py-0.5 uppercase"
                              />
                            </div>
                          </div>

                          {/* Username Handle */}
                          <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                            <div className="flex justify-between items-center mb-1 text-[8px] font-mono font-bold tracking-wider text-slate-500">
                              <span>SYS.HANDLE / USERNAME</span>
                              <span>REQ</span>
                            </div>
                            <div className="flex items-center">
                              <AtSign className="text-indigo-600 mr-2" size={12} />
                              <input
                                type="text"
                                placeholder="CHOOSE A UNIQUE HANDLE"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-transparent text-slate-900 text-[11px] font-mono tracking-wider focus:outline-none placeholder:text-slate-400 py-0.5"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Country */}
                        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                          <div className="flex justify-between items-center mb-1 text-[8px] font-mono font-bold tracking-wider text-slate-500">
                            <span>GEOLOCATION / HOST</span>
                            <span>GEO // REQ</span>
                          </div>
                          <div className="flex items-center">
                            <Globe className="text-indigo-600 mr-2" size={12} />
                            <select
                              value={country}
                              onChange={(e) => setCountry(e.target.value)}
                              className="w-full bg-transparent text-slate-900 text-[11px] font-mono focus:outline-none py-0.5 uppercase cursor-pointer"
                            >
                              {sortedCountries.map((c) => (
                                <option key={c.code} value={c.name} className="bg-white text-slate-900">
                                  {c.flag} {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Experience level */}
                        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                          <div className="flex justify-between items-center mb-1.5 text-[8px] font-mono font-bold tracking-wider text-slate-500">
                            <span>SYS.RANK / EXPERIENCE LEVEL</span>
                            <span>CHOOSE RANK</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1">
                            {['Beginner', 'Intermediate', 'Advanced', 'Professional'].map((lvl) => (
                              <button
                                type="button"
                                key={lvl}
                                onClick={() => setExperienceLevel(lvl)}
                                className={`py-1 rounded text-[7.5px] font-mono tracking-wider border text-center transition-all cursor-pointer ${
                                  experienceLevel === lvl
                                    ? 'bg-indigo-600 text-white border-indigo-600 font-extrabold shadow-sm'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                                }`}
                              >
                                {lvl.toUpperCase()}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Bio */}
                        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                          <div className="flex justify-between items-center mb-1 text-[8px] font-mono font-bold tracking-wider text-slate-500">
                            <span>SYS.MOTTO / DESCRIPTION</span>
                            <span>OPT</span>
                          </div>
                          <div className="flex items-center">
                            <FileText className="text-indigo-600 mr-2" size={12} />
                            <input
                              type="text"
                              placeholder="E.G. DAY TRADER / ALGO SPECIALIST"
                              value={bio}
                              onChange={(e) => setBio(e.target.value)}
                              className="w-full bg-transparent text-slate-900 text-[11px] font-mono tracking-wider focus:outline-none placeholder:text-slate-400 py-0.5 uppercase"
                            />
                          </div>
                        </div>

                        <AnimatePresence mode="wait">
                          {error && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="text-red-700 text-[9px] font-mono leading-relaxed tracking-wider px-2 py-1.5 bg-red-50 border border-red-200 rounded text-center uppercase"
                            >
                              [ERROR] {error}
                            </motion.div>
                          )}
                          {successMessage && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="text-emerald-800 text-[9px] font-mono leading-relaxed tracking-wider px-2 py-1.5 bg-emerald-50 border border-emerald-200 rounded text-center uppercase"
                            >
                              [SUCCESS] {successMessage}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[9px] uppercase tracking-[0.25em] transition-all active:scale-[0.98] disabled:opacity-50 shadow-md rounded-xl font-bold cursor-pointer"
                        >
                          {loading ? (
                            <Loader2 className="animate-spin" size={12} />
                          ) : (
                            'INITIALIZE USER PROFILE'
                          )}
                        </button>
                      </form>

                      <div className="text-center pt-3 border-t border-slate-100 mt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setStage('login');
                            setLoginStep('email');
                            setError(null);
                            setSuccessMessage(null);
                          }}
                          className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest hover:text-indigo-600 transition-colors cursor-pointer"
                        >
                          Already have access? Sign In
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
