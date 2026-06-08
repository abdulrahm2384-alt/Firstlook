import React, { useMemo, useState } from 'react';
import { Account, Trade, Withdrawal } from '@/src/types';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { TrendingUp, Activity, Target, ShieldAlert, Briefcase, Wallet, ChevronLeft, ChevronRight } from 'lucide-react';

interface DashboardProps {
  accounts: Account[];
  trades: Trade[];
  withdrawals: Withdrawal[];
  loading?: boolean;
  onAddAccount: () => void;
  onSelectAccount: (account: Account) => void;
}

export default function Dashboard({ accounts, trades, withdrawals, loading, onAddAccount, onSelectAccount }: DashboardProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null); // null = All Month

  const stats = useMemo(() => {
    if (accounts.length === 0) return null;

    const totalInitial = accounts.reduce((sum, a) => sum + a.initialBalance, 0);
    const totalCurrent = accounts.reduce((sum, a) => sum + a.currentBalance, 0);
    const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);
    const totalProfit = (totalCurrent + totalWithdrawn) - totalInitial;
    const growthPercent = (totalProfit / totalInitial) * 100;

    const openTrades = trades.filter(t => t.status === 'open');
    const closedTrades = trades.filter(t => t.status === 'closed');

    // Current Month & Week Logic
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = now.getDay(); // 0 (Sun) to 6 (Sat)
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - dayOfWeek);

    const thisMonthTrades = closedTrades.filter(t => {
      const d = new Date(t.closedAt || t.createdAt);
      return d >= startOfMonth;
    });

    const thisWeekTrades = closedTrades.filter(t => {
      const d = new Date(t.closedAt || t.createdAt);
      return d >= startOfWeek;
    });

    const thisMonthProfit = thisMonthTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    const thisWeekProfit = thisWeekTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);

    // Filtered Month Logic
    const filterYear = currentMonth.getFullYear();
    const filterMonth = currentMonth.getMonth();
    const filterMonthStart = new Date(filterYear, filterMonth, 1);
    const filterMonthEnd = new Date(filterYear, filterMonth + 1, 0, 23, 59, 59);

    const filteredMonthTrades = closedTrades.filter(t => {
      const d = new Date(t.closedAt || t.createdAt);
      return d >= filterMonthStart && d <= filterMonthEnd;
    });

    // Filtered Week Logic
    let filteredTrades = filteredMonthTrades;
    if (selectedWeek !== null) {
      const weekStart = new Date(filterYear, filterMonth, (selectedWeek * 7) + 1);
      const weekEnd = new Date(filterYear, filterMonth, (selectedWeek * 7) + 7, 23, 59, 59);
      filteredTrades = filteredMonthTrades.filter(t => {
        const d = new Date(t.closedAt || t.createdAt);
        return d >= weekStart && d <= weekEnd;
      });
    }

    const filteredProfit = filteredTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    const filteredCount = filteredTrades.length;
    const filteredWins = filteredTrades.filter(t => (t.profitLoss || 0) > 0).length;
    const filteredWinRate = filteredCount > 0 ? (filteredWins / filteredCount) * 100 : 0;
    
    // Group open trades by account
    const openTradesByAccount = openTrades.reduce((acc, trade) => {
      acc[trade.accountId] = (acc[trade.accountId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Analysis By stats
    const analysisByStats = closedTrades.reduce((acc, t) => {
      const author = t.analysisBy || 'Unknown';
      if (!acc[author]) acc[author] = { name: author, profit: 0, count: 0, wins: 0 };
      acc[author].profit += (t.profitLoss || 0);
      acc[author].count += 1;
      if ((t.profitLoss || 0) > 0) acc[author].wins += 1;
      return acc;
    }, {} as Record<string, any>);

    // Pair stats
    const pairStats = closedTrades.reduce((acc, t) => {
      const pair = t.pair;
      if (!acc[pair]) acc[pair] = { name: pair, profit: 0, count: 0 };
      acc[pair].profit += (t.profitLoss || 0);
      acc[pair].count += 1;
      return acc;
    }, {} as Record<string, any>);

    // Day of week stats
    const dayStats = closedTrades.reduce((acc, t) => {
      const day = new Date(t.closedAt || t.createdAt).toLocaleDateString('en-US', { weekday: 'long' });
      if (!acc[day]) acc[day] = { name: day, profit: 0, count: 0 };
      acc[day].profit += (t.profitLoss || 0);
      acc[day].count += 1;
      return acc;
    }, {} as Record<string, any>);

    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const sortedDayStats = daysOrder.map(d => dayStats[d] || { name: d, profit: 0, count: 0 });

    // Calendar data (Daily P&L)
    const dailyPL = closedTrades.reduce((acc, t) => {
      const date = new Date(t.closedAt || t.createdAt).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + (t.profitLoss || 0);
      return acc;
    }, {} as Record<string, number>);

    // Growth over time data
    const sortedClosedTrades = [...closedTrades].sort((a, b) => 
      new Date(a.closedAt || a.createdAt).getTime() - new Date(b.closedAt || b.createdAt).getTime()
    );

    let runningProfit = 0;
    const chartData = sortedClosedTrades.map(t => {
      runningProfit += (t.profitLoss || 0);
      return {
        date: new Date(t.closedAt || t.createdAt).toLocaleDateString(),
        profit: runningProfit,
        rawDate: new Date(t.closedAt || t.createdAt).getTime()
      };
    });

    return {
      totalInitial,
      totalCurrent,
      totalProfit,
      totalWithdrawn,
      growthPercent,
      openTradesCount: openTrades.length,
      openTradesByAccount,
      chartData,
      analysisByStats: Object.values(analysisByStats).sort((a, b) => b.profit - a.profit),
      pairStats: Object.values(pairStats).sort((a, b) => b.profit - a.profit).slice(0, 5),
      dayStats: sortedDayStats,
      dailyPL,
      thisMonthProfit,
      thisWeekProfit,
      filteredProfit,
      filteredWinRate,
      filteredCount
    };
  }, [accounts, trades, withdrawals, currentMonth, selectedWeek]);

  if (loading) {
    return (
      <div className="space-y-12 font-serif">
        <div className="flex justify-between items-end border-b border-black pb-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold uppercase">Dashboard</h1>
            <p className="text-[10px] opacity-50 uppercase tracking-widest animate-pulse">Analyzing your data...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 border border-black animate-pulse bg-[#f9f9f9]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 font-serif pb-20">
      <div className="flex justify-between items-end border-b border-black pb-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold uppercase">Overview</h1>
          <p className="text-[10px] opacity-50 uppercase">Global performance & analysis</p>
        </div>
        <button 
          onClick={onAddAccount}
          className="border border-black bg-[#efefef] px-4 py-1 text-[10px] uppercase hover:bg-[#e5e5e5] transition-colors"
        >
          new account
        </button>
      </div>

      {stats && accounts.length > 0 && (
        <div className="space-y-8">
          {/* Global Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="border border-black p-4 space-y-2 bg-black text-white">
              <div className="flex justify-between items-center">
                <p className="text-[8px] opacity-60 uppercase">Total Equity</p>
                <TrendingUp size={12} className="opacity-60" />
              </div>
              <p className="text-xl font-bold">
                ${stats.totalCurrent.toLocaleString()}
              </p>
              <div className="flex justify-between items-end">
                <p className={`text-[9px] uppercase font-bold ${stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {stats.totalProfit >= 0 ? '+' : ''}{stats.growthPercent.toFixed(2)}% Overall
                </p>
                <div className="text-right space-y-0.5">
                  <p className={`text-[8px] font-bold ${stats.thisMonthProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    M: {stats.thisMonthProfit >= 0 ? '+' : ''}${Math.round(stats.thisMonthProfit)}
                  </p>
                  <p className={`text-[8px] font-bold ${stats.thisWeekProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    W: {stats.thisWeekProfit >= 0 ? '+' : ''}${Math.round(stats.thisWeekProfit)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="border border-black p-4 space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-[8px] opacity-40 uppercase">Total Profit</p>
                <Activity size={12} className="opacity-40" />
              </div>
              <p className={`text-xl font-bold ${stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${stats.totalProfit.toLocaleString()}
              </p>
              <p className="text-[9px] opacity-40 uppercase">Across {accounts.length} Accounts</p>
            </div>

            <div className="border border-black p-4 space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-[8px] opacity-40 uppercase">Ongoing Trades</p>
                <Briefcase size={12} className="opacity-40" />
              </div>
              <p className="text-xl font-bold">{stats.openTradesCount}</p>
              <p className="text-[9px] opacity-40 uppercase">Active Positions</p>
            </div>

            <div className="border border-black p-4 space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-[8px] opacity-40 uppercase">Total Withdrawn</p>
                <Wallet size={12} className="opacity-40" />
              </div>
              <p className="text-xl font-bold text-red-600">
                ${stats.totalWithdrawn.toLocaleString()}
              </p>
              <p className="text-[9px] opacity-40 uppercase">Realized Gains</p>
            </div>

            <div className="border border-black p-4 space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-[8px] opacity-40 uppercase">Win Rate</p>
                <Target size={12} className="opacity-40" />
              </div>
              <p className="text-xl font-bold">
                {trades.filter(t => t.status === 'closed').length > 0 
                  ? ((trades.filter(t => t.status === 'closed' && (t.profitLoss || 0) > 0).length / trades.filter(t => t.status === 'closed').length) * 100).toFixed(1)
                  : '0'}%
              </p>
              <p className="text-[9px] opacity-40 uppercase">Global Accuracy</p>
            </div>
          </div>

          {/* Growth Chart & Active Accounts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 border border-black p-6 space-y-4">
              <h3 className="text-[10px] font-bold uppercase border-l-2 border-black pl-2">Cumulative Growth</h3>
              <div className="h-[250px] w-full">
                {stats.chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.chartData}>
                      <defs>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#000" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#000" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 8, fill: '#999'}} 
                        minTickGap={30}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 8, fill: '#999'}}
                        tickFormatter={(val) => `$${val}`}
                      />
                      <Tooltip 
                        contentStyle={{ border: '1px solid black', borderRadius: 0, fontSize: '10px', fontFamily: 'serif' }}
                        labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="profit" 
                        stroke="#000" 
                        fillOpacity={1} 
                        fill="url(#colorProfit)" 
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center border border-dashed border-black/20">
                    <p className="text-[10px] uppercase opacity-40">No trade history for growth analysis</p>
                  </div>
                )}
              </div>
            </div>

            <div className="border border-black p-6 space-y-4">
              <h3 className="text-[10px] font-bold uppercase border-l-2 border-black pl-2">Active Accounts</h3>
              <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2">
                {accounts.filter(a => stats.openTradesByAccount[a.id]).length === 0 ? (
                  <p className="text-[10px] uppercase opacity-40 italic">No accounts with active trades</p>
                ) : (
                  accounts.filter(a => stats.openTradesByAccount[a.id]).map(account => (
                    <div 
                      key={account.id} 
                      onClick={() => onSelectAccount(account)}
                      className="group cursor-pointer border-b border-black/10 pb-3 last:border-0"
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase group-hover:underline">{account.name}</p>
                          <p className="text-[8px] opacity-40 uppercase">{account.type}</p>
                        </div>
                        <span className="text-[9px] bg-black text-white px-1.5 py-0.5 font-bold">
                          {stats.openTradesByAccount[account.id]} OPEN
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="pt-4 border-t border-black/10">
                <p className="text-[8px] opacity-40 uppercase leading-relaxed">
                  Focus on accounts with active exposure. Manage risk across your entire portfolio.
                </p>
              </div>
            </div>
          </div>

          {/* Account Type Analysis */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase border-l-2 border-black pl-2">Account Type Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Prop Analysis */}
              <div className="border border-black p-4 space-y-4 bg-[#f9f9f9]">
                <div className="flex items-center gap-2">
                  <Target size={14} />
                  <h4 className="text-[11px] font-bold uppercase">Prop Challenges</h4>
                </div>
                <div className="space-y-3">
                  {accounts.filter(a => a.type === 'prop').length === 0 ? (
                    <p className="text-[9px] uppercase opacity-40">No prop accounts active</p>
                  ) : (
                    accounts.filter(a => a.type === 'prop').map(a => {
                      const target = a.profitTarget || 10;
                      const current = ((a.currentBalance - a.initialBalance) / a.initialBalance) * 100;
                      const progress = Math.min(Math.max(current, 0) / target * 100, 100);
                      return (
                        <div key={a.id} className="space-y-1">
                          <div className="flex justify-between text-[9px] uppercase">
                            <span>{a.name}</span>
                            <span className="font-bold">{current.toFixed(1)}% / {target}%</span>
                          </div>
                          <div className="h-1 w-full bg-white border border-black/10">
                            <div className="h-full bg-black" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Live Analysis */}
              <div className="border border-black p-4 space-y-4 bg-[#f9f9f9]">
                <div className="flex items-center gap-2">
                  <Activity size={14} />
                  <h4 className="text-[11px] font-bold uppercase">Live Performance</h4>
                </div>
                <div className="space-y-3">
                  {accounts.filter(a => a.type === 'live').length === 0 ? (
                    <p className="text-[9px] uppercase opacity-40">No live accounts active</p>
                  ) : (
                    accounts.filter(a => a.type === 'live').map(a => {
                      const profit = a.currentBalance - a.initialBalance;
                      return (
                        <div key={a.id} className="flex justify-between items-center border-b border-black/5 pb-2">
                          <span className="text-[9px] uppercase">{a.name}</span>
                          <span className={`text-[10px] font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {profit >= 0 ? '+' : ''}${profit.toLocaleString()}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Prop Live Analysis */}
              <div className="border border-black p-4 space-y-4 bg-[#f9f9f9]">
                <div className="flex items-center gap-2 text-amber-600">
                  <ShieldAlert size={14} />
                  <h4 className="text-[11px] font-bold uppercase">Prop Live Buffer</h4>
                </div>
                <div className="space-y-3">
                  {accounts.filter(a => a.type === 'prop-live').length === 0 ? (
                    <p className="text-[9px] uppercase opacity-40">No prop live accounts active</p>
                  ) : (
                    accounts.filter(a => a.type === 'prop-live').map(a => {
                      const initialDD = a.initialBalance * ((a.maxDrawdown || 10) / 100);
                      const profit = a.currentBalance - a.initialBalance;
                      const buffer = initialDD + profit;
                      const threshold = initialDD * 0.6;
                      const isLowBuffer = buffer <= threshold;
                      
                      return (
                        <div key={a.id} className="space-y-2">
                          <div className="flex justify-between text-[9px] uppercase">
                            <span>{a.name}</span>
                            <span className={`font-bold ${isLowBuffer ? 'text-red-600' : 'text-green-600'}`}>
                              ${buffer.toFixed(0)} Buffer
                            </span>
                          </div>
                          <div className="flex justify-between text-[7px] uppercase opacity-50">
                            <span>Threshold: ${threshold.toFixed(0)}</span>
                            <span>{isLowBuffer ? 'LOW RISK MODE' : 'GROWTH MODE'}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Filtered Growth Insights */}
            <div className="border border-black p-6 space-y-6">
              <div className="space-y-1">
                <h3 className="text-[10px] font-bold uppercase border-l-2 border-black pl-2">Growth Insights</h3>
                <p className="text-[8px] opacity-40 uppercase">Filter by month and week</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-black pb-2">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        const d = new Date(currentMonth);
                        d.setMonth(d.getMonth() - 1);
                        setCurrentMonth(d);
                        setSelectedWeek(null);
                      }}
                      className="p-1 border border-black hover:bg-[#efefef]"
                    >
                      <ChevronLeft size={10} />
                    </button>
                    <span className="text-[10px] font-bold uppercase min-w-[100px] text-center">
                      {currentMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                    <button 
                      onClick={() => {
                        const d = new Date(currentMonth);
                        d.setMonth(d.getMonth() + 1);
                        setCurrentMonth(d);
                        setSelectedWeek(null);
                      }}
                      className="p-1 border border-black hover:bg-[#efefef]"
                    >
                      <ChevronRight size={10} />
                    </button>
                  </div>
                </div>

                <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
                  <button 
                    onClick={() => setSelectedWeek(null)}
                    className={`px-2 py-1 text-[8px] uppercase border border-black whitespace-nowrap ${selectedWeek === null ? 'bg-black text-white' : 'hover:bg-[#efefef]'}`}
                  >
                    All Month
                  </button>
                  {[0, 1, 2, 3, 4].map(w => (
                    <button 
                      key={w}
                      onClick={() => setSelectedWeek(w)}
                      className={`px-2 py-1 text-[8px] uppercase border border-black whitespace-nowrap ${selectedWeek === w ? 'bg-black text-white' : 'hover:bg-[#efefef]'}`}
                    >
                      Week {w + 1}
                    </button>
                  ))}
                </div>

                <div className="p-4 bg-[#f9f9f9] border border-black space-y-4">
                  <div className="text-center space-y-1">
                    <p className={`text-2xl font-bold tracking-tighter ${stats.filteredProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stats.filteredProfit >= 0 ? '+' : ''}${stats.filteredProfit.toLocaleString()}
                    </p>
                    <p className="text-[8px] opacity-40 uppercase">
                      {selectedWeek === null ? 'Monthly' : `Week ${selectedWeek + 1}`} Growth
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-black/10">
                    <div className="text-center">
                      <p className="text-[12px] font-bold">{stats.filteredCount}</p>
                      <p className="text-[7px] opacity-40 uppercase">Trades</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[12px] font-bold">{stats.filteredWinRate.toFixed(1)}%</p>
                      <p className="text-[7px] opacity-40 uppercase">Win Rate</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Analysis By Performance */}
            <div className="border border-black p-6 space-y-4">
              <h3 className="text-[10px] font-bold uppercase border-l-2 border-black pl-2">Analysis By Performance</h3>
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {stats.analysisByStats.length === 0 ? (
                  <p className="text-[10px] uppercase opacity-40 italic">No analysis data available</p>
                ) : (
                  stats.analysisByStats.map((author: any) => (
                    <div key={author.name} className="border border-black p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold uppercase">{author.name}</span>
                        <span className={`text-[11px] font-bold ${author.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {author.profit >= 0 ? '+' : ''}${author.profit.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-[8px] uppercase opacity-50">
                        <span>{author.count} Trades</span>
                        <span>Win Rate: {((author.wins / author.count) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Best Pairs & Days */}
            <div className="space-y-6">
              <div className="border border-black p-6 space-y-4">
                <h3 className="text-[10px] font-bold uppercase border-l-2 border-black pl-2">Top Trading Pairs</h3>
                <div className="space-y-2">
                  {stats.pairStats.length === 0 ? (
                    <p className="text-[10px] uppercase opacity-40 italic">No pair data available</p>
                  ) : (
                    stats.pairStats.map((pair: any) => (
                      <div key={pair.name} className="flex justify-between items-center text-[10px] uppercase border-b border-black/5 pb-2">
                        <span>{pair.name}</span>
                        <div className="text-right">
                          <p className={`font-bold ${pair.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${pair.profit.toLocaleString()}
                          </p>
                          <p className="text-[7px] opacity-40">{pair.count} Trades</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border border-black p-6 space-y-4">
                <h3 className="text-[10px] font-bold uppercase border-l-2 border-black pl-2">Performance by Day</h3>
                <div className="h-[150px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.dayStats}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 7, fill: '#999'}} 
                      />
                      <YAxis 
                        hide 
                      />
                      <Tooltip 
                        contentStyle={{ border: '1px solid black', borderRadius: 0, fontSize: '10px', fontFamily: 'serif' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="profit" 
                        stroke="#000" 
                        strokeWidth={2} 
                        dot={{ r: 3, fill: '#000' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Daily P&L Calendar */}
          <div className="border border-black p-6 space-y-4">
            <div className="flex justify-between items-center border-l-2 border-black pl-2">
              <h3 className="text-[10px] font-bold uppercase">Daily P&L Calendar</h3>
              <div className="flex items-center gap-4">
                <span className="text-[10px] uppercase font-bold">
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <div className="flex gap-1">
                  <button 
                    onClick={() => {
                      const d = new Date(currentMonth);
                      d.setMonth(d.getMonth() - 1);
                      setCurrentMonth(d);
                    }}
                    className="p-1 border border-black hover:bg-[#efefef]"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <button 
                    onClick={() => {
                      const d = new Date(currentMonth);
                      d.setMonth(d.getMonth() + 1);
                      setCurrentMonth(d);
                    }}
                    className="p-1 border border-black hover:bg-[#efefef]"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-[8px] uppercase opacity-40 text-center font-bold">{day}</div>
              ))}
              
              {/* Generate days for the selected month */}
              {(() => {
                const year = currentMonth.getFullYear();
                const month = currentMonth.getMonth();
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                
                const days = [];
                // Padding for first week
                for (let i = 0; i < firstDay; i++) {
                  days.push(<div key={`pad-${i}`} className="aspect-square" />);
                }
                
                // Actual days
                for (let d = 1; d <= daysInMonth; d++) {
                  const date = new Date(year, month, d);
                  const dateStr = date.toISOString().split('T')[0];
                  const pl = stats.dailyPL[dateStr] || 0;
                  const isToday = new Date().toISOString().split('T')[0] === dateStr;

                  days.push(
                    <div 
                      key={dateStr} 
                      className={`aspect-square border border-black/10 flex flex-col items-center justify-center p-1 relative group ${
                        pl > 0 ? 'bg-green-50' : pl < 0 ? 'bg-red-50' : 'bg-white'
                      } ${isToday ? 'ring-1 ring-black ring-inset' : ''}`}
                    >
                      <span className={`text-[7px] absolute top-0.5 left-1 ${isToday ? 'font-bold' : 'opacity-30'}`}>
                        {d}
                      </span>
                      {pl !== 0 && (
                        <span className={`text-[8px] font-bold ${pl > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {pl > 0 ? '+' : ''}{Math.round(pl)}
                        </span>
                      )}
                      <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black text-white text-[8px] px-2 py-1 whitespace-nowrap z-10">
                        {date.toLocaleDateString()}: ${pl.toLocaleString()}
                      </div>
                    </div>
                  );
                }
                return days;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Individual Accounts List */}
      <div className="space-y-6">
        <h3 className="text-[10px] font-bold uppercase border-l-2 border-black pl-2">Individual Accounts</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.length === 0 ? (
            <div className="col-span-full py-20 border border-black text-center space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold uppercase">No accounts found</h3>
                <p className="text-[10px] opacity-40 uppercase">Start by creating your first trading account</p>
              </div>
              <button onClick={onAddAccount} className="text-[10px] underline uppercase">
                Add Account
              </button>
            </div>
          ) : (
            accounts.map((account) => (
              <div
                key={account.id}
                className="border border-black p-4 cursor-pointer hover:bg-[#f9f9f9] transition-colors space-y-4"
                onClick={() => onSelectAccount(account)}
              >
                <div className="flex justify-between items-start">
                  <span className="text-[9px] border border-black px-1 uppercase">
                    {account.type === 'prop' 
                      ? `${account.propType || '2-Phase'} • Phase ${account.phase}` 
                      : account.type === 'prop-live'
                      ? 'Prop Live'
                      : account.type}
                  </span>
                  {account.type === 'prop' && (
                    <span className={`text-[9px] border border-black px-1 uppercase font-bold ${
                      account.status === 'passed' ? 'bg-black text-white' : 
                      account.status === 'failed' ? 'bg-red-50 text-red-600 border-red-600' : ''
                    }`}>
                      {account.status || 'active'}
                    </span>
                  )}
                  <span className="text-[9px] opacity-40 uppercase">{account.currency}</span>
                </div>
                
                <div className="space-y-1">
                  <h2 className="text-sm font-bold uppercase">{account.name}</h2>
                  <p className="text-[9px] opacity-40 uppercase">
                    Created {new Date(account.createdAt || Date.now()).toLocaleDateString()}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 border-t border-black pt-2">
                  <div className="space-y-0.5">
                    <p className="text-[8px] opacity-40 uppercase">Initial</p>
                    <p className="text-xs">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency }).format(account.initialBalance)}
                    </p>
                  </div>
                  <div className="space-y-0.5 text-right">
                    <p className="text-[8px] opacity-40 uppercase">Current</p>
                    <p className={`text-xs ${account.currentBalance >= account.initialBalance ? 'text-black' : 'text-black opacity-60'}`}>
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency }).format(account.currentBalance)}
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-between text-[8px] opacity-40 uppercase pt-1">
                  <span>Performance</span>
                  <span>{(((account.currentBalance - account.initialBalance) / account.initialBalance) * 100).toFixed(2)}%</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
