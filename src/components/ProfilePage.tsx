import { motion } from 'motion/react';
import { 
  User, 
  ChevronLeft, 
  TrendingUp, 
  TrendingDown, 
  BarChart2, 
  Calendar,
  CheckCircle2,
  Clock,
  LogOut,
  Zap,
  Award,
  Activity,
  Flame,
  Lock,
  Trophy,
  Medal,
  Shield,
  Star,
  Crown,
  MapPin,
  AtSign,
  Globe,
  FileText,
  Check,
  Loader2,
  Edit,
  Mail,
  X
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { 
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { JournalTrade } from '../types';
import { supabase } from '../lib/supabase';
import { COUNTRIES } from '../constants/countries';

const BADGES_CONFIG = [
  {
    id: 'trade_10',
    title: 'Voyager I',
    subtitle: '10 Trades',
    description: 'Executed 10+ backtest setup trades',
    target: 10,
    type: 'trade',
    icon: Trophy,
    colorClass: 'text-amber-700 bg-amber-50/40 border-amber-200/85 hover:bg-amber-50/70',
    headerColor: 'bg-amber-600'
  },
  {
    id: 'trade_50',
    title: 'Tactician II',
    subtitle: '50 Trades',
    description: 'Executed 50+ backtest setup trades',
    target: 50,
    type: 'trade',
    icon: Medal,
    colorClass: 'text-slate-600 bg-slate-50/50 border-slate-200 hover:bg-slate-50/80',
    headerColor: 'bg-slate-500'
  },
  {
    id: 'trade_100',
    title: 'Executioner III',
    subtitle: '100 Trades',
    description: 'Executed 100+ backtest setup trades',
    target: 100,
    type: 'trade',
    icon: Award,
    colorClass: 'text-amber-600 bg-amber-50/30 border-yellow-300/80 hover:bg-amber-50/50',
    headerColor: 'bg-amber-500'
  },
  {
    id: 'trade_300',
    title: 'Strategist IV',
    subtitle: '300 Trades',
    description: 'Executed 300+ backtest setup trades',
    target: 300,
    type: 'trade',
    icon: Shield,
    colorClass: 'text-indigo-600 bg-indigo-50/40 border-indigo-200/80 hover:bg-indigo-50/75',
    headerColor: 'bg-indigo-600'
  },
  {
    id: 'trade_500',
    title: 'Sentinel V',
    subtitle: '500 Trades',
    description: 'Executed 500+ backtest setup trades',
    target: 500,
    type: 'trade',
    icon: Star,
    colorClass: 'text-cyan-600 bg-cyan-50/40 border-cyan-200/80 hover:bg-cyan-50/75',
    headerColor: 'bg-cyan-500'
  },
  {
    id: 'trade_1000',
    title: 'Oracle VI',
    subtitle: '1000 Trades',
    description: 'Executed 1000+ backtest setup trades',
    target: 1000,
    type: 'trade',
    icon: Crown,
    colorClass: 'text-violet-600 bg-violet-50/40 border-violet-200/80 hover:bg-violet-50/75',
    headerColor: 'bg-violet-600'
  },
  {
    id: 'streak_10',
    title: 'Dedication I',
    subtitle: '10 Day Streak',
    description: 'Maintained a 10-day active backtesting login streak',
    target: 10,
    type: 'streak',
    icon: Flame,
    colorClass: 'text-amber-600 bg-amber-50/40 border-amber-200/80 hover:bg-amber-50/70',
    headerColor: 'bg-amber-600'
  },
  {
    id: 'streak_50',
    title: 'Discipline II',
    subtitle: '50 Day Streak',
    description: 'Maintained a 50-day active backtesting login streak',
    target: 50,
    type: 'streak',
    icon: Flame,
    colorClass: 'text-orange-600 bg-orange-50/40 border-orange-200/80 hover:bg-orange-50/75',
    headerColor: 'bg-orange-500'
  },
  {
    id: 'streak_100',
    title: 'Consistency III',
    subtitle: '100 Day Streak',
    description: 'Maintained a 100-day active backtesting login streak',
    target: 100,
    type: 'streak',
    icon: Flame,
    colorClass: 'text-rose-600 bg-rose-50/40 border-rose-200 hover:bg-rose-50/75',
    headerColor: 'bg-rose-500'
  },
  {
    id: 'streak_365',
    title: 'Maturity IV',
    subtitle: '365 Day Streak',
    description: 'Maintained a 365-day active backtesting login streak',
    target: 365,
    type: 'streak',
    icon: Flame,
    colorClass: 'text-violet-600 bg-violet-50/40 border-violet-200/85 hover:bg-violet-50/70',
    headerColor: 'bg-violet-600'
  }
];

interface ProfilePageProps {
  user: any;
  trades: JournalTrade[];
  watchlist: any[];
  onBack: () => void;
  streakCount?: number;
  longestStreak?: number;
  subscriptionPlan?: 'basic' | 'plus' | 'premium';
  onNavigateToSubscription: () => void;
  onTriggerSimulationOfBadge?: (target: number) => void;
}

export function ProfilePage({ 
  user, 
  trades, 
  watchlist, 
  onBack, 
  streakCount = 0, 
  longestStreak = 0,
  subscriptionPlan = 'basic',
  onNavigateToSubscription,
  onTriggerSimulationOfBadge
}: ProfilePageProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [hasRated, setHasRated] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string>('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState<boolean>(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccessMsg, setFeedbackSuccessMsg] = useState<string>('');

  const handleSubmitFeedback = async () => {
    if (rating === 0) return;
    setIsSubmittingFeedback(true);
    setFeedbackError(null);
    try {
      const resp = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rate: rating,
          user_email: user?.email || 'guest@firstlook.com',
          feedback: feedback || ''
        })
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to submit rating');
      }
      setFeedbackSuccessMsg(data.message || 'Thank you so much! I have received your feedback.');
      setHasRated(true);
    } catch (err: any) {
      console.error('Feedback submit error:', err);
      setFeedbackError(err.message || 'Error occurred while submitting feedback');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // --- Profile Edits State ---
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editCountry, setEditCountry] = useState('United States');
  const [editBio, setEditBio] = useState('');
  const [editExperienceLevel, setEditExperienceLevel] = useState('Intermediate');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);

  const handleStartEdit = () => {
    setEditUsername(user?.username || '');
    setEditFullName(user?.full_name || '');
    setEditCountry(user?.country || 'United States');
    setEditBio(user?.bio || '');
    setEditExperienceLevel(user?.experience_level || 'Intermediate');
    setIsEditing(true);
    setEditError(null);
    setEditSuccess(false);
  };

  const handleSaveProfile = async () => {
    setEditLoading(true);
    setEditError(null);
    setEditSuccess(false);
    try {
      const { data, error } = await (supabase.auth as any).updateProfile({
        username: editUsername,
        full_name: editFullName,
        country: editCountry,
        bio: editBio,
        experience_level: editExperienceLevel,
      });

      if (error) throw error;
      setEditSuccess(true);
      setTimeout(() => {
        setIsEditing(false);
        setEditSuccess(false);
      }, 700);
    } catch (err: any) {
      console.error(err);
      setEditError(err.message || 'Failed to update profile');
    } finally {
      setEditLoading(false);
    }
  };

  // --- Analysis Logic ---
  const stats = useMemo(() => {
    const total = trades.length;
    const wins = trades.filter(t => t.status === 'TP').length;
    const losses = trades.filter(t => t.status === 'SL').length;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    const totalRR = trades.reduce((acc, t) => acc + t.rr, 0);
    
    // Symbol breakdown
    const symbolMap: Record<string, { total: number, wins: number, rr: number }> = {};
    trades.forEach(t => {
      if (!symbolMap[t.symbol]) {
        symbolMap[t.symbol] = { total: 0, wins: 0, rr: 0 };
      }
      symbolMap[t.symbol].total++;
      if (t.status === 'TP') symbolMap[t.symbol].wins++;
      symbolMap[t.symbol].rr += t.rr;
    });

    const symbolStats = Object.entries(symbolMap).map(([symbol, data]) => ({
      symbol,
      winRate: (data.wins / data.total) * 100,
      total: data.total,
      rr: data.rr
    })).sort((a, b) => b.rr - a.rr);

    return { total, wins, losses, winRate, totalRR, symbolStats };
  }, [trades]);

  // --- Growth Chart Data ---
  const growthData = useMemo(() => {
    const sortedTrades = [...trades]
      .filter(t => isFinite(t.exitTime) && t.exitTime > 0)
      .sort((a, b) => a.exitTime - b.exitTime);

    if (sortedTrades.length === 0) return [];

    let cumulativeRR = 0;
    const data = sortedTrades.map(t => {
      cumulativeRR += (isFinite(t.rr) ? t.rr : 0);
      return {
        time: t.exitTime,
        rr: parseFloat(cumulativeRR.toFixed(2)),
        date: new Date(t.exitTime * 1000).toLocaleDateString()
      };
    });

    // Add a starting point if we have data
    if (data.length > 0) {
      return [{ time: sortedTrades[0].entryTime || (sortedTrades[0].exitTime - 3600), rr: 0, date: 'Start' }, ...data];
    }
    return data;
  }, [trades]);

  // --- GitHub Activity Heatmap Logic ---
  const calendarData = useMemo(() => {
    const today = new Date();
    const days = [];
    const tradeCounts: Record<string, number> = {};

    trades.forEach(t => {
      const timestamp = t.realizedAt || t.createdAt;
      if (timestamp) {
        try {
          const dateKey = new Date(timestamp).toISOString().split('T')[0];
          tradeCounts[dateKey] = (tradeCounts[dateKey] || 0) + 1;
        } catch (e) {
          // ignore invalid dates
        }
      }
    });

    const totalWeeks = 53;
    // Find how many days to subtract to get to the Sunday of 52 weeks ago
    // 52 weeks ago is 52 * 7 = 364 days.
    const startOffset = (totalWeeks - 1) * 7 + today.getDay();
    const startDate = new Date();
    startDate.setDate(today.getDate() - startOffset);
    startDate.setHours(0, 0, 0, 0);

    const totalDaysNeeded = totalWeeks * 7; // 371 days
    for (let i = 0; i < totalDaysNeeded; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const key = d.toISOString().split('T')[0];
      days.push({
        date: key,
        count: tradeCounts[key] || 0,
        dayOfWeek: d.getDay(),
        month: d.getMonth(),
        dayOfMonth: d.getDate()
      });
    }

    return days;
  }, [trades]);

  const monthLabels = useMemo(() => {
    const labels: { text: string; colIndex: number }[] = [];
    let currentMonth = -1;
    
    for (let col = 0; col < 53; col++) {
      const firstDayOfWeek = calendarData[col * 7];
      if (firstDayOfWeek) {
        try {
          const d = new Date(firstDayOfWeek.date);
          const m = d.getMonth();
          if (m !== currentMonth) {
            currentMonth = m;
            labels.push({
              text: d.toLocaleString('default', { month: 'short' }),
              colIndex: col
            });
          }
        } catch (e) {
          // ignore
        }
      }
    }
    return labels;
  }, [calendarData]);

  const getIntensity = (count: number) => {
    if (count === 0) return 'bg-[#f4f4f5] border border-neutral-200/40 hover:bg-neutral-200';
    if (count === 1) return 'bg-neutral-300 hover:bg-neutral-400';
    if (count === 2) return 'bg-neutral-500 hover:bg-neutral-600';
    if (count === 3) return 'bg-neutral-700 hover:bg-neutral-800';
    return 'bg-black hover:bg-neutral-900';
  };

  // --- Badge & Milestones Calculations ---
  const badgeStats = useMemo(() => {
    // 1. Trade progress
    const tradeMilestones = [10, 50, 100, 300, 500, 1000];
    const nextTradeMilestoneIdx = tradeMilestones.findIndex(m => m > stats.total);
    let prevTradeMilestone = 0;
    let nextTradeMilestone = 10;
    let tradeProgressPercent = 0;
    let isMaxTradeMilestone = false;

    if (nextTradeMilestoneIdx === -1) {
      isMaxTradeMilestone = true;
      prevTradeMilestone = 1000;
      nextTradeMilestone = 1000;
      tradeProgressPercent = 100;
    } else {
      nextTradeMilestone = tradeMilestones[nextTradeMilestoneIdx];
      prevTradeMilestone = nextTradeMilestoneIdx === 0 ? 0 : tradeMilestones[nextTradeMilestoneIdx - 1];
      const range = nextTradeMilestone - prevTradeMilestone;
      const progressVal = stats.total - prevTradeMilestone;
      tradeProgressPercent = Math.min(100, Math.max(0, (progressVal / range) * 100));
    }

    // 2. Streak progress
    const streakMilestones = [10, 50, 100, 365];
    const maxStreak = Math.max(streakCount, longestStreak);
    const nextStreakMilestoneIdx = streakMilestones.findIndex(m => m > maxStreak);
    let prevStreakMilestone = 0;
    let nextStreakMilestone = 10;
    let streakProgressPercent = 0;
    let isMaxStreakMilestone = false;

    if (nextStreakMilestoneIdx === -1) {
      isMaxStreakMilestone = true;
      prevStreakMilestone = 365;
      nextStreakMilestone = 365;
      streakProgressPercent = 100;
    } else {
      nextStreakMilestone = streakMilestones[nextStreakMilestoneIdx];
      prevStreakMilestone = nextStreakMilestoneIdx === 0 ? 0 : streakMilestones[nextStreakMilestoneIdx - 1];
      const range = nextStreakMilestone - prevStreakMilestone;
      const progressVal = maxStreak - prevStreakMilestone;
      streakProgressPercent = Math.min(100, Math.max(0, (progressVal / range) * 100));
    }

    // Determine unlocked badges
    const badges = BADGES_CONFIG.map(config => {
      const isUnlocked = config.type === 'trade' 
        ? stats.total >= config.target 
        : maxStreak >= config.target;
      
      const progressLabel = config.type === 'trade'
        ? `${stats.total} / ${config.target}`
        : `${maxStreak} / ${config.target}`;

      return {
        ...config,
        isUnlocked,
        progressLabel
      };
    });

    const unlockedCount = badges.filter(b => b.isUnlocked).length;

    return {
      prevTradeMilestone,
      nextTradeMilestone,
      tradeProgressPercent,
      isMaxTradeMilestone,
      prevStreakMilestone,
      nextStreakMilestone,
      streakProgressPercent,
      isMaxStreakMilestone,
      badges,
      unlockedCount,
      maxStreak
    };
  }, [stats.total, streakCount, longestStreak]);

  const scrollRef = useMemo(() => {
    return (el: HTMLDivElement | null) => {
      if (el) {
        el.scrollLeft = el.scrollWidth;
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-neutral-55 relative overflow-hidden font-sans">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 px-6 py-4 flex items-center justify-between shrink-0 bg-white/95 backdrop-blur-md border-b border-neutral-200">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 group cursor-pointer"
          >
            <ChevronLeft size={18} className="text-black group-hover:translate-x-[-2px] transition-transform duration-200" />
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-black">Back to terminal</span>
          </button>
        </div>
        
        <button 
          onClick={() => supabase.auth.signOut()}
          className="flex items-center gap-2 text-neutral-500 hover:text-black transition-colors cursor-pointer"
        >
          <LogOut size={14} className="stroke-[2.5]" />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">Sign Out</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 md:px-8 py-6 space-y-6 pb-24">
        {/* User Statistics Overview & Equity Trend */}
        <div className="relative overflow-hidden p-6 bg-white border border-neutral-200 shadow-sm">
          <div className="relative flex flex-col lg:flex-row gap-8 items-start">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center shrink-0">
              <div className="w-16 h-16 bg-black flex items-center justify-center border border-black shrink-0 relative">
                <User size={28} className="text-white" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-black flex items-center justify-center border border-white shadow-md">
                  <Zap size={10} className="text-white fill-current" />
                </div>
              </div>

              <div className="min-w-0 flex-1 w-full lg:w-auto">
                <div className="flex flex-wrap items-center gap-3 mb-1">
                  <h1 className="text-xl font-black tracking-tight text-slate-950 truncate">
                    {user?.full_name || user?.email?.split('@')[0]}
                  </h1>
                  {user?.username && (
                    <span className="text-[10.5px] font-mono font-bold text-slate-600 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                      <AtSign size={10} />{user.username}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.2em] border ${
                    subscriptionPlan === 'premium' 
                      ? 'bg-amber-500 border-amber-500 text-white' 
                      : subscriptionPlan === 'plus'
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-slate-100 border-slate-300 text-slate-600'
                  }`}>
                    {subscriptionPlan ? subscriptionPlan.toUpperCase() : 'BASIC'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 text-[9px] font-bold font-mono mt-2 mb-3.5 text-neutral-400">
                  <span className="flex items-center gap-1 bg-slate-50 border border-slate-200/40 px-2 py-1 rounded select-all font-mono normal-case">
                    <Mail size={10} className="text-slate-400" /> {user?.email}
                  </span>
                  {user?.country && (
                    <span className="flex items-center gap-1 bg-slate-50 border border-slate-200/40 px-2 py-1 rounded uppercase text-slate-600">
                      <Globe size={10} className="text-slate-400" /> {user.country}
                    </span>
                  )}
                  {user?.experience_level && (
                    <span className="flex items-center gap-1 bg-slate-50 border border-slate-200/40 px-2 py-1 rounded uppercase text-indigo-650">
                      <Zap size={10} className="text-indigo-400" /> {user.experience_level}
                    </span>
                  )}
                </div>

                {user?.bio ? (
                  <p className="text-[10.5px] text-slate-500 bg-slate-50 border-l-[3px] border-slate-700 pl-3.5 pr-2 py-2 rounded-r-lg mt-2 max-w-xl font-mono uppercase tracking-wide leading-relaxed">
                    "{user.bio}"
                  </p>
                ) : (
                  <p className="text-[9.5px] text-slate-400 italic font-mono mt-1 mb-2">
                    NO BIO INTRO DECLARED. CLICK EDIT TO DEFINE.
                  </p>
                )}

                <div className="mt-4.5 flex items-center gap-2">
                  <button
                    onClick={handleStartEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300/80 hover:border-slate-400 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer text-slate-700"
                  >
                    <Edit size={10} className="stroke-[2.5]" />
                    Edit Profile Details
                  </button>
                </div>
                
                {/* Interactive Subscription Section Card */}
                <div className="mt-3.5 p-4 border border-dashed border-slate-200/90 rounded-2xl bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Membership Plan</span>
                    <span className={`text-[11px] font-black uppercase tracking-wider ${
                      subscriptionPlan === 'premium' ? 'text-amber-600' : subscriptionPlan === 'plus' ? 'text-indigo-600' : 'text-slate-600'
                    }`}>
                      {subscriptionPlan ? subscriptionPlan.toUpperCase() : 'BASIC'} ACTIVE
                    </span>
                    <p className="text-[9.5px] text-slate-400 mt-1 font-semibold leading-none">
                      {subscriptionPlan === 'premium' 
                        ? 'Full features, unlimited seats, all priority feeds unlocked.' 
                        : subscriptionPlan === 'plus' 
                          ? 'Advanced Trade Replay & side-by-side Chart synchronisation.' 
                          : 'Limits apply: upgrade to unlock Replays, Chart syncs & tournaments.'}
                    </p>
                  </div>
                  <button 
                    onClick={onNavigateToSubscription}
                    className="shrink-0 bg-slate-950 text-white hover:bg-slate-800 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    Upgrade Tier / Manage Setup
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 w-full">
                  <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-none flex flex-col justify-between transition-all hover:bg-indigo-50/80 duration-200">
                    <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-widest mb-1.5 leading-none">Total Trades</span>
                    <span className="text-sm font-black text-indigo-700 leading-none">{stats.total} Actions</span>
                  </div>
                  <div className={`p-3 border rounded-none flex flex-col justify-between transition-all duration-200 ${
                    stats.winRate >= 50 
                      ? 'bg-emerald-50/50 border-emerald-100 hover:bg-emerald-50/80' 
                      : 'bg-rose-50/50 border-rose-100 hover:bg-rose-50/80'
                  }`}>
                    <span className={`text-[8px] font-bold uppercase tracking-widest mb-1.5 leading-none ${
                      stats.winRate >= 50 ? 'text-emerald-500' : 'text-rose-500'
                    }`}>Win Ratio</span>
                    <span className={`text-sm font-black leading-none ${
                      stats.winRate >= 50 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {stats.winRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className={`p-3 border rounded-none flex flex-col justify-between transition-all duration-200 ${
                    stats.totalRR >= 0 
                      ? 'bg-emerald-50/50 border-emerald-100 hover:bg-emerald-50/80' 
                      : 'bg-rose-50/50 border-rose-100 hover:bg-rose-50/80'
                  }`}>
                    <span className={`text-[8px] font-bold uppercase tracking-widest mb-1.5 leading-none ${
                      stats.totalRR >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    }`}>Net Return</span>
                    <span className={`text-sm font-black flex items-center gap-0.5 leading-none ${
                      stats.totalRR >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {stats.totalRR >= 0 ? <TrendingUp size={12} className="stroke-[2.5]" /> : <TrendingDown size={12} className="stroke-[2.5]" />}
                      {stats.totalRR > 0 ? '+' : ''}{stats.totalRR.toFixed(1)}R
                    </span>
                  </div>
                  <div className="p-3 bg-orange-50/50 border border-orange-100 rounded-none flex flex-col justify-between transition-all hover:bg-orange-50/80 duration-200">
                    <span className="text-[8px] font-bold text-orange-500 uppercase tracking-widest mb-1.5 leading-none">Active Streak</span>
                    <span className="text-sm font-black text-orange-700 flex items-center gap-1 leading-none">
                      <Flame size={12} className="text-orange-500 fill-orange-500" />
                      {streakCount} {streakCount === 1 ? 'Day' : 'Days'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Growth Trend Area Chart Block */}
            <div className="flex-1 w-full h-[150px] min-h-[150px] bg-neutral-50/50 p-4 border border-neutral-200 relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Equity Growth Trend</span>
                <span className="text-[8px] font-bold text-black uppercase tracking-wider">Cumulative RR</span>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthData}>
                  <defs>
                    <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#000000" stopOpacity={0.12}/>
                      <stop offset="95%" stopColor="#000000" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ borderRadius: '0', border: '1px solid #171717', backgroundColor: '#000000', color: '#ffffff', fontSize: '9px', fontWeight: 'bold', padding: '4px 8px' }}
                    labelStyle={{ display: 'none' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="rr" 
                    stroke="#000000" 
                    strokeWidth={1.5}
                    fillOpacity={1} 
                    fill="url(#growthGradient)" 
                    animationDuration={1000}
                  />
                </AreaChart>
              </ResponsiveContainer>
              {growthData.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                  <TrendingUp size={36} className="text-black" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Achievements Showcase & Milestones */}
        <section className="space-y-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left side: Backtesting milestones (Beginner Bar representation) */}
            <div className="flex-1 p-6 bg-white border border-neutral-200 rounded-none shadow-sm space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-black mb-0.5">Career Level Progress</h3>
                <p className="text-[8px] text-neutral-400 font-bold uppercase tracking-widest leading-none">Backtest Trades Milestones</p>
              </div>

              {/* Progress Container info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs leading-none">
                  <span className="text-[9px] font-bold tracking-wider uppercase text-indigo-500">
                    {stats.total < 10 ? 'Beginner Rank' : `Active Tier Milestone`}
                  </span>
                  <span className="text-indigo-600 font-mono text-[9px] font-bold">
                    {badgeStats.isMaxTradeMilestone 
                      ? 'MAX LEVELreached' 
                      : `${stats.total} / ${badgeStats.nextTradeMilestone} Trades`
                    }
                  </span>
                </div>

                {/* Silver Progress Tracker Bar */}
                <div className="relative h-2 w-full bg-neutral-100 p-[1px] border border-neutral-200 rounded-none">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${badgeStats.tradeProgressPercent}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-none"
                  />
                </div>

                {/* Progression steps indicator */}
                <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-wider text-neutral-400 leading-none">
                  <span>{badgeStats.prevTradeMilestone} trades</span>
                  <span>{badgeStats.nextTradeMilestone} trades</span>
                </div>
              </div>

              {/* Small detail note */}
              <p className="text-[9px] text-neutral-400 font-medium leading-relaxed">
                {stats.total < 10 
                  ? "🔒 Execute 10 backtest trades in the charts using long or short positions to unlock your first voyager achievement badge!"
                  : `🎉 Progress towards next milestone: ${badgeStats.tradeProgressPercent.toFixed(0)}%.`
                }
              </p>
            </div>

            {/* Right side: Consistency / Streak progress */}
            <div className="flex-1 p-6 bg-white border border-neutral-200 rounded-none shadow-sm space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-black mb-0.5">Consistency Progress</h3>
                <p className="text-[8px] text-neutral-400 font-bold uppercase tracking-widest leading-none">Daily Active Login Streak</p>
              </div>

              {/* Progress Container info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs leading-none">
                  <span className="text-[9px] font-bold tracking-wider uppercase text-orange-500">Streak Level</span>
                  <span className="text-orange-600 font-mono text-[9px] font-bold">
                    {badgeStats.isMaxStreakMilestone 
                      ? 'MAX STREAK reached' 
                      : `${badgeStats.maxStreak} / ${badgeStats.nextStreakMilestone} Days`
                    }
                  </span>
                </div>

                <div className="relative h-2 w-full bg-neutral-100 p-[1px] border border-neutral-200 rounded-none">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${badgeStats.streakProgressPercent}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-none"
                  />
                </div>

                {/* Progression steps indicator */}
                <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-wider text-neutral-400 leading-none">
                  <span>{badgeStats.prevStreakMilestone} days</span>
                  <span>{badgeStats.nextStreakMilestone} days</span>
                </div>
              </div>

              <p className="text-[9px] text-neutral-400 font-medium leading-relaxed">
                Log in and interact with your backtesting dashboard daily to grow your streak! Longest logged streak is <strong className="text-black font-bold">{longestStreak || streakCount} days</strong>.
              </p>
            </div>
          </div>

          {/* All Badges Gallery */}
          <div className="p-6 bg-white border border-neutral-200 rounded-none shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100/60 flex-wrap gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-black mb-0.5">Achievements Showcase</h3>
                <p className="text-[8px] text-neutral-400 font-bold uppercase tracking-widest">Unlocked {badgeStats.unlockedCount} of 10 badges</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {badgeStats.badges.map((badge) => {
                const BadgeIcon = badge.icon;
                return (
                  <div 
                    key={badge.id}
                    className={`relative p-4 border rounded-none transition-all duration-300 flex flex-col items-center text-center justify-center group ${
                      badge.isUnlocked
                        ? `${badge.colorClass} shadow-sm hover:scale-[1.03] hover:shadow-md`
                        : 'bg-neutral-50/20 border-neutral-200/60 opacity-30 grayscale'
                    }`}
                  >
                    {/* Badge Icon Medallion */}
                    <div className={`w-10 h-10 flex items-center justify-center mb-2 relative border ml-auto mr-auto ${
                      badge.isUnlocked 
                        ? 'bg-white border-neutral-200/60' 
                        : 'bg-neutral-50/50 border-neutral-200 text-neutral-400'
                    }`}>
                      <BadgeIcon size={16} />
                      {!badge.isUnlocked && (
                        <div className="absolute -bottom-1 -right-1 bg-neutral-900 border border-white text-white rounded-none p-0.5 shadow-sm flex items-center justify-center">
                          <Lock size={8} />
                        </div>
                      )}
                    </div>

                    <h4 className="text-[9px] font-bold tracking-tight uppercase leading-none mb-1">
                      {badge.title}
                    </h4>
                    <span className="text-[7px] font-bold uppercase tracking-widest text-neutral-400 leading-none group-hover:opacity-80">
                      {badge.subtitle}
                    </span>

                    {/* High-fidelity hover tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-50">
                      <div className="bg-black text-white p-3 rounded-none shadow-xl border border-neutral-800 w-48 text-center text-[9px]">
                        <p className="font-bold text-neutral-100 mb-1 leading-tight">{badge.title}</p>
                        <p className="text-neutral-400 mb-2 font-medium leading-normal">{badge.description}</p>
                        <div className="flex items-center justify-between border-t border-neutral-800 pt-1.5 mt-1.5">
                          <span className="text-neutral-500 uppercase font-black tracking-widest text-[7px]">Progress</span>
                          <span className={badge.isUnlocked ? 'text-white font-black' : 'text-neutral-400 font-bold'}>
                            {badge.isUnlocked ? 'Unlocked' : badge.progressLabel}
                          </span>
                        </div>
                      </div>
                      <div className="w-1.5 h-1.5 bg-black rotate-45 -mt-1.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* GitHub Style Activity Heatmap */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-none bg-white flex items-center justify-center text-black border border-neutral-200">
                <Activity size={15} />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-black mb-0.5">Execution Log</h3>
                <p className="text-[8px] text-neutral-400 font-bold uppercase tracking-widest font-mono">Real-world backtesting diary</p>
              </div>
            </div>
          </div>
          
          <div className="relative bg-white border border-neutral-200 p-5 rounded-none">
            {/* Ambient indicator/fade on left and right sides to show scrolling is available */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />
            
            <div 
              ref={scrollRef}
              className="overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-200 scrollbar-track-transparent smooth-scroll"
            >
              <div className="flex flex-col gap-1.5 select-none min-w-max pb-1">
                {/* Year Month Headers (GitHub style alignment) */}
                <div className="relative h-4 w-full mb-1">
                  {monthLabels.map((lbl, idx) => (
                    <div 
                      key={idx} 
                      className="absolute text-[8px] font-bold text-neutral-400 uppercase tracking-wider font-mono" 
                      style={{ left: `${26 + lbl.colIndex * 14}px` }}
                    >
                      {lbl.text}
                    </div>
                  ))}
                </div>
                
                <div className="flex">
                  {/* Day of Week row headers (Mon, Wed, Fri only) */}
                  <div className="flex flex-col gap-[3px] select-none pr-2 shrink-0 w-[18px]">
                    <div className="h-[11px] text-[8px] font-bold text-neutral-400 flex items-center justify-end font-mono"></div>
                    <div className="h-[11px] text-[8px] font-bold text-neutral-400 flex items-center justify-end font-mono">Mon</div>
                    <div className="h-[11px] text-[8px] font-bold text-neutral-400 flex items-center justify-end font-mono"></div>
                    <div className="h-[11px] text-[8px] font-bold text-neutral-400 flex items-center justify-end font-mono">Wed</div>
                    <div className="h-[11px] text-[8px] font-bold text-neutral-400 flex items-center justify-end font-mono"></div>
                    <div className="h-[11px] text-[8px] font-bold text-neutral-400 flex items-center justify-end font-mono">Fri</div>
                    <div className="h-[11px] text-[8px] font-bold text-neutral-400 flex items-center justify-end font-mono"></div>
                  </div>

                  {/* 53 Columns of 7 Rows Grid (Sunday to Saturday) */}
                  <div className="flex gap-[3px]">
                    {Array.from({ length: 53 }).map((_, weekIdx) => {
                      const weekDays = calendarData.slice(weekIdx * 7, (weekIdx + 1) * 7);
                      return (
                        <div key={weekIdx} className="flex flex-col gap-[3px]">
                          {weekDays.map((day) => {
                            const dateLabel = new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                            return (
                              <div key={day.date} className="relative group">
                                <motion.div
                                  whileHover={{ scale: 1.25, zIndex: 10 }}
                                  className={`w-[11px] h-[11px] rounded-none ${getIntensity(day.count)} transition-all cursor-pointer`}
                                />
                                {/* Standard GitHub Tooltip Styling */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-50 animate-fade-in">
                                  <div className="bg-black text-white text-[9px] font-bold px-2 py-1.5 rounded-none shadow-xl border border-neutral-800 whitespace-nowrap leading-none flex gap-1 items-center">
                                    <span className="text-white">
                                      {day.count === 0 ? 'No actions' : `${day.count} trade${day.count > 1 ? 's' : ''}`}
                                    </span>
                                    <span className="text-neutral-400 font-normal">on {dateLabel}</span>
                                  </div>
                                  <div className="w-1.5 h-1.5 bg-black rotate-45 -mt-1.5" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Legend (using correct colors matching our getIntensity scale) */}
            <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-neutral-100">
              <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest font-mono">Less</span>
              <div className="flex gap-[3px]">
                <div className="w-[10px] h-[10px] bg-[#f4f4f5] border border-neutral-200/40" />
                <div className="w-[10px] h-[10px] bg-neutral-300" />
                <div className="w-[10px] h-[10px] bg-neutral-500" />
                <div className="w-[10px] h-[10px] bg-neutral-700" />
                <div className="w-[10px] h-[10px] bg-black" />
              </div>
              <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest font-mono">More</span>
            </div>
          </div>
        </section>

        {/* Pair Performance */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-none bg-white flex items-center justify-center text-black border border-neutral-200">
              <BarChart2 size={15} />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-black mb-0.5">Asset Performance Insight</h3>
              <p className="text-[8px] text-neutral-400 font-bold uppercase tracking-widest font-mono">Tested Symbol Analysis</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:grid-cols-3">
            {stats.symbolStats.map(stat => (
              <div key={stat.symbol} className="p-5 bg-white border border-neutral-200 rounded-none hover:shadow-md hover:border-black transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                   <div className="w-6 h-6 rounded-none bg-neutral-50 flex items-center justify-center text-neutral-400 border border-neutral-200">
                      <Award size={12} />
                   </div>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-none bg-neutral-50 flex items-center justify-center border border-neutral-200 overflow-hidden shrink-0">
                     <img 
                        src={`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/${stat.symbol.toLowerCase().split('/')[0].replace('usd', '')}.png`} 
                        alt=""
                        className="w-5 h-5 object-contain grayscale"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "https://cdn-icons-png.flaticon.com/128/2272/2272635.png";
                        }}
                      />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-black uppercase tracking-tight">{stat.symbol}</h4>
                    <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest font-mono">{stat.total} Actions</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Calculated Return</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 border ${
                      stat.rr > 0 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : stat.rr < 0 
                          ? 'bg-rose-50 text-rose-700 border-rose-200' 
                          : 'bg-neutral-50 text-neutral-500 border-neutral-100'
                    }`}>
                      {stat.rr > 0 ? '+' : ''}{stat.rr.toFixed(1)}R
                    </span>
                  </div>
                  <div className="h-1 w-full bg-neutral-100 rounded-none overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.winRate}%` }}
                      className={`h-full ${stat.winRate >= 50 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Win Rate</span>
                    <span className={`text-[9px] font-bold font-mono ${stat.winRate >= 50 ? 'text-emerald-600' : 'text-rose-500'}`}>{stat.winRate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}

            {stats.symbolStats.length === 0 && (
              <div className="col-span-full py-16 bg-white border border-dashed border-neutral-300 rounded-none flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-none bg-neutral-50 flex items-center justify-center text-neutral-400 mb-4 border border-neutral-200">
                  <Activity size={24} />
                </div>
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-400">Analysis pending trades</p>
              </div>
            )}
          </div>
        </section>

        {/* FEEDBACK & BRAND IDENTITY (RATE US & ABOUT US) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-neutral-200 mt-10">
          {/* Rate Us Card */}
          <div className="p-6 bg-white border border-neutral-200 rounded-none relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Star size={16} className={`text-[#00b67a] ${rating > 0 ? 'fill-[#00b67a]' : ''}`} />
                  <h3 className="text-xs font-black uppercase tracking-widest text-black">Share Your Thoughts</h3>
                </div>
                <div className="flex items-center gap-1 bg-[#00b67a]/10 px-2 py-0.5 rounded text-[8px] font-black text-[#00b67a] uppercase tracking-wider">
                  <span>Direct Feedback</span>
                </div>
              </div>
              
              {!hasRated ? (
                <div className="space-y-4">
                  <p className="text-[10.5px] text-neutral-500 font-semibold leading-relaxed">
                    How has your backtesting experience been so far? Leave a rating and share your thoughts to help me make FirstLook even better!
                  </p>
                  
                  {feedbackError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-800 text-[10px] font-bold rounded">
                      ⚠️ {feedbackError}
                    </div>
                  )}

                  {/* Star Rating Interaction */}
                  <div className="flex items-center gap-1.5 py-1">
                    {[1, 2, 3, 4, 5].map((starValue) => {
                      const isHighlighed = (hoveredRating || rating) >= starValue;
                      return (
                        <button
                          key={starValue}
                          type="button"
                          onMouseEnter={() => setHoveredRating(starValue)}
                          onMouseLeave={() => setHoveredRating(0)}
                          onClick={() => setRating(starValue)}
                          className="p-1 cursor-pointer hover:scale-110 transition-transform focus:outline-none"
                        >
                          <Star 
                            size={18} 
                            className={`${isHighlighed ? 'text-[#00b67a] fill-[#00b67a]' : 'text-neutral-300'} transition-colors duration-150`} 
                          />
                        </button>
                      );
                    })}
                    {rating > 0 && (
                      <span className="text-[9px] font-black uppercase tracking-wider text-[#00b67a] font-mono ml-2">
                        {rating} / 5 Stars
                      </span>
                    )}
                  </div>

                  {rating > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2.5"
                    >
                      <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Tell me what you think, what to improve, or what you enjoy..."
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-none p-3 text-[11px] font-semibold text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-[#00b67a] resize-none h-16"
                      />
                      <button
                        type="button"
                        disabled={isSubmittingFeedback}
                        onClick={handleSubmitFeedback}
                        className="w-full bg-[#00b67a] text-white py-2.5 text-[9px] font-black uppercase tracking-widest hover:bg-[#009b67] transition-colors cursor-pointer flex items-center justify-center gap-2"
                      >
                        {isSubmittingFeedback ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Submitting Feedback...
                          </>
                        ) : (
                          "Submit Review"
                        )}
                      </button>
                    </motion.div>
                  )}
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-6 text-center space-y-2"
                >
                  <div className="w-10 h-10 bg-[#00b67a]/10 rounded-full flex items-center justify-center border border-[#00b67a]/20 mx-auto text-[#00b67a]">
                    <CheckCircle2 size={18} className="stroke-[2.5]" />
                  </div>
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-neutral-805">Review Submitted!</h4>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest leading-relaxed">
                    {feedbackSuccessMsg || "Thank you so much! I have received your feedback and truly appreciate your support."}
                  </p>
                </motion.div>
              )}
            </div>
            
            <div className="text-[8.5px] font-bold text-neutral-400 uppercase tracking-widest font-mono mt-4 pt-4 border-t border-neutral-100/60 flex justify-between items-center">
              <span>Terminal Status: Live</span>
              <span className="text-[#00b67a]">● Online</span>
            </div>
          </div>

          {/* About Us Card */}
          <div className="p-6 bg-white border border-neutral-200 rounded-none flex flex-col justify-between">
            <div className="space-y-3.5">
              <div className="flex items-center gap-2">
                <Crown size={15} className="text-indigo-600" />
                <h3 className="text-xs font-black uppercase tracking-widest text-black">About FirstLook</h3>
              </div>
              <p className="text-[10.5px] text-neutral-500 font-semibold leading-relaxed">
                I built FirstLook to serve as the ultimate high-fidelity sandbox terminal for backtesting and custom strategy optimization. Whether you are manually replaying historical candle streams, composing custom indicators with the LiteScript editor, or stress-testing setups against live broker-wise raw spread simulations, my goal is to give you authentic market telemetry.
              </p>
              <p className="text-[10.5px] text-neutral-500 font-semibold leading-relaxed">
                I am constantly polishing this environment to make sure your mock executions, active watchlists, and strategy streaks help bridge the gap to real-world edge. Thank you for being a part of this trading community!
              </p>
            </div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-neutral-100/60 text-[8.5px] font-bold text-neutral-400 uppercase tracking-widest font-mono">
              <span>© {new Date().getFullYear()} FirstLook Terminal</span>
              <span 
                onClick={() => window.history.pushState(null, '', '/terms')}
                className="text-indigo-600 hover:underline cursor-pointer"
              >
                Terms & Security
              </span>
            </div>
          </div>
        </section>
      </div>

      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 w-full max-w-2xl space-y-5 animate-fade-in font-mono shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <span className="text-[11px] font-black text-slate-950 uppercase tracking-widest flex items-center gap-2">
                <Edit size={14} className="stroke-[2.5] text-slate-950" /> Edit Identity Parameters
              </span>
              <button 
                onClick={() => setIsEditing(false)} 
                className="text-slate-400 hover:text-black transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name Input */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Full Name</label>
                <div className="flex items-center px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 focus-within:border-black transition-all">
                  <User size={14} className="text-slate-450 mr-2 shrink-0" />
                  <input
                    type="text"
                    placeholder="Enter display name"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full bg-transparent text-xs text-black focus:outline-none uppercase font-bold"
                  />
                </div>
              </div>

              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Username Handle</label>
                <div className="flex items-center px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 focus-within:border-black transition-all">
                  <AtSign size={14} className="text-slate-450 mr-2 shrink-0" />
                  <input
                    type="text"
                    placeholder="Enter distinct handle"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full bg-transparent text-xs text-slate-850 focus:outline-none font-bold"
                  />
                </div>
              </div>

              {/* Country Select */}
              <div className="space-y-1.5 col-span-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Country Location</label>
                <div className="flex items-center px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 focus-within:border-black transition-all">
                  <Globe size={14} className="text-slate-450 mr-2 shrink-0" />
                  <select
                    value={editCountry}
                    onChange={(e) => setEditCountry(e.target.value)}
                    className="w-full bg-transparent text-xs text-slate-800 focus:outline-none uppercase font-bold cursor-pointer"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Experience Level Selector */}
              <div className="space-y-1.5 col-span-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Trading Rank</label>
                <div className="flex gap-2 h-[38px]">
                  {['Beginner', 'Intermediate', 'Advanced', 'Professional'].map((lvl) => (
                    <button
                      type="button"
                      key={lvl}
                      onClick={() => setEditExperienceLevel(lvl)}
                      className={`flex-1 rounded-xl text-[8px] font-black border transition-all text-center cursor-pointer ${
                        editExperienceLevel === lvl
                          ? 'bg-black text-white border-black'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-705'
                      }`}
                    >
                      {lvl.substring(0, 3).toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bio Input */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Bio Motto / Trading Mantra</label>
                <div className="flex items-center px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 focus-within:border-black transition-all">
                  <FileText size={14} className="text-slate-450 mr-2 shrink-0" />
                  <input
                    type="text"
                    placeholder="Enter short description"
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full bg-transparent text-xs text-black focus:outline-none uppercase"
                  />
                </div>
              </div>
            </div>

            {editError && (
              <div className="text-[9px] font-bold text-rose-650 bg-rose-50 border border-rose-100 p-2.5 rounded-xl uppercase text-center animate-shake">
                [ERROR] {editError}
              </div>
            )}

            {editSuccess && (
              <div className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl uppercase text-center flex items-center justify-center gap-1.5">
                <Check size={12} className="stroke-[2.5]" /> IDENTITY MUTATION SECURED SUCCESSFUL
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editLoading}
                onClick={handleSaveProfile}
                className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-[9px] font-black uppercase tracking-widest disabled:opacity-50 cursor-pointer flex items-center gap-1.5 transition-all shadow-md active:scale-[0.98]"
              >
                {editLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} className="stroke-[2.5]" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
