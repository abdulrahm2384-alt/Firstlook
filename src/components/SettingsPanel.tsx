import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Settings, 
  Layers, 
  Grid, 
  BarChart3, 
  Pencil, 
  Globe, 
  Palette, 
  Sparkles, 
  Newspaper, 
  Activity, 
  Percent, 
  Coins, 
  RefreshCcw, 
  RotateCcw, 
  Sliders, 
  Flame,
  History
} from 'lucide-react';
import { ColorPicker } from './ColorPicker';
import { ChartTheme } from '../types';

interface SettingsPanelProps {
  theme: ChartTheme;
  setTheme: (t: ChartTheme) => void;
  session: any;
  persistenceService: any;
  isMobile: boolean;
  isNewsStreamEnabled: boolean;
  setIsNewsStreamEnabled: (b: boolean) => void;
  showDrawingToolbar: boolean;
  setShowDrawingToolbar: (b: boolean) => void;
  resetFloatPositions: () => void;
  subscriptionPlan: string;
  setIsUpgradeModalOpen: (b: boolean) => void;
  setUpgradeModalFeature: (f: string) => void;
  activeSettingsTab: string;
  setActiveSettingsTab: (tab: any) => void;
  onClose: () => void;
}

const TIMEZONES = [
  { id: 'UTC', label: 'UTC (London)' },
  { id: 'America/New_York', label: 'EST/EDT (New York)' },
  { id: 'Europe/Berlin', label: 'CET/CEST (Frankfurt)' },
  { id: 'Asia/Tokyo', label: 'JST (Tokyo)' },
  { id: 'Asia/Singapore', label: 'SGT (Singapore)' },
  { id: 'Australia/Sydney', label: 'AEST/AEDT (Sydney)' }
];

export function SettingsPanel({
  theme,
  setTheme,
  session,
  persistenceService,
  isMobile,
  isNewsStreamEnabled,
  setIsNewsStreamEnabled,
  showDrawingToolbar,
  setShowDrawingToolbar,
  resetFloatPositions,
  subscriptionPlan,
  setIsUpgradeModalOpen,
  setUpgradeModalFeature,
  activeSettingsTab,
  setActiveSettingsTab,
  onClose
}: SettingsPanelProps) {
  
  const activeTheme = theme;

  const handleSaveTheme = (newTheme: ChartTheme) => {
    setTheme(newTheme);
    if (session?.user) {
      persistenceService.savePreferences(session.user.id, { theme: newTheme });
    }
  };

  return (
    <>
      {isMobile ? (
        /* --- HIGH FIDELITY MOBILE SETTINGS SHEET (iOS STYLE) --- */
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 220 }}
          className="fixed inset-x-0 bottom-0 h-[85vh] bg-slate-50 shadow-[-20px_0_50px_rgba(0,0,0,0.15)] z-[160] rounded-t-[28px] border-t border-slate-200/50 flex flex-col overflow-hidden text-slate-850 select-none font-sans"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200/65 flex items-center justify-between bg-white sticky top-0 z-10 font-sans">
            <span className="text-xs font-black uppercase tracking-[0.15em] text-slate-900">Settings</span>
            <button 
              onClick={onClose} 
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[10px] font-black uppercase tracking-[0.1em] text-slate-705 rounded-full transition-all cursor-pointer"
            >
              Done
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-12 font-sans">
            
            {/* Category: General Env */}
            <div className="space-y-2">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-2">CHART & ENVIRONMENT</span>
              <div className="bg-white rounded-2xl border border-slate-150 shadow-sm divide-y divide-slate-100 overflow-hidden">
                {/* Chart Style Column Row */}
                <div className="p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-slate-950 text-white rounded-lg flex items-center justify-center">
                      <Layers size={13} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-800 uppercase">Chart Style</span>
                      <span className="text-[8px] text-slate-400">Select candle visualization mode</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {[
                      { id: 'candle', label: 'Candles' },
                      { id: 'line', label: 'Line Chart' },
                      { id: 'bar', label: 'Bar Chart' },
                      { id: 'heikin-ashi', label: 'Heikin Ashi' }
                    ].map((item) => {
                      const isActive = (theme.chartType || 'candle') === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            handleSaveTheme({ ...theme, chartType: item.id as any });
                          }}
                          className={`py-2 px-3 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center cursor-pointer ${
                            isActive
                              ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                              : 'bg-slate-50 border-slate-200/70 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Static Grid Row */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-blue-500 text-white rounded-lg flex items-center justify-center">
                      <Grid size={13} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-800 uppercase">Static Grid</span>
                      <span className="text-[8px] text-slate-400">Architectural guidelines</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      handleSaveTheme({...theme, showGrid: !theme.showGrid});
                    }}
                    className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${theme.showGrid ? 'bg-slate-900' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${theme.showGrid ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>

                {/* Volume Bars Row */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-emerald-500 text-white rounded-lg flex items-center justify-center">
                      <BarChart3 size={13} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-800 uppercase">Volume Bars</span>
                      <span className="text-[8px] text-slate-400">Plot trade volume in background</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      handleSaveTheme({...theme, showVolume: theme.showVolume === false ? true : false});
                    }}
                    className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${theme.showVolume !== false ? 'bg-slate-900' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${theme.showVolume !== false ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>

                {/* Draw Toolbar Row */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-indigo-500 text-white rounded-lg flex items-center justify-center">
                      <Pencil size={13} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-800 uppercase">Drawing Sidebar</span>
                      <span className="text-[8px] text-slate-400">Toggle toolbar visibility</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowDrawingToolbar(!showDrawingToolbar)}
                    className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${showDrawingToolbar ? 'bg-slate-900' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${showDrawingToolbar ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>

                {/* Timezone ROW */}
                <div className="p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-sky-500 text-white rounded-lg flex items-center justify-center">
                      <Globe size={13} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-800 uppercase">Timezone</span>
                      <span className="text-[8px] text-slate-400 font-sans">Current active timeframe clock</span>
                    </div>
                  </div>
                  <select 
                    value={theme.timezone || 'UTC'}
                    onChange={(e) => {
                      handleSaveTheme({...theme, timezone: e.target.value});
                    }}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-[9px] font-black uppercase tracking-wider text-slate-700 outline-none cursor-pointer"
                  >
                    {TIMEZONES.map(tz => (
                      <option key={tz.id} value={tz.id}>{tz.label}</option>
                    ))}
                  </select>
                </div>

                {/* Backdrop bg color row */}
                <div className="p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-teal-500 text-white rounded-lg flex items-center justify-center">
                      <Palette size={13} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-800 uppercase">Backdrop Color</span>
                      <span className="text-[8px] text-slate-400 font-mono">{theme.bg}</span>
                    </div>
                  </div>
                  <ColorPicker 
                    color={theme.bg} 
                    onChange={(c) => {
                      handleSaveTheme({...theme, bg: c});
                    }} 
                  />
                </div>
              </div>
            </div>

            {/* Category: Advanced Layout Layouts */}
            <div className="space-y-2">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-2">NOTIFICATIONS & FEED</span>
              <div className="bg-white rounded-2xl border border-slate-150 shadow-sm divide-y divide-slate-100 overflow-hidden">
                
                {/* Watermark */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-purple-500 text-white rounded-lg flex items-center justify-center">
                      <Sparkles size={13} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-800 uppercase">Canvas Watermark</span>
                      <span className="text-[8px] text-slate-400">Show pairs in background</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      handleSaveTheme({...theme, showWatermark: theme.showWatermark === false ? true : false});
                    }}
                    className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${theme.showWatermark !== false ? 'bg-slate-900' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${theme.showWatermark !== false ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>

                {/* News Stream Row */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-red-500 text-white rounded-lg flex items-center justify-center">
                      <Newspaper size={13} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-800 uppercase">Historical News</span>
                      <span className="text-[8px] text-slate-400">High-impact news stream</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsNewsStreamEnabled(!isNewsStreamEnabled)}
                    className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${isNewsStreamEnabled ? 'bg-slate-900' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${isNewsStreamEnabled ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>

                {/* Live Candle Ticking */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-orange-500 text-white rounded-lg flex items-center justify-center">
                      <Activity size={13} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-800 uppercase">Live Ticking</span>
                      <span className="text-[8px] text-slate-400">Animate ticking last candle</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      handleSaveTheme({...theme, tickingEnabled: theme.tickingEnabled === false ? true : false});
                    }}
                    className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${theme.tickingEnabled !== false ? 'bg-slate-900' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${theme.tickingEnabled !== false ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>

                {/* Trade History */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-indigo-500 text-white rounded-lg flex items-center justify-center">
                      <History size={13} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-800 uppercase">Trade History</span>
                      <span className="text-[8px] text-slate-400">Show closed positions on chart</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      handleSaveTheme({...theme, showTradeHistory: theme.showTradeHistory === false ? true : false});
                    }}
                    className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${theme.showTradeHistory !== false ? 'bg-slate-900' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${theme.showTradeHistory !== false ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Category: Candle Style Colors */}
            <div className="space-y-2">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-2 block font-sans">CANDLESTICK VISUALS</span>
              <div className="bg-white rounded-2xl border border-slate-150 p-4 shadow-sm space-y-4">
                {/* Bullish */}
                <div className="space-y-2.5 font-sans">
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 flex items-center gap-1.5 px-0.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Ascending Candles
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                      <span className="text-[8px] font-bold text-slate-400 uppercase text-center block font-sans">Core</span>
                      <ColorPicker color={theme.upColor} onChange={(c) => setTheme({...theme, upColor: c})} />
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                      <span className="text-[8px] font-bold text-slate-400 uppercase text-center block font-sans">Edge</span>
                      <ColorPicker color={theme.upBorder} onChange={(c) => setTheme({...theme, upBorder: c})} />
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                      <span className="text-[8px] font-bold text-slate-400 uppercase text-center block font-sans">Wick</span>
                      <ColorPicker color={theme.upWick} onChange={(c) => setTheme({...theme, upWick: c})} />
                    </div>
                  </div>
                </div>

                {/* Bearish */}
                <div className="space-y-2.5 pt-3 border-t border-slate-100 font-sans">
                  <span className="text-[9px] font-black uppercase tracking-wider text-red-650 flex items-center gap-1.5 px-0.5">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                    Descending Candles
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                      <span className="text-[8px] font-bold text-slate-400 uppercase text-center block font-sans">Core</span>
                      <ColorPicker color={theme.downColor} onChange={(c) => setTheme({...theme, downColor: c})} />
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                      <span className="text-[8px] font-bold text-slate-400 uppercase text-center block font-sans">Edge</span>
                      <ColorPicker color={theme.downBorder} onChange={(c) => setTheme({...theme, downBorder: c})} />
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                      <span className="text-[8px] font-bold text-slate-400 uppercase text-center block font-sans">Wick</span>
                      <ColorPicker color={theme.downWick} onChange={(c) => setTheme({...theme, downWick: c})} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Broker & Commission */}
            <div className="space-y-2 animate-fade-in-up">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-2">BROKER & PRICING</span>
              <div className="bg-white rounded-2xl border border-slate-150 shadow-sm divide-y divide-slate-100 overflow-hidden">
                {/* Commission Row */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-amber-500 text-white rounded-lg flex items-center justify-center">
                      <Percent size={13} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-800 uppercase">Commission Engine</span>
                      <span className="text-[8px] text-slate-400">0.05 fee per trade R:R</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      handleSaveTheme({...theme, commissionEnabled: theme.commissionEnabled === false ? true : false});
                    }}
                    className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${theme.commissionEnabled !== false ? 'bg-slate-900' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${theme.commissionEnabled !== false ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>

                {/* Raw Spread */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-violet-500 text-white rounded-lg flex items-center justify-center">
                      <Coins size={13} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-800 uppercase">Raw Spread (0 Spread)</span>
                      <span className="text-[8px] text-slate-400">Toggle live broker simulated spreads</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      if (subscriptionPlan === 'basic') {
                        setUpgradeModalFeature('spread');
                        setIsUpgradeModalOpen(true);
                        return;
                      }
                      handleSaveTheme({...theme, rawSpread: !theme.rawSpread});
                    }}
                    className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${theme.rawSpread ? 'bg-slate-900' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${theme.rawSpread ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>

                {/* Bid-Ask Colors */}
                <div className="p-4 space-y-3">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block px-0.5">Price Line Styles</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                      <span className="text-[8px] text-slate-400 font-bold uppercase text-center block">Bid Line</span>
                      <ColorPicker color={theme.bidColor || '#2962ff'} onChange={(c) => {
                        handleSaveTheme({...theme, bidColor: c});
                      }} />
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                      <span className="text-[8px] text-slate-400 font-bold uppercase text-center block">Ask Line</span>
                      <ColorPicker color={theme.askColor || '#f23645'} onChange={(c) => {
                        handleSaveTheme({...theme, askColor: c});
                      }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Resets / Factory */}
            <div className="pt-4 space-y-3 font-sans">
              <button 
                onClick={resetFloatPositions}
                className="w-full py-3.5 bg-white border border-slate-200 text-slate-800 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCcw size={12} className="text-blue-500" />
                Reset Toolbar Positions
              </button>
              <button 
                onClick={() => {
                  const defaultTheme: ChartTheme = {
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
                    showWatermark: true,
                    showVolume: true,
                    chartType: 'candle',
                    showTradeHistory: true
                  };
                  handleSaveTheme(defaultTheme);
                }}
                className="w-full py-3.5 bg-red-50 text-red-600 rounded-xl text-[9px] font-black uppercase tracking-wider border border-red-100 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw size={12} className="text-red-500 animate-spin-hover" />
                Factory Settings Reset
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        /* --- HIGH FIDELITY DESKTOP PANEL TABBED SYSTEM (GRID & SPLIT) --- */
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="fixed inset-0 m-auto w-full max-w-[760px] h-[550px] bg-white shadow-[0_32px_96px_-16px_rgba(0,0,0,0.18)] z-[160] rounded-[24px] border border-slate-200/60 flex overflow-hidden text-slate-705 font-sans animate-fade-in"
        >
          {/* Left Drawer Navigation */}
          <div className="w-[200px] bg-slate-50 border-r border-slate-200/50 p-5 flex flex-col justify-between select-none">
            <div className="space-y-5 font-sans">
              {/* Brand */}
              <div className="flex items-center gap-2.5 px-1.5 pb-2 border-b border-slate-200">
                <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-[10px]">FL</div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-900 leading-none font-sans">Settings</span>
                  <span className="text-[7.5px] font-bold uppercase text-slate-400 tracking-wider mt-0.5 font-sans">Control Panel</span>
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex flex-col gap-1 font-sans">
                {[
                  { id: 'canvas', label: 'Chart & Canvas', icon: Grid },
                  { id: 'candles', label: 'Candle Visuals', icon: Flame },
                  { id: 'broker', label: 'Broker & Spreads', icon: Coins },
                  { id: 'layout', label: 'Display Features', icon: Sliders },
                  { id: 'resets', label: 'Defaults & Reset', icon: RotateCcw },
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeSettingsTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSettingsTab(tab.id as any)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider text-left transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/35' 
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                      }`}
                    >
                      <Icon size={12} className={isActive ? 'text-indigo-505 text-indigo-500' : 'text-slate-400'} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Close button in sidebar */}
            <button 
              onClick={onClose}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all select-none shadow-sm active:scale-95 text-center cursor-pointer block"
            >
              Done
            </button>
          </div>

          {/* Right Scrollable Config Panel */}
          <div className="flex-1 overflow-y-auto p-8 bg-white relative font-sans text-slate-805">
            <button 
              onClick={onClose}
              className="absolute top-5 right-5 p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-full text-slate-400 hover:text-slate-800 transition-all cursor-pointer"
            >
              <X size={14} strokeWidth={2.5} />
            </button>

            <AnimatePresence mode="wait">
              {/* TAB content: CANVAS */}
              {activeSettingsTab === 'canvas' && (
                <motion.div
                  key="canvas"
                  initial={{ opacity: 0, x: 5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -5 }}
                  className="space-y-6 animate-fade-in"
                >
                  <div className="border-b border-slate-100 pb-3">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">Chart & Canvas</span>
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider block mt-0.5">Define static layouts & clock timezones</span>
                  </div>

                  {/* Chart styles */}
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 space-y-3">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-wider block">Chart Custom Style</span>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'candle', label: 'Candles' },
                        { id: 'line', label: 'Line' },
                        { id: 'bar', label: 'Bars' },
                        { id: 'heikin-ashi', label: 'Heikin Ashi' }
                      ].map((item) => {
                        const isActive = (theme.chartType || 'candle') === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              handleSaveTheme({ ...theme, chartType: item.id as any });
                            }}
                            className={`py-2 px-1 rounded-lg border text-[8.5px] font-black uppercase tracking-wider text-center transition-all cursor-pointer ${
                              isActive
                                ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                                : 'bg-white border-slate-200 text-slate-505 text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Switches Grid */}
                  <div className="grid grid-cols-2 gap-3 font-sans">
                    <div className="p-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all rounded-xl flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9.5px] font-black text-slate-700 uppercase leading-snug">Static Grid</span>
                        <span className="text-[8px] text-slate-400 font-sans">Architectural grids</span>
                      </div>
                      <button 
                        onClick={() => {
                          handleSaveTheme({...theme, showGrid: !theme.showGrid});
                        }}
                        className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${theme.showGrid ? 'bg-slate-900' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${theme.showGrid ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="p-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all rounded-xl flex items-center justify-between">
                      <div className="flex flex-col font-sans">
                        <span className="text-[9.5px] font-black text-slate-700 uppercase leading-snug font-sans">Volume Bars</span>
                        <span className="text-[8px] text-slate-400 font-sans">Backdrop trade volumes</span>
                      </div>
                      <button 
                        onClick={() => {
                          handleSaveTheme({...theme, showVolume: theme.showVolume === false ? true : false});
                        }}
                        className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${theme.showVolume !== false ? 'bg-slate-900' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${theme.showVolume !== false ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Selector & Backdrop grid */}
                  <div className="grid grid-cols-2 gap-3 font-sans">
                    <div className="p-3.5 bg-slate-50/50 border border-slate-100 rounded-xl space-y-2 font-sans-sans">
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-wider block font-sans">Timezone</span>
                      <select 
                        value={theme.timezone || 'UTC'}
                        onChange={(e) => {
                          handleSaveTheme({...theme, timezone: e.target.value});
                        }}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[9px] font-black uppercase tracking-wider text-slate-600 outline-none cursor-pointer font-sans"
                      >
                        {TIMEZONES.map(tz => (
                          <option key={tz.id} value={tz.id}>{tz.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="p-3.5 bg-slate-50/50 border border-slate-100 rounded-xl space-y-2 font-sans">
                      <div className="flex items-center justify-between font-sans">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-wider block font-sans">Backdrop Color</span>
                        <span className="text-[8px] font-mono text-slate-400 uppercase">{theme.bg}</span>
                      </div>
                      <ColorPicker 
                        color={theme.bg} 
                        onChange={(c) => {
                          handleSaveTheme({...theme, bg: c});
                        }} 
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB content: CANDLES */}
              {activeSettingsTab === 'candles' && (
                <motion.div
                  key="candles font-sans"
                  initial={{ opacity: 0, x: 5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -5 }}
                  className="space-y-6 font-sans animate-fade-in"
                >
                  <div className="border-b border-slate-100 pb-3 font-sans">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block font-sans">Candle Metrics</span>
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider block mt-0.5 font-sans">Customize individual bullish and bearish candle rendering</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 font-sans">
                    {/* Ascending Block */}
                    <div className="p-4 bg-slate-50/50 hover:bg-white rounded-2xl border border-slate-100 hover:border-slate-200 transition-all space-y-3 font-sans">
                      <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100 font-sans">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        Ascending Candles
                      </span>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[8.5px] text-slate-505 text-slate-500 font-bold uppercase">
                          <span>Core Filling</span>
                          <ColorPicker color={theme.upColor} onChange={(c) => setTheme({...theme, upColor: c})} />
                        </div>
                        <div className="flex justify-between items-center text-[8.5px] text-slate-505 text-slate-500 font-bold uppercase">
                          <span>Border Edge</span>
                          <ColorPicker color={theme.upBorder} onChange={(c) => setTheme({...theme, upBorder: c})} />
                        </div>
                        <div className="flex justify-between items-center text-[8.5px] text-slate-505 text-slate-500 font-bold uppercase">
                          <span>Wick String</span>
                          <ColorPicker color={theme.upWick} onChange={(c) => setTheme({...theme, upWick: c})} />
                        </div>
                      </div>
                    </div>

                    {/* Descending Block */}
                    <div className="p-4 bg-slate-50/50 hover:bg-white rounded-2xl border border-slate-100 hover:border-slate-200 transition-all space-y-3 font-sans">
                      <span className="text-[9px] font-black text-red-650 text-red-600 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100 font-sans">
                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                        Descending Candles
                      </span>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[8.5px] text-slate-505 text-slate-500 font-bold uppercase font-sans">
                          <span>Core Filling</span>
                          <ColorPicker color={theme.downColor} onChange={(c) => setTheme({...theme, downColor: c})} />
                        </div>
                        <div className="flex justify-between items-center text-[8.5px] text-slate-550 text-slate-500 font-bold uppercase font-sans">
                          <span>Border Edge</span>
                          <ColorPicker color={theme.downBorder} onChange={(c) => setTheme({...theme, downBorder: c})} />
                        </div>
                        <div className="flex justify-between items-center text-[8.5px] text-slate-550 text-slate-500 font-bold uppercase font-sans">
                          <span>Wick String</span>
                          <ColorPicker color={theme.downWick} onChange={(c) => setTheme({...theme, downWick: c})} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Preview Canvas */}
                  <div className="p-3 bg-slate-50/60 rounded-xl flex items-center justify-center gap-6 text-[9.5px] font-bold text-slate-400 select-none border border-slate-100 font-sans">
                    <span>Preview Model:</span>
                    <div className="flex items-center gap-1">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className="w-0.5 h-2" style={{ backgroundColor: theme.upWick }} />
                        <div className="w-3 h-4 rounded-sm border" style={{ backgroundColor: theme.upColor, borderColor: theme.upBorder }} />
                        <div className="w-0.5 h-2" style={{ backgroundColor: theme.upWick }} />
                      </div>
                      <span className="text-emerald-500 text-[8px] font-bold">ASC</span>
                    </div>
                    <div className="flex items-center gap-1 font-sans">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className="w-0.5 h-2.5" style={{ backgroundColor: theme.downWick }} />
                        <div className="w-3 h-5.5 rounded-sm border" style={{ backgroundColor: theme.downColor, borderColor: theme.downBorder }} />
                        <div className="w-0.5 h-2.5" style={{ backgroundColor: theme.downWick }} />
                      </div>
                      <span className="text-red-500 text-[8px] font-bold">DSC</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB content: BROKER */}
              {activeSettingsTab === 'broker' && (
                <motion.div
                  key="broker font-sans"
                  initial={{ opacity: 0, x: 5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -5 }}
                  className="space-y-6 font-sans animate-fade-in"
                >
                  <div className="border-b border-slate-100 pb-3">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block font-sans">Broker & Spreads</span>
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider block mt-0.5">Control broker pricing models & simulated fees</span>
                  </div>

                  <div className="space-y-3 font-sans">
                    <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-slate-200 transition-colors">
                      <div className="flex flex-col font-sans">
                        <span className="text-[9.5px] font-black text-slate-700 uppercase leading-snug font-sans">Raw Spread (0 Spread)</span>
                        <span className="text-[8.5px] text-slate-400 font-sans">Toggle live broker simulated spreads on/off</span>
                      </div>
                      <button 
                        onClick={() => {
                          if (subscriptionPlan === 'basic') {
                            setUpgradeModalFeature('spread');
                            setIsUpgradeModalOpen(true);
                            return;
                          }
                          handleSaveTheme({...theme, rawSpread: !theme.rawSpread});
                        }}
                        className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${theme.rawSpread ? 'bg-slate-900' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${theme.rawSpread ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-slate-200 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-[9.5px] font-black text-slate-700 uppercase leading-snug">Commission Engine</span>
                        <span className="text-[8.5px] text-slate-400">Apply flat commission penalty R:R fees</span>
                      </div>
                      <button 
                        onClick={() => {
                          handleSaveTheme({...theme, commissionEnabled: theme.commissionEnabled === false ? true : false});
                        }}
                        className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${theme.commissionEnabled !== false ? 'bg-slate-900' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${theme.commissionEnabled !== false ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Bid-Ask Colors */}
                  <div className="p-4 bg-slate-50/30 rounded-2xl border border-slate-100 space-y-3">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-wider block">Real-time Trading Lines</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between font-sans">
                        <span className="text-[8.5px] font-bold text-slate-500 uppercase">Bid Price Line</span>
                        <ColorPicker color={theme.bidColor || '#2962ff'} onChange={(c) => {
                          handleSaveTheme({...theme, bidColor: c});
                        }} />
                      </div>

                      <div className="p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between font-sans">
                        <span className="text-[8.5px] font-bold text-slate-500 uppercase">Ask Price Line</span>
                        <ColorPicker color={theme.askColor || '#f23645'} onChange={(c) => {
                          handleSaveTheme({...theme, askColor: c});
                        }} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB content: LAYOUT */}
              {activeSettingsTab === 'layout' && (
                <motion.div
                  key="layout"
                  initial={{ opacity: 0, x: 5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -5 }}
                  className="space-y-6 animate-fade-in font-sans"
                >
                  <div className="border-b border-slate-100 pb-3">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block font-sans">Display Features</span>
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider block mt-0.5 font-sans">Toggle advanced overlays, stream modules & toolbars</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 w-full">
                    {/* Canvas Watermark */}
                    <div className="p-3.5 bg-slate-50/50 border border-slate-100 rounded-xl flex items-center justify-between font-sans">
                      <div className="flex flex-col font-sans">
                        <span className="text-[9.5px] font-black text-slate-700 uppercase">Canvas Watermark</span>
                        <span className="text-[8px] text-slate-400 font-sans">Show pair backdrop</span>
                      </div>
                      <button 
                        onClick={() => {
                          handleSaveTheme({...theme, showWatermark: theme.showWatermark === false ? true : false});
                        }}
                        className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${theme.showWatermark !== false ? 'bg-slate-900' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${theme.showWatermark !== false ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>

                    {/* Historical News Stream */}
                    <div className="p-3.5 bg-slate-50/50 border border-slate-100 rounded-xl flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9.5px] font-black text-slate-700 uppercase">Historical News</span>
                        <span className="text-[8px] text-slate-400">Plot global news on feed</span>
                      </div>
                      <button 
                        onClick={() => setIsNewsStreamEnabled(!isNewsStreamEnabled)}
                        className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${isNewsStreamEnabled ? 'bg-slate-900' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${isNewsStreamEnabled ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>

                    {/* Live Candle Ticking */}
                    <div className="p-3.5 bg-slate-50/50 border border-slate-100 rounded-xl flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9.5px] font-black text-slate-700 uppercase">Candle Ticking</span>
                        <span className="text-[8px] text-slate-400">Animate live ticker</span>
                      </div>
                      <button 
                        onClick={() => {
                          handleSaveTheme({...theme, tickingEnabled: theme.tickingEnabled === false ? true : false});
                        }}
                        className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${theme.tickingEnabled !== false ? 'bg-slate-900' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${theme.tickingEnabled !== false ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>

                    {/* Drawing Toolbar */}
                    <div className="p-3.5 bg-slate-50/50 border border-slate-100 rounded-xl flex items-center justify-between">
                      <div className="flex flex-col font-sans">
                        <span className="text-[9.5px] font-black text-slate-700 uppercase font-sans">Drawing Sidebar</span>
                        <span className="text-[8px] text-slate-404">Plot custom indicators</span>
                      </div>
                      <button 
                        onClick={() => setShowDrawingToolbar(!showDrawingToolbar)}
                        className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${showDrawingToolbar ? 'bg-slate-900' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${showDrawingToolbar ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>

                    {/* Trade History */}
                    <div className="p-3.5 bg-slate-50/50 border border-slate-100 rounded-xl flex items-center justify-between">
                      <div className="flex flex-col font-sans">
                        <span className="text-[9.5px] font-black text-slate-700 uppercase">Trade History</span>
                        <span className="text-[8px] text-slate-400">Show closed positions on chart</span>
                      </div>
                      <button 
                        onClick={() => {
                          handleSaveTheme({...theme, showTradeHistory: theme.showTradeHistory === false ? true : false});
                        }}
                        className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${theme.showTradeHistory !== false ? 'bg-slate-900' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${theme.showTradeHistory !== false ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB content: RESETS */}
              {activeSettingsTab === 'resets' && (
                <motion.div
                  key="resets font-sans"
                  initial={{ opacity: 0, x: 5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -5 }}
                  className="space-y-6 flex flex-col justify-between font-sans animate-fade-in"
                >
                  <div className="space-y-6">
                    <div className="border-b border-slate-100 pb-3">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">Defaults & Reset</span>
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider block mt-0.5">Restore application config, layouts and window sizes</span>
                    </div>

                    <div className="space-y-4 pt-2 font-sans">
                      <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-between gap-5 transition-all">
                        <div className="flex flex-col">
                          <span className="text-[9.5px] font-black text-slate-800 uppercase leading-none font-sans">Floating Sub-panels</span>
                          <span className="text-[8.5px] text-slate-400 mt-1">Re-align floating toolboxes and quick order boxes to default anchor coordinates</span>
                        </div>
                        <button 
                          onClick={resetFloatPositions}
                          className="px-4 py-2 bg-white border border-slate-200 text-slate-800 hover:bg-slate-50/60 hover:border-slate-350 transition-all rounded-xl text-[8px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <RefreshCcw size={10} className="text-blue-500" />
                          Reset Coordinates
                        </button>
                      </div>

                      <div className="p-4 bg-red-50/30 border border-red-100/40 rounded-2xl flex items-center justify-between gap-5 transition-all">
                        <div className="flex flex-col font-sans">
                          <span className="text-[9.5px] font-black text-red-700 uppercase leading-none font-sans">Factory Settings Rebuild</span>
                          <span className="text-[8.5px] text-red-400 mt-1 font-sans">Surgical wipe of aesthetic profiles, color palettes, grids, and customized themes</span>
                        </div>
                        <button 
                          onClick={() => {
                            const defaultTheme: ChartTheme = {
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
                              showWatermark: true,
                              showVolume: true,
                              chartType: 'candle',
                              showTradeHistory: true
                            };
                            handleSaveTheme(defaultTheme);
                          }}
                          className="px-4 py-2 bg-red-50 border border-red-100 text-red-650 hover:bg-red-100 transition-all rounded-xl text-[8px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer shrink-0 animate-spin-hover animate-pulse"
                        >
                          <RotateCcw size={10} className="text-red-500" />
                          Factory Reset
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </>
  );
}
