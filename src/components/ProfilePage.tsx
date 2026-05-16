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
  Activity
} from 'lucide-react';
import { useMemo } from 'react';
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

interface ProfilePageProps {
  user: any;
  trades: JournalTrade[];
  watchlist: any[];
  onBack: () => void;
}

export function ProfilePage({ user, trades, watchlist, onBack }: ProfilePageProps) {
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
      if (t.realizedAt) {
        const dateKey = new Date(t.realizedAt).toISOString().split('T')[0];
        tradeCounts[dateKey] = (tradeCounts[dateKey] || 0) + 1;
      }
    });

    // Show more days if space allows, but keep ~210 for reasonable density
    for (let i = 210; i >= 0; i--) { 
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      days.push({
        date: key,
        count: tradeCounts[key] || 0
      });
    }

    return days;
  }, [trades]);

  const getIntensity = (count: number) => {
    if (count === 0) return 'bg-slate-100';
    if (count === 1) return 'bg-indigo-200';
    if (count === 2) return 'bg-indigo-400';
    if (count >= 3) return 'bg-indigo-600';
    return 'bg-slate-100';
  };

  const scrollRef = useMemo(() => {
    return (el: HTMLDivElement | null) => {
      if (el) {
        el.scrollLeft = el.scrollWidth;
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] relative overflow-hidden">
      {/* Sticky Header - Simplified */}
      <div className="sticky top-0 z-30 px-6 py-5 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 group"
          >
            <ChevronLeft size={20} className="text-slate-400 group-hover:text-slate-900 transition-colors" />
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900">Profile</h2>
          </button>
        </div>
        
        <button 
          onClick={() => supabase.auth.signOut()}
          className="flex items-center gap-2 text-rose-500 hover:text-rose-600 transition-all"
        >
          <LogOut size={18} />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">Logout</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 md:px-8 py-6 space-y-8 pb-24">
        {/* Lighter User Card - Square Corners */}
        <div className="relative group overflow-hidden p-8 bg-white border border-slate-100 shadow-sm transition-all">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/3" />
          
          <div className="relative flex flex-col lg:flex-row gap-12 items-start">
            <div className="flex flex-col md:flex-row gap-8 items-start md:items-center shrink-0">
              <div className="w-20 h-20 bg-slate-50 flex items-center justify-center border border-slate-100 shadow-sm shrink-0">
                <User size={32} className="text-slate-400" />
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-indigo-500 flex items-center justify-center border-4 border-white shadow-lg">
                  <Zap size={12} className="text-white fill-current" />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-1">
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 truncate">
                    {user?.email?.split('@')[0]}
                  </h1>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase tracking-widest border border-indigo-100">
                    Freemium
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] truncate">{user?.email}</p>
                
                <div className="flex flex-wrap gap-x-12 gap-y-6 mt-8">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Activity</span>
                    <span className="text-lg font-black text-slate-900">{stats.total} Trades</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Success</span>
                    <span className="text-lg font-black text-emerald-500">{stats.winRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Performance</span>
                    <span className="text-lg font-black text-indigo-600">
                      {stats.totalRR > 0 ? '+' : ''}{stats.totalRR.toFixed(1)}R
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Growth Trend Chart */}
            <div className="flex-1 w-full h-[180px] min-h-[180px] bg-slate-50/30 rounded-2xl p-4 border border-slate-100/50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Equity Growth Trend</h3>
                <span className="text-[9px] font-bold text-indigo-600 uppercase">Cumulative RR</span>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthData}>
                  <defs>
                    <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                    labelStyle={{ display: 'none' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="rr" 
                    stroke="#6366f1" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#growthGradient)" 
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
              {growthData.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                  <TrendingUp size={48} className="text-slate-300" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* GitHub Style Activity Heatmap */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-slate-400 border border-slate-100">
                <Activity size={16} />
              </div>
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Trade Frequency</h3>
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">User Work-Study Timeline</p>
              </div>
            </div>
          </div>
          
          <div 
            ref={scrollRef}
            className="p-5 bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-x-auto scrollbar-hide smooth-scroll"
          >
            <div className="flex flex-col gap-2">
              <div className="flex gap-1.5 min-w-max text-[7px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">
                {(() => {
                  const weeks = Math.ceil(calendarData.length / 7);
                  const labels = [];
                  let lastMonth = '';
                  for (let i = 0; i < weeks; i++) {
                    const date = new Date(calendarData[i * 7].date);
                    const month = date.toLocaleString('default', { month: 'short' });
                    if (month !== lastMonth) {
                      labels.push(<div key={i} style={{ width: '28px' }}>{month}</div>);
                      lastMonth = month;
                    } else {
                      labels.push(<div key={i} style={{ width: '28px' }} />);
                    }
                  }
                  return labels;
                })()}
              </div>
              <div className="flex gap-1.5 min-w-max pt-1">
                {Array.from({ length: Math.ceil(calendarData.length / 7) }).map((_, weekIdx) => (
                  <div key={weekIdx} className="flex flex-col gap-1.5">
                    {calendarData.slice(weekIdx * 7, (weekIdx + 1) * 7).map((day) => (
                      <motion.div
                        key={day.date}
                        whileHover={{ scale: 1.3, zIndex: 10, borderRadius: '4px' }}
                        className={`w-2.5 h-2.5 rounded-[2px] ${getIntensity(day.count)} transition-all cursor-pointer`}
                        title={`${day.date}: ${day.count} study actions`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-slate-50">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Less</span>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-[1px] bg-slate-100" />
                <div className="w-2 h-2 rounded-[1px] bg-indigo-200" />
                <div className="w-2 h-2 rounded-[1px] bg-indigo-400" />
                <div className="w-2 h-2 rounded-[1px] bg-indigo-600" />
              </div>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">More</span>
            </div>
          </div>
        </section>

        {/* Pair Performance */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-slate-400 border border-slate-100">
              <BarChart2 size={16} />
            </div>
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Watchlist Insights</h3>
              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Performance Analytics</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:grid-cols-3">
            {stats.symbolStats.map(stat => (
              <div key={stat.symbol} className="p-6 bg-white border border-slate-100 rounded-[2.5rem] hover:shadow-xl hover:shadow-slate-200/30 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                   <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                      <Award size={14} />
                   </div>
                </div>

                <div className="flex items-center gap-4 mb-5">
                  <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 overflow-hidden shrink-0">
                     <img 
                        src={`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/${stat.symbol.toLowerCase().split('/')[0].replace('usd', '')}.png`} 
                        alt=""
                        className="w-6 h-6 object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "https://cdn-icons-png.flaticon.com/128/2272/2272635.png";
                        }}
                      />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{stat.symbol}</h4>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{stat.total} Actions</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Return</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${stat.rr > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {stat.rr > 0 ? '+' : ''}{stat.rr.toFixed(1)}R
                    </span>
                  </div>
                  <div className="h-1 w-full bg-slate-50 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.winRate}%` }}
                      className={`h-full ${stat.winRate > 50 ? 'bg-emerald-400' : 'bg-indigo-400'}`}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Rate</span>
                    <span className="text-[10px] font-black text-slate-900">{stat.winRate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}

            {stats.symbolStats.length === 0 && (
              <div className="col-span-full py-24 bg-white border border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-[2rem] bg-slate-50 flex items-center justify-center text-slate-200 mb-4 border border-slate-100">
                  <Activity size={32} />
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Analysis pending trades</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
