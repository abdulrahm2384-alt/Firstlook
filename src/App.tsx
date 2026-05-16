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
  SkipForward,
  ChevronDown,
  ChevronUp,
  LogOut,
  List,
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
  Database
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
import { TriggerSetupModal } from './components/TriggerSetupModal';
import { ProfilePage } from './components/ProfilePage';
import { DrawingType, Drawing } from './types/drawing';
import { fetchMarketData as fetchCandleData, formatTwelveDataSymbol } from './services/marketDataService';
import { runBacktest } from './services/backtestEngine';
import { StrategyParams, BacktestResult, Candle, ChartTheme, IndicatorInstance, JournalTrade, BacktestSession, MarketType, MarketSymbol } from './types';
import { calculatePips, normalizeSymbol } from './lib/marketUtils';
import { supabase, isSupabasePlaceholder } from './lib/supabase';
import { LoginPage } from './components/LoginPage';
import { WatchlistPage } from './components/WatchlistPage';
import { DatabasePage } from './warehouse/DatabasePage';
import { persistenceService } from './services/persistenceService';

import { WatchlistItem } from './types/watchlist';
import { POPULAR_SYMBOLS } from './constants/symbols';
import { InstallPrompt } from './components/InstallPrompt';

const TIMEFRAMES = [
  { id: '1m', label: '1m', seconds: 60 },
  { id: '3m', label: '3m', seconds: 180 },
  { id: '5m', label: '5m', seconds: 300 },
  { id: '15m', label: '15m', seconds: 900 },
  { id: '30m', label: '30m', seconds: 1800 },
  { id: '1h', label: '1h', seconds: 3600 },
  { id: '2h', label: '2h', seconds: 7200 },
  { id: '4h', label: '4h', seconds: 14400 },
  { id: '6h', label: '6h', seconds: 21600 },
  { id: '8h', label: '8h', seconds: 28800 },
  { id: '12h', label: '12h', seconds: 43200 },
  { id: '1d', label: '1D', seconds: 86400 },
  { id: '1w', label: '1W', seconds: 604800 },
  { id: '1mo', label: '1M', seconds: 2592000 },
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
  timezone: 'UTC'
};

const toTheme = (t: any): ChartTheme => ({
  ...DEFAULT_THEME,
  ...t
});

const MemoizedChart = memo(ChartComponent);

const MemoizedWatchlistPage = memo(WatchlistPage);
const MemoizedProfilePage = memo(ProfilePage);

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
  simMoveBy, 
  setSimMoveBy,
  selectedTimeframe,
  isSpeedOpen,
  setIsSpeedOpen,
  isStepByOpen,
  setIsStepByOpen,
  speedRef,
  stepByRef,
  activeSimControlsPos,
  updateSimControlsPosWithClamp,
  workspaceRef,
  currentMode,
  watchlist,
  activeWatchlistItemId,
  backtestSessions,
  addNotification
}: any) => {
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
          onClick={() => isReplayMode ? setReplayIsPlaying(!replayIsPlaying) : setSimIsPlaying(!simIsPlaying)}
          className={`${isMobile ? 'w-7 h-7' : 'w-9 h-9 md:w-[5.5vh] md:h-[5.5vh]'} flex items-center justify-center rounded-xl transition-all ${(isReplayMode ? replayIsPlaying : simIsPlaying) ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-900 text-white shadow-lg'}`}
        >
          {(isReplayMode ? replayIsPlaying : simIsPlaying) ? <Pause size={isMobileLandscape ? '3vh' : isMobile ? 10 : 18} fill="currentColor" /> : <Play size={isMobileLandscape ? '3vh' : isMobile ? 10 : 18} fill="currentColor" />}
        </button>
        <button 
          onClick={() => {
            if (isReplayMode) {
              setReplayCurrentTime((prev: number) => (prev || 0) + getStepSeconds());
            } else {
              setSimCurrentTime((prev: number) => {
                const current = prev || 0;
                const next = current + getStepSeconds();
                const activeItem = watchlist.find(i => i.id === activeWatchlistItemId);
                if (activeItem) {
                  const sessionKey = `${activeItem.symbol}_${activeItem.prefix || '00'}`;
                  const session = backtestSessions[sessionKey];
                  if (session?.endTime && next > session.endTime) {
                    addNotification('Cannot move beyond session end date', 'warning');
                    return current;
                  }
                }
                return next;
              });
            }
          }}
          className={`${isMobile ? 'w-7 h-7' : 'w-9 h-9 md:w-[5.5vh] md:h-[5.5vh]'} flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all`}
          title="Step Forward"
        >
          <SkipForward size={isMobileLandscape ? '3vh' : isMobile ? 10 : 18} />
        </button>
      </div>

      <div className={`${isMobile ? 'h-4' : 'h-7'} w-px bg-slate-100 mx-0.5 md:h-[4.5vh]`}></div>

      <div className={`flex items-center ${isMobile ? 'gap-0.5' : 'gap-1'}`}>
        <div className="relative" ref={speedRef}>
          <button 
             onClick={() => setIsSpeedOpen(!isSpeedOpen)}
             className={`${isMobile ? 'h-7 px-1.5' : 'h-9 px-2.5 md:h-[5.5vh] md:px-[1.8vh]'} flex items-center justify-center gap-[0.3vh] rounded-xl transition-all ${isSpeedOpen ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-400 hover:text-slate-900'}`}
           >
             <span className={`${isMobileLandscape ? 'text-[2vh]' : isMobile ? 'text-[8px]' : 'text-[11px]'} font-black`}>{simSpeed}x</span>
             <ChevronUp size={isMobileLandscape ? '1.2vh' : isMobile ? 6 : 9} strokeWidth={4} className={`transition-transform duration-300 ${isSpeedOpen ? 'rotate-180' : 'opacity-40'}`} />
           </button>
          <AnimatePresence>
            {isSpeedOpen && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-white border border-slate-100 rounded-2xl shadow-2xl p-1 w-20 overflow-hidden z-[70] ${isMobileLandscape ? 'max-h-[30vh]' : 'max-h-[180px]'} overflow-y-auto scrollbar-hide`}
              >
                {[0.5, 1, 2, 3, 5, 10].map(s => (
                  <button 
                    key={s}
                    onClick={() => {
                      setSimSpeed(s);
                      setIsSpeedOpen(false);
                    }}
                    className={`w-full text-center ${isMobileLandscape ? 'py-[0.8vh] text-[1.6vh]' : 'px-3 py-1.5 text-[9px]'} font-black rounded-xl transition-all ${simSpeed === s ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 font-bold'}`}
                  >
                    {s}x
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative" ref={stepByRef}>
          <button 
            onClick={() => setIsStepByOpen(!isStepByOpen)}
            className={`${isMobileLandscape ? 'h-[5vh] px-[1.5vh] flex-row' : 'h-10 px-3 flex-col'} flex items-center justify-center gap-1 rounded-xl md:rounded-2xl transition-all ${isStepByOpen ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-400 hover:text-slate-900'}`}
          >
            {!isMobileLandscape && <span className={`text-[8px] font-black uppercase tracking-tighter leading-none ${isStepByOpen ? 'text-slate-400' : 'text-slate-400'}`}>Step By</span>}
            <span className={`${isMobileLandscape ? 'text-[1.8vh]' : 'text-[10px]'} font-black ${isStepByOpen ? 'text-white' : 'text-slate-900'}`}>{TIMEFRAMES.find(t => t.id === (simMoveBy || selectedTimeframe.id))?.label}</span>
            {isMobileLandscape && <ChevronUp size={isMobileLandscape ? '1.2vh' : 8} strokeWidth={4} className={`transition-transform duration-300 ${isStepByOpen ? 'rotate-180' : 'opacity-40'}`} />}
          </button>
          <AnimatePresence>
            {isStepByOpen && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white border border-slate-100 rounded-2xl shadow-2xl p-1 ${isMobileLandscape ? 'w-24' : 'w-32'} max-h-64 overflow-y-auto scrollbar-hide z-[70]`}
              >
                {TIMEFRAMES.map(tf => (
                  <button 
                    key={tf.id}
                    onClick={() => {
                      setSimMoveBy(tf.id);
                      setIsStepByOpen(false);
                    }}
                    className={`w-full text-center ${isMobileLandscape ? 'py-[1vh] text-[1.8vh]' : 'px-3 py-2 text-[10px]'} font-bold rounded-xl transition-all ${simMoveBy === tf.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    {tf.label}
                  </button>
                ))}
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

// Update the export of App or the main component as well
export default function App() {
  const [session, setSession] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showWarehouse, setShowWarehouse] = useState(false);
  const [params, setParams] = useState<StrategyParams>({});
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

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

  const [historicalData, setHistoricalData] = useState<Candle[]>([]);
  const [isLoadingPast, setIsLoadingPast] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [triggerSetupDrawing, setTriggerSetupDrawing] = useState<Drawing | null>(null);
  const [setups, setSetups] = useState<any[]>([]);
  const [pinnedText, setPinnedText] = useState<string | null>(null);
  const [settingIndicator, setSettingIndicator] = useState<IndicatorInstance | null>(null);
  const [historyCategory, setHistoryCategory] = useState<string>('All');
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
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
  const setActiveTab = (tab: any) => setActiveTabsByMode(prev => ({ ...prev, [currentMode]: tab }));
  const [selectedTimeframesByMode, setSelectedTimeframesByMode] = useState<Record<string, any>>({
    desktop: TIMEFRAMES[6],
    mobilePortrait: TIMEFRAMES[6],
    mobileLandscape: TIMEFRAMES[6]
  });
  const selectedTimeframe = selectedTimeframesByMode[currentMode];
  const setSelectedTimeframe = (tf: any) => 
    setSelectedTimeframesByMode(prev => ({ ...prev, [currentMode]: tf }));

  const [activeWatchlistCategoriesByMode, setActiveWatchlistCategoriesByMode] = useState<Record<string, string>>({
    desktop: 'Crypto',
    mobilePortrait: 'Crypto',
    mobileLandscape: 'Crypto'
  });
  const activeWatchlistCategory = activeWatchlistCategoriesByMode[currentMode];
  const setActiveWatchlistCategory = (cat: string) => 
    setActiveWatchlistCategoriesByMode(prev => ({ ...prev, [currentMode]: cat }));
  const [isTimeframeOpen, setIsTimeframeOpen] = useState(false);
  const [isStepByOpen, setIsStepByOpen] = useState(false);
  const [isSpeedOpen, setIsSpeedOpen] = useState(false);
  const timeframeRef = useRef<HTMLDivElement>(null);
  const backtestTimeframeRef = useRef<HTMLDivElement>(null);
  const stepByRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (timeframeRef.current && !timeframeRef.current.contains(target)) {
        setIsTimeframeOpen(false);
      }
      if (backtestTimeframeRef.current && !backtestTimeframeRef.current.contains(target)) {
        setIsTimeframeOpen(false);
      }
      if (stepByRef.current && !stepByRef.current.contains(target)) {
        setIsStepByOpen(false);
      }
      if (speedRef.current && !speedRef.current.contains(target)) {
        setIsSpeedOpen(false);
      }
    };
    if (isTimeframeOpen || isStepByOpen || isSpeedOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTimeframeOpen, isStepByOpen, isSpeedOpen]);

  const [theme, setTheme] = useState<ChartTheme>(DEFAULT_THEME);
  const [activeDrawingToolsByMode, setActiveDrawingToolsByMode] = useState<Record<string, DrawingType | null>>({
    desktop: null,
    mobilePortrait: null,
    mobileLandscape: null
  });
  const activeDrawingTool = activeDrawingToolsByMode[currentMode];
  const setActiveDrawingTool = (tool: DrawingType | null) => 
    setActiveDrawingToolsByMode(prev => ({ ...prev, [currentMode]: tool }));

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
      setIsMobile(window.innerWidth < 1024);
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [showFavoritesByMode, setShowFavoritesByMode] = useState<Record<string, boolean>>({
    desktop: true,
    mobilePortrait: true,
    mobileLandscape: true
  });
  const [showToolbarByMode, setShowToolbarByMode] = useState<Record<string, boolean>>({
    desktop: true,
    mobilePortrait: true,
    mobileLandscape: true
  });


  const showFavorites = showFavoritesByMode[currentMode];
  const setShowFavorites = (val: boolean) => setShowFavoritesByMode(prev => ({ ...prev, [currentMode]: val }));
  
  const showDrawingToolbar = showToolbarByMode[currentMode];
  const setShowDrawingToolbar = (val: boolean) => setShowToolbarByMode(prev => ({ ...prev, [currentMode]: val }));
  const [drawingSettings, setDrawingSettings] = useState<any>(null);
  const [indicators, setIndicators] = useState<IndicatorInstance[]>([]);
  const [journalTabsByMode, setJournalTabsByMode] = useState<Record<string, 'ongoing' | 'completed'>>({
    desktop: 'ongoing',
    mobilePortrait: 'ongoing',
    mobileLandscape: 'ongoing'
  });
  const journalTab = journalTabsByMode[currentMode];
  const setJournalTab = (tab: 'ongoing' | 'completed') => 
    setJournalTabsByMode(prev => ({ ...prev, [currentMode]: tab }));

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
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
  const [twelveDataKey] = useState('64bce7c58c1645b5b53f403abd9e69dd');
  const [rateLimitError, setRateLimitError] = useState(false);

  const [backtestSessions, setBacktestSessions] = useState<Record<string, BacktestSession>>({});
  const [journalTrades, setJournalTrades] = useState<JournalTrade[]>([]);
  const [showBacktestSetup, setShowBacktestSetup] = useState<{ symbol: string, source?: string, marketType?: MarketType } | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simIsPlaying, setSimIsPlaying] = useState(false);
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
    const journaled = [...(journalTrades || [])];
    
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
      const rr = tradeInfo?.rr || d.settings?.rr || 0;
      const status = tradeInfo?.status || (d.status === 'won' ? 'TP' : 'SL');
      
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
        rr: status === 'TP' ? Math.abs(rr) : -Math.abs(rr || 1),
        status: status,
        setupGrade: tradeInfo?.setupGrade || d.settings?.setupGrade,
        notes: tradeInfo?.notes || d.settings?.notes,
        drawingId: d.id,
        pips: tradeInfo?.pips || calculatePips(d.symbol || selectedSymbol || '', entryPrice, exitPrice),
        timeframe: tradeInfo?.timeframe || d.settings?.timeframe || selectedTimeframe.label,
        duration: tradeInfo?.duration || '0m',
        realizedAt: new Date(exitTime * 1000).toISOString(),
        isFromDrawing: true
      } as JournalTrade;
    });
    
    return [...journaled, ...unjournaled].sort((a, b) => b.exitTime - a.exitTime);
  }, [journalTrades, drawings, selectedSymbol, activePrefix, activeWatchlistItemId, selectedTimeframe]);

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
  const [replayCurrentTime, setReplayCurrentTime] = useState<number | null>(null);
  const [replayTrade, setReplayTrade] = useState<JournalTrade | null>(null);
  const [replayIsPlaying, setReplayIsPlaying] = useState(false);
  
  const [preReplayDrawings, setPreReplayDrawings] = useState<any[] | null>(null);
  
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
    if (!selectedSymbol) return null;
    return activePrefix ? `${selectedSymbol}_${activePrefix}` : selectedSymbol;
  }, [selectedSymbol, activePrefix]);

  const playbackTimerRef = useRef<number>(performance.now());
  const playbackAnimationRef = useRef<number | null>(null);

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
  }
  const [symbolViewStates, setSymbolViewStates] = useState<Record<string, SymbolViewState>>({});

  const [simSpeed, setSimSpeed] = useState(1);
  const [simMoveBy, setSimMoveBy] = useState<string | null>(null);
  const [simCurrentTime, setSimCurrentTime] = useState<number | null>(null);
  const [simCurrentPrice, setSimCurrentPrice] = useState<number | null>(null);

  // Update simCurrentPrice from the latest available candle in historicalData
  useEffect(() => {
    const time = isReplayMode ? replayCurrentTime : simCurrentTime;
    if (!time || historicalData.length === 0) return;
    const candle = [...historicalData].reverse().find(c => c.time <= time);
    if (candle) {
      setSimCurrentPrice(candle.close);
    }
  }, [simCurrentTime, replayCurrentTime, isReplayMode, historicalData]);

  // Sync simCurrentTime to backtestSessions with throttling to prevent excessive re-renders and save to persistence
  const lastSyncRef = useRef<number>(0);
  useEffect(() => {
    if (selectedSymbol && simCurrentTime && currentSessionKey) {
      const now = Date.now();
      // Sync at most once per second or if it's completed
      const sessionData = backtestSessions[currentSessionKey];
      if (!sessionData) return;

      const finishTrigger = Math.floor(sessionData.createdAt / 1000);
      const isCompleted = simCurrentTime >= finishTrigger;
      
      if (now - lastSyncRef.current < 1500 && !isCompleted && simIsPlaying) {
        return;
      }

      // Update session progress
      setBacktestSessions(prev => {
        const cur = prev[currentSessionKey];
        if (!cur || (cur.currentTime === simCurrentTime && cur.isCompleted === isCompleted)) return prev;
        
        const next = {
          ...prev,
          [currentSessionKey]: { ...cur, currentTime: simCurrentTime, isCompleted }
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
        const matchesCurrent = (prefix: string | null | undefined) => (prefix || '') === (activePrefix || '');
        setWatchlist(prev => {
          const itemToUpdate = prev.find(item => 
            item.symbol === selectedSymbol && 
            matchesCurrent(item.prefix) && 
            item.status !== 'completed'
          );
          if (!itemToUpdate) return prev;

          return prev.map(item => 
            item.symbol === selectedSymbol && matchesCurrent(item.prefix)
              ? { ...item, status: 'completed' }
              : item
          );
        });
      }
    }
  }, [simCurrentTime, selectedSymbol, activePrefix, currentSessionKey, simIsPlaying, session?.user?.id, backtestSessions]);

  // Pause simulation if chart timeframe changes
  useEffect(() => {
    if (simIsPlaying) setSimIsPlaying(false);
  }, [selectedTimeframe]);

  // Initialize simMoveBy to current timeframe when starting simulation if not set
  useEffect(() => {
    if (isSimulating && !simMoveBy) {
      setSimMoveBy(selectedTimeframe.id);
    }
  }, [isSimulating, selectedTimeframe.id, simMoveBy]);

  useEffect(() => {
    if (selectedSymbol && symbolViewStates[selectedSymbol]) {
      const state = symbolViewStates[selectedSymbol];
      if (state.timeframeId && state.timeframeId !== selectedTimeframe.id) {
        const tf = TIMEFRAMES.find(t => t.id === state.timeframeId);
        if (tf) setSelectedTimeframe(tf);
      }
      if (state.indicators) {
        setIndicators(state.indicators);
      } else {
        setIndicators([]);
      }
    } else {
      setIndicators([]);
    }
  }, [selectedSymbol]);

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
        setIsDataInitialized(false);
        setWatchlist([]);
        setBacktestSessions({});
        setDrawings([]);
        setJournalTrades([]);
        setSelectedSymbol(null);
        setIndicators([]);
        setTheme(DEFAULT_THEME);
        setSymbolViewStates({});
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
  
  const viewportTimerRef = useRef<any>(null);
  const handleViewportChange = (v: any) => {
    if (!selectedSymbol) return;
    
    // Use a ref to avoid stale closure and immediate state updates
    if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
    viewportTimerRef.current = setTimeout(() => {
      setSymbolViewStates(prev => {
        const current = prev[selectedSymbol] || { timeframeId: selectedTimeframe.id };
        return {
          ...prev,
          [selectedSymbol]: { ...current, viewport: v }
        };
      });
    }, 1000); // 1 second debounce for persistence
  };

  const handleIndicatorsChange = (newIndicators: IndicatorInstance[]) => {
    setIndicators(newIndicators);
    if (selectedSymbol) {
      setSymbolViewStates(prev => ({
        ...prev,
        [selectedSymbol]: { ...(prev[selectedSymbol] || {}), indicators: newIndicators }
      }));
    }
  };

  const handleTimeframeChange = (tf: typeof TIMEFRAMES[0]) => {
    // Sync viewport when timeframe changes
    if (selectedSymbol && symbolViewStates[selectedSymbol]?.viewport) {
      const oldV = symbolViewStates[selectedSymbol].viewport!;
      const oldTf = selectedTimeframe;
      const ratio = oldTf.seconds / tf.seconds;
      
      // We want to keep the same 'time' at the right edge or center
      // offsetX is bars from end. newOffsetX = oldOffsetX * ratio
      const newOffsetX = oldV.offsetX * ratio;
      const newZoom = oldV.zoom / ratio; // Keep candle width in time similar
      
      handleViewportChange({
        ...oldV,
        offsetX: newOffsetX,
        zoom: newZoom
      });
    }

    setSelectedTimeframe(tf);
    if (selectedSymbol) {
      setSymbolViewStates(prev => ({
        ...prev,
        [selectedSymbol]: { ...(prev[selectedSymbol] || {}), timeframeId: tf.id }
      }));
    }
  };

  useEffect(() => {
    setHistoricalData([]);
    setSimCurrentTime(null);
    setIsSimulating(false);
    setSimIsPlaying(false);
  }, [selectedSymbol]);

  const updateSelectedSymbol = (symbol: string) => {
    // Always show setup modal to let user choose/confirm start date
    setShowBacktestSetup({ symbol });
  };

  const startBacktestSession = async (symbol: string, startDate: string, prefixOverride: string, description: string, setupImage?: string, source?: string, marketType?: MarketType, endDate?: string) => {
    const asset = POPULAR_SYMBOLS.find(s => s.symbol === symbol);
    if (!asset) return;

    // Use provided source or default to TwelveData for Forex/Metals, Binance for Crypto
    const finalSource = source || (asset.category === 'Crypto' ? 'binance' : 'twelvedata');
    const finalMarketType = marketType || 'spot';

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

    const startDateObj = new Date(startDate);
    const minSelectableDate = asset.category === 'Crypto' && asset.marketStart 
      ? new Date(asset.marketStart) 
      : new Date('2015-08-01');

    if (startDateObj < minSelectableDate) {
      alert(`Start date must be at least ${minSelectableDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}. Earliest allowed: ${minSelectableDate.toISOString().split('T')[0]}`);
      return;
    }

    const startTimeInSeconds = Math.floor(startDateObj.getTime() / 1000);
    const endTimeInSeconds = endDate ? Math.floor(new Date(endDate).getTime() / 1000) : undefined;
    const createdAt = Date.now();
    const watchlistId = `wl_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
    
    // Update local state and save immediately
    setBacktestSessions(prev => {
      const next = { 
        ...prev, 
        [sessionKey]: {
          ...(prev[sessionKey] || {}),
          startTime: startTimeInSeconds,
          endTime: endTimeInSeconds,
          currentTime: prev[sessionKey]?.currentTime || startTimeInSeconds,
          createdAt: prev[sessionKey]?.createdAt || createdAt,
          prefix,
          description,
          symbol // Ensure symbol is set
        } as BacktestSession
      };
      if (session?.user?.id) {
        persistenceService.saveBacktestSessions(session.user.id, next);
      }
      return next;
    });
    
    setWatchlist(prev => {
      // Strict check: same symbol AND same prefix AND same source
      const existingIndex = prev.findIndex(item => 
        item.symbol === symbol && 
        (item.prefix || '') === (prefix || '') && 
        item.dataSource === finalSource
      );
      
      let next;
      if (existingIndex > -1) {
        next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          description,
          setupImage
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
          createdAt: Date.now()
        };
        next = [...prev, newItem];
        addNotification(`Launched ${symbol} (${prefix}) session`, 'success');
      }

      if (session?.user?.id) {
        persistenceService.saveWatchlist(session.user.id, next);
      }
      return next;
    });
    
    setActiveWatchlistItemId(watchlistId);
    setActivePrefix(prefix);
    setSelectedSymbol(symbol);
    setIsSimulating(!isMobile);
    
    addNotification(`Launched ${symbol} (${prefix}) session`, 'success');
    
    setShowBacktestSetup(null);
  };

  const loadUserData = async (userId: string) => {
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
      
      if (savedSessions) {
        // Migration: ensure values are objects and startTime/currentTime are in seconds
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
            
            acc[key] = {
              ...val,
              startTime: isStartMs ? Math.floor(val.startTime / 1000) : val.startTime,
              currentTime: isCurrentMs ? Math.floor(val.currentTime / 1000) : val.currentTime,
              createdAt: val.createdAt || Date.now()
            };
          }
          return acc;
        }, {} as Record<string, any>);
        setBacktestSessions(migrated);
      }

      if (savedWatchlist && Array.isArray(savedWatchlist)) {
        setWatchlist(savedWatchlist.map(item => ({
          ...item,
          id: item.id || `wl_${item.symbol}_${item.prefix || ''}_legacy`,
          status: item.status || 'ongoing'
        })));
      }

      if (savedPrefs) {
        if (savedPrefs.theme) setTheme(toTheme(savedPrefs.theme));
        if (savedPrefs.indicators) setIndicators(savedPrefs.indicators);
        if (savedPrefs.activeTab) setActiveTab(savedPrefs.activeTab as any);
        if (savedPrefs.activeWatchlistTab) setJournalTab(savedPrefs.activeWatchlistTab as any);
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
          setFavorites(savedPrefs.favorites as DrawingType[]);
        } else {
          // Default favorites if empty
          setFavorites([
            DrawingType.TREND_LINE,
            DrawingType.HORIZONTAL_LINE,
            DrawingType.RECTANGLE,
            DrawingType.FIB_RETRACEMENT,
            DrawingType.LONG_POSITION,
            DrawingType.SHORT_POSITION
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
          twelveDataKey,
          lastSelectedSymbol: selectedSymbol,
          activePrefix: activePrefix || undefined,
          activeWatchlistItemId: activeWatchlistItemId || undefined,
          pinnedText: pinnedText || undefined,
        }).catch(err => console.warn('[Sync] Failed to save preferences, will retry on next change'));
      }, 5000);
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
    twelveDataKey, 
    selectedSymbol, 
    session?.user?.id, 
    isDataInitialized, 
    activePrefix, 
    activeWatchlistItemId,
    drawingSettingsPosByMode,
    pinnedText
  ]);

  // Sync Watchlist (Optimized debounce for speed)
  useEffect(() => {
    if (session?.user?.id && isDataInitialized) {
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
        prevDayColor: "#000000",
        showPrevWeek: true,
        prevWeekCount: 1,
        prevWeekColor: "#3b82f6",
        showPrevMonth: true,
        prevMonthCount: 1,
        prevMonthColor: "#f59e0b",
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
    setDrawings(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    if (selectedDrawing?.id === id) {
      setSelectedDrawing(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const deleteDrawing = (id: string) => {
    setDrawings(prev => prev.filter(d => d.id !== id));
    if (selectedDrawing?.id === id) setSelectedDrawing(null);
  };

  // Theme sync is handled via the preferences effect

  const loadMarketData = async (symbol: string, timeframeId: string, initialEndTime?: number, sourceOverride?: string, marketTypeOverride?: MarketType) => {
    if (!symbol) return;

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
    if (historicalData.length > 0 && selectedSymbol === symbol && selectedTimeframe.id === timeframeId) {
       // Only skip if the source is also the same
       if (activeItem?.dataSource === source && activeItem?.marketType === marketType) {
         // Data is likely compatible
       } else {
         setHistoricalData([]);
       }
    } else {
      setHistoricalData([]);
    }
    
    if (!initialEndTime) {
      return;
    }

    setIsLoadingPast(true);
    setRateLimitError(false);
    try {
      // Fetch past data (500 candles)
      const dataPast = await fetchCandleData(symbol, timeframeId, 500, initialEndTime, undefined, source, marketType);
      
      // Fetch future data (1000 candles max for Binance) for replay
      const dataFuture = await fetchCandleData(symbol, timeframeId, 1000, undefined, initialEndTime, source, marketType);
      
      // Deduplicate if needed (Binance and TwelveData might include the boundary candle in both)
      const filteredFuture = dataFuture.filter(f => !dataPast.some(p => p.time === f.time));
      const combined = [...dataPast, ...filteredFuture];

      if (combined.length === 0) {
        addNotification(`No candle data found for ${symbol} on ${timeframeId}`, 'info');
      }

      setSelectedSymbol(current => {
        if (current === symbol) {
          if (combined.length > 0) {
            setHistoricalData(combined);
            // Initialize simCurrentTime to the session start point
            setSimCurrentTime(initialEndTime);
          } else {
            setHistoricalData([]);
            setSimCurrentTime(null);
          }
        }
        return current;
      });
    } catch (err: any) {
      if (err?.message === 'RATE_LIMIT') {
        setRateLimitError(true);
        addNotification('Rate limit reached. Please wait a minute or add more Twelve Data API keys.', 'error');
      } else {
        const errorMsg = err instanceof Error ? err.message : String(err);
        addNotification(`Failed to load ${symbol}: ${errorMsg}`, 'error');
      }
      console.error('Failed to load market data:', err);
      // Only clear if this was the last requested
      setSelectedSymbol(current => {
        if (current === symbol) setHistoricalData([]);
        return current;
      });
    } finally {
      setIsLoadingPast(false);
    }
  };

  useEffect(() => {
    if (!selectedSymbol) return;
    
    const sessionData = currentSessionKey ? backtestSessions[currentSessionKey] : null;

    if (sessionData) {
      const activeItem = watchlist.find(i => i.id === activeWatchlistItemId);
      // If we already have a simulation time, use it to avoid jumping back to start on timeframe change
      const timeToLoad = simCurrentTime || sessionData.startTime;
      loadMarketData(selectedSymbol, selectedTimeframe.id, timeToLoad, activeItem?.dataSource, activeItem?.marketType);
      setIsSimulating(!isMobile);
    }
  }, [selectedSymbol, selectedTimeframe.id, activePrefix, activeWatchlistItemId, watchlist, currentSessionKey ? backtestSessions[currentSessionKey]?.startTime : null]);

  const loadMorePast = async () => {
    if (isLoadingPast || historicalData.length === 0 || !selectedSymbol) return;
    
    setIsLoadingPast(true);
    try {
      const activeItem = watchlist.find(i => i.id === activeWatchlistItemId);
      const source = activeItem?.dataSource;

      const oldestCandle = historicalData[0];
      // Binance endTime is inclusive, so we subtract 1s to get previous data
      const endTime = oldestCandle.time - 1; // ALREADY IN SECONDS
      const olderData = await fetchCandleData(selectedSymbol, selectedTimeframe.id, 500, endTime, undefined, source, activeItem?.marketType);
      
      if (olderData.length > 0) {
        setHistoricalData(prev => [...olderData, ...prev]);
      } else {
        addNotification(`No more historical data available for ${selectedSymbol}`, 'info');
      }
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      addNotification(`Failed to load more data: ${errorMsg}`, 'error');
      console.error('Failed to load older data:', err);
    } finally {
      setIsLoadingPast(false);
    }
  };

  const handleSelectSymbol = (symbol: string, prefix?: string, id?: string, source?: string, marketType?: MarketType) => {
    const sessionKey = prefix ? `${symbol}_${prefix}` : symbol;
    if (backtestSessions[sessionKey]) {
      setActivePrefix(prefix || null);
      setSelectedSymbol(symbol);
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

  const handleDeleteWatchlistItem = (symbol: string, prefix?: string, id?: string) => {
    const matchesTarget = (s: string, p: string | null | undefined, itemId?: string) => {
      if (id && itemId) return itemId === id;
      return s === symbol && (p || '') === (prefix || '');
    };

    // 1. Update watchlist
    const nextWatchlist = watchlist.filter(p => !matchesTarget(p.symbol, p.prefix, p.id));
    setWatchlist(nextWatchlist);
    
    // 2. Update drawings
    const nextDrawings = drawings.filter(d => !matchesTarget(d.symbol, d.prefix, d.watchlistId || (d.settings?.watchlistId)));
    setDrawings(nextDrawings);

    // 3. Update journal trades
    const nextTrades = journalTrades.filter(t => !matchesTarget(t.symbol, t.prefix, t.watchlistId));
    setJournalTrades(nextTrades);
    
    // 4. Update backtest sessions
    const normalizedPrefix = prefix || '';
    const sessionKey = normalizedPrefix ? `${symbol}_${normalizedPrefix}` : symbol;
    const nextSessions = { ...backtestSessions };
    delete nextSessions[sessionKey];
    setBacktestSessions(nextSessions);
    
    // 5. Persistence
    if (session?.user?.id) {
      persistenceService.saveWatchlist(session.user.id, nextWatchlist);
      persistenceService.saveDrawings(session.user.id, nextDrawings);
      persistenceService.saveBacktestSessions(session.user.id, nextSessions);
      persistenceService.deleteTradesForSymbol(session.user.id, symbol, prefix, id);
      addNotification(`Removed all data for ${symbol}${prefix ? ` (${prefix})` : ''}`, 'info');
    }
    
    // 6. Cleanup current view if needed
    if (selectedSymbol === symbol && activePrefix === (prefix || null)) {
      setSelectedSymbol(null);
      setActivePrefix(null);
      setActiveWatchlistItemId(null);
      setHistoricalData([]);
      
      const nextViewStates = { ...symbolViewStates };
      delete nextViewStates[symbol];
      setSymbolViewStates(nextViewStates);
    }
  };

  const handleResetView = useCallback(() => {
    if (selectedSymbol) {
      setSymbolViewStates(prev => ({
        ...prev,
        [selectedSymbol]: {
          ...prev[selectedSymbol],
          viewport: undefined
        }
      }));
      addNotification('Chart view reset', 'info');
    }
  }, [selectedSymbol, addNotification]);

  const getStepSeconds = useCallback(() => {
    const chartTf = selectedTimeframe;
    const moveByTf = TIMEFRAMES.find(t => t.id === simMoveBy) || chartTf;
    return moveByTf.seconds;
  }, [selectedTimeframe, simMoveBy]);

  // Limit simulation/replay progression
  useEffect(() => {
    const isPlaying = isReplayMode ? replayIsPlaying : simIsPlaying;
    const isActive = isReplayMode || isSimulating;

    if (!isPlaying || !isActive) {
      if (playbackAnimationRef.current) {
        cancelAnimationFrame(playbackAnimationRef.current);
        playbackAnimationRef.current = null;
      }
      return;
    }

    playbackTimerRef.current = performance.now();

    const tick = () => {
      const now = performance.now();
      const baseTick = 1000;
      const interval = baseTick / Math.max(0.1, simSpeed);
      
      if (now - playbackTimerRef.current >= interval) {
        playbackTimerRef.current = now;
        
        if (isReplayMode && replayTrade) {
          const timeframeSeconds = TIMEFRAMES.find(tf => tf.id === replayTrade.timeframe)?.seconds || 60;
          const maxReplayTime = replayTrade.exitTime + (10 * timeframeSeconds);
          
          setReplayCurrentTime(prev => {
            const current = prev || 0;
            const next = current + getStepSeconds();
            if (next >= maxReplayTime) {
              setReplayIsPlaying(false);
              addNotification('End of replay reached', 'info');
              return current;
            }
            return next;
          });
        } else if (!isReplayMode) {
          setSimCurrentTime(prev => {
            const current = prev || 0;
            const next = current + getStepSeconds();
            
            // Look up active session to check for endTime
            const activeItem = watchlist.find(i => i.id === activeWatchlistItemId);
            if (activeItem) {
              const sessionKey = `${activeItem.symbol}_${activeItem.prefix || '00'}`;
              const session = backtestSessions[sessionKey];
              if (session?.endTime && next > session.endTime) {
                setSimIsPlaying(false);
                addNotification('Session end date reached', 'info');
                return current;
              }
            }
            
            return next;
          });
        }
      }
      playbackAnimationRef.current = requestAnimationFrame(tick);
    };

    playbackAnimationRef.current = requestAnimationFrame(tick);
    return () => {
      if (playbackAnimationRef.current) {
        cancelAnimationFrame(playbackAnimationRef.current);
        playbackAnimationRef.current = null;
      }
    };
  }, [simIsPlaying, replayIsPlaying, isSimulating, isReplayMode, simSpeed, getStepSeconds, replayTrade, addNotification]);

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

  const visibleData = useMemo(() => {
    const session = currentSessionKey ? backtestSessions[currentSessionKey] : null;
    let effectiveTime = isReplayMode ? replayCurrentTime : (simCurrentTime || (session ? session.currentTime : null));
    
    if (!effectiveTime) return historicalData;
    
    // Optimized: Since historicalData is sorted by time, find the cut-off index
    // Using slice is generally faster than filter for already sorted segments.
    let cutoffIndex = -1;
    // We could use binary search here for even better performance on very large arrays, 
    // but for typical backtest sizes (a few thousand), simple findIndex is already efficient.
    for (let i = historicalData.length - 1; i >= 0; i--) {
      if (historicalData[i].time <= effectiveTime) {
        cutoffIndex = i;
        break;
      }
    }

    if (cutoffIndex === -1) return [];
    const filtered = historicalData.slice(0, cutoffIndex + 1);
    
    // BACKTEST SYNC FIX: Ensure the current price and time "ryme" across all timeframes.
    if (filtered.length > 0 && (isSimulating || isReplayMode) && simCurrentPrice !== null) {
      const lastIndex = filtered.length - 1;
      const lastCandle = filtered[lastIndex];
      const timeframeSeconds = selectedTimeframe.seconds;
      
      if (effectiveTime < lastCandle.time + timeframeSeconds) {
        filtered[lastIndex] = {
          ...lastCandle,
          close: simCurrentPrice,
          high: Math.max(lastCandle.high, simCurrentPrice),
          low: Math.min(lastCandle.low, simCurrentPrice)
        };
      }
    }
    
    return filtered;
  }, [historicalData, simCurrentTime, replayCurrentTime, isReplayMode, selectedSymbol, backtestSessions, simCurrentPrice, isSimulating, selectedTimeframe]);

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

  if (isAuthLoading) {
    return (
      <div className="h-screen w-full bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 rounded-full border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) {
    if (showWarehouse) {
      return <DatabasePage onBack={() => setShowWarehouse(false)} />;
    }
    return <LoginPage onWarehouseClick={() => setShowWarehouse(true)} />;
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
          <p className="text-slate-500 text-sm leading-relaxed mb-10 font-medium">
            Your account is currently active on another device. We have paused this session to maintain security protocols.
          </p>
          <button 
            onClick={handleLogout}
            className="w-full bg-red-500 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-600 transition-all shadow-xl shadow-red-500/20 active:scale-95"
          >
            Logout From This Device
          </button>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 bg-slate-50/50 rounded-3xl border border-slate-100 flex flex-col justify-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Asset</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-base sm:text-lg font-black text-slate-900">{showBacktestSetup.symbol}</span>
                      <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100/50 uppercase">
                        DATA FROM {(() => {
                           const asset = POPULAR_SYMBOLS.find(s => s.symbol === showBacktestSetup.symbol);
                           if (asset?.category === 'Crypto' && asset.marketStart) {
                             return new Date(asset.marketStart).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
                           }
                           return 'AUG 2015';
                        })()}
                      </span>
                    </div>
                  </div>
                  <div className="p-5 bg-indigo-50/30 rounded-3xl border border-indigo-100/50 flex flex-col justify-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Provider</span>
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none">
                      {showBacktestSetup.source || (POPULAR_SYMBOLS.find(s => s.symbol === showBacktestSetup.symbol)?.category === 'Crypto' ? 'Binance' : 'TwelveData')}
                    </span>
                  </div>
                </div>

                {/* Market Type Selection for Crypto */}
                {(POPULAR_SYMBOLS.find(s => s.symbol === showBacktestSetup.symbol)?.category === 'Crypto' || showBacktestSetup.source !== 'twelvedata') && (
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
                  <div className="space-y-4">
                    <div className="flex flex-col px-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Start Date</span>
                      <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tight mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
                        Earliest: {(() => {
                           const asset = POPULAR_SYMBOLS.find(s => s.symbol === showBacktestSetup.symbol);
                           if (asset?.category === 'Crypto' && asset.marketStart) {
                             return new Date(asset.marketStart).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
                           }
                           return '01 Aug 2015';
                        })()}
                      </span>
                    </div>
                    <div className="relative group">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={14} />
                      <input 
                        type="date"
                        id="backtest-start-date"
                        min={(() => {
                           const asset = POPULAR_SYMBOLS.find(s => s.symbol === showBacktestSetup.symbol);
                           if (asset?.category === 'Crypto' && asset.marketStart) return asset.marketStart;
                           return '2015-08-01';
                        })()}
                        max={new Date().toISOString().split('T')[0]}
                        defaultValue="2024-01-01"
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-10 pr-2 text-[10px] font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-600/5 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-col px-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">End Date</span>
                      <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tight mt-1">Latest: Today</span>
                    </div>
                    <div className="relative group">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={14} />
                      <input 
                        type="date"
                        id="backtest-end-date"
                        min={(() => {
                           const asset = POPULAR_SYMBOLS.find(s => s.symbol === showBacktestSetup.symbol);
                           if (asset?.category === 'Crypto' && asset.marketStart) return asset.marketStart;
                           return '2015-08-01';
                        })()}
                        max={new Date().toISOString().split('T')[0]}
                        defaultValue={new Date().toISOString().split('T')[0]}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-10 pr-2 text-[10px] font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-600/5 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 pt-4">
                  <button
                    onClick={() => {
                      const dateInput = document.getElementById('backtest-start-date') as HTMLInputElement;
                      const endDateInput = document.getElementById('backtest-end-date') as HTMLInputElement;
                      
                      if (dateInput.value) {
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
          <header className={`border-b border-slate-100 flex items-center justify-between px-6 bg-white shrink-0 ${isMobileLandscape ? 'h-10' : 'h-14'}`}>
            <div className="flex items-center gap-2">
              <span className="font-black text-base tracking-tighter text-slate-900">FirstLook</span>
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={() => setActiveTab('profile')}
                className="group flex items-center gap-1.5 px-2 py-1.5 hover:bg-slate-50 rounded-lg transition-all text-slate-400 hover:text-slate-900"
                title="Profile & Analysis"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm">
                  <User size={16} />
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
              />
            ) : (
              <MemoizedWatchlistPage 
                userId={session.user?.id} 
                onSelectSymbol={handleSelectSymbol}
                onDeleteItem={handleDeleteWatchlistItem}
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
              />
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Top Left Navigation - Mobile Only (Portrait only) */}
          {isMobile && isPortrait && (
            <div className="absolute top-4 left-4 z-50 flex items-center gap-1.5">
              {!isReplayMode ? (
                <>
                  <button 
                    onClick={() => setIsMenuOpen(true)}
                    className="p-1.5 bg-white hover:bg-slate-50 border border-slate-100 rounded-lg shadow-lg transition-all active:scale-95 text-slate-400 hover:text-slate-900"
                    title="Details"
                  >
                    <Info size={15} />
                  </button>
                  <button 
                    onClick={() => setSelectedSymbol(null)}
                    className="p-1.5 bg-white hover:bg-slate-50 border border-slate-100 rounded-lg shadow-lg transition-all active:scale-95 text-slate-400 hover:text-slate-900"
                    title="Watchlist"
                  >
                    <List size={15} />
                  </button>
                  <button 
                    id="setup-button-mobile"
                    onClick={() => setIsSetupModalOpen(true)}
                    className="p-1.5 bg-white hover:bg-slate-50 border border-slate-100 rounded-lg shadow-lg transition-all active:scale-95 text-slate-400 hover:text-slate-900"
                    title="Setup"
                  >
                    <LayoutGrid size={15} />
                  </button>
                </>
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
            {(!isMobile || isMobileLandscape) && (
              (!isSimulating && !isReplayMode) ? (
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
              simMoveBy={simMoveBy}
              setSimMoveBy={setSimMoveBy}
              selectedTimeframe={selectedTimeframe}
              isSpeedOpen={isSpeedOpen}
              setIsSpeedOpen={setIsSpeedOpen}
              isStepByOpen={isStepByOpen}
              setIsStepByOpen={setIsStepByOpen}
              speedRef={speedRef}
              stepByRef={stepByRef}
              activeSimControlsPos={activeSimControlsPos}
              updateSimControlsPosWithClamp={updateSimControlsPosWithClamp}
              workspaceRef={workspaceRef}
              currentMode={currentMode}
              watchlist={watchlist}
              activeWatchlistItemId={activeWatchlistItemId}
              backtestSessions={backtestSessions}
              addNotification={addNotification}
            />
              ))}
            </AnimatePresence>

      {/* Top Right Symbol & Price Details + Reset Icon */}
      {selectedSymbol && (
        <div className={`absolute top-2 right-4 md:right-8 z-40 flex items-center gap-4 select-none transition-all duration-300 ${isMobileLandscape ? 'opacity-40' : 'opacity-100'}`}>
          <button 
            onClick={handleResetView}
            className="p-1.5 hover:bg-slate-50 text-slate-300 hover:text-slate-900 rounded-lg transition-all active:scale-95"
            title="Reset View"
          >
            <RefreshCcw size={18} />
          </button>

          <div className="flex flex-col items-end opacity-80 pointer-events-none">
            <div className="flex items-center gap-1.5 leading-none">
              <img 
                src={`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/${selectedSymbol?.split('/')[0].toLowerCase() || 'btc'}.png`} 
                className="w-3 h-3 grayscale contrast-125" 
                onError={(e) => (e.currentTarget.style.display = 'none')}
                referrerPolicy="no-referrer"
              />
              <span className="text-[9px] font-black tracking-tight text-slate-500 uppercase">{selectedSymbol}</span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-900 tracking-tighter mt-0.5">
              {(isSimulating || isReplayMode) && simCurrentPrice !== null
                ? simCurrentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : (historicalData[historicalData.length-1]?.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '---')
              }
            </span>
          </div>
        </div>
      )}

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
              <>
                <button 
                  onClick={() => setIsMenuOpen(true)}
                  className={`flex items-center justify-center transition-all duration-300 ${isMobileLandscape ? 'w-[8.5vh] h-[8.5vh] rounded-[1.5vh]' : 'w-16 h-16 md:w-20 md:h-20 rounded-[2.5vh]'} ${isMenuOpen ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}
                  title="Details"
                >
                  <Info size={isMobileLandscape ? '4vh' : isMobile ? 28 : 32} strokeWidth={2.5} />
                </button>
                <button 
                  onClick={() => setSelectedSymbol(null)}
                  className={`flex items-center justify-center transition-all duration-300 ${isMobileLandscape ? 'w-[8.5vh] h-[8.5vh] rounded-[1.5vh]' : 'w-16 h-16 md:w-20 md:h-20 rounded-[2.5vh]'} ${!selectedSymbol ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}
                  title="Watchlist"
                >
                  <List size={isMobileLandscape ? '4vh' : isMobile ? 28 : 32} strokeWidth={2.5} />
                </button>
                <button 
                  id="setup-button-desktop"
                  onClick={() => setIsSetupModalOpen(true)}
                  className={`flex items-center justify-center transition-all duration-300 ${isMobileLandscape ? 'w-[8.5vh] h-[8.5vh] rounded-[1.5vh]' : 'w-16 h-16 md:w-20 md:h-20 rounded-[2.5vh]'} ${isSetupModalOpen ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}
                  title="Setup"
                >
                  <LayoutGrid size={isMobileLandscape ? '4vh' : isMobile ? 28 : 32} strokeWidth={2.5} />
                </button>
                <div className={`${isMobileLandscape ? 'w-[4vh] h-[1.5px]' : 'w-10 h-px'} bg-slate-100 my-1 self-center opacity-60`}></div>
              </>
            )}

            <div className="relative" ref={timeframeRef}>
          <button 
            onClick={() => setIsTimeframeOpen(!isTimeframeOpen)}
            className={`${isMobileLandscape ? 'w-[10vh] h-[10vh]' : isMobile ? 'w-8 h-8' : 'md:w-20 md:h-20'} flex flex-col items-center justify-center rounded-[2vh] transition-all duration-300 ${isTimeframeOpen ? 'bg-slate-900 text-white shadow-xl shadow-black/20' : 'hover:bg-slate-50 text-slate-400 hover:text-slate-900'}`}
          >
            <span className={`${isMobileLandscape ? 'text-[2.8vh]' : isMobile ? 'text-[8px]' : 'text-[15px]'} font-black tracking-tighter leading-none`}>{selectedTimeframe.label}</span>
            <ChevronDown size={isMobileLandscape ? 12 : isMobile ? 6 : 14} md:size={14} strokeWidth={4} className={`mt-0.5 transition-transform duration-300 ${isTimeframeOpen ? 'rotate-180' : 'opacity-40'}`} />
          </button>

          
          <AnimatePresence>
            {isTimeframeOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={`absolute ${isMobileLandscape || isMobile ? 'left-1/2 -translate-x-1/2' : 'left-full translate-x-0'} ${isMobileLandscape ? 'left-full ml-1 md:ml-2 translate-x-0 top-0 bottom-auto' : isMobile ? 'bottom-full mb-1' : 'md:left-full md:translate-x-0 md:top-0 bottom-auto md:ml-2'} w-36 md:w-44 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden p-1 z-[60]`}
              >
                <div className="max-h-[160px] md:max-h-[220px] overflow-y-auto scrollbar-hide">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf.id}
                      onClick={() => {
                        handleTimeframeChange(tf);
                        setIsTimeframeOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-[9px] font-bold tracking-normal rounded-xl transition-all ${selectedTimeframe.id === tf.id ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
              <Pencil size={isMobileLandscape ? 24 : isMobile ? 16 : 28} strokeWidth={activeTab === 'drawings' ? 2.5 : 2} />
            </button>

            <button 
              onClick={() => setIsIndicatorsOpen(true)}
              className={`${isMobileLandscape ? 'w-[10vh] h-[10vh]' : isMobile ? 'w-8 h-8' : 'w-10 h-10 md:w-20 md:h-20'} flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-[2vh] transition-all duration-300`}
            >
              <Activity size={isMobileLandscape ? 24 : isMobile ? 16 : 28} strokeWidth={2} />
            </button>
          </>
        )}

        {/* Mobile Simulation Controls (Portrait side toolbar version) */}
        {isMobile && !isMobileLandscape && (isSimulating || isReplayMode) && (
          <>
            <div className="w-px h-5 mx-1 bg-slate-100/60"></div>
            <button 
              onClick={() => isReplayMode ? setReplayIsPlaying(!replayIsPlaying) : setSimIsPlaying(!simIsPlaying)}
              className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl"
            >
              {(isReplayMode ? replayIsPlaying : simIsPlaying) ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            </button>
            <button 
              onClick={() => {
                if (isReplayMode) {
                  setReplayCurrentTime(prev => (prev || 0) + getStepSeconds());
                } else {
                  setSimCurrentTime(prev => {
                    const current = prev || 0;
                    const next = current + getStepSeconds();
                    const activeItem = watchlist.find(i => i.id === activeWatchlistItemId);
                    if (activeItem) {
                      const sessionKey = `${activeItem.symbol}_${activeItem.prefix || '00'}`;
                      const session = backtestSessions[sessionKey];
                      if (session?.endTime && next > session.endTime) {
                        addNotification('End reached', 'warning');
                        return current;
                      }
                    }
                    return next;
                  });
                }
              }}
              className="w-8 h-8 flex items-center justify-center text-slate-400"
            >
              <SkipForward size={14} />
            </button>
            <button 
              onClick={() => {
                const speeds = [0.5, 1, 2, 3, 5, 10];
                const currentIndex = speeds.indexOf(simSpeed);
                setSimSpeed(speeds[(currentIndex + 1) % speeds.length]);
              }}
              className="w-8 h-8 text-[10px] flex items-center justify-center font-black text-slate-900"
              title="Simulation Speed"
            >
              {simSpeed}x
            </button>
            <button 
              onClick={() => {
                const tfs = TIMEFRAMES;
                const currentId = isReplayMode ? selectedTimeframe.id : (simMoveBy || selectedTimeframe.id);
                const currentIndex = tfs.findIndex(t => t.id === currentId);
                const nextTf = tfs[(currentIndex + 1) % tfs.length];
                if (isReplayMode) {
                   setSelectedTimeframe(nextTf);
                } else {
                   setSimMoveBy(nextTf.id);
                }
              }}
              className="w-8 h-8 text-[8px] flex items-center justify-center font-black text-slate-400 tracking-tighter"
              title="Step By"
            >
              {TIMEFRAMES.find(t => t.id === (isReplayMode ? selectedTimeframe.id : (simMoveBy || selectedTimeframe.id)))?.label}
            </button>
          </>
        )}

        {/* Mobile Play Switch (Only in Portrait) */}
        {isMobile && !isReplayMode && !isMobileLandscape && (
          <>
            <div className={`${isMobileLandscape ? 'w-4 h-px my-0.5 mx-auto' : 'w-px h-5 mx-1'} bg-slate-100/60`}></div>
            <button 
              onClick={() => {
                const nextState = !isSimulating;
                setIsSimulating(nextState);
                if (!nextState) {
                  setSimIsPlaying(false);
                }
              }}
              className={`${isMobileLandscape ? 'w-7 h-7' : 'w-8 h-8'} flex items-center justify-center rounded-xl transition-all duration-300 ${isSimulating ? 'bg-indigo-900 text-white' : 'text-slate-900 hover:bg-blue-50'}`}
            >
              {isSimulating ? <X size={isMobileLandscape ? 12 : 14} /> : <Play size={isMobileLandscape ? 12 : 14} fill="currentColor" strokeWidth={0} />}
            </button>
          </>
        )}

      </motion.div>
    )}
  </AnimatePresence>

      {/* Main Viewport */}
      <main ref={workspaceRef} className="flex-1 flex flex-col relative min-w-0 h-full">
        <div className="flex-1 relative bg-white flex flex-col overflow-hidden">
          <MemoizedChart 
            ref={chartEngineRef}
            data={visibleData} 
            trades={results.trades} 
            symbol={selectedSymbol || ''}
            prefix={activePrefix || undefined}
            isReplay={isReplayMode}
            isSimulating={isSimulating}
            theme={theme} 
            indicators={indicators}
            onLoadMore={loadMorePast}
            isLoadingMore={isLoadingPast}
            drawingTool={activeDrawingTool}
            drawings={(() => {
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

                // Keep other types of drawings (lines, rects, etc)
                return true;
              });
            })()}
            selectedId={selectedDrawing?.id}
            drawingSettings={drawingSettings}
            onDrawingsChange={(newSymbolDrawings) => {
              if (!selectedSymbol) return;
              
              const currentSymbolNorm = normalizeSymbol(selectedSymbol);
              const currentPrefix = activePrefix || null;

              setDrawings(prev => {
                const others = prev.filter(d => {
                  // If we have matching ID, it's the current one, so filter it out to replace
                  if (activeWatchlistItemId && d.watchlistId) return d.watchlistId !== activeWatchlistItemId;
                  
                  // Fallback for legacy
                  const drawingSymbolNorm = normalizeSymbol(d.symbol);
                  const drawingPrefix = d.prefix || null;
                  return !(drawingSymbolNorm === currentSymbolNorm && drawingPrefix === currentPrefix);
                });
                const updated = newSymbolDrawings.map(d => ({
                  ...d,
                  watchlistId: activeWatchlistItemId || undefined
                }));
                return [...others, ...updated];
              });
            }}
            onSelectDrawing={setSelectedDrawing}
            onDrawingComplete={() => setActiveDrawingTool(null)}
            onDrawingSettingsChange={setDrawingSettings}
            pinnedText={pinnedText}
            viewport={selectedSymbol ? symbolViewStates[selectedSymbol]?.viewport : undefined}
            onViewportChange={handleViewportChange}
            timeframe={selectedTimeframe.label}
            onDrawingTrigger={(drawing) => {
              if (isSimulating || (isReplayMode && replayIsPlaying)) {
                // filter only setups that have been initialized with data
                const activeSetupsData = setups.filter(s => (s.confluences && s.confluences.length > 0) || s.image_url);
                
                // Rule 1: if no setup is set at all, use A+ by default
                if (activeSetupsData.length === 0) {
                  addNotification('Standard Execution (A+) Selected', 'info');
                  const updatedDrawing = {
                    ...drawing,
                    settings: {
                      ...drawing.settings,
                      setupGrade: 'A+',
                      confluences: []
                    }
                  };
                  if (chartEngineRef.current) chartEngineRef.current.updateDrawing(updatedDrawing);
                  setDrawings(prev => prev.map(d => d.id === drawing.id ? updatedDrawing : d));
                  return;
                }

                // Rule 2: if only one setup is configured (even if not A+), use it automatically
                if (activeSetupsData.length === 1) {
                  const setup = activeSetupsData[0];
                  addNotification(`Model Detected: ${setup.grade}`, 'info');
                  const updatedDrawing = {
                    ...drawing,
                    settings: {
                      ...drawing.settings,
                      setupGrade: setup.grade,
                      confluences: setup.confluences || []
                    }
                  };
                  if (chartEngineRef.current) chartEngineRef.current.updateDrawing(updatedDrawing);
                  setDrawings(prev => prev.map(d => d.id === drawing.id ? updatedDrawing : d));
                  return;
                }

                // Rule 3: if 2 or more setups exist, show selection popup
                setSimIsPlaying(false);
                setReplayIsPlaying(false);
                setTriggerSetupDrawing(drawing);
              }
            }}
            onTradeClosed={(trade) => {
              if (session?.user?.id && !isReplayMode) {
                // FALLBACK: If engine didn't have setup info yet due to race condition, find it in our current state
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
                  notes
                };
                persistenceService.saveTrade(session.user.id, fullTrade)
                  .then(() => {
                    addNotification(`Position ${trade.status}: Journaled`, 'success');
                    persistenceService.getTrades(session.user.id!).then(setJournalTrades);
                  })
                  .catch(err => {
                    console.error('[JournalTrade] Save failed:', err);
                    addNotification(`Failed to journal trade: ${err.message || 'Unknown error. Check Supabase schema.'}`, 'error');
                  });
              } else if (isReplayMode) {
                addNotification(`Replay Position ${trade.status}: Not journaled (Reply Mode)`, 'info');
              }
            }}
          />

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
          <div className="absolute bottom-6 right-1 z-40 flex flex-col items-end gap-2 px-3">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="text-slate-900 hover:text-black transition-all hover:rotate-45 p-1"
              title="Settings"
            >
              <Settings2 size={16} strokeWidth={2.5} />
            </button>
          </div>

          <AnimatePresence>
            {currentSelectedDrawing && (currentSelectedDrawing.type === DrawingType.LONG_POSITION || currentSelectedDrawing.type === DrawingType.SHORT_POSITION) && (
              (currentSelectedDrawing.status === 'won' || currentSelectedDrawing.status === 'lost') ? (
                <TradeDetailsCard 
                  drawing={currentSelectedDrawing}
                  trade={currentSelectedTrade}
                  onClose={() => setSelectedDrawing(null)}
                  className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[250] w-full max-w-[280px] sm:max-w-[320px] bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden pointer-events-auto mx-4"
                />
              ) : (
                <DrawingSettingsBox 
                  drawing={currentSelectedDrawing}
                  onUpdate={(settings) => updateDrawing(currentSelectedDrawing.id, { settings: { ...currentSelectedDrawing.settings, ...settings } })}
                  onDelete={() => deleteDrawing(currentSelectedDrawing.id)}
                  onClose={() => setSelectedDrawing(null)}
                  pos={activeDrawingSettingsPos}
                  onPosChange={updateDrawingSettingsPos}
                />
              )
            )}
            {currentSelectedDrawing && !(currentSelectedDrawing.type === DrawingType.LONG_POSITION || currentSelectedDrawing.type === DrawingType.SHORT_POSITION) && (
              <DrawingSettingsBox 
                drawing={currentSelectedDrawing}
                onUpdate={(settings) => updateDrawing(currentSelectedDrawing.id, { settings: { ...currentSelectedDrawing.settings, ...settings } })}
                onDelete={() => deleteDrawing(currentSelectedDrawing.id)}
                onClose={() => setSelectedDrawing(null)}
                pos={activeDrawingSettingsPos}
                onPosChange={updateDrawingSettingsPos}
              />
            )}
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

          {showFavoritesByMode[currentMode] && (
            <FavoriteDrawingsToolbar 
              key={`favorites-toolbar-${currentMode}`}
              favorites={favorites}
              activeTool={activeDrawingTool}
              onSelectTool={setActiveDrawingTool}
              pos={activeFavoritesPos}
              onPosChange={updateFavoritesPosWithClamp}
              isMobileLandscape={isMobileLandscape}
              isMobile={isMobile}
              constraintsRef={workspaceRef}
            />
          )}
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
                      const currentSessionKey = activePrefix ? `${selectedSymbol}_${activePrefix}` : (selectedSymbol || '');
                      const session = backtestSessions[currentSessionKey];
                      
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
                                      simulatedTime={simCurrentTime || (selectedSymbol && (backtestSessions[`${selectedSymbol}_${activePrefix}`]?.currentTime || backtestSessions[selectedSymbol || '']?.currentTime)) || undefined}
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
                                                setPreReplayDrawings([...drawings]);
                                                setReplayTrade(trade);
                                                setReplayCurrentTime(trade.entryTime);
                                                setIsReplayMode(true);
                                                setReplayIsPlaying(false);
                                                const tf = TIMEFRAMES.find(t => t.id === trade.timeframe);
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
      />

      <SetupModal 
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        pinnedText={pinnedText}
        onPinChange={setPinnedText}
        userId={session?.user?.id}
        onSave={fetchUserSetups}
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
                        }}
                        className={`w-9 h-5 rounded-full transition-all relative ${theme.showGrid ? 'bg-slate-900' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${theme.showGrid ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-slate-200 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-800 uppercase">Favorites Bar</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">Floating shortcut menu</span>
                      </div>
                      <button 
                        onClick={() => setShowFavorites(!showFavorites)}
                        className={`w-9 h-5 rounded-full transition-all relative ${showFavorites ? 'bg-slate-900' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${showFavorites ? 'left-5' : 'left-1'}`} />
                      </button>
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
                      showGrid: true
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
