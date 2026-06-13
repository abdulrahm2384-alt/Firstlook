/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect, useRef, memo, useCallback } from 'react';
import { motion, AnimatePresence, useSpring } from 'motion/react';
import { 
  TrendingUp, 
  Activity, 
  History, 
  Settings2, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight,
  Maximize2,
  RefreshCcw,
  Zap,
  Bitcoin,
  Settings,
  Sparkles,
  Wallet,
  Briefcase,
  User,
  LayoutGrid,
  Clock,
  Pencil,
  BarChart2,
  Play,
  Pause,
  Eye,
  ChevronDown,
  ChevronUp,
  LogOut,
  List,
  Menu,
  Compass,
  MessageSquare,
  Calendar,
  PlayCircle,
  X,
  XCircle,
  CheckCircle2,
  Info,
  CircleAlert,
  CandlestickChart,
  Plus,
  Image,
  Maximize,
  Database,
  Link2,
  Repeat,
  Star,
  Check,
  ArrowUpDown,
  ArrowLeftRight,
  Flame,
  Heart,
  ExternalLink,
  Download,
  Volume2,
  VolumeX,
  Video,
  AlertTriangle,
  Trophy,
  Lock
} from 'lucide-react';
import { 
  AreaChart,
  Area,
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Tooltip,
  CartesianGrid
} from 'recharts';
import { ChartComponent } from './components/Chart/ChartComponent';
import { DrawingToolbar } from './components/DrawingToolbar';
import { FavoriteDrawingsToolbar } from './components/FavoriteDrawingsToolbar';
import { DrawingSettingsBox } from './components/DrawingSettingsBox';
import { TradeDetailsCard } from './components/TradeDetailsCard';
import { TradingCalendar } from './components/TradingCalendar';
import { IndicatorsModal } from './components/IndicatorsModal';
import { ColorPicker } from './components/ColorPicker';
import { IndicatorSettings } from './components/IndicatorSettings';
import { SetupModal } from './components/SetupModal';
import { SyncedSelectorModal } from './components/SyncedSelectorModal';
import { TriggerSetupModal } from './components/TriggerSetupModal';
import { ProfilePage } from './components/ProfilePage';
import { SubscriptionPage } from './components/SubscriptionPage';
import { DrawingType, Drawing } from './types/drawing';
import { fetchMarketData as fetchCandleData, clearMarketDataCache } from './services/marketDataService';
import { runBacktest } from './services/backtestEngine';
import { StrategyParams, BacktestResult, Candle, ChartTheme, IndicatorInstance, JournalTrade, BacktestSession, MarketType, MarketSymbol } from './types';
import { calculatePips, normalizeSymbol, getPipMultiplier } from './lib/marketUtils';
import { supabase, isSupabasePlaceholder } from './lib/supabase';
import { LoginPage } from './components/LoginPage';
import { WatchlistPage } from './components/WatchlistPage';
import { GoogleAdSenseUnit } from './components/GoogleAdSenseUnit';
import { persistenceService } from './services/persistenceService';
import {
  saveChartStateToCache,
  getChartStateFromCache,
  getChartStateFromCacheSync,
  getMissingCandleRanges,
  clearAllLocalChartCaches
} from './services/chartCacheService';

import { WatchlistItem } from './types/watchlist';
import { POPULAR_SYMBOLS } from './constants/symbols';
import { InstallPrompt } from './components/InstallPrompt';
import { LegalAndSpecsPages, LegalTabType } from './components/LegalAndSpecsPages';

const EMPTY_TRADES_ARRAY: any[] = [];

function getAssetDatedFromDate(symbol: string, source: string): Date {
  const normSymbol = (symbol || '').trim().toUpperCase();
  const normSource = (source || '').trim().toLowerCase();
  
  const asset = POPULAR_SYMBOLS.find(s => s.symbol.trim().toUpperCase() === normSymbol);
  if (asset?.category === 'Crypto') {
    return asset.marketStart ? new Date(asset.marketStart) : new Date('2017-08-17');
  }
  
  if (normSource === 'exness') {
    if (normSymbol === 'US30' || normSymbol === 'US30/USD') {
      return new Date('2019-01-01');
    }
    if (normSymbol === 'USOIL' || normSymbol === 'USOIL/USD') {
      return new Date('2019-01-01');
    }
    if (normSymbol === 'DXY' || normSymbol === 'DXY/USD') {
      return new Date('2021-01-01');
    }
    if (normSymbol === 'NAS100' || normSymbol === 'NAS100/USD') {
      return new Date('2019-01-01');
    }
    if (normSymbol === 'SPX500' || normSymbol === 'SPX500/USD') {
      return new Date('2019-01-01');
    }
  }
  
  return new Date('2015-08-01');
}

function getAssetDatedFromLabel(symbol: string, source: string): string {
  const dateObj = getAssetDatedFromDate(symbol, source);
  const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
  const year = dateObj.getFullYear();
  return `${month} ${year}`.toUpperCase();
}

function getMinSelectableStartDate(symbol: string, source: string): Date {
  return getAssetDatedFromDate(symbol, source);
}


const TIMEFRAMES = [
  { id: '1m', label: '1m', seconds: 60 },
  { id: '2m', label: '2m', seconds: 120 },
  { id: '3m', label: '3m', seconds: 180 },
  { id: '5m', label: '5m', seconds: 300 },
  { id: '10m', label: '10m', seconds: 600 },
  { id: '15m', label: '15m', seconds: 900 },
  { id: '30m', label: '30m', seconds: 1800 },
  { id: '45m', label: '45m', seconds: 2700 },
  { id: '1h', label: '1h', seconds: 3600 },
  { id: '2h', label: '2h', seconds: 7200 },
  { id: '4h', label: '4h', seconds: 14400 },
  { id: '8h', label: '8h', seconds: 28800 },
  { id: '12h', label: '12h', seconds: 43200 },
  { id: '1d', label: '1D', seconds: 86400 },
  { id: '1w', label: '1W', seconds: 604800 },
];

const TIMEZONES = [
  { id: 'UTC', label: 'UTC (Universal Regular)' },
  { id: 'Africa/Lagos', label: 'UTC +1 (Lagos)' },
  { id: 'Europe/London', label: 'UTC +0/+1 (London)' },
  { id: 'Europe/Paris', label: 'UTC +1/+2 (Paris)' },
  { id: 'America/New_York', label: 'UTC -5/-4 (New York)' },
  { id: 'America/Chicago', label: 'UTC -6/-5 (Chicago)' },
  { id: 'America/Denver', label: 'UTC -7/-6 (Denver)' },
  { id: 'America/Los_Angeles', label: 'UTC -8/-7 (Los Angeles)' },
  { id: 'Asia/Dubai', label: 'UTC +4 (Dubai)' },
  { id: 'Asia/Tokyo', label: 'UTC +9 (Tokyo)' },
  { id: 'Asia/Hong_Kong', label: 'UTC +8 (Hong Kong)' },
  { id: 'Australia/Sydney', label: 'UTC +10/+11 (Sydney)' },
];

const DEFAULT_THEME: ChartTheme = {
  bg: '#FFFFFF',
  grid: '#f1f5f9',
  text: '#64748b',
  upColor: '#10b981',
  upBorder: '#10b981',
  upWick: '#10b981',
  downColor: '#ef4444',
  downBorder: '#ef4444',
  downWick: '#ef4444',
  showGrid: true,
  timezone: 'UTC',
  bidColor: '#2962ff',
  askColor: '#f23645',
  rawSpread: false,
  tickingEnabled: true,
  showWatermark: true,
  commissionEnabled: true
};

const toTheme = (t: any): ChartTheme => ({
  ...DEFAULT_THEME,
  ...t
});

const MemoizedChart = memo(ChartComponent);

interface TickingState {
  close: number;
  high: number;
  low: number;
}

export function getTickingCandleState(candle: Candle, tickIndex: number, totalTicks: number): TickingState {
  const p = Math.max(0, Math.min(1.0, tickIndex / (totalTicks - 1 || 1)));
  const isBullish = candle.close >= candle.open;
  let price = candle.open;
  let formingHigh = candle.open;
  let formingLow = candle.open;

  if (isBullish) {
    if (p <= 0.25) {
      const t = p / 0.25;
      price = candle.open + (candle.low - candle.open) * t;
      formingHigh = candle.open;
      formingLow = price;
    } else if (p <= 0.75) {
      const t = (p - 0.25) / 0.5;
      price = candle.low + (candle.high - candle.low) * t;
      formingHigh = price;
      formingLow = candle.low;
    } else {
      const t = (p - 0.75) / 0.25;
      price = candle.high + (candle.close - candle.high) * t;
      formingHigh = candle.high;
      formingLow = candle.low;
    }
  } else {
    if (p <= 0.25) {
      const t = p / 0.25;
      price = candle.open + (candle.high - candle.open) * t;
      formingHigh = price;
      formingLow = candle.open;
    } else if (p <= 0.75) {
      const t = (p - 0.25) / 0.5;
      price = candle.high + (candle.low - candle.high) * t;
      formingHigh = candle.high;
      formingLow = price;
    } else {
      const t = (p - 0.75) / 0.25;
      price = candle.low + (candle.close - candle.low) * t;
      formingHigh = candle.high;
      formingLow = candle.low;
    }
  }

  return {
    close: price,
    high: Math.max(formingHigh, price),
    low: Math.min(formingLow, price)
  };
}

const MemoizedWatchlistPage = memo(WatchlistPage);
const MemoizedProfilePage = memo(ProfilePage);
const MemoizedSubscriptionPage = memo(SubscriptionPage);

const INITIAL_POSITIONS = {
  desktop: {
    toolbar: { x: 0, y: 0 },
    favorites: { x: 0, y: 0 },
    simControls: { x: -20, y: -20 }
  },
  mobilePortrait: {
    toolbar: { x: 10, y: -60 },
    favorites: { x: 0, y: -40 },
    simControls: { x: 0, y: -120 }
  },
  mobileLandscape: {
    toolbar: { x: 10, y: -40 },
    favorites: { x: 0, y: 0 },
    simControls: { x: -10, y: -10 }
  }
};

// --- Local Sub-Components for Performance ---

const FloatingPlaybackControls = memo(({ 
  isReplayMode, 
  simIsPlaying, 
  setSimIsPlaying, 
  replayIsPlaying, 
  setReplayIsPlaying, 
  isMobile, 
  isMobileLandscape, 
  simCurrentTime, 
  replayCurrentTime, 
  getStepSeconds, 
  setSimCurrentTime, 
  setReplayCurrentTime, 
  exitReplay, 
  setIsSimulating, 
  simSpeed, 
  setSimSpeed, 
  selectedTimeframe,
  isSpeedOpen,
  setIsSpeedOpen,
  speedRef,
  activeSimControlsPos,
  updateSimControlsPosWithClamp,
  workspaceRef,
  currentMode,
  watchlist,
  activeWatchlistItemId,
  backtestSessions,
  setBacktestSessions,
  addNotification,
  selectedSymbol,
  activePrefix,
  currentSessionKey,
  futureFetchError,
  onRetryFutureFetch,
  sessionCurrentTimesRef,
  replayTrade,
  togglePlayback,
  historicalDataRef,
  setShowSyncInfoModal,
  subscriptionPlan,
  onLockedFeature
}: any) => {
  const sessionData = currentSessionKey ? backtestSessions[currentSessionKey] : null;
  const timeSyncEnabled = sessionData?.timeSyncEnabled || false;
  const activeTimeSyncSpeed = sessionData?.timeSyncSpeed || 60;

  const handleSelectNormalSpeed = (s: number) => {
    setSimSpeed(s);
    if (currentSessionKey && sessionData) {
      setBacktestSessions((prev: any) => ({
        ...prev,
        [currentSessionKey]: {
          ...prev[currentSessionKey],
          timeSyncEnabled: false,
          timeSyncLastTimestamp: undefined
        }
      }));
    }
    setIsSpeedOpen(false);
  };

  const handleToggleTimeSync = () => {
    if (!currentSessionKey) {
      addNotification("Please select an active backtest session to enable Time Sync", 'warning');
      return;
    }
    if (subscriptionPlan === 'basic') {
      onLockedFeature?.('timesync');
      return;
    }
    const nextEnabled = !timeSyncEnabled;
    setBacktestSessions((prev: any) => ({
      ...prev,
      [currentSessionKey]: {
        ...prev[currentSessionKey],
        timeSyncEnabled: nextEnabled,
        timeSyncSpeed: activeTimeSyncSpeed,
        timeSyncLastTimestamp: nextEnabled ? Date.now() : undefined
      }
    }));
  };

  const handleSelectTimeSyncSpeed = (speedSecs: number) => {
    if (subscriptionPlan === 'basic') {
      onLockedFeature?.('timesync');
      return;
    }
    if (currentSessionKey) {
      setBacktestSessions((prev: any) => ({
        ...prev,
        [currentSessionKey]: {
          ...prev[currentSessionKey],
          timeSyncEnabled: true,
          timeSyncSpeed: speedSecs,
          timeSyncLastTimestamp: Date.now()
        }
      }));
    }
  };

  const timeSyncOptions = [
    { label: "1m candle = 1 min (60s)", value: 60 },
    { label: "1m candle = 30 seconds", value: 30 },
    { label: "1m candle = 15 seconds", value: 15 },
    { label: "1m candle = 10 seconds", value: 10 },
    { label: "1m candle = 5 seconds", value: 5 },
    { label: "1m candle = 2.5 seconds", value: 2.5 }
  ];

  return (
    <motion.div
      key={`sim-controls-${currentMode}`}
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ 
        opacity: 1, 
        y: activeSimControlsPos.y, 
        x: activeSimControlsPos.x, 
        scale: 1,
        transition: { type: 'spring', damping: 30, stiffness: 400 }
      }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      drag
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={workspaceRef}
      onDragEnd={(_e, info) => {
        const newPos = { x: activeSimControlsPos.x + info.offset.x, y: activeSimControlsPos.y + info.offset.y };
        updateSimControlsPosWithClamp(newPos);
      }}
      whileDrag={{ scale: 1.02, cursor: 'grabbing' }}
      className={`fixed bottom-24 right-8 z-[100] bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] ${isMobile ? 'p-0.5 gap-0.5' : 'p-1.5 gap-1.5'} flex items-center cursor-move active:cursor-grabbing`}
    >
      <div className={`flex items-center ${isMobile ? 'gap-0.5' : 'gap-1'} px-0.5`}>
        <button 
          onClick={togglePlayback}
          className={`${isMobile ? 'w-7 h-7' : 'w-9 h-9 md:w-[5.5vh] md:h-[5.5vh]'} flex items-center justify-center rounded-xl transition-all ${(isReplayMode ? replayIsPlaying : simIsPlaying) ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-900 text-white shadow-lg'}`}
        >
          {(isReplayMode ? replayIsPlaying : simIsPlaying) ? <Pause size={isMobileLandscape ? '3vh' : isMobile ? 10 : 18} fill="currentColor" /> : <Play size={isMobileLandscape ? '3vh' : isMobile ? 10 : 18} fill="currentColor" />}
        </button>
      </div>

      <div className={`${isMobile ? 'h-4' : 'h-7'} w-px bg-slate-100 mx-0.5 md:h-[4.5vh]`}></div>

      <div className={`flex items-center ${isMobile ? 'gap-0.5' : 'gap-1'}`}>
        <div className="relative font-bold text-slate-600" ref={speedRef}>
          <button 
             onClick={() => setIsSpeedOpen(!isSpeedOpen)}
             className={`${isMobile ? 'h-7 px-1.5' : 'h-9 px-2.5 md:h-[5.5vh] md:px-[1.8vh]'} flex items-center justify-center gap-[0.3vh] rounded-xl transition-all ${isSpeedOpen ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-400 hover:text-slate-900'}`}
           >
             <span className={`${isMobileLandscape ? 'text-[2vh]' : isMobile ? 'text-[8px]' : 'text-[11px]'} font-black`}>
               {timeSyncEnabled ? 'Sync' : `${simSpeed}x`}
             </span>
             <ChevronUp size={isMobileLandscape ? '1.2vh' : isMobile ? 6 : 9} strokeWidth={4} className={`transition-transform duration-300 ${isSpeedOpen ? 'rotate-180' : 'opacity-40'}`} />
           </button>
          <AnimatePresence>
            {isSpeedOpen && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white border border-slate-100/80 rounded-2xl shadow-[0_12px_30px_rgba(0,0,0,0.12)] p-3 w-56 overflow-hidden z-[70] flex flex-col gap-2.5`}
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Play Speed</span>
                  {timeSyncEnabled && (
                    <span className="text-[8px] bg-green-50 text-green-600 font-bold px-1.5 py-0.5 rounded-md animate-pulse">Sync Active</span>
                  )}
                </div>

                {/* Speed Multipliers */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[8px] font-bold text-slate-400">Normal Speed</span>
                  <div className="grid grid-cols-4 gap-1">
                    {[1, 2, 3, 4].map(s => (
                      <button 
                        key={s}
                        onClick={() => handleSelectNormalSpeed(s)}
                        className={`py-1.5 text-[9px] font-black rounded-lg transition-all ${(!timeSyncEnabled && simSpeed === s) ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 bg-slate-50/50 hover:text-slate-900 font-bold'}`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-slate-100/60" />

                {/* Time Sync Toggle */}
                {/* Time Sync Toggle */}
                <div className={`flex items-center justify-between ${subscriptionPlan === 'basic' ? 'bg-slate-50/50 p-1.5 rounded-xl border border-slate-100/50' : ''}`}>
                  <div className="flex flex-col text-left">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] font-extrabold ${subscriptionPlan === 'basic' ? 'text-slate-400' : 'text-slate-800'} flex items-center gap-1`}>
                        {subscriptionPlan === 'basic' && <Lock size={9} className="text-slate-400 stroke-[2.5]" />}
                        Time Sync
                      </span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSyncInfoModal(true);
                        }}
                        className="text-slate-400 hover:text-indigo-600 transition-colors p-0.5 rounded hover:bg-slate-50 flex items-center justify-center"
                        title="What is Time Sync?"
                      >
                        <Info size={10} className="stroke-[2.5]" />
                      </button>
                    </div>
                    <span className="text-[7px] text-slate-400 font-medium">Progresses in real-time</span>
                  </div>
                  <button
                    onClick={handleToggleTimeSync}
                    className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-200 outline-none ${timeSyncEnabled ? 'bg-indigo-600' : 'bg-slate-200'} ${subscriptionPlan === 'basic' ? 'cursor-not-allowed bg-slate-200/85 saturate-50' : ''}`}
                  >
                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 ${timeSyncEnabled ? 'translate-x-4' : 'translate-x-[2px]'}`} />
                  </button>
                </div>

                {/* Collapsible Time Sync Options */}
                {timeSyncEnabled && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-50 overflow-hidden text-left"
                  >
                    <span className="text-[8px] font-bold text-slate-400">Time Sync Rate</span>
                    <div className="flex flex-col gap-1 max-h-[115px] overflow-y-auto pr-0.5 scrollbar-thin">
                      {timeSyncOptions.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => handleSelectTimeSyncSpeed(opt.value)}
                          className={`w-full text-left px-1.5 py-1 text-[8px] font-bold rounded-md transition-all flex items-center justify-between ${activeTimeSyncSpeed === opt.value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          <span>{opt.label}</span>
                          {activeTimeSyncSpeed === opt.value && <div className="w-1 h-1 rounded-full bg-indigo-600" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="h-8 w-px bg-slate-100 mx-1"></div>

      <button 
        onClick={() => {
          if (isReplayMode) {
            exitReplay();
          } else {
            setIsSimulating(false);
            setSimIsPlaying(false);
          }
        }}
        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
        title={isReplayMode ? "Exit Replay" : "Exit Backtest"}
      >
        <X size={18} />
      </button>

      {futureFetchError && (
        <>
          <div className={`${isMobile ? 'h-4' : 'h-7'} w-px bg-slate-100 mx-0.5 md:h-[4.5vh]`}></div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-50 text-red-600 rounded-xl border border-red-100/50">
            <CircleAlert size={isMobile ? 12 : 14} className="animate-pulse flex-shrink-0 text-red-500" />
            {!isMobile && (
              <span className="text-[10px] font-black tracking-wider uppercase">
                LOAD_FAIL
              </span>
            )}
            <button
              onClick={() => {
                onRetryFutureFetch();
              }}
              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all animate-pulse shadow-sm shadow-red-600/20 cursor-pointer"
            >
              Retry
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
});

const SidebarSessionDetails = memo(({ 
  selectedSymbol, 
  activePrefix, 
  backtestSessions, 
  filteredMergedTrades, 
  historyCategory, 
  simCurrentTime 
}: any) => {
  const sessionKey = activePrefix ? `${selectedSymbol}_${activePrefix}` : (selectedSymbol || '');
  const session = backtestSessions[sessionKey];
  
  const stats = useMemo(() => {
    const cat = (historyCategory || 'All').trim().toUpperCase();
    const trades = (filteredMergedTrades || []).filter((t: any) => {
      if (cat === 'ALL') return true;
      return (t.setupGrade || '').trim().toUpperCase() === cat;
    });
    const totalRR = trades.reduce((sum: number, t: any) => sum + (isFinite(t.rr) ? t.rr : 0), 0);
    return { trades, totalRR };
  }, [filteredMergedTrades, historyCategory]);

  const chartData = useMemo(() => {
    const trades = (filteredMergedTrades || [])
      .filter((t: any) => {
        const cat = (historyCategory || 'All').trim().toUpperCase();
        const matchesCat = (cat === 'ALL' || (t.setupGrade || '').trim().toUpperCase() === cat);
        return matchesCat && isFinite(t.exitTime) && t.exitTime > 0;
      })
      .sort((a: any, b: any) => a.exitTime - b.exitTime);

    let startTime = session ? session.startTime / 1000 : (trades.length > 0 ? Math.min(...trades.map((t: any) => t.entryTime)) : (simCurrentTime || Date.now()/1000) - 86400);
    if (trades.length > 0) startTime = Math.min(startTime, ...trades.map((t: any) => t.entryTime));

    const data = [{ time: startTime, rr: 0 }];
    let cumulativeRR = 0;
    trades.forEach((t: any) => {
      if (t.exitTime >= startTime) {
        cumulativeRR += (isFinite(t.rr) ? t.rr : 0);
        data.push({ time: t.exitTime, rr: parseFloat(cumulativeRR.toFixed(2)) });
      }
    });

    const currentTime = simCurrentTime || session?.currentTime || Date.now()/1000;
    if (data.length > 0 && currentTime > data[data.length - 1].time) {
      data.push({ time: currentTime, rr: cumulativeRR });
    }
    return data;
  }, [filteredMergedTrades, historyCategory, session, simCurrentTime]);

  return (
    <div className="flex flex-col p-5 gap-6">
      <div className="bg-slate-50/50 rounded-3xl p-5 border border-slate-100/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Net Performance</h3>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className={`text-2xl font-black tracking-tighter ${stats.totalRR >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {stats.totalRR >= 0 ? '+' : ''}{stats.totalRR.toFixed(2)}
              </span>
              <span className="text-[10px] font-black text-slate-400 uppercase">RR</span>
            </div>
          </div>
          <div className="text-right">
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Status</h4>
            <div className="mt-1.5 flex items-center justify-end gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-slate-900 uppercase">Synced</span>
            </div>
          </div>
        </div>

        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="sidebarChartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis hide dataKey="time" type="number" domain={['dataMin', 'dataMax']} />
              <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
              <Area 
                type="monotone" 
                dataKey="rr" 
                stroke="#6366f1" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#sidebarChartGradient)" 
                animationDuration={800}
                baseValue={0}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
});

const getStreakBadgeInfo = (target: number) => {
  switch (target) {
    case 10:
      return {
        id: 'streak_10',
        title: 'Dedication I',
        subtitle: '10 Day Streak',
        description: 'Maintained a 10-day active backtesting login streak',
        target: 10,
        colorClass: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        glowColor: 'shadow-amber-500/50'
      };
    case 50:
      return {
        id: 'streak_50',
        title: 'Discipline II',
        subtitle: '50 Day Streak',
        description: 'Maintained a 50-day active backtesting login streak',
        target: 50,
        colorClass: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
        glowColor: 'shadow-orange-500/50'
      };
    case 100:
      return {
        id: 'streak_100',
        title: 'Consistency III',
        subtitle: '100 Day Streak',
        description: 'Maintained a 100-day active backtesting login streak',
        target: 100,
        colorClass: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
        glowColor: 'shadow-rose-500/50'
      };
    case 365:
      return {
        id: 'streak_365',
        title: 'Maturity IV',
        subtitle: '365 Day Streak',
        description: 'Maintained a 365-day active backtesting login streak',
        target: 365,
        colorClass: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
        glowColor: 'shadow-violet-500/50'
      };
    default:
      return {
        id: `streak_${target}`,
        title: 'Champion Active Badge',
        subtitle: `${target} Day Streak`,
        description: 'Spectacular active day streak milestone achieved!',
        target,
        colorClass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        glowColor: 'shadow-emerald-500/50'
      };
  }
};

// Update the export of App or the main component as well
export default function App() {
  const adsenseClient = (import.meta as any).env?.VITE_ADSENSE_CLIENT || '';
  const adsenseSlot = (import.meta as any).env?.VITE_ADSENSE_SLOT || '';
  const [session, setSession] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [params, setParams] = useState<StrategyParams>({});
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [subscriptionBackTarget, setSubscriptionBackTarget] = useState<'profile' | 'watchlist' | 'chart-room'>('profile');
  const [savedSymbolBeforeSubscription, setSavedSymbolBeforeSubscription] = useState<string | null>(null);

  // Path-based informational routes (/about, /contact, /privacy-policy, /terms)
  const [currentUrlPath, setCurrentUrlPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return '/';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleLocationChange = () => {
      setCurrentUrlPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    
    const originalPushState = window.history.pushState;
    window.history.pushState = function(...args) {
      originalPushState.apply(this, args);
      handleLocationChange();
    };
    
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.history.pushState = originalPushState;
    };
  }, []);
  
  // PWA states and hooks detection
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [showPwaInstallGuide, setShowPwaInstallGuide] = useState<'safari' | 'general' | null>(null);

  const isSafari = useMemo(() => {
    if (typeof window === 'undefined' || !navigator) return false;
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(ua);
    return isSafariBrowser || isIOS;
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                           (navigator as any).standaloneDirect || 
                           (navigator as any).standalone;
      setIsPwaInstalled(!!isStandalone);
    }
  }, []);

  useEffect(() => {
    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const handleAppInstalled = () => {
      setIsPwaInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallPwa = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          setIsPwaInstalled(true);
        }
        setDeferredPrompt(null);
      });
    } else if (isSafari) {
      setShowPwaInstallGuide(prev => prev === 'safari' ? null : 'safari');
    } else {
      setShowPwaInstallGuide(prev => prev === 'general' ? null : 'general');
    }
  };

  const isPwaSupported = useMemo(() => {
    if (typeof window === 'undefined') return false;
    // Hide if inside an iframe (such as sandboxed AI Studio space)
    if (window.self !== window.top) return false;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const hasPromptSupport = 'beforeinstallprompt' in window || 'BeforeInstallPromptEvent' in window;
    return isIOS || hasPromptSupport;
  }, []);

  const shouldShowInstallButton = !isPwaInstalled && isPwaSupported;

  
  const [streakCount, setStreakCount] = useState<number>(0);
  const [longestStreak, setLongestStreak] = useState<number>(0);
  const [lastLoginDate, setLastLoginDate] = useState<string>('');

  const [activeEarnedBadge, setActiveEarnedBadge] = useState<any | null>(null);
  const [showTrustpilotPrompt, setShowTrustpilotPrompt] = useState<boolean>(false);
  const [tpRating, setTpRating] = useState<number>(0);
  const [tpHoveredRating, setTpHoveredRating] = useState<number>(0);
  const [tpFeedback, setTpFeedback] = useState<string>('');

  const triggerSimulationOfBadge = (target: number) => {
    // Reset rating states for the test modal so it starts fresh
    setTpRating(0);
    setTpHoveredRating(0);
    setTpFeedback('');
    
    const badgeDetails = getStreakBadgeInfo(target);
    setActiveEarnedBadge(badgeDetails);
  };

  const fetchUserSetups = async () => {
    if (!session?.user?.id) return;
    try {
      const data = await persistenceService.getSetups(session.user.id);
      setSetups(data || []);
    } catch (err) {
      console.error('Failed to fetch setups:', err);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetchUserSetups();
    }
  }, [session?.user?.id]);

  useEffect(() => {
    // No longer using localStorage for selectedSymbol, will sync via preferences
  }, [selectedSymbol]);

  const [historicalData, _setHistoricalData] = useState<Candle[]>([]);
  const setHistoricalData = (update: Candle[] | ((prev: Candle[]) => Candle[])) => {
    _setHistoricalData(prev => {
      const raw = typeof update === 'function' ? update(prev) : update;
      const uniqueMap = new Map<number, Candle>();
      for (const candle of raw) {
        if (candle && typeof candle.time === 'number') {
          uniqueMap.set(candle.time, candle);
        }
      }
      return Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
    });
  };
  const pendingViewportRef = useRef<{ zoom: number, focalTime: number | null, isReplayMode: boolean } | null>(null);
  const [isLoadingPast, setIsLoadingPast] = useState(false);
  const [isLoadingMorePast, setIsLoadingMorePast] = useState(false);
  const [isLoadingMoreFuture, setIsLoadingMoreFuture] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(false);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const desktopMenuPopupRef = useRef<HTMLDivElement>(null);
  const timeframePopupRef = useRef<HTMLDivElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedNewsGroup, setSelectedNewsGroup] = useState<{ newsItems: any[]; isFuture: boolean } | null>(null);
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [triggerSetupDrawing, setTriggerSetupDrawing] = useState<Drawing | null>(null);
  const [setups, setSetups] = useState<any[]>([]);
  const [pinnedText, setPinnedText] = useState<string | null>(null);
  const [settingIndicator, setSettingIndicator] = useState<IndicatorInstance | null>(null);
  const [historyCategory, setHistoryCategory] = useState<string>('All');
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window !== 'undefined') {
      const isMobileDevice = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      if (isMobileDevice && window.screen) {
        return window.screen.height > window.screen.width;
      }
      return window.innerHeight > window.innerWidth;
    }
    return true;
  });
  const isMobileLandscape = isMobile && !isPortrait;

  const currentMode = useMemo(() => {
    if (!isMobile) return 'desktop';
    return isPortrait ? 'mobilePortrait' : 'mobileLandscape';
  }, [isMobile, isPortrait]);

  const [activeTabsByMode, setActiveTabsByMode] = useState<Record<string, string>>({
    desktop: 'chart',
    mobilePortrait: 'chart',
    mobileLandscape: 'chart'
  });
  const activeTab = activeTabsByMode[currentMode];
  const setActiveTab = (tab: any) => setActiveTabsByMode(prev => ({
    ...prev,
    [currentMode]: tab,
    ...(currentMode === 'mobilePortrait' || currentMode === 'mobileLandscape' ? {
      mobilePortrait: tab,
      mobileLandscape: tab
    } : {})
  }));
  const [selectedTimeframesByMode, setSelectedTimeframesByMode] = useState<Record<string, any>>({
    desktop: TIMEFRAMES[6],
    mobilePortrait: TIMEFRAMES[6],
    mobileLandscape: TIMEFRAMES[6]
  });
  const selectedTimeframe = selectedTimeframesByMode[currentMode];
  
  const setSelectedTimeframeRef = useRef<any>(null);
  const setSelectedTimeframe = useCallback((tf: any) => {
    if (setSelectedTimeframeRef.current) {
      setSelectedTimeframeRef.current(tf);
    } else {
      setSelectedTimeframesByMode(prev => ({
        ...prev,
        [currentMode]: tf,
        ...(currentMode === 'mobilePortrait' || currentMode === 'mobileLandscape' ? {
          mobilePortrait: tf,
          mobileLandscape: tf
        } : {})
      }));
    }
  }, [currentMode]);

  const [activeWatchlistCategoriesByMode, setActiveWatchlistCategoriesByMode] = useState<Record<string, string>>({
    desktop: 'Crypto',
    mobilePortrait: 'Crypto',
    mobileLandscape: 'Crypto'
  });
  const activeWatchlistCategory = activeWatchlistCategoriesByMode[currentMode];
  const setActiveWatchlistCategory = (cat: string) => 
    setActiveWatchlistCategoriesByMode(prev => ({
      ...prev,
      [currentMode]: cat,
      ...(currentMode === 'mobilePortrait' || currentMode === 'mobileLandscape' ? {
        mobilePortrait: cat,
        mobileLandscape: cat
      } : {})
    }));
  const [isTimeframeOpen, setIsTimeframeOpen] = useState(false);
  const [isSpeedOpen, setIsSpeedOpen] = useState(false);
  const [showSyncInfoModal, setShowSyncInfoModal] = useState(false);
  const timeframeRef = useRef<HTMLDivElement>(null);
  const backtestTimeframeRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (timeframeRef.current && !timeframeRef.current.contains(target) && (!timeframePopupRef.current || !timeframePopupRef.current.contains(target))) {
        setIsTimeframeOpen(false);
      }
      if (backtestTimeframeRef.current && !backtestTimeframeRef.current.contains(target)) {
        setIsTimeframeOpen(false);
      }
      if (speedRef.current && !speedRef.current.contains(target)) {
        setIsSpeedOpen(false);
      }
      if (desktopMenuRef.current && !desktopMenuRef.current.contains(target) && (!desktopMenuPopupRef.current || !desktopMenuPopupRef.current.contains(target))) {
        setIsDesktopMenuOpen(false);
      }
    };
    if (isTimeframeOpen || isSpeedOpen || isDesktopMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTimeframeOpen, isSpeedOpen, isDesktopMenuOpen]);

  const [theme, setTheme] = useState<ChartTheme>(DEFAULT_THEME);
  const [activeDrawingToolsByMode, setActiveDrawingToolsByMode] = useState<Record<string, DrawingType | null>>({
    desktop: null,
    mobilePortrait: null,
    mobileLandscape: null
  });
  const activeDrawingTool = activeDrawingToolsByMode[currentMode];
  const setActiveDrawingTool = (tool: DrawingType | null) => 
    setActiveDrawingToolsByMode(prev => ({
      ...prev,
      [currentMode]: tool,
      ...(currentMode === 'mobilePortrait' || currentMode === 'mobileLandscape' ? {
        mobilePortrait: tool,
        mobileLandscape: tool
      } : {})
    }));

  useEffect(() => {
    try {
      const saved = localStorage.getItem('modeSpecificDrawingTools');
      if (saved) {
        setActiveDrawingToolsByMode(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load drawing tools state');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('modeSpecificDrawingTools', JSON.stringify(activeDrawingToolsByMode));
  }, [activeDrawingToolsByMode]);

  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [selectedDrawing, setSelectedDrawing] = useState<Drawing | null>(null);
  const [favorites, setFavorites] = useState<DrawingType[]>([]);

  useEffect(() => {
    // Hide splash screen when App is ready
    const timer = setTimeout(() => {
      document.body.classList.add('loaded');
    }, 1200); // Slightly longer for a premium feel
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const isMobileDevice = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      setIsMobile(window.innerWidth < 1024);
      if (isMobileDevice && window.screen) {
        setIsPortrait(window.screen.height > window.screen.width);
      } else {
        const activeEl = document.activeElement;
        const isTyping = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.tagName === 'SELECT' ||
          activeEl.hasAttribute('contenteditable')
        );
        if (!isTyping) {
          setIsPortrait(window.innerHeight > window.innerWidth);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showFavoritesByMode: Record<string, boolean> = {
    desktop: true,
    mobilePortrait: true,
    mobileLandscape: true
  };
  const setShowFavoritesByMode = (val: any) => {};

  const [showToolbarByMode, setShowToolbarByMode] = useState<Record<string, boolean>>({
    desktop: true,
    mobilePortrait: true,
    mobileLandscape: true
  });


  const showFavorites = true;
  const setShowFavorites = (val: boolean) => {};
  
  const showDrawingToolbar = showToolbarByMode[currentMode];
  const setShowDrawingToolbar = (val: boolean) => setShowToolbarByMode(prev => ({
    ...prev,
    [currentMode]: val,
    ...(currentMode === 'mobilePortrait' || currentMode === 'mobileLandscape' ? {
      mobilePortrait: val,
      mobileLandscape: val
    } : {})
  }));
  const [drawingSettings, setDrawingSettings] = useState<any>(null);
  const [indicators, setIndicators] = useState<IndicatorInstance[]>([]);
  const [journalTabsByMode, setJournalTabsByMode] = useState<Record<string, 'ongoing' | 'completed'>>({
    desktop: 'ongoing',
    mobilePortrait: 'ongoing',
    mobileLandscape: 'ongoing'
  });
  const journalTab = journalTabsByMode[currentMode];
  const setJournalTab = (tab: 'ongoing' | 'completed') => 
    setJournalTabsByMode(prev => ({
      ...prev,
      [currentMode]: tab,
      ...(currentMode === 'mobilePortrait' || currentMode === 'mobileLandscape' ? {
        mobilePortrait: tab,
        mobileLandscape: tab
      } : {})
    }));

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const watchlistRef = useRef<WatchlistItem[]>([]);
  useEffect(() => {
    watchlistRef.current = watchlist;
  }, [watchlist]);
  const [isWatchlistLoading, setIsWatchlistLoading] = useState(true);
  const [isDataInitialized, setIsDataInitialized] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([]);
  const [sessionConflict, setSessionConflict] = useState(false);
  const [mySessionId] = useState(() => Math.random().toString(36).substring(2) + Date.now().toString(36));
  const chartEngineRef = useRef<any>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const addNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    setNotifications(prev => [...prev, { id, message, type }]);
    const duration = type === 'success' ? 2000 : 4000;
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
  }, []);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [rateLimitError, setRateLimitError] = useState(false);

  const [backtestSessions, rawSetBacktestSessions] = useState<Record<string, BacktestSession>>({});
  const setBacktestSessions = useCallback((updater: any) => {
    rawSetBacktestSessions(prev => {
      let next = typeof updater === 'function' ? updater(prev) : updater;
      if (!next) return prev;
      const updated = { ...next };
      watchlistRef.current.forEach(item => {
        if (!item.id) return;
        const fallbackKey = item.prefix ? `${item.symbol}_${item.prefix}` : item.symbol;
        
        const hasId = !!updated[item.id];
        const hasFallback = !!updated[fallbackKey];
        
        if (hasId) {
          updated[fallbackKey] = {
            ...updated[item.id],
            prefix: item.prefix || undefined,
            symbol: item.symbol
          };
        } else if (hasFallback) {
          updated[item.id] = {
            ...updated[fallbackKey],
            prefix: item.prefix || undefined,
            symbol: item.symbol
          };
        }
      });
      return updated;
    });
  }, []);
  const [journalTrades, setJournalTrades] = useState<JournalTrade[]>([]);
  const [showBacktestSetup, setShowBacktestSetup] = useState<{ symbol: string, source?: string, marketType?: MarketType } | null>(null);
  const [isNewsStreamEnabled, setIsNewsStreamEnabled] = useState(true);
  const [selectedBrokerSpread, setSelectedBrokerSpread] = useState('standard');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simIsPlaying, setSimIsPlaying] = useState(false);
  const [futureFetchError, setFutureFetchError] = useState<string | null>(null);
  const [activePrefix, setActivePrefix] = useState<string | null>(null);
  const [activeWatchlistItemId, setActiveWatchlistItemId] = useState<string | null>(null);

  const getFilteredTrades = useCallback(() => {
    if (!selectedSymbol) return [];
    
    // Normalize comparison targets
    const currentSymbolNorm = normalizeSymbol(selectedSymbol);
    const currentPrefixNorm = activePrefix?.trim().toUpperCase() || null;
    
    return (journalTrades || []).filter(t => {
      // 1. Instance ID check (Highest Priority)
      // This links specific trades to specific watchlist item instances, handling renames.
      if (activeWatchlistItemId && t.watchlistId === activeWatchlistItemId) {
        return true;
      }
      
      // 2. Strict ID exclusion
      // If we are looking at a specific watchlist item, and the trade belongs to a DIFFERENT item,
      // we must exclude it even if labels match (to prevent cross-item pollution).
      if (activeWatchlistItemId && t.watchlistId && t.watchlistId !== activeWatchlistItemId) {
        return false;
      }

      // 3. Fallback: Symbol + Prefix name matching (Legacy or generic search results)
      const tradeSymbolNorm = normalizeSymbol(t.symbol);
      if (tradeSymbolNorm !== currentSymbolNorm) return false;
      
      const tradePrefixNorm = t.prefix?.trim().toUpperCase() || null;
      if (tradePrefixNorm !== currentPrefixNorm) return false;
      
      return true;
    });
  }, [journalTrades, selectedSymbol, activePrefix, activeWatchlistItemId]);

  useEffect(() => {
    setShowSetupDetails(false);
  }, [historyCategory]);

  const mergedTrades = useMemo(() => {
    // 1. Get all journaled trades
    const journaled = [...(journalTrades || [])].map(t => {
      const isCommEnabled = theme.commissionEnabled !== false;
      const grossRr = (t as any).grossRr !== undefined ? (t as any).grossRr : t.rr;
      const commission = isCommEnabled ? parseFloat((0.05 * Math.abs(grossRr)).toFixed(3)) : 0;
      const netRr = parseFloat((grossRr - commission).toFixed(2));
      return {
        ...t,
        rr: isCommEnabled ? netRr : grossRr,
        grossRr,
        commission,
        netRr
      };
    });
    
    // 2. Get all closed/completed drawings that aren't yet in journalTrades
    const journaledDrawingIds = new Set(journaled.filter(t => t.drawingId).map(t => t.drawingId));
    
    const unjournaled = drawings.filter(d => {
      // Must be a position tool
      if (d.type !== DrawingType.LONG_POSITION && d.type !== DrawingType.SHORT_POSITION) return false;
      // Must be closed (won or lost)
      if (d.status !== 'won' && d.status !== 'lost') return false;
      // Must not be already journaled
      return !journaledDrawingIds.has(d.id);
    }).map(d => {
      // Extract data from drawing
      const tradeInfo = d.settings?.tradeInfo;
      const entryPrice = tradeInfo?.entryPrice || d.points[0].price;
      const exitPrice = tradeInfo?.exitPrice || (d.status === 'won' ? (d.settings?.tpPrice || d.points[1].price) : (d.settings?.slPrice || (d.points[2]?.price ?? d.points[1].price)));
      
      const exitTime = tradeInfo?.exitTime || d.statusAt || d.points[1].time;
      const rawRr = tradeInfo?.rr !== undefined ? tradeInfo.rr : (d.settings?.rr || 0);
      const status = tradeInfo?.status || (d.status === 'won' ? 'TP' : 'SL');
      let grossRr = 0;
      if (tradeInfo?.rr !== undefined) {
        grossRr = tradeInfo.rr;
      } else {
        const isLong = d.type === DrawingType.LONG_POSITION;
        const initialStopValue = d.initialStopPrice !== undefined ? d.initialStopPrice : (d.points[2]?.price ?? entryPrice);
        const initialRisk = Math.abs(entryPrice - initialStopValue) || 0.00000001;
        const diff = isLong ? (exitPrice - entryPrice) : (entryPrice - exitPrice);
        grossRr = diff / initialRisk;
      }
      
      const isCommEnabled = theme.commissionEnabled !== false;
      const commission = isCommEnabled ? parseFloat((0.05 * Math.abs(grossRr)).toFixed(3)) : 0;
      const netRr = parseFloat((grossRr - commission).toFixed(2));
      
      return {
        id: `drawing_${d.id}`,
        symbol: d.symbol || selectedSymbol || '',
        prefix: d.prefix || activePrefix || undefined,
        watchlistId: d.watchlistId || activeWatchlistItemId || undefined,
        type: d.type === DrawingType.LONG_POSITION ? 'LONG' : 'SHORT',
        entryTime: tradeInfo?.entryTime || d.triggeredAt || d.points[0].time,
        exitTime: exitTime,
        entryPrice: entryPrice,
        exitPrice: exitPrice,
        rr: isCommEnabled ? netRr : grossRr,
        grossRr,
        commission,
        netRr,
        status: status,
        setupGrade: tradeInfo?.setupGrade || d.settings?.setupGrade,
        notes: tradeInfo?.notes || d.settings?.notes,
        drawingId: d.id,
        pips: tradeInfo?.pips || calculatePips(d.symbol || selectedSymbol || '', entryPrice, exitPrice),
        timeframe: tradeInfo?.timeframe || d.settings?.timeframe || selectedTimeframe.label,
        duration: tradeInfo?.duration || '0m',
        realizedAt: tradeInfo?.realizedAt || d.settings?.realizedAt || new Date().toISOString(),
        isFromDrawing: true
      } as JournalTrade;
    });
    
    return [...journaled, ...unjournaled].sort((a, b) => b.exitTime - a.exitTime);
  }, [journalTrades, drawings, selectedSymbol, activePrefix, activeWatchlistItemId, selectedTimeframe, theme.commissionEnabled]);

  const filteredMergedTrades = useMemo(() => {
    if (!selectedSymbol) return [];
    const currentSymbolNorm = normalizeSymbol(selectedSymbol);
    const currentPrefixNorm = activePrefix?.trim().toUpperCase() || null;
    
    return (mergedTrades || []).filter(t => {
      // 1. Instance ID check (Highest Priority)
      if (activeWatchlistItemId && t.watchlistId === activeWatchlistItemId) return true;
      
      // 2. Strict ID exclusion
      if (activeWatchlistItemId && t.watchlistId && t.watchlistId !== activeWatchlistItemId) return false;
      
      // 3. Fallback: Symbol + Prefix
      const tradeSymbolNorm = normalizeSymbol(t.symbol);
      if (tradeSymbolNorm !== currentSymbolNorm) return false;
      
      const tradePrefixNorm = t.prefix?.trim().toUpperCase() || null;
      if (tradePrefixNorm !== currentPrefixNorm) return false;
      
      return true;
    });
  }, [mergedTrades, selectedSymbol, activePrefix, activeWatchlistItemId]);

  const availableSetups = useMemo(() => {
    // We use both journal trades and defined setups to populate the category filters
    const tradeGrades = (mergedTrades || []).map(t => (t.setupGrade || '').trim().toUpperCase()).filter(Boolean);
    const definedGrades = (setups || []).map(s => (s.grade || '').trim().toUpperCase()).filter(Boolean);
    const categories = Array.from(new Set([...tradeGrades, ...definedGrades])) as string[];
    return ['All', ...categories.sort()];
  }, [mergedTrades, setups]);

  // Reset category filter when symbol or prefix changes to avoid showing empty results
  useEffect(() => {
    setHistoryCategory('All');
  }, [selectedSymbol, activePrefix]);
  const [sidebarTab, setSidebarTab] = useState<'stats' | 'trades'>('stats');
  const [showSetupDetails, setShowSetupDetails] = useState(false);
  const [tradeMenuId, setTradeMenuId] = useState<string | null>(null);
  const [viewingTradeDetails, setViewingTradeDetails] = useState<JournalTrade | null>(null);
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState<'basic' | 'plus' | 'premium'>('basic');
  const activeTheme = useMemo(() => {
    return subscriptionPlan === 'basic' ? { ...theme, rawSpread: false } : theme;
  }, [theme, subscriptionPlan]);
  const [isCompetitionsPopupOpen, setIsCompetitionsPopupOpen] = useState(false);
  const [hasAppliedForCompetition, setHasAppliedForCompetition] = useState(() => {
    return localStorage.getItem('has_applied_competitions') === 'true';
  });
  const [premiumPlusCount, setPremiumPlusCount] = useState(0);
  const [competitionsCount, setCompetitionsCount] = useState(0);
  interface CompetitionCandidate {
    id: string;
    username: string;
    plan: string;
    country: string;
  }
   const [competitionCandidates, setCompetitionCandidates] = useState<CompetitionCandidate[]>([]);
  const [premiumPlusUsers, setPremiumPlusUsers] = useState<CompetitionCandidate[]>([]);

  useEffect(() => {
    const fetchCompetitionsStatus = async () => {
      try {
        const userId = session?.user?.id || '';
        const url = userId ? `/api/competitions/status?userId=${encodeURIComponent(userId)}` : '/api/competitions/status';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setPremiumPlusCount(data.premiumPlusCount || 0);
          setCompetitionsCount(data.competitionsCount || 0);
          if (data.candidates && Array.isArray(data.candidates)) {
            setCompetitionCandidates(data.candidates);
          }
          if (data.premiumPlusUsers && Array.isArray(data.premiumPlusUsers)) {
            setPremiumPlusUsers(data.premiumPlusUsers);
          }
          if (typeof data.hasApplied === 'boolean') {
            setHasAppliedForCompetition(data.hasApplied);
            if (data.hasApplied) {
              localStorage.setItem('has_applied_competitions', 'true');
            } else {
              localStorage.removeItem('has_applied_competitions');
            }
          }
        }
      } catch (err) {
        console.warn('[Competitions Status] Could not fetch real-time stats:', err);
      }
    };
    fetchCompetitionsStatus();
  }, [session, isCompetitionsPopupOpen]);
  const [exploreSponsorAd, setExploreSponsorAd] = useState<{
    sponsor: string;
    tagline: string;
    category: string;
    incentive: string;
    cta: string;
    logoType: string;
    link: string;
  } | null>(null);

  useEffect(() => {
    if (showBacktestSetup && subscriptionPlan === 'basic') {
      const getAd = async () => {
        const fallbacks = [
          {
            sponsor: "Exness Broker",
            tagline: "Unbeatable spreads under 0.1 pips with raw liquidity.",
            category: "Trusted Broker",
            incentive: "Spreads from 0.0 pips",
            cta: "Trade Raw",
            logoType: "broker",
            link: "https://www.exness.com"
          },
          {
            sponsor: "FTMO Challenges",
            tagline: "The leading prop platform. Keep up to 90% profit split.",
            category: "Prop Funding",
            incentive: "90% Profit Split",
            cta: "Get Funded",
            logoType: "prop",
            link: "https://ftmo.com"
          },
          {
            sponsor: "PineServer VPS",
            tagline: "Ultra-low latency VPS hosting next to Equinix matches.",
            category: "Low-Latency VPS",
            incentive: "99.99% Guaranteed Host",
            cta: "Deploy Node",
            logoType: "vps",
            link: "https://www.pepperstone.com"
          },
          {
            sponsor: "Alpha Core Insights",
            tagline: "Exclusive daily market order flow and smart-money concepts.",
            category: "Premium Insights",
            incentive: "Curated Daily Briefings",
            cta: "Read Digest",
            logoType: "insight",
            link: "https://www.interactivebrokers.com"
          }
        ];
        
        try {
          const res = await fetch('/api/sponsor-ad');
          if (res.ok) {
            const ct = res.headers.get('content-type');
            if (ct && ct.includes('application/json')) {
              const data = await res.json();
              if (data && data.sponsor) {
                setExploreSponsorAd(data);
                return;
              }
            }
          }
        } catch (e) {
          console.warn('[ExploreSponsorAd] could not fetch live:', e);
        }
        
        const randomFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        setExploreSponsorAd(randomFallback);
      };
      getAd();
    } else {
      setExploreSponsorAd(null);
    }
  }, [showBacktestSetup, subscriptionPlan]);
  const [replayCurrentTime, setReplayCurrentTime] = useState<number | null>(null);
  const [replayTrade, setReplayTrade] = useState<JournalTrade | null>(null);
  const [replayIsPlaying, setReplayIsPlaying] = useState(false);
  
  const [preReplayDrawings, setPreReplayDrawings] = useState<any[] | null>(null);
  
  // Synced Chart Comparison States
  const [isSyncedSelectorOpen, setIsSyncedSelectorOpen] = useState(false);
  const [syncedSymbol, setSyncedSymbol] = useState<string | null>(null);
  const [syncedDataSource, setSyncedDataSource] = useState<string | null>(null);
  const [syncedMarketType, setSyncedMarketType] = useState<MarketType | null>(null);
  const [syncedData, setSyncedData] = useState<Candle[]>([]);
  const [isSyncedLoading, setIsSyncedLoading] = useState(false);
  const syncedChartEngineRef = useRef<any>(null);
  const isSyncingRef = useRef(false);
  
  // Synced Timeframe, Indicators, Drawing states
  const [isChartsFlipped, setIsChartsFlipped] = useState(false);
  const [syncedTimeframeState, setSyncedTimeframeState] = useState<typeof TIMEFRAMES[0] | null>(null);

  // Feature locking & subscription upgrades modal states
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeModalFeature, setUpgradeModalFeature] = useState<'replay' | 'sync' | 'competition' | 'timesync' | 'script' | 'watchlist' | 'news' | 'spread'>('replay');

  // Pair limits tracking (Replay max 2, Synced view max 1, Trade execution max 3)
  const [pairUsageLimits, setPairUsageLimits] = useState<Record<string, { replays: number; syncedCharts: number; trades: number; tradesResetAt?: number }>>(() => {
    try {
      const saved = localStorage.getItem('firstlook_pair_usage_limits');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [isAdsLimitModalOpen, setIsAdsLimitModalOpen] = useState(false);
  const [adsLimitFeature, setAdsLimitModalFeature] = useState<'replay' | 'sync' | 'trades' | null>(null);
  
  // Video AD player overlay states
  const [isVideoAdPlaying, setIsVideoAdPlaying] = useState(false);
  const [videoAdTimer, setVideoAdTimer] = useState(10);
  const [videoAdMuted, setVideoAdMuted] = useState(false);

  const updatePairLimit = useCallback((pairKey: string, updates: Partial<{ replays: number; syncedCharts: number; trades: number; tradesResetAt?: number }>) => {
    setPairUsageLimits(prev => {
      const current = prev[pairKey] || { replays: 0, syncedCharts: 0, trades: 0, tradesResetAt: 0 };
      const updated = {
        ...prev,
        [pairKey]: {
          ...current,
          ...updates
        }
      };
      localStorage.setItem('firstlook_pair_usage_limits', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Video AD countdown timer
  useEffect(() => {
    let interval: any = null;
    if (isVideoAdPlaying) {
      if (videoAdTimer > 0) {
        interval = setInterval(() => {
          setVideoAdTimer(prev => prev - 1);
        }, 1000);
      } else {
        // Auto-close and claim rewards ("timer it self it out")
        const pairKey = activeWatchlistItemId || (activePrefix ? `${selectedSymbol}_${activePrefix}` : selectedSymbol) || 'default';
        updatePairLimit(pairKey, { replays: 0, syncedCharts: 0, trades: 0, tradesResetAt: Date.now() });
        addNotification(`🎉 Watchlist pair limits successfully reset! Replays, Synced Views, and Trades are restored!`, 'success');
        setIsVideoAdPlaying(false);
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isVideoAdPlaying, videoAdTimer, activeWatchlistItemId, activePrefix, selectedSymbol, updatePairLimit, addNotification]);

  const syncedTimeframe = syncedTimeframeState || selectedTimeframe;
  const [renderedTimeframeId, setRenderedTimeframeId] = useState<string>(selectedTimeframe.id);
  const [renderedSyncedTimeframeId, setRenderedSyncedTimeframeId] = useState<string>('1h');

  // Backup sync effects
  useEffect(() => {
    if (loadedTimeframeRef.current) {
      setRenderedTimeframeId(loadedTimeframeRef.current);
    }
  }, [historicalData]);

  useEffect(() => {
    if (syncedData.length > 0 && syncedTimeframe) {
      setRenderedSyncedTimeframeId(syncedTimeframe.id);
    }
  }, [syncedData, syncedTimeframe]);

  const renderedTimeframe = TIMEFRAMES.find(t => t.id === renderedTimeframeId) || selectedTimeframe;
  const renderedSyncedTimeframe = TIMEFRAMES.find(t => t.id === renderedSyncedTimeframeId) || syncedTimeframe;

  const [syncedIndicatorsActive, setSyncedIndicatorsActive] = useState<string[]>([]);
  const [isSyncedCandleMenuOpen, setIsSyncedCandleMenuOpen] = useState(false);
  const [showSyncedFavorites, setShowSyncedFavorites] = useState(false);
  const [syncedFavoritesPos, setSyncedFavoritesPos] = useState({ x: 0, y: 0 });
  const [activeSyncedDrawingTool, setActiveSyncedDrawingTool] = useState<DrawingType | null>(null);
  const [selectedSyncedDrawing, setSelectedSyncedDrawing] = useState<Drawing | null>(null);
  
  const { currentSelectedDrawing, currentSelectedTrade } = useMemo(() => {
    if (!selectedDrawing) return { currentSelectedDrawing: null, currentSelectedTrade: null };
    const drawing = drawings.find(d => d.id === selectedDrawing.id) || selectedDrawing;
    const trade = mergedTrades.find(t => 
      t.drawingId === drawing.id || 
      (Math.abs(t.entryTime - (drawing.triggeredAt || drawing.points[0]?.time || 0)) < 60 && t.symbol === (selectedSymbol || drawing.symbol))
    );
    return { currentSelectedDrawing: drawing, currentSelectedTrade: trade };
  }, [drawings, selectedDrawing, mergedTrades, selectedSymbol]);

  const currentSessionKey = useMemo(() => {
    if (activeWatchlistItemId) return activeWatchlistItemId;
    if (!selectedSymbol) return null;
    return activePrefix ? `${selectedSymbol}_${activePrefix}` : selectedSymbol;
  }, [selectedSymbol, activePrefix, activeWatchlistItemId]);

  const activeWatchlistItem = useMemo(() => {
    return watchlist.find(i => i.id === activeWatchlistItemId);
  }, [watchlist, activeWatchlistItemId]);

  const backtestSessionsRef = useRef(backtestSessions);
  useEffect(() => {
    backtestSessionsRef.current = backtestSessions;
  }, [backtestSessions]);

  // Periodically update timeSyncLastTimestamp and watchlist stats for active Time Sync session
  useEffect(() => {
    if (!currentSessionKey) return;
    const interval = setInterval(() => {
      const sessionData = backtestSessionsRef.current[currentSessionKey];
      const hasTSAndPlaying = sessionData && sessionData.timeSyncEnabled && simIsPlaying;
      if (hasTSAndPlaying) {
        setBacktestSessions(prev => {
          const cur = prev[currentSessionKey];
          if (!cur || !cur.timeSyncEnabled) return prev;
          const updated = {
            ...prev,
            [currentSessionKey]: {
              ...cur,
              isPlaying: true,
              currentTime: simCurrentTimeRef.current || cur.currentTime,
              timeSyncLastTimestamp: Date.now()
            }
          };
          if (session?.user?.id) {
            persistenceService.saveBacktestSessions(session.user.id, updated).catch(() => {});
          }
          return updated;
        });

        setWatchlist(prev => {
          const targetItem = prev.find(item => {
            if (currentSessionKey && currentSessionKey.startsWith('wl_')) {
              return item.id === currentSessionKey;
            }
            return item.id === currentSessionKey || (item.symbol === selectedSymbol && (item.prefix || '') === (activePrefix || ''));
          });
          if (!targetItem) return prev;
          
          const updatedItem = {
            ...targetItem,
            timeSync: true,
            timeFrame: selectedTimeframe.id,
            timeSyncSpeed: sessionData.timeSyncSpeed || targetItem.timeSyncSpeed || 60,
            lastSimulationTime: simCurrentTimeRef.current || targetItem.lastSimulationTime,
            lastCandlePlayAt: Date.now()
          };

          const updatedWatchlist = prev.map(item => item.id === targetItem.id ? updatedItem : item);
          if (session?.user?.id) {
            persistenceService.saveWatchlist(session.user.id, updatedWatchlist).catch(() => {});
          }
          return updatedWatchlist;
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [currentSessionKey, simIsPlaying, session?.user?.id, selectedSymbol, activePrefix, selectedTimeframe]);

  // Synchronize simIsPlaying to backtestSession in real-time
  useEffect(() => {
    if (!currentSessionKey) return;
    setBacktestSessions(prev => {
      const cur = prev[currentSessionKey];
      if (!cur) return prev;
      if (cur.isPlaying === simIsPlaying) return prev;

      const updated = {
        ...prev,
        [currentSessionKey]: {
          ...cur,
          isPlaying: simIsPlaying,
          timeSyncLastTimestamp: (simIsPlaying && cur.timeSyncEnabled) ? Date.now() : cur.timeSyncLastTimestamp
        }
      };

      if (session?.user?.id) {
        persistenceService.saveBacktestSessions(session.user.id, updated).catch(() => {});
      }
      return updated;
    });
  }, [simIsPlaying, currentSessionKey, session?.user?.id]);

  // Synchronise Time Sync on tab/window focus
  useEffect(() => {
    const handleFocus = () => {
      if (!currentSessionKey) return;
      const sessionData = backtestSessionsRef.current[currentSessionKey];
      const matchingWatchlistItem = watchlistRef.current.find(item => {
        if (currentSessionKey && currentSessionKey.startsWith('wl_')) {
          return item.id === currentSessionKey;
        }
        return item.id === currentSessionKey || (item.symbol === selectedSymbolRef.current && (item.prefix || '') === (activePrefixRef.current || ''));
      });

      const isTSEnabled = sessionData?.timeSyncEnabled || matchingWatchlistItem?.timeSync;
      const lastPlayAt = sessionData?.timeSyncLastTimestamp || matchingWatchlistItem?.lastCandlePlayAt;
      const lastSimTime = sessionData?.currentTime || matchingWatchlistItem?.lastSimulationTime || sessionData?.startTime;
      const speedRate = sessionData?.timeSyncSpeed || matchingWatchlistItem?.timeSyncSpeed || 60;

      if (isTSEnabled && lastPlayAt && sessionData?.isPlaying) {
        const elapsedMs = Date.now() - lastPlayAt;
        if (elapsedMs > 5000 && elapsedMs <= 15000) { // only trigger if away for more than 5 seconds but less than 15 seconds to prevent huge jumping
          const ratio = 60 / speedRate;
          const chartAdvanceSecs = (elapsedMs / 1000) * ratio;
          
          let advancedTime = lastSimTime + chartAdvanceSecs;
          if (sessionData?.endTime && advancedTime > sessionData.endTime) {
            advancedTime = sessionData.endTime;
          }
          const finalTime = Math.floor(advancedTime);
          
          sessionCurrentTimesRef.current[currentSessionKey] = finalTime;
          simCurrentTimeRef.current = finalTime;
          setSimCurrentTime(finalTime);
          
          // Re-activate playing state safely on focus
          setSimIsPlaying(true);
          
          setBacktestSessions(prev => ({
            ...prev,
            [currentSessionKey]: {
              ...prev[currentSessionKey],
              isPlaying: true, // Safeguard active flag
              timeSyncEnabled: true,
              timeSyncSpeed: speedRate,
              currentTime: finalTime,
              timeSyncLastTimestamp: Date.now()
            }
          }));

          setWatchlist(prev => {
            const updated = prev.map(item => {
              const matchesId = matchingWatchlistItem && item.id === matchingWatchlistItem.id;
              const matchesLegacy = (!matchingWatchlistItem || !matchingWatchlistItem.id || !matchingWatchlistItem.id.startsWith('wl_')) &&
                (!currentSessionKey || !currentSessionKey.startsWith('wl_')) &&
                item.symbol === selectedSymbolRef.current && (item.prefix || '') === (activePrefixRef.current || '');
              if (matchesId || matchesLegacy) {
                return {
                  ...item,
                  timeSync: true,
                  timeFrame: selectedTimeframeRef.current?.id || item.timeFrame,
                  timeSyncSpeed: speedRate,
                  lastSimulationTime: finalTime,
                  lastCandlePlayAt: Date.now()
                };
              }
              return item;
            });
            if (session?.user?.id) {
              persistenceService.saveWatchlist(session.user.id, updated).catch(() => {});
            }
            return updated;
          });

          // Trigger a fresh load around finalTime if it has advanced past our cached buffer
          const timeframeSeconds = selectedTimeframeRef.current?.seconds || 60;
          const latestCandleTime = historicalDataRef.current[historicalDataRef.current.length - 1]?.time || 0;
          if (latestCandleTime > 0 && finalTime > latestCandleTime + (100 * timeframeSeconds)) {
            const activeItem = watchlistRef.current.find(i => i.id === activeWatchlistItemId);
            loadMarketData(
              selectedSymbolRef.current || '',
              selectedTimeframeRef.current?.id || '1h',
              finalTime,
              activeItem?.dataSource,
              activeItem?.marketType,
              true // forceTimeSnap
            );
          }
        } else {
          // If less than 5 seconds, still safeguard that simIsPlaying matches the active session state
          if (!simIsPlaying) {
            setSimIsPlaying(true);
          }
        }
      } else {
        // If not playing or if we were away for more than 15 seconds, reset the sync timestamp to now
        if (isTSEnabled && currentSessionKey) {
          setBacktestSessions(prev => {
            if (prev[currentSessionKey]) {
              return {
                ...prev,
                [currentSessionKey]: {
                  ...prev[currentSessionKey],
                  timeSyncLastTimestamp: Date.now()
                }
              };
            }
            return prev;
          });
        }
        if (sessionData && sessionData.isPlaying && !simIsPlaying) {
          // If the session is flagged as playing, sync the visual state on focus
          setSimIsPlaying(true);
        }
      }
    };
    
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [currentSessionKey, simIsPlaying]);

  const simTimeSessionKeyRef = useRef<string | null>(null);
  const sessionCurrentTimesRef = useRef<Record<string, number>>({});
  const loadedUserIdRef = useRef<string | null>(null);

  const historicalDataRef = useRef(historicalData);
  useEffect(() => {
    historicalDataRef.current = historicalData;
  }, [historicalData]);

  const hasNoMoreFutureDataRef = useRef(false);

  const selectedSymbolRef = useRef<string | null>(null);
  useEffect(() => {
    selectedSymbolRef.current = selectedSymbol;
  }, [selectedSymbol]);

  const activePrefixRef = useRef<string | null>(null);
  useEffect(() => {
    activePrefixRef.current = activePrefix;
  }, [activePrefix]);

  const selectedTimeframeRef = useRef<any>(null);
  useEffect(() => {
    selectedTimeframeRef.current = selectedTimeframe;
  }, [selectedTimeframe]);

  const isLoadingPastRef = useRef<boolean>(false);
  useEffect(() => {
    isLoadingPastRef.current = isLoadingPast;
  }, [isLoadingPast]);

  const loadedSymbolRef = useRef<string | null>(null);
  const loadedTimeframeRef = useRef<string | null>(null);

  useEffect(() => {
    if (historicalData.length === 0) {
      loadedSymbolRef.current = null;
      loadedTimeframeRef.current = null;
    }
  }, [historicalData]);

  const playbackTimerRef = useRef<number>(performance.now());
  const playbackAnimationRef = useRef<number | null>(null);
  const lastRequestedSymbolRef = useRef<string | null>(null);
  const lastRequestedTimeframeRef = useRef<string | null>(null);
  const lastTriedFutureStartTimeRef = useRef<number | null>(null);

  // Exit Replay Mode
  const exitReplay = useCallback(() => {
    setIsReplayMode(false);
    setReplayIsPlaying(false);
    setReplayTrade(null);
    setReplayCurrentTime(null);
    if (preReplayDrawings) {
      setDrawings(preReplayDrawings);
      setPreReplayDrawings(null);
    }
  }, [preReplayDrawings]);

  const [positionsByMode, setPositionsByMode] = useState<Record<string, Record<string, {x: number, y: number}>>>(INITIAL_POSITIONS);
  const [drawingSettingsPosByMode, setDrawingSettingsPosByMode] = useState<Record<string, {x: number, y: number} | null>>({
    desktop: null,
    mobilePortrait: null,
    mobileLandscape: null
  });

  const activeToolbarPos = useMemo(() => positionsByMode[currentMode].toolbar, [positionsByMode, currentMode]);
  const activeFavoritesPos = useMemo(() => positionsByMode[currentMode].favorites, [positionsByMode, currentMode]);
  const activeSimControlsPos = useMemo(() => positionsByMode[currentMode].simControls, [positionsByMode, currentMode]);
  const activeDrawingSettingsPos = useMemo(() => drawingSettingsPosByMode[currentMode], [drawingSettingsPosByMode, currentMode]);

  const updateToolbarPos = useCallback((p: {x: number, y: number}) => setPositionsByMode(prev => ({
    ...prev,
    [currentMode]: { ...prev[currentMode], toolbar: p }
  })), [currentMode]);

  const updateFavoritesPos = useCallback((p: {x: number, y: number}) => setPositionsByMode(prev => ({
    ...prev,
    [currentMode]: { ...prev[currentMode], favorites: p }
  })), [currentMode]);

  const updateSimControlsPos = useCallback((p: {x: number, y: number}) => setPositionsByMode(prev => ({
    ...prev,
    [currentMode]: { ...prev[currentMode], simControls: p }
  })), [currentMode]);

  const updateDrawingSettingsPos = useCallback((p: {x: number, y: number}) => setDrawingSettingsPosByMode(prev => ({
    ...prev,
    [currentMode]: p
  })), [currentMode]);

  // Clamp helper for manual updates
  const clampPosManually = useCallback((p: {x: number, y: number}) => ({
    x: Math.max(-window.innerWidth / 1.5, Math.min(window.innerWidth / 1.5, p.x)),
    y: Math.max(-window.innerHeight / 1.5, Math.min(window.innerHeight / 1.5, p.y))
  }), []);

  const updateSimControlsPosWithClamp = useCallback((p: {x: number, y: number}) => {
    updateSimControlsPos(clampPosManually(p));
  }, [updateSimControlsPos, clampPosManually]);

  const updateToolbarPosWithClamp = useCallback((p: {x: number, y: number}) => {
    updateToolbarPos(clampPosManually(p));
  }, [updateToolbarPos, clampPosManually]);

  const updateFavoritesPosWithClamp = useCallback((p: {x: number, y: number}) => {
    updateFavoritesPos(clampPosManually(p));
  }, [updateFavoritesPos, clampPosManually]);

  const resetFloatPositions = useCallback(() => {
    setPositionsByMode(INITIAL_POSITIONS);
    if (session?.user?.id) {
       persistenceService.savePreferences(session.user.id, { positionsByMode: INITIAL_POSITIONS });
    }
  }, [session?.user?.id]);

  // Synchronize dynamic payment redirect parameters from Paystack callback urls
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const plan = params.get('plan') as 'basic' | 'plus' | 'premium' | null;
    const message = params.get('message');

    if (paymentStatus === 'success' && plan) {
      setSubscriptionPlan(plan);
      addNotification(`Welcome aboard! Your trading workspace is now upgraded to ${plan.toUpperCase()}!`, 'success');
      // Clean query string from browser's address bar safely
      const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
    } else if (paymentStatus === 'failed') {
      addNotification('Payment checkout was not completed. Please try again.', 'error');
      const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
    } else if (paymentStatus === 'error') {
      addNotification(`Gateway error: ${message || 'Transaction could not be verified.'}`, 'error');
      const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
    }
  }, [addNotification]);

  // Keep toolbars within screen bounds on resize
  useEffect(() => {
    const handleResize = () => {
      setPositionsByMode(prev => {
        const clampPos = (p: {x: number, y: number}) => ({
          x: Math.max(-window.innerWidth / 1.5, Math.min(window.innerWidth / 1.5, p.x)),
          y: Math.max(-window.innerHeight / 1.5, Math.min(window.innerHeight / 1.5, p.y))
        });
        
        return {
          desktop: {
            toolbar: clampPos(prev.desktop.toolbar),
            favorites: clampPos(prev.desktop.favorites),
            simControls: clampPos(prev.desktop.simControls)
          },
          mobilePortrait: {
            toolbar: clampPos(prev.mobilePortrait.toolbar),
            favorites: clampPos(prev.mobilePortrait.favorites),
            simControls: clampPos(prev.mobilePortrait.simControls)
          },
          mobileLandscape: {
            toolbar: clampPos(prev.mobileLandscape.toolbar),
            favorites: clampPos(prev.mobileLandscape.favorites),
            simControls: clampPos(prev.mobileLandscape.simControls)
          }
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Per-symbol view states (zoom, offset, timeframe)
  interface SymbolViewState {
    timeframeId: string;
    viewport?: { zoom: number, offsetX: number, offsetY: number, yScale: number };
    indicators?: IndicatorInstance[];
    timeframeStates?: Record<string, {
      timeframeId: string;
      simCurrentTime: number | null;
      replayCurrentTime: number | null;
      indicators: IndicatorInstance[];
    }>;
  }
  const [symbolViewStates, setSymbolViewStates] = useState<Record<string, SymbolViewState>>({});

  const [simSpeed, setSimSpeed] = useState(1);
  const [simCurrentTime, setSimCurrentTime] = useState<number | null>(null);
  const [simCurrentPrice, setSimCurrentPrice] = useState<number | null>(null);

  // Keep refs in sync for the animation loop to synchronously read state and avoid closures
  const simCurrentTimeRef = useRef<number | null>(null);
  useEffect(() => {
    simCurrentTimeRef.current = simCurrentTime;
    if (currentSessionKey) {
      simTimeSessionKeyRef.current = currentSessionKey;
    }
  }, [simCurrentTime, currentSessionKey]);

  const replayCurrentTimeRef = useRef<number | null>(null);
  useEffect(() => {
    replayCurrentTimeRef.current = replayCurrentTime;
  }, [replayCurrentTime]);

  // Synchronize start_time, last_play_candle_time, end_time, price, and percentage change for active watchlist item
  useEffect(() => {
    if (!selectedSymbol || historicalData.length === 0) return;

    // Find active watchlist item
    const activeItem = watchlist.find(item => {
      if (activeWatchlistItemId) return item.id === activeWatchlistItemId;
      return item.symbol === selectedSymbol && (item.prefix || '') === (activePrefix || '');
    });
    if (!activeItem) return;

    if (!isReplayMode && (simCurrentTime === null || simCurrentTime === 0)) return;
    if (isReplayMode && (replayCurrentTime === null || replayCurrentTime === 0)) return;

    const sessionKey = activeItem.id || (activeItem.prefix ? `${activeItem.symbol}_${activeItem.prefix}` : activeItem.symbol);
    const linkedSession = backtestSessions[sessionKey];
    const start_time = activeItem.start_time || linkedSession?.startTime || historicalData[0]?.time;
    const end_time = activeItem.end_time || linkedSession?.endTime || historicalData[historicalData.length - 1]?.time;

    const currentPlayoutTime = isReplayMode ? (replayCurrentTime || 0) : (simCurrentTime || 0);
    // Find the last candle played or rendered
    const playedCandles = historicalData.filter(c => c.time <= currentPlayoutTime);
    const last_play_candle_time = playedCandles.length > 0 
      ? playedCandles[playedCandles.length - 1].time 
      : start_time;

    // Prices
    const startCandle = historicalData[0];
    const endCandle = historicalData[historicalData.length - 1];
    
    const startPrice = startCandle ? (typeof startCandle.open === 'number' ? startCandle.open : startCandle.close) : 0;
    const endPrice = endCandle ? (typeof endCandle.close === 'number' ? endCandle.close : endCandle.open) : 0;

    let totalPct = 0;
    if (startPrice > 0) {
      totalPct = ((endPrice - startPrice) / startPrice) * 100;
    }

    let progressFraction = 0;
    const denom = end_time - start_time;
    if (denom > 0) {
      progressFraction = Math.max(0, Math.min(1, (last_play_candle_time - start_time) / denom));
    }

    const currentPct = totalPct * progressFraction;
    const isDown = currentPct < 0;
    const changeStr = (currentPct >= 0 ? '+' : '') + currentPct.toFixed(2) + '%';

    const currentCandle = historicalData.find(c => c.time === last_play_candle_time) || startCandle;
    const priceStr = currentCandle ? (typeof currentCandle.close === 'number' ? currentCandle.close.toFixed(2) : String(currentCandle.close)) : 'Loading...';

    // To prevent infinite loop, compare with current item values
    if (
      activeItem.start_time !== start_time || 
      activeItem.end_time !== end_time || 
      activeItem.last_play_candle_time !== last_play_candle_time ||
      activeItem.price !== priceStr ||
      activeItem.change !== changeStr ||
      activeItem.isDown !== isDown
    ) {
      setWatchlist(prev => {
        const updated = prev.map(item => {
          if (item.id === activeItem.id) {
            return {
              ...item,
              start_time,
              last_play_candle_time,
              end_time,
              price: priceStr,
              change: changeStr,
              isDown
            };
          }
          return item;
        });
        if (session?.user?.id) {
          persistenceService.saveWatchlist(session.user.id, updated).catch(() => {});
        }
        return updated;
      });
    }
  }, [historicalData, simCurrentTime, replayCurrentTime, isReplayMode, activeWatchlistItemId, selectedSymbol, activePrefix, session]);

  const [nonPlayingTickIndex, setNonPlayingTickIndex] = useState(0);
  const [nonPlayingTickPrice, setNonPlayingTickPrice] = useState<number | null>(null);

  const lastActiveTickIndexRef = useRef<number>(0);

  // Reset ticking indices on relevant symbol, timeframe, or mode shifts
  useEffect(() => {
    setNonPlayingTickIndex(0);
    setNonPlayingTickPrice(null);
    lastActiveTickIndexRef.current = 0;
  }, [selectedSymbol, selectedTimeframe, isSimulating, isReplayMode]);

  // Clean ticking when actively playing so it doesn't pollute next pause transition
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    const isPlaying = isReplayMode ? replayIsPlaying : simIsPlaying;
    if (isPlaying) {
      setNonPlayingTickIndex(0);
      setNonPlayingTickPrice(null);
      wasPlayingRef.current = true;
    } else {
      if (wasPlayingRef.current) {
        // We just transitioned from playing to paused/stopped!
        // Retrieve the exact stopped tick index and price
        const savedTickIndex = lastActiveTickIndexRef.current;
        setNonPlayingTickIndex(savedTickIndex);
        
        // Compute and set the exact price corresponding to that index so there's no price jump on chart
        let curCandle: Candle | undefined = undefined;
        if (isReplayMode) {
          const current = replayCurrentTimeRef.current || 0;
          curCandle = [...historicalDataRef.current].reverse().find(c => c.time <= current);
        } else if (isSimulating || currentSessionKey) {
          const sessionKey = currentSessionKey || '';
          const current = sessionCurrentTimesRef.current?.[sessionKey] || simCurrentTimeRef.current || (sessionKey && backtestSessionsRef.current[sessionKey]?.currentTime) || (sessionKey && backtestSessionsRef.current[sessionKey]?.startTime) || 0;
          curCandle = [...historicalDataRef.current].reverse().find(c => c.time <= current);
        }
        if (curCandle) {
          const tfS = isReplayMode 
            ? (TIMEFRAMES.find(tf => tf.id.toLowerCase() === replayTrade?.timeframe.toLowerCase() || tf.label.toLowerCase() === replayTrade?.timeframe.toLowerCase())?.seconds || 60) 
            : selectedTimeframe.seconds;
          const tT = Math.max(1, Math.floor(tfS / 2));
          const ticking = getTickingCandleState(curCandle, savedTickIndex, tT);
          setNonPlayingTickPrice(ticking.close);
          setSimCurrentPrice(ticking.close);
        }
        wasPlayingRef.current = false;
      }
    }
  }, [simIsPlaying, replayIsPlaying, isReplayMode, selectedTimeframe, replayTrade]);

  const togglePlayback = useCallback(() => {
    const isPlaying = isReplayMode ? replayIsPlaying : simIsPlaying;
    if (isPlaying) {
      if (isReplayMode) {
        setReplayIsPlaying(false);
      } else {
        setSimIsPlaying(false);
      }
    } else {
      // Check if we are already at or beyond end time
      const activeItem = watchlistRef.current.find(i => i.id === activeWatchlistItemId) ||
                         watchlistRef.current.find(i => i.symbol === selectedSymbolRef.current && (i.prefix || null) === (activePrefixRef.current || null));
      const start_time = activeItem?.start_time || (historicalDataRef.current[0]?.time);
      
      const sessionKey = simTimeSessionKeyRef.current || currentSessionKey || activeItem?.id || '';
      const session = sessionKey ? backtestSessionsRef.current[sessionKey] : null;
      const trueEndTime = activeItem?.end_time || session?.endTime;
      
      const last_play_candle_time = activeItem?.last_play_candle_time || start_time;

      if (trueEndTime && last_play_candle_time && last_play_candle_time >= trueEndTime) {
        addNotification('Cannot move beyond end time', 'warning');
        return;
      }

      // Ensure active playback always resumes strictly from last_play_candle_time of the active watchlist item if it's set,
      // and only falls back to existingTime if last_play_candle_time is missing. This strictly guarantees no forward jumping.
      const existingTime = isReplayMode 
        ? replayCurrentTimeRef.current 
        : (simCurrentTimeRef.current || (sessionKey ? backtestSessionsRef.current[sessionKey]?.currentTime : null));
      const currentBaseTime = (last_play_candle_time && last_play_candle_time >= start_time)
        ? last_play_candle_time
        : ((existingTime && existingTime >= start_time) ? existingTime : start_time);

      if (isReplayMode) {
        let playheadTime = currentBaseTime;
        const currentData = historicalDataRef.current;
        if (currentData.length > 0) {
          const firstCandleTime = currentData[0].time;
          if (playheadTime < firstCandleTime) {
            playheadTime = firstCandleTime;
          } else {
            const snapCandle = [...currentData].reverse().find(c => c.time <= playheadTime);
            if (snapCandle) {
              playheadTime = snapCandle.time;
            }
          }
        }
        if (nonPlayingTickIndex > 0 && replayTrade) {
          const timeframeSeconds = TIMEFRAMES.find(tf => tf.id.toLowerCase() === replayTrade.timeframe.toLowerCase() || tf.label.toLowerCase() === replayTrade.timeframe.toLowerCase())?.seconds || 60;
          const totalTicks = Math.max(1, Math.floor(timeframeSeconds / 2));
          const curCandle = [...currentData].reverse().find(c => c.time <= playheadTime);
          if (curCandle) {
            const elapsedSeconds = (nonPlayingTickIndex / totalTicks) * timeframeSeconds;
            playheadTime = curCandle.time + elapsedSeconds;
          }
        }
        replayCurrentTimeRef.current = playheadTime;
        setReplayCurrentTime(playheadTime);
      } else if (isSimulating || currentSessionKey) {
        const sessionKey = simTimeSessionKeyRef.current || currentSessionKey || activeItem?.id || '';
        let playheadTime = currentBaseTime;
        const currentData = historicalDataRef.current;
        if (currentData.length > 0) {
          const firstCandleTime = currentData[0].time;
          if (playheadTime < firstCandleTime) {
            playheadTime = firstCandleTime;
          } else {
            const snapCandle = [...currentData].reverse().find(c => c.time <= playheadTime);
            if (snapCandle) {
              playheadTime = snapCandle.time;
            }
          }
        }
        if (nonPlayingTickIndex > 0) {
          const timeframeSeconds = selectedTimeframeRef.current?.seconds || 60;
          const totalTicks = Math.max(1, Math.floor(timeframeSeconds / 2));
          const curCandle = [...currentData].reverse().find(c => c.time <= playheadTime);
          if (curCandle) {
            const elapsedSeconds = (nonPlayingTickIndex / totalTicks) * timeframeSeconds;
            playheadTime = curCandle.time + elapsedSeconds;
          }
        }
        simCurrentTimeRef.current = playheadTime;
        if (sessionCurrentTimesRef.current && sessionKey) {
          sessionCurrentTimesRef.current[sessionKey] = playheadTime;
        }
        setSimCurrentTime(playheadTime);
      }

      if (isReplayMode) {
        setReplayIsPlaying(true);
      } else {
        setSimIsPlaying(true);
      }
    }
  }, [
    isReplayMode,
    replayIsPlaying,
    simIsPlaying,
    nonPlayingTickIndex,
    replayTrade,
    activePrefix,
    setReplayIsPlaying,
    setSimIsPlaying,
    setReplayCurrentTime,
    setSimCurrentTime,
    activeWatchlistItemId,
    currentSessionKey,
    watchlist,
    selectedSymbol
  ]);

  // Passive, background real-time ticker running when playback is idle/paused
  useEffect(() => {
    const isPlaying = isReplayMode ? replayIsPlaying : simIsPlaying;
    if (isPlaying) {
      return;
    }
    // For backtesting or replay modes, prevent the background ticker from running so the chart is completely frozen when paused (no time drifts)
    if (isReplayMode || isSimulating || currentSessionKey) {
      return;
    }

    const intervalId = setInterval(() => {
      const timeframeSeconds = selectedTimeframe?.seconds || 60;
      const totalTicks = Math.max(1, Math.floor(timeframeSeconds / 2));

      setNonPlayingTickIndex((prevTickIdx) => {
        const nextTickIndex = prevTickIdx + 1;
        if (nextTickIndex >= totalTicks) {
          // Time to advance to the next candle!
          let nextCandleOpen = 0;

          if (isReplayMode) {
            const currentData = historicalDataRef.current;
            const current = replayCurrentTimeRef.current || 0;
            const nextCandle = currentData.find(c => c.time > current);
            if (nextCandle) {
              nextCandleOpen = nextCandle.open;
              replayCurrentTimeRef.current = nextCandle.time;
              setReplayCurrentTime(nextCandle.time);
            } else {
              const nextTime = current + timeframeSeconds;
              replayCurrentTimeRef.current = nextTime;
              setReplayCurrentTime(nextTime);
              if (currentData.length > 0) {
                nextCandleOpen = currentData[currentData.length - 1].close;
              }
            }
          } else if (isSimulating || currentSessionKey) {
            const currentData = historicalDataRef.current;
            const sessionKey = currentSessionKey || '';
            const current = sessionCurrentTimesRef.current?.[sessionKey] || simCurrentTimeRef.current || (sessionKey && backtestSessionsRef.current[sessionKey]?.currentTime) || (sessionKey && backtestSessionsRef.current[sessionKey]?.startTime) || 0;
            const nextCandle = currentData.find(c => c.time > current);
            if (nextCandle) {
              nextCandleOpen = nextCandle.open;
              simCurrentTimeRef.current = nextCandle.time;
              if (sessionCurrentTimesRef.current && sessionKey) {
                sessionCurrentTimesRef.current[sessionKey] = nextCandle.time;
              }
              setSimCurrentTime(nextCandle.time);
            } else {
              const nextTime = current + timeframeSeconds;
              simCurrentTimeRef.current = nextTime;
              if (sessionCurrentTimesRef.current && sessionKey) {
                sessionCurrentTimesRef.current[sessionKey] = nextTime;
              }
              setSimCurrentTime(nextTime);
              if (currentData.length > 0) {
                nextCandleOpen = currentData[currentData.length - 1].close;
              }
            }
          } else {
            // Standard chart view: we are at the very end of historicalData
            const currentData = historicalDataRef.current;
            if (currentData.length > 0) {
              const lastCandle = currentData[currentData.length - 1];
              const newCandleTime = lastCandle.time + timeframeSeconds;
              
              const targetOpen = lastCandle.close;
              const changePercent = (Math.random() - 0.5) * 0.0012;
              const targetClose = targetOpen * (1 + changePercent);
              const bodyHigh = Math.max(targetOpen, targetClose);
              const bodyLow = Math.min(targetOpen, targetClose);
              const upperWick = bodyHigh * (Math.random() * 0.0008);
              const lowerWick = bodyLow * (Math.random() * 0.0008);
              const targetHigh = bodyHigh + upperWick;
              const targetLow = bodyLow - lowerWick;

              const newCandle: Candle = {
                time: newCandleTime,
                open: targetOpen,
                high: targetHigh,
                low: targetLow,
                close: targetClose,
                volume: Math.floor(Math.random() * 100)
              };

              nextCandleOpen = targetOpen;

              setHistoricalData(prev => [...prev, newCandle]);

              if (syncedSymbol && syncedData.length > 0) {
                const lastSynced = syncedData[syncedData.length - 1];
                const newSyncedTime = lastSynced.time + (syncedTimeframe?.seconds || timeframeSeconds);
                const synOpen = lastSynced.close;
                const synChange = (Math.random() - 0.5) * 0.0012;
                const synClose = synOpen * (1 + synChange);
                const synBodyHigh = Math.max(synOpen, synClose);
                const synBodyLow = Math.min(synOpen, synClose);
                const synUpperWick = synBodyHigh * (Math.random() * 0.0008);
                const synLowerWick = synBodyLow * (Math.random() * 0.0008);
                const synHigh = synBodyHigh + synUpperWick;
                const synLow = synBodyLow - synLowerWick;

                const newSyncedCandle: Candle = {
                  time: newSyncedTime,
                  open: synOpen,
                  high: synHigh,
                  low: synLow,
                  close: synClose,
                  volume: Math.floor(Math.random() * 100)
                };
                setSyncedData(prev => {
                  const uniqueMap = new Map<number, Candle>();
                  for (const candle of [...prev, newSyncedCandle]) {
                    if (candle && typeof candle.time === 'number') {
                      uniqueMap.set(candle.time, candle);
                    }
                  }
                  return Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
                });
              }
            }
          }

          setNonPlayingTickPrice(nextCandleOpen);
          setSimCurrentPrice(nextCandleOpen);
          return 0;
        }

        let curCandle: Candle | undefined = undefined;
        if (isReplayMode) {
          const current = replayCurrentTimeRef.current || 0;
          curCandle = [...historicalDataRef.current].reverse().find(c => c.time <= current);
        } else if (isSimulating || currentSessionKey) {
          const sessionKey = currentSessionKey || '';
          const current = sessionCurrentTimesRef.current?.[sessionKey] || simCurrentTimeRef.current || (sessionKey && backtestSessionsRef.current[sessionKey]?.currentTime) || (sessionKey && backtestSessionsRef.current[sessionKey]?.startTime) || 0;
          curCandle = [...historicalDataRef.current].reverse().find(c => c.time <= current);
        } else {
          curCandle = historicalDataRef.current[historicalDataRef.current.length - 1];
        }

        if (curCandle) {
          const ticking = getTickingCandleState(curCandle, nextTickIndex, totalTicks);
          setNonPlayingTickPrice(ticking.close);
          setSimCurrentPrice(ticking.close);
        }

        return nextTickIndex;
      });
    }, 2000);

    return () => clearInterval(intervalId);
  }, [
    simIsPlaying,
    replayIsPlaying,
    isReplayMode,
    isSimulating,
    selectedTimeframe,
    currentSessionKey,
    syncedSymbol
  ]);

  useEffect(() => {
    if (currentSessionKey && simCurrentTime !== null) {
      sessionCurrentTimesRef.current[currentSessionKey] = simCurrentTime;
    }
  }, [simCurrentTime, currentSessionKey]);

  // Reactive playhead sync to save play positions during active changes (playing, scrubbing, or pausing)
  const playheadSyncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedSimTimeRef = useRef<number | null>(null);
  const lastSavedReplayTimeRef = useRef<number | null>(null);
  const lastPlayheadSaveTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!selectedSymbol || !selectedTimeframe.id || !isDataInitialized) return;

    const isPlaying = isReplayMode ? replayIsPlaying : simIsPlaying;
    const now = Date.now();
    const lastSaveTime = lastPlayheadSaveTimeRef.current;
    
    // Periodically force save every 4 seconds during play, or debounce with 500ms when scrubbing/paused
    const forceSave = isPlaying && (now - lastSaveTime >= 4000);

    const performSave = () => {
      lastPlayheadSaveTimeRef.current = Date.now();
      lastSavedSimTimeRef.current = simCurrentTime;
      lastSavedReplayTimeRef.current = replayCurrentTime;

      // Update both memory cache & IndexedDB
      saveChartStateToCache(
        selectedSymbol,
        selectedTimeframe.id,
        activeWatchlistItemId || activePrefix || undefined,
        historicalData,
        simCurrentTime,
        replayCurrentTime,
        indicators
      ).catch(() => {});

      // Keep symbolViewStates fully in sync for database persistence
      updateSymbolViewStateTimeframe(
        selectedTimeframe.id,
        simCurrentTime,
        replayCurrentTime,
        indicators
      );
    };

    if (
      simCurrentTime === lastSavedSimTimeRef.current &&
      replayCurrentTime === lastSavedReplayTimeRef.current
    ) {
      return;
    }

    if (forceSave) {
      if (playheadSyncTimerRef.current) {
        clearTimeout(playheadSyncTimerRef.current);
      }
      performSave();
    } else {
      if (playheadSyncTimerRef.current) {
        clearTimeout(playheadSyncTimerRef.current);
      }
      const delay = isPlaying ? 4000 : 500;
      playheadSyncTimerRef.current = setTimeout(performSave, delay);
    }

    return () => {
      if (playheadSyncTimerRef.current) {
        clearTimeout(playheadSyncTimerRef.current);
      }
    };
  }, [
    simCurrentTime,
    replayCurrentTime,
    selectedSymbol,
    selectedTimeframe.id,
    activePrefix,
    indicators,
    simIsPlaying,
    replayIsPlaying,
    isReplayMode,
    isDataInitialized,
    historicalData
  ]);

  // Update simCurrentPrice from the latest available candle in historicalData
  useEffect(() => {
    // Only auto-snap when NOT playing. When playing, the play timer dictates ticking close prices.
    const isPlaying = isReplayMode ? replayIsPlaying : simIsPlaying;
    if (isPlaying) return;

    const time = isReplayMode ? replayCurrentTime : simCurrentTime;
    if (!time || historicalData.length === 0) return;
    const candle = [...historicalData].reverse().find(c => c.time <= time);
    if (candle) {
      setSimCurrentPrice(candle.close);
    }
  }, [simCurrentTime, replayCurrentTime, isReplayMode, historicalData, simIsPlaying, replayIsPlaying]);

  // Sync simCurrentTime to backtestSessions with throttling to prevent excessive re-renders and save to persistence
  const lastSyncRef = useRef<number>(0);
  useEffect(() => {
    const timeSessionKey = simTimeSessionKeyRef.current;
    if (selectedSymbol && simCurrentTime && timeSessionKey) {
      const now = Date.now();
      // Sync at most once per second or if it's completed
      const sessionData = backtestSessionsRef.current[timeSessionKey];
      if (!sessionData) return;

      const finishTrigger = Math.floor(sessionData.createdAt / 1000);
      let isCompleted = simCurrentTime >= finishTrigger;
      
      if (!isCompleted) {
        // If within one day (86400s) of target trigger, or have played up to or past the final historical candle
        const isCloseToEnd = (finishTrigger - simCurrentTime) <= 86400;
        let reachedLastCandle = false;
        
        const currentData = historicalDataRef.current;
        if (currentData && currentData.length > 0) {
          const lastCandleTime = currentData[currentData.length - 1].time;
          if (simCurrentTime >= lastCandleTime) {
            reachedLastCandle = true;
          }
        }
        
        if (isCloseToEnd || reachedLastCandle) {
          isCompleted = true;
        }
      }
      
      if (now - lastSyncRef.current < 1500 && !isCompleted && simIsPlaying) {
        return;
      }

      // Update session progress
      setBacktestSessions(prev => {
        const cur = prev[timeSessionKey];
        if (!cur || (cur.currentTime === simCurrentTime && cur.isCompleted === isCompleted)) return prev;
        
        const next = {
          ...prev,
          [timeSessionKey]: { ...cur, currentTime: simCurrentTime, isCompleted }
        };

        // Persist session state
        if (session?.user?.id) {
          persistenceService.saveBacktestSessions(session.user.id, next).catch(() => {});
        }

        lastSyncRef.current = now;
        return next;
      });

      // Automatically move to completed watchlist if reached target date
      if (isCompleted) {
        setWatchlist(prev => {
          const itemToUpdate = prev.find(item => {
            if (timeSessionKey && timeSessionKey.startsWith('wl_')) {
              return item.id === timeSessionKey;
            }
            return item.id === timeSessionKey || (item.symbol === sessionData.symbol && (item.prefix || '') === (sessionData.prefix || '') && item.status !== 'completed');
          });
          if (!itemToUpdate || itemToUpdate.status === 'completed') return prev;

          const updated = prev.map(item => 
            item.id === itemToUpdate.id ? { ...item, status: 'completed' as const } : item
          );

          if (session?.user?.id) {
            persistenceService.saveWatchlist(session.user.id, updated);
          }
          return updated;
        });
      }
    }
  }, [simCurrentTime, selectedSymbol, activePrefix, currentSessionKey, simIsPlaying, session?.user?.id]);

  // Reset loader refs when timeframe changes
  useEffect(() => {
    lastTriedFutureStartTimeRef.current = null;
  }, [selectedTimeframe]);

  // Keep isSimulating synchronized to true if we are running the simulation on desktop or landscape/tablet
  useEffect(() => {
    if (simIsPlaying && (!isMobile || isMobileLandscape) && !isSimulating) {
      setIsSimulating(true);
    }
  }, [simIsPlaying, isMobile, isMobileLandscape, isSimulating]);



  useEffect(() => {
    const key = activeWatchlistItemId || (selectedSymbol ? (activePrefix ? `${selectedSymbol}_${activePrefix}` : selectedSymbol) : null);
    if (key && symbolViewStates[key]) {
      const state = symbolViewStates[key];
      if (state.timeframeId && state.timeframeId !== selectedTimeframe.id) {
        const tf = TIMEFRAMES.find(t => t.id === state.timeframeId);
        if (tf) setSelectedTimeframe(tf);
      }
    }
  }, [selectedSymbol, activeWatchlistItemId, activePrefix]);

  // Initial load of user data
  useEffect(() => {
    const handleInitialAuth = async () => {
      if (isSupabasePlaceholder) {
        setIsAuthLoading(false);
        return;
      }
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session fetch error:', error);
          // If the token is invalid or missing, clear everything
          if (error.message.includes('Refresh Token Not Found') || error.message.includes('invalid_grant')) {
            try {
              await supabase.auth.signOut();
            } catch (signOutError) {
              console.warn('Silent signout failed', signOutError);
              // Force clear local storage if Supabase fails to sign out
              localStorage.clear();
            }
          }
          setIsAuthLoading(false);
          return;
        }
        
        setSession(session);
        setIsAuthLoading(false);
        if (session?.user) {
          loadUserData(session.user.id);
          persistenceService.updateActiveSession(session.user.id, mySessionId);
        }
      } catch (err) {
        console.error('Session fetch catch:', err);
        setIsAuthLoading(false);
        // Fallback: clear local storage if network errors occur
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
          console.warn('Network error during session fetch. App might be in offline mode or misconfigured.');
        } else {
          try {
            await supabase.auth.signOut();
          } catch (e) {}
        }
      }
    };

    handleInitialAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      setSession(session);
      if (session?.user) {
        loadUserData(session.user.id);
        // Register this session as active
        persistenceService.updateActiveSession(session.user.id, mySessionId);
      } else {
        // Reset app state on logout or failed session recovery
        loadedUserIdRef.current = null;
        setIsDataInitialized(false);
        setWatchlist([]);
        setBacktestSessions({});
        setDrawings([]);
        setJournalTrades([]);
        setSelectedSymbol(null);
        setIndicators([]);
        setTheme(DEFAULT_THEME);
        setSymbolViewStates({});
        localStorage.removeItem('symbolViewStates');
        clearAllLocalChartCaches().catch(() => {});
      }
    });

    return () => subscription.unsubscribe();
  }, [mySessionId]);

  // Session conflict watcher
  useEffect(() => {
    if (!session?.user?.id || sessionConflict) return;

    let sub: any = null;
    const initWatch = async () => {
      sub = await persistenceService.watchSession(
        session.user.id,
        () => {
          setSessionConflict(true);
        },
        mySessionId
      );
    };

    initWatch();

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, [session?.user?.id, mySessionId, sessionConflict]);

  // Handle logout on conflict
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSessionConflict(false);
  };

  // Force take over and resume session on this device
  const handleForceResume = async () => {
    if (session?.user?.id) {
      try {
        await persistenceService.updateActiveSession(session.user.id, mySessionId);
        setSessionConflict(false);
      } catch (err) {
        console.error('Failed to take over active session:', err);
      }
    }
  };

  // --- Persistent Preferences Sync (Consolidated) ---
  const savePrefsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (Object.keys(symbolViewStates).length > 0) {
      localStorage.setItem('symbolViewStates', JSON.stringify(symbolViewStates));
    }
  }, [symbolViewStates]);

  // Load symbolViewStates from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('symbolViewStates');
    if (saved) {
      try {
        setSymbolViewStates(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse symbolViewStates', e);
      }
    }
  }, []);

  const updateSymbolViewStateTimeframe = useCallback((timeframeId: string, currentSimTime: number | null, currentReplayTime: number | null, currentIndicators: IndicatorInstance[]) => {
    const key = activeWatchlistItemId || (selectedSymbol ? (activePrefix ? `${selectedSymbol}_${activePrefix}` : selectedSymbol) : null);
    if (!key) return;

    setSymbolViewStates(prev => {
      const existingSymbolState = prev[key] || { timeframeId };
      const existingTimeframeStates = existingSymbolState.timeframeStates || {};

      const updatedTimeframeStates = {
        ...existingTimeframeStates,
        [timeframeId]: {
          timeframeId,
          simCurrentTime: currentSimTime,
          replayCurrentTime: currentReplayTime,
          indicators: currentIndicators
        }
      };

      const newState = {
        ...prev,
        [key]: {
          ...existingSymbolState,
          timeframeId,
          timeframeStates: updatedTimeframeStates
        }
      };

      if (session?.user?.id) {
        persistenceService.savePreferences(session.user.id, { symbolViewStates: newState }).catch(() => {});
      }

      return newState;
    });
  }, [selectedSymbol, activePrefix, activeWatchlistItemId, session?.user?.id]);

  useEffect(() => {
    setSelectedTimeframeRef.current = (tf: any) => {
      // Save current playhead position immediately to database before switching!
      if (selectedSymbol && isDataInitialized) {
        const curSimTime = simCurrentTimeRef.current;
        const curReplayTime = replayCurrentTimeRef.current;
        
        saveChartStateToCache(
          selectedSymbol,
          selectedTimeframe.id,
          activeWatchlistItemId || activePrefix || undefined,
          historicalDataRef.current,
          curSimTime,
          curReplayTime,
          indicators
        ).catch(() => {});

        // Keep symbolViewStates fully in sync for database persistence
        updateSymbolViewStateTimeframe(
          selectedTimeframe.id,
          curSimTime,
          curReplayTime,
          indicators
        );
      }

      setSelectedTimeframesByMode(prev => ({
        ...prev,
        [currentMode]: tf,
        ...(currentMode === 'mobilePortrait' || currentMode === 'mobileLandscape' ? {
          mobilePortrait: tf,
          mobileLandscape: tf
        } : {})
      }));
    };
  }, [
    selectedSymbol,
    isDataInitialized,
    selectedTimeframe.id,
    activePrefix,
    indicators,
    currentMode,
    updateSymbolViewStateTimeframe
  ]);
  
  const viewportTimerRef = useRef<any>(null);
  const handleViewportChange = useCallback((v: any) => {
    const key = activeWatchlistItemId || (selectedSymbol ? (activePrefix ? `${selectedSymbol}_${activePrefix}` : selectedSymbol) : null);
    if (!key) return;
    
    // Use a ref to avoid stale closure and immediate state updates
    if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
    viewportTimerRef.current = setTimeout(() => {
      setSymbolViewStates(prev => {
        const current = prev[key] || { timeframeId: selectedTimeframe.id };
        const newState = {
          ...prev,
          [key]: { ...current, viewport: v }
        };
        if (session?.user?.id) {
          persistenceService.savePreferences(session.user.id, { symbolViewStates: newState }).catch(() => {});
        }
        return newState;
      });
    }, 1000); // 1 second debounce for persistence
  }, [selectedSymbol, activePrefix, activeWatchlistItemId, selectedTimeframe.id, session?.user?.id]);

  // Binary search helper to find nearest candlestick by timestamp
  const findNearestCandleIndex = (data: Candle[], targetTime: number) => {
    if (data.length === 0) return -1;
    let low = 0;
    let high = data.length - 1;
    let nearestIdx = 0;
    let minDiff = Math.abs(data[0].time - targetTime);

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const diff = Math.abs(data[mid].time - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        nearestIdx = mid;
      }
      if (data[mid].time === targetTime) {
        return mid;
      } else if (data[mid].time < targetTime) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return nearestIdx;
  };

  const handleMainViewportChange = useCallback((v: any) => {
    // 1. Persist the main chart viewport
    handleViewportChange(v);
  }, [handleViewportChange]);

  const handleSyncedViewportChange = useCallback((_v: any) => {
    // Synced/Comparison chart viewport movement is individual and independent
  }, []);

  const handleMainDrawingsChange = useCallback((newSymbolDrawings: any[]) => {
    if (!selectedSymbol) return;
    const currentSymbolNorm = normalizeSymbol(selectedSymbol);
    const currentPrefix = activePrefix || null;
    const pairKey = activeWatchlistItemId || (activePrefix ? `${selectedSymbol}_${activePrefix}` : selectedSymbol);

    // Filter position tools
    const currentPositions = drawings.filter(d => {
      if (activeWatchlistItemId) {
        return d.watchlistId === activeWatchlistItemId;
      } else {
        const drawingSymbolNorm = normalizeSymbol(d.symbol);
        const drawingPrefix = d.prefix || null;
        return drawingSymbolNorm === currentSymbolNorm && drawingPrefix === currentPrefix;
      }
    }).filter(d => d.type === DrawingType.LONG_POSITION || d.type === DrawingType.SHORT_POSITION);

    let finalSymbolDrawings = [...newSymbolDrawings];

    if (subscriptionPlan === 'basic') {
      const usage = pairUsageLimits[pairKey] || { replays: 0, syncedCharts: 0, trades: 0, tradesResetAt: 0 };
      const resetTime = usage.tradesResetAt || 0;

      const currentClosedTakenCount = currentPositions.filter(cp => 
        cp.isPipelineApproved && cp.isTriggered && (cp.status === 'won' || cp.status === 'lost') &&
        (cp.approvedAt || 0) > resetTime
      ).length;

      const nextClosedTakenCount = newSymbolDrawings.filter(d => {
        const isPosition = d.type === DrawingType.LONG_POSITION || d.type === DrawingType.SHORT_POSITION;
        return isPosition && d.isPipelineApproved && d.isTriggered && (d.status === 'won' || d.status === 'lost') &&
          (d.approvedAt || 0) > resetTime;
      }).length;

      // 1. Check if a pending position was just and newly executed/approved (Accepted) by the user
      const newlyApprovedTrade = newSymbolDrawings.find(d => {
        const isPosition = d.type === DrawingType.LONG_POSITION || d.type === DrawingType.SHORT_POSITION;
        if (!isPosition) return false;
        const isApprovedNow = d.isPipelineApproved;
        if (!isApprovedNow) return false;

        const prevDrawing = currentPositions.find(cp => cp.id === d.id);
        const isApprovedBefore = prevDrawing ? prevDrawing.isPipelineApproved : false;
        return !isApprovedBefore;
      });

      if (newlyApprovedTrade && (usage.trades >= 3 || currentClosedTakenCount >= 3)) {
        // Enforce the trade limit check when the user tries to accept/take a new trade
        const approvedIdx = finalSymbolDrawings.findIndex(d => d.id === newlyApprovedTrade.id);
        if (approvedIdx !== -1) {
          finalSymbolDrawings[approvedIdx] = {
            ...finalSymbolDrawings[approvedIdx],
            isPipelineApproved: false,
            placedAt: undefined,
            approvedAt: undefined
          };
        }

        // Keep ChartEngine in sync immediately
        if (chartEngineRef.current) {
          chartEngineRef.current.updateDrawing({
            ...newlyApprovedTrade,
            isPipelineApproved: false,
            placedAt: undefined,
            approvedAt: undefined
          });
        }

        addNotification("Trade limit reached! To take more trades, upgrade to Plus/Premium or watch an ad to reset.", "warning");
        setAdsLimitModalFeature('trades');
        setIsAdsLimitModalOpen(true);
      } else if (nextClosedTakenCount > currentClosedTakenCount) {
        // 2. Increment pair limit ONLY when a trade has successfully transitioned to closed ('won' or 'lost') after being accepted & triggered!
        const nextTradesCount = Math.max(usage.trades + 1, nextClosedTakenCount);
        updatePairLimit(pairKey, { trades: nextTradesCount });

        if (nextTradesCount >= 3) {
          setAdsLimitModalFeature('trades');
          setIsAdsLimitModalOpen(true);
        }
      }
    }

    setDrawings(prev => {
      const others = prev.filter(d => {
        if (activeWatchlistItemId) {
          return d.watchlistId !== activeWatchlistItemId;
        } else {
          if (d.watchlistId) return true;
          const drawingSymbolNorm = normalizeSymbol(d.symbol);
          const drawingPrefix = d.prefix || null;
          return !(drawingSymbolNorm === currentSymbolNorm && drawingPrefix === currentPrefix);
        }
      });
      const updated = finalSymbolDrawings.map(d => ({
        ...d,
        watchlistId: activeWatchlistItemId || undefined
      }));
      return [...others, ...updated];
    });
  }, [selectedSymbol, activePrefix, activeWatchlistItemId, drawings, subscriptionPlan, pairUsageLimits, updatePairLimit, addNotification]);

  const handleSyncedDrawingsChange = useCallback((newSymbolDrawings: any[]) => {
    if (!syncedSymbol) return;
    const currentSymbolNorm = normalizeSymbol(syncedSymbol);

    setDrawings(prev => {
      const others = prev.filter(d => {
        if (d.watchlistId) return true;
        const drawingSymbolNorm = normalizeSymbol(d.symbol);
        return drawingSymbolNorm !== currentSymbolNorm;
      });
      const updated = newSymbolDrawings.map(d => ({
        ...d,
        symbol: d.symbol || syncedSymbol,
        watchlistId: undefined // Synced comparison is generic symbol-based
      }));
      return [...others, ...updated];
    });
  }, [syncedSymbol]);

  const handleMainDrawingComplete = useCallback(() => {
    setActiveDrawingTool(null);
  }, []);

  const handleSyncedDrawingComplete = useCallback(() => {
    setActiveSyncedDrawingTool(null);
  }, []);

  const handleSyncedUpdateDrawing = useCallback((updates: any) => {
    if (!selectedSyncedDrawing) return;
    const updatedDrawing = {
      ...selectedSyncedDrawing,
      settings: { ...selectedSyncedDrawing.settings, ...updates }
    };
    setSelectedSyncedDrawing(updatedDrawing);
    setDrawings(prev => prev.map(d => d.id === selectedSyncedDrawing.id ? updatedDrawing : d));
    if (syncedChartEngineRef.current) {
      syncedChartEngineRef.current.updateDrawing(updatedDrawing);
    }
  }, [selectedSyncedDrawing]);

  const handleSyncedDeleteDrawing = useCallback(() => {
    if (!selectedSyncedDrawing) return;
    setDrawings(prev => prev.filter(d => d.id !== selectedSyncedDrawing.id));
    setSelectedSyncedDrawing(null);
  }, [selectedSyncedDrawing]);

  const handleSyncedCloseDrawing = useCallback(() => {
    setSelectedSyncedDrawing(null);
  }, []);

  const handleSyncedSelectDrawing = useCallback((drawing: Drawing | null) => {
    setSelectedSyncedDrawing(drawing);
    if (drawing) {
      setShowSyncedFavorites(true);
    }
  }, []);

  // Memoize drawings array for the main chart to prevent massive recomputation on cursor movement and animation ticks
  const mainChartDrawings = useMemo(() => {
    if (!selectedSymbol) return [];
    
    const currentSymbolNorm = normalizeSymbol(selectedSymbol);
    const currentPrefix = activePrefix || null;

    const currentSymbolDrawings = drawings.filter(d => {
      // 1. Instance ID check (Highest Priority)
      if (activeWatchlistItemId && d.watchlistId && d.watchlistId === activeWatchlistItemId) {
        return true;
      }
      
      // 2. If IDs are different, it's definitely NOT this item
      if (activeWatchlistItemId && d.watchlistId && d.watchlistId !== activeWatchlistItemId) {
        return false;
      }

      // 3. Symbol check (Normalized)
      const drawingSymbolNorm = normalizeSymbol(d.symbol);
      if (drawingSymbolNorm !== currentSymbolNorm) return false;

      // 4. Prefix check (Normalized)
      const drawingPrefix = d.prefix || null;
      if (drawingPrefix !== currentPrefix) return false;

      return true;
    });

    if (!isReplayMode || !replayTrade) return currentSymbolDrawings;
    
    // Use drawingId from trade if available for better accuracy
    const replayTradeDrawingId = replayTrade.drawingId || currentSymbolDrawings.find(d => 
      (d.type === DrawingType.LONG_POSITION || d.type === DrawingType.SHORT_POSITION) && 
      Math.abs((d.points[0]?.time || 0) - replayTrade.entryTime) < 120
    )?.id;

    return currentSymbolDrawings.filter(d => {
      // If it's the exact drawing for the trade we are replaying, show it
      if (d.id === replayTradeDrawingId) return true;

      // Handle Long/Short positions specifically
      if (d.type === DrawingType.LONG_POSITION || d.type === DrawingType.SHORT_POSITION) {
        // If it existed before we started replay (is in preReplayDrawings), hide it
        // unless it's the one we are replaying (already handled above)
        const existedBefore = preReplayDrawings?.some(pre => pre.id === d.id);
        if (existedBefore) return false;
        
        // Otherwise it's a new drawing made during this replay session - show it
        return true;
      }
      return true;
    });
  }, [drawings, selectedSymbol, activePrefix, activeWatchlistItemId, isReplayMode, replayTrade, preReplayDrawings]);

  // Derive drawings for the synced comparison chart from the unified state
  const syncedChartDrawings = useMemo(() => {
    if (!syncedSymbol) return [];
    const currentSymbolNorm = normalizeSymbol(syncedSymbol);

    return drawings.filter(d => {
      // Synced comparison drawings are symbol-bound and don't belong to a specific watchlist session
      if (d.watchlistId) return false;
      const drawingSymbolNorm = normalizeSymbol(d.symbol);
      return drawingSymbolNorm === currentSymbolNorm;
    });
  }, [drawings, syncedSymbol]);



  // Memoize indicators for the synced comparison chart
  const syncedIndicatorsToRender = useMemo(() => {
    return indicators.filter(ind => {
      if (syncedIndicatorsActive.length === 0) return true; // Default to all
      const label = ind.name || ind.type;
      return syncedIndicatorsActive.some(activeName => 
        label.toUpperCase().includes(activeName.toUpperCase()) || 
        ind.type.toUpperCase().includes(activeName.toUpperCase())
      );
    });
  }, [indicators, syncedIndicatorsActive]);

  const handleMainDrawingTrigger = useCallback((drawing: Drawing) => {
    if (isSimulating || (isReplayMode && replayIsPlaying)) {
      const activeSetupsData = setups.filter(s => (s.confluences && s.confluences.length > 0) || s.image_url);
      
      const setup = activeSetupsData.length > 0 ? activeSetupsData[0] : null;
      addNotification(setup ? `Model Detected: ${setup.grade}` : 'Standard Execution (A+) Selected', 'info');

      const updatedDrawing = {
        ...drawing,
        settings: {
          ...drawing.settings,
          setupGrade: setup ? setup.grade : 'A+',
          confluences: setup ? (setup.confluences || []) : []
        }
      };
      if (chartEngineRef.current) chartEngineRef.current.updateDrawing(updatedDrawing);
      setDrawings(prev => prev.map(d => d.id === drawing.id ? updatedDrawing : d));
    }
  }, [isSimulating, isReplayMode, replayIsPlaying, setups]);

  const handleMainTradeClosed = useCallback((trade: any) => {
    if (session?.user?.id && !isReplayMode) {
      const relatedDrawing = drawings.find(d => d.id === trade.drawingId);
      const setupGrade = trade.setupGrade || relatedDrawing?.settings?.setupGrade;
      const confluences = trade.confluences || relatedDrawing?.settings?.confluences;
      const notes = trade.notes || relatedDrawing?.settings?.notes;

      const fullTrade = { 
        ...trade, 
        pips: calculatePips(trade.symbol, trade.entryPrice, trade.exitPrice),
        timeframe: selectedTimeframe.label,
        prefix: activePrefix || undefined,
        watchlistId: activeWatchlistItemId || undefined,
        setupGrade,
        confluences,
        notes,
        realizedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      const displayStatus = trade.status === 'won' || trade.status === 'TP' ? 'TP' : 'SL';
      persistenceService.saveTrade(session.user.id, fullTrade)
        .then(() => {
          addNotification(`Position ${displayStatus}: Journaled`, 'success');
          persistenceService.getTrades(session.user.id!).then(setJournalTrades);
        })
        .catch(err => {
          console.error('[JournalTrade] Save failed:', err);
          addNotification(`Failed to journal trade: ${err.message || 'Unknown error. Check Supabase schema.'}`, 'error');
        });
    } else if (isReplayMode) {
      const displayStatus = trade.status === 'won' || trade.status === 'TP' ? 'TP' : 'SL';
      addNotification(`Replay Position ${displayStatus}: Not journaled (Reply Mode)`, 'info');
    }
  }, [session, isReplayMode, drawings, selectedTimeframe, activePrefix, activeWatchlistItemId]);

  const loadSyncedMarketData = async (
    symbol: string,
    timeframeId: string,
    targetTime: number,
    source?: string,
    marketType?: MarketType
  ) => {
    if (!symbol) return;
    setIsSyncedLoading(true);
    try {
      const dataPast = await fetchCandleData(symbol, timeframeId, 500, targetTime, undefined, source, marketType);
      
      let dataFuture: Candle[] = [];
      if (isSimulating || isReplayMode) {
        try {
          dataFuture = await fetchCandleData(symbol, timeframeId, 500, undefined, targetTime + 1, source, marketType);
        } catch (fErr) {
          console.warn('Failed to fetch future candles for synced symbol:', fErr);
        }
      }
      
      const uniqueMap = new Map<number, Candle>();
      for (const candle of [...dataPast, ...dataFuture]) {
        if (candle && typeof candle.time === 'number') {
          uniqueMap.set(candle.time, candle);
        }
      }
      const combined = Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
      setSyncedData(combined);
      setRenderedSyncedTimeframeId(timeframeId);
    } catch (err) {
      console.error('Failed to load synced market data:', err);
      addNotification(`Failed to load synced chart ${symbol}`, 'error');
    } finally {
      setIsSyncedLoading(false);
    }
  };

  const loadMoreSyncedPast = async () => {
    if (isSyncedLoading || syncedData.length === 0 || !syncedSymbol) return;
    try {
      const oldestCandle = syncedData[0];
      const endTime = oldestCandle.time - 1; // subtract 1 second
      const olderData = await fetchCandleData(
        syncedSymbol,
        syncedTimeframe.id,
        500,
        endTime,
        undefined,
        syncedDataSource || undefined,
        syncedMarketType || undefined
      );
      if (olderData.length > 0) {
        setSyncedData(prev => [...olderData, ...prev]);
      }
    } catch (err) {
      console.error('Failed to load more synced past data:', err);
    }
  };

  // Synced comparison autoloader
  useEffect(() => {
    if (!syncedSymbol) return;
    
    const sessionData = currentSessionKey ? backtestSessions[currentSessionKey] : null;
    let timeToLoad = isReplayMode 
      ? (replayCurrentTime || (sessionData?.currentTime || sessionData?.startTime || Math.floor(Date.now() / 1000))) 
      : (simCurrentTime || (sessionData?.currentTime || sessionData?.startTime || Math.floor(Date.now() / 1000)));

    loadSyncedMarketData(
      syncedSymbol,
      syncedTimeframe.id,
      timeToLoad,
      syncedDataSource || undefined,
      syncedMarketType || undefined
    );
  }, [
    syncedSymbol,
    syncedTimeframe.id,
    currentSessionKey,
    syncedDataSource,
    syncedMarketType
  ]);

  const handleIndicatorsChange = (newIndicators: IndicatorInstance[]) => {
    setIndicators(newIndicators);

    // Save of the newly formatted indicators to multi-timeframe state & backend preferences
    if (selectedSymbol && selectedTimeframe) {
      saveChartStateToCache(
        selectedSymbol,
        selectedTimeframe.id,
        activeWatchlistItemId || activePrefix || undefined,
        historicalData,
        simCurrentTimeRef.current,
        replayCurrentTimeRef.current,
        newIndicators
      ).catch(() => {});

      updateSymbolViewStateTimeframe(
        selectedTimeframe.id,
        simCurrentTimeRef.current,
        replayCurrentTimeRef.current,
        newIndicators
      );
    }
  };

  const handleTimeframeChange = (tf: typeof TIMEFRAMES[0]) => {
    // 1. Save current active symbol timeframe state before switching
    if (selectedSymbol && selectedTimeframe) {
      saveChartStateToCache(
        selectedSymbol,
        selectedTimeframe.id,
        activeWatchlistItemId || activePrefix || undefined,
        historicalData,
        simCurrentTimeRef.current,
        replayCurrentTimeRef.current,
        indicators
      ).catch(() => {});

      updateSymbolViewStateTimeframe(
        selectedTimeframe.id,
        simCurrentTimeRef.current,
        replayCurrentTimeRef.current,
        indicators
      );
    }

    const key = activeWatchlistItemId || (selectedSymbol ? (activePrefix ? `${selectedSymbol}_${activePrefix}` : selectedSymbol) : null);
    const oldV = key ? symbolViewStates[key]?.viewport : null;
    let targetZoom = oldV ? oldV.zoom : 10;
    let focalTime: number | null = null;
    let distanceInCandles: number | null = null;

    const currentPlayTime = isReplayMode 
      ? replayCurrentTimeRef.current 
      : (isSimulating ? simCurrentTimeRef.current : null);

    if (currentPlayTime && visibleData.length > 0) {
      focalTime = currentPlayTime;
      const idx = visibleData.findIndex(c => c.time === currentPlayTime);
      if (idx !== -1) {
        const oX = (oldV && oldV.offsetX !== undefined) ? oldV.offsetX : 0;
        distanceInCandles = (visibleData.length - 1 - idx) - oX;
      }
    } else if (oldV && visibleData.length > 0) {
      const zoom = oldV.zoom || 10;
      targetZoom = zoom;
      const offsetX = oldV.offsetX || 0;
      if (offsetX <= 5) {
        focalTime = visibleData[visibleData.length - 1]?.time || null;
      } else {
        const approxWidth = 800;
        const visibleCount = approxWidth / zoom;
        const rightIdx = visibleData.length - 1 - Math.floor(offsetX);
        const centerIdx = Math.max(0, Math.min(visibleData.length - 1, Math.round(rightIdx - visibleCount / 2)));
        focalTime = visibleData[centerIdx]?.time || null;
      }
    } else if (visibleData.length > 0) {
      focalTime = visibleData[visibleData.length - 1]?.time || null;
    }

    pendingViewportRef.current = {
      zoom: targetZoom,
      focalTime,
      distanceInCandles,
      isReplayMode: isReplayMode || isSimulating
    };

    setSelectedTimeframe(tf);
    setSyncedTimeframeState(null); // Reset manual synced TF to sync perfectly with main timeframe
    if (key) {
      setSymbolViewStates(prev => ({
        ...prev,
        [key]: { ...(prev[key] || {}), timeframeId: tf.id }
      }));
    }
  };

  useEffect(() => {
    setHistoricalData([]);
    setSimCurrentTime(null);
    simCurrentTimeRef.current = null; // Sync ref immediately to prevent animation loop race conditions
    setIsSimulating(false);
    setSimIsPlaying(false);
    lastTriedFutureStartTimeRef.current = null;
  }, [currentSessionKey]);

  const updateSelectedSymbol = (symbol: string) => {
    // Always show setup modal to let user choose/confirm start date
    setShowBacktestSetup({ symbol });
  };

  const startBacktestSession = async (symbol: string, startDate: string, prefixOverride: string, description: string, setupImage?: string, source?: string, marketType?: MarketType, endDate?: string) => {
    const asset = POPULAR_SYMBOLS.find(s => s.symbol === symbol);
    if (!asset) return;

    // Use provided source or default to axiory for Forex/Metals, Binance for Crypto
    const finalSource = source || (asset.category === 'Crypto' ? 'binance' : 'axiory');
    const finalMarketType = asset.category === 'Crypto' ? (marketType || 'spot') : undefined;

    // Auto-generate prefix if not updating an existing one
    let prefix = prefixOverride;
    if (!prefix) {
      // Find all existing prefixes for this symbol from BOTH watchlist and sessions
      const watchlistPrefixes = watchlist
        .filter(item => item.symbol === symbol)
        .map(i => parseInt(i.prefix || '0', 10))
        .filter(p => !isNaN(p));
      
      const sessionPrefixes = (Object.values(backtestSessions) as BacktestSession[])
        .filter((s: BacktestSession) => s.symbol === symbol)
        .map(s => parseInt(s.prefix || '0', 10))
        .filter(p => !isNaN(p));
      
      const allPrefixes = [...watchlistPrefixes, ...sessionPrefixes];
      const maxPrefix = allPrefixes.length > 0 ? Math.max(...allPrefixes) : 0;
      prefix = (maxPrefix + 1).toString().padStart(2, '0');
    }

    // Force uniqueness Check (loop until free)
    let finalPrefix = prefix;
    let sessionKey = finalPrefix ? `${symbol}_${finalPrefix}` : symbol;
    
    // If not specifically overriding (i.e. if adding a NEW one), ensure key is unique
    if (!prefixOverride) {
      let attempt = parseInt(finalPrefix, 10);
      while (backtestSessions[sessionKey] || watchlist.some(i => i.symbol === symbol && (i.prefix || '') === finalPrefix)) {
        attempt++;
        finalPrefix = attempt.toString().padStart(2, '0');
        sessionKey = `${symbol}_${finalPrefix}`;
      }
    }
    
    prefix = finalPrefix;
    const isNew = !backtestSessions[sessionKey];

    const parseLocalDate = (dateStr: string) => {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
      return new Date(dateStr);
    };

    const startDateObj = parseLocalDate(startDate);
    const minSelectableDate = getMinSelectableStartDate(symbol, finalSource);

    if (startDateObj < minSelectableDate) {
      alert(`Start date must be at least ${minSelectableDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}. Earliest allowed: ${minSelectableDate.toISOString().split('T')[0]}`);
      return;
    }

    const startTimeInSeconds = Math.floor(startDateObj.getTime() / 1000);
    const endDateObj = endDate ? parseLocalDate(endDate) : undefined;
    if (endDateObj) {
      endDateObj.setHours(23, 59, 59, 999);
    }
    const endTimeInSeconds = endDateObj ? Math.floor(endDateObj.getTime() / 1000) : undefined;
    const createdAt = Date.now();
    const watchlistId = `wl_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
    
    // Determine the unique watchlist ID key to save session parameters
    const existingItem = watchlist.find(item => 
      item.symbol === symbol && 
      (item.prefix || '') === (prefix || '') && 
      item.dataSource === finalSource
    );
    const targetSessionKey = existingItem ? existingItem.id : watchlistId;

    // Update local state and save immediately (writes to both unique ID and fallback legacy key for backward-compatibility)
    const sessionObj = {
      ...(backtestSessions[targetSessionKey] || backtestSessions[sessionKey] || {}),
      startTime: startTimeInSeconds,
      endTime: endTimeInSeconds,
      currentTime: backtestSessions[targetSessionKey]?.currentTime || backtestSessions[sessionKey]?.currentTime || startTimeInSeconds,
      createdAt: backtestSessions[targetSessionKey]?.createdAt || backtestSessions[sessionKey]?.createdAt || createdAt,
      prefix,
      description,
      symbol // Ensure symbol is set
    } as BacktestSession;

    const nextSessions = { 
      ...backtestSessions, 
      [targetSessionKey]: sessionObj,
      [sessionKey]: sessionObj
    };
    
    setBacktestSessions(nextSessions);
    if (session?.user?.id) {
      persistenceService.saveBacktestSessions(session.user.id, nextSessions);
    }
    
    // Strict check: same symbol AND same prefix AND same source
    const existingIndex = watchlist.findIndex(item => 
      item.symbol === symbol && 
      (item.prefix || '') === (prefix || '') && 
      item.dataSource === finalSource
    );
    
    let nextWatchlist;
    if (existingIndex > -1) {
      nextWatchlist = [...watchlist];
      nextWatchlist[existingIndex] = {
        ...nextWatchlist[existingIndex],
        description,
        setupImage,
        start_time: startTimeInSeconds,
        end_time: endTimeInSeconds,
        last_play_candle_time: startTimeInSeconds
      };
      addNotification(`Updated ${symbol} (${prefix}) details`, 'success');
    } else {
      const newItem: WatchlistItem = {
        ...asset,
        id: watchlistId,
        price: 'Loading...',
        change: '0.00%',
        isDown: false,
        vol: '---',
        status: 'ongoing',
        prefix,
        description,
        setupImage,
        dataSource: source || showBacktestSetup?.source || asset.source,
        marketType: finalMarketType,
        createdAt: Date.now(),
        start_time: startTimeInSeconds,
        end_time: endTimeInSeconds,
        last_play_candle_time: startTimeInSeconds
      };
      nextWatchlist = [...watchlist, newItem];
      addNotification(`Launched ${symbol} (${prefix}) session`, 'success');
    }

    setWatchlist(nextWatchlist);
    if (session?.user?.id) {
      persistenceService.saveWatchlist(session.user.id, nextWatchlist);
    }
    
    // Keep the user on the Watchlist Page – do not auto-redirect to the chart.
    // They can choose if and when they want to view the pair on the chart from the list.
    setShowBacktestSetup(null);
  };

  const loadUserData = async (userId: string) => {
    if (loadedUserIdRef.current === userId) {
      console.log('User data already loaded or loading for:', userId);
      return;
    }
    loadedUserIdRef.current = userId;
    try {
      console.log('Loading user data for:', userId);
      const [savedDrawings, savedPrefs, savedWatchlist, savedSessions, savedTrades] = await Promise.all([
        persistenceService.getDrawings(userId),
        persistenceService.getPreferences(userId),
        persistenceService.getWatchlist(userId),
        persistenceService.getBacktestSessions(userId),
        persistenceService.getTrades(userId)
      ]);

      console.log('Loaded watchlist:', savedWatchlist);
      console.log('Loaded sessions:', savedSessions);

      if (savedDrawings && savedDrawings.length > 0) setDrawings(savedDrawings);
      if (savedTrades) setJournalTrades(savedTrades);

      // --- Daily Login Streak Calculation & Sync ---
      let updatedStreakCount = savedPrefs?.streakCount ?? 0;
      let updatedLongestStreak = savedPrefs?.longestStreak ?? 0;
      let updatedLastLoginDate = savedPrefs?.lastLoginDate ?? '';

      const todayStr = new Date().toLocaleDateString('en-CA');

      if (!updatedLastLoginDate) {
        updatedStreakCount = 1;
        updatedLongestStreak = Math.max(updatedLongestStreak, 1);
        updatedLastLoginDate = todayStr;
      } else if (updatedLastLoginDate !== todayStr) {
        try {
          const today = new Date(todayStr + 'T00:00:00');
          const lastLogin = new Date(updatedLastLoginDate + 'T00:00:00');
          const msDiff = today.getTime() - lastLogin.getTime();
          const dayDiff = Math.round(msDiff / (1000 * 60 * 60 * 24));

          if (dayDiff === 1) {
            updatedStreakCount += 1;
            updatedLongestStreak = Math.max(updatedLongestStreak, updatedStreakCount);
          } else if (dayDiff > 1) {
            updatedStreakCount = 1;
          }
          updatedLastLoginDate = todayStr;
        } catch (e) {
          console.error('Failed to parse streak dates:', e);
        }
      }

      setStreakCount(updatedStreakCount);
      setLongestStreak(updatedLongestStreak);
      setLastLoginDate(updatedLastLoginDate);

      // --- Trigger full-screen Hurray celebration if milestone achieved ---
      const milestones = [10, 50, 100, 365];
      const celebratedMilestones = savedPrefs?.celebratedMilestones ?? [];
      let updatedCelebratedMilestones = [...celebratedMilestones];
      let didAcquireAwardBadge = false;

      if (updatedStreakCount > 0) {
        const newlyEarnedMilestone = milestones.find(m => updatedStreakCount >= m && !celebratedMilestones.includes(m));
        if (newlyEarnedMilestone) {
          didAcquireAwardBadge = true;
          updatedCelebratedMilestones.push(newlyEarnedMilestone);
          setTimeout(() => {
            const badgeDetails = getStreakBadgeInfo(newlyEarnedMilestone);
            setActiveEarnedBadge(badgeDetails);
          }, 2000); // Give the dashboard 2 seconds to render cleanly
        }
      }

      // Save immediately if there's any change
      if (
        updatedStreakCount !== (savedPrefs?.streakCount ?? 0) ||
        updatedLongestStreak !== (savedPrefs?.longestStreak ?? 0) ||
        updatedLastLoginDate !== (savedPrefs?.lastLoginDate ?? '') ||
        didAcquireAwardBadge
      ) {
        persistenceService.savePreferences(userId, {
          streakCount: updatedStreakCount,
          longestStreak: updatedLongestStreak,
          lastLoginDate: updatedLastLoginDate,
          celebratedMilestones: updatedCelebratedMilestones
        }).catch(err => console.error('Failed to sync login streak & achievements:', err));

        if (savedPrefs) {
          savedPrefs.streakCount = updatedStreakCount;
          savedPrefs.longestStreak = updatedLongestStreak;
          savedPrefs.lastLoginDate = updatedLastLoginDate;
          savedPrefs.celebratedMilestones = updatedCelebratedMilestones;
        }
      }
      
      let processedWatchlist: WatchlistItem[] = [];
      if (savedWatchlist && Array.isArray(savedWatchlist)) {
        processedWatchlist = savedWatchlist.map(item => {
          let updatedItem = {
            ...item,
            id: item.id || `wl_${item.symbol}_${item.prefix || ''}_legacy`,
            status: item.status || 'ongoing'
          };
          
          if (updatedItem.timeSync && updatedItem.lastCandlePlayAt && updatedItem.lastSimulationTime) {
            const elapsedMs = Date.now() - updatedItem.lastCandlePlayAt;
            if (elapsedMs > 0) {
              const speedRate = updatedItem.timeSyncSpeed || 60;
              const ratio = 60 / speedRate;
              const chartAdvanceSecs = (elapsedMs / 1000) * ratio;
              updatedItem.lastSimulationTime = Math.floor(updatedItem.lastSimulationTime + chartAdvanceSecs);
              updatedItem.lastCandlePlayAt = Date.now();
            }
          }
          return updatedItem;
        });
        setWatchlist(processedWatchlist);
      }

      if (savedSessions) {
        // Migration: ensure values are objects and startTime/currentTime are in seconds.
        // Also perform mathematically precise revisit catch-up if Time Sync was playing.
        const migrated = Object.entries(savedSessions).reduce((acc, [key, val]: [string, any]) => {
          if (typeof val === 'number') {
            // Old format: just a timestamp
            const isMs = val > 50000000000;
            const seconds = isMs ? Math.floor(val / 1000) : val;
            acc[key] = {
              startTime: seconds,
              currentTime: seconds,
              createdAt: Date.now()
            };
          } else if (val && typeof val === 'object') {
            // New format: object. Ensure timestamps are seconds.
            const isStartMs = (val.startTime || 0) > 50000000000;
            const isCurrentMs = (val.currentTime || 0) > 50000000000;
            
            let finalStartTime = isStartMs ? Math.floor(val.startTime / 1000) : val.startTime;
            let finalCurrentTime = isCurrentMs ? Math.floor(val.currentTime / 1000) : val.currentTime;
            let finalLastTimestamp = val.timeSyncLastTimestamp;

            // Look up matching watchlist item that was already caught up
            const matchingWatchlistItem = processedWatchlist.find((item: any) => {
              if (key && key.startsWith('wl_')) {
                return item.id === key;
              }
              return item.id === key || (item.symbol === val.symbol && (item.prefix || '') === (val.prefix || ''));
            });

            const isTSEnabled = val.timeSyncEnabled || matchingWatchlistItem?.timeSync;
            const lastPlayAt = val.timeSyncLastTimestamp || matchingWatchlistItem?.lastCandlePlayAt;
            const lastSimTime = finalCurrentTime || matchingWatchlistItem?.lastSimulationTime || val.currentTime || val.startTime;
            const speedRate = val.timeSyncSpeed || matchingWatchlistItem?.timeSyncSpeed || 60;

            if (isTSEnabled) {
              finalLastTimestamp = Date.now();
            }

            const sessionObj = {
              ...val,
              startTime: finalStartTime,
              currentTime: finalCurrentTime,
              timeSyncLastTimestamp: finalLastTimestamp,
              timeSyncEnabled: isTSEnabled || val.timeSyncEnabled,
              timeSyncSpeed: speedRate,
              isPlaying: !!val.isPlaying, // Do not force playing on startup, respect user's actual play/pause state
              createdAt: val.createdAt || Date.now()
            };
            acc[key] = sessionObj;
            if (matchingWatchlistItem && matchingWatchlistItem.id && matchingWatchlistItem.id !== key) {
              acc[matchingWatchlistItem.id] = sessionObj;
            }
          }
          return acc;
        }, {} as Record<string, any>);
        setBacktestSessions(migrated);
      }

      if (savedPrefs) {
        if (savedPrefs.drawingTemplates) {
          try {
            Object.entries(savedPrefs.drawingTemplates).forEach(([key, val]) => {
              if (val) {
                localStorage.setItem(`drawing_templates_${key}`, JSON.stringify(val));
              }
            });
          } catch (e) {
            console.error('Failed to load drawingTemplates from preferences into localStorage:', e);
          }
        }
        if (savedPrefs.subscriptionPlan) setSubscriptionPlan(savedPrefs.subscriptionPlan);
        if (savedPrefs.theme) setTheme(toTheme(savedPrefs.theme));
        if (savedPrefs.indicators) setIndicators(savedPrefs.indicators);
        // On page reload, we always show the watchlist (ongoing list) first to avoid launching directly into profile/subscription
        setActiveTab('chart');
        setJournalTab('ongoing');
        if (savedPrefs.pinnedText) setPinnedText(savedPrefs.pinnedText);
        if (savedPrefs.selectedTimeframeId) {
          const tf = TIMEFRAMES.find(t => t.id === savedPrefs.selectedTimeframeId);
          if (tf) setSelectedTimeframe(tf);
        }
        if (savedPrefs.positionsByMode) {
          setPositionsByMode(savedPrefs.positionsByMode);
        }
        if (savedPrefs.drawingSettingsPosByMode) {
          setDrawingSettingsPosByMode(savedPrefs.drawingSettingsPosByMode);
        } else {
          // Backwards compatibility migration
          setPositionsByMode(prev => ({
            ...prev,
            desktop: {
              toolbar: savedPrefs.toolbarPosition || prev.desktop.toolbar,
              favorites: savedPrefs.favoritesPosition || prev.desktop.favorites,
              simControls: savedPrefs.simControlsPosition || prev.desktop.simControls,
            },
            mobilePortrait: {
              toolbar: savedPrefs.toolbarPositionPortrait || prev.mobilePortrait.toolbar,
              favorites: savedPrefs.favoritesPositionPortrait || prev.mobilePortrait.favorites,
              simControls: savedPrefs.simControlsPositionPortrait || prev.mobilePortrait.simControls,
            }
          }));
        }
        
        if (savedPrefs.favorites && savedPrefs.favorites.length > 0) {
          const filteredFavorites = (savedPrefs.favorites as DrawingType[]).filter(
            t => t !== DrawingType.LONG_POSITION && t !== DrawingType.SHORT_POSITION
          );
          setFavorites(filteredFavorites);
        } else {
          // Default favorites if empty
          setFavorites([
            DrawingType.TREND_LINE,
            DrawingType.HORIZONTAL_LINE,
            DrawingType.RECTANGLE,
            DrawingType.FIB_RETRACEMENT,
            DrawingType.PATH,
            DrawingType.PRICE_RANGE
          ]);
        }
        if (savedPrefs.showFavoritesByMode !== undefined) setShowFavoritesByMode(savedPrefs.showFavoritesByMode);
        if (savedPrefs.showToolbarByMode !== undefined) setShowToolbarByMode(savedPrefs.showToolbarByMode);
        
        // Backwards compatibility
        if (savedPrefs.showFavoritesByMode === undefined && savedPrefs.showFavorites !== undefined) {
          setShowFavoritesByMode(prev => ({ ...prev, [currentMode]: savedPrefs.showFavorites }));
        }
        if (savedPrefs.showToolbarByMode === undefined && savedPrefs.showToolbar !== undefined) {
          setShowToolbarByMode(prev => ({ ...prev, [currentMode]: savedPrefs.showToolbar }));
        }
        
        if (savedPrefs.drawingSettings) setDrawingSettings(savedPrefs.drawingSettings);
        if (savedPrefs.symbolViewStates !== undefined) setSymbolViewStates(savedPrefs.symbolViewStates);
        
        if (savedPrefs.activePrefix !== undefined) setActivePrefix(savedPrefs.activePrefix);
        if (savedPrefs.activeWatchlistItemId) setActiveWatchlistItemId(savedPrefs.activeWatchlistItemId);
        
        // Restore activeWatchlistItemId fallback based on selected symbol and prefix if not directly available
        if (!savedPrefs.activeWatchlistItemId && savedPrefs.lastSelectedSymbol && savedWatchlist && Array.isArray(savedWatchlist)) {
           const symbol = normalizeSymbol(savedPrefs.lastSelectedSymbol);
           const prefix = savedPrefs.activePrefix || null;
           const item = savedWatchlist.find(i => normalizeSymbol(i.symbol) === symbol && (i.prefix || null) === prefix);
           if (item) {
             setActiveWatchlistItemId(item.id || `wl_${item.symbol}_${item.prefix || ''}_legacy`);
           }
        }
      }

      // Mark initialized ONLY after everything is set
      setIsWatchlistLoading(false);
      setIsDataInitialized(true);
      console.log('[Persistence] Data initialization complete.');
    } catch (err) {
      console.error('Failed to load user data:', err);
      addNotification('Failed to sync data with cloud. Please check your connection.', 'error');
      // Do NOT set initialized to true if loading failed, otherwise background saves might wipe cloud data with local empty state
      setIsWatchlistLoading(false);
    }
  };

  // Sync Drawings (Optimized debounce for speed)
  useEffect(() => {
    if (session?.user?.id && isDataInitialized && !isReplayMode) {
      const timer = setTimeout(() => {
        persistenceService.saveDrawings(session.user.id, drawings)
          .catch(err => addNotification(`Sync drawings failed`, 'error'));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [drawings, session?.user?.id, isDataInitialized, isReplayMode]);

  // Sync Preferences (Optimized debounce for speed)
  useEffect(() => {
    if (session?.user?.id && isDataInitialized) {
      if (savePrefsTimeoutRef.current) clearTimeout(savePrefsTimeoutRef.current);
      
      savePrefsTimeoutRef.current = setTimeout(() => {
        persistenceService.savePreferences(session.user.id, {
          theme,
          indicators,
          activeTab,
          activeWatchlistTab: journalTab,
          selectedTimeframeId: selectedTimeframe.id,
          favorites,
          showFavoritesByMode,
          showToolbarByMode,
          positionsByMode,
          drawingSettingsPosByMode,
          drawingSettings: drawingSettings || undefined,
          lastSelectedSymbol: selectedSymbol,
          activePrefix: activePrefix || undefined,
          activeWatchlistItemId: activeWatchlistItemId || undefined,
          pinnedText: pinnedText || undefined,
          subscriptionPlan,
          symbolViewStates,
        }).catch(err => console.warn('[Sync] Failed to save preferences, will retry on next change'));
      }, 1000);
      return () => {
        if (savePrefsTimeoutRef.current) clearTimeout(savePrefsTimeoutRef.current);
      };
    }
  }, [
    theme, 
    indicators, 
    activeTab, 
    journalTab, 
    selectedTimeframe.id, 
    favorites, 
    showFavoritesByMode, 
    showToolbarByMode, 
    positionsByMode, 
    drawingSettings, 
    selectedSymbol, 
    session?.user?.id, 
    isDataInitialized, 
    activePrefix, 
    activeWatchlistItemId,
    drawingSettingsPosByMode,
    pinnedText,
    subscriptionPlan,
    symbolViewStates
  ]);

  // Sync Watchlist (Optimized debounce for speed)
  useEffect(() => {
    if (session?.user?.id && isDataInitialized) {
      if (!watchlist || watchlist.length === 0) return; // Prevent overwriting database with empty initial state during loading races
      const timer = setTimeout(() => {
        persistenceService.saveWatchlist(session.user.id, watchlist)
          .catch(err => addNotification(`Sync watchlist failed`, 'error'));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [watchlist, session?.user?.id, isDataInitialized]);

  // Sync Backtest Sessions (Optimized debounce for speed)
  useEffect(() => {
    if (session?.user?.id && isDataInitialized) {
      if (!backtestSessions || Object.keys(backtestSessions).length === 0) return; // Prevent overwriting database with empty initial/loading state
      const timer = setTimeout(() => {
        persistenceService.saveBacktestSessions(session.user.id, backtestSessions)
          .catch(err => addNotification(`Sync sessions failed`, 'error'));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [backtestSessions, session?.user?.id, isDataInitialized]);

  // Global Price Fetcher for Watchlist - DISABLED as this is a backtesting app
  /*
  useEffect(() => {
    if (watchlist.length === 0) return;
    ...
  }, [watchlist.length]);
  */

  const handleAddIndicator = (type: any, code?: string) => {
    let params: Record<string, any> = { period: 20 };
    let color = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    let category: 'INDICATOR' | 'STRATEGY' | 'SCRIPT' = 'INDICATOR';
    
    if (type === 'RSI') params = { period: 14 };
    if (type === 'MACD') params = { fast: 12, slow: 26, signal: 9 };
    if (type === 'BB') {
      params = { period: 20, stdDev: 2 };
      color = '#3b82f6';
    }
    if (type === 'VWAP') color = '#9333ea';
    if (type === 'SUPERTREND') {
      params = { period: 10, multiplier: 3 };
      color = '#10b981';
    }
    if (type === 'STOCH') params = { kPeriod: 14, dPeriod: 3, slowing: 3 };
    if (type === 'ATR') params = { period: 14 };
    if (type === 'LEVELS') {
      category = 'STRATEGY';
      color = '#f59e0b';
      params = {
        showLondon: true,
        londonStart: 8,
        londonEnd: 16,
        londonColor: "rgba(0, 255, 0, 0.05)",
        showNY: true,
        nyStart: 13,
        nyEnd: 21,
        nyColor: "rgba(0, 0, 255, 0.05)",
        showAsian: true,
        asianStart: 0,
        asianEnd: 8,
        asianColor: "rgba(255, 0, 0, 0.05)",
        showOutline: true,
        showSessionLabels: true,
        showPrevDay: true,
        prevDayCount: 1,
        prevDayColor: "#10b981",
        prevDayWidth: 1.5,
        prevDayStyle: "dashed",
        showPrevWeek: true,
        prevWeekCount: 1,
        prevWeekColor: "#3b82f6",
        prevWeekWidth: 1.5,
        prevWeekStyle: "dashed",
        showPrevMonth: true,
        prevMonthCount: 1,
        prevMonthColor: "#f59e0b",
        prevMonthWidth: 1.5,
        prevMonthStyle: "dashed",
        showVLine1: false,
        vline1Days: 3,
        vline1Time: "09:30",
        vline1ExtensionPips: 5,
        vline1Color: "#ec4899",
        vline1Width: 2,
        vline1Style: "dashed",
        showVLine2: false,
        vline2Days: 3,
        vline2Time: "14:00",
        vline2ExtensionPips: 5,
        vline2Color: "#06b6d4",
        vline2Width: 2,
        vline2Style: "dashed",
        showRayLabels: true
      };
    }
    if (type === 'SCRIPT') {
      category = 'SCRIPT';
      color = '#3b82f6';
    }

    const newIndicator: IndicatorInstance = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      category,
      params,
      code,
      color,
      lineWidth: 1.5,
      visible: true
    };
    handleIndicatorsChange([...indicators, newIndicator]);
  };

  const handleRemoveIndicator = (id: string) => {
    handleIndicatorsChange(indicators.filter(ind => ind.id !== id));
  };

  const handleUpdateIndicator = (id: string, updates: Partial<IndicatorInstance>) => {
    handleIndicatorsChange(indicators.map(ind => ind.id === id ? { ...ind, ...updates } : ind));
  };

  const toggleFavorite = (toolId: DrawingType) => {
    setFavorites(prev => 
      prev.includes(toolId) 
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
    );
  };

  const updateDrawing = (id: string, updates: Partial<Drawing>) => {
    setDrawings(prev => prev.map(d => {
      if (d.id === id) {
        const updated = { ...d, ...updates };
        if (chartEngineRef.current) {
          chartEngineRef.current.updateDrawing(updated);
        }
        if (syncedChartEngineRef.current) {
          syncedChartEngineRef.current.updateDrawing(updated);
        }
        return updated;
      }
      return d;
    }));
    if (selectedDrawing?.id === id) {
      setSelectedDrawing(prev => prev ? { ...prev, ...updates } : null);
    }
    if (selectedSyncedDrawing?.id === id) {
      setSelectedSyncedDrawing(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const deleteDrawing = (id: string) => {
    const drawing = drawings.find(d => d.id === id);
    if (drawing && (drawing.type === DrawingType.LONG_POSITION || drawing.type === DrawingType.SHORT_POSITION)) {
      const isClosed = drawing.status === 'won' || drawing.status === 'lost';
      if (isClosed) {
        addNotification(`Completed trades cannot be deleted as they represent verified execution history.`, 'error');
        return;
      }
      if (drawing.isTriggered && !isClosed) {
        addNotification(`This position cannot be deleted because the trade is currently triggered and ongoing. Complete or close the trade first.`, 'error');
        return;
      }
    }
    setDrawings(prev => prev.filter(d => d.id !== id));
    if (selectedDrawing?.id === id) setSelectedDrawing(null);
  };

  const handleMainUpdateDrawing = useCallback((updates: any) => {
    if (!selectedDrawing) return;
    updateDrawing(selectedDrawing.id, { settings: { ...selectedDrawing.settings, ...updates } });
  }, [selectedDrawing]);

  const handleMainDeleteDrawing = useCallback(() => {
    if (!selectedDrawing) return;
    deleteDrawing(selectedDrawing.id);
  }, [selectedDrawing]);

  const handleMainCloseDrawing = useCallback(() => {
    setSelectedDrawing(null);
  }, []);

  // Theme sync is handled via the preferences effect

  const loadMarketData = async (symbol: string, timeframeId: string, initialEndTime?: number, sourceOverride?: string, marketTypeOverride?: MarketType, forceTimeSnap?: boolean) => {
    if (!symbol) return;
    lastRequestedSymbolRef.current = symbol;
    lastRequestedTimeframeRef.current = timeframeId;
    hasNoMoreFutureDataRef.current = false;

    // Use explicit source/marketType if provided, otherwise find in watchlist
    let activeItem = watchlist.find(i => i.id === activeWatchlistItemId);
    
    // If not found by ID (maybe a recent navigation), try finding by symbol and prefix
    if (!activeItem) {
      activeItem = watchlist.find(i => i.symbol === symbol && (i.prefix || null) === (activePrefix || null));
    }
    
    const source = sourceOverride || activeItem?.dataSource;
    const marketType = marketTypeOverride || activeItem?.marketType;
    
    // Check if we already have this data to avoid flicker
    // We should reload if the symbol, timeframe OR source/item changed
    let hasShownInstantCache = false;
    const syncCachedState = getChartStateFromCacheSync(symbol, timeframeId, activeItem?.id || activePrefix || undefined);
    
    const needFutureCheck = isSimulating || isReplayMode || !!currentSessionKey;
    const missingRanges = syncCachedState 
      ? getMissingCandleRanges(syncCachedState.candles, initialEndTime || 0, needFutureCheck)
      : null;

    if (syncCachedState) {
      hasShownInstantCache = true;
      setHistoricalData(syncCachedState.candles);
      setRenderedTimeframeId(timeframeId);
      loadedSymbolRef.current = symbol;
      loadedTimeframeRef.current = timeframeId;

      let simToSet: number | null = null;
      let replayToSet: number | null = null;
      const viewStateKey = activeWatchlistItemId || (activePrefix ? `${symbol}_${activePrefix}` : symbol);

      if (isReplayMode) {
        // Replay Mode priority hierarchy (Sync Cache layer):
        // 1. Strict last_play_candle_time limit to prevent future jumps
        if (activeItem?.last_play_candle_time) {
          replayToSet = activeItem.last_play_candle_time;
        }
        // 2. Current active replay ref (if switching within same symbol/trade)
        else if (replayCurrentTimeRef.current !== null && loadedSymbolRef.current === symbol && lastLoadedSessionKeyRef.current === currentSessionKey && (!replayTrade || lastLoadedReplayTradeIdRef.current === replayTrade.id)) {
          replayToSet = replayCurrentTimeRef.current;
        }
        // 3. Database symbol-level playhead (shared across all devices & timeframes)
        else if (viewStateKey && symbolViewStates[viewStateKey]?.replayCurrentTime) {
          replayToSet = symbolViewStates[viewStateKey].replayCurrentTime;
        }
        // 4. Database timeframe-specific playhead
        else if (viewStateKey && symbolViewStates[viewStateKey]?.timeframeStates?.[timeframeId]?.replayCurrentTime) {
          replayToSet = symbolViewStates[viewStateKey].timeframeStates[timeframeId].replayCurrentTime;
        }
        // 5. Cached state timeframe playhead
        else if (syncCachedState && syncCachedState.replayCurrentTime !== null) {
          replayToSet = syncCachedState.replayCurrentTime;
        }
        // 6. Explicit initialEndTime passed
        else {
          replayToSet = initialEndTime || null;
        }

        const finalPlayToSet = replayToSet !== null ? replayToSet : (initialEndTime || 0);
        let snappedPlayToSet = finalPlayToSet;
        if (syncCachedState.candles && syncCachedState.candles.length > 0) {
          const firstCandleTime = syncCachedState.candles[0].time;
          if (snappedPlayToSet < firstCandleTime) {
            snappedPlayToSet = firstCandleTime;
          } else {
            const snapCandle = [...syncCachedState.candles].reverse().find(c => c.time <= snappedPlayToSet);
            if (snapCandle) {
              snappedPlayToSet = snapCandle.time;
            }
          }
        }
        replayCurrentTimeRef.current = snappedPlayToSet;
        setReplayCurrentTime(snappedPlayToSet);
      } else {
        // Simulation Playhead priority hierarchy (Sync Cache layer):
        // 1. Strict last_play_candle_time limit to prevent future jumps
        if (activeItem?.last_play_candle_time) {
          simToSet = activeItem.last_play_candle_time;
        }
        // 2. Current active simulation ref (if switching within same session/symbol)
        else if (simCurrentTimeRef.current !== null && loadedSymbolRef.current === symbol && lastLoadedSessionKeyRef.current === currentSessionKey) {
          simToSet = simCurrentTimeRef.current;
        }
        // 3. Database active session currentTime
        else if (currentSessionKey && backtestSessions[currentSessionKey]?.currentTime) {
          simToSet = backtestSessions[currentSessionKey].currentTime;
        }
        // 4. Database symbol-level playhead (synchronized 100% across all devices / timeframes)
        else if (viewStateKey && symbolViewStates[viewStateKey]?.simCurrentTime) {
          simToSet = symbolViewStates[viewStateKey].simCurrentTime;
        }
        // 5. Database timeframe-specific playhead
        else if (viewStateKey && symbolViewStates[viewStateKey]?.timeframeStates?.[timeframeId]?.simCurrentTime) {
          simToSet = symbolViewStates[viewStateKey].timeframeStates[timeframeId].simCurrentTime;
        }
        // 6. Cached state timeframe playhead
        else if (syncCachedState && syncCachedState.simCurrentTime !== null) {
          simToSet = syncCachedState.simCurrentTime;
        }
        // 7. Explicit initialEndTime passed
        else {
          simToSet = initialEndTime || null;
        }

        const finalSimToSet = simToSet !== null ? simToSet : (initialEndTime || 0);
        let snappedSimToSet = finalSimToSet;
        if (syncCachedState.candles && syncCachedState.candles.length > 0) {
          const firstCandleTime = syncCachedState.candles[0].time;
          if (snappedSimToSet < firstCandleTime) {
            snappedSimToSet = firstCandleTime;
          } else {
            const snapCandle = [...syncCachedState.candles].reverse().find(c => c.time <= snappedSimToSet);
            if (snapCandle) {
              snappedSimToSet = snapCandle.time;
            }
          }
        }
        simCurrentTimeRef.current = snappedSimToSet;
        if (currentSessionKey && sessionCurrentTimesRef.current) {
          sessionCurrentTimesRef.current[currentSessionKey] = snappedSimToSet;
        }
        setSimCurrentTime(snappedSimToSet);
      }

      if (syncCachedState.indicators && syncCachedState.indicators.length > 0) {
        setIndicators(syncCachedState.indicators);
      }

      // If we have 100% complete coverage in memory cache, we short-circuit the entire block synchronously
      if (initialEndTime && missingRanges && !missingRanges.needPast && !missingRanges.needFuture) {
        setIsLoadingPast(false);
        return;
      }
    } else if (selectedSymbol !== symbol) {
      setHistoricalData([]);
      loadedSymbolRef.current = null;
      loadedTimeframeRef.current = null;
      simCurrentTimeRef.current = null;
      setSimCurrentTime(null);
      replayCurrentTimeRef.current = null;
      setReplayCurrentTime(null);
    }
    
    if (!initialEndTime) {
      return;
    }

    setIsLoadingPast(!hasShownInstantCache);
    setRateLimitError(false);
    try {
      // 1. Check priority caching stores (In-memory -> IndexedDB)
      const cachedState = await getChartStateFromCache(symbol, timeframeId, activeItem?.id || activePrefix || undefined);

      if (cachedState) {
        const needFutureCheck = isSimulating || isReplayMode || !!currentSessionKey;
        const missingRanges = getMissingCandleRanges(cachedState.candles, initialEndTime, needFutureCheck);

        let combinedCandles = [...cachedState.candles];
        let fetchedNew = false;

        // Smart segment fetching: only request missing past/future intervals from the API
        if (missingRanges.needPast) {
          try {
            const addedPast = await fetchCandleData(symbol, timeframeId, missingRanges.needPastCount, missingRanges.needPastTargetTime, undefined, source, marketType);
            combinedCandles = [...combinedCandles, ...addedPast];
            fetchedNew = true;
          } catch (pastErr) {
            console.warn('[Cache API fallback] Failed to load missing past segments:', pastErr);
          }
        }

        if (missingRanges.needFuture) {
          try {
            const addedFuture = await fetchCandleData(symbol, timeframeId, 500, undefined, missingRanges.needFutureStartTime, source, marketType);
            combinedCandles = [...combinedCandles, ...addedFuture];
            fetchedNew = true;
          } catch (fErr) {
            console.warn('[Cache API fallback] Failed to load missing future segments:', fErr);
          }
        }

        if (fetchedNew) {
          const uniqueMap = new Map<number, Candle>();
          for (const c of combinedCandles) {
            if (c && typeof c.time === 'number') {
              uniqueMap.set(c.time, c);
            }
          }
          combinedCandles = Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
        }

        if (lastRequestedSymbolRef.current === symbol && lastRequestedTimeframeRef.current === timeframeId) {
          if (fetchedNew || !hasShownInstantCache) {
            setHistoricalData(combinedCandles);
            setRenderedTimeframeId(timeframeId);
            loadedSymbolRef.current = symbol;
            loadedTimeframeRef.current = timeframeId;

            // Restore playback position
            let simToSet: number | null = null;
            let replayToSet: number | null = null;
            const viewStateKey = activeWatchlistItemId || (activePrefix ? `${symbol}_${activePrefix}` : symbol);

            if (isReplayMode) {
              // Replay Mode priority hierarchy (Async layer):
              // 1. Strict last_play_candle_time limit to prevent future jumps
              if (activeItem?.last_play_candle_time) {
                replayToSet = activeItem.last_play_candle_time;
              }
              // 2. Current active replay ref (if switching within same symbol/trade)
              else if (replayCurrentTimeRef.current !== null && loadedSymbolRef.current === symbol && lastLoadedSessionKeyRef.current === currentSessionKey && (!replayTrade || lastLoadedReplayTradeIdRef.current === replayTrade.id)) {
                replayToSet = replayCurrentTimeRef.current;
              }
              // 3. Database symbol-level playhead (shared across all devices & timeframes)
              else if (viewStateKey && symbolViewStates[viewStateKey]?.replayCurrentTime) {
                replayToSet = symbolViewStates[viewStateKey].replayCurrentTime;
              }
              // 4. Database timeframe-specific playhead
              else if (viewStateKey && symbolViewStates[viewStateKey]?.timeframeStates?.[timeframeId]?.replayCurrentTime) {
                replayToSet = symbolViewStates[viewStateKey].timeframeStates[timeframeId].replayCurrentTime;
              }
              // 5. Cached state timeframe playhead
              else if (cachedState && cachedState.replayCurrentTime !== null) {
                replayToSet = cachedState.replayCurrentTime;
              }
              // 6. Explicit initialEndTime passed
              else {
                replayToSet = initialEndTime || null;
              }

              const finalPlayToSet = replayToSet !== null ? replayToSet : (initialEndTime || 0);
              let snappedPlayToSet = finalPlayToSet;
              if (combinedCandles && combinedCandles.length > 0) {
                const firstCandleTime = combinedCandles[0].time;
                if (snappedPlayToSet < firstCandleTime) {
                  snappedPlayToSet = firstCandleTime;
                } else {
                  const snapCandle = [...combinedCandles].reverse().find(c => c.time <= snappedPlayToSet);
                  if (snapCandle) {
                    snappedPlayToSet = snapCandle.time;
                  }
                }
              }
              replayCurrentTimeRef.current = snappedPlayToSet;
              setReplayCurrentTime(snappedPlayToSet);
            } else {
              // Simulation Playhead priority hierarchy (Async layer):
              // 1. Strict last_play_candle_time limit to prevent future jumps
              if (activeItem?.last_play_candle_time) {
                simToSet = activeItem.last_play_candle_time;
              }
              // 2. Current active simulation ref (if switching within same session/symbol)
              else if (simCurrentTimeRef.current !== null && loadedSymbolRef.current === symbol && lastLoadedSessionKeyRef.current === currentSessionKey) {
                simToSet = simCurrentTimeRef.current;
              }
              // 3. Database active session currentTime
              else if (currentSessionKey && backtestSessions[currentSessionKey]?.currentTime) {
                simToSet = backtestSessions[currentSessionKey].currentTime;
              }
              // 4. Database symbol-level playhead (synchronized 100% across all devices / timeframes)
              else if (viewStateKey && symbolViewStates[viewStateKey]?.simCurrentTime) {
                simToSet = symbolViewStates[viewStateKey].simCurrentTime;
              }
              // 5. Database timeframe-specific playhead
              else if (viewStateKey && symbolViewStates[viewStateKey]?.timeframeStates?.[timeframeId]?.simCurrentTime) {
                simToSet = symbolViewStates[viewStateKey].timeframeStates[timeframeId].simCurrentTime;
              }
              // 6. Cached state timeframe playhead
              else if (cachedState && cachedState.simCurrentTime !== null) {
                simToSet = cachedState.simCurrentTime;
              }
              // 7. Explicit initialEndTime passed
              else {
                simToSet = initialEndTime || null;
              }

              const finalSimToSet = simToSet !== null ? simToSet : (initialEndTime || 0);
              let snappedSimToSet = finalSimToSet;
              if (combinedCandles && combinedCandles.length > 0) {
                const firstCandleTime = combinedCandles[0].time;
                if (snappedSimToSet < firstCandleTime) {
                  snappedSimToSet = firstCandleTime;
                } else {
                  const snapCandle = [...combinedCandles].reverse().find(c => c.time <= snappedSimToSet);
                  if (snapCandle) {
                    snappedSimToSet = snapCandle.time;
                  }
                }
              }
              simCurrentTimeRef.current = snappedSimToSet;
              if (currentSessionKey && sessionCurrentTimesRef.current) {
                sessionCurrentTimesRef.current[currentSessionKey] = snappedSimToSet;
              }
              setSimCurrentTime(snappedSimToSet);
            }

            // Restore cached indicators
            if (cachedState.indicators && cachedState.indicators.length > 0) {
              setIndicators(cachedState.indicators);
            }
          }

          // Asynchronously re-save cache to optimize pruning & record merged segments
          saveChartStateToCache(
            symbol,
            timeframeId,
            activeItem?.id || activePrefix || undefined,
            combinedCandles,
            simCurrentTimeRef.current,
            replayCurrentTimeRef.current,
            indicators
          ).catch(() => {});
        }
      } else {
        // 2. Fallback to full API retrieve if no cache exists
        const dataPast = await fetchCandleData(symbol, timeframeId, 500, initialEndTime, undefined, source, marketType);
        
        let dataFuture: Candle[] = [];
        const sessionData = currentSessionKey ? backtestSessionsRef.current[currentSessionKey] : null;

        if (sessionData || isSimulating || isReplayMode) {
          try {
            dataFuture = await fetchCandleData(symbol, timeframeId, 500, undefined, initialEndTime + 1, source, marketType);
          } catch (fErr) {
            console.warn('Failed to fetch future candles initially:', fErr);
          }
        }

        const uniqueMap = new Map<number, Candle>();
        for (const candle of [...dataPast, ...dataFuture]) {
          if (candle && typeof candle.time === 'number') {
            uniqueMap.set(candle.time, candle);
          }
        }
        const combined = Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);

        if (combined.length === 0) {
          addNotification(`No candle data found for ${symbol} on ${timeframeId}`, 'info');
        }

        if (lastRequestedSymbolRef.current === symbol && lastRequestedTimeframeRef.current === timeframeId) {
          if (combined.length > 0) {
            setHistoricalData(combined);
            setRenderedTimeframeId(timeframeId);
            loadedSymbolRef.current = symbol;
            loadedTimeframeRef.current = timeframeId;
            
            if (!isReplayMode) {
              if (simCurrentTimeRef.current === null || lastLoadedSessionKeyRef.current !== currentSessionKey || forceTimeSnap) {
                const targetTime = activeItem?.last_play_candle_time || initialEndTime;
                const snapCandle = combined.find(c => c.time >= targetTime);
                const timeToSet = snapCandle ? snapCandle.time : targetTime;
                
                simCurrentTimeRef.current = timeToSet;
                if (currentSessionKey && sessionCurrentTimesRef.current) {
                  sessionCurrentTimesRef.current[currentSessionKey] = timeToSet;
                }
                setSimCurrentTime(timeToSet);
              }
            } else {
              if (replayCurrentTimeRef.current === null) {
                const targetTime = activeItem?.last_play_candle_time || initialEndTime;
                replayCurrentTimeRef.current = targetTime;
                setReplayCurrentTime(targetTime);
              }
            }
          } else {
            setHistoricalData([]);
            loadedSymbolRef.current = null;
            loadedTimeframeRef.current = null;
            if (!isReplayMode) {
              setSimCurrentTime(null);
            }
          }

          // Save fresh state to priority caching stores
          saveChartStateToCache(
            symbol,
            timeframeId,
            activeItem?.id || activePrefix || undefined,
            combined,
            simCurrentTimeRef.current,
            replayCurrentTimeRef.current,
            indicators
          ).catch(() => {});
        }
      }
    } catch (err: any) {
      const isFailedToFetch = err instanceof TypeError && err.message === 'Failed to fetch';
      if (err?.message === 'RATE_LIMIT') {
        setRateLimitError(true);
        addNotification('Rate limit reached. Please wait a minute.', 'error');
      } else if (isFailedToFetch) {
        console.warn('Postponed loading chart data: developer server restarting or offline.');
      } else {
        const errorMsg = err instanceof Error ? err.message : String(err);
        addNotification(`Failed to load ${symbol}: ${errorMsg}`, 'error');
      }
      if (isFailedToFetch) {
        console.warn('Failed to load market data due to offline/restart sequence:', err);
      } else {
        console.error('Failed to load market data:', err);
      }
      if (lastRequestedSymbolRef.current === symbol && lastRequestedTimeframeRef.current === timeframeId) {
        setHistoricalData([]);
        loadedSymbolRef.current = null;
        loadedTimeframeRef.current = null;
      }
    } finally {
      setIsLoadingPast(false);
    }
  };

  const lastLoadedSessionKeyRef = useRef<string | null>(null);
  const lastLoadedReplayTradeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedSymbol) return;
    
    const sessionData = currentSessionKey ? backtestSessions[currentSessionKey] : null;

    if (sessionData) {
      let timeToLoad: number;
      if (lastLoadedSessionKeyRef.current !== currentSessionKey) {
        // Switching to a different session/pair!
        // Find matching watchlist item
        const matchingWatchlistItem = watchlist.find(item => {
          if (currentSessionKey && currentSessionKey.startsWith('wl_')) {
            return item.id === currentSessionKey;
          }
          return item.id === currentSessionKey || (item.symbol === selectedSymbol && (item.prefix || '') === (activePrefix || ''));
        });

        const start_time = matchingWatchlistItem?.start_time || sessionData.startTime;
        const last_play_candle_time = matchingWatchlistItem?.last_play_candle_time;
        
        let baseTime = last_play_candle_time || sessionData.currentTime || start_time;

        const isTSEnabled = sessionData.timeSyncEnabled || matchingWatchlistItem?.timeSync;

        if (isTSEnabled) {
          // Sync watchlist timestamp and refresh sync timestamps without advancing playhead time
          sessionData.timeSyncLastTimestamp = Date.now();

          setBacktestSessions(prev => ({
            ...prev,
            [currentSessionKey]: {
              ...prev[currentSessionKey],
              timeSyncLastTimestamp: Date.now()
            }
          }));

          setWatchlist(prev => {
            const updated = prev.map(item => {
              const matchesId = matchingWatchlistItem && item.id === matchingWatchlistItem.id;
              const matchesLegacy = (!matchingWatchlistItem || !matchingWatchlistItem.id || !matchingWatchlistItem.id.startsWith('wl_')) &&
                (!currentSessionKey || !currentSessionKey.startsWith('wl_')) &&
                item.symbol === selectedSymbol && (item.prefix || '') === (activePrefix || '');
              if (matchesId || matchesLegacy) {
                return {
                  ...item,
                  lastCandlePlayAt: Date.now()
                };
              }
              return item;
            });
            if (session?.user?.id) {
              persistenceService.saveWatchlist(session.user.id, updated).catch(() => {});
            }
            return updated;
          });
        }
        
        timeToLoad = baseTime;
        lastLoadedSessionKeyRef.current = currentSessionKey;
        
        // Sync state & refs immediately
        sessionCurrentTimesRef.current[currentSessionKey] = timeToLoad;
        simCurrentTimeRef.current = timeToLoad;
        simTimeSessionKeyRef.current = currentSessionKey;
        setSimCurrentTime(timeToLoad);

        // Restore play state from persisted session
        setSimIsPlaying(!!sessionData.isPlaying);
      } else {
        // Same session/pair (e.g. changing chart timeframe)
        // Load around the active playhead using the up-to-date ref to avoid stale closures
        timeToLoad = simCurrentTimeRef.current || sessionData.currentTime || sessionData.startTime;
      }

      loadMarketData(selectedSymbol, selectedTimeframe.id, timeToLoad, activeWatchlistItem?.dataSource, activeWatchlistItem?.marketType);
      setIsSimulating(!isMobile);
    } else {
      lastLoadedSessionKeyRef.current = null;
      if (isReplayMode && replayTrade) {
        let timeToLoad: number;
        if (lastLoadedReplayTradeIdRef.current !== replayTrade.id) {
          timeToLoad = replayTrade.entryTime;
          lastLoadedReplayTradeIdRef.current = replayTrade.id;
          replayCurrentTimeRef.current = timeToLoad;
          setReplayCurrentTime(timeToLoad);
        } else {
          timeToLoad = replayCurrentTimeRef.current || replayTrade.entryTime;
        }

        const activeItem = watchlistRef.current.find(i => i.id === replayTrade.watchlistId) || 
                           watchlistRef.current.find(i => i.symbol === selectedSymbol && (i.prefix || null) === (replayTrade.prefix || null));
        const source = activeItem?.dataSource || activeWatchlistItem?.dataSource;
        const marketType = activeItem?.marketType || activeWatchlistItem?.marketType;

        loadMarketData(selectedSymbol, selectedTimeframe.id, timeToLoad, source, marketType);
      } else {
        lastLoadedReplayTradeIdRef.current = null;
      }
    }
  }, [
    selectedSymbol,
    selectedTimeframe.id,
    activePrefix,
    activeWatchlistItemId,
    activeWatchlistItem?.dataSource,
    activeWatchlistItem?.marketType,
    currentSessionKey,
    isReplayMode,
    replayTrade
  ]);

  const loadMorePast = async () => {
    if (isLoadingPast || isLoadingMorePast || historicalData.length === 0 || !selectedSymbol) return;
    
    // SAFETY CHECK: Ensure current memory has updated to the selected pair first
    if (loadedSymbolRef.current !== selectedSymbol || loadedTimeframeRef.current !== selectedTimeframe.id) {
      console.warn('[loadMorePast] Loaded data symbol/timeframe mismatch. Aborting past prefetch.');
      return;
    }
    
    setIsLoadingMorePast(true);
    try {
      const activeItem = watchlist.find(i => i.id === activeWatchlistItemId);
      const source = activeItem?.dataSource;

      const oldestCandle = historicalData[0];
      // Binance endTime is inclusive, so we subtract 1s to get previous data
      const endTime = oldestCandle.time - 1; // ALREADY IN SECONDS
      const olderData = await fetchCandleData(selectedSymbol, selectedTimeframe.id, 500, endTime, undefined, source, activeItem?.marketType);
      
      if (olderData.length > 0) {
        setHistoricalData(prev => {
          const uniqueMap = new Map<number, Candle>();
          for (const candle of [...olderData, ...prev]) {
            if (candle && typeof candle.time === 'number') {
              uniqueMap.set(candle.time, candle);
            }
          }
          return Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
        });
      } else {
        addNotification(`No more historical data available for ${selectedSymbol}`, 'info');
      }
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      addNotification(`Failed to load more data: ${errorMsg}`, 'error');
      console.error('Failed to load older data:', err);
    } finally {
      setIsLoadingMorePast(false);
    }
  };

  const loadMoreFuture = async () => {
    if (isLoadingPast || isLoadingMoreFuture || historicalDataRef.current.length === 0 || !selectedSymbol) return;
    
    // SAFETY CHECK: Ensure current memory has updated to the selected pair first
    if (loadedSymbolRef.current !== selectedSymbol || loadedTimeframeRef.current !== selectedTimeframe.id) {
      console.warn('[loadMoreFuture] Loaded data symbol/timeframe mismatch. Aborting future prefetch.');
      return;
    }
    
    const latestCandle = historicalDataRef.current[historicalDataRef.current.length - 1];
    if (!latestCandle) return;
    
    // Fetch subsequent data starting from latestCandle.time + 1
    const startTime = latestCandle.time + 1;
    
    // Safety check: Don't repeat identical empty/failed loads (unless we had an error and wants to retry)
    if (lastTriedFutureStartTimeRef.current === startTime && !futureFetchError) {
      return;
    }
    
    lastTriedFutureStartTimeRef.current = startTime;
    setIsLoadingMoreFuture(true);
    setFutureFetchError(null); // Clear any previous error before attempting to load
    try {
      const activeItem = watchlistRef.current.find(i => i.id === activeWatchlistItemId);
      const source = activeItem?.dataSource;
      const futureData = await fetchCandleData(selectedSymbol, selectedTimeframe.id, 500, undefined, startTime, source, activeItem?.marketType);
      
      if (futureData.length > 0) {
        setHistoricalData(prev => {
          const uniqueMap = new Map<number, Candle>();
          for (const candle of [...prev, ...futureData]) {
            if (candle && typeof candle.time === 'number') {
              uniqueMap.set(candle.time, candle);
            }
          }
          return Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
        });
        setFutureFetchError(null); // Explicit clear on success
        hasNoMoreFutureDataRef.current = false;
      } else {
        hasNoMoreFutureDataRef.current = true;
      }
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to load more future data:', err);
      
      // Store the specific error message to notify and render
      setFutureFetchError(errorMsg);
      // Reset this ref so that future manual or auto-retry attempts aren't blocked by the safety check above
      lastTriedFutureStartTimeRef.current = null;
      // Stop playback straight away to alert the user that progress/playhead is halted due to network/API error
      setSimIsPlaying(false);
      setReplayIsPlaying(false);
      
      addNotification(`Failed to load additional market data: ${errorMsg}. Tap retry to resume.`, 'error');
    } finally {
      setIsLoadingMoreFuture(false);
    }
  };

  // Pre-fetch future simulation/replay candles as the playhead draws near the end of our buffer (70% played / 30% remaining point)
  useEffect(() => {
    const effectiveTime = isReplayMode ? replayCurrentTime : simCurrentTime;
    if (!effectiveTime || historicalData.length === 0 || isLoadingMoreFuture || isLoadingPast) return;
    
    // Count how many candles in historicalData represent future relative to our current playhead
    const futureCandlesCount = historicalData.filter(c => c.time > effectiveTime).length;
    
    // If we have 150 or fewer future candles left (denoting we played to around 70% of our 500-unit fetch buffer), fetch next chunk
    if (futureCandlesCount <= 150) {
      loadMoreFuture();
    }
  }, [simCurrentTime, replayCurrentTime, isReplayMode, historicalData, selectedTimeframe, isLoadingMoreFuture, isLoadingPast]);

  const handleSelectSymbol = (symbol: string, prefix?: string, id?: string, source?: string, marketType?: MarketType) => {
    const clickedItem = id ? watchlist.find(i => i.id === id) : watchlist.find(i => i.symbol === symbol && (i.prefix || null) === (prefix || null));
    const clickedWatchlistItemId = clickedItem?.id || null;
    const currentChartId = activeWatchlistItemId;
    const isDifferentPair = clickedWatchlistItemId !== currentChartId;

    if (isDifferentPair) {
      // 1. Completely clear all previous chart cache (IndexedDB and memory cache)
      clearAllLocalChartCaches().catch(() => {});

      // 2. Completely clear candle data query cache
      clearMarketDataCache();

      // Clear the previously selected watchlist pair's active states and timeline refs
      setHistoricalData([]);
      loadedSymbolRef.current = null;
      loadedTimeframeRef.current = null;
      simCurrentTimeRef.current = null;
      setSimCurrentTime(null);
      replayCurrentTimeRef.current = null;
      setReplayCurrentTime(null);
    } else {
      // Save current active symbol timeframe state only if we are reusing/refreshing within the same pair
      if (selectedSymbol && selectedTimeframe) {
        saveChartStateToCache(
          selectedSymbol,
          selectedTimeframe.id,
          activeWatchlistItemId || activePrefix || undefined,
          historicalData,
          simCurrentTimeRef.current,
          replayCurrentTimeRef.current,
          indicators
        ).catch(() => {});

        updateSymbolViewStateTimeframe(
          selectedTimeframe.id,
          simCurrentTimeRef.current,
          replayCurrentTimeRef.current,
          indicators
        );
      }
    }

    const sessionKey = id || (prefix ? `${symbol}_${prefix}` : symbol);
    const fallbackKey = prefix ? `${symbol}_${prefix}` : symbol;
    if (backtestSessions[sessionKey] || backtestSessions[fallbackKey]) {
      setActivePrefix(prefix || null);
      setSelectedSymbol(symbol);
      setSimIsPlaying(false);
      setReplayIsPlaying(false);
      if (id) {
        setActiveWatchlistItemId(id);
      } else {
        // Fallback for searches/old items - try to find in current watchlist to get an ID
        const item = watchlist.find(i => i.symbol === symbol && (i.prefix || null) === (prefix || null));
        if (item) {
          setActiveWatchlistItemId(item.id);
        } else {
          // If not in watchlist yet (e.g. new search), we might not have an ID yet
          setActiveWatchlistItemId(null);
        }
      }
      setIsSimulating(!isMobile);
    } else {
      // From Search Modal or Popular List (no session) or specific watchlist item but session missing
      setShowBacktestSetup({ symbol, source, marketType });
    }
  };

  const handleExtendWatchlistItem = (id: string, newEndTimeSeconds: number) => {
    const nextWatchlist = watchlist.map(item => {
      if (item.id === id) {
        return {
          ...item,
          end_time: newEndTimeSeconds,
          status: 'ongoing' as const,
          hasBeenExtended: true
        };
      }
      return item;
    });
    setWatchlist(nextWatchlist);

    const nextSessions = { ...backtestSessions };
    const item = watchlist.find(i => i.id === id);
    if (item) {
      if (nextSessions[id]) {
        nextSessions[id] = {
          ...nextSessions[id],
          endTime: newEndTimeSeconds,
          createdAt: newEndTimeSeconds * 1000,
          isCompleted: false
        };
      }
      const sessionKey = item.prefix ? `${item.symbol}_${item.prefix}` : item.symbol;
      if (nextSessions[sessionKey]) {
        nextSessions[sessionKey] = {
          ...nextSessions[sessionKey],
          endTime: newEndTimeSeconds,
          createdAt: newEndTimeSeconds * 1000,
          isCompleted: false
        };
      }
    }
    setBacktestSessions(nextSessions);

    if (session?.user?.id) {
      persistenceService.saveWatchlist(session.user.id, nextWatchlist).catch(() => {});
      persistenceService.saveBacktestSessions(session.user.id, nextSessions).catch(() => {});
      addNotification(`Successfully extended end date for ${item?.symbol || 'symbol'}`, 'success');
    }
  };

  const handleDeleteWatchlistItem = (symbol: string, prefix?: string, id?: string) => {
    const itemToDelete = watchlist.find(item => {
      if (id) return item.id === id;
      return item.symbol === symbol && (item.prefix || '') === (prefix || '');
    });

    if (itemToDelete && (itemToDelete.status === 'completed' || itemToDelete.hasBeenExtended)) {
      addNotification("Completed or once extension-selected trading sessions cannot be deleted", 'error');
      return;
    }

    // 1. Update watchlist
    const nextWatchlist = watchlist.filter(item => {
      if (id) return item.id !== id;
      return !(item.symbol === symbol && (item.prefix || '') === (prefix || ''));
    });
    setWatchlist(nextWatchlist);
    
    // 2. Update drawings (perfectly isolated cleanup to prevent leaks or collateral data loss)
    const nextDrawings = drawings.filter(d => {
      if (id && (d.watchlistId === id || d.settings?.watchlistId === id)) {
        return false;
      }
      const matchSymAndPrefix = d.symbol === symbol && (d.prefix || '') === (prefix || '');
      if (matchSymAndPrefix && !d.watchlistId && !d.settings?.watchlistId) {
        const anyRemaining = nextWatchlist.some(item => item.symbol === symbol && (item.prefix || '') === (prefix || ''));
        if (!anyRemaining) {
          return false;
        }
      }
      return true;
    });
    setDrawings(nextDrawings);

    // 3. Update journal trades (perfectly isolated cleanup)
    const nextTrades = journalTrades.filter(t => {
      if (id && t.watchlistId === id) {
        return false;
      }
      const matchSymAndPrefix = t.symbol === symbol && (t.prefix || '') === (prefix || '');
      if (matchSymAndPrefix && !t.watchlistId) {
        const anyRemaining = nextWatchlist.some(item => item.symbol === symbol && (item.prefix || '') === (prefix || ''));
        if (!anyRemaining) {
          return false;
        }
      }
      return true;
    });
    setJournalTrades(nextTrades);
    
    // 4. Update backtest sessions (delete ID-keyed session and old fallback key)
    const nextSessions = { ...backtestSessions };
    if (id) {
      delete nextSessions[id];
    }
    const normalizedPrefix = prefix || '';
    const sessionKey = normalizedPrefix ? `${symbol}_${normalizedPrefix}` : symbol;
    delete nextSessions[sessionKey];
    setBacktestSessions(nextSessions);

    // Synchronously clean custom current times refs
    if (sessionCurrentTimesRef.current) {
      if (id) {
        delete sessionCurrentTimesRef.current[id];
      }
      delete sessionCurrentTimesRef.current[sessionKey];
    }
    
    // 5. Persistence
    if (session?.user?.id) {
      persistenceService.saveWatchlist(session.user.id, nextWatchlist);
      persistenceService.saveDrawings(session.user.id, nextDrawings);
      persistenceService.saveBacktestSessions(session.user.id, nextSessions);
      if (id) {
        persistenceService.deleteTradesByWatchlistId(session.user.id, id);
      }
      persistenceService.deleteTradesForSymbol(session.user.id, symbol, prefix, id);
      addNotification(`Perfectly deleted all database records and session parameters for ${symbol}${prefix ? ` (${prefix})` : ''}`, 'success');
    }
    
    // 6. Cleanup current view state from symbolViewStates permanently to prevent memory/database bloat
    const nextViewStates = { ...symbolViewStates };
    if (id) {
      delete nextViewStates[id];
    }
    delete nextViewStates[sessionKey];
    delete nextViewStates[symbol];
    setSymbolViewStates(nextViewStates);

    if (session?.user?.id) {
      persistenceService.savePreferences(session.user.id, { symbolViewStates: nextViewStates }).catch(() => {});
    }

    // 7. Cleanup current view if needed
    if (selectedSymbol === symbol && (activePrefix === (prefix || null) || (id && activeWatchlistItemId === id))) {
      setSelectedSymbol(null);
      setActivePrefix(null);
      setActiveWatchlistItemId(null);
      setHistoricalData([]);
    }
  };

  const handleResetView = useCallback(() => {
    const key = activeWatchlistItemId || (selectedSymbol ? (activePrefix ? `${selectedSymbol}_${activePrefix}` : selectedSymbol) : null);
    if (key) {
      setSymbolViewStates(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          viewport: undefined
        }
      }));
      if (chartEngineRef.current) {
        chartEngineRef.current.resetView();
      }
      if (syncedSymbol && syncedChartEngineRef.current) {
        syncedChartEngineRef.current.resetView();
      }
      addNotification(syncedSymbol ? 'Both chart views reset' : 'Chart view reset', 'info');
    }
  }, [selectedSymbol, activePrefix, activeWatchlistItemId, syncedSymbol, addNotification]);

  const handleRefreshChart = useCallback(() => {
    if (selectedSymbol) {
      setSymbolViewStates(prev => ({
        ...prev,
        [selectedSymbol]: {
          ...prev[selectedSymbol],
          viewport: undefined
        }
      }));
      if (chartEngineRef.current) {
        chartEngineRef.current.resetView();
      }
      const sessionData = currentSessionKey ? backtestSessions[currentSessionKey] : null;
      let timeToLoad = simCurrentTime || (sessionData ? (sessionData.currentTime || sessionData.startTime) : undefined);
      if (!timeToLoad) {
        timeToLoad = Math.floor(Date.now() / 1000) - (86400 * 30);
      }
      loadMarketData(selectedSymbol, selectedTimeframe.id, timeToLoad, activeWatchlistItem?.dataSource, activeWatchlistItem?.marketType);
      
      if (syncedSymbol) {
        if (syncedChartEngineRef.current) {
          syncedChartEngineRef.current.resetView();
        }
        loadSyncedMarketData(
          syncedSymbol,
          syncedTimeframe.id,
          timeToLoad,
          syncedDataSource || undefined,
          syncedMarketType || undefined
        );
        addNotification('Both charts fully refreshed and reloaded', 'success');
      } else {
        addNotification('Chart fully refreshed and reloaded', 'success');
      }
    }
  }, [
    selectedSymbol,
    selectedTimeframe,
    simCurrentTime,
    currentSessionKey,
    backtestSessions,
    activeWatchlistItem,
    loadMarketData,
    syncedSymbol,
    syncedTimeframe,
    syncedDataSource,
    syncedMarketType,
    loadSyncedMarketData,
    addNotification
  ]);

  const getStepSeconds = useCallback(() => {
    return selectedTimeframe.seconds;
  }, [selectedTimeframe]);

  // Keep track of the last emitted candle and step to avoid heavy re-renders when there is no step change
  const lastEmittedTickRef = useRef<{ time: number; step: number } | null>(null);
  useEffect(() => {
    lastEmittedTickRef.current = null;
  }, [selectedSymbol, selectedTimeframe, isReplayMode, simIsPlaying, replayIsPlaying]);

  // Limit simulation/replay progression with a high-performance throttled animation loop
  useEffect(() => {
    const isPlaying = isReplayMode ? replayIsPlaying : simIsPlaying;
    const isActive = isReplayMode || isSimulating || simIsPlaying;

    if (!isPlaying || !isActive) {
      if (playbackAnimationRef.current) {
        cancelAnimationFrame(playbackAnimationRef.current);
        playbackAnimationRef.current = null;
      }
      return;
    }

    let lastTime = performance.now();
    let accumulatorMs = 0;
    const FRAME_INTERVAL = 45; // ~22 FPS is extremely fluid but consumes 3x less React rendering cycles than full monitor RAF

    const tick = () => {
      const now = performance.now();
      let elapsedMs = now - lastTime;
      lastTime = now;

      // Protection from browser tab suspension or heavy GPU rendering lag.
      // Capping at FRAME_INTERVAL * 1.2 ensures that if there's any lag or heavy calculations,
      // the playhead will NOT skip or fast-forward through weeks of future loaded candles instantly.
      // It keeps tick-by-tick increment speed completely realistic and accurate.
      if (elapsedMs > FRAME_INTERVAL * 1.2) {
        elapsedMs = FRAME_INTERVAL;
      }

      accumulatorMs += elapsedMs;

      // Keep scheduling the next frame immediately
      playbackAnimationRef.current = requestAnimationFrame(tick);

      // Throttling state updates so React handles rendering processes smoothly
      if (accumulatorMs < FRAME_INTERVAL) {
        return;
      }

      const deltaMs = accumulatorMs;
      accumulatorMs = 0;

      // PROTECTION: Prevent progressing the clock if we are currently loading historical data,
      // or if the loaded symbol or timeframe doesn't match the selected symbol or timeframe.
      // This completely solves the race condition where switching watchlist items updates the playhead
      // (simCurrentTime/replayCurrentTime) before React has completed loading and updating historicalDataRef
      // for the new symbol.
      if (isLoadingPastRef.current) {
        return;
      }

      const currentSelectedSymbol = selectedSymbolRef.current;
      const currentSelectedTimeframeId = selectedTimeframeRef.current?.id;

      if (loadedSymbolRef.current !== currentSelectedSymbol || loadedTimeframeRef.current !== currentSelectedTimeframeId) {
        // Skip tick because the loaded data is empty, still loading, or for a different symbol/timeframe!
        return;
      }

      if (isReplayMode && replayTrade) {
        const timeframeSeconds = TIMEFRAMES.find(tf => tf.id.toLowerCase() === replayTrade.timeframe.toLowerCase() || tf.label.toLowerCase() === replayTrade.timeframe.toLowerCase())?.seconds || 60;
        const maxReplayTime = replayTrade.exitTime + (10 * timeframeSeconds);
        const current = replayCurrentTimeRef.current || 0;

        if (historicalDataRef.current.length > 0) {
          const currentData = historicalDataRef.current;
          
          let candleIdx = -1;
          for (let i = currentData.length - 1; i >= 0; i--) {
            if (currentData[i].time <= current) {
              candleIdx = i;
              break;
            }
          }

          let progress = 0;
          if (candleIdx === -1) {
            candleIdx = 0;
            progress = 0;
          } else {
            const gapSeconds = (candleIdx + 1 < currentData.length) ? (currentData[candleIdx + 1].time - currentData[candleIdx].time) : timeframeSeconds;
            progress = Math.max(0, Math.min(0.999, (current - currentData[candleIdx].time) / gapSeconds));
          }

          const currentPos = candleIdx + progress;
          const getCandleDurationForSpeed = (speed: number) => {
            if (speed === 1) return 5;
            if (speed === 2) return 4;
            if (speed === 3) return 3;
            if (speed === 4) return 2;
            if (speed < 1) return 5 / (speed || 1);
            return Math.max(0.5, 6 - speed);
          };
          const playDuration = getCandleDurationForSpeed(simSpeed);
          const addedIndices = (deltaMs / 1000) / playDuration;
          let nextPos = currentPos + addedIndices;

          let endIdx = currentData.length - 1;
          for (let i = currentData.length - 1; i >= 0; i--) {
            if (currentData[i].time <= maxReplayTime) {
              endIdx = i;
              break;
            }
          }
          // Permit the final candle of replay mode to fully play all its 0.000 -> 0.999 tick parts completely.
          const maxPos = endIdx + 0.999;

          if (nextPos >= maxPos) {
            nextPos = maxPos;
            setReplayIsPlaying(false);
            addNotification('End of replay reached', 'info');
          }

          let nextCandleIdx = Math.floor(nextPos);
          let nextProgress = nextPos - nextCandleIdx;
          if (nextCandleIdx >= currentData.length) {
            nextCandleIdx = currentData.length - 1;
            nextProgress = 0.999;
          }

          const tT = Math.max(1, Math.floor(timeframeSeconds / 2));
          lastActiveTickIndexRef.current = Math.floor(nextProgress * tT);

          const nextGapSeconds = (nextCandleIdx + 1 < currentData.length) ? (currentData[nextCandleIdx + 1].time - currentData[nextCandleIdx].time) : timeframeSeconds;
          const nextTime = currentData[nextCandleIdx].time + nextProgress * nextGapSeconds;

          const step = Math.floor(nextProgress * 4);
          let stepPrice = currentData[nextCandleIdx].open;
          const o = currentData[nextCandleIdx].open;
          const h = currentData[nextCandleIdx].high;
          const l = currentData[nextCandleIdx].low;
          const c = currentData[nextCandleIdx].close;
          if (c >= o) {
            if (step === 0) stepPrice = o;
            else if (step === 1) stepPrice = l;
            else if (step === 2) stepPrice = h;
            else stepPrice = c;
          } else {
            if (step === 0) stepPrice = o;
            else if (step === 1) stepPrice = h;
            else if (step === 2) stepPrice = l;
            else stepPrice = c;
          }

          replayCurrentTimeRef.current = nextTime;
          setReplayCurrentTime(nextTime);
          setSimCurrentPrice(stepPrice);
        } else {
          const getCandleDurationForSpeed = (speed: number) => {
            if (speed === 1) return 5;
            if (speed === 2) return 4;
            if (speed === 3) return 3;
            if (speed === 4) return 2;
            if (speed < 1) return 5 / (speed || 1);
            return Math.max(0.5, 6 - speed);
          };
          const playDuration = getCandleDurationForSpeed(simSpeed);
          const nextTime = current + (deltaMs / 1000) * (timeframeSeconds / playDuration);
          replayCurrentTimeRef.current = nextTime;
          setReplayCurrentTime(nextTime);
        }
      } else if (!isReplayMode) {
        const timeframeSeconds = selectedTimeframe.seconds;
        const sessionKey = currentSessionKey || '';
        const session = sessionKey ? (backtestSessionsRef.current[sessionKey] || (selectedSymbol ? backtestSessionsRef.current[activePrefix ? `${selectedSymbol}_${activePrefix}` : selectedSymbol] : null)) : null;
        
        if (!session) {
          setSimIsPlaying(false);
          return;
        }

        // To guarantee no cross-pair time contamination, let's always use the active session's playhead.
        // We look up from sessionCurrentTimesRef first, then fall back to session's own currentTime / startTime.
        const current = sessionCurrentTimesRef.current?.[sessionKey] || session.currentTime || session.startTime;

        let endTime: number | null = session?.endTime || null;

        let endLimitTime = historicalDataRef.current[historicalDataRef.current.length - 1]?.time || 0;
        if (endTime && endTime < endLimitTime) {
          endLimitTime = endTime;
        }

        if (historicalDataRef.current.length > 0) {
          const currentData = historicalDataRef.current;

          let candleIdx = -1;
          for (let i = currentData.length - 1; i >= 0; i--) {
            if (currentData[i].time <= current) {
              candleIdx = i;
              break;
            }
          }

          let progress = 0;
          if (candleIdx === -1) {
            candleIdx = 0;
            progress = 0;
          } else {
            const gapSeconds = (candleIdx + 1 < currentData.length) ? (currentData[candleIdx + 1].time - currentData[candleIdx].time) : timeframeSeconds;
            progress = Math.max(0, Math.min(0.999, (current - currentData[candleIdx].time) / gapSeconds));
          }

          const currentPos = candleIdx + progress;
          const isTimeSync = session && session.timeSyncEnabled;
          const getCandleDurationForSpeed = (speed: number) => {
            if (speed === 1) return 5;
            if (speed === 2) return 4;
            if (speed === 3) return 3;
            if (speed === 4) return 2;
            if (speed < 1) return 5 / (speed || 1);
            return Math.max(0.5, 6 - speed);
          };
          const playDuration = getCandleDurationForSpeed(simSpeed);
          const safeTimeSyncSpeed = Math.max(0.1, session?.timeSyncSpeed || 60);
          const safeTimeframeSeconds = Math.max(1, timeframeSeconds);
          const addedIndices = Math.min(0.5, isTimeSync 
            ? (deltaMs / 1000) * 60 / (safeTimeframeSeconds * safeTimeSyncSpeed)
            : (deltaMs / 1000) / playDuration);
          let nextPos = currentPos + addedIndices;

          let endIdx = currentData.length - 1;
          for (let i = currentData.length - 1; i >= 0; i--) {
            if (currentData[i].time <= endLimitTime) {
              endIdx = i;
              break;
            }
          }
          // Implement a fully ticking last candle by setting maxPos = endIdx + 0.999
          const maxPos = endIdx + 0.999;

          if (nextPos >= maxPos) {
            nextPos = maxPos;
            
            // Only stop playback if we hit the hard session end time, or if we ran out of all database data
            const hitSessionEnd = endTime && (endLimitTime >= endTime);
            if (hitSessionEnd) {
              setSimIsPlaying(false);
              addNotification('Session end date reached', 'info');
            } else if (hasNoMoreFutureDataRef.current) {
              setSimIsPlaying(false);
              addNotification('End of historical data reached', 'info');
            } else {
              // We just hit the end of our current buffer, but we have more to fetch in the future!
              // Don't stop playing, just request more future candles.
              loadMoreFuture();
            }
          }

          let nextCandleIdx = Math.floor(nextPos);
          let nextProgress = nextPos - nextCandleIdx;
          if (nextCandleIdx >= currentData.length) {
            nextCandleIdx = currentData.length - 1;
            nextProgress = 0.999;
          }

          const tT = Math.max(1, Math.floor(timeframeSeconds / 2));
          lastActiveTickIndexRef.current = Math.floor(nextProgress * tT);

          const nextGapSeconds = (nextCandleIdx + 1 < currentData.length) ? (currentData[nextCandleIdx + 1].time - currentData[nextCandleIdx].time) : timeframeSeconds;
          const nextTime = currentData[nextCandleIdx].time + nextProgress * nextGapSeconds;

          const step = Math.floor(nextProgress * 4);
          let stepPrice = currentData[nextCandleIdx].open;
          const o = currentData[nextCandleIdx].open;
          const h = currentData[nextCandleIdx].high;
          const l = currentData[nextCandleIdx].low;
          const c = currentData[nextCandleIdx].close;
          if (c >= o) {
            if (step === 0) stepPrice = o;
            else if (step === 1) stepPrice = l;
            else if (step === 2) stepPrice = h;
            else stepPrice = c;
          } else {
            if (step === 0) stepPrice = o;
            else if (step === 1) stepPrice = h;
            else if (step === 2) stepPrice = l;
            else stepPrice = c;
          }

          simCurrentTimeRef.current = nextTime;
          if (sessionCurrentTimesRef.current) {
            sessionCurrentTimesRef.current[sessionKey] = nextTime;
          }
          setSimCurrentTime(nextTime);
          setSimCurrentPrice(stepPrice);
        } else {
          const isTimeSync = session && session.timeSyncEnabled;
          const getCandleDurationForSpeed = (speed: number) => {
            if (speed === 1) return 5;
            if (speed === 2) return 4;
            if (speed === 3) return 3;
            if (speed === 4) return 2;
            if (speed < 1) return 5 / (speed || 1);
            return Math.max(0.5, 6 - speed);
          };
          const playDuration = getCandleDurationForSpeed(simSpeed);
          const safeTimeSyncSpeed = Math.max(0.1, session?.timeSyncSpeed || 60);
          const nextTime = isTimeSync
            ? current + (deltaMs / 1000) * (60 / safeTimeSyncSpeed)
            : current + (deltaMs / 1000) * (timeframeSeconds / playDuration);
          simCurrentTimeRef.current = nextTime;
          if (sessionCurrentTimesRef.current) {
            sessionCurrentTimesRef.current[sessionKey] = nextTime;
          }
          setSimCurrentTime(nextTime);
        }
      }
    };

    playbackAnimationRef.current = requestAnimationFrame(tick);
    return () => {
      if (playbackAnimationRef.current) {
        cancelAnimationFrame(playbackAnimationRef.current);
        playbackAnimationRef.current = null;
      }
    };
  }, [simIsPlaying, replayIsPlaying, isSimulating, isReplayMode, simSpeed, selectedTimeframe, addNotification, activeWatchlistItemId, activePrefix, selectedSymbol, currentSessionKey, replayTrade]);

  const filteredDrawings = useMemo(() => {
    if (!isReplayMode || !replayTrade) return drawings;

    return drawings.filter(d => {
      // Hide other Long/Short positions
      if (d.type === 'long' || d.type === 'short') {
        // Ideally we'd have a tradeId, but we can match by approximate time and symbol
        const isThisTrade = Math.abs(d.startTime - replayTrade.entryTime) < 60 && d.symbol === replayTrade.symbol;
        return isThisTrade;
      }
      // Keep other drawings (lines, rectangles, etc.)
      return true;
    });
  }, [drawings, isReplayMode, replayTrade]);

  const resolvedTickingTime = useMemo(() => {
    const isPlaying = isReplayMode ? replayIsPlaying : simIsPlaying;
    if (isPlaying) {
      return isReplayMode ? (replayCurrentTime || 0) : (simCurrentTime || 0);
    }

    let mainCandle: Candle | undefined = undefined;
    if (isReplayMode) {
      const current = replayCurrentTime || 0;
      mainCandle = [...historicalData].reverse().find(c => c.time <= current);
    } else if (isSimulating || currentSessionKey) {
      const session = currentSessionKey ? backtestSessions[currentSessionKey] : null;
      const current = simCurrentTime || (session ? session.currentTime || session.startTime : null) || 0;
      mainCandle = [...historicalData].reverse().find(c => c.time <= current);
    } else {
      mainCandle = historicalData[historicalData.length - 1];
    }

    if (mainCandle) {
      const timeframeSeconds = renderedTimeframe.seconds;
      const totalTicks = Math.max(1, Math.floor(timeframeSeconds / 2));
      const p_main = Math.max(0, Math.min(1.0, nonPlayingTickIndex / (totalTicks - 1 || 1)));
      return mainCandle.time + p_main * timeframeSeconds;
    }

    return isReplayMode ? (replayCurrentTime || 0) : (simCurrentTime || 0);
  }, [
    isReplayMode,
    replayIsPlaying,
    simIsPlaying,
    replayCurrentTime,
    simCurrentTime,
    currentSessionKey,
    backtestSessions,
    historicalData,
    renderedTimeframe,
    nonPlayingTickIndex
  ]);

  const visibleData = useMemo(() => {
    const session = currentSessionKey ? backtestSessions[currentSessionKey] : null;
    let baseTime = isReplayMode ? replayCurrentTime : (simCurrentTime || (session ? session.currentTime || session.startTime : null));
    let targetTime = baseTime ? resolvedTickingTime : null;
    
    if (!targetTime) {
      if (historicalData.length === 0) return historicalData;
      const copy = [...historicalData];
      const lastIndex = copy.length - 1;
      const lastCandle = copy[lastIndex];
      const timeframeSeconds = renderedTimeframe.seconds;
      const totalTicks = Math.max(1, Math.floor(timeframeSeconds / 2));
      
      if (theme.tickingEnabled !== false) {
        const ticking = getTickingCandleState(lastCandle, nonPlayingTickIndex, totalTicks);
        copy[lastIndex] = {
          ...lastCandle,
          close: ticking.close,
          high: ticking.high,
          low: ticking.low
        };
      }
      return copy;
    }
    
    let cutoffIndex = -1;
    for (let i = historicalData.length - 1; i >= 0; i--) {
      if (historicalData[i].time <= targetTime) {
        cutoffIndex = i;
        break;
      }
    }

    if (cutoffIndex === -1) return [];
    const filtered = historicalData.slice(0, cutoffIndex + 1);
    
    const isPlaying = isReplayMode ? replayIsPlaying : simIsPlaying;
    if (filtered.length > 0 && !isPlaying) {
      if (theme.tickingEnabled !== false) {
        const lastIndex = filtered.length - 1;
        const lastCandle = filtered[lastIndex];
        const timeframeSeconds = renderedTimeframe.seconds;
        const totalTicks = Math.max(1, Math.floor(timeframeSeconds / 2));
        
        const progress = Math.max(0, Math.min(1.0, (targetTime - lastCandle.time) / timeframeSeconds));
        const tickIdx = Math.floor(progress * (totalTicks - 1));
        const ticking = getTickingCandleState(lastCandle, tickIdx, totalTicks);
        
        filtered[lastIndex] = {
          ...lastCandle,
          close: ticking.close,
          high: ticking.high,
          low: ticking.low
        };
      }
    } else if (filtered.length > 0 && isPlaying && simCurrentPrice !== null) {
      // BACKTEST SYNC FIX: Ensure the current price and time "rhythm" across all timeframes without look-ahead bias when playing.
      const lastIndex = filtered.length - 1;
      const lastCandle = filtered[lastIndex];
      const timeframeSeconds = renderedTimeframe.seconds;
      
      if (targetTime < lastCandle.time + timeframeSeconds) {
        const elapsed = Math.max(0, targetTime - lastCandle.time);
        const progress = Math.max(0, Math.min(0.999, elapsed / timeframeSeconds));
        const step = Math.floor(progress * 6);
        
        const o = lastCandle.open;
        const h = lastCandle.high;
        const l = lastCandle.low;
        const c = lastCandle.close;
        
        let formingHigh = o;
        let formingLow = o;
        const isBullish = c >= o;
        
        if (isBullish) {
          switch (step) {
            case 0:
              formingHigh = o;
              formingLow = o;
              break;
            case 1:
              formingHigh = o;
              formingLow = l;
              break;
            case 2:
              formingHigh = o + (h - o) * 0.25;
              formingLow = l;
              break;
            case 3:
              formingHigh = o + (h - o) * 0.75;
              formingLow = l;
              break;
            case 4:
              formingHigh = h;
              formingLow = l;
              break;
            case 5:
            default:
              formingHigh = h;
              formingLow = l;
              break;
          }
        } else {
          switch (step) {
            case 0:
              formingHigh = o;
              formingLow = o;
              break;
            case 1:
              formingHigh = h;
              formingLow = o;
              break;
            case 2:
              formingHigh = h;
              formingLow = o - (o - l) * 0.25;
              break;
            case 3:
              formingHigh = h;
              formingLow = o - (o - l) * 0.75;
              break;
            case 4:
              formingHigh = h;
              formingLow = l;
              break;
            case 5:
            default:
              formingHigh = h;
              formingLow = l;
              break;
          }
        }

        filtered[lastIndex] = {
          ...lastCandle,
          close: simCurrentPrice,
          high: Math.max(formingHigh, simCurrentPrice),
          low: Math.min(formingLow, simCurrentPrice)
        };
      }
    }
    
    return filtered;
  }, [historicalData, simCurrentTime, replayCurrentTime, isReplayMode, selectedSymbol, backtestSessions, simCurrentPrice, isSimulating, renderedTimeframe, nonPlayingTickIndex, simIsPlaying, replayIsPlaying, resolvedTickingTime, theme]);

  const visibleSyncedData = useMemo(() => {
    if (!syncedSymbol) return [];
    const session = currentSessionKey ? backtestSessions[currentSessionKey] : null;
    let baseTime = isReplayMode ? replayCurrentTime : (simCurrentTime || (session ? session.currentTime || session.startTime : null));
    let targetTime = baseTime ? resolvedTickingTime : null;
    
    if (!targetTime) {
      if (syncedData.length === 0) return syncedData;
      const copy = [...syncedData];
      const lastIndex = copy.length - 1;
      const lastCandle = copy[lastIndex];
      const timeframeSeconds = renderedSyncedTimeframe?.seconds || 60;
      const totalTicks = Math.max(1, Math.floor(timeframeSeconds / 2));
      
      if (theme.tickingEnabled !== false) {
        const ticking = getTickingCandleState(lastCandle, nonPlayingTickIndex, totalTicks);
        copy[lastIndex] = {
          ...lastCandle,
          close: ticking.close,
          high: ticking.high,
          low: ticking.low
        };
      }
      return copy;
    }
    
    let cutoffIndex = -1;
    for (let i = syncedData.length - 1; i >= 0; i--) {
      if (syncedData[i].time <= targetTime) {
        cutoffIndex = i;
        break;
      }
    }
    
    if (cutoffIndex === -1) return [];
    const filtered = syncedData.slice(0, cutoffIndex + 1);

    const isPlaying = isReplayMode ? replayIsPlaying : simIsPlaying;
    if (filtered.length > 0 && !isPlaying) {
      if (theme.tickingEnabled !== false) {
        const lastIndex = filtered.length - 1;
        const lastCandle = filtered[lastIndex];
        const timeframeSeconds = renderedSyncedTimeframe?.seconds || 60;
        const totalTicks = Math.max(1, Math.floor(timeframeSeconds / 2));
        
        const progress = Math.max(0, Math.min(1.0, (targetTime - lastCandle.time) / timeframeSeconds));
        const tickIdx = Math.floor(progress * (totalTicks - 1));
        const ticking = getTickingCandleState(lastCandle, tickIdx, totalTicks);

        filtered[lastIndex] = {
          ...lastCandle,
          close: ticking.close,
          high: ticking.high,
          low: ticking.low
        };
      }
    }
    return filtered;
  }, [syncedData, syncedSymbol, simCurrentTime, replayCurrentTime, isReplayMode, currentSessionKey, backtestSessions, renderedSyncedTimeframe, nonPlayingTickIndex, simIsPlaying, replayIsPlaying, isSimulating, resolvedTickingTime, theme]);

  // Handle programmatic Quick Trade creation (via 'Buy' or 'Sell' float button indicators)
  const handleCreateQuickTrade = useCallback((direction: 'buy' | 'sell', setupGrade?: string, target: 'main' | 'synced' = 'main') => {
    const chartSymbol = target === 'synced' ? syncedSymbol : selectedSymbol;
    if (!chartSymbol) return;

    // Enforce trade limits for basic users
    if (subscriptionPlan === 'basic' && target === 'main') {
      const pairKey = activeWatchlistItemId || (activePrefix ? `${selectedSymbol}_${activePrefix}` : selectedSymbol) || '';
      const usage = pairUsageLimits[pairKey] || { replays: 0, syncedCharts: 0, trades: 0, tradesResetAt: 0 };
      const resetTime = usage.tradesResetAt || 0;
      
      const currentCategoryPositions = drawings.filter(d => {
        if (activeWatchlistItemId) {
          return d.watchlistId === activeWatchlistItemId;
        } else {
          const drawingSymbolNorm = normalizeSymbol(d.symbol);
          const drawingPrefix = d.prefix || null;
          return drawingSymbolNorm === normalizeSymbol(selectedSymbol || '') && drawingPrefix === (activePrefix || null);
        }
      }).filter(d => d.type === DrawingType.LONG_POSITION || d.type === DrawingType.SHORT_POSITION);

      const currentClosedTakenCount = currentCategoryPositions.filter(cp => 
        cp.isPipelineApproved && cp.isTriggered && (cp.status === 'won' || cp.status === 'lost') &&
        (cp.approvedAt || 0) > resetTime
      ).length;

      if (usage.trades >= 3 || currentClosedTakenCount >= 3) {
        addNotification("Trade limit reached! To take more trades, upgrade to Plus/Premium or watch an ad to reset.", "warning");
        setAdsLimitModalFeature('trades');
        setIsAdsLimitModalOpen(true);
        return;
      }
    }

    const activeCandles = target === 'synced' ? syncedData : visibleData;
    if (!activeCandles || activeCandles.length === 0) return;

    const lastCandle = activeCandles[activeCandles.length - 1];
    const currentPrice = lastCandle.close;

    // 10 pips below for Buy/Long, 5 pips above for Sell/Short
    const pipMultiplier = getPipMultiplier(chartSymbol, currentPrice);
    let entryPrice = currentPrice;
    let stopPrice = currentPrice;
    let targetPrice = currentPrice;

    if (direction === 'buy') {
      // 10 pips below current price
      entryPrice = currentPrice - 10 * pipMultiplier;
      // Default long setup parameters (20 pips risk, 40 pips target: R:R = 2.0)
      stopPrice = entryPrice - 20 * pipMultiplier;
      targetPrice = entryPrice + 40 * pipMultiplier;
    } else {
      // 5 pips above current price
      entryPrice = currentPrice + 5 * pipMultiplier;
      // Default short setup parameters (20 pips risk, 40 pips target: R:R = 2.0)
      stopPrice = entryPrice + 20 * pipMultiplier;
      targetPrice = entryPrice - 40 * pipMultiplier;
    }

    // Time extension window: calculate interval from last 2 candles
    const candle1 = activeCandles[activeCandles.length - 1];
    const candle2 = activeCandles[activeCandles.length - 2];
    const interval = candle2 ? Math.abs(candle1.time - candle2.time) : 60000;
    const duration = (interval || 60000) * 30; // 30 candles into future

    // Setup association metadata
    const activeSetups = (setups || []).filter(s => (s.confluences && s.confluences.length > 0) || s.image_url);
    const associatedSetup = activeSetups.find(s => s.grade === setupGrade);
    const grade = setupGrade || (activeSetups.length > 0 ? activeSetups[0]?.grade : 'A+');

    const drawingId = Math.random().toString(36).substr(2, 9);

    const newDrawing: Drawing = {
      id: drawingId,
      symbol: chartSymbol,
      prefix: target === 'main' ? (activePrefix || undefined) : undefined,
      watchlistId: target === 'main' ? (activeWatchlistItemId || undefined) : undefined,
      type: direction === 'buy' ? DrawingType.LONG_POSITION : DrawingType.SHORT_POSITION,
      points: [
        { time: candle1.time, price: entryPrice },
        { time: candle1.time + duration, price: targetPrice },
        { time: candle1.time + duration, price: stopPrice }
      ],
      isPipelineApproved: true,
      approvedAt: Date.now(),
      approvedPrice: currentPrice,
      placedAt: candle1.time,
      settings: {
        realizedAt: new Date().toISOString(),
        setupGrade: grade,
        confluences: associatedSetup ? (associatedSetup.confluences || []) : []
      }
    };

    setDrawings(prev => [...prev, newDrawing]);

    if (target === 'main') {
      setSelectedDrawing(newDrawing);
    } else {
      setSelectedSyncedDrawing(newDrawing);
    }
  }, [
    selectedSymbol, 
    syncedSymbol, 
    visibleData, 
    syncedData, 
    activePrefix, 
    activeWatchlistItemId, 
    subscriptionPlan, 
    pairUsageLimits, 
    drawings, 
    setups
  ]);

  const results: BacktestResult = useMemo(() => {
    if (visibleData.length === 0) return {
      trades: [],
      equityCurve: [],
      totalProfit: 0,
      winRate: 0,
      maxDrawdown: 0,
      totalTrades: 0,
      sharpeRatio: 0
    };
    return runBacktest(visibleData, params);
  }, [visibleData, params]);

  useEffect(() => {
    if (pendingViewportRef.current && visibleData.length > 0 && selectedSymbol) {
      const pending = pendingViewportRef.current;
      pendingViewportRef.current = null; // Reset to run only once per switch

      const { zoom, focalTime, distanceInCandles } = pending as any;
      let newOffsetX = 0;

      if (focalTime) {
        // Find the index of the candle with the closest timestamp to focalTime in the new dataset
        let closestIdx = -1;
        let minDiff = Infinity;
        for (let i = 0; i < visibleData.length; i++) {
          const diff = Math.abs(visibleData[i].time - focalTime);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = i;
          }
        }

        if (closestIdx !== -1) {
          const approxWidth = 800;
          const visibleCount = approxWidth / zoom;
          if (distanceInCandles !== undefined && distanceInCandles !== null) {
            // Keep the exact same distance from the right edge of the screen!
            newOffsetX = Math.max(0, Math.round((visibleData.length - 1 - closestIdx) - distanceInCandles));
          } else {
            // Center the focal time
            newOffsetX = Math.max(0, Math.round((visibleData.length - 1 - closestIdx) - (visibleCount / 2)));
          }
        }
      }

      const key = activeWatchlistItemId || (selectedSymbol ? (activePrefix ? `${selectedSymbol}_${activePrefix}` : selectedSymbol) : null);
      if (key) {
        setSymbolViewStates(prev => {
          const newState = {
            ...prev,
            [key]: {
              ...prev[key],
              viewport: {
                zoom: zoom,
                offsetX: newOffsetX,
                offsetY: 0, // Reset to auto-scale on timeframe change so prices look perfect immediately
                yScale: 1.0 // Reset to auto-scale on timeframe change so prices look perfect immediately
              }
            }
          };
          if (session?.user?.id) {
            persistenceService.savePreferences(session.user.id, { symbolViewStates: newState }).catch(() => {});
          }
          return newState;
        });
      }
    }
  }, [visibleData, selectedSymbol, activeWatchlistItemId, activePrefix, session?.user?.id]);

  const isAboutPath = currentUrlPath === '/about';
  const isContactPath = currentUrlPath === '/contact';
  const isPrivacyPath = currentUrlPath === '/privacy-policy' || currentUrlPath === '/privacy';
  const isTermsPath = currentUrlPath === '/terms' || currentUrlPath === '/terms-of-service';

  if (isAboutPath || isContactPath || isPrivacyPath || isTermsPath) {
    const activeTabVal: LegalTabType = isAboutPath 
      ? 'about' 
      : isContactPath 
        ? 'contact' 
        : isPrivacyPath 
          ? 'privacy' 
          : 'terms';

    return (
      <LegalAndSpecsPages
        initialTab={activeTabVal}
        isLoggedIn={!!session}
        userEmail={session?.user?.email || ''}
        onBack={() => {
          window.history.pushState(null, '', '/');
        }}
      />
    );
  }

  if (isAuthLoading) {
    return (
      <div className="h-screen w-full bg-[#0c0d12] flex flex-col items-center justify-center relative overflow-hidden select-none">
        {/* Soft Ambient Radial Glow */}
        <div className="absolute w-[350px] h-[350px] rounded-full bg-indigo-500/5 blur-[80px] pointer-events-none" />
        
        <div className="flex flex-col items-center z-10 space-y-6">
          {/* Pulsing Logo Container */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ 
              scale: [0.95, 1.02, 0.95],
              opacity: [0.85, 1, 0.85]
            }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="w-24 h-24 rounded-3xl overflow-hidden shadow-2xl shadow-indigo-550/10 border border-slate-800/80 flex items-center justify-center bg-[#090a0f]"
          >
            <img src="/logo.svg" alt="FirstLook Logo" className="w-full h-full object-cover" />
          </motion.div>

          <div className="flex flex-col items-center space-y-3 text-center">
            {/* Elegant spacing styled text */}
            <motion.h1
              initial={{ letterSpacing: "0.2em", opacity: 0 }}
              animate={{ letterSpacing: "0.45em", opacity: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="text-white font-black text-[13px] uppercase tracking-[0.45em] ml-[0.45em]"
            >
              FIRSTLOOK
            </motion.h1>

            {/* Custom Linear Progress Loader */}
            <div className="w-32 h-[2px] bg-slate-800/60 rounded-full overflow-hidden relative">
              <motion.div 
                initial={{ left: "-100%" }}
                animate={{ left: "100%" }}
                transition={{
                  repeat: Infinity,
                  duration: 1.6,
                  ease: "easeInOut"
                }}
                className="absolute top-0 bottom-0 w-16 bg-gradient-to-r from-transparent via-indigo-500 to-transparent rounded-full"
              />
            </div>

            <span className="text-[7.5px] font-mono font-bold text-slate-500 uppercase tracking-widest pt-1 animate-pulse">
              SYS.SECURE_IDENTITY / SYNCING...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  if (sessionConflict) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-6">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-[2.5rem] p-10 max-w-md w-full text-center shadow-2xl"
        >
          <div className="w-20 h-20 bg-red-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
            <XCircle size={40} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-4 tracking-tight leading-none uppercase">Session Expired</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-8 font-medium">
            Your account is active on another device. You can disconnect the other session and resume styling and backtesting on this device immediately, or safely sign out.
          </p>
          <div className="space-y-3 w-full">
            <button 
              onClick={handleForceResume}
              className="w-full bg-slate-900 text-white py-4.5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-black transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              Take Over & Resume Here
            </button>
            <button 
              onClick={handleLogout}
              className="w-full bg-slate-100 text-slate-600 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all active:scale-95 cursor-pointer"
            >
              Logout From This Device
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-dvh w-full bg-white flex flex-col overflow-hidden font-sans text-slate-900 select-none relative">
      <AnimatePresence>
        {notifications.map(n => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`fixed bottom-3 right-3 z-[9999] pointer-events-none px-2.5 py-1.5 rounded-lg shadow-lg border backdrop-blur-sm flex items-center gap-2 max-w-xs ${
              n.type === 'error' ? 'bg-red-500/10 border-red-500/50 text-red-200' :
              n.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-200' :
              'bg-indigo-500/10 border-indigo-500/50 text-indigo-400'
            }`}
          >
            {n.type === 'error' ? <XCircle size={12} className="text-red-500" /> : 
             n.type === 'success' ? <CheckCircle2 size={12} className="text-emerald-500" /> : 
             <Info size={12} className="text-indigo-500" />}
            <span className="text-[9px] font-black uppercase tracking-widest truncate">{n.message}</span>
          </motion.div>
        ))}

        {showBacktestSetup && (
          <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBacktestSetup(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={isMobile && !isMobileLandscape ? { y: '100%' } : { scale: 0.9, opacity: 0, y: 20 }}
              animate={isMobile && !isMobileLandscape ? { y: 0 } : { scale: 1, opacity: 1, y: 0 }}
              exit={isMobile && !isMobileLandscape ? { y: '100%' } : { scale: 0.9, opacity: 0, y: 20 }}
              transition={isMobile && !isMobileLandscape ? { type: 'spring', damping: 25, stiffness: 200 } : {}}
              className={`relative w-full max-w-lg bg-white shadow-2xl p-6 sm:p-10 border border-slate-100 overflow-y-auto scrollbar-hide
                ${(isMobile && !isMobileLandscape) ? 'rounded-t-[2.5rem] max-h-[85vh]' : 'rounded-[3rem] max-h-[90vh] mx-4'}
              `}
            >
              <div className="flex items-center justify-between mb-8 sm:mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 overflow-hidden relative">
                    {showBacktestSetup.source && (
                      <img 
                        src={`https://logo.clearbit.com/${showBacktestSetup.source}.com`}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    {!showBacktestSetup.source && <Database size={24} />}
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">Explore Pair</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                      {showBacktestSetup.source ? `USING ${showBacktestSetup.source.toUpperCase()} DATA` : 'Configure your entry point'}
                    </p>
                  </div>
                </div>
                {isMobile && (
                  <button 
                   onClick={() => setShowBacktestSetup(null)}
                   className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>

              <div className="space-y-8">
                {/* Mode Context */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${watchlist.some(i => i.symbol === showBacktestSetup.symbol && (i.prefix || '') === ((document.getElementById('session-prefix') as HTMLInputElement)?.value || '')) ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {watchlist.some(i => i.symbol === showBacktestSetup.symbol && (i.prefix || '') === ((document.getElementById('session-prefix') as HTMLInputElement)?.value || '')) ? 'Edit Existing Stream' : 'Initialize New Stream'}
                  </span>
                </div>

                {/* Controlled Sponsor Spotlight (Only visible to Basic plans) */}
                {subscriptionPlan === 'basic' && (
                  adsenseClient && adsenseSlot ? (
                    <div className="pb-1">
                      <GoogleAdSenseUnit client={adsenseClient} slot={adsenseSlot} />
                    </div>
                  ) : exploreSponsorAd ? (
                    <div className="p-4 bg-gradient-to-r from-amber-500/10 to-indigo-500/10 border border-slate-200/60 rounded-3xl space-y-3 shadow-sm relative overflow-hidden text-left">
                      <div className="absolute top-0 right-0 px-2.5 py-0.5 rounded-bl-xl bg-slate-900 text-[6.5px] font-black uppercase text-amber-400 tracking-wider">
                        Sponsor Partner
                      </div>
                      
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col text-left">
                          <span className="text-[7.5px] font-black tracking-widest uppercase text-slate-400 mb-0.5">
                            {exploreSponsorAd.category}
                          </span>
                          <h4 className="text-sm font-black text-slate-900">
                            {exploreSponsorAd.sponsor}
                          </h4>
                          <p className="text-[10px] text-slate-500 font-bold leading-snug mt-1 max-w-[85%]">
                            {exploreSponsorAd.tagline}
                          </p>
                        </div>
                        
                        <div className="w-10 h-10 bg-white rounded-xl border border-slate-100/50 flex items-center justify-center overflow-hidden shrink-0">
                          <img 
                            src={`https://logo.clearbit.com/${exploreSponsorAd.link.replace('https://www.', '').replace('https://', '')}.com`}
                            alt=""
                            className="w-8 h-8 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-200/20 pt-2 bg-transparent text-[8.5px] font-bold">
                        <span className="text-indigo-600 uppercase font-black tracking-wide">
                          {exploreSponsorAd.incentive}
                        </span>
                      </div>

                      {/* Single direct CTA with no cycling controls */}
                      <div className="pt-1 text-[8.5px] font-black select-none">
                        <a 
                          href={exploreSponsorAd.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-indigo-600 text-white rounded-xl py-2 px-3 text-center uppercase tracking-widest hover:bg-slate-900 transition-colors flex items-center justify-center gap-1 w-full shadow-sm"
                        >
                          {exploreSponsorAd.cta}
                          <ExternalLink size={8} />
                        </a>
                      </div>
                    </div>
                  ) : null
                )}

                <div className="p-5 bg-slate-50/50 rounded-3xl border border-slate-100 grid grid-cols-2 gap-4 divide-x divide-slate-100/80">
                  <div className="flex flex-col justify-center text-left pr-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 select-none">Asset</span>
                    <div className="flex flex-col sm:flex-row items-start sm:items-baseline gap-1.5 mt-0.5">
                      <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">{showBacktestSetup.symbol}</span>
                      <span className="text-[7.5px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full border border-indigo-100/40 uppercase whitespace-nowrap">
                        DATA FROM {(() => {
                           const currentUiSource = showBacktestSetup.source || (POPULAR_SYMBOLS.find(s => s.symbol === showBacktestSetup.symbol)?.category === 'Crypto' ? 'binance' : 'axiory');
                           return getAssetDatedFromLabel(showBacktestSetup.symbol || '', currentUiSource);
                        })()}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col justify-center text-left pl-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 select-none">Provider</span>
                    <span className="text-xs sm:text-sm font-black text-indigo-600 uppercase tracking-wider mt-0.5">
                      {showBacktestSetup.source || (POPULAR_SYMBOLS.find(s => s.symbol === showBacktestSetup.symbol)?.category === 'Crypto' ? 'Binance' : 'Axiory')}
                    </span>
                  </div>
                </div>

                {/* Market Type Selection for Crypto */}
                {POPULAR_SYMBOLS.find(s => s.symbol === showBacktestSetup.symbol)?.category === 'Crypto' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Trade Type</span>
                      <span className="text-[10px] font-bold text-slate-400 italic">Select market instrument</span>
                    </div>
                    <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                      {(['spot', 'usdt-futures', 'coin-futures'] as MarketType[]).map((type) => (
                        <button
                          key={type}
                          onClick={() => setShowBacktestSetup(prev => prev ? { ...prev, marketType: type } : null)}
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            (showBacktestSetup.marketType || 'spot') === type
                              ? 'bg-white text-slate-900 shadow-md border border-slate-100'
                              : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {type === 'spot' ? 'Spot' : type === 'usdt-futures' ? 'USDT Futures' : 'Coin Futures'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {(() => {
                    const isWeeklyMarket = (() => {
                      const asset = POPULAR_SYMBOLS.find(s => s.symbol === showBacktestSetup.symbol);
                      return asset ? ['Forex', 'Metals', 'Indices', 'Others'].includes(asset.category) : false;
                    })();

                    const getPastWeekFridayStr = () => {
                      const temp = new Date();
                      const day = temp.getDay();
                      const daysToSubtract = [9, 3, 4, 5, 6, 7, 8][day];
                      const prevFriday = new Date(temp.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);
                      const year = prevFriday.getFullYear();
                      const month = String(prevFriday.getMonth() + 1).padStart(2, '0');
                      const date = String(prevFriday.getDate()).padStart(2, '0');
                      return `${year}-${month}-${date}`;
                    };

                    const maxEndVal = getPastWeekFridayStr();

                    return (
                      <>
                        <div className="space-y-4">
                          <div className="flex flex-col px-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Start Date</span>
                            <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tight mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
                              Earliest: {(() => {
                                 const currentUiSource = showBacktestSetup.source || (POPULAR_SYMBOLS.find(s => s.symbol === showBacktestSetup.symbol)?.category === 'Crypto' ? 'binance' : 'axiory');
                                 return getMinSelectableStartDate(showBacktestSetup.symbol || '', currentUiSource).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
                              })()}
                            </span>
                          </div>
                          <div className="relative group">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={14} />
                            <input 
                              type="date"
                              id="backtest-start-date"
                              key={`start-${showBacktestSetup.symbol}`}
                              min={(() => {
                                 const currentUiSource = showBacktestSetup.source || (POPULAR_SYMBOLS.find(s => s.symbol === showBacktestSetup.symbol)?.category === 'Crypto' ? 'binance' : 'axiory');
                                 return getMinSelectableStartDate(showBacktestSetup.symbol || '', currentUiSource).toISOString().split('T')[0];
                              })()}
                              max={maxEndVal}
                              defaultValue=""
                              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-10 pr-2 text-[10px] font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-600/5 transition-all"
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex flex-col px-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">End Date</span>
                            <span className="text-[7px] font-bold text-indigo-600 uppercase tracking-tight mt-1">
                              Latest: Past Week Friday
                            </span>
                          </div>
                          <div className="relative group">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={14} />
                            <input 
                              type="date"
                              id="backtest-end-date"
                              key={`end-${showBacktestSetup.symbol}`}
                              min={(() => {
                                 const currentUiSource = showBacktestSetup.source || (POPULAR_SYMBOLS.find(s => s.symbol === showBacktestSetup.symbol)?.category === 'Crypto' ? 'binance' : 'axiory');
                                 return getMinSelectableStartDate(showBacktestSetup.symbol || '', currentUiSource).toISOString().split('T')[0];
                              })()}
                              max={maxEndVal}
                              defaultValue={getPastWeekFridayStr()}
                              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-10 pr-2 text-[10px] font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-600/5 transition-all"
                            />
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>



                <div className="flex flex-col gap-4 pt-4">
                  <button
                    onClick={() => {
                      const dateInput = document.getElementById('backtest-start-date') as HTMLInputElement;
                      const endDateInput = document.getElementById('backtest-end-date') as HTMLInputElement;
                      
                      if (dateInput && dateInput.value) {
                        startBacktestSession(
                          showBacktestSetup.symbol || '', 
                          dateInput.value, 
                          '', // prefix is auto-generated
                          '', // Removed description
                          '',  // Removed imageInput
                          showBacktestSetup.source,
                          showBacktestSetup.marketType || 'spot',
                          endDateInput.value
                        );
                      } else {
                        addNotification("Please select a Start Date to launch your backtest session.", "error");
                      }
                    }}
                    className="w-full bg-slate-900 text-white rounded-[2rem] py-5 font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all shadow-2xl shadow-slate-900/20 active:scale-[0.98] flex items-center justify-center gap-3"
                  >
                    <Plus size={14} className="text-white" />
                    Add to Watchlist
                  </button>
                  {!isMobile && (
                    <button
                      onClick={() => setShowBacktestSetup(null)}
                      className="w-full text-slate-400 font-black uppercase tracking-widest text-[10px] py-1 hover:text-slate-600 transition-colors"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {!selectedSymbol ? (
        <div className="w-full h-screen bg-white flex flex-col overflow-hidden">
          <header className={`border-b border-slate-150 flex items-center justify-between px-6 bg-white shrink-0 ${isMobileLandscape ? 'h-10' : 'h-14'}`}>
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="Logo" className="w-5 h-5 rounded object-contain bg-slate-950 p-0.5" />
              <span className="font-neutral-900 font-black text-sm uppercase tracking-wider text-slate-900">FirstLook</span>
            </div>

            {/* Profile trigger button */}
            <div className="flex items-center gap-4">
              {shouldShowInstallButton && (
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleInstallPwa}
                    className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-600 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-200 shadow-xs cursor-pointer select-none"
                    title={isSafari ? "Show PWA Installation Steps" : "Install App"}
                  >
                    <Download size={11.5} className="text-indigo-600 animate-bounce" />
                    Install App
                  </motion.button>

                  <AnimatePresence>
                    {showPwaInstallGuide === 'safari' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute right-0 mt-2 w-56 bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-800 z-[999] text-left space-y-2.5"
                      >
                        <div className="flex items-start gap-2">
                          <div className="bg-indigo-950 p-1.5 rounded-lg border border-indigo-800 shrink-0 text-indigo-400 mt-0.5">
                            <ExternalLink size={12} />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-black uppercase tracking-wider text-white">IOS / Safari Install</h4>
                            <p className="text-[9px] text-slate-300 font-bold leading-normal mt-1">
                              Tap the share button below, then scroll and select <strong className="text-indigo-300 font-black">"Add to Home Screen"</strong>.
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => setShowPwaInstallGuide(null)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[8.5px] font-black uppercase tracking-widest rounded-lg transition-colors cursor-pointer text-slate-200"
                          >
                            Got it
                          </button>
                        </div>
                      </motion.div>
                    )}
                    {showPwaInstallGuide === 'general' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute right-0 mt-2 w-60 bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-800 z-[999] text-left space-y-2.5"
                      >
                        <div className="flex items-start gap-2">
                          <div className="bg-indigo-950 p-1.5 rounded-lg border border-indigo-800 shrink-0 text-indigo-400 mt-0.5">
                            <ExternalLink size={12} />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-black uppercase tracking-wider text-white">Chromium 1-Click Install</h4>
                            <p className="text-[9px] text-slate-300 font-bold leading-normal mt-1">
                              On Chrome or Edge, this button triggers instant 1-click install! 
                            </p>
                            <p className="text-[9px] text-indigo-300 font-bold leading-normal mt-1">
                              If you are viewing inside the sandboxed preview frame, click <strong className="text-white">"Open App in New Tab"</strong> at the top right to enable automatic 1-click installation.
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => setShowPwaInstallGuide(null)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[8.5px] font-black uppercase tracking-widest rounded-lg transition-colors cursor-pointer text-slate-200"
                          >
                            Got it
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <button 
                onClick={() => setActiveTab('profile')}
                className="group flex items-center gap-1.5 px-2 py-1.5 hover:bg-slate-50 rounded-lg transition-all text-slate-400 hover:text-slate-900 cursor-pointer"
                title="Profile & Analysis"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm ${
                  activeTab === 'profile' || activeTab === 'subscription'
                    ? 'bg-slate-950 text-white border border-slate-900'
                    : 'bg-slate-100 text-slate-500 group-hover:bg-slate-900 group-hover:text-white'
                }`}>
                  <User size={15} />
                </div>
              </button>
            </div>
          </header>
          <div className="flex-1 overflow-hidden">
            {activeTab === 'profile' ? (
              <MemoizedProfilePage 
                user={session.user} 
                trades={mergedTrades} 
                watchlist={watchlist}
                onBack={() => setActiveTab('chart')} 
                streakCount={streakCount}
                longestStreak={longestStreak}
                subscriptionPlan={subscriptionPlan}
                onNavigateToSubscription={() => {
                  setSubscriptionBackTarget('profile');
                  setActiveTab('subscription');
                }}
                onTriggerSimulationOfBadge={triggerSimulationOfBadge}
              />
            ) : activeTab === 'subscription' ? (
              <MemoizedSubscriptionPage 
                user={session?.user}
                currentPlan={subscriptionPlan}
                onUpdateSubscription={(plan) => {
                  setSubscriptionPlan(plan);
                  if (session?.user?.id) {
                    persistenceService.savePreferences(session.user.id, { subscriptionPlan: plan })
                      .catch(err => console.error("Error saving subscription:", err));
                  }
                  addNotification(`Plan successfully upgraded to ${plan.toUpperCase()}`, 'success');
                }}
                onBack={() => {
                  if (subscriptionBackTarget === 'watchlist') {
                    setActiveTab('chart');
                  } else if (subscriptionBackTarget === 'chart-room' && savedSymbolBeforeSubscription) {
                    setSelectedSymbol(savedSymbolBeforeSubscription);
                    setActiveTab('chart');
                  } else {
                    setActiveTab('profile');
                  }
                }}
                backLabel={
                  subscriptionBackTarget === 'watchlist' 
                    ? "Back to Watchlist" 
                    : (subscriptionBackTarget === 'chart-room' ? "Back to Chart" : "Back to Profile")
                }
              />
            ) : (
              <MemoizedWatchlistPage 
                userId={session.user?.id} 
                onSelectSymbol={handleSelectSymbol}
                onDeleteItem={handleDeleteWatchlistItem}
                onExtendSession={handleExtendWatchlistItem}
                watchlist={watchlist}
                setWatchlist={setWatchlist}
                activeTab={journalTab}
                setActiveTab={setJournalTab}
                activeCategory={activeWatchlistCategory as any}
                setActiveCategory={setActiveWatchlistCategory as any}
                isLoading={!isDataInitialized}
                backtestSessions={backtestSessions}
                isMobile={isMobile}
                isMobileLandscape={isMobileLandscape}
                setups={setups}
                subscriptionPlan={subscriptionPlan}
                onLockedFeature={(feat) => {
                  setUpgradeModalFeature(feat);
                  setIsUpgradeModalOpen(true);
                }}
                onNavigateToCompetitions={() => setIsCompetitionsPopupOpen(true)}
                journalTrades={journalTrades}
              />
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Top Left Navigation - Mobile Only (Portrait only) */}
          {isMobile && isPortrait && (
            <>
              {isMobileNavOpen && (
                <div 
                  className="fixed inset-0 z-40 bg-transparent" 
                  onClick={() => setIsMobileNavOpen(false)} 
                />
              )}
              <div className="absolute top-1.5 left-3 md:left-6 z-50 flex items-center gap-1.5">
                {!isReplayMode ? (
                  <div className="relative">
                    <button 
                      onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
                      className="w-8 h-8 bg-white hover:bg-slate-50 border border-slate-100 rounded-full shadow-lg transition-all active:scale-95 text-slate-600 hover:text-slate-950 flex items-center justify-center"
                      title="Menu"
                    >
                      <Settings2 size={16} strokeWidth={2.2} className="text-indigo-600" />
                    </button>
                    
                    <AnimatePresence>
                      {isMobileNavOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ type: "spring", stiffness: 450, damping: 28 }}
                          style={{ transformOrigin: "top left" }}
                          className="absolute -top-1 -left-1 bg-white/95 backdrop-blur-2xl border border-slate-100 rounded-2xl shadow-2xl p-1.5 flex flex-col gap-0.5 min-w-[145px] z-50 text-slate-800"
                        >
                          <div className="flex items-center justify-between px-2.5 py-1 border-b border-slate-100 pb-1.5 mb-1">
                            <span className="text-[9px] font-black text-slate-400 tracking-wider uppercase">Menu</span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsMobileNavOpen(false);
                              }}
                              className="text-slate-400 hover:text-slate-900 transition-colors p-0.5"
                            >
                              <X size={10} strokeWidth={2.5} />
                            </button>
                          </div>

                          <button
                            onClick={() => {
                              setIsMenuOpen(true);
                              setIsMobileNavOpen(false);
                            }}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 text-[10px] font-black text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all text-left w-full whitespace-nowrap"
                          >
                            <Info size={12} className="text-blue-500" />
                            <span>Details</span>
                          </button>
                          
                          <button
                            onClick={() => {
                              setSelectedSymbol(null);
                              setIsMobileNavOpen(false);
                            }}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 text-[10px] font-black text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all text-left w-full whitespace-nowrap"
                          >
                            <List size={12} className="text-emerald-500" />
                            <span>Watchlist</span>
                          </button>
                          
                          <button
                            onClick={() => {
                              setIsSetupModalOpen(true);
                              setIsMobileNavOpen(false);
                            }}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 text-[10px] font-black text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all text-left w-full whitespace-nowrap"
                          >
                            <LayoutGrid size={12} className="text-violet-500" />
                            <span>Setup</span>
                          </button>

                          <div className="h-px bg-slate-100 my-1 mx-1" />

                          <button
                            onClick={() => {
                              handleRefreshChart();
                              setIsMobileNavOpen(false);
                            }}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 text-[10px] font-black text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all text-left w-full whitespace-nowrap"
                          >
                            <RefreshCcw size={12} className="text-indigo-500" />
                            <span>Refresh Charts</span>
                          </button>

                          <button
                            onClick={() => {
                              setIsMenuOpen(true);
                              setSidebarTab('trades');
                              setIsMobileNavOpen(false);
                            }}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 text-[10px] font-black text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all text-left w-full whitespace-nowrap"
                          >
                            <Repeat size={12} className="text-amber-500" />
                            <span>Replay Trade</span>
                          </button>

                          <button
                            onClick={() => {
                              setIsMenuOpen(false);
                              if (subscriptionPlan === 'basic') {
                                const pairKey = activeWatchlistItemId || (activePrefix ? `${selectedSymbol}_${activePrefix}` : selectedSymbol) || 'default';
                                const usage = pairUsageLimits[pairKey] || { replays: 0, syncedCharts: 0, trades: 0 };
                                if (usage.syncedCharts >= 1) {
                                  setAdsLimitModalFeature('sync');
                                  setIsAdsLimitModalOpen(true);
                                } else {
                                  updatePairLimit(pairKey, { syncedCharts: usage.syncedCharts + 1 });
                                  setIsSyncedSelectorOpen(true);
                                }
                              } else {
                                setIsSyncedSelectorOpen(true);
                              }
                              setIsMobileNavOpen(false);
                            }}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 text-[10px] font-black text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all text-left w-full whitespace-nowrap cursor-pointer"
                          >
                            <Link2 size={12} className="text-indigo-500" />
                            <span>Synced Charts</span>
                          </button>

                          <button
                            onClick={() => {
                              setIsSettingsOpen(true);
                              setIsMobileNavOpen(false);
                            }}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 text-[10px] font-black text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all text-left w-full whitespace-nowrap cursor-pointer"
                          >
                            <Settings size={12} className="text-indigo-500" />
                            <span>Settings</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <button 
                    onClick={exitReplay}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded-lg shadow-lg flex items-center gap-2 active:scale-95 transition-all outline-none"
                  >
                    <X size={14} />
                    <div className="w-px h-3 bg-white/20 mx-0.5" />
                    <CandlestickChart size={14} />
                  </button>
                )}
              </div>
            </>
          )}

          {/* Top Left Navigation - Desktop Replay Exit */}
          {!isMobile && isReplayMode && (
            <div className="absolute top-4 left-8 z-[60]">
               <button 
                onClick={exitReplay}
                className="group flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur-xl border border-slate-100 rounded-xl shadow-xl hover:bg-slate-900 hover:text-white transition-all active:scale-95"
              >
                <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                  <CandlestickChart size={14} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest px-1">Exit Replay</span>
                <X size={14} className="text-slate-300 group-hover:text-white" />
              </button>
            </div>
          )}

          {/* Floating Backtest/Replay Controls */}
          <AnimatePresence>
            {/* Disabled in desktop and landscape to use the unified FavoriteDrawingsToolbar controls, keeping the layout clean and elegant */}
            {false && (!isMobile || isMobileLandscape) && (
              (!isSimulating && !isReplayMode && !simIsPlaying) ? (
                <motion.button
                  key={`sim-launcher-${currentMode}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1, 
                    x: activeSimControlsPos.x, 
                    y: activeSimControlsPos.y,
                    transition: { type: 'spring', damping: 30, stiffness: 400 }
                  }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  drag
                  dragMomentum={false}
                  dragElastic={0}
                  dragConstraints={workspaceRef}
                  onDragEnd={(_e, info) => {
                    const newPos = { x: activeSimControlsPos.x + info.offset.x, y: activeSimControlsPos.y + info.offset.y };
                    updateSimControlsPosWithClamp(newPos);
                  }}
                  whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
                  onClick={() => setIsSimulating(true)}
                  className={`fixed bottom-24 right-8 z-[100] ${isMobileLandscape ? 'w-[10vh] h-[10vh]' : isMobile ? 'w-12 h-12' : 'w-20 h-20 md:w-24 md:h-24'} bg-slate-900 text-white rounded-[2.5vh] flex items-center justify-center shadow-[0_15px_40px_-5px_rgba(0,0,0,0.4)] active:scale-95 cursor-move active:cursor-grabbing group overflow-hidden border border-white/10`}
                  whileHover={{ scale: 1.05, backgroundColor: '#1e293b' }}
                  title="Simulation Controls"
                >
                  <Play size={isMobileLandscape ? '5.5vh' : isMobile ? 24 : 36} fill="currentColor" strokeWidth={0} />
                </motion.button>
              ) : (
            <FloatingPlaybackControls 
              isReplayMode={isReplayMode}
              simIsPlaying={simIsPlaying}
              setSimIsPlaying={setSimIsPlaying}
              replayIsPlaying={replayIsPlaying}
              setReplayIsPlaying={setReplayIsPlaying}
              isMobile={isMobile}
              isMobileLandscape={isMobileLandscape}
              simCurrentTime={simCurrentTime}
              replayCurrentTime={replayCurrentTime}
              getStepSeconds={getStepSeconds}
              setSimCurrentTime={setSimCurrentTime}
              setReplayCurrentTime={setReplayCurrentTime}
              exitReplay={exitReplay}
              setIsSimulating={setIsSimulating}
              simSpeed={simSpeed}
              setSimSpeed={setSimSpeed}
              selectedTimeframe={selectedTimeframe}
              isSpeedOpen={isSpeedOpen}
              setIsSpeedOpen={setIsSpeedOpen}
              speedRef={speedRef}
              activeSimControlsPos={activeSimControlsPos}
              updateSimControlsPosWithClamp={updateSimControlsPosWithClamp}
              workspaceRef={workspaceRef}
              currentMode={currentMode}
              watchlist={watchlist}
              activeWatchlistItemId={activeWatchlistItemId}
              backtestSessions={backtestSessions}
              setBacktestSessions={setBacktestSessions}
              addNotification={addNotification}
              selectedSymbol={selectedSymbol}
              activePrefix={activePrefix}
              currentSessionKey={currentSessionKey}
              futureFetchError={futureFetchError}
              onRetryFutureFetch={loadMoreFuture}
              sessionCurrentTimesRef={sessionCurrentTimesRef}
              replayTrade={replayTrade}
              togglePlayback={togglePlayback}
              historicalDataRef={historicalDataRef}
              setShowSyncInfoModal={setShowSyncInfoModal}
              subscriptionPlan={subscriptionPlan}
              onLockedFeature={(feat: any) => {
                setUpgradeModalFeature(feat);
                setIsUpgradeModalOpen(true);
              }}
            />
              ))}
            </AnimatePresence>

      {/* Top Right Symbol & Price Details */}
      {selectedSymbol && !syncedSymbol && (() => {
        const item = watchlist.find((i: any) => i.id === activeWatchlistItemId) || 
                     watchlist.find((i: any) => i.symbol === selectedSymbol && (i.prefix || null) === (activePrefix || null));
        const category = POPULAR_SYMBOLS.find(s => s.symbol === selectedSymbol)?.category || 'Crypto';
        const isCrypto = category === 'Crypto';
        
        const rawSource = item?.dataSource || (isCrypto ? 'bybit' : 'axiory');
        let displaySource = rawSource;
        if (displaySource.toLowerCase() === 'axiory') {
          displaySource = 'Axiory';
        } else if (displaySource.toLowerCase() === 'binance') {
          displaySource = 'Binance';
        } else if (displaySource.toLowerCase() === 'bybit') {
          displaySource = 'Bybit';
        } else if (displaySource.toLowerCase() === 'okx') {
          displaySource = 'OKX';
        } else {
          displaySource = displaySource.charAt(0).toUpperCase() + displaySource.slice(1);
        }
        
        const displaySymbol = selectedSymbol.replace('/', '');
        
        const instType = item?.marketType || 'spot';
        let displayInstrument = 'Spot';
        if (instType === 'spot') displayInstrument = 'Spot';
        else if (instType === 'usdt-futures') displayInstrument = 'USDT Futures';
        else if (instType === 'coin-futures') displayInstrument = 'Coin Futures';
        else {
          displayInstrument = instType.split('-').map(w => w.charAt(0).toUpperCase() + w.substring(1)).join(' ');
        }
        
        const lastVisibleCandleClose = visibleData[visibleData.length - 1]?.close ?? null;
        const priceNum = (isSimulating || currentSessionKey || isReplayMode)
          ? (simCurrentPrice !== null 
              ? simCurrentPrice 
              : (nonPlayingTickPrice !== null ? nonPlayingTickPrice : lastVisibleCandleClose))
          : (nonPlayingTickPrice !== null ? nonPlayingTickPrice : (historicalData[historicalData.length - 1]?.close ?? null));
          
        let priceStr = '---';
        if (priceNum !== null) {
          if (category === 'Forex' || priceNum < 5) {
            priceStr = priceNum.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 });
          } else if (priceNum >= 500) {
            priceStr = priceNum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
          } else {
            priceStr = priceNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          }
        }
        
        return (
          <div className={`absolute top-1.5 right-3 md:right-6 z-40 select-none transition-all duration-300 ${isMobileLandscape ? 'opacity-40' : 'opacity-100'}`}>
            <div className="flex flex-col items-end leading-none">
              {/* Line 1: Source : Pair */}
              <span className="text-[8px] sm:text-[9px] font-black tracking-tight text-slate-400 uppercase">
                {displaySource} : {displaySymbol}
              </span>
              
              {/* Line 2: Instrument : Price (Crypto) or Price (Other) */}
              {isCrypto ? (
                <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-950 tracking-tight mt-0.5">
                  <span className="text-[7.5px] sm:text-[8px] font-black text-slate-400 mr-0.5 uppercase font-sans">{displayInstrument} :</span>
                  {priceStr}
                </span>
              ) : (
                <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-950 tracking-tight mt-0.5">
                  {priceStr}
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Main Analysis Dock (Responsive Floating Terminal) */}
      <AnimatePresence>
        {(!isReplayMode || isMobile) && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={`absolute z-50 bg-white/95 backdrop-blur-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-1 flex transition-all duration-300
                            ${isMobileLandscape 
                              ? 'top-1/2 left-1.5 -translate-y-1/2 flex-col gap-[1vh] rounded-[2vh] w-auto h-auto max-h-[90vh] p-[0.8vh]' 
                              : 'bottom-2 left-1/2 -translate-x-1/2 flex-row rounded-[1.25rem] md:bottom-auto md:top-1/2 md:left-8 md:-translate-y-1/2 md:translate-x-0 md:flex-col md:gap-3 md:rounded-[2rem] md:p-3 shadow-2xl'
                            }`}
          >
            {/* Main Navigation Buttons - Desktop & Landscape */}
            {currentMode !== 'mobilePortrait' && (
              <div className="relative" ref={desktopMenuRef}>
                <button 
                  onClick={() => setIsDesktopMenuOpen(!isDesktopMenuOpen)}
                  className={`flex items-center justify-center transition-all duration-300 ${isMobileLandscape ? 'w-[8.5vh] h-[8.5vh] rounded-[1.5vh]' : 'w-16 h-16 md:w-20 md:h-20 rounded-[2.5vh]'} ${isDesktopMenuOpen ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}
                  title="Menu"
                >
                  <Menu size={isMobileLandscape ? '4vh' : 24} strokeWidth={2.5} />
                </button>
                <div className={`${isMobileLandscape ? 'w-[4vh] h-[1.5px]' : 'w-10 h-px'} bg-slate-100 my-1 self-center opacity-60`}></div>
              </div>
            )}

            <div className="relative" ref={timeframeRef}>
              <button 
                onClick={() => setIsTimeframeOpen(!isTimeframeOpen)}
                className={`${isMobileLandscape ? 'w-[10vh] h-[10vh]' : isMobile ? 'w-8 h-8' : 'md:w-20 md:h-20'} flex flex-col items-center justify-center rounded-[2vh] transition-all duration-300 ${isTimeframeOpen ? 'bg-slate-900 text-white shadow-xl shadow-black/20' : 'hover:bg-slate-50 text-slate-400 hover:text-slate-900'}`}
              >
                <span className={`${isMobileLandscape ? 'text-[2.8vh]' : isMobile ? 'text-[8px]' : 'text-[15px]'} font-black tracking-tighter leading-none`}>{selectedTimeframe.label}</span>
                <ChevronDown size={isMobileLandscape ? 12 : isMobile ? 6 : 14} md:size={14} strokeWidth={4} className={`mt-0.5 transition-transform duration-300 ${isTimeframeOpen ? 'rotate-180' : 'opacity-40'}`} />
              </button>
            </div>

        {/* Normal Tools (Hidden on Mobile during Simulation or Replay) */}
        {((!isSimulating && !isReplayMode) || !isMobile) && (
          <>
            <div className={`${isMobileLandscape ? 'w-[4vh] h-[1px] my-[0.5vh] mx-auto' : 'w-6 h-px my-1 mx-auto hidden md:block' } bg-slate-100/60`}></div>
            <div className={`${isMobileLandscape ? 'hidden' : 'w-px h-5 mx-1 md:hidden'} bg-slate-100/60`}></div>

            <button 
              onClick={() => setActiveTab(activeTab === 'drawings' ? 'chart' : 'drawings')}
              className={`${isMobileLandscape ? 'w-[10vh] h-[10vh]' : isMobile ? 'w-8 h-8' : 'w-10 h-10 md:w-20 md:h-20'} flex items-center justify-center rounded-[2vh] transition-all duration-300 ${activeTab === 'drawings' ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-600/5' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}
            >
              <Pencil size={isMobileLandscape ? 24 : isMobile ? 16 : 18} strokeWidth={activeTab === 'drawings' ? 2.5 : 2} />
            </button>

            <button 
              onClick={() => setIsIndicatorsOpen(true)}
              className={`${isMobileLandscape ? 'w-[10vh] h-[10vh]' : isMobile ? 'w-8 h-8' : 'w-10 h-10 md:w-20 md:h-20'} flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-[2vh] transition-all duration-300`}
            >
              <Activity size={isMobileLandscape ? 24 : isMobile ? 16 : 18} strokeWidth={2} />
            </button>
          </>
        )}

        {/* Mobile Simulation Controls (Portrait side toolbar version) */}
        {isMobile && !isMobileLandscape && (isSimulating || isReplayMode) && (
          <>
            <div className="w-px h-5 mx-1 bg-slate-100/60"></div>
            <button 
              onClick={togglePlayback}
              className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl"
            >
              {(isReplayMode ? replayIsPlaying : simIsPlaying) ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            </button>
            <div className="relative font-bold text-slate-600" ref={speedRef}>
              <button 
                onClick={() => setIsSpeedOpen(!isSpeedOpen)}
                className="w-8 h-8 text-[10px] flex items-center justify-center font-black text-slate-900 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all font-black border border-slate-100/50"
                title="Simulation Speed"
              >
                {currentSessionKey && backtestSessions[currentSessionKey]?.timeSyncEnabled ? 'Sync' : `${simSpeed}x`}
              </button>
              <AnimatePresence>
                {isSpeedOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute bottom-full right-0 translate-x-1/4 mb-2 bg-white border border-slate-100/80 rounded-2xl shadow-[0_12px_30px_rgba(0,0,0,0.12)] p-2.5 w-48 overflow-hidden z-[110] flex flex-col gap-2"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-50 pb-1.5">
                      <span className="text-[8px] font-extrabold uppercase tracking-wider text-slate-400">Play Speed</span>
                      {currentSessionKey && backtestSessions[currentSessionKey]?.timeSyncEnabled && (
                        <span className="text-[7px] bg-green-50 text-green-600 font-bold px-1.5 py-0.5 rounded-md animate-pulse">Sync Active</span>
                      )}
                    </div>                     {/* Speed Multipliers */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[7px] font-bold text-slate-400 text-left">Normal Speed</span>
                      <div className="grid grid-cols-4 gap-1">
                        {[1, 2, 3, 4].map(s => {
                          const isTS = currentSessionKey && backtestSessions[currentSessionKey]?.timeSyncEnabled;
                          return (
                            <button 
                              key={s}
                              onClick={() => {
                                setSimSpeed(s);
                                if (currentSessionKey) {
                                  setBacktestSessions((prev: any) => ({
                                    ...prev,
                                    [currentSessionKey]: {
                                      ...prev[currentSessionKey],
                                      timeSyncEnabled: false,
                                      timeSyncLastTimestamp: undefined
                                    }
                                  }));

                                  setWatchlist(prev => {
                                    const matchingItem = prev.find(item => {
                                      if (currentSessionKey && currentSessionKey.startsWith('wl_')) {
                                        return item.id === currentSessionKey;
                                      }
                                      return item.id === currentSessionKey || (item.symbol === selectedSymbol && (item.prefix || '') === (activePrefix || ''));
                                    });
                                    if (!matchingItem) return prev;
                                    const updatedWatchlist = prev.map(item => item.id === matchingItem.id ? {
                                      ...item,
                                      timeSync: false,
                                      lastCandlePlayAt: undefined
                                    } : item);
                                    if (session?.user?.id) {
                                      persistenceService.saveWatchlist(session.user.id, updatedWatchlist).catch(() => {});
                                    }
                                    return updatedWatchlist;
                                  });
                                }
                                setIsSpeedOpen(false);
                              }}
                              className={`py-1 text-[8px] font-black rounded transition-all ${(!isTS && simSpeed === s) ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 bg-slate-50/50 hover:text-slate-900 font-bold'}`}
                            >
                              {s}x
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="h-px bg-slate-100/60" />

                    {/* Time Sync Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col text-left">
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] font-extrabold text-slate-800">Time Sync</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowSyncInfoModal(true);
                            }}
                            className="text-slate-400 hover:text-indigo-600 transition-colors p-0.5 rounded hover:bg-slate-50 flex items-center justify-center"
                            title="What is Time Sync?"
                          >
                            <Info size={10} className="stroke-[2.5]" />
                          </button>
                        </div>
                        <span className="text-[6px] text-slate-400 font-medium">Progresses in real-time</span>
                      </div>
                      <button
                        onClick={() => {
                          if (!currentSessionKey) {
                            addNotification("Please select an active backtest session", 'warning');
                            return;
                          }
                          if (subscriptionPlan === 'basic') {
                            setUpgradeModalFeature('timesync');
                            setIsUpgradeModalOpen(true);
                            return;
                          }
                          const isTSObj = backtestSessions[currentSessionKey];
                          const nextEnabled = !isTSObj?.timeSyncEnabled;
                          const speed = isTSObj?.timeSyncSpeed || 60;

                          setBacktestSessions((prev: any) => ({
                            ...prev,
                            [currentSessionKey]: {
                              ...prev[currentSessionKey],
                              timeSyncEnabled: nextEnabled,
                              timeSyncSpeed: speed,
                              timeSyncLastTimestamp: nextEnabled ? Date.now() : undefined
                            }
                          }));

                          setWatchlist(prev => {
                            const matchingItem = prev.find(item => {
                              if (currentSessionKey && currentSessionKey.startsWith('wl_')) {
                                  return item.id === currentSessionKey;
                              }
                              return item.id === currentSessionKey || (item.symbol === selectedSymbol && (item.prefix || '') === (activePrefix || ''));
                            });
                            if (!matchingItem) return prev;
                            const updatedWatchlist = prev.map(item => item.id === matchingItem.id ? {
                              ...item,
                              timeSync: nextEnabled,
                              timeFrame: selectedTimeframe.id,
                              timeSyncSpeed: speed,
                              lastSimulationTime: simCurrentTimeRef.current || item.lastSimulationTime,
                              lastCandlePlayAt: nextEnabled ? Date.now() : undefined
                            } : item);
                            if (session?.user?.id) {
                              persistenceService.saveWatchlist(session.user.id, updatedWatchlist).catch(() => {});
                            }
                            return updatedWatchlist;
                          });

                          if (nextEnabled) {
                            setSimIsPlaying(true);
                          }
                        }}
                        className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-200 outline-none ${currentSessionKey && backtestSessions[currentSessionKey]?.timeSyncEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                      >
                        <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 ${currentSessionKey && backtestSessions[currentSessionKey]?.timeSyncEnabled ? 'translate-x-3' : 'translate-x-[2px]'}`} />
                      </button>
                    </div>

                    {/* Collapsible Time Sync Options */}
                    {currentSessionKey && backtestSessions[currentSessionKey]?.timeSyncEnabled && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex flex-col gap-1 pt-1 border-t border-slate-50 overflow-hidden text-left"
                      >
                        <span className="text-[7px] font-bold text-slate-400">Time Sync Rate</span>
                        <div className="flex flex-col gap-1 max-h-[100px] overflow-y-auto pr-0.5 scrollbar-thin">
                          {[
                            { label: "1m candle = 60s", value: 60 },
                            { label: "1m candle = 30s", value: 30 },
                            { label: "1m candle = 15s", value: 15 },
                            { label: "1m candle = 10s", value: 10 },
                            { label: "1m candle = 5s", value: 5 },
                            { label: "1m candle = 2.5s", value: 2.5 }
                          ].map(opt => {
                            const isTSActive = backtestSessions[currentSessionKey]?.timeSyncSpeed === opt.value;
                            return (
                              <button
                                key={opt.value}
                                onClick={() => {
                                  if (subscriptionPlan === 'basic') {
                                    setUpgradeModalFeature('timesync');
                                    setIsUpgradeModalOpen(true);
                                    return;
                                  }
                                  setBacktestSessions((prev: any) => ({
                                    ...prev,
                                    [currentSessionKey]: {
                                      ...prev[currentSessionKey],
                                      timeSyncEnabled: true,
                                      timeSyncSpeed: opt.value,
                                      timeSyncLastTimestamp: Date.now()
                                    }
                                  }));

                                  setWatchlist(prev => {
                                    const matchingItem = prev.find(item => {
                                      if (currentSessionKey && currentSessionKey.startsWith('wl_')) {
                                        return item.id === currentSessionKey;
                                      }
                                      return item.id === currentSessionKey || (item.symbol === selectedSymbol && (item.prefix || '') === (activePrefix || ''));
                                    });
                                    if (!matchingItem) return prev;
                                    const updatedWatchlist = prev.map(item => item.id === matchingItem.id ? {
                                      ...item,
                                      timeSync: true,
                                      timeFrame: selectedTimeframe.id,
                                      timeSyncSpeed: opt.value,
                                      lastSimulationTime: simCurrentTimeRef.current || item.lastSimulationTime,
                                      lastCandlePlayAt: Date.now()
                                    } : item);
                                    if (session?.user?.id) {
                                      persistenceService.saveWatchlist(session.user.id, updatedWatchlist).catch(() => {});
                                    }
                                    return updatedWatchlist;
                                  });

                                  setSimIsPlaying(true);
                                }}
                                className={`w-full text-left px-1 py-0.5 text-[7px] font-bold rounded transition-all flex items-center justify-between ${isTSActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                              >
                                <span>{opt.label}</span>
                                {isTSActive && <div className="w-1 h-1 rounded-full bg-indigo-600" />}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </>
        )}

        {/* Mobile Play Switch (Only in Portrait) */}
        {isMobile && !isReplayMode && !isMobileLandscape && (
          <>
            <div className={`${isMobileLandscape ? 'w-4 h-px my-0.5 mx-auto' : 'w-px h-5 mx-1'} bg-slate-100/60`}></div>
            <button 
              onClick={() => {
                if (simIsPlaying) {
                  setSimIsPlaying(false);
                } else {
                  const nextState = !isSimulating;
                  setIsSimulating(nextState);
                }
              }}
              className={`${isMobileLandscape ? 'w-7 h-7' : 'w-8 h-8'} flex items-center justify-center rounded-xl transition-all duration-300 ${isSimulating ? 'bg-indigo-900 text-white' : simIsPlaying ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-900 hover:bg-blue-50'}`}
              title={simIsPlaying ? "Pause Backtest" : isSimulating ? "Close Panel" : "Open Backtest Panel"}
            >
              {isSimulating ? (
                <X size={isMobileLandscape ? 12 : 14} />
              ) : simIsPlaying ? (
                <Pause size={isMobileLandscape ? 12 : 14} className="text-indigo-600 animate-pulse" fill="currentColor" />
              ) : (
                <Play size={isMobileLandscape ? 12 : 14} fill="currentColor" strokeWidth={0} />
              )}
            </button>
          </>
        )}

      </motion.div>
    )}
  </AnimatePresence>

          {/* Main Viewport */}
      <main ref={workspaceRef} className="flex-1 flex flex-col relative min-w-0 h-full">
        <div className="flex-grow relative bg-white flex flex-col overflow-hidden h-full">
          {/* Desktop/Mobile Menu Popup */}
          <AnimatePresence>
            {isDesktopMenuOpen && (
              <motion.div
                ref={desktopMenuPopupRef}
                initial={{ opacity: 0, x: -10, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -10, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 450, damping: 28 }}
                className={isMobileLandscape 
                  ? "absolute left-[11vh] top-2 bottom-2 h-[calc(100%-16px)] w-44 md:w-52 z-[110] bg-white/95 backdrop-blur-2xl border border-slate-100 rounded-2xl shadow-2xl p-1.5 flex flex-col gap-0.5 overflow-y-auto scrollbar-hide text-slate-800"
                  : "absolute left-[142px] top-4 bottom-4 h-[calc(100%-32px)] w-52 md:w-56 z-[110] bg-white/95 backdrop-blur-3xl border border-slate-150/80 rounded-[2.25rem] shadow-2xl p-4 flex flex-col text-slate-800"
                }
              >
                <div className="flex items-center justify-between px-2.5 py-1 border-b border-slate-100 pb-2 mb-2 shrink-0">
                  <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">Menu</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDesktopMenuOpen(false);
                    }}
                    className="text-slate-400 hover:text-slate-900 transition-colors p-0.5"
                  >
                    <X size={10} strokeWidth={2.5} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-1 pr-0.5">
                  <button
                    onClick={() => {
                      setIsMenuOpen(!isMenuOpen);
                      setIsDesktopMenuOpen(false);
                    }}
                    className="flex items-center gap-2.5 px-2.5 py-2 text-[10px] font-black text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all text-left w-full whitespace-nowrap cursor-pointer"
                  >
                    <Info size={12} className="text-blue-500" />
                    <span>Details</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setSelectedSymbol(null);
                      setIsDesktopMenuOpen(false);
                    }}
                    className="flex items-center gap-2.5 px-2.5 py-2 text-[10px] font-black text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all text-left w-full whitespace-nowrap cursor-pointer"
                  >
                    <List size={12} className="text-emerald-500" />
                    <span>Watchlist</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setIsSetupModalOpen(true);
                      setIsDesktopMenuOpen(false);
                    }}
                    className="flex items-center gap-2.5 px-2.5 py-2 text-[10px] font-black text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all text-left w-full whitespace-nowrap cursor-pointer"
                  >
                    <LayoutGrid size={12} className="text-violet-500" />
                    <span>Setup</span>
                  </button>

                  <div className="h-px bg-slate-100 my-1 mx-1 shrink-0" />

                  <button
                    onClick={() => {
                      handleRefreshChart();
                      setIsDesktopMenuOpen(false);
                    }}
                    className="flex items-center gap-2.5 px-2.5 py-2 text-[10px] font-black text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all text-left w-full whitespace-nowrap cursor-pointer"
                  >
                    <RefreshCcw size={12} className="text-indigo-500" />
                    <span>Refresh Charts</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMenuOpen(true);
                      setSidebarTab('trades');
                      setIsDesktopMenuOpen(false);
                    }}
                    className="flex items-center gap-2.5 px-2.5 py-2 text-[10px] font-black text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all text-left w-full whitespace-nowrap cursor-pointer"
                  >
                    <Repeat size={12} className="text-amber-500" />
                    <span>Replay Trade</span>
                  </button>

                  <button
                    onClick={() => {
                      if (subscriptionPlan === 'basic') {
                        const pairKey = activeWatchlistItemId || (activePrefix ? `${selectedSymbol}_${activePrefix}` : selectedSymbol) || 'default';
                        const usage = pairUsageLimits[pairKey] || { replays: 0, syncedCharts: 0, trades: 0 };
                        if (usage.syncedCharts >= 1) {
                          setAdsLimitModalFeature('sync');
                          setIsAdsLimitModalOpen(true);
                        } else {
                          updatePairLimit(pairKey, { syncedCharts: usage.syncedCharts + 1 });
                          setIsSyncedSelectorOpen(true);
                        }
                      } else {
                        setIsSyncedSelectorOpen(true);
                      }
                      setIsDesktopMenuOpen(false);
                    }}
                    className="flex items-center gap-2.5 px-2.5 py-2 text-[10px] font-black text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all text-left w-full whitespace-nowrap cursor-pointer"
                  >
                    <Link2 size={12} className="text-indigo-500" />
                    <span>Synced Charts</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSettingsOpen(true);
                      setIsDesktopMenuOpen(false);
                    }}
                    className="flex items-center gap-2.5 px-2.5 py-2 text-[10px] font-black text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all text-left w-full whitespace-nowrap cursor-pointer"
                  >
                    <Settings size={12} className="text-indigo-500" />
                    <span>Settings</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Timeframe Popup */}
          <AnimatePresence>
            {isTimeframeOpen && (
              <motion.div 
                ref={timeframePopupRef}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={isMobileLandscape
                  ? "absolute left-[11vh] top-2 bottom-2 h-[calc(100%-16px)] w-36 md:w-44 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden p-1 z-[60] flex flex-col"
                  : isMobile
                    ? "absolute left-1/2 -translate-x-1/2 bottom-[81px] w-36 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden p-1 z-[60]"
                    : "absolute left-[142px] top-4 bottom-4 h-[calc(100%-32px)] w-44 bg-white/95 backdrop-blur-3xl border border-slate-150/80 rounded-[2.25rem] shadow-2xl p-4 z-[110] flex flex-col text-slate-800"
                }
              >
                {(!isMobile && !isMobileLandscape) && (
                  <div className="flex items-center justify-between px-2.5 py-1 border-b border-slate-100 pb-2 mb-2 shrink-0">
                    <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">Intervals</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsTimeframeOpen(false);
                      }}
                      className="text-slate-400 hover:text-slate-900 transition-colors p-0.5"
                    >
                      <X size={10} strokeWidth={2.5} />
                    </button>
                  </div>
                )}
                <div className={isMobileLandscape ? "flex-1 overflow-y-auto scrollbar-hide" : isMobile ? "max-h-[160px] md:max-h-[220px] overflow-y-auto scrollbar-hide flex flex-col gap-1 p-1 pr-0.5" : "flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-1 pr-0.5"}>
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf.id}
                      onClick={() => {
                        handleTimeframeChange(tf);
                        setIsTimeframeOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-[10px] font-bold tracking-normal rounded-xl transition-all block ${selectedTimeframe.id === tf.id ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={`flex-grow flex flex-col transition-all duration-300 h-full ${isLoadingPast && historicalData.length > 0 ? 'blur-[1.5px] opacity-75 pointer-events-none' : 'blur-0 opacity-100'}`}>
            {(() => {
                // Resolved indicators for the synced comparison chart
                const syncedIndicatorsToRender = syncedSymbol ? indicators.filter(ind => {
                  if (syncedIndicatorsActive.length === 0) return true; // Default to all
                  const label = ind.name || ind.type;
                  return syncedIndicatorsActive.some(activeName => 
                    label.toUpperCase().includes(activeName.toUpperCase()) || 
                    ind.type.toUpperCase().includes(activeName.toUpperCase())
                  );
                }) : [];

                // Price display for Synced
                let syncedFullName = '';
                let formattedSyncedPrice = '---';
                if (syncedSymbol) {
                  const syncedPriceNum = visibleSyncedData[visibleSyncedData.length - 1]?.close ?? null;
                  const syncedCategory = POPULAR_SYMBOLS.find(s => s.symbol === syncedSymbol)?.category || 'Crypto';
                  if (syncedPriceNum !== null) {
                    if (syncedCategory === 'Forex' || syncedPriceNum < 5) {
                      formattedSyncedPrice = syncedPriceNum.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 });
                    } else if (syncedPriceNum >= 500) {
                      formattedSyncedPrice = syncedPriceNum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                    } else {
                      formattedSyncedPrice = syncedPriceNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    }
                  }
                  syncedFullName = POPULAR_SYMBOLS.find(s => s.symbol === syncedSymbol)?.name || syncedSymbol;
                }

                // Price display for Main
                const mainCategory = POPULAR_SYMBOLS.find(s => s.symbol === selectedSymbol)?.category || 'Crypto';
                const lastVisibleCandleClose = visibleData[visibleData.length - 1]?.close ?? null;
                const mainPriceNum = (isSimulating || currentSessionKey || isReplayMode)
                  ? (simCurrentPrice !== null 
                      ? simCurrentPrice 
                      : (nonPlayingTickPrice !== null ? nonPlayingTickPrice : lastVisibleCandleClose))
                  : (nonPlayingTickPrice !== null ? nonPlayingTickPrice : (historicalData[historicalData.length - 1]?.close ?? null));
                let formattedMainPrice = '---';
                if (mainPriceNum !== null) {
                  if (mainCategory === 'Forex' || mainPriceNum < 5) {
                    formattedMainPrice = mainPriceNum.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 });
                  } else if (mainPriceNum >= 500) {
                    formattedMainPrice = mainPriceNum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                  } else {
                    formattedMainPrice = mainPriceNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  }
                }
                const mainFullName = POPULAR_SYMBOLS.find(s => s.symbol === selectedSymbol)?.name || selectedSymbol;
                const activeViewStateKey = activeWatchlistItemId || (selectedSymbol ? (activePrefix ? `${selectedSymbol}_${activePrefix}` : selectedSymbol) : '');

                const mainItem = watchlist.find((i: any) => i.id === activeWatchlistItemId) || 
                                 watchlist.find((i: any) => i.symbol === selectedSymbol && (i.prefix || null) === (activePrefix || null));
                const mainRawSource = mainItem?.dataSource || (mainCategory === 'Crypto' ? 'bybit' : 'axiory');
                let mainDisplaySource = mainRawSource.toUpperCase() === 'AXIORY' ? 'AXIORY' : mainRawSource.toUpperCase() === 'BINANCE' ? 'BINANCE' : mainRawSource.toUpperCase() === 'BYBIT' ? 'BYBIT' : mainRawSource.toUpperCase() === 'OKX' ? 'OKX' : mainRawSource.toUpperCase();

                // Synced Panel (only rendered/used when syncedSymbol is active)
                const syncedPanel = syncedSymbol && (
                  <div className="flex-grow flex-1 relative min-h-0 min-w-0 bg-white flex flex-col w-full h-full">
                    {/* Top Right Synced Info Overlay */}
                    <div className="absolute top-2 right-4 z-10 select-none bg-white/80 backdrop-blur-sm px-2.5 py-1 rounded-xl border border-slate-100/50">
                      <div className="flex flex-col items-end leading-none">
                        <div className="flex items-center gap-1 text-[8px] sm:text-[9px] font-black tracking-tight text-slate-500 uppercase">
                          <span>{syncedDataSource || 'Binance'}</span>
                          <span>:</span>
                          <span>{syncedSymbol?.replace('/', '')}</span>
                          <span className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded text-[7px] font-black ml-1 uppercase">{renderedSyncedTimeframe.label}</span>
                        </div>
                        <div className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-950 tracking-tight mt-0.5">
                          {formattedSyncedPrice}
                        </div>
                        <div className="text-[7px] font-bold text-slate-400 uppercase tracking-tight text-right mt-0.5 max-w-[120px] truncate">
                          {syncedFullName}
                        </div>
                      </div>
                    </div>

                    <MemoizedChart 
                      ref={syncedChartEngineRef}
                      data={visibleSyncedData} 
                      trades={EMPTY_TRADES_ARRAY} 
                      symbol={syncedSymbol}
                      prefix={undefined}
                      isReplay={isReplayMode}
                      isSimulating={isSimulating}
                      theme={activeTheme} 
                      indicators={syncedIndicatorsToRender}
                      onLoadMore={loadMoreSyncedPast}
                      isLoadingMore={isSyncedLoading}
                      drawingTool={activeSyncedDrawingTool}
                      drawings={syncedChartDrawings}
                      onDrawingsChange={handleSyncedDrawingsChange}
                      selectedId={selectedSyncedDrawing?.id}
                      onSelectDrawing={handleSyncedSelectDrawing}
                      onDrawingComplete={handleSyncedDrawingComplete}
                      pinnedText={null}
                      viewport={undefined}
                      onViewportChange={handleSyncedViewportChange}
                      timeframe={renderedSyncedTimeframe.label}
                      historicalData={syncedData}
                      isNewsStreamEnabled={isNewsStreamEnabled}
                      onNewsClick={(newsItems, isFuture) => setSelectedNewsGroup({ newsItems, isFuture })}
                      setups={setups}
                      source={syncedDataSource || 'binance'}
                      onUpgradeClick={() => {
                        setSavedSymbolBeforeSubscription(selectedSymbol);
                        setSubscriptionBackTarget('chart-room');
                        setSelectedSymbol(null);
                        setActiveTab('subscription');
                      }}
                      userPlan={subscriptionPlan}
                    />

                    {/* Bottom Left controls: Cancel/Close and Star Button */}
                    <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
                      {/* Cancel/Close Sync Button */}
                      <button
                        onClick={() => {
                          setSyncedSymbol(null);
                          setSyncedData([]);
                          setSelectedSyncedDrawing(null);
                          setActiveSyncedDrawingTool(null);
                          setShowSyncedFavorites(false);
                          setIsChartsFlipped(false);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-650 text-slate-600 flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95 group"
                        title="Cancel Sync"
                      >
                        <X size={12} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-200" />
                      </button>

                      {/* Star Toggle Button */}
                      <button
                        onClick={() => setShowSyncedFavorites(!showSyncedFavorites)}
                        className={`p-1.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer shadow-md ${
                          showSyncedFavorites
                            ? 'bg-amber-500 border-amber-500 text-white' 
                            : 'bg-white border-slate-200 text-amber-500 hover:bg-amber-50'
                        }`}
                        title="Toggle Synced Favorites"
                      >
                        <Star size={12} strokeWidth={2.5} fill={showSyncedFavorites ? 'currentColor' : 'none'} />
                      </button>
                    </div>

                    {/* Synced Floating Favorites Toolbar */}
                    <AnimatePresence>
                      {showSyncedFavorites && (
                        <FavoriteDrawingsToolbar 
                          favorites={favorites}
                          activeTool={activeSyncedDrawingTool}
                          onSelectTool={setActiveSyncedDrawingTool}
                          pos={syncedFavoritesPos}
                          onPosChange={setSyncedFavoritesPos}
                          isMobile={isMobile}
                          isMobileLandscape={isMobileLandscape}
                          selectedDrawing={selectedSyncedDrawing}
                          onUpdateDrawing={handleSyncedUpdateDrawing}
                          onDeleteDrawing={handleSyncedDeleteDrawing}
                          onCloseDrawing={handleSyncedCloseDrawing}
                          setups={setups}
                          onCreateQuickTrade={(direction, setupGrade) => handleCreateQuickTrade(direction, setupGrade, 'synced')}
                          isReplayMode={isReplayMode}
                          isSimulating={isSimulating}
                          simIsPlaying={simIsPlaying}
                          replayIsPlaying={replayIsPlaying}
                          togglePlayback={togglePlayback}
                          setSimIsPlaying={setSimIsPlaying}
                          setReplayIsPlaying={setReplayIsPlaying}
                          simSpeed={simSpeed}
                          setSimSpeed={setSimSpeed}
                          currentSessionKey={currentSessionKey}
                          backtestSessions={backtestSessions}
                          setBacktestSessions={setBacktestSessions}
                          addNotification={addNotification}
                          subscriptionPlan={subscriptionPlan}
                          onLockedFeature={(feat: any) => {
                            setUpgradeModalFeature(feat);
                            setIsUpgradeModalOpen(true);
                          }}
                          setShowSyncInfoModal={setShowSyncInfoModal}
                          exitReplay={exitReplay}
                          setIsSimulating={setIsSimulating}
                          setSimCurrentTime={setSimCurrentTime}
                          setReplayCurrentTime={setReplayCurrentTime}
                          getStepSeconds={getStepSeconds}
                          historicalDataRef={historicalDataRef}
                          replayTrade={replayTrade}
                          sessionCurrentTimesRef={sessionCurrentTimesRef}
                          activePrefix={activePrefix}
                          selectedSymbol={selectedSymbol}
                          watchlist={watchlist}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                );

                const mainPanel = (
                  <div className="flex-grow flex-1 relative min-h-0 min-w-0 bg-white flex flex-col w-full h-full">
                    {/* Top Right Main Info Overlay in Split Screen */}
                    {syncedSymbol && (
                      <div className="absolute top-2 right-4 z-10 select-none bg-white/80 backdrop-blur-sm px-2.5 py-1 rounded-xl border border-slate-100/50">
                        <div className="flex flex-col items-end leading-none">
                          <div className="flex items-center gap-1 text-[8px] sm:text-[9px] font-black tracking-tight text-slate-500 uppercase">
                            <span>{mainDisplaySource}</span>
                            <span>:</span>
                            <span>{selectedSymbol?.replace('/', '')}</span>
                            <span className="bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded text-[7px] font-black ml-1 uppercase">{renderedTimeframe.label}</span>
                          </div>
                          <div className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-950 tracking-tight mt-0.5">
                            {formattedMainPrice}
                          </div>
                          <div className="text-[7px] font-bold text-slate-400 uppercase tracking-tight text-right mt-0.5 max-w-[120px] truncate">
                            {mainFullName}
                          </div>
                        </div>
                      </div>
                    )}
                    <MemoizedChart 
                      ref={chartEngineRef}
                      data={visibleData} 
                      trades={results.trades} 
                      symbol={selectedSymbol || ''}
                      prefix={activePrefix || undefined}
                      isReplay={isReplayMode}
                      isSimulating={isSimulating}
                      theme={activeTheme} 
                      indicators={indicators}
                      onLoadMore={loadMorePast}
                      isLoadingMore={isLoadingPast || isLoadingMorePast}
                      drawingTool={activeDrawingTool}
                      drawings={mainChartDrawings}
                      selectedId={selectedDrawing?.id}
                      drawingSettings={drawingSettings}
                      onDrawingsChange={handleMainDrawingsChange}
                      onSelectDrawing={setSelectedDrawing}
                      onDrawingComplete={handleMainDrawingComplete}
                      onDrawingSettingsChange={setDrawingSettings}
                      pinnedText={pinnedText}
                      viewport={activeViewStateKey && symbolViewStates[activeViewStateKey] ? symbolViewStates[activeViewStateKey].viewport : undefined}
                      onViewportChange={handleMainViewportChange}
                      timeframe={renderedTimeframe.label}
                      onDrawingTrigger={handleMainDrawingTrigger}
                      onTradeClosed={handleMainTradeClosed}
                      historicalData={historicalData}
                      isNewsStreamEnabled={isNewsStreamEnabled}
                      onNewsClick={(newsItems, isFuture) => setSelectedNewsGroup({ newsItems, isFuture })}
                      setups={setups}
                      source={mainRawSource}
                      onUpgradeClick={() => {
                        setSavedSymbolBeforeSubscription(selectedSymbol);
                        setSubscriptionBackTarget('chart-room');
                        setSelectedSymbol(null);
                        setActiveTab('subscription');
                      }}
                      userPlan={subscriptionPlan}
                    />

                    {/* Main Floating Favorites Toolbar inside mainPanel during split screen comparison */}
                    <AnimatePresence>
                      {showFavoritesByMode[currentMode] && (
                        <FavoriteDrawingsToolbar 
                          key={`favorites-toolbar-panel-${currentMode}`}
                          favorites={favorites}
                          activeTool={activeDrawingTool}
                          onSelectTool={setActiveDrawingTool}
                          pos={activeFavoritesPos}
                          onPosChange={updateFavoritesPosWithClamp}
                          isMobileLandscape={isMobileLandscape}
                          isMobile={isMobile}
                          constraintsRef={workspaceRef}
                          selectedDrawing={selectedDrawing}
                          onUpdateDrawing={handleMainUpdateDrawing}
                          onDeleteDrawing={handleMainDeleteDrawing}
                          onCloseDrawing={handleMainCloseDrawing}
                          setups={setups}
                          onCreateQuickTrade={(direction, setupGrade) => handleCreateQuickTrade(direction, setupGrade, 'main')}
                          isReplayMode={isReplayMode}
                          isSimulating={isSimulating}
                          simIsPlaying={simIsPlaying}
                          replayIsPlaying={replayIsPlaying}
                          togglePlayback={togglePlayback}
                          setSimIsPlaying={setSimIsPlaying}
                          setReplayIsPlaying={setReplayIsPlaying}
                          simSpeed={simSpeed}
                          setSimSpeed={setSimSpeed}
                          currentSessionKey={currentSessionKey}
                          backtestSessions={backtestSessions}
                          setBacktestSessions={setBacktestSessions}
                          addNotification={addNotification}
                          subscriptionPlan={subscriptionPlan}
                          onLockedFeature={(feat: any) => {
                            setUpgradeModalFeature(feat);
                            setIsUpgradeModalOpen(true);
                          }}
                          setShowSyncInfoModal={setShowSyncInfoModal}
                          exitReplay={exitReplay}
                          setIsSimulating={setIsSimulating}
                          setSimCurrentTime={setSimCurrentTime}
                          setReplayCurrentTime={setReplayCurrentTime}
                          getStepSeconds={getStepSeconds}
                          historicalDataRef={historicalDataRef}
                          replayTrade={replayTrade}
                          sessionCurrentTimesRef={sessionCurrentTimesRef}
                          activePrefix={activePrefix}
                          selectedSymbol={selectedSymbol}
                          watchlist={watchlist}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                );

                const isSideBySide = syncedSymbol ? (!isMobile || isMobileLandscape) : false;
                return (
                  <div className={`flex-grow flex h-full overflow-hidden relative ${
                    syncedSymbol
                      ? (isSideBySide 
                          ? (isChartsFlipped ? 'flex-row-reverse' : 'flex-row') 
                          : (isChartsFlipped ? 'flex-col-reverse' : 'flex-col'))
                      : 'flex-col'
                  }`}>
                    {/* First Panel physically in DOM */}
                    {mainPanel}

                    {/* Highly Polished Interactive Divider Line with Swap Button */}
                    {syncedSymbol && (
                      <div className={`relative bg-slate-100 flex items-center justify-center z-30 select-none shrink-0 ${
                        isSideBySide ? 'w-[2px] h-full cursor-col-resize' : 'h-[2px] w-full cursor-row-resize'
                      }`}>
                        <div className={`absolute bg-slate-200 ${
                          isSideBySide ? 'top-0 bottom-0 w-[1px] left-1/2 -translate-x-1/2' : 'left-0 right-0 h-[1px] top-1/2 -translate-y-1/2'
                        }`} />
                        <button
                          onClick={() => setIsChartsFlipped(!isChartsFlipped)}
                          className="absolute p-2 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-slate-900 shadow-md transition-all duration-300 cursor-pointer active:scale-95 group/swap z-10 hover:shadow-lg"
                          title="Swap Chart Layout Position"
                        >
                          {isSideBySide ? (
                            <ArrowLeftRight size={12} className="transition-transform duration-500 group-hover/swap:rotate-180 text-slate-500 hover:text-slate-900" strokeWidth={2.5} />
                          ) : (
                            <ArrowUpDown size={12} className="transition-transform duration-500 group-hover/swap:rotate-180 text-slate-500 hover:text-slate-900" strokeWidth={2.5} />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Second Panel physically in DOM */}
                    {syncedSymbol && syncedPanel}
                  </div>
                );
            })()}
          </div>

          {isLoadingPast && historicalData.length === 0 && !rateLimitError && (
            <div className="absolute inset-0 z-30 bg-white flex flex-col overflow-hidden animate-pulse">
              {/* Fake Chart Header Skeleton */}
              <div className="h-10 border-b border-slate-50 flex items-center px-4 gap-4">
                <div className="h-4 w-24 bg-slate-100 rounded" />
                <div className="h-4 w-16 bg-slate-50 rounded" />
                <div className="h-4 w-16 bg-slate-50 rounded" />
              </div>
              
              {/* Chart Grid Lines Skeleton */}
              <div className="flex-1 relative">
                <div className="absolute right-0 top-0 bottom-0 w-16 border-l border-slate-50 flex flex-col justify-around py-4">
                  {[1,2,3,4,5,6].map(i => <div key={i} className="h-2 w-10 bg-slate-50/50 self-center rounded" />)}
                </div>
                <div className="absolute bottom-0 left-0 right-16 h-8 border-t border-slate-50 flex justify-around items-center">
                  {[1,2,3,4,5].map(i => <div key={i} className="h-2 w-12 bg-slate-50/50 rounded" />)}
                </div>
                
                {/* Fake Candles Skeleton */}
                <div className="absolute inset-0 right-16 bottom-8 p-10 flex items-end gap-2 overflow-hidden">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-0.5 shrink-0">
                      <div className="w-0.5 h-4 bg-slate-50/80 rounded-full" />
                      <div className={`w-3 rounded-sm bg-slate-100/50`} style={{ height: `${20 + Math.random() * 60}px` }} />
                      <div className="w-0.5 h-4 bg-slate-50/80 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {rateLimitError && (
            <div className="absolute inset-0 z-30 bg-white/90 backdrop-blur-sm flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[2rem] shadow-2xl p-8 max-w-sm border border-slate-100 text-center"
              >
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Clock className="text-amber-500" size={24} />
                </div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight mb-2">API Cooldown</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">
                  Twelve Data free tier is limited to <span className="font-bold text-slate-900">8 requests per minute</span>. Please wait about 45 seconds for the limit to reset.
                </p>
                <button 
                  onClick={() => {
                    if (selectedSymbol && currentSessionKey && backtestSessions[currentSessionKey]) {
                      const activeItem = watchlist.find(i => i.id === activeWatchlistItemId);
                      loadMarketData(selectedSymbol, selectedTimeframe.id, backtestSessions[currentSessionKey].startTime, activeItem?.dataSource);
                    }
                  }}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                  <RefreshCcw size={14} />
                  Retry Connection
                </button>
              </motion.div>
            </div>
          )}

          {/* Chart Interaction Layer (Settings / Navigation) */}
          {!isMobile && (
            <div className="absolute bottom-6 right-1 z-40 flex flex-col items-end gap-2 px-3">
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="text-slate-900 hover:text-black transition-all hover:rotate-45 p-1"
                title="Settings"
              >
                <Settings2 size={16} strokeWidth={2.5} />
              </button>
            </div>
          )}

          <AnimatePresence>
            {currentSelectedDrawing && (currentSelectedDrawing.status === 'won' || currentSelectedDrawing.status === 'lost') ? (
              // Clicked in canvas: do not show the big close trade detail card, only local top-right animated detail shown inside ChartComponent
              null
            ) : currentSelectedDrawing && !showFavoritesByMode[currentMode] ? (
              <DrawingSettingsBox 
                drawing={currentSelectedDrawing}
                onUpdate={(settings) => updateDrawing(currentSelectedDrawing.id, { settings: { ...currentSelectedDrawing.settings, ...settings } })}
                onDelete={() => deleteDrawing(currentSelectedDrawing.id)}
                onClose={() => setSelectedDrawing(null)}
                pos={activeDrawingSettingsPos}
                onPosChange={updateDrawingSettingsPos}
              />
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {showToolbarByMode[currentMode] && activeTab === 'drawings' && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => { setActiveTab('chart'); setActiveDrawingTool(null); }} />
                <motion.div
                  key={`drawing-toolbar-${currentMode}`}
                  drag
                  dragMomentum={false}
                  dragElastic={0}
                  dragConstraints={workspaceRef}
                  onDragEnd={(_e, info) => {
                    const newPos = { x: info.offset.x + activeToolbarPos.x, y: info.offset.y + activeToolbarPos.y };
                    updateToolbarPosWithClamp(newPos);
                  }}
                  whileDrag={{ scale: 1.02, cursor: 'grabbing' }}
                  initial={false}
                  animate={{ 
                    opacity: 1, 
                    x: activeToolbarPos.x, 
                    y: activeToolbarPos.y,
                    transition: { type: 'spring', damping: 30, stiffness: 400 }
                  }}
                  exit={{ opacity: 0, x: activeToolbarPos.x - 20, scale: 0.95 }}
                  className={`fixed ${isMobileLandscape ? 'left-8' : 'left-20'} top-1/2 -translate-y-1/2 z-50 shadow-2xl rounded-3xl cursor-move active:cursor-grabbing pointer-events-auto`}
                >
                  <DrawingToolbar 
                    activeTool={activeDrawingTool} 
                    onSelectTool={(tool) => {
                      setActiveDrawingTool(tool);
                      if (tool) setActiveTab('chart');
                    }} 
                    favorites={favorites}
                    onToggleFavorite={toggleFavorite}
                    isMobile={isMobile}
                    isMobileLandscape={isMobileLandscape}
                    xPos={activeToolbarPos.x}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>


        </div>
      </main>

      {/* Side Slide Bar (New Implementation) */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-[998] focus:outline-none"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className={`fixed inset-y-0 left-0 bg-white shadow-2xl z-[999] border-r border-slate-100 flex flex-col transition-all duration-300 ${isMobileLandscape ? 'w-[75vw] max-w-sm' : 'w-full sm:w-85'}`}
            >
              {/* Sidebar Header */}
              <div className="p-5 border-b border-slate-50 shrink-0 bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {selectedSymbol && (() => {
                      const asset = POPULAR_SYMBOLS.find(s => s.symbol === normalizeSymbol(selectedSymbol));
                      const innerSessionKey = activeWatchlistItemId || (activePrefix ? `${selectedSymbol}_${activePrefix}` : (selectedSymbol || ''));
                      const session = backtestSessions[innerSessionKey] || (selectedSymbol ? backtestSessions[activePrefix ? `${selectedSymbol}_${activePrefix}` : selectedSymbol] : null);
                      
                      return (
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center p-1.5 ring-1 ring-slate-100 shrink-0">
                            {asset?.logo ? (
                              <img src={asset.logo} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xs">
                                {selectedSymbol.substring(0, 2)}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h2 className="text-sm font-black text-slate-900 tracking-tight truncate">{selectedSymbol}</h2>
                              {activePrefix && (
                                <span className="px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase tracking-wider">{activePrefix}</span>
                              )}
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">
                              {session?.description || asset?.name || 'Live Market'}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <button 
                    onClick={() => setIsMenuOpen(false)}
                    className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-all active:scale-95 shrink-0"
                  >
                    <X size={20} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* Sidebar Scrollable Content */}
              <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col">
                {selectedSymbol ? (
                  <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col">
                    {/* Secondary Navigation Shortcuts */}
                    <div className="px-5 py-3 border-b border-slate-50 flex items-center gap-2.5 bg-slate-50/50 shrink-0">
                      <button
                        onClick={() => {
                          setSelectedSymbol(null);
                          setIsMenuOpen(false);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white hover:bg-slate-100/70 text-slate-700 hover:text-slate-900 border border-slate-100 rounded-xl transition-all shadow-sm active:scale-95 text-[10px] font-black uppercase tracking-wider"
                      >
                        <List size={13} className="text-emerald-500" />
                        <span>Watchlist</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsSetupModalOpen(true);
                          setIsMenuOpen(false);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white hover:bg-slate-100/70 text-slate-700 hover:text-slate-900 border border-slate-100 rounded-xl transition-all shadow-sm active:scale-95 text-[10px] font-black uppercase tracking-wider"
                      >
                        <LayoutGrid size={13} className="text-violet-500" />
                        <span>Setup</span>
                      </button>
                    </div>

                    <SidebarSessionDetails 
                      selectedSymbol={selectedSymbol}
                      activePrefix={activePrefix}
                      backtestSessions={backtestSessions}
                      filteredMergedTrades={filteredMergedTrades}
                      historyCategory={historyCategory}
                      simCurrentTime={simCurrentTime}
                    />

                      {/* Setup Grade Filter Tabs */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Class Filters</label>
                          <span className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">Journal Engine</span>
                        </div>
                        <div className="flex items-center p-1 bg-slate-100/50 rounded-[1.25rem] gap-0.5">
                          {availableSetups.map(setup => {
                            const setupNorm = setup.trim().toUpperCase();
                            const count = (mergedTrades || []).filter(t => setupNorm === 'ALL' || (t.setupGrade || '').trim().toUpperCase() === setupNorm).length;
                            return (
                              <button
                                key={setup}
                                onClick={() => setHistoryCategory(setup)}
                                className={`flex-1 py-1.5 rounded-xl text-[9px] font-black transition-all active:scale-95 group relative ${
                                  historyCategory === setup 
                                    ? 'bg-white text-slate-900 shadow-sm' 
                                    : 'text-slate-400 hover:text-slate-600'
                                }`}
                              >
                                <div className="flex flex-col items-center">
                                  <span>{setup}</span>
                                  {count > 0 && <span className="text-[7px] opacity-75">{count}</span>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Setup Strategy Model Display (Selected Category Highlights) */}
                      {historyCategory !== 'All' && (
                        <div className="bg-indigo-50/50 rounded-2xl border border-indigo-100/30 overflow-hidden">
                          <button 
                            onClick={() => setShowSetupDetails(!showSetupDetails)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-indigo-100/30 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Model: {historyCategory}</h3>
                              <div className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[8px] font-black uppercase">Active Rules</div>
                            </div>
                            <ChevronDown 
                              size={14} 
                              className={`text-indigo-400 transition-transform duration-300 ${showSetupDetails ? 'rotate-180' : ''}`} 
                            />
                          </button>
                          
                          <AnimatePresence>
                            {showSetupDetails && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                              >
                                <div className="p-4 pt-0">
                                  {(() => {
                                    const setupData = setups.find(s => (s.grade || '').trim().toUpperCase() === (historyCategory || '').trim().toUpperCase());
                                    if (!setupData) return <div className="text-[9px] font-bold text-slate-400 italic">No rules defined for this grade.</div>;
                                    
                                    return (
                                      <div className="space-y-3">
                                        {setupData.image_url && (
                                          <div className="aspect-video rounded-xl overflow-hidden border border-indigo-100/50 shadow-sm">
                                            <img src={setupData.image_url} alt={`${historyCategory} Model`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                          </div>
                                        )}
                                        {setupData.confluences && setupData.confluences.length > 0 && (
                                          <div className="flex flex-wrap gap-1.5">
                                            {setupData.confluences.map((c: string, idx: number) => (
                                              <div key={idx} className="bg-white border border-indigo-100 px-2.5 py-1 rounded-lg text-[9px] font-bold text-slate-600 shadow-sm">
                                                {c}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {(!setupData.confluences || setupData.confluences.length === 0) && !setupData.image_url && (
                                          <div className="text-[9px] font-bold text-slate-400 italic">Rules documented in setup configuration.</div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                    {/* Stats vs Trades Tabs */}
                    <div className="space-y-4">
                      <div className="flex p-1.5 bg-slate-100/50 rounded-2xl">
                        <button 
                          onClick={() => setSidebarTab('stats')}
                          className={`flex-1 py-2.5 rounded-xl text-[11px] font-black transition-all uppercase tracking-tight ${sidebarTab === 'stats' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
                        >
                          Insights
                        </button>
                        <button 
                          onClick={() => setSidebarTab('trades')}
                          className={`flex-1 py-2.5 rounded-xl text-[11px] font-black transition-all uppercase tracking-tight ${sidebarTab === 'trades' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
                        >
                          Evolution
                        </button>
                      </div>

                      {/* Content Section */}
                      <AnimatePresence mode="wait">
                        {sidebarTab === 'stats' ? (
                          <motion.div 
                            key="stats"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="grid grid-cols-2 gap-3"
                          >
                            {(() => {
                              const trades = (filteredMergedTrades || []).filter(t => {
                                const cat = (historyCategory || 'All').trim().toUpperCase();
                                if (cat === 'ALL') return true;
                                return (t.setupGrade || '').trim().toUpperCase() === cat;
                              });
                              if (trades.length === 0) return <div className="col-span-2 py-8 text-center text-slate-300 text-[10px] font-bold italic uppercase tracking-widest">No matching data</div>;

                              const tps = trades.filter(t => t.status === 'TP');
                              const sls = trades.filter(t => t.status === 'SL');
                              const winRate = (tps.length / trades.length) * 100;
                              const avgWin = tps.reduce((s, t) => s + (t.rr || 0), 0) / (tps.length || 1);
                              const avgLoss = sls.reduce((s, t) => s + (t.rr || 0), 0) / (sls.length || 1);
                              const totalPips = trades.reduce((s, t) => s + (t.pips || 0), 0);
                              const avgPips = totalPips / (trades.length || 1);
                              
                              // Advanced Calcs
                              let maxWinStreak = 0;
                              let maxLossStreak = 0;
                              let currentWinStreak = 0;
                              let currentLossStreak = 0;
                              trades.forEach(t => {
                                if (t.status === 'TP') {
                                  currentWinStreak++;
                                  currentLossStreak = 0;
                                  if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
                                } else if (t.status === 'SL') {
                                  currentLossStreak++;
                                  currentWinStreak = 0;
                                  if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
                                }
                              });

                              let peak = 0;
                              let maxDrawdown = 0;
                              let runningRR = 0;
                              trades.forEach(t => {
                                runningRR += (t.rr || 0);
                                if (runningRR > peak) peak = runningRR;
                                const dd = peak - runningRR;
                                if (dd > maxDrawdown) maxDrawdown = dd;
                              });

                              const durations = trades.map(t => (t.exitTime - t.entryTime) / 60);
                              const avgDuration = durations.reduce((a, b) => a + b, 0) / (durations.length || 1);
                              
                              const tfMap: Record<string, number> = {};
                              trades.forEach(t => {
                                const tf = t.timeframe || '1m';
                                tfMap[tf] = (tfMap[tf] || 0) + 1;
                              });
                              const mostUsedTF = Object.entries(tfMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '---';

                              // Weekly Activity Calculation
                              const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                              const weeklyActivity = days.map((day, idx) => {
                                const dayTrades = trades.filter(t => new Date(t.exitTime * 1000).getDay() === idx);
                                return {
                                  day,
                                  count: dayTrades.length,
                                  tp: dayTrades.filter(t => t.status === 'TP').length,
                                  sl: dayTrades.filter(t => t.status === 'SL').length,
                                  percent: trades.length > 0 ? (dayTrades.length / trades.length) * 100 : 0
                                };
                              });

                              // Yearly/Monthly Performance Calculation
                              const yearlyPerformance: Record<number, { month: number, rr: number, trades: number }[]> = {};
                              trades.forEach(t => {
                                const date = new Date(t.exitTime * 1000);
                                const year = date.getFullYear();
                                const month = date.getMonth();
                                if (!yearlyPerformance[year]) {
                                  yearlyPerformance[year] = Array.from({ length: 12 }, (_, i) => ({ month: i, rr: 0, trades: 0 }));
                                }
                                yearlyPerformance[year][month].rr += (t.rr || 0);
                                yearlyPerformance[year][month].trades += 1;
                              });
                              const years = Object.keys(yearlyPerformance).map(Number).sort((a, b) => b - a);

                              return (
                                <>
                                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Executed</div>
                                    <div className="text-xl font-black text-slate-900">{trades.length}<span className="text-[10px] text-slate-400 ml-1">Trades</span></div>
                                  </div>
                                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Win Rate</div>
                                    <div className="text-xl font-black text-indigo-600">{winRate.toFixed(0)}%</div>
                                  </div>
                                  <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100/50">
                                    <div className="text-[9px] font-black text-emerald-600/70 uppercase tracking-widest mb-1.5 flex justify-between items-center">
                                      <span>Avg TP</span>
                                      <span className="px-1.5 py-0.5 rounded-full bg-emerald-100/50 text-[8px]">{tps.length} Wins</span>
                                    </div>
                                    <div className="text-lg font-black text-emerald-600">+{avgWin.toFixed(1)}R</div>
                                  </div>
                                  <div className="bg-rose-50/30 p-4 rounded-2xl border border-rose-100/50">
                                    <div className="text-[9px] font-black text-rose-600/70 uppercase tracking-widest mb-1.5 flex justify-between items-center">
                                      <span>Avg SL</span>
                                      <span className="px-1.5 py-0.5 rounded-full bg-rose-100/50 text-[8px]">{sls.length} Loss</span>
                                    </div>
                                    <div className="text-lg font-black text-rose-600">{avgLoss.toFixed(1)}R</div>
                                  </div>
                                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Avg Duration</div>
                                    <div className="text-xl font-black text-slate-900">
                                      {avgDuration > 60 ? `${(avgDuration / 60).toFixed(1)}h` : `${avgDuration.toFixed(0)}m`}
                                    </div>
                                  </div>
                                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Main TF</div>
                                    <div className="text-xl font-black text-slate-900">{mostUsedTF}</div>
                                  </div>
                                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Avg Pips</div>
                                    <div className="text-xl font-black text-indigo-600">{avgPips.toFixed(1)}</div>
                                  </div>
                                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Total Pips</div>
                                    <div className="text-xl font-black text-slate-900">{totalPips.toFixed(0)}</div>
                                  </div>
                                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Accuracy</div>
                                    <div className="text-xl font-black text-slate-900">{((avgWin / Math.abs(avgLoss || 1) || 0)).toFixed(2)}<span className="text-[10px] text-slate-400 ml-1">P/L</span></div>
                                  </div>
                                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Max Drawdown</div>
                                    <div className="text-xl font-black text-rose-600">-{maxDrawdown.toFixed(1)}<span className="text-[10px] ml-0.5">R</span></div>
                                  </div>
                                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Win Streak</div>
                                    <div className="text-xl font-black text-emerald-600">{maxWinStreak}</div>
                                  </div>
                                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Loss Streak</div>
                                    <div className="text-xl font-black text-rose-600">{maxLossStreak}</div>
                                  </div>

                                  <div className="col-span-2 mt-4">
                                    <TradingCalendar 
                                      trades={trades} 
                                      simulatedTime={simCurrentTime || (currentSessionKey && backtestSessions[currentSessionKey]?.currentTime) || (selectedSymbol && (backtestSessions[`${selectedSymbol}_${activePrefix}`]?.currentTime || backtestSessions[selectedSymbol || '']?.currentTime)) || undefined}
                                    />
                                  </div>

                                  <div className="col-span-2 mt-4">
                                    <button
                                      onClick={() => setShowAdvancedStats(!showAdvancedStats)}
                                      className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:bg-slate-50 transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                                          <TrendingUp className="w-4 h-4 text-indigo-600" />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Advanced Insights</span>
                                      </div>
                                      <div className={`transition-transform duration-300 ${showAdvancedStats ? 'rotate-180' : ''}`}>
                                        <ChevronDown className="w-4 h-4 text-slate-400" />
                                      </div>
                                    </button>

                                    {showAdvancedStats && (
                                      <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-4 space-y-4 overflow-hidden"
                                      >
                                        {/* Weekly Activity Module */}
                                        <div className="bg-slate-50/50 rounded-3xl p-5 border border-slate-100/50">
                                          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Weekly Activity</h3>
                                          <div className="space-y-3">
                                            {weeklyActivity.filter(d => d.day !== 'Sun' && d.day !== 'Sat').map((day) => (
                                              <div key={day.day} className="space-y-1.5">
                                                <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                                  <span className="text-slate-900">{day.day}</span>
                                                  <div className="flex gap-2">
                                                    <span className="text-emerald-500">{day.tp}W</span>
                                                    <span className="text-rose-500">{day.sl}L</span>
                                                    <span className="text-slate-400">{day.percent.toFixed(0)}%</span>
                                                  </div>
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-200/50 rounded-full overflow-hidden flex">
                                                  <div 
                                                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                                                    style={{ width: `${day.percent}%` }}
                                                  />
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>

                                        {/* Yearly Performance Module */}
                                        <div className="space-y-4">
                                          <div className="flex items-center justify-between px-1">
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Yearly performance</h3>
                                            <div className="text-[8px] font-black text-slate-400 uppercase">Monthly RR</div>
                                          </div>
                                          
                                          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x">
                                            {years.map(year => (
                                              <div key={year} className="min-w-[280px] bg-white border border-slate-100 rounded-3xl p-4 shadow-sm snap-center">
                                                <div className="flex justify-between items-center mb-4">
                                                  <span className="text-xs font-black text-slate-900">{year}</span>
                                                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                                    {yearlyPerformance[year].reduce((s, m) => s + m.rr, 0).toFixed(1)}R Total
                                                  </span>
                                                </div>
                                                <div className="grid grid-cols-4 gap-2">
                                                  {yearlyPerformance[year].map((monthData, idx) => {
                                                    const monthName = new Date(0, idx).toLocaleString('default', { month: 'short' });
                                                    return (
                                                      <div 
                                                        key={idx} 
                                                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                                                          monthData.trades > 0 
                                                            ? monthData.rr >= 0 
                                                              ? 'bg-emerald-50/50 border-emerald-100' 
                                                              : 'bg-rose-50/50 border-rose-100'
                                                            : 'bg-slate-50 border-transparent opacity-40'
                                                        }`}
                                                      >
                                                        <span className="text-[8px] font-black uppercase text-slate-400">{monthName}</span>
                                                        <span className={`text-[10px] font-black mt-0.5 ${
                                                          monthData.trades > 0 
                                                            ? monthData.rr >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                                            : 'text-slate-400'
                                                        }`}>
                                                          {monthData.trades > 0 ? `${monthData.rr > 0 ? '+' : ''}${monthData.rr.toFixed(1)}` : '---'}
                                                        </span>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            ))}
                                            {years.length === 0 && (
                                              <div className="w-full py-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No yearly data yet</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                          </motion.div>
                        ) : (
                          <motion.div 
                            key="trades"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex flex-col gap-2.5"
                          >
                            {(() => {
                              const trades = (filteredMergedTrades || [])
                                .filter(t => {
                                  const cat = (historyCategory || 'All').trim().toUpperCase();
                                  if (cat === 'ALL') return true;
                                  return (t.setupGrade || '').trim().toUpperCase() === cat;
                                })
                                .sort((a, b) => b.exitTime - a.exitTime);

                              if (trades.length === 0) return (
                                <div className="py-12 flex flex-col items-center justify-center text-center opacity-40">
                                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4"><TrendingUp size={20} /></div>
                                  <p className="text-[10px] font-black uppercase tracking-widest">No trade records</p>
                                </div>
                              );

                              return trades.map((trade, idx) => {
                                const tradeId = `${trade.symbol}_${trade.exitTime}_${idx}`;
                                const isCurrentMenuOpen = tradeMenuId === tradeId;

                                return (
                                  <div key={tradeId} className="group relative">
                                    <div
                                      onClick={() => setTradeMenuId(isCurrentMenuOpen ? null : tradeId)}
                                      className={`w-full p-4 rounded-2xl border border-l-4 transition-all flex items-center justify-between cursor-pointer ${
                                        trade.status === 'TP' 
                                          ? 'bg-emerald-50/20 border-slate-100 hover:border-emerald-200 border-l-emerald-500' 
                                          : 'bg-rose-50/20 border-slate-100 hover:border-rose-200 border-l-rose-500'
                                      }`}
                                    >
                                      <div className="flex flex-col gap-1.5 overflow-hidden">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[9px] font-black uppercase text-slate-400">
                                            {new Date(trade.exitTime * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                          </span>
                                          {trade.setupGrade && (
                                            <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[7px] font-black uppercase">{trade.setupGrade}</span>
                                          )}
                                        </div>
                                        <div className="flex items-baseline gap-1.5">
                                          <span className={`text-base font-black tracking-tight ${trade.status === 'TP' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {trade.rr > 0 ? '+' : ''}{trade.rr.toFixed(2)}<span className="text-[10px] font-black ml-0.5">R</span>
                                          </span>
                                          <span className="text-[10px] font-bold text-slate-400">@{trade.exitPrice.toFixed(5)}</span>
                                        </div>
                                      </div>
                                      <div className="text-right flex flex-col gap-1">
                                        <div className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{trade.timeframe}</div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase">{trade.pips.toFixed(1)} Pips</div>
                                      </div>

                                      {/* Context Menu Overlay */}
                                      <AnimatePresence>
                                        {isCurrentMenuOpen && (
                                          <motion.div 
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            className="absolute inset-0 z-10 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl flex items-center justify-around px-4"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <button 
                                              onClick={() => { setViewingTradeDetails(trade); setTradeMenuId(null); }}
                                              className="flex flex-col items-center gap-1.5 group/act"
                                            >
                                              <div className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center transition-all group-hover/act:bg-indigo-600 group-hover/act:text-white shadow-sm ring-1 ring-slate-100">
                                                <Eye size={16} />
                                              </div>
                                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest group-hover/act:text-indigo-600">Inspect</span>
                                            </button>
                                            <button 
                                              onClick={() => {
                                                const pairKey = trade.watchlistId || activeWatchlistItemId || (trade.prefix ? `${trade.symbol}_${trade.prefix}` : trade.symbol);
                                                const usage = pairUsageLimits[pairKey] || { replays: 0, syncedCharts: 0, trades: 0 };
                                                
                                                if (subscriptionPlan === 'basic') {
                                                  if (usage.replays >= 2) {
                                                    setAdsLimitModalFeature('replay');
                                                    setIsAdsLimitModalOpen(true);
                                                    setTradeMenuId(null);
                                                    return;
                                                  } else {
                                                    updatePairLimit(pairKey, { replays: usage.replays + 1 });
                                                  }
                                                }
                                                setPreReplayDrawings([...drawings]);
                                                setReplayTrade(trade);
                                                setReplayCurrentTime(trade.entryTime);
                                                setIsReplayMode(true);
                                                setReplayIsPlaying(false);
                                                setSelectedSymbol(trade.symbol);
                                                const tf = TIMEFRAMES.find(t => t.id.toLowerCase() === trade.timeframe.toLowerCase() || t.label.toLowerCase() === trade.timeframe.toLowerCase());
                                                if (tf) setSelectedTimeframe(tf);
                                                addNotification(`Replaying ${trade.symbol} trade...`, 'success');
                                                setTradeMenuId(null);
                                                setIsMenuOpen(false);
                                              }}
                                              className="flex flex-col items-center gap-1.5 group/act"
                                            >
                                              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center transition-all group-hover/act:bg-black shadow-lg">
                                                <Play size={16} fill="currentColor" />
                                              </div>
                                              <span className="text-[8px] font-black text-slate-900 uppercase tracking-widest">Execute</span>
                                            </button>
                                            <button 
                                              onClick={() => setTradeMenuId(null)}
                                              className="absolute top-2 right-2 p-1 text-slate-300 hover:text-slate-500 transition-colors"
                                            >
                                              <X size={12} />
                                            </button>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                    <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300 mb-6 group-hover:scale-110 transition-transform">
                      <BarChart2 size={32} strokeWidth={1} />
                    </div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">No Asset Active</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 max-w-[120px]">Select a pair from the watchlist to see analytics</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <IndicatorsModal 
        isOpen={isIndicatorsOpen}
        onClose={() => setIsIndicatorsOpen(false)}
        activeIndicators={indicators}
        onAddIndicator={handleAddIndicator}
        onRemoveIndicator={handleRemoveIndicator}
        onSettings={(ind) => {
          setIsIndicatorsOpen(false);
          setSettingIndicator(ind);
        }}
        subscriptionPlan={subscriptionPlan}
        onLockedFeature={(feat) => {
          setUpgradeModalFeature(feat);
          setIsUpgradeModalOpen(true);
        }}
      />

      <SetupModal 
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        pinnedText={pinnedText}
        onPinChange={setPinnedText}
        userId={session?.user?.id}
        onSave={fetchUserSetups}
      />

      <AnimatePresence>
        {showSyncInfoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSyncInfoModal(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 cursor-default"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.4 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl border border-slate-100 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)] w-full max-w-lg overflow-hidden flex flex-col relative"
            >
              {/* Header */}
              <div className="border-b border-slate-50 px-6 py-5 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Clock size={16} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight">Time Sync Feature</h3>
                    <p className="text-[10px] text-slate-400 font-bold">Real-time Backtesting Engine</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSyncInfoModal(false)}
                  className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-900 flex items-center justify-center transition-all"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 flex flex-col gap-5 text-left text-xs text-slate-600 leading-relaxed max-h-[70vh] overflow-y-auto">
                <p className="font-medium text-slate-500">
                  The **Time Sync** feature synchronizes the backtest playback head with your actual, real-world clock, allowing you to train with realistic live-market pacing.
                </p>

                <div className="grid gap-4">
                  <div className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black">
                      1
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-[11px] mb-0.5">Real-time Progression</h4>
                      <p className="text-[10px] text-slate-500">
                        Instead of simulating/rendering candles instantly at high speed multipliers, candles populate gradually as real-world seconds click by, replicating real live-market play.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black">
                      2
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-[11px] mb-0.5">Adjustable Scaled Sync Rates</h4>
                      <p className="text-[10px] text-slate-500 mb-2">
                        Adjust how fast a full 1-minute base candle forms. The engine dynamically scales any selected timeframe proportionately so that the market develops with cohesive relativity.
                      </p>
                      <div className="bg-indigo-50/40 rounded-xl p-2.5 border border-indigo-100/50 flex flex-col gap-1 font-mono text-[9px] text-indigo-950 font-bold">
                        <span className="font-black text-[10px] text-indigo-800 font-sans mb-0.5">Timeframe Scaling Equation:</span>
                        <div className="bg-white/80 rounded border border-indigo-100 p-1 mb-1 font-sans text-[9px] text-indigo-900 leading-tight">
                          <strong>Seconds per Candle</strong> = (1m Base Rate) × (Timeframe minutes)
                        </div>
                        <span>At a rate of **1m candle = 2.5 seconds**:</span>
                        <span>• 1-minute (1m) candle = 2.5 seconds <span className="text-slate-400 font-sans font-medium">(2.5s × 1)</span></span>
                        <span>• 5-minute (5m) candle = 12.5 seconds <span className="text-slate-400 font-sans font-medium">(2.5s × 5)</span></span>
                        <span>• 1-hour (1H) candle = 150 seconds <span className="text-slate-400 font-sans font-medium">(2.5s × 60)</span></span>
                        <span>• 1-day (1D) candle = 3,600 seconds <span className="text-slate-400 font-sans font-medium">(2.5s × 1440)</span></span>
                        <span className="text-[8px] text-indigo-600/80 font-sans mt-0.5">* This scale works dynamically for 15m, 4H, and all custom charts!</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black">
                      3
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-[11px] mb-0.5">Offline, Revisit & Focus Catch-up</h4>
                      <p className="text-[10px] text-slate-500">
                        If you minimize the browser, switch tabs, close the application or go offline, the backtester securely remembers your precise play state. Upon returning, the engine instantly computes the real-world duration you were gone, fast-forwards the playhead mathematically to where it should be, and keeps playing automatically!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100/50 mt-1 flex items-start gap-2.5">
                  <Zap size={15} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-500 font-medium leading-normal">
                    <span className="text-slate-700 font-bold">Quick tip:</span> When Time Sync is active, standard fast-forward speed multipliers (like 2x or 3x) are ignored. Turn Time Sync off if you want to advance bars manually or instantly.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-50 px-6 py-4 flex justify-end bg-slate-50/20">
                <button
                  onClick={() => setShowSyncInfoModal(false)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md active:scale-95"
                >
                  Got it, thanks!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SyncedSelectorModal 
        isOpen={isSyncedSelectorOpen}
        onClose={() => setIsSyncedSelectorOpen(false)}
        currentSymbol={selectedSymbol || ''}
        onSelect={(symbol, source, marketType) => {
          setSyncedSymbol(symbol);
          setSyncedDataSource(source);
          setSyncedMarketType(marketType);
          addNotification(`Comparing side-by-side with synced: ${symbol}`, 'success');
        }}
      />

      <TriggerSetupModal 
        drawing={triggerSetupDrawing}
        setups={setups}
        onSelect={(grade, notes) => {
          if (!triggerSetupDrawing) return;
          
          const selectedSetup = setups.find(s => s.grade === grade);
          const updatedDrawing = {
            ...triggerSetupDrawing,
            settings: {
              ...triggerSetupDrawing.settings,
              setupGrade: grade,
              confluences: selectedSetup?.confluences || [],
              notes: notes
            }
          };

          // 1. Update Engine IMMEDIATELY to avoid race conditions with fast closures
          if (chartEngineRef.current) {
            chartEngineRef.current.updateDrawing(updatedDrawing);
          }

          // 2. Update React State
          setDrawings(prev => prev.map(d => d.id === triggerSetupDrawing.id ? updatedDrawing : d));

          setTriggerSetupDrawing(null);
          
          if (isSimulating) setSimIsPlaying(true);
          if (isReplayMode) setReplayIsPlaying(true);
        }}
      />
      {/* Forex Factory-style News Modal popup is now handled inline inside ChartComponent */}

      <AnimatePresence>
        {settingIndicator && (
          <IndicatorSettings 
            indicator={settingIndicator}
            onClose={() => setSettingIndicator(null)}
            onSave={handleUpdateIndicator}
          />
        )}
      </AnimatePresence>

      {/* PWA Install Prompt */}
      <InstallPrompt />

      {/* Settings Modal (Appearance) */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="fixed inset-0 bg-black/5 backdrop-blur-[2px] z-[70]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-80 bg-white shadow-[-20px_0_50px_rgba(0,0,0,0.05)] z-[80] border-l border-slate-100 flex flex-col"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white">
                    <Settings size={16} />
                  </div>
                  <div>
                    <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 leading-tight">Configuration</h2>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Appearance Engine</p>
                  </div>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 p-6 space-y-10 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-200">
                {/* Canvas Section */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3 bg-slate-900 rounded-full" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Environment</h3>
                  </div>
                  <div className="grid gap-3">
                    <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-slate-200 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-800 uppercase">Static Grid</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">Architectural guidelines</span>
                      </div>
                      <button 
                        onClick={() => {
                          const newTheme = {...theme, showGrid: !theme.showGrid};
                          setTheme(newTheme);
                          if (session?.user) {
                            persistenceService.savePreferences(session.user.id, { theme: newTheme });
                          }
                        }}
                        className={`w-9 h-5 rounded-full transition-all relative ${theme.showGrid ? 'bg-slate-900' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${theme.showGrid ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-slate-200 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-800 uppercase">Canvas Watermark</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">Show pair & source in background</span>
                      </div>
                      <button 
                        onClick={() => {
                          const newTheme = {...theme, showWatermark: theme.showWatermark === false ? true : false};
                          setTheme(newTheme);
                          if (session?.user) {
                            persistenceService.savePreferences(session.user.id, { theme: newTheme });
                          }
                        }}
                        className={`w-9 h-5 rounded-full transition-all relative ${theme.showWatermark !== false ? 'bg-slate-900' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${theme.showWatermark !== false ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-slate-200 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-800 uppercase">Live Candle Ticking</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">Animate live ticking on last candle</span>
                      </div>
                      <button 
                        onClick={() => {
                          const newTheme = {...theme, tickingEnabled: theme.tickingEnabled === false ? true : false};
                          setTheme(newTheme);
                          if (session?.user) {
                            persistenceService.savePreferences(session.user.id, { theme: newTheme });
                          }
                        }}
                        className={`w-9 h-5 rounded-full transition-all relative ${theme.tickingEnabled !== false ? 'bg-slate-900' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${theme.tickingEnabled !== false ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-slate-200 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-800 uppercase">Historical News Stream</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">Stream historic high-impact news onto chart</span>
                      </div>
                      <button 
                        onClick={() => setIsNewsStreamEnabled(!isNewsStreamEnabled)}
                        className={`w-9 h-5 rounded-full transition-all relative ${isNewsStreamEnabled ? 'bg-slate-900' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${isNewsStreamEnabled ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-slate-200 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-800 uppercase">Commission Engine</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">Calculate 0.05 fee per R:R win or loss</span>
                      </div>
                      <button 
                        onClick={() => {
                          const newTheme = {...theme, commissionEnabled: theme.commissionEnabled === false ? true : false};
                          setTheme(newTheme);
                          if (session?.user) {
                            persistenceService.savePreferences(session.user.id, { theme: newTheme });
                          }
                        }}
                        className={`w-9 h-5 rounded-full transition-all relative ${theme.commissionEnabled !== false ? 'bg-slate-900' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${theme.commissionEnabled !== false ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-between opacity-90">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-800 uppercase">Favorites Bar</span>
                          <span className="text-[7.5px] bg-slate-200 text-slate-700 px-1 py-0.5 rounded font-black uppercase tracking-wider">LOCKED ON</span>
                        </div>
                        <span className="text-[9px] text-slate-400 mt-0.5">Always active for rapid strategy & backtesting flow</span>
                      </div>
                      <div className="w-9 h-5 rounded-full bg-slate-900 relative">
                        <div className="absolute top-1 w-3 h-3 bg-white rounded-full left-5 shadow-sm" />
                      </div>
                    </div>
                    
                    <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-slate-200 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-800 uppercase">Drawing Sidebar</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">Toggle tool availability</span>
                      </div>
                      <button 
                        onClick={() => setShowDrawingToolbar(!showDrawingToolbar)}
                        className={`w-9 h-5 rounded-full transition-all relative ${showDrawingToolbar ? 'bg-slate-900' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${showDrawingToolbar ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>
                    
                    <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-3 group hover:border-slate-200 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-800 uppercase">Backdrop</span>
                        <span className="text-[9px] font-mono text-slate-400 uppercase">{theme.bg}</span>
                      </div>
                      <ColorPicker 
                        color={theme.bg} 
                        onChange={(c) => {
                          const newTheme = {...theme, bg: c};
                          setTheme(newTheme);
                        }} 
                      />
                    </div>

                    <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-3 group hover:border-slate-200 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-800 uppercase">Timezone</span>
                        <span className="text-[9px] font-mono text-slate-400 uppercase">{theme.timezone || 'UTC'}</span>
                      </div>
                      <select 
                        value={theme.timezone || 'UTC'}
                        onChange={(e) => {
                          const newTheme = {...theme, timezone: e.target.value};
                          setTheme(newTheme);
                        }}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-[10px] font-bold uppercase tracking-widest text-slate-700 outline-none focus:border-slate-400 transition-all cursor-pointer appearance-none"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                          backgroundPosition: 'right 12px center',
                          backgroundRepeat: 'no-repeat',
                        }}
                      >
                        {TIMEZONES.map(tz => (
                          <option key={tz.id} value={tz.id}>{tz.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                {/* Candles Section */}
                <section className="space-y-8">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3 bg-slate-900 rounded-full" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Candle Metrics</h3>
                  </div>

                  {/* Bullish */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                      <div className="w-1.5 h-3 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Ascending</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-2 hover:bg-white transition-colors">
                        <label className="text-[9px] text-slate-400 font-bold uppercase block px-1">Core</label>
                        <ColorPicker color={theme.upColor} onChange={(c) => {
                          const newTheme = {...theme, upColor: c};
                          setTheme(newTheme);
                        }} />
                      </div>
                      <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-2 hover:bg-white transition-colors">
                        <label className="text-[9px] text-slate-400 font-bold uppercase block px-1">Edge</label>
                        <ColorPicker color={theme.upBorder} onChange={(c) => {
                          const newTheme = {...theme, upBorder: c};
                          setTheme(newTheme);
                        }} />
                      </div>
                      <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-2 hover:bg-white transition-colors">
                        <label className="text-[9px] text-slate-400 font-bold uppercase block px-1">Wick</label>
                        <ColorPicker color={theme.upWick} onChange={(c) => {
                          const newTheme = {...theme, upWick: c};
                          setTheme(newTheme);
                        }} />
                      </div>
                    </div>
                  </div>

                  {/* Bearish */}
                  <div className="space-y-4 pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2 px-1">
                      <div className="w-1.5 h-3 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.3)]" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-red-600">Descending</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-2 hover:bg-white transition-colors">
                        <label className="text-[9px] text-slate-400 font-bold uppercase block px-1">Core</label>
                        <ColorPicker color={theme.downColor} onChange={(c) => {
                          const newTheme = {...theme, downColor: c};
                          setTheme(newTheme);
                        }} />
                      </div>
                      <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-2 hover:bg-white transition-colors">
                        <label className="text-[9px] text-slate-400 font-bold uppercase block px-1">Edge</label>
                        <ColorPicker color={theme.downBorder} onChange={(c) => {
                          const newTheme = {...theme, downBorder: c};
                          setTheme(newTheme);
                        }} />
                      </div>
                      <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-2 hover:bg-white transition-colors">
                        <label className="text-[9px] text-slate-400 font-bold uppercase block px-1">Wick</label>
                        <ColorPicker color={theme.downWick} onChange={(c) => {
                          const newTheme = {...theme, downWick: c};
                          setTheme(newTheme);
                        }} />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Pricing & Spread Section */}
                <section className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3 bg-slate-900 rounded-full" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Pricing & Spread</h3>
                  </div>

                  <div className="grid gap-3">
                    {/* Raw Spread Toggle Button */}
                    <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-slate-200 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-800 uppercase">Raw Spread (0 Spread)</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">Toggle live broker simulated spreads</span>
                      </div>
                      <button 
                        onClick={() => {
                          if (subscriptionPlan === 'basic') {
                            setUpgradeModalFeature('spread');
                            setIsUpgradeModalOpen(true);
                            return;
                          }
                          const newTheme = {...theme, rawSpread: !theme.rawSpread};
                          setTheme(newTheme);
                          if (session.user) persistenceService.savePreferences(session.user.id, { theme: newTheme });
                        }}
                        className={`w-9 h-5 rounded-full transition-all relative ${activeTheme.rawSpread ? 'bg-slate-900' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${activeTheme.rawSpread ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>

                    {/* Color controls */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-2 hover:bg-white transition-colors">
                        <label className="text-[9px] text-slate-400 font-bold uppercase block px-1">Bid Color</label>
                        <ColorPicker color={theme.bidColor || '#2962ff'} onChange={(c) => {
                          const newTheme = {...theme, bidColor: c};
                          setTheme(newTheme);
                          if (session.user) persistenceService.savePreferences(session.user.id, { theme: newTheme });
                        }} />
                      </div>
                      <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-2 hover:bg-white transition-colors">
                        <label className="text-[9px] text-slate-400 font-bold uppercase block px-1">Ask Color</label>
                        <ColorPicker color={theme.askColor || '#f23645'} onChange={(c) => {
                          const newTheme = {...theme, askColor: c};
                          setTheme(newTheme);
                          if (session.user) persistenceService.savePreferences(session.user.id, { theme: newTheme });
                        }} />
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-3">
                <button 
                  onClick={resetFloatPositions}
                  className="w-full py-4 bg-white border border-slate-200 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-sm hover:border-slate-300 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <RefreshCcw size={14} className="text-blue-500" />
                  Reset Float Positions
                </button>
                <button 
                  onClick={() => {
                    const defaultTheme = {
                      bg: '#ffffff',
                      text: '#0f172a',
                      grid: '#f1f5f9',
                      upColor: '#10b981',
                      downColor: '#ef4444',
                      upBorder: '#059669',
                      downBorder: '#dc2626',
                      upWick: '#059669',
                      downWick: '#dc2626',
                      showGrid: true,
                      bidColor: '#2962ff',
                      askColor: '#f23645',
                      rawSpread: false,
                      tickingEnabled: true,
                      showWatermark: true
                    };
                    setTheme(defaultTheme);
                    if (session.user) persistenceService.savePreferences(session.user.id, { theme: defaultTheme });
                  }}
                  className="w-full py-4 bg-white border border-slate-200 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-sm hover:border-slate-300 transition-all active:scale-95"
                >
                  Factory Reset
                </button>
              </div>
            </motion.div>
          </>
        )}
        {/* Viewing Trade Details Modal moved to root level overlay */}
      </AnimatePresence>
    </>
  )}
      
      {/* Viewing Trade Details Modal (Root Level Overlay) */}
      <AnimatePresence>
        {viewingTradeDetails && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingTradeDetails(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm z-[1000]"
            >
              <TradeDetailsCard trade={viewingTradeDetails} onClose={() => setViewingTradeDetails(null)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upgrade Subscription Modal */}
      <AnimatePresence>
        {isUpgradeModalOpen && (
          <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsUpgradeModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-50 flex flex-col p-6 space-y-4"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-650 flex items-center justify-center border border-indigo-100/50">
                  <Sparkles size={18} className="text-indigo-600 fill-current" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 leading-none">Premium Core Unlocked</h3>
                  <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 block">Feature restriction upgrade proposal</span>
                </div>
              </div>

              <div className="space-y-2.5 py-1 text-left">
                {upgradeModalFeature === 'replay' && (
                  <>
                    <h4 className="text-[11px] font-black uppercase tracking-wide text-slate-905">Trade Replay playback is Locked</h4>
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                      Replaying historic trades lets you scrub back and forward on actual custom backtest sessions. Unlock Replays instantly by updating your tier to **Plus** or **Premium**!
                    </p>
                  </>
                )}
                {upgradeModalFeature === 'sync' && (
                  <>
                    <h4 className="text-[11px] font-black uppercase tracking-wide text-slate-905">Side-by-side Chart synchronisation is Locked</h4>
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                      Synced charts let you overlay multiple broker feeds and compare different timeframe behaviors simultaneously in real-time. Upgrade your tier to activate synced charting!
                    </p>
                  </>
                )}
                {upgradeModalFeature === 'competition' && (
                  <>
                    <h4 className="text-[11px] font-black uppercase tracking-wide text-slate-905">Simulated Trading Competitions are Locked</h4>
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                      Enter multi-user simulated challenges, claim active strategy slots, submit virtual placements, and scale up international leaderboards. Upgrade to Plus or Premium to unlock!
                    </p>
                  </>
                )}
                {upgradeModalFeature === 'timesync' && (
                  <>
                    <h4 className="text-[11px] font-black uppercase tracking-wide text-slate-905">Time Sync Playing is Locked</h4>
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                      Time Sync Playing synchronises playback timing to run in actual lockstep with real-life time. Upgrade your plan to Plus or Premium to unlock real-time synchronized playback!
                    </p>
                  </>
                )}
                {upgradeModalFeature === 'script' && (
                  <>
                    <h4 className="text-[11px] font-black uppercase tracking-wide text-slate-905">LiteScript Custom Indicators are Locked</h4>
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                      Creating, editing, or testing custom indicator algorithms using LiteScript requires a premium plan. Plus or Premium tier lets you compose indicators instantly!
                    </p>
                  </>
                )}
                {upgradeModalFeature === 'watchlist' && (
                  <>
                    <h4 className="text-[11px] font-black uppercase tracking-wide text-slate-905">Watchlist Limit Reached (Max 3 Active)</h4>
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                      Managing more than 3 active ongoing market assets on your watchlist is locked for Basic users. All users can have an infinite number of completed assets! Upgrade to Plus or Premium to track unlimited ongoing pairs simultaneously.
                    </p>
                  </>
                )}
                {upgradeModalFeature === 'news' && (
                  <>
                    <h4 className="text-[11px] font-black uppercase tracking-wide text-slate-905">Historical News Stream is Locked</h4>
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                      High-impact historical news streaming directly onto your simulator timeline is locked for Basic users. Upgrade to Plus or Premium to analyze news sentiment reactions!
                    </p>
                  </>
                )}
                {upgradeModalFeature === 'spread' && (
                  <>
                    <h4 className="text-[11px] font-black uppercase tracking-wide text-slate-905">Raw Spread is Locked</h4>
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                      Upgrade to Plus or Premium plan to enable raw spread.
                    </p>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => {
                    setIsUpgradeModalOpen(false);
                    // Force out of the chart and set back target to watchlist
                    setSavedSymbolBeforeSubscription(null);
                    setSubscriptionBackTarget('watchlist');
                    setSelectedSymbol(null);
                    // go to subscription instantly
                    setActiveTab('subscription');
                  }}
                  className="w-full bg-slate-950 text-white rounded-xl py-3 text-[9px] font-black uppercase tracking-widest hover:bg-slate-850 cursor-pointer shadow-md transition-all text-center active:scale-95"
                >
                  Get Premium
                </button>
                <button
                  onClick={() => setIsUpgradeModalOpen(false)}
                  className="w-full bg-slate-50 rounded-xl py-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider hover:bg-slate-100 cursor-pointer text-center"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Basic Ads Quota Reset Modal */}
      <AnimatePresence>
        {isAdsLimitModalOpen && (
          <div className="fixed inset-0 z-[1002] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdsLimitModalOpen(false)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-[1003] flex flex-col p-6 space-y-4"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-650 flex items-center justify-center border border-amber-100/50 animate-bounce">
                  <AlertTriangle size={18} className="text-amber-500 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 leading-none">Basic Quota Limit Reached</h3>
                  <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 block">Watchlist Asset Pair Playback Quotas</span>
                </div>
              </div>

              <div className="space-y-3 py-1 text-left">
                {adsLimitFeature === 'replay' && (
                  <>
                    <h4 className="text-[11px] font-black uppercase tracking-wide text-slate-900">Replay Quota Exhausted (2/2)</h4>
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                      You have used up your draft limit of <strong className="text-slate-950 font-black">2 replays</strong> for this watchlist pair.
                    </p>
                  </>
                )}
                {adsLimitFeature === 'sync' && (
                  <>
                    <h4 className="text-[11px] font-black uppercase tracking-wide text-slate-900">Synced Chart Quota Exhausted (1/1)</h4>
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                      You have used your <strong className="text-slate-950 font-black">1 free synced chart</strong> for this watchlist pair.
                    </p>
                  </>
                )}
                {adsLimitFeature === 'trades' && (
                  <>
                    <h4 className="text-[11px] font-black uppercase tracking-wide text-slate-905">Trade Limit Reached (3/3)</h4>
                    <p className="text-[11px] text-rose-500 font-semibold leading-relaxed">
                      You have reached the limit of <strong className="font-extrabold">3 trades</strong> for this watchlist pair. Your 3rd trade has been instantly auto-closed.
                    </p>
                  </>
                )}

                <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-2xl text-[10.5px] font-semibold text-slate-600 leading-normal">
                  💡 Reset all limits (<strong className="text-slate-950 font-extrabold">2 Replays, 1 Synced Chart, 3 Trades</strong>) for this pair instantly by watching a quick 10-second video ad.
                </div>

                {/* Sponsor Control Ad block inside popup */}
                <div className="border border-indigo-100/60 rounded-xl bg-indigo-50/20 p-2.5 text-center relative overflow-hidden flex flex-col justify-center items-center min-h-[50px]">
                  {adsenseClient && adsenseSlot ? (
                    <GoogleAdSenseUnit client={adsenseClient} slot={adsenseSlot} />
                  ) : (
                    <>
                      <span className="absolute right-2.5 top-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-[5px] font-black uppercase text-amber-600 tracking-wider">
                        Sponsor Ad Unit
                      </span>
                      <div className="text-[10px] text-slate-400 font-mono italic flex items-center gap-1.5 py-1">
                        <Sparkles size={11} className="text-amber-500 fill-amber-500 animate-pulse" />
                        <span>Interactive Grid Ads loaded dynamically</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={() => {
                    setIsAdsLimitModalOpen(false);
                    setVideoAdTimer(10);
                    setIsVideoAdPlaying(true);
                  }}
                  className="w-full bg-indigo-600 text-white rounded-xl py-3.5 text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 cursor-pointer shadow-md transition-all text-center active:scale-95 flex items-center justify-center gap-2"
                >
                  <Video size={13} strokeWidth={2.5} />
                  <span>Watch Video Ad & Reset (10s)</span>
                </button>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setIsAdsLimitModalOpen(false);
                      // Force out of the chart and set back target to watchlist
                      setSavedSymbolBeforeSubscription(null);
                      setSubscriptionBackTarget('watchlist');
                      setSelectedSymbol(null);
                      // go to subscription instantly
                      setActiveTab('subscription');
                    }}
                    className="w-full bg-slate-950 text-white rounded-xl py-2.5 text-[8.5px] font-black uppercase tracking-wider hover:bg-slate-850 cursor-pointer shadow-sm transition-all text-center active:scale-95"
                  >
                    Go Premium (No Ads)
                  </button>
                  <button
                    onClick={() => setIsAdsLimitModalOpen(false)}
                    className="w-full bg-slate-50 rounded-xl py-2.5 text-[8.5px] font-bold text-slate-500 uppercase tracking-wide hover:bg-slate-100 cursor-pointer text-center"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full-Screen Video Ad Simulation Player Overlay */}
      <AnimatePresence>
        {isVideoAdPlaying && (
          <div className="fixed inset-0 z-[10001] bg-slate-950 flex flex-col justify-between overflow-hidden text-slate-100 p-0 select-none">
            {/* Top Bar for Ad */}
            <div className="bg-slate-900/90 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-slate-800 relative z-30">
              <div className="flex items-center gap-3">
                <span className="bg-amber-400 text-slate-950 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded leading-none">SPONSORED REWARD VIDEO</span>
                <span className="text-[10px] font-black tracking-widest text-slate-350 uppercase">FirstLook Premium Partner Network</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono font-bold bg-slate-950 px-3 py-1 rounded-full text-amber-400 border border-amber-400/20">
                <Clock size={11} className="text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
                <span>Auto-closing in {videoAdTimer}s</span>
              </div>
            </div>

            {/* Immersive Candlestick Chart Simulation Area */}
            <div className="flex-1 w-full bg-slate-950 relative flex flex-col justify-center items-center overflow-hidden p-6 z-10 select-none">
              {/* Background Glow effects */}
              <div className="absolute top-1/4 left-1/3 w-[80vh] h-[80vh] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
              <div className="absolute bottom-1/4 right-1/3 w-[80vh] h-[80vh] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

              {/* Real-time moving candlesticks full-bleed display */}
              <div className="w-full max-w-5xl h-64 flex items-end justify-center gap-3 relative select-none">
                {Array.from({ length: 42 }).map((_, idx) => {
                  // Generate complex candle heights to look incredibly genuine and professional
                  const seed = (idx + videoAdTimer) * 1.35;
                  const isGreen = Math.sin(seed) > -0.2;
                  const bodyHeight = 25 + Math.abs(Math.sin(seed * 0.7) * 45); 
                  const wickTop = bodyHeight + 10 + Math.abs(Math.cos(seed) * 15);
                  const wickBottom = Math.max(5, bodyHeight - 15 - Math.abs(Math.sin(seed) * 12));

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center relative h-full justify-end">
                      {/* High-Low Wick line */}
                      <div 
                        className={`absolute w-[1.5px] rounded-full transition-all duration-350 ${isGreen ? 'bg-emerald-500/40' : 'bg-red-500/40'}`}
                        style={{
                          height: `${wickTop}%`,
                          bottom: `${wickBottom}%`
                        }}
                      />
                      {/* Body */}
                      <motion.div 
                        layout
                        className={`w-full rounded-sm transition-all duration-300 relative border ${
                          isGreen 
                            ? 'bg-emerald-500/20 border-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.15)]' 
                            : 'bg-red-500/20 border-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                        }`}
                        style={{ 
                          height: `${bodyHeight}%`,
                          bottom: `${Math.min(wickBottom + 5, 80)}%`
                        }}
                      >
                        {/* Dynamic glow effect index */}
                        {idx === 41 && (
                          <span className={`absolute -right-2 text-[6px] font-mono leading-none font-bold px-1 py-0.5 rounded ${isGreen ? 'bg-emerald-500 text-slate-950 animate-pulse' : 'bg-red-500 text-white animate-pulse'}`}>
                            LIVE
                          </span>
                        )}
                      </motion.div>
                    </div>
                  );
                })}

                {/* Target Level gridlines overlay */}
                <div className="absolute left-0 right-0 top-1/4 border-t border-dashed border-indigo-500/10 flex items-center justify-between pointer-events-none">
                  <span className="text-[6px] text-indigo-500/50 font-mono tracking-widest uppercase pl-4">REWARD MULTIPLIER REGISTRY</span>
                  <span className="text-[6px] text-indigo-500/50 font-mono tracking-widest uppercase pr-4">INDEX @1.05423</span>
                </div>
                <div className="absolute left-0 right-0 top-3/4 border-t border-dashed border-emerald-500/10 flex items-center justify-between pointer-events-none">
                  <span className="text-[6px] text-emerald-500/50 font-mono tracking-widest uppercase pl-4">DAILY QUOTA CALIBRATION</span>
                  <span className="text-[6px] text-emerald-550/50 font-mono tracking-widest uppercase pr-4">INDEX @0.99842</span>
                </div>
                <div className="absolute left-0 right-0 top-1/2 border-t border-indigo-500/20 flex items-center justify-between pointer-events-none">
                  <span className="text-[7px] text-indigo-400 font-mono tracking-wider font-semibold pl-4">AD CAMPAIGN VERIFYING ACTIVE TIMELINE</span>
                  <span className="text-[7px] text-amber-500 font-mono tracking-wider font-black pr-4 uppercase flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    AUTOCLOSING REWARD RUN
                  </span>
                </div>
              </div>

              {/* Subliminal Elegant Sponsor Content inside screen */}
              <div className="mt-6 flex flex-col items-center max-w-lg w-full text-center space-y-3 px-6">
                <span className="text-[9px] font-black tracking-widest text-indigo-400 uppercase">FirstLook Analytics Pro Suite</span>
                <p className="text-[11px] text-slate-400 font-bold leading-normal">
                  Professional-grade multi-timeframe sandboxing, unlimited fast historical playbacks, and real-time raw feed comparisons.
                </p>
                
                {adsenseClient && adsenseSlot ? (
                  <div className="w-full bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-1.5 text-slate-300">
                    <GoogleAdSenseUnit client={adsenseClient} slot={adsenseSlot} />
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 justify-center text-[8.5px] bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl text-slate-500 font-semibold font-mono">
                    <Sparkles size={11} className="text-amber-500 animate-pulse" />
                    <span>Get immediate ad-free bypass on premium levels starting at $9/mo</span>
                  </div>
                )}
              </div>
            </div>

            {/* Muted and footer timeline bottom block */}
            <div className="bg-slate-900 px-6 py-5 border-t border-slate-800 flex items-center justify-between relative z-20">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setVideoAdMuted(!videoAdMuted);
                }}
                className="w-10 h-10 rounded-2xl bg-slate-950 hover:bg-slate-850 text-white flex items-center justify-center border border-slate-800 active:scale-95 transition-all shadow-md cursor-pointer"
              >
                {videoAdMuted ? <VolumeX size={15} /> : <Volume2 size={15} className="animate-pulse" />}
              </button>

              <div className="flex items-center gap-2">
                <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide">Sponsored Interactive Reward Ad Session</span>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>
            </div>

            {/* Progress Timeline bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-900 z-30">
              <motion.div 
                initial={{ width: "0%" }}
                animate={{ width: `${((10 - videoAdTimer) / 10) * 100}%` }}
                transition={{ ease: "linear" }}
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500"
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* 🏆 Simulated Trading Competitions Coming Soon Modal */}
      <AnimatePresence>
        {isCompetitionsPopupOpen && (() => {
          const subscribersCount = 1400 + Math.floor(premiumPlusCount / 4);
          const subscribersPercentage = Math.min(100, (subscribersCount / 2000) * 100);

          const totalCapacity = 10024;
          const actualParticipantsCount = competitionsCount;
          const mockParticipantsCount = Math.max(0, totalCapacity - actualParticipantsCount);
          const totalParticipantsDisplay = totalCapacity;

          // Combine the candidates retrieved from database
          const displayCandidates = [...competitionCandidates];

          // Ensure the current user is at the top of listing if applied
          if (hasAppliedForCompetition) {
            const userIdKey = session?.user?.id || 'current_user_id';
            const alreadyInList = displayCandidates.some(c => c.id === userIdKey);
            if (!alreadyInList) {
              displayCandidates.unshift({
                id: userIdKey,
                username: session?.user?.username || session?.user?.full_name || 'You',
                plan: subscriptionPlan || 'basic',
                country: session?.user?.country || '🇺🇸'
              });
            }
          }

          const mockSeeds = [
            { id: 'mock1', username: 'Alex M.', plan: 'premium', country: '🇺🇸' },
            { id: 'mock2', username: 'Elena K.', plan: 'plus', country: '🇩🇪' },
            { id: 'mock3', username: 'Kenji S.', plan: 'plus', country: '🇯🇵' }
          ];

          const isHighTraffic = premiumPlusCount >= 10;
          
          // Map actual database premium/plus users
          const dbRealUsers = premiumPlusUsers.map(u => ({
            id: u.id,
            username: u.username,
            plan: u.plan,
            country: u.country || '🇺🇸'
          }));

          // Exclude the current logged-in user to avoid duplicating them in listing feed
          const filteredDbRealUsers = dbRealUsers.filter(u => u.id !== (session?.user?.id || 'current_user_id'));

          const highTrafficPool = [
            { id: 'rand1', username: 'Marcus FX', plan: 'premium', country: '🇬🇧' },
            { id: 'rand2', username: 'Sophia Trades', plan: 'plus', country: '🇨🇦' },
            { id: 'rand3', username: 'Niklas T.', plan: 'premium', country: '🇩🇪' },
            { id: 'rand4', username: 'Yuki PipHunter', plan: 'plus', country: '🇯🇵' },
            { id: 'rand5', username: 'AlphaScalper', plan: 'premium', country: '🇺🇸' },
            { id: 'rand6', username: 'Emma Bull', plan: 'plus', country: '🇳🇱' },
            { id: 'rand7', username: 'Seb FX', plan: 'premium', country: '🇩🇪' },
            { id: 'rand8', username: 'Diego FX', plan: 'plus', country: '🇪🇸' }
          ];

          // Combine actual database users with realistic high traffic members to always keep a high-quality list
          const combinedHighTraffic = [...filteredDbRealUsers];
          for (const item of highTrafficPool) {
            if (!combinedHighTraffic.some(u => u.username.toLowerCase() === item.username.toLowerCase())) {
              combinedHighTraffic.push(item);
            }
          }

          const seedsToUse = isHighTraffic ? combinedHighTraffic : mockSeeds;

          // If the list has no registered candidates yet, seed some default mock ones
          if (displayCandidates.length === 0) {
            displayCandidates.push(...seedsToUse.slice(0, 3));
          } else {
            // Fill up with mock candidates if there are less than 3
            for (const seed of seedsToUse) {
              if (displayCandidates.length < 3 && !displayCandidates.some(c => c.username === seed.username)) {
                displayCandidates.push(seed);
              }
            }
          }

          return (
            <div className="fixed inset-0 z-[1011] flex items-center justify-center p-3 md:p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCompetitionsPopupOpen(false)}
                className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm"
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="relative w-full max-w-md bg-white rounded-2xl md:rounded-3xl shadow-2xl border border-slate-100 overflow-y-auto max-h-[92vh] md:max-h-[85vh] z-50 flex flex-col p-4 md:p-6 space-y-3.5 md:space-y-4 text-slate-850"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 md:w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100/50 shrink-0">
                      <Trophy size={15} className="text-amber-500 fill-amber-500/20" />
                    </div>
                    <div className="text-left font-mono">
                      <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-indigo-600 block">Competition & Cash Prizes</span>
                      <h3 className="text-[11px] md:text-xs font-black uppercase tracking-wider text-slate-900 leading-none mt-0.5">Simulated Trading Competition</h3>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsCompetitionsPopupOpen(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs font-black p-1.5 rounded-full hover:bg-slate-50 transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Requirement Alert Section */}
                <div className="p-3 bg-gradient-to-r from-amber-500/5 to-indigo-500/5 border border-amber-100/30 rounded-xl flex flex-col space-y-2 text-left">
                  <span className="text-[8px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1 font-mono">
                    🔒 COMMUNITY GOAL UNLOCK
                  </span>
                  <p className="text-[10px] md:text-[11px] text-slate-600 font-semibold leading-relaxed">
                    Hello Trader! Prove your edge and conquer the market. Our weekly simulated trading competitions will officially unlock globally as soon as our platform community crosses <strong className="text-slate-900 font-extrabold">2,000 active Plus and Premium traders</strong> combined. We share <strong className="text-emerald-600 font-extrabold">$500 every single week</strong> among the top ten leaderboard winners! Apply now to reserve your spot and claim your glory.
                  </p>
                  
                  {/* Visual Milestone Progress */}
                  <div className="pt-1 space-y-1">
                    <div className="flex items-center justify-between text-[7.5px] md:text-[8px] font-black uppercase tracking-wide text-slate-400 font-mono">
                      <span>Premium & Plus Goal Progress</span>
                      <span className="text-indigo-600">
                        {subscribersCount.toLocaleString()} / 2,000 members ({subscribersPercentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${subscribersPercentage}%` }}
                        className="h-full bg-gradient-to-r from-amber-500 to-indigo-500 rounded-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Next Scheduled Slot */}
                <div className="space-y-2 text-left border border-slate-105 p-3 rounded-xl bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-mono">
                      <div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
                      <span className="text-[8px] md:text-[9px] font-bold text-slate-505 uppercase tracking-widest block">Active Slot Status</span>
                    </div>
                    <span className="text-[7.5px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full uppercase border border-emerald-100/40">Active Slot</span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-[11px] font-bold text-slate-852 uppercase tracking-wide font-mono">
                      Competition #1: Weekly Simulated Backtest Derby
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-[9px] font-semibold text-slate-500 pt-1 font-mono">
                      <div>
                        <span className="font-bold text-slate-400 uppercase text-[7px]/none tracking-wider block mb-0.5">Weekly Cash Prize</span>
                        <strong className="text-slate-800 font-extrabold text-[10px] leading-tight">$500 shared among Top 10</strong>
                      </div>
                      <div>
                        <span className="font-bold text-slate-400 uppercase text-[7px]/none tracking-wider block mb-0.5">Registered Traders</span>
                        <strong className="text-slate-850 font-extrabold text-[10px] leading-tight block">
                          {totalParticipantsDisplay.toLocaleString()} traders
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Simulated Competitors List */}
                  <div className="border-t border-slate-200/45 pt-2 mt-2">
                    <span className="text-[7px] md:text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block font-mono">Trader Registrations Feed</span>
                    <div className="space-y-1">
                      {displayCandidates.slice(0, 4).map((cand) => {
                        const isPrimaryUser = cand.id === session?.user?.id || cand.id === 'current_user_id';
                        const planTheme = cand.plan === 'premium'
                          ? 'text-amber-700 bg-amber-50/70 border-amber-200/50'
                          : cand.plan === 'plus'
                          ? 'text-indigo-700 bg-indigo-50/70 border-indigo-200/50'
                          : 'text-slate-700 bg-slate-50/70 border-slate-200/50';

                        return (
                          <div 
                            key={cand.id} 
                            className={`flex items-center justify-between text-[9px] md:text-[10px] py-1 md:py-1.5 px-2.5 rounded-lg border transition-colors ${
                              isPrimaryUser 
                                ? 'bg-indigo-50/60 border-indigo-200 font-bold text-indigo-900 shadow-sm' 
                                : 'bg-white border-slate-100 font-medium text-slate-600'
                            }`}
                          >
                            <span className="flex items-center gap-1">
                              <span className="text-[10px] leading-none">{cand.country || '🇺🇸'}</span>
                              <span className={`font-semibold text-slate-700 ${isPrimaryUser ? 'font-extrabold text-indigo-900' : ''}`}>
                                {isPrimaryUser ? 'You (Candidate Slot)' : cand.username}
                              </span>
                            </span>
                            <span className={`text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${planTheme} leading-none font-mono`}>
                              {cand.plan === 'premium' ? 'Premium Plan' : cand.plan === 'plus' ? 'Plus Plan' : 'Basic Plan'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Action Apply Button */}
                <div className="pt-1">
                  {!hasAppliedForCompetition ? (
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={async () => {
                        if (subscriptionPlan === 'basic') {
                          addNotification('This simulated trading competition is reserved exclusively for Plus & Premium tier members. Upgrade your plan to participate!', 'error');
                          return;
                        }
                        try {
                          const userId = session?.user?.id || 'anonymous';
                          const response = await fetch('/api/competitions/apply', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId })
                          });
                          if (response.ok) {
                            const data = await response.json();
                            setHasAppliedForCompetition(true);
                            localStorage.setItem('has_applied_competitions', 'true');
                            setPremiumPlusCount(data.premiumPlusCount || 0);
                            setCompetitionsCount(data.competitionsCount || 0);
                            if (data.candidates && Array.isArray(data.candidates)) {
                              setCompetitionCandidates(data.candidates);
                            }
                            addNotification('Priority space secured successfully!', 'success');
                          } else {
                            throw new Error('Server returned error status');
                          }
                        } catch (err) {
                          console.error('[Competitions apply fallback]', err);
                          setHasAppliedForCompetition(true);
                          localStorage.setItem('has_applied_competitions', 'true');
                          setCompetitionsCount(prev => prev + 1);
                          addNotification('Priority space secured successfully!', 'success');
                        }
                      }}
                      className="w-full bg-slate-900 hover:bg-indigo-650 text-white rounded-xl py-3 text-[9px] font-black uppercase tracking-widest shadow-md transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5 font-mono"
                    >
                      Apply to Join the First Competition
                    </motion.button>
                  ) : (
                    <div className="w-full bg-emerald-50 text-emerald-800 border border-emerald-100/70 rounded-xl py-3 text-[9px] font-black uppercase tracking-widest text-center flex items-center justify-center gap-1.5 select-none font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      Applied to Join Competition #1
                    </div>
                  )}
                  
                  <p className="text-[7.5px] md:text-[8px] text-slate-400 font-bold mt-2 text-center select-none font-mono">
                    * Active candidate seats are allocated dynamically in order of registration. Keep practicing!
                  </p>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* 🚀 STREAK BADGE AWARD CELEBRATION OVERLAY */}
      <AnimatePresence>
        {activeEarnedBadge && (
          <div className="fixed inset-0 z-[1010] flex items-center justify-center p-4 overflow-hidden">
            {/* Backdrop with extreme visual richness */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/85 backdrop-blur-md"
            />

            {/* Confetti and Lights Shower */}
            <div className="absolute inset-0 pointer-events-none select-none">
              {Array.from({ length: 28 }).map((_, i) => {
                const randomX = Math.random() * 100; // % range
                const randomDelay = Math.random() * 3; // seconds
                const randomDuration = 3 + Math.random() * 4; // seconds
                const colors = ['#00b67a', '#fbbf24', '#f87171', '#60a5fa', '#a78bfa', '#f472b6'];
                const color = colors[i % colors.length];
                return (
                  <motion.div
                    key={i}
                    initial={{ y: -50, x: `${randomX}vw`, opacity: 0.8, rotate: 0 }}
                    animate={{ 
                      y: '110vh', 
                      rotate: 360 * (Math.random() > 0.5 ? 1 : -1)
                    }}
                    transition={{
                      duration: randomDuration,
                      repeat: Infinity,
                      delay: randomDelay,
                      ease: "linear"
                    }}
                    style={{
                      position: 'absolute',
                      width: `${8 + Math.random() * 12}px`,
                      height: `${6 + Math.random() * 8}px`,
                      backgroundColor: color,
                      borderRadius: '2px',
                    }}
                  />
                );
              })}
            </div>

            {/* Celebrating Content Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.4, rotate: -15 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.5, rotate: 15 }}
              transition={{ type: "spring", stiffness: 150, damping: 15 }}
              className="relative w-full max-w-sm bg-white border border-slate-150 rounded-[2.5rem] shadow-2xl overflow-hidden p-8 text-center flex flex-col items-center space-y-6 z-10"
            >
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-400 via-[#00b67a] to-blue-500" />
              
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-amber-500 tracking-[0.25em] block animate-pulse">🎉 NEW REWARD UNLOCKED 🎉</span>
                <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 leading-tight">Milestone Achieved!</h2>
              </div>

              {/* Medallion Display */}
              <div className="relative">
                {/* Visual Glow Waves */}
                <motion.div 
                  className="absolute inset-0 rounded-full bg-amber-400/20 blur-xl animate-pulse"
                />
                
                <div className={`w-28 h-28 ${activeEarnedBadge.colorClass || 'text-amber-500 bg-amber-50 border-amber-200'} rounded-full border border-neutral-200 flex flex-col items-center justify-center relative shadow-lg`}>
                  <Flame size={44} className="fill-current animate-bounce stroke-[1.8]" />
                  <div className="absolute -bottom-1 bg-slate-950 text-white border border-slate-800 text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                    STREAK
                  </div>
                </div>
              </div>

              {/* Reward Descriptions */}
              <div className="space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-[#00b67a] bg-[#00b67a]/10 px-3.5 py-1 rounded-full border border-[#00b67a]/20">
                  {activeEarnedBadge.title} ({activeEarnedBadge.subtitle})
                </span>
                <p className="text-[11.5px] text-slate-500 font-semibold leading-relaxed pt-2">
                  "{activeEarnedBadge.description}"
                </p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest pt-1">
                  Current Backtesting Core Streak: <strong className="text-slate-900">{streakCount} Days Active</strong>
                </p>
              </div>

              {/* Action trigger to next event */}
              <button
                onClick={() => {
                  setActiveEarnedBadge(null);
                  setShowTrustpilotPrompt(true); // Automatically trigger Trustpilot dialog popup next!
                }}
                className="w-full py-4 bg-slate-950 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-850 shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                Awesome, Got It!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🚀 CANCELABLE FEEDBACK PROMPT DIALOG POPUP (TRUSTPILOT INITIATED) */}
      <AnimatePresence>
        {showTrustpilotPrompt && (
          <div className="fixed inset-0 z-[1011] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTrustpilotPrompt(false)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            />

            {/* Prompt Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[2rem] max-w-md w-full p-7 shadow-2xl relative border border-slate-100 z-10 space-y-5"
            >
              <div className="flex justify-between items-start pb-2 border-b border-slate-50">
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-[#00b67a] fill-[#00b67a]" />
                  <span className="text-[10px] font-black uppercase text-slate-900 tracking-wider">Leave Us a review</span>
                </div>
                <button
                  onClick={() => setShowTrustpilotPrompt(false)}
                  className="p-1 text-[9.5px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-900 cursor-pointer"
                >
                  Maybe Later
                </button>
              </div>

              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#00b67a]/10 border border-[#00b67a]/20 flex items-center justify-center text-[#00b67a] mx-auto animate-pulse">
                  <Heart size={20} className="fill-[#00b67a]" />
                </div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Enjoying FirstLook?</h3>
                <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                  Hey! Congratulations on reaching this milestone streak. I would love to hear how you are liking the platform. If you have a minute, please leave a quick rating below to share your experience with me!
                </p>
              </div>

              {/* Interactive stars rating component for direct backend trustpilot sync */}
              <div className="flex flex-col items-center bg-slate-50/60 p-4 border border-slate-100 rounded-2xl space-y-3">
                <div className="flex items-center gap-1.5 justify-center">
                  {[1, 2, 3, 4, 5].map((starVal) => {
                    const isHigh = (tpHoveredRating || tpRating) >= starVal;
                    return (
                      <button
                        key={starVal}
                        onMouseEnter={() => setTpHoveredRating(starVal)}
                        onMouseLeave={() => setTpHoveredRating(0)}
                        onClick={() => setTpRating(starVal)}
                        className="p-0.5 cursor-pointer hover:scale-110 transition-transform focus:outline-none"
                      >
                        <Star 
                          size={18} 
                          className={`${isHigh ? 'text-[#00b67a] fill-[#00b67a]' : 'text-slate-300'} transition-all`} 
                        />
                      </button>
                    );
                  })}
                </div>
                {tpRating > 0 ? (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="w-full space-y-2.5">
                    <textarea
                      value={tpFeedback}
                      onChange={(e) => setTpFeedback(e.target.value)}
                      placeholder="Tell other traders about your experience with FirstLook..."
                      className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-[10.5px] focus:outline-none focus:border-[#00b67a] resize-none h-14 font-semibold text-slate-800"
                    />
                    <button
                      onClick={async () => {
                        try {
                          const resp = await fetch('/api/feedback', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              rate: tpRating,
                              user_email: session?.user?.email || 'guest@firstlook.com',
                              feedback: tpFeedback || ''
                            })
                          });
                          if (resp.ok) {
                            setShowTrustpilotPrompt(false);
                            addNotification("Thank you so much! I have received your feedback.", "success");
                          }
                        } catch (err) {
                          console.error("[Submitting from popup error]", err);
                        }
                      }}
                      className="w-full bg-[#00b67a] text-white py-2 text-[10px] font-black uppercase tracking-widest hover:bg-[#009b67] rounded-xl transition-all cursor-pointer"
                    >
                      Submit Feedback
                    </button>
                  </motion.div>
                ) : (
                  <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Tap stars to start review</span>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarButton({ icon: Icon, label, onClick }: { icon: any; label: string; onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all group"
    >
      <Icon size={18} className="group-hover:text-blue-600 transition-colors" />
      <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}

function NavIcon({ icon: Icon, active, onClick, label }: { icon: any; active: boolean; onClick: () => void; label: string }) {
  return (
    <div className="relative group">
      <button 
        onClick={onClick}
        className={`p-3 rounded-xl transition-all duration-300 relative ${
          active 
            ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-600/5' 
            : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
        }`}
      >
        <Icon size={20} strokeWidth={active ? 2.5 : 2} />
        {active && (
          <motion.div 
            layoutId="activeTab"
            className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-blue-600 rounded-full"
          />
        )}
      </button>
      
      {/* Tooltip */}
      <div className="absolute left-full ml-4 px-2 py-1 bg-slate-900 text-white text-[10px] font-bold rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
        {label}
      </div>
    </div>
  );
}
