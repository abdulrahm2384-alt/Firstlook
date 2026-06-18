import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  X, 
  ChevronRight,
  Globe,
  Coins,
  BarChart2,
  LineChart,
  Search,
  MoreVertical,
  CheckCircle2,
  Clock,
  ExternalLink,
  Calendar,
  Info,
  Shield,
  Layers,
  Database,
  AlertCircle,
  AlertTriangle,
  GripVertical,
  Server,
  TrendingUp,
  Trophy,
  LifeBuoy,
  MessageSquare,
  MessageCircle,
  Send,
  User,
  Sparkles,
  Smartphone,
  PlusSquare,
  Share,
  Download,
  Loader2
} from 'lucide-react';
import React, { useState, useEffect, useRef, useMemo, memo, useCallback, useDeferredValue } from 'react';
import { BacktestSession, MarketSymbol, MarketType, JournalTrade } from '../types';
import { WatchlistItem, MarketDataSource } from '../types/watchlist';
import { POPULAR_SYMBOLS } from '../constants/symbols';
import { normalizeSymbol } from '../lib/marketUtils';
import { validateSymbolSupport } from '../services/marketDataService';

interface WatchlistItemRowProps {
  item: WatchlistItem;
  session: BacktestSession | undefined;
  onSelect: (symbol: string, prefix?: string, id?: string) => void;
  onToggleStatus: (symbol: string, prefix?: string) => void;
  onDelete: (symbol: string, prefix?: string, id?: string) => void;
  onEditNotes: (item: WatchlistItem) => void;
  onExtend: (item: WatchlistItem) => void;
  isMenuOpen: boolean;
  onToggleMenu: (id: string | null) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  setups: any[];
  journalTrades?: JournalTrade[];
}

const WatchlistItemRow = memo(({ 
  item, 
  session, 
  onSelect, 
  onToggleStatus, 
  onDelete, 
  onEditNotes,
  onExtend,
  isMenuOpen,
  onToggleMenu,
  menuRef,
  setups,
  journalTrades
}: WatchlistItemRowProps) => {
  const sessionKey = item.prefix ? `${item.symbol}_${item.prefix}` : item.symbol;
  const dragControls = useDragControls();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const pointerDownEventRef = useRef<React.PointerEvent | null>(null);
  const startCoordsRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<any>(null);
  const isDraggingRef = useRef<boolean>(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only trigger with left click/primary contact
    pointerDownEventRef.current = e;
    startCoordsRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      if (pointerDownEventRef.current) {
        isDraggingRef.current = true;
        dragControls.start(pointerDownEventRef.current);
      }
    }, 450); // 450ms long-press duration
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startCoordsRef.current) return;
    const dx = e.clientX - startCoordsRef.current.x;
    const dy = e.clientY - startCoordsRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // If moved more than 8px, cancel long-press so user is scrolling normally
    if (distance > 8) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  };

  const handlePointerUpOrLeave = (e: React.PointerEvent, isClickZone: boolean = false) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (!isDraggingRef.current && isClickZone && startCoordsRef.current) {
      onSelect(item.symbol, item.prefix, item.id);
    }

    pointerDownEventRef.current = null;
    startCoordsRef.current = null;
    isDraggingRef.current = false;
  };

  const setup = useMemo(() => {
    const itemSymbolNorm = normalizeSymbol(item.symbol);
    return setups.find(s => normalizeSymbol(s.symbol) === itemSymbolNorm);
  }, [item.symbol, setups]);

  const trades = useMemo(() => {
    return (journalTrades || []).filter(t => {
      if (t.watchlistId) return t.watchlistId === item.id;
      return t.symbol === item.symbol && (t.prefix || '') === (item.prefix || '');
    });
  }, [journalTrades, item.id, item.symbol, item.prefix]);

  const stats = useMemo(() => {
    const total = trades.length;
    const wins = trades.filter(t => t.status === 'TP').length;
    const losses = trades.filter(t => t.status === 'SL').length;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    const totalRR = trades.reduce((sum, t) => sum + (isFinite(t.rr) ? t.rr : 0), 0);
    const totalPips = trades.reduce((sum, t) => sum + (t.pips || 0), 0);
    return { total, wins, losses, winRate, totalRR, totalPips };
  }, [trades]);

  const progress = useMemo(() => {
    // 1. Resolve start time (in seconds)
    const start = item.start_time || session?.startTime || 0;
    
    // 2. Resolve end time (in seconds)
    const end = item.end_time || session?.endTime || 0;
    
    // 3. Resolve current playhead time (in seconds)
    const cur = session?.currentTime || item.last_play_candle_time || start;
    
    // 4. Status indicator for completion
    const isSessionDone = session?.isCompleted || item.status === 'completed' || (end > 0 && cur >= end);

    // 5. Calculate percentage (0 to 100)
    let p = 0;
    if (isSessionDone) {
      p = 100;
    } else if (end > start && start > 0) {
      p = Math.min(100, Math.max(0, ((cur - start) / (end - start)) * 100));
    }
    
    const label = p > 0 && p < 0.01 ? ">0.01%" : `${p.toFixed(2)}%`;
    return {
      percent: `${p}%`,
      fraction: p,
      label
    };
  }, [
    session?.currentTime, 
    session?.startTime, 
    session?.endTime, 
    session?.isCompleted, 
    item.start_time, 
    item.last_play_candle_time, 
    item.end_time, 
    item.status
  ]);

  return (
    <Reorder.Item 
      key={item.id}
      value={item}
      dragListener={false}
      dragControls={dragControls}
      className={`relative will-change-transform transform-gpu ${isMenuOpen ? '!z-[9999]' : (isExpanded ? 'z-[50]' : 'z-10')}`}
      style={{ zIndex: isMenuOpen ? 9999 : (isExpanded ? 50 : 10) }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <div className={`bg-white border-b border-slate-100 hover:bg-slate-50/20 transition-all duration-200 flex flex-col relative shadow-[0_1px_3px_rgba(0,0,0,0.02)] ${isMenuOpen ? '!z-[9999]' : (isExpanded ? 'z-[50]' : 'z-10')}`}>
        {/* MOBILE COMPACT VIEW (hidden on desktop screens md and up) */}
        <div className="flex md:hidden gap-2 px-3 py-3 items-center hover:bg-slate-50/40 active:bg-slate-100/30 transition-all duration-200 justify-between">
          {/* Clickable Area for OnSelect + Press-and-hold Trigger */}
          <div 
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => handlePointerUpOrLeave(e, true)}
            onPointerCancel={(e) => handlePointerUpOrLeave(e, false)}
            onPointerLeave={(e) => handlePointerUpOrLeave(e, false)}
            className="flex-1 min-w-0 flex items-center justify-between cursor-pointer gap-2 select-none touch-none"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                <img 
                  src={`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/${item.symbol.toLowerCase().split('/')[0].replace('usd', '')}.png`} 
                  alt=""
                  loading="lazy"
                  className="w-4.5 h-4.5 object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = "https://cdn-icons-png.flaticon.com/128/2272/2272635.png";
                  }}
                />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-slate-900 text-[10.5px] uppercase tracking-tight truncate flex items-center gap-1">
                  {item.symbol} 
                  {setup && (
                     <span className="px-1 py-0.5 rounded bg-slate-900 text-white text-[6.5px] font-black uppercase leading-none">
                       {setup.grade}
                     </span>
                  )}
                  {item.prefix && (
                    <span className="text-indigo-500 ml-1 opacity-80 text-[10px]">
                       ({item.prefix.length > 8 ? `${item.prefix.substring(0, 7)}...` : item.prefix})
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wider truncate">
                      {item.dataSource || item.name} {((item.category || POPULAR_SYMBOLS.find(s => s.symbol === item.symbol)?.category) === 'Crypto') && item.marketType ? `• ${item.marketType.replace('-', ' ')}` : ''}
                  </span>
                  <span className="text-[8px] font-mono font-black text-indigo-600 bg-indigo-50 border border-indigo-100/40 px-1.5 py-[1px] rounded leading-none animate-pulse">
                    {progress.label}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 pointer-events-none">
              <div className="flex flex-col items-end">
                <span className="text-[5.5px] font-black text-slate-300 uppercase tracking-widest leading-none mb-0.5">Start</span>
                <span className="font-mono font-bold text-[7.5px] tracking-tight text-slate-500 bg-slate-50 px-1 py-0.5 rounded border border-slate-100/50">
                  {session ? new Date(session.startTime * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : '---'}
                </span>
              </div>

              <div className="flex flex-col items-end">
                <span className="text-[5.5px] font-black text-slate-300 uppercase tracking-widest leading-none mb-0.5">End</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono font-bold text-[7.5px] tracking-tight text-slate-500 bg-slate-50 px-1 py-0.5 rounded border border-slate-100/50">
                    {item.end_time ? new Date(item.end_time * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : '---'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Controls Menu */}
          <div className={`flex justify-end items-center ml-1 relative ${isMenuOpen ? '!z-[9999]' : ''}`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleMenu(isMenuOpen ? null : sessionKey);
              }}
              className="p-1 text-slate-300 hover:text-slate-900 hover:bg-slate-100 rounded transition-all toggle-menu-btn"
            >
              <MoreVertical size={13} />
            </button>
            {isMenuOpen && (
              <div 
                ref={menuRef}
                className="absolute right-0 top-full mt-1.5 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-[500] py-1.5 p-1.5 min-w-[125px] flex flex-col gap-1 w-[125px] animate-in fade-in slide-in-from-top-2 duration-150 watchlist-menu-dropdown"
                onClick={e => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(prev => !prev);
                    onToggleMenu(null);
                  }}
                  className="flex items-center gap-2 w-full px-2.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all duration-150 rounded-xl text-left font-bold text-[9.5px] uppercase tracking-wider"
                >
                  <Info size={13} className="shrink-0 text-slate-400" />
                  <span>Details</span>
                </button>
                
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExtend(item);
                    onToggleMenu(null);
                  }}
                  className="flex items-center gap-2 w-full px-2.5 py-2 text-indigo-600 hover:bg-indigo-50/50 hover:text-indigo-850 transition-all duration-150 rounded-xl text-left font-bold text-[9.5px] uppercase tracking-wider border-t border-slate-100/70 pt-2 mt-0.5"
                >
                  <Calendar size={13} className="shrink-0 text-indigo-400" />
                  <span>Extend</span>
                </button>

                {!(item.status === 'completed' || item.hasBeenExtended) && (
                  <button
                    onClick={() => {
                      onDelete(item.symbol, item.prefix, item.id);
                      onToggleMenu(null);
                    }}
                    className="flex items-center gap-2 w-full px-2.5 py-2 text-rose-600 hover:bg-rose-50/60 transition-all duration-150 rounded-xl text-left font-bold text-[9.5px] uppercase tracking-wider border-t border-slate-100/70 pt-2 mt-0.5"
                  >
                    <Trash2 size={13} className="shrink-0 text-rose-400" />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ADVANCED DESKTOP TABLE ROW VIEW (hidden on small/mobile screens) */}
        <div 
          className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 items-center bg-white hover:bg-indigo-50/20 active:bg-indigo-100/10 transition-all duration-200 border-none"
        >
          {/* Column 1: Asset Ticker & Feed details (col-span-4) */}
          <div 
            onClick={() => onSelect(item.symbol, item.prefix, item.id)}
            className="col-span-4 flex items-center gap-3 cursor-pointer select-none"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-150 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
              <img 
                src={`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/${item.symbol.toLowerCase().split('/')[0].replace('usd', '')}.png`} 
                alt=""
                loading="lazy"
                className="w-5 h-5 object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = "https://cdn-icons-png.flaticon.com/128/2272/2272635.png";
                }}
              />
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-slate-900 text-xs uppercase tracking-tight truncate">
                  {item.symbol}
                </span>
                {setup && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[7px] font-black uppercase leading-none">
                    GRADE {setup.grade}
                  </span>
                )}
                {item.prefix && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 text-[8px] font-bold">
                    {item.prefix}
                  </span>
                )}
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-mono font-black uppercase tracking-wider leading-none shrink-0 ${
                  item.isDown ? 'text-rose-600 bg-rose-50 border border-rose-100/50' : 'text-emerald-700 bg-emerald-50 border border-emerald-100/50'
                }`}>
                  {item.change || '0.00%'}
                </span>
              </div>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 flex items-center gap-1.5">
                <span className="px-1 py-0.2 bg-slate-100 rounded text-slate-500 text-[8px] font-black">{item.dataSource || item.name}</span>
                {((item.category || POPULAR_SYMBOLS.find(s => s.symbol === item.symbol)?.category) === 'Crypto') && item.marketType && (
                  <span className="text-slate-400 font-sans">• {item.marketType.replace('-', ' ')}</span>
                )}
              </span>
            </div>
          </div>

          {/* Column 2: Launch / Lifecycle Date (col-span-2) */}
          <div className="col-span-2 flex flex-col font-sans">
            <span className="text-[10px] font-extrabold text-slate-700 leading-normal">
              {session ? new Date(session.startTime * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '---'}
            </span>
            <span className="text-[7.5px] font-black text-slate-350 uppercase tracking-widest leading-none mt-0.5">
              Launch Date
            </span>
          </div>

          {/* Column 3: Backtest Progress & Lifespan Indicator (col-span-3) */}
          <div className="col-span-3 flex items-center gap-3">
            <div className="flex-1 flex flex-col">
              <div className="flex items-baseline justify-between mb-1 flex-wrap gap-1">
                <span className="text-[10px] font-black text-slate-500 font-mono leading-none flex gap-1.5 items-center flex-wrap">
                  <span>
                    {session ? new Date(session.startTime * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '---'}
                    <span className="mx-1 text-slate-300">→</span>
                    {item.end_time ? new Date(item.end_time * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '---'}
                  </span>
                  {item.price && item.price !== 'Loading...' && (
                    <span className="text-[8.5px] font-mono text-slate-400 border border-slate-100 rounded px-1.5 py-[0.5px] bg-slate-50">
                      {item.price}
                    </span>
                  )}
                </span>
                <span className="text-[9px] font-mono font-black uppercase tracking-wider leading-none px-1.5 py-[1px] rounded text-indigo-500 bg-indigo-50 border border-indigo-100 animate-pulse">
                  {progress.label}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/40">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500" 
                  style={{ width: progress.fraction > 0 ? `${Math.min(100, Math.max(3, progress.fraction))}%` : '0%' }} 
                />
              </div>
            </div>
          </div>

          {/* Column 4: Custom Notes & Grade Setup (col-span-2) */}
          <button 
            onClick={() => onEditNotes(item)}
            className="col-span-2 flex flex-col text-left border border-transparent rounded-xl hover:bg-slate-50 hover:border-slate-100 p-1.5 transition-all cursor-pointer group"
          >
            <span className="text-[9.5px] text-slate-600 font-bold block truncate leading-tight w-full">
              {item.description || 'No strategic notes...'}
            </span>
            <span className="text-[7px] font-black text-indigo-500 group-hover:text-indigo-700 uppercase tracking-widest block mt-0.5">
              {item.description ? 'Edit Strategy Notes' : '+ Add Strategic Notes'}
            </span>
          </button>

          {/* Column 5: Desktop Controller Clicks (col-span-1) */}
          <div className={`col-span-1 flex items-center justify-end gap-1.5 shrink-0 relative ${isMenuOpen ? '!z-[9999]' : ''}`}>
            <button
              type="button"
              onClick={() => onSelect(item.symbol, item.prefix, item.id)}
              title="Launch Sandbox Replay Dashboard"
              className="p-1 px-1.5 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 rounded-xl transition-all cursor-pointer"
            >
              <ChevronRight size={15} strokeWidth={3} />
            </button>
            
            <div className={`relative flex items-center ${isMenuOpen ? '!z-[9999]' : ''}`}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMenu(isMenuOpen ? null : sessionKey);
                }}
                title="More Options"
                className="p-1 text-slate-350 hover:text-slate-900 hover:bg-slate-150/40 rounded transition-all cursor-pointer toggle-menu-btn"
              >
                <MoreVertical size={13} />
              </button>
              {isMenuOpen && (
                <div 
                  ref={menuRef}
                  className="absolute right-0 top-full mt-1.5 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-[500] py-1.5 p-1.5 min-w-[125px] flex flex-col gap-1 w-[125px] animate-in fade-in slide-in-from-top-2 duration-150 watchlist-menu-dropdown"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsExpanded(prev => !prev);
                      onToggleMenu(null);
                    }}
                    className="flex items-center gap-2 w-full px-2.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all duration-150 rounded-xl text-left font-bold text-[9.5px] uppercase tracking-wider"
                  >
                    <Info size={13} className="shrink-0 text-slate-400" />
                    <span>Details</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExtend(item);
                      onToggleMenu(null);
                    }}
                    className="flex items-center gap-2 w-full px-2.5 py-2 text-indigo-600 hover:bg-indigo-50/50 hover:text-indigo-850 transition-all duration-150 rounded-xl text-left font-bold text-[9.5px] uppercase tracking-wider border-t border-slate-100/70 pt-2 mt-0.5"
                  >
                    <Calendar size={13} className="shrink-0 text-indigo-400" />
                    <span>Extend</span>
                  </button>

                  {!(item.status === 'completed' || item.hasBeenExtended) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.symbol, item.prefix, item.id);
                        onToggleMenu(null);
                      }}
                      className="flex items-center gap-2 w-full px-2.5 py-2 text-rose-600 hover:bg-rose-50/60 transition-all duration-150 rounded-xl text-left font-bold text-[9.5px] uppercase tracking-wider border-t border-slate-100/70 pt-2 mt-0.5"
                    >
                      <Trash2 size={13} className="shrink-0 text-rose-400" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* EXPANDABLE QUICK DETAILS PANEL */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col gap-3 text-slate-700"
            >
              {/* Dynamic Compact Meta Badges */}
              <div className="flex flex-wrap items-center gap-1.5 text-[8.5px] uppercase font-black text-slate-400">
                <span className="bg-white px-2 py-0.5 rounded border border-slate-100/60 text-slate-600 font-extrabold">{item.category || 'Trading Instrument'}</span>
                <span>•</span>
                <span className="bg-white px-2 py-0.5 rounded border border-slate-100/60 text-slate-600 font-extrabold">{item.dataSource || item.source || 'FirstLook Core'}</span>
                <span>•</span>
                <span className="bg-white px-2 py-0.5 rounded border border-slate-100/60 text-slate-600 font-extrabold">{item.marketType ? item.marketType.replace('-', ' ') : 'Standard CFD'}</span>
                <span>•</span>
                <span className="bg-white px-2 py-0.5 rounded border border-slate-100/60 text-slate-600 font-extrabold">{item.timeSyncSpeed ? `${item.timeSyncSpeed}x speed` : '1x Realtime'}</span>
              </div>

              {/* Grid: Left: Playback timeline, Right: Basic stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white border border-slate-100 rounded-2xl p-3 shadow-xs">
                {/* Lifespan Timeline details */}
                <div className="flex flex-col justify-center">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Historical Playback Frame</span>
                  <div className="flex items-center gap-1.5 mt-1 text-[10px] font-bold text-slate-700 font-mono">
                    <Calendar size={11} className="text-indigo-400 shrink-0" />
                    <span>{session ? new Date(session.startTime * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '---'}</span>
                    <span className="text-slate-300">→</span>
                    <span>{item.end_time ? new Date(item.end_time * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '---'}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[9px]">
                    <span className="text-[8px] font-black text-slate-400 uppercase">Playhead:</span>
                    <span className="font-extrabold font-mono text-indigo-600">
                      {session?.currentTime 
                        ? new Date(session.currentTime * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : (item.last_play_candle_time 
                          ? new Date(item.last_play_candle_time * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : 'Not Initiated')}
                    </span>
                  </div>
                </div>

                {/* Trade Performance Basic Stats */}
                <div className="border-t sm:border-t-0 sm:border-l border-slate-100 pt-2 sm:pt-0 sm:pl-3.5 flex flex-col justify-center">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Sandbox Performance Stats</span>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-1.5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-[7.5px] font-bold text-slate-400 uppercase">Trades:</span>
                      <span className="text-[9.5px] font-black font-mono text-slate-800">{stats.total}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[7.5px] font-bold text-slate-400 uppercase">WinRate:</span>
                      <span className="text-[9.5px] font-black font-mono text-slate-800">
                        {stats.winRate.toFixed(1)}% <span className="text-[7.5px] text-slate-400 font-bold">({stats.wins}/{stats.total})</span>
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[7.5px] font-bold text-slate-400 uppercase">Net PnL:</span>
                      <span className={`text-[9.5px] font-black font-mono ${stats.totalRR >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {stats.totalRR >= 0 ? '+' : ''}{stats.totalRR.toFixed(2)} R
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[7.5px] font-bold text-slate-400 uppercase">Net Pips:</span>
                      <span className={`text-[9.5px] font-black font-mono ${stats.totalPips >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {stats.totalPips >= 0 ? '+' : ''}{stats.totalPips.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Setup/Analysis footer - ultra compact */}
              {setup ? (
                <div className="bg-indigo-50/20 border border-indigo-100/20 rounded-xl p-2 flex items-center justify-between text-[8px] gap-2">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-extrabold text-slate-450 uppercase tracking-wider text-[7px]">Execution Plan:</span>
                    <span className="px-1.5 py-0.2 bg-indigo-600 text-white font-mono text-[8px] font-black rounded uppercase">
                      GRADE {setup.grade}
                    </span>
                  </div>
                  {item.description ? (
                    <span className="text-slate-550 text-[8.5px] font-bold truncate italic max-w-xs block">
                      "{item.description}"
                    </span>
                  ) : (
                    <span className="text-slate-400 text-[8px] italic">No active notes documented. Click edit notes to write.</span>
                  )}
                </div>
              ) : (
                item.description && (
                  <div className="bg-slate-100/30 border border-slate-150/30 rounded-xl p-2 text-[8.5px] text-slate-505 leading-normal italic truncate">
                    <span className="font-extrabold text-slate-405 uppercase tracking-wider text-[7px] mr-1.5 not-italic">Notes:</span>
                    "{item.description}"
                  </div>
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reorder.Item>
  );
}, (prev, next) => {
  return prev.item === next.item && 
         prev.session?.currentTime === next.session?.currentTime && 
         prev.session?.startTime === next.session?.startTime &&
         prev.session?.endTime === next.session?.endTime &&
         prev.session?.isCompleted === next.session?.isCompleted &&
         prev.isMenuOpen === next.isMenuOpen &&
         prev.setups === next.setups &&
         prev.journalTrades === next.journalTrades;
});

const getPreviousWeekFriday = (refDate: Date = new Date()): Date => {
  const day = refDate.getDay();
  const daysToSubtract = [9, 3, 4, 5, 6, 7, 8][day];
  const prevFriday = new Date(refDate.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);
  prevFriday.setHours(23, 59, 59, 999);
  return prevFriday;
};

interface WatchlistPageProps {
  userId?: string;
  onSelectSymbol: (symbol: string, prefix?: string, id?: string, source?: string, marketType?: MarketType) => void;
  onDeleteItem?: (symbol: string, prefix?: string, id?: string) => void;
  onExtendSession?: (id: string, newEndTimeSeconds: number) => void;
  watchlist: WatchlistItem[];
  setWatchlist: React.Dispatch<React.SetStateAction<WatchlistItem[]>>;
  activeTab: 'ongoing' | 'completed';
  setActiveTab: (tab: 'ongoing' | 'completed') => void;
  activeCategory?: MarketSymbol['category'];
  setActiveCategory?: (category: MarketSymbol['category']) => void;
  isLoading: boolean;
  backtestSessions: Record<string, BacktestSession>;
  isMobile?: boolean;
  isMobileLandscape?: boolean;
  setups?: any[];
  subscriptionPlan?: 'basic' | 'plus' | 'premium';
  onLockedFeature?: (feat: 'script' | 'watchlist' | 'replay' | 'sync' | 'competition') => void;
  onNavigateToCompetitions?: () => void;
  journalTrades?: JournalTrade[];
}

const MarketSymbolButton = memo(({ 
  asset, 
  onSelect, 
  onShowSources 
}: { 
  asset: MarketSymbol, 
  onSelect: (asset: MarketSymbol) => void,
  onShowSources: (asset: MarketSymbol) => void
}) => {
  return (
    <button
      key={asset.symbol}
      type="button"
      onClick={asset.comingSoon ? undefined : () => onShowSources(asset)}
      disabled={asset.comingSoon}
      className={`group flex items-center justify-between p-5 rounded-3xl transition-all text-left border border-transparent 
        ${asset.comingSoon 
          ? 'opacity-40 grayscale cursor-not-allowed bg-slate-50' 
          : 'bg-slate-50/50 hover:bg-slate-900 border border-transparent hover:scale-[1.01] active:scale-[0.99]'}`}
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm group-hover:bg-white/10 transition-colors">
            <img 
              src={`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/${asset.symbol.toLowerCase().split('/')[0].replace('usd', '')}.png`} 
              alt=""
              loading="lazy"
              className="w-5 h-5 object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://cdn-icons-png.flaticon.com/128/2272/2272635.png";
              }}
            />
          </div>
          <span className="font-black text-slate-900 group-hover:text-white uppercase tracking-tight text-base">{asset.symbol}</span>
          {asset.comingSoon && (
            <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500 text-[8px] font-black uppercase tracking-widest leading-none">Soon</span>
          )}
        </div>
      </div>
      {!asset.comingSoon && <Plus size={20} className="text-slate-300 group-hover:text-white" />}
    </button>
  );
});

export function WatchlistPage({ 
  userId, 
  onSelectSymbol, 
  onDeleteItem,
  onExtendSession,
  watchlist, 
  setWatchlist, 
  activeTab, 
  setActiveTab, 
  activeCategory: propsActiveCategory,
  setActiveCategory: propsSetActiveCategory,
  isLoading,
  backtestSessions,
  isMobile,
  isMobileLandscape,
  setups = [],
  subscriptionPlan = 'basic',
  onLockedFeature,
  onNavigateToCompetitions,
  journalTrades = []
}: WatchlistPageProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [systemBanner, setSystemBanner] = useState<any>(null);
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(false);
  
  const [extendingItem, setExtendingItem] = useState<WatchlistItem | null>(null);
  const [selectedNewDate, setSelectedNewDate] = useState<string>('');
  const [extendError, setExtendError] = useState<string | null>(null);

  const extendConfig = useMemo(() => {
    if (!extendingItem) return null;
    const currentEndTime = extendingItem.end_time || 0;
    const maxDate = getPreviousWeekFriday();
    
    const formatDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const minSelectableDateObj = new Date((currentEndTime + 86400) * 1000);
    const minSelectableStr = formatDate(minSelectableDateObj);
    const maxSelectableStr = formatDate(maxDate);
    const isPastLimit = currentEndTime >= Math.floor(maxDate.getTime() / 1000);

    return {
      currentEndTime,
      minSelectableStr,
      maxSelectableStr,
      maxDate,
      isPastLimit
    };
  }, [extendingItem]);

  useEffect(() => {
    fetch('/api/system/banner')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Failed to fetch banner');
      })
      .then(data => {
        if (data && data.status === 'success' && data.banner && data.banner.enabled) {
          setSystemBanner(data.banner);
        } else {
          setSystemBanner(null);
        }
      })
      .catch(err => {
        console.error('[WatchlistPage] Error fetching system banner:', err);
        setSystemBanner(null);
      });
  }, []);

  const adsenseClient = (import.meta as any).env?.VITE_ADSENSE_CLIENT || '';
  const adsenseSlot = (import.meta as any).env?.VITE_ADSENSE_SLOT || '';
  const [selectedAssetForSource, setSelectedAssetForSource] = useState<MarketSymbol | null>(null);
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [internalActiveCategory, internalSetActiveCategory] = useState<MarketSymbol['category']>('Crypto');
  const activeCategory = propsActiveCategory || internalActiveCategory;
  const setActiveCategory = propsSetActiveCategory || internalSetActiveCategory;
  
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingDescriptionItem, setEditingDescriptionItem] = useState<WatchlistItem | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [validatingSymbol, setValidatingSymbol] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // --- Premium Support Chat Panel States & Handlers (Real Live API) ---
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [supportMessages, setSupportMessages] = useState<Array<{ sender: 'user' | 'admin', message?: string, text?: string, sentAt?: string, time?: string, read?: boolean }>>(() => {
    try {
      const saved = localStorage.getItem('firstlook_support_messages_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [supportInput, setSupportInput] = useState('');
  const [isLoadingSupport, setIsLoadingSupport] = useState(false);
  const [isSendingSupport, setIsSendingSupport] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync support messages cache to local storage instantly so page is loaded natively
  useEffect(() => {
    if (supportMessages.length > 0) {
      localStorage.setItem('firstlook_support_messages_v1', JSON.stringify(supportMessages));
    }
  }, [supportMessages]);

  // Initialize discussion thread when widget opens, starting with welcome screen or current session thread.
  useEffect(() => {
    if (!isSupportOpen || !userId) return;

    const fetchThreadOnce = async () => {
      // Only set UI loader spinner if we don't have cached conversation messages
      if (supportMessages.length === 0) {
        setIsLoadingSupport(true);
      }
      try {
        const response = await fetch("/api/support/message", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ userId, message: "" }) // blank message fetches thread
        });
        if (response.ok) {
          const data = await response.json();
          if (data.status === "success" && Array.isArray(data.thread)) {
            const mapped = data.thread.map((m: any) => ({
              sender: m.sender as 'user' | 'admin',
              message: m.message || m.text || "",
              sentAt: m.sentAt || m.time || new Date().toISOString(),
              read: true
            }));

            const finalMsgs = [...mapped];
            const hasWelcome = finalMsgs.some(m => m.message && m.message.includes("Welcome to FirstLook Direct Support"));
            if (!hasWelcome && finalMsgs.length > 0) {
              finalMsgs.unshift({
                sender: "admin",
                message: "Welcome to FirstLook Direct Support ⚡\n\nHow can I help you today? Ask questions, get instant guidelines, or submit feedback in the input field below.",
                sentAt: finalMsgs[0].sentAt || new Date().toISOString(),
                read: true
              });
            }
            if (finalMsgs.length > 0) {
              setSupportMessages(finalMsgs);
            } else {
              setSupportMessages([
                {
                  sender: "admin",
                  message: "Welcome to FirstLook Direct Support ⚡\n\nHow can I help you today? Ask questions, get instant guidelines, or submit feedback in the input field below.",
                  sentAt: new Date().toISOString(),
                  read: true
                }
              ]);
            }
          }
        }
      } catch (err) {
        console.warn("[Support Initial Load] Failed to load:", err);
      } finally {
        setIsLoadingSupport(false);
      }
    };

    fetchThreadOnce();
  }, [isSupportOpen, userId]);

  // Poll for external/simulated admin updates periodically if the support widget is open and the user has sent at least one message.
  useEffect(() => {
    if (!isSupportOpen || !userId) return;

    const hasUserSentMessage = supportMessages.some(m => m.sender === 'user');
    if (!hasUserSentMessage) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch("/api/support/message", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ userId, message: "" }) // Blank message fetches latest thread chronologically
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status === "success" && Array.isArray(data.thread)) {
            const mapped = data.thread.map((m: any) => ({
              sender: m.sender as 'user' | 'admin',
              message: m.message || m.text || "",
              sentAt: m.sentAt || m.time || new Date().toISOString(),
              read: true
            }));

            // Sync, prepending welcome if not present
            const finalMsgs = [...mapped];
            const hasWelcome = finalMsgs.some(m => m.message && m.message.includes("Welcome to FirstLook Direct Support"));
            if (!hasWelcome && finalMsgs.length > 0) {
              finalMsgs.unshift({
                sender: "admin",
                message: "Welcome to FirstLook Direct Support ⚡\n\nHow can I help you today? Ask questions, get instant guidelines, or submit feedback in the input field below.",
                sentAt: finalMsgs[0].sentAt || new Date().toISOString(),
                read: true
              });
            }

            if (JSON.stringify(finalMsgs) !== JSON.stringify(supportMessages)) {
              setSupportMessages(finalMsgs);
            }
          }
        }
      } catch (err) {
        console.warn("[Support Polling] Failed to auto-fetch support updates:", err);
      }
    }, 4500); // Poll every 4.5 seconds

    return () => clearInterval(pollInterval);
  }, [isSupportOpen, userId, supportMessages]);

  // Scroll to bottom on updates
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [supportMessages, isLoadingSupport, isSendingSupport]);

  // Handler to dispatch user query securely to our proxy layer
  const handleSendSupportMessage = useCallback(async (textToSend: string, isFaq = false) => {
    if (!textToSend.trim() || !userId) return;

    // Immediately push the user's message locally
    const userMsg = {
      sender: "user" as const,
      message: textToSend.trim(),
      sentAt: new Date().toISOString(),
      read: true,
      isFaq
    };
    setSupportMessages(prev => [...prev, userMsg]);
    setSupportInput('');

    // If it is a predefined FAQ item, handle it 100% locally to prevent server/webhook dispatch
    if (isFaq) {
      setIsSendingSupport(true);
      setSupportError(null);
      
      const query = textToSend.toLowerCase().trim();
      let reply = "I am your FirstLook support assistant. Feel free to ask questions, or click any FAQ button for details!";
      
      if (query.includes('differences between basic') || query.includes('basic plus and premium') || query.includes('difference between basic')) {
        reply = "• Basic (Free): Lifetime core indicator suite, watchlist of up to 3 concurrent active symbols, and standard fixed market spreads with zero history logs.\n\n• Plus ($5.00/mo or $4.20/mo yearly): Customizable raw spreads toggles, unlimited active watchlist items, time-synced playback/loops, historical trade replay speed engine, and high-fidelity competition slots.\n\n• Premium ($20.00/mo or $16.80/mo yearly): Includes all Plus features plus unlimited concurrent competition slots, high-priority streaming tickers, and multi-seat team management with up to 10 invitation slots to share trading metrics live.";
      } else if (query.includes('cancel') || query.includes('payment renewal') || query.includes('modify my active subscription')) {
        reply = "We believe in honest, transparent pricing. If you enabled recurring billing during Paystack checkout, an interactive 'Stop Auto-Renewal' button is displayed directly at the top of the pricing page. Clicking it will stop future billing instantly. Your premium tier privileges will remain 100% active and editable until the final day of your paid cycle, at which point it gracefully downgrades to Basic without lockouts.";
      } else if (query.includes('limit') || query.includes('watchlist item limits') || query.includes('active symbol watchlist')) {
        reply = "We believe in high-focus market tracking. Under the Basic free tier, we limit active concurrent 'Ongoing' symbols in your watchlist to 3 pairs to conserve live server WebSockets. You can archive an infinite number of completed setups and load them anytime! Upgrading to Plus or Premium removes all concurrent symbol constraints, allowing you to track and stream all available forex and cryptocurrency pairs simultaneously.";
      } else if (query.includes('competition slots') || query.includes('simulated competition')) {
        reply = "We designed simulated competitions so you can test your trading setups and build high scores under realistic market pressure. On our Basic plan, competitions are locked to preserve compute power. Upgrading to our Plus tier immediately unlocks all available competition slots for you. If you choose our Premium tier, you unlock totally unlimited concurrent slot entries so you can compete in non-stop, high-stakes testing rounds.";
      } else if (query.includes('broker raw spreads') || query.includes('custom broker') || query.includes('spreads optimize')) {
        reply = "Real life broker feeds include fine spreads that can impact tight Stop-Loss execution. FirstLook streams real-time raw feeds and allows Plus and Premium members to simulate spreads from elite brokers like Pepperstone Razor (at 0.0 pips), Axiory (at 0.1 pips), or IC Markets (at 0.2 pips), or deactivate spreads entirely! Basic users operate on standard, fixed retail spread rates.";
      } else if (query.includes('historical trade replay') || query.includes('replay and speed engine') || query.includes('backtest')) {
        reply = "Our Trade Replay engine allows you to step backward on any chart to execute strategy evaluations with tick completeness. You can fast-forward candles step-by-step with adjustable speeds, open/manage virtual trades, and log backtesting metrics, fully calculated locally in your browser. This custom speed engine is fully enabled on Plus and Premium memberships.";
      } else if (query.includes('install firstlook') || query.includes('native desktop') || query.includes('certified progressive') || query.includes('pwa')) {
        reply = "FirstLook is a certified Progressive Web App (PWA) requiring zero heavy installer binaries. For iOS Safari: tap the 'Share' icon and select 'Add to Home Screen'. For Android Chrome: tap the menu dot and choose 'Install App'. For macOS or Windows Chrome: click the 'Install FirstLook' shortcut inside the browser address bar to run it in a fast, dedicated standalone framing with native optimization.";
      } else if (query.includes('slow charts') || query.includes('minor lag') || query.includes('experience slow')) {
        reply = "Because FirstLook computes million-point streaming charts locally to minimize background data overhead, your browser's index memory cache can occasionally retain excess historic buffers. Simply refreshing your window, restarting your tab, or clicking 'Clear Local Setups' inside your profile setup immediately clears structural cache, instantly restoring rapid, smooth performance.";
      }

      setTimeout(() => {
        setSupportMessages(prev => [
          ...prev,
          {
            sender: "admin" as const,
            message: reply,
            sentAt: new Date().toISOString(),
            read: true
          }
        ]);
        setIsSendingSupport(false);
      }, 650);
      return;
    }

    setIsSendingSupport(true);
    setSupportError(null);
    try {
      const response = await fetch("/api/support/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ userId, message: textToSend, isFaq })
      });

      if (!response.ok) {
        throw new Error("Target integration support API responded with state representing transmission failure");
      }

      const data = await response.json();
      if (data.status === "success" && Array.isArray(data.thread)) {
        const mapped = data.thread.map((m: any) => ({
          sender: m.sender as 'user' | 'admin',
          message: m.message || m.text || "",
          sentAt: m.sentAt || m.time || new Date().toISOString(),
          read: true
        }));

        // Prepends welcome if not present
        const finalMsgs = [...mapped];
        const hasWelcome = finalMsgs.some(m => m.message && m.message.includes("Welcome to FirstLook Direct Support"));
        if (!hasWelcome && finalMsgs.length > 0) {
          finalMsgs.unshift({
            sender: "admin",
            message: "Welcome to FirstLook Direct Support ⚡\n\nHow can I help you today? Ask questions, get instant guidelines, or submit feedback in the input field below.",
            sentAt: finalMsgs[0].sentAt || new Date().toISOString(),
            read: true
          });
        }
        setSupportMessages(finalMsgs);
      } else {
        throw new Error("Invalid thread response formatted payload pattern returned");
      }
    } catch (err: any) {
      console.error("[Watchlist Support UI] Dispatching inquiry message exception detail:", err);
      setSupportError("Unable to send your message right now. Please try again shortly.");
    } finally {
      setIsSendingSupport(false);
    }
  }, [userId]);


  // Partnership / Sponsored Ads logic with sliding carousel
  const [sponsorPool, setSponsorPool] = useState<Array<{
    sponsor: string;
    tagline: string;
    category: string;
    incentive: string;
    cta: string;
    logoType: string;
    link: string;
  }>>([
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
  ]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [isRefreshingAd, setIsRefreshingAd] = useState(false);
  const lastClientFetchRef = useRef<number>(0);

  const fetchSponsorAd = useCallback(async (forceBypass: boolean = false) => {
    const now = Date.now();
    // Front-end fetch cooldown: Do not fetch more than once every 3 minutes, unless forced (e.g. view switch)
    if (!forceBypass && (now - lastClientFetchRef.current < 3 * 60 * 1000)) {
      return;
    }

    setIsRefreshingAd(true);
    try {
      const response = await fetch('/api/sponsor-ad');
      if (response.ok) {
        const ct = response.headers.get('content-type');
        if (!ct || !ct.includes('application/json')) {
          throw new Error(`Expected JSON but received: ${ct || 'none'}`);
        }
        lastClientFetchRef.current = now;
        const data = await response.json();
        if (data && data.sponsor) {
          setSponsorPool((currentPool) => {
            const exists = currentPool.some(item => item.sponsor.toLowerCase() === data.sponsor.toLowerCase());
            if (!exists) {
              return [data, ...currentPool];
            }
            return currentPool;
          });
          // Immediately show the new partner offer
          setCurrentAdIndex(0);
        }
      }
    } catch (err) {
      console.warn('Failed to load partnership offer (serving existing sponsors):', err);
    } finally {
      setIsRefreshingAd(false);
    }
  }, []);

  // Set up periodic slide carousel transition every 5 seconds
  useEffect(() => {
    if (sponsorPool.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % sponsorPool.length);
    }, 5000); // Rotate every 5 seconds
    return () => clearInterval(timer);
  }, [sponsorPool.length]);

  // Track isAddModalOpen transition to detect returning from 'Explore Markets'
  const prevAddModalOpenRef = useRef(isAddModalOpen);
  useEffect(() => {
    if (prevAddModalOpenRef.current && !isAddModalOpen) {
      // User closed the explore/add modal and came back to Watchlist Page!
      // Bypass cooldown to fetch and transition to show fresh sponsor program immediately
      fetchSponsorAd(true);
      if (sponsorPool.length > 0) {
        setCurrentAdIndex((prev) => (prev + 1) % sponsorPool.length);
      }
    }
    prevAddModalOpenRef.current = isAddModalOpen;
  }, [isAddModalOpen, fetchSponsorAd, sponsorPool.length]);

  // Fetch block on page mount with default cooldown check. Simple tab changes should be completely instant & local.
  useEffect(() => {
    fetchSponsorAd(false);
  }, [fetchSponsorAd]);

  // Filter symbols by category and search query
  const filteredSymbols = useMemo(() => {
    const query = deferredSearchQuery.toLowerCase();
    return POPULAR_SYMBOLS.filter(s => {
      const matchesCategory = s.category === activeCategory;
      if (!matchesCategory) return false;
      
      if (!query) return true;
      
      return s.symbol.toLowerCase().includes(query) || 
             s.name.toLowerCase().includes(query);
    });
  }, [activeCategory, deferredSearchQuery]);

  const handleSetSelectedAsset = useCallback(async (asset: MarketSymbol) => {
    setSelectedAssetForSource(asset);
    
    if ((asset.category as string) === 'Crypto') {
      setAvailableSources(['binance', 'bybit', 'okx']);
      setIsLoadingSources(false);
      return;
    }
    
    // Fetch available sources for this symbol
    setIsLoadingSources(true);
    try {
      const response = await fetch(`/api/sources?symbol=${encodeURIComponent(asset.symbol)}`);
      if (response.ok) {
        const ct = response.headers.get('content-type');
        if (!ct || !ct.includes('application/json')) {
          throw new Error(`Expected JSON but received: ${ct || 'none'}`);
        }
        const data = await response.json();
        setAvailableSources(data.sources || []);
      } else {
        setAvailableSources((asset.category as string) === 'Crypto' ? ['binance', 'coinbase'] : ['exness', 'dukascopy', 'axiory', 'fxcm', 'oando']); // Base fallbacks
      }
    } catch (err) {
      console.error('Failed to fetch sources:', err);
      setAvailableSources((asset.category as string) === 'Crypto' ? ['binance', 'coinbase'] : ['exness', 'dukascopy', 'axiory', 'fxcm', 'oando']);
    } finally {
      setIsLoadingSources(false);
    }
  }, []);

  const filteredSources = useMemo(() => {
    if (!selectedAssetForSource) return [];
    
    const isCrypto = (selectedAssetForSource.category as string) === 'Crypto';
    const allPotentialSources = [
      { id: 'binance', name: 'Binance', description: 'World\'s Largest Exchange', recommended: isCrypto ? true : undefined },
      { id: 'okx', name: 'OKX', description: 'Global Crypto Ecosystem', disabled: isCrypto ? true : undefined },
      { id: 'bybit', name: 'Bybit', description: 'Fastest Matching Engine' },
      { id: 'bitflyer', name: 'bitFlyer', description: 'Japan\'s Leading Exchange' },
      { id: 'exness', name: 'Exness', description: 'Global Multi-Asset Broker', recommended: !isCrypto ? true : undefined },
      { id: 'dukascopy', name: 'Dukascopy', description: 'Swiss ECN Forex Provider', poor: true },
      { id: 'fxcm', name: 'FXCM', description: 'Leading FX & CFD Broker', disabled: true },
      { id: 'oando', name: 'Oando', description: 'Global CFD & Forex Broker', disabled: true },
      { id: 'axiory', name: 'Axiory', description: 'Premium Forex Trading', disabled: true }
    ];

    return allPotentialSources.filter(s => {
      if (isCrypto) {
        return ['binance', 'bybit', 'okx'].includes(s.id);
      }
      if (['Forex', 'Metals', 'Indices'].includes(selectedAssetForSource.category as string)) {
        return ['exness', 'dukascopy', 'fxcm', 'oando', 'axiory'].includes(s.id);
      }
      return s.id === 'axiory'; 
    });
  }, [selectedAssetForSource, availableSources]);

  const addToWatchlist = async (asset: MarketSymbol, source: string) => {
    setValidatingSymbol(true);
    setValidationError(null);
    
    try {
      // Just a quick check to see if the source supports the symbol. Skip check for Crypto symbols.
      const isSupported = asset.category === 'Crypto' ? true : await validateSymbolSupport(asset.symbol, source);
      
      if (!isSupported) {
        setValidationError(`${source.toUpperCase()} does not appear to support ${asset.symbol}. Please choose a different source.`);
        setValidatingSymbol(false);
        return;
      }
      
      // Just trigger the selection which will show the setup modal with the selected source
      onSelectSymbol(asset.symbol, undefined, undefined, source);
      setIsAddModalOpen(false);
      setSelectedAssetForSource(null);
      setSearchQuery('');
    } catch (err) {
      console.error('Validation error:', err);
      // If validation fails for network reasons, we might still want to allow trying
      onSelectSymbol(asset.symbol, undefined, undefined, source);
      setIsAddModalOpen(false);
      setSelectedAssetForSource(null);
      setSearchQuery('');
    } finally {
      setValidatingSymbol(false);
    }
  };

  useEffect(() => {
    const listElement = document.getElementById('market-explorer-list');
    if (listElement) listElement.scrollTop = 0;
  }, [activeCategory, deferredSearchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.watchlist-menu-dropdown') || target.closest('.toggle-menu-btn')) {
        return;
      }
      setMenuOpenId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentItems = useMemo(() => {
    return watchlist.filter(item => (item.status || 'ongoing') === activeTab);
  }, [watchlist, activeTab]);

  const handleReorder = (newOrder: WatchlistItem[]) => {
    const otherItems = watchlist.filter(item => (item.status || 'ongoing') !== activeTab);
    setWatchlist([...otherItems, ...newOrder]);
  };

  const toggleStatus = useCallback((symbol: string, prefix?: string) => {
    setWatchlist(prev => prev.map(item => {
      if (item.symbol === symbol && item.prefix === prefix) {
        // Only allowed to move from completed back to ongoing manually
        if (item.status === 'completed') {
          return {
            ...item,
            status: 'ongoing'
          };
        }
      }
      return item;
    }));
    setMenuOpenId(null);
  }, [setWatchlist]);

  const deleteItem = useCallback((symbol: string, prefix?: string, id?: string) => {
    if (onDeleteItem) {
      onDeleteItem(symbol, prefix, id);
    } else {
      setWatchlist(prev => prev.filter(p => p.id !== id));
    }
    setMenuOpenId(null);
  }, [onDeleteItem, setWatchlist]);

  const handleSelect = useCallback((symbol: string, prefix?: string, id?: string) => {
    const item = watchlist.find(i => i.id === id);
    onSelectSymbol(symbol, prefix, id, item?.dataSource, item?.marketType);
  }, [onSelectSymbol, watchlist]);

  const handleEditNotes = useCallback((item: WatchlistItem) => {
    setEditingDescriptionItem(item);
    setEditDescription(item.description || '');
  }, []);

  const handleToggleMenu = useCallback((id: string | null) => {
    setMenuOpenId(id);
  }, []);

  const handleOpenExtendModal = useCallback((item: WatchlistItem) => {
    if (subscriptionPlan === 'basic') {
      onLockedFeature?.('watchlist');
      return;
    }
    setExtendingItem(item);
    setExtendError(null);
    setSelectedNewDate('');
  }, [subscriptionPlan, onLockedFeature]);

  return (
    <div className="flex flex-col h-full bg-white text-slate-900 relative overflow-hidden antialiased">
      {/* System Alert Banner */}
      <AnimatePresence>
        {systemBanner && systemBanner.enabled && !isBannerDismissed && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 25 }}
            className={`w-full shrink-0 border-b overflow-hidden relative ${
              systemBanner.type === 'error' || systemBanner.type === 'danger'
                ? 'bg-gradient-to-r from-red-50/70 to-white border-red-100 text-red-950' 
                : systemBanner.type === 'success'
                  ? 'bg-gradient-to-r from-emerald-50/70 to-white border-emerald-100 text-emerald-950'
                  : systemBanner.type === 'info'
                    ? 'bg-gradient-to-r from-blue-50/70 to-white border-blue-100 text-blue-950'
                    : 'bg-gradient-to-r from-amber-50/70 via-amber-50/30 to-white border-amber-100/80 text-amber-950'
            }`}
          >
            {/* Glow / Accent strip on the left margin */}
            <div className={`absolute top-0 left-0 bottom-0 w-[3px] ${
              systemBanner.type === 'error' || systemBanner.type === 'danger'
                ? 'bg-red-500' 
                : systemBanner.type === 'success'
                  ? 'bg-emerald-500'
                  : systemBanner.type === 'info'
                    ? 'bg-blue-500'
                    : 'bg-amber-500'
            }`} />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Advanced icon with live pulse shell */}
                <div className="relative shrink-0 flex items-center justify-center">
                  <span className={`absolute inline-flex h-6 w-6 rounded-full opacity-15 animate-ping ${
                    systemBanner.type === 'error' || systemBanner.type === 'danger'
                      ? 'bg-red-400' 
                      : systemBanner.type === 'success'
                        ? 'bg-emerald-400'
                        : systemBanner.type === 'info'
                          ? 'bg-blue-400'
                          : 'bg-amber-400'
                  }`} />
                  <div className={`relative flex items-center justify-center h-8 w-8 rounded-xl ${
                    systemBanner.type === 'error' || systemBanner.type === 'danger'
                      ? 'bg-red-100/80 text-red-600' 
                      : systemBanner.type === 'success'
                        ? 'bg-emerald-100/80 text-emerald-600'
                        : systemBanner.type === 'info'
                          ? 'bg-blue-100/80 text-blue-600'
                          : 'bg-amber-100/95 text-amber-600'
                  } border border-white/20 shadow-sm shadow-black/5`}>
                    {systemBanner.type === 'error' || systemBanner.type === 'danger' ? (
                      <AlertCircle size={14} strokeWidth={2.5} />
                    ) : systemBanner.type === 'success' ? (
                      <CheckCircle2 size={14} strokeWidth={2.5} />
                    ) : systemBanner.type === 'info' ? (
                      <Info size={14} strokeWidth={2.5} />
                    ) : (
                      <AlertTriangle size={13} strokeWidth={2.5} />
                    )}
                  </div>
                </div>

                <div className="min-w-0 flex flex-col">
                  {/* Category Pill + Title */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[7.5px] font-black uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-md ${
                      systemBanner.type === 'error' || systemBanner.type === 'danger'
                        ? 'bg-red-200/50 text-red-800' 
                        : systemBanner.type === 'success'
                          ? 'bg-emerald-200/50 text-emerald-800'
                          : systemBanner.type === 'info'
                            ? 'bg-blue-200/50 text-blue-800'
                            : 'bg-amber-200/75 text-amber-800'
                    }`}>
                      {systemBanner.type || 'system'}
                    </span>
                    <h4 className="text-[10px] sm:text-[10.5px] font-bold text-slate-800 tracking-tight truncate">
                      {systemBanner.title}
                    </h4>
                  </div>
                  <p className="text-[9.5px] sm:text-[10px] font-medium text-slate-500 mt-1 leading-normal max-w-3xl">
                    {systemBanner.message}
                  </p>
                </div>
              </div>

              {systemBanner.dismissible && (
                <button 
                  onClick={() => setIsBannerDismissed(true)}
                  className="p-1.5 hover:bg-black/[0.04] active:bg-black/[0.08] rounded-full transition-all shrink-0 border border-transparent hover:border-slate-100 self-center"
                  title="Dismiss alert"
                >
                  <X size={12} strokeWidth={2.5} className="text-slate-400 hover:text-slate-700" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="w-full shrink-0 border-b border-slate-50 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-3 flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">Watchlist</h2>
            <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
              {activeTab === 'completed' ? 'Viewing Completed Trades' : 'Viewing Active Watchlist'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Arena Competitions Button */}
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={onNavigateToCompetitions}
              className="w-7 h-7 bg-slate-50 hover:bg-slate-100 border border-slate-100/80 text-slate-500 hover:text-slate-900 rounded-lg transition-all flex items-center justify-center shadow-xs"
              title="Enter Arenas / Competitions"
            >
              <Trophy size={11} strokeWidth={2.3} className="text-amber-500" />
            </motion.button>

            {/* Toggle Ongoing/Completed Filter Button */}
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setActiveTab(activeTab === 'completed' ? 'ongoing' : 'completed')}
              className={`w-7 h-7 rounded-lg transition-all flex items-center justify-center shadow-xs border ${
                activeTab === 'completed' 
                  ? 'bg-emerald-50 border-emerald-150 text-emerald-600' 
                  : 'bg-slate-50 border-slate-100/80 text-slate-400 hover:text-slate-800'
              }`}
              title={activeTab === 'completed' ? "Filter: Completed" : "Filter: Ongoing"}
            >
              <CheckCircle2 size={11.5} strokeWidth={2.3} />
            </motion.button>

            {/* Add Asset Button */}
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => {
                const ongoingCount = watchlist.filter(item => (item.status || 'ongoing') === 'ongoing').length;
                if (subscriptionPlan === 'basic' && ongoingCount >= 3) {
                  onLockedFeature?.('watchlist');
                } else if (subscriptionPlan === 'plus' && ongoingCount >= 12) {
                  onLockedFeature?.('watchlist');
                } else {
                  setIsAddModalOpen(true);
                }
              }}
              className="w-7 h-7 bg-slate-900 text-white hover:bg-black rounded-lg transition-all flex items-center justify-center shadow-xs"
              title="Add New Trading Pair"
            >
              <Plus size={11.5} strokeWidth={2.3} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 pb-12 overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-2 sm:px-4 md:px-6 py-2.5">


          {isLoading ? (
            <div className="py-1">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div 
                  key={i} 
                  className="flex gap-2.5 px-3.5 py-3.5 items-center border-b border-slate-100/60 rounded-2xl mx-1.5 my-0.5 bg-transparent animate-pulse"
                >
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                    {/* Left Icon + Title/subtitle */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-slate-100/60 border border-slate-100/50 shrink-0" />
                      <div className="flex flex-col min-w-0 gap-1.5">
                        <div className="h-2.5 w-16 bg-slate-200/65 rounded-md" />
                        <div className="h-1.5 w-28 bg-slate-100/75 rounded-md" />
                      </div>
                    </div>

                    {/* Right Columns matching stats exactly */}
                    <div className="flex items-center gap-3.5 md:gap-8 shrink-0">
                      {/* Start Column */}
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="h-1 w-5 bg-slate-100/60 rounded-sm" />
                        <div className="h-2.5 w-10 bg-slate-100/70 rounded border border-slate-100/30" />
                      </div>

                      {/* Progress Column */}
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="h-1 w-8 bg-slate-100/65 rounded-sm" />
                        <div className="flex items-center gap-1.5">
                          <div className="h-2.5 w-7 bg-slate-150 rounded" />
                          <div className="w-8 h-1 bg-slate-100/80 rounded-full hidden sm:block" />
                        </div>
                      </div>

                      {/* Created Column (hidden lg:flex matched) */}
                      <div className="flex flex-col items-end gap-1.5 hidden lg:flex">
                        <div className="h-1 w-8 bg-slate-100/60 rounded-sm" />
                        <div className="h-2.5 w-10 bg-slate-100/75 rounded-sm" />
                      </div>
                    </div>
                  </div>

                  {/* Right settings action dots slot */}
                  <div className="flex justify-end items-center ml-1.5 shrink-0">
                    <div className="w-5 h-5 rounded-full bg-slate-100/70" />
                  </div>
                </div>
              ))}
            </div>
          ) : currentItems.length > 0 ? (
            <div className="space-y-2">
              {/* DESKTOP TABLE COLUMN HEADERS */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-2 pb-1 border-b border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-400 font-mono select-none">
                <div className="col-span-4">Asset Ticker & Feed</div>
                <div className="col-span-2">Sandbox Launch</div>
                <div className="col-span-3 font-medium">Replay Telemetry</div>
                <div className="col-span-2">Playbook Analysis</div>
                <div className="col-span-1 text-right pr-4">Load</div>
              </div>

              <Reorder.Group axis="y" values={currentItems} onReorder={handleReorder} className="space-y-0">
                {currentItems.map((item) => {
                  const sessionKey = item.prefix ? `${item.symbol}_${item.prefix}` : item.symbol;
                  return (
                    <WatchlistItemRow
                      key={item.id}
                      item={item}
                      session={backtestSessions[item.id] || backtestSessions[sessionKey]}
                      onSelect={handleSelect}
                      onToggleStatus={toggleStatus}
                      onDelete={deleteItem}
                      onEditNotes={handleEditNotes}
                      onExtend={handleOpenExtendModal}
                      isMenuOpen={menuOpenId === sessionKey}
                      onToggleMenu={handleToggleMenu}
                      menuRef={menuRef}
                      setups={setups}
                      journalTrades={journalTrades}
                    />
                  );
                })}
              </Reorder.Group>
            </div>
          ) : (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-200">
                {activeTab === 'ongoing' ? <Clock size={32} /> : <CheckCircle2 size={32} />}
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">No {activeTab} pairs</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Start by adding an asset to your watch board</p>
              
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  const ongoingCount = watchlist.filter(item => (item.status || 'ongoing') === 'ongoing').length;
                  if (subscriptionPlan === 'basic' && ongoingCount >= 3) {
                    onLockedFeature?.('watchlist');
                  } else if (subscriptionPlan === 'plus' && ongoingCount >= 12) {
                    onLockedFeature?.('watchlist');
                  } else {
                    setIsAddModalOpen(true);
                  }
                }}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-[9.5px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-black rounded-xl transition-all shadow-md shadow-slate-900/10 cursor-pointer"
              >
                <Plus size={11.5} strokeWidth={2.5} />
                <span>Add Your First Pair</span>
              </motion.button>
            </div>
          )}
        </div>
      </div>

      {/* Clean Support Direct Chat Widget (Intercom Style) */}
      <AnimatePresence>
        {isSupportOpen && (
          <>
            {/* Soft dismiss overlay ONLY active on mobile viewports so user experience remains non-obstructive on desktop */}
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsSupportOpen(false)}
               className="sm:hidden fixed inset-0 bg-slate-950/20 backdrop-blur-xs z-[2020]"
            />
            <motion.div 
              initial={{ opacity: 0, y: 40, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.94 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="fixed bottom-[88px] right-4 sm:right-6 w-[calc(100vw-32px)] sm:w-[380px] h-[520px] max-h-[75vh] bg-white rounded-3xl shadow-[0_20px_50px_rgba(8,15,30,0.15)] z-[2031] overflow-hidden border border-slate-150 flex flex-col transition-all"
            >
              {/* Premium Glass-Glow Header */}
              <div className="p-4 bg-[#011b33] text-white flex items-center justify-between shrink-0 relative">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 via-indigo-500 to-amber-400" />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center p-2 shrink-0 overflow-hidden">
                    <img 
                      src="/logo.svg" 
                      alt="FirstLook Support" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h3 className="text-[11.5px] font-black uppercase tracking-wider text-slate-100">
                      FirstLook Support
                    </h3>
                    <p className="text-[8.5px] font-semibold text-slate-400 uppercase tracking-widest flex flex-col">
                      <span>Direct Helpdesk Inbox</span>
                      <a href="mailto:support@firstlooklabs.xyz" className="text-emerald-400 hover:text-emerald-300 underline lowercase font-mono tracking-normal mt-0.5" title="Email support directly">
                        support@firstlooklabs.xyz
                      </a>
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSupportOpen(false)} 
                  className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-slate-300 hover:text-white"
                  title="Minimize Support Chat"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Permanent Support Response Notice Banner */}
              <div className="p-3 bg-slate-50 border-b border-slate-150 text-[10.5px] font-medium leading-normal text-slate-500 text-center select-none shrink-0 relative flex items-center justify-center min-h-[38px]">
                <span className="px-5">Our support team typically responds within a few hours. In some cases replies may take up to 6 hours depending on ticket volume.</span>
                {isLoadingSupport && supportMessages.length > 0 && (
                  <div className="absolute right-3 flex items-center" title="Syncing conversation...">
                    <Loader2 size={11} className="text-slate-400 animate-spin" />
                  </div>
                )}
              </div>

              {/* Chat Message Scroll */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/55 scrollbar-thin scrollbar-thumb-slate-200 flex flex-col justify-between">
                
                <div className="space-y-3.5 flex-1">
                  {isLoadingSupport && supportMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center select-none">
                      <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mb-2" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Loading conversation...</span>
                    </div>
                  ) : null}

                  {!isLoadingSupport && supportMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center p-6 py-12 select-none">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 border border-slate-200/50">
                        <LifeBuoy size={20} className="text-slate-400 animate-spin" style={{ animationDuration: '35s' }} />
                      </div>
                      <p className="text-[11px] font-black text-slate-800 uppercase tracking-wider leading-none">Inbox Empty</p>
                      <p className="text-[10px] font-medium text-slate-500 max-w-[200px] mt-1.5 leading-relaxed">
                        Send a message below. Your complete chat log with FirstLook Support will load real-time here.
                      </p>
                    </div>
                  ) : null}

                  {supportMessages.map((msg, i) => {
                    const isUserMsg = msg.sender === 'user';
                    const msgText = msg.message || msg.text || '';
                    const msgTime = msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (msg.time || '');
                    
                    return (
                      <div 
                        key={i} 
                        className={`flex ${isUserMsg ? 'justify-end' : 'justify-start'} items-start gap-2.5 animate-fade-in`}
                      >
                        {!isUserMsg && (
                          <div className="w-6 h-6 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center p-1 shrink-0 shadow-xs">
                            <img src="/logo.svg" alt="FirstLook Support" className="w-full h-full object-contain" />
                          </div>
                        )}
                        <div 
                          className={`max-w-[78%] rounded-[1.3rem] px-3.5 py-2.5 text-[11px] font-medium leading-relaxed ${
                            isUserMsg 
                              ? 'bg-slate-900 border border-slate-800 text-white rounded-tr-none shadow-xs' 
                              : 'bg-white text-slate-800 border border-slate-150 rounded-tl-none shadow-[0_2px_8px_rgba(0,0,0,0.02)]'
                          }`}
                        >
                          {!isUserMsg && (
                            <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400 mb-0.5 leading-none select-none">
                              FirstLook Support
                            </span>
                          )}
                          <p className="whitespace-pre-line break-words">{msgText}</p>
                          <div className="flex items-center justify-between gap-2 mt-1 select-none leading-none">
                            <span className="text-[7px] font-mono uppercase text-slate-400">
                              {msgTime}
                            </span>
                            {msg.read && (
                              <span className="text-[6.5px] font-mono font-black tracking-widest text-[#10b981] uppercase">
                                READ
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Secure network transmittal state alerts */}
                {isSendingSupport && (
                  <div className="flex justify-end p-2 select-none animate-pulse">
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <Loader2 size={8} className="animate-spin text-indigo-500" />
                      Sending message...
                    </span>
                  </div>
                )}

                {supportError && (
                  <div className="p-3 bg-rose-50 border border-rose-250 rounded-2xl flex items-center gap-2 text-rose-700 text-[10.5px] font-bold shadow-2xs mt-2 select-none">
                    <AlertCircle size={14} className="shrink-0 text-rose-500" />
                    <span>{supportError}</span>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Direct Instant Action Recommendation Pills */}
              <div className="px-3 py-2 bg-slate-50/70 border-t border-slate-150/40 flex flex-nowrap overflow-x-auto gap-2 shrink-0 select-none scrollbar-none scroll-smooth">
                {[
                  { text: '⚖️ Plans Difference', query: 'What are the exact differences between Basic, Plus, and Premium plans?' },
                  { text: '💳 Cancel Subscription', query: "How do I cancel or modify my active subscription's payment renewal?" },
                  { text: '🛡️ Watchlist Limit', query: 'Is there a real limit on the active Symbol Watchlist?' },
                  { text: '🏆 Competition Slots', query: 'How do simulated competition slots work?' },
                  { text: '📊 Broker Raw Spreads', query: 'How do Custom Broker Raw Spreads optimize my backtesting?' },
                  { text: '⏳ Trade Replay Replay', query: 'How does the historical Trade Replay and speed engine work?' },
                  { text: '📱 Native App PWA', query: 'How can I install FirstLook as a native desktop or mobile App?' },
                  { text: '🐢 Fix Slow Charts/Lag', query: 'What should I do if the application experiences slow charts or minor lag?' }
                ].map((pill, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isSendingSupport || isLoadingSupport || !userId}
                    onClick={() => handleSendSupportMessage(pill.query, true)}
                    className="shrink-0 text-[8.5px] font-black uppercase tracking-wider px-2.5 py-1.5 bg-white hover:bg-slate-900 hover:text-white active:scale-95 border border-slate-200 rounded-lg text-slate-600 transition-all shadow-2xs disabled:opacity-50"
                  >
                    {pill.text}
                  </button>
                ))}
              </div>

              {/* Clean Minimalist Message Form */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendSupportMessage(supportInput);
                }}
                className="p-3 bg-white border-t border-slate-150 shrink-0 flex gap-2"
              >
                <input
                  type="text"
                  value={supportInput}
                  disabled={isSendingSupport || isLoadingSupport || !userId}
                  onChange={(e) => setSupportInput(e.target.value)}
                  placeholder={!userId ? "Sign in to chat with support" : (isSendingSupport ? "Transmission in progress..." : "Type a message to FirstLook Support...")}
                  className="flex-1 bg-slate-50 border border-slate-150 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-1.5 focus:ring-slate-900/10 placeholder-slate-400 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={!supportInput.trim() || isSendingSupport || isLoadingSupport || !userId}
                  className="w-10 h-10 bg-[#011b33] text-white disabled:opacity-40 hover:bg-slate-950 rounded-xl flex items-center justify-center transition-all shrink-0 cursor-pointer active:scale-95"
                >
                  {isSendingSupport ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Send size={13} strokeWidth={2.5} />
                  )}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Selector Modal */}
      <AnimatePresence>
        {editingDescriptionItem && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingDescriptionItem(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000]"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-[2rem] shadow-2xl z-[2001] overflow-hidden border border-slate-100"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">Pair Notes</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Context for: {editingDescriptionItem.symbol}</p>
                </div>
                <button onClick={() => setEditingDescriptionItem(null)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                  <X size={20} className="text-slate-300" />
                </button>
              </div>
              <div className="p-6">
                <textarea
                  autoFocus
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Enter strategy notes, goals, or context for this pair..."
                  className="w-full h-32 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all resize-none mb-4"
                />
                <button
                  onClick={() => {
                    setWatchlist(prev => prev.map(it => it.id === editingDescriptionItem.id ? { ...it, description: editDescription } : it));
                    setEditingDescriptionItem(null);
                  }}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Save Notes
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {extendingItem && extendConfig && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setExtendingItem(null);
                setSelectedNewDate('');
                setExtendError(null);
              }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000]"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-[2rem] shadow-2xl z-[2001] overflow-hidden border border-slate-100"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">Extend Playback Span</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">FOR Sandbox: {extendingItem.symbol}</p>
                </div>
                <button 
                  onClick={() => {
                    setExtendingItem(null);
                    setSelectedNewDate('');
                    setExtendError(null);
                  }} 
                  className="p-2 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <X size={20} className="text-slate-300" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {extendConfig.isPastLimit ? (
                  <div className="p-4 bg-amber-50 border border-amber-100/50 rounded-2xl flex items-start gap-3">
                    <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                    <div>
                      <h4 className="text-[9.5px] font-black uppercase tracking-widest text-amber-900">Historical Border Reached</h4>
                      <p className="text-[10.5px] text-amber-700 font-medium mt-1 leading-normal">
                        This sandbox is already at the maximum available complete historical data frame. Future sessions must wait for updated data packages.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Current End Date</label>
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs font-bold text-slate-700">
                        {extendingItem.end_time ? new Date(extendingItem.end_time * 1000).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '---'}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Choose New End Date</label>
                      <input 
                        type="date"
                        min={extendConfig.minSelectableStr}
                        max={extendConfig.maxSelectableStr}
                        value={selectedNewDate}
                        onChange={(e) => {
                          setSelectedNewDate(e.target.value);
                          setExtendError(null);
                        }}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-indigo-400 transition-all cursor-pointer"
                      />
                    </div>

                    {extendError && (
                      <div className="text-[10px] font-bold text-rose-500 bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-center gap-2">
                        <AlertCircle size={14} />
                        <span>{extendError}</span>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        if (!selectedNewDate) {
                          setExtendError('Please select a valid extension date');
                          return;
                        }

                        const [year, month, day] = selectedNewDate.split('-').map(Number);
                        const dateObj = new Date(year, month - 1, day, 23, 59, 59, 999);
                        const newEndTimeSeconds = Math.floor(dateObj.getTime() / 1000);

                        if (newEndTimeSeconds <= extendConfig.currentEndTime) {
                          setExtendError('New date must be after current end date');
                          return;
                        }

                        if (onExtendSession) {
                          onExtendSession(extendingItem.id, newEndTimeSeconds);
                        } else {
                          // Local fallback update
                          setWatchlist(prev => prev.map(item => {
                            if (item.id === extendingItem.id) {
                              return {
                                ...item,
                                end_time: newEndTimeSeconds,
                                status: 'ongoing' as const,
                                hasBeenExtended: true
                              };
                            }
                            return item;
                          }));
                        }

                        // Close modal cleanly
                        setExtendingItem(null);
                        setSelectedNewDate('');
                        setExtendError(null);
                      }}
                      className="w-full py-4 mt-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:scale-[1.01] active:scale-95 transition-all text-center cursor-pointer"
                    >
                      Confirm Span Extension
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddModalOpen(false);
                setSelectedAssetForSource(null);
              }}
              className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={(isMobile && !isMobileLandscape) ? { y: '100%' } : { scale: 0.95, opacity: 0, y: 20 }}
              animate={(isMobile && !isMobileLandscape) ? { y: 0 } : { scale: 1, opacity: 1, y: 0 }}
              exit={(isMobile && !isMobileLandscape) ? { y: '100%' } : { scale: 0.95, opacity: 0, y: 20 }}
              transition={(isMobile && !isMobileLandscape) ? { type: 'spring', damping: 25, stiffness: 200 } : {}}
              className={`fixed z-[110] bg-white shadow-2xl flex flex-col border border-slate-100
                ${(isMobile && !isMobileLandscape) ? 'bottom-0 left-0 right-0 rounded-t-[2.5rem] h-[90vh]' : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl rounded-[3rem] h-[80vh]'}
              `}
            >
              <div className="p-6 sm:p-10 border-b border-slate-50 flex items-center justify-between shrink-0 bg-white">
                <div className="flex-1 mr-4">
                  {selectedAssetForSource ? (
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => {
                          setSelectedAssetForSource(null);
                          setValidationError(null);
                        }}
                        className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400"
                      >
                         <ChevronRight size={24} className="rotate-180" />
                      </button>
                      <div>
                        <h3 className="text-xl font-black tracking-tight text-slate-900">Select Source</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">FOR {selectedAssetForSource.symbol}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-xl font-black tracking-tight text-slate-900 mb-4 px-1 hidden sm:block">Explore Markets</h3>
                      <div className="relative">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                        <input
                          type="text"
                          placeholder="Search symbols..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-600/5 transition-all"
                        />
                      </div>
                    </>
                  )}
                </div>
                  <motion.button 
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setSelectedAssetForSource(null);
                      setValidationError(null);
                    }} 
                    className="w-12 h-12 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-400 transition-colors shrink-0"
                  >
                    <X size={24} />
                  </motion.button>
              </div>

              <div className="flex flex-1 min-h-0">
                {selectedAssetForSource ? (
                  <div className="flex-1 p-8 overflow-y-auto scrollbar-hide">
                    {isLoadingSources || validatingSymbol ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {validatingSymbol ? 'Verifying Support...' : 'Discovering Sources...'}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {validationError && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-4 mb-4"
                          >
                            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                            <div>
                               <h4 className="text-[10px] font-black uppercase tracking-widest text-red-900">Compatibility Error</h4>
                               <p className="text-[11px] text-red-700 font-medium mt-1 leading-relaxed">
                                 {validationError}
                               </p>
                            </div>
                          </motion.div>
                        )}
                        {filteredSources.map(source => {
                          const isDisabled = source.disabled;
                          return (
                            <button
                              key={source.id}
                              disabled={isDisabled}
                              onClick={() => !isDisabled && addToWatchlist(selectedAssetForSource!, source.id)}
                              className={`w-full group flex items-center justify-between p-6 rounded-3xl transition-all text-left border ${
                                isDisabled 
                                  ? 'bg-slate-50 border-slate-150 text-slate-350 opacity-45 cursor-not-allowed select-none' 
                                  : 'bg-slate-50/50 hover:bg-slate-900 hover:border-slate-800 border-slate-100 hover:scale-[1.01] active:scale-[0.99] transform-gpu cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm overflow-hidden shrink-0 ${isDisabled ? 'grayscale opacity-30 border border-slate-200' : 'group-hover:bg-white/10'}`}>
                                  <img 
                                    src={`https://logo.clearbit.com/${source.id}.com`}
                                    alt={source.name}
                                    loading="lazy"
                                    className="w-6 h-6 object-contain"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      const parent = target.parentElement;
                                      if (parent) {
                                        const text = document.createElement('span');
                                        text.className = `text-[10px] font-black ${isDisabled ? 'text-slate-400' : 'text-indigo-500 group-hover:text-white'}`;
                                        text.innerText = source.name.substring(0, 2).toUpperCase();
                                        parent.appendChild(text);
                                      }
                                    }}
                                  />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`font-black uppercase tracking-tight text-base block ${isDisabled ? 'text-slate-400' : 'text-slate-900 group-hover:text-white'}`}>
                                      {source.name}
                                    </span>
                                    {source.recommended && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100 font-sans">
                                        Recommended
                                      </span>
                                    )}
                                    {source.poor && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200/55 font-sans">
                                        Poor
                                      </span>
                                    )}
                                    {isDisabled && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-400 border border-slate-200 font-sans">
                                        Coming Soon
                                      </span>
                                    )}
                                  </div>
                                  <span className={`text-[8px] font-black uppercase tracking-[0.1em] block mt-0.5 ${isDisabled ? 'text-slate-350' : 'text-slate-400 group-hover:text-white/60'}`}>
                                    {source.description}
                                  </span>
                                </div>
                              </div>
                              <ChevronRight size={20} className={`${isDisabled ? 'text-slate-300' : 'text-slate-300 group-hover:text-white'}`} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Sidebar Categories */}
                    <div className="w-[80px] sm:w-[120px] border-r border-slate-50 bg-slate-50/30 p-2 sm:p-3 space-y-2 overflow-y-auto scrollbar-hide">
                  <CategoryButton 
                    active={activeCategory === 'Crypto'} 
                    onClick={() => setActiveCategory('Crypto')}
                    icon={Coins}
                    label="Crypto"
                    isMobile={isMobile}
                  />
                  <CategoryButton 
                    active={activeCategory === 'Forex'} 
                    onClick={() => setActiveCategory('Forex')}
                    icon={Globe}
                    label="Forex"
                    isMobile={isMobile}
                  />
                  <CategoryButton 
                    active={activeCategory === 'Metals'} 
                    onClick={() => setActiveCategory('Metals')}
                    icon={Shield}
                    label="Metals"
                    isMobile={isMobile}
                  />
                  <CategoryButton 
                    active={activeCategory === 'Stocks'} 
                    onClick={() => setActiveCategory('Stocks')}
                    icon={BarChart2}
                    label="Stock"
                    isMobile={isMobile}
                    disabled={true}
                  />
                  <CategoryButton 
                    active={activeCategory === 'Indices'} 
                    onClick={() => setActiveCategory('Indices')}
                    icon={LineChart}
                    label="Indices"
                    isMobile={isMobile}
                  />
                </div>

                {/* Symbols Grid */}
                <div 
                  id="market-explorer-list"
                  className="flex-1 p-4 sm:p-8 overflow-y-auto grid grid-cols-1 gap-2 scrollbar-hide scroll-smooth"
                >
                  {filteredSymbols.map(asset => (
                    <MarketSymbolButton 
                      key={asset.symbol} 
                      asset={asset} 
                      onSelect={handleSetSelectedAsset}
                      onShowSources={handleSetSelectedAsset}
                    />
                  ))}
                  {filteredSymbols.length === 0 && (
                    <div className="py-20 text-center text-slate-300">
                      <Search size={48} className="mx-auto mb-4 opacity-10" />
                      <p className="text-[10px] font-black uppercase tracking-widest">No matching symbols</p>
                    </div>
                  )}
                </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modern Floating Support Chat Button Overlay */}
      <motion.button
        whileHover={{ scale: 1.08, y: -2 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsSupportOpen(prev => !prev)}
        className="fixed bottom-6 right-6 z-[2040] flex items-center justify-center w-8 h-8 rounded-full bg-[#011b33] border border-slate-700/60 text-white hover:text-emerald-400 hover:border-emerald-500/40 shadow-[0_6px_15px_rgba(1,27,51,0.25)] hover:shadow-[0_8px_18px_rgba(1,27,51,0.35)] transition-all cursor-pointer group"
        title={isSupportOpen ? "Close Support Chat" : "Direct Support Chat"}
      >
        <AnimatePresence mode="wait">
          {isSupportOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X size={11} strokeWidth={2.8} />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative flex items-center justify-center"
            >
              <MessageSquare size={13} strokeWidth={2.5} className="text-white group-hover:text-emerald-400 group-hover:scale-105 transition-all" />
              <span className="absolute -top-1 -right-1 flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

const CategoryButton = memo(({ active, onClick, icon: Icon, label, isMobile, disabled }: { active: boolean, onClick: () => void, icon: any, label: string, isMobile?: boolean, disabled?: boolean }) => {
  return (
    <button 
      onClick={disabled ? undefined : onClick}
      className={`w-full flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-2xl transition-all ${
        disabled
          ? 'opacity-30 cursor-not-allowed grayscale text-slate-300'
          : active 
            ? 'bg-white shadow-xl shadow-slate-200/50 border border-slate-100 text-slate-900' 
            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
      }`}
    >
      <Icon size={isMobile ? 20 : 18} />
      <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
});
