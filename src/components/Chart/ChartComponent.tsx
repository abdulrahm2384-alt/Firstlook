/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, forwardRef, useImperativeHandle, useState, useMemo } from 'react';
import { ChartEngine } from './ChartEngine';
import { Candle, Trade, ChartTheme, IndicatorInstance } from '../../types';
import { Drawing, DrawingType, DrawingPoint } from '../../types/drawing';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChartProps {
  data: Candle[];
  trades: Trade[];
  symbol: string;
  theme?: ChartTheme;
  indicators?: IndicatorInstance[];
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  drawingTool?: DrawingType | null;
  drawings?: Drawing[];
  selectedId?: string | null;
  drawingSettings?: any;
  onDrawingsChange?: (drawings: Drawing[]) => void;
  onSelectDrawing?: (drawing: Drawing | null) => void;
  onDrawingComplete?: () => void;
  onDrawingSettingsChange?: (settings: any) => void;
  viewport?: { zoom: number, offsetX: number, offsetY: number, yScale: number };
  onViewportChange?: (viewport: { zoom: number, offsetX: number, offsetY: number, yScale: number }) => void;
  onTradeClosed?: (trade: any) => void;
  onDrawingTrigger?: (drawing: Drawing) => void;
  timeframe?: string;
  isReplay?: boolean;
  isSimulating?: boolean;
  prefix?: string;
  pinnedText?: string | null;
  onNewsClick?: (news: any[], isFuture: boolean, x: number, y: number) => void;
  historicalData?: Candle[];
  isNewsStreamEnabled?: boolean;
  setups?: any[];
  source?: string;
  onUpgradeClick?: () => void;
  userPlan?: 'basic' | 'plus' | 'premium';
}

export const ChartComponent = forwardRef<ChartEngine | null, ChartProps>(({ 
  data, 
  trades, 
  symbol,
  theme, 
  indicators = [],
  onLoadMore, 
  isLoadingMore,
  drawingTool = null,
  drawings = [],
  selectedId = null,
  drawingSettings,
  onDrawingsChange,
  onSelectDrawing,
  onDrawingComplete,
  onDrawingSettingsChange,
  viewport,
  onViewportChange,
  onTradeClosed,
  onDrawingTrigger,
  timeframe,
  isReplay = false,
  isSimulating = false,
  prefix,
  pinnedText,
  onNewsClick,
  historicalData = [],
  isNewsStreamEnabled = true,
  setups = [],
  source,
  onUpgradeClick,
  userPlan
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ChartEngine | null>(null);
  const [activeNews, setActiveNews] = useState<{ news: any[]; isFuture: boolean; x: number; y: number } | null>(null);
  const lastEmittedViewportRef = useRef<any>(null);
  const lastTargetRef = useRef<{ symbol: string, timeframe?: string, prefix?: string } | null>(null);

  const [dismissedDrawingIds, setDismissedDrawingIds] = useState<string[]>([]);
  const [showSetupDropdown, setShowSetupDropdown] = useState<string | null>(null);

  const [showPromoPopup, setShowPromoPopup] = useState(false);
  const promoTimeoutRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (promoTimeoutRef.current) {
        clearTimeout(promoTimeoutRef.current);
      }
    };
  }, []);

  const handleChartInteraction = () => {
    // Only show premium promo popups to basic/free plan users
    if (userPlan && userPlan !== 'basic') {
      return;
    }

    try {
      // If we have already shown it in this current tab session, don't trigger again
      if (sessionStorage.getItem('firstlook_promo_shown') === 'true') {
        return;
      }
    } catch (e) {}

    if (!showPromoPopup && !promoTimeoutRef.current) {
      // Wait for at least 5 seconds of interaction before showing the popup
      promoTimeoutRef.current = setTimeout(() => {
        setShowPromoPopup(true);
        try {
          sessionStorage.setItem('firstlook_promo_shown', 'true');
        } catch (e) {}
        promoTimeoutRef.current = null;
      }, 5000);
    }
  };

  const lastCandle = data && data.length > 0 ? data[data.length - 1] : null;

  const activeToTrade = useMemo(() => {
    if (!lastCandle) return null;
    const currentPrice = lastCandle.close;

    const candidates = (drawings || []).filter((d) => {
      if (d.type !== DrawingType.LONG_POSITION && d.type !== DrawingType.SHORT_POSITION) return false;
      if (d.isTriggered) return false;
      if (d.isPipelineApproved) return false;
      if (d.status === 'won' || d.status === 'lost') return false;
      if (dismissedDrawingIds.includes(d.id)) return false;

      const p0 = d.points[0];
      const p1 = d.points[1];
      if (!p0 || !p1) return false;

      const isLong = d.type === DrawingType.LONG_POSITION;
      const entryPrice = p0.price;

      // Current Price satisfies the direction constraint:
      // - Long: current price > entryPrice
      // - Short: current price < entryPrice
      const priceValid = isLong ? currentPrice > entryPrice : currentPrice < entryPrice;

      // Drawing end-time extends in the future beyond current candle
      const endTime = Math.max(p0.time, p1.time);
      const timeValid = endTime > lastCandle.time;

      return priceValid && timeValid;
    });

    return candidates[0] || null;
  }, [drawings, lastCandle, dismissedDrawingIds]);

  const selectedClosedDrawing = useMemo(() => {
    if (!selectedId || !drawings) return null;
    return drawings.find(d => 
      d.id === selectedId && 
      (d.type === DrawingType.LONG_POSITION || d.type === DrawingType.SHORT_POSITION) &&
      (d.status === 'won' || d.status === 'lost')
    );
  }, [selectedId, drawings]);

  const handleTakeTrade = (drawing: Drawing, chosenSetupGrade?: string) => {
    if (!lastCandle) return;

    const activeSetups = (setups || []).filter(s => (s.confluences && s.confluences.length > 0) || s.image_url);

    // If there are multiple setups and none was explicitly chosen, show the dropdown
    if (activeSetups.length > 1 && !chosenSetupGrade && showSetupDropdown !== drawing.id) {
      setShowSetupDropdown(drawing.id);
      return;
    }

    const grade = chosenSetupGrade || (activeSetups.length > 0 ? activeSetups[0].grade : 'A+');
    const associatedSetup = activeSetups.find(s => s.grade === grade);

    const updatedDrawing: Drawing = {
      ...drawing,
      isPipelineApproved: true,
      approvedAt: Date.now(),
      approvedPrice: lastCandle.close,
      placedAt: lastCandle.time,
      settings: {
        ...drawing.settings,
        setupGrade: grade,
        confluences: associatedSetup ? (associatedSetup.confluences || []) : []
      }
    };

    if (engineRef.current) {
      engineRef.current.updateDrawing(updatedDrawing);
    }
    if (onDrawingsChange) {
      const updatedList = drawings.map((item) => (item.id === drawing.id ? updatedDrawing : item));
      onDrawingsChange(updatedList);
    }

    setShowSetupDropdown(null);
  };

  const handleIgnoreSetup = (drawing: Drawing) => {
    setDismissedDrawingIds((prev) => [...prev, drawing.id]);
    setShowSetupDropdown(null);
  };

  useEffect(() => {
    if (!activeToTrade) {
      setShowSetupDropdown(null);
    }
  }, [activeToTrade]);

  // Reset lastEmittedViewport on symbol/timeframe switches to load clean saved states
  useEffect(() => {
    lastEmittedViewportRef.current = null;
  }, [symbol, timeframe, prefix]);

  useImperativeHandle(ref, () => engineRef.current as ChartEngine);

  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new ChartEngine(canvasRef.current);
    }
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSymbol(symbol);
    }
  }, [symbol]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setPrefix(prefix || null);
    }
  }, [prefix]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setIsReplay(!!isReplay);
    }
  }, [isReplay]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setIsSimulating(!!isSimulating);
    }
  }, [isSimulating]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setData(data, trades);
    }
  }, [data, trades]);

  useEffect(() => {
    if (engineRef.current && timeframe) {
      engineRef.current.setTimeframe(timeframe);
    }
  }, [timeframe]);

  useEffect(() => {
    if (engineRef.current && source) {
      engineRef.current.setSource(source);
    }
  }, [source]);

  useEffect(() => {
    if (engineRef.current && theme) {
      engineRef.current.setTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    if (engineRef.current && onLoadMore) {
      engineRef.current.setOnLoadMore(onLoadMore);
    }
  }, [onLoadMore]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setLoadingMore(!!isLoadingMore);
    }
  }, [isLoadingMore]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setDrawingTool(drawingTool);
    }
  }, [drawingTool]);

  useEffect(() => {
    if (engineRef.current) {
      if (onDrawingsChange) engineRef.current.setOnDrawingsChange(onDrawingsChange);
      if (onSelectDrawing) engineRef.current.setOnSelectDrawing(onSelectDrawing);
      if (onDrawingComplete) engineRef.current.setOnDrawingComplete(onDrawingComplete);
      if (onDrawingSettingsChange) engineRef.current.setOnDrawingSettingsChange(onDrawingSettingsChange);
    }
  }, [onDrawingsChange, onSelectDrawing, onDrawingComplete, onDrawingSettingsChange]);

  useEffect(() => {
    if (engineRef.current && drawingSettings) {
      engineRef.current.setDrawingSettings(drawingSettings);
    }
  }, [drawingSettings]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setDrawings(drawings || []);
    }
  }, [drawings]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setIndicators(indicators);
    }
  }, [indicators]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSelectedDrawingId(selectedId || null);
    }
  }, [selectedId]);

  useEffect(() => {
    if (engineRef.current && onViewportChange) {
      engineRef.current.setOnViewportChange((v) => {
        lastEmittedViewportRef.current = v;
        onViewportChange(v);
      });
    }
  }, [onViewportChange]);

  useEffect(() => {
    if (engineRef.current && onTradeClosed) {
      engineRef.current.setOnTradeClosed(onTradeClosed);
    }
  }, [onTradeClosed]);

  useEffect(() => {
    if (engineRef.current && onDrawingTrigger) {
      engineRef.current.setOnDrawingTrigger(onDrawingTrigger);
    }
  }, [onDrawingTrigger]);

  useEffect(() => {
    if (engineRef.current) {
      const targetChanged = !lastTargetRef.current || 
        lastTargetRef.current.symbol !== symbol || 
        lastTargetRef.current.timeframe !== timeframe || 
        lastTargetRef.current.prefix !== prefix;

      lastTargetRef.current = { symbol, timeframe, prefix };

      if (viewport) {
        const isInteracting = engineRef.current.getIsInteracting ? engineRef.current.getIsInteracting() : false;
        const hasActivePlayback = isSimulating || isReplay;

        // If we have active simulated ticks running and the user isn't interacting,
        // we should keep the viewport completely local to avoid lagging state updates resetting/shaking the view.
        if (hasActivePlayback && !isInteracting && !targetChanged) {
          return;
        }

        const isMatchingEmitted = 
          lastEmittedViewportRef.current &&
          lastEmittedViewportRef.current.zoom === viewport.zoom &&
          lastEmittedViewportRef.current.offsetX === viewport.offsetX &&
          lastEmittedViewportRef.current.offsetY === viewport.offsetY &&
          lastEmittedViewportRef.current.yScale === viewport.yScale;

        if (!targetChanged && (isMatchingEmitted || isInteracting)) {
          return;
        }

        const current = engineRef.current.getViewport();
        // Force set if target switched, or if the parameters are visually different to avoid noise
        if (
          targetChanged ||
          current.zoom !== viewport.zoom ||
          current.offsetX !== viewport.offsetX ||
          current.offsetY !== viewport.offsetY ||
          current.yScale !== viewport.yScale
        ) {
          engineRef.current.setViewport(viewport.zoom, viewport.offsetX, viewport.offsetY, viewport.yScale);
        }
      } else {
        engineRef.current.resetView();
      }
    }
  }, [viewport, symbol, timeframe, prefix, isSimulating, isReplay]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setPinnedText(pinnedText || null);
    }
  }, [pinnedText]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setOnNewsClick((clickNews, clickIsFuture, clickX, clickY) => {
        if (clickNews && clickNews.length > 0) {
          setActiveNews({ news: clickNews, isFuture: clickIsFuture, x: clickX, y: clickY });
        } else {
          setActiveNews(null);
        }
        if (onNewsClick) {
          onNewsClick(clickNews, clickIsFuture, clickX, clickY);
        }
      });
    }
  }, [onNewsClick]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setHistoricalData(historicalData);
    }
  }, [historicalData]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setNewsStreamEnabled(isNewsStreamEnabled);
    }
  }, [isNewsStreamEnabled]);

  useEffect(() => {
    if (!containerRef.current || !engineRef.current) return;

    const resize = () => {
      if (!containerRef.current || !engineRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        engineRef.current.resize(rect.width, rect.height);
      }
    };

    const observer = new ResizeObserver((entries) => {
      // Use requestAnimationFrame to avoid "ResizeObserver loop limit exceeded"
      window.requestAnimationFrame(() => {
        if (!Array.isArray(entries) || !entries.length) return;
        for (const entry of entries) {
          if (entry.target === containerRef.current && engineRef.current) {
            const { width, height } = entry.contentRect;
            // Only resize if we have actual dimensions
            if (width > 0 && height > 0) {
              engineRef.current.resize(width, height);
            }
          }
        }
      });
    });

    observer.observe(containerRef.current);
    
    // Initial size with a fallback for slow layout updates on mobile
    resize();
    const timer1 = setTimeout(resize, 100);
    const timer2 = setTimeout(resize, 500); // Second check for mobile orientation shifts

    // Fallback for some mobile browsers
    window.addEventListener('orientationchange', resize);
    window.addEventListener('resize', resize);

    return () => {
      observer.disconnect();
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('orientationchange', resize);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
  const dropdownWidth = 240;
  const adjustedLeft = activeNews 
    ? Math.max(8, Math.min(activeNews.x - dropdownWidth / 2, containerWidth - dropdownWidth - 8))
    : 0;

  const isDarkTheme = theme?.bg ? !['#ffffff', '#fff', '#f8fafc', '#f1f5f9'].includes(theme.bg.toLowerCase().trim()) : false;

  return (
    <div ref={containerRef} onPointerDownCapture={handleChartInteraction} className="w-full h-full relative overflow-hidden flex-1" style={{ backgroundColor: theme?.bg || '#ffffff' }}>
      <canvas ref={canvasRef} className="block w-full h-full touch-none" />

      {/* Small drop-down news overlay dropping from the news icon itself */}
      <AnimatePresence>
        {activeNews && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute rounded-xl shadow-2xl border p-3 flex flex-col z-[100] w-[240px] max-h-[220px] select-none ${
              isDarkTheme
                ? 'bg-slate-900/95 border-slate-800 text-slate-100 shadow-black/60'
                : 'bg-white/95 border-slate-100 text-slate-800 shadow-slate-200/60'
            }`}
            style={{
              left: `${adjustedLeft}px`,
              top: `${activeNews.y + 12}px`,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-500/10 mb-2">
              <span className={`text-[9px] font-black uppercase tracking-wider ${isDarkTheme ? 'text-indigo-400' : 'text-indigo-600'}`}>
                {activeNews.isFuture ? 'Upcoming Event' : 'Impact News'}
              </span>
              <button
                onClick={() => setActiveNews(null)}
                className="p-0.5 hover:bg-slate-500/10 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={10} />
              </button>
            </div>

            {/* Scrollable list of news */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 scrollbar-thin scrollbar-thumb-slate-500/25">
              {activeNews.news.map((item: any, idx: number) => {
                const imp = String(item.impact || '').trim().toLowerCase();
                let badgeBg = 'bg-slate-500/10 text-slate-400';
                if (imp === 'high') {
                  badgeBg = 'bg-red-500/10 text-red-500';
                } else if (imp === 'medium') {
                  badgeBg = 'bg-orange-500/10 text-orange-400';
                } else if (imp === 'low') {
                  badgeBg = 'bg-yellow-500/10 text-yellow-500';
                }

                // Format time if available
                const dateObj = item.time ? new Date(item.time * 1000) : null;
                const timeStr = dateObj ? dateObj.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                }) : '';

                return (
                  <div key={idx} className="flex flex-col gap-0.5 border-l-2 pl-2 border-slate-500/20">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[7.5px] font-black px-1 rounded uppercase ${badgeBg}`}>
                        {item.impact || 'LOW'}
                      </span>
                      {timeStr && (
                        <span className="text-[7.5px] font-mono text-slate-400">
                          {timeStr}
                        </span>
                      )}
                      {item.sentiment && (
                        <span className={`text-[7.5px] font-bold ${
                          item.sentiment.toLowerCase() === 'bullish' ? 'text-emerald-500' : 'text-rose-500'
                        }`}>
                          {item.sentiment.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <h4 className="text-[9.5px] font-bold leading-tight mt-0.5">
                      {item.title}
                    </h4>
                    {item.description && (
                      <p className="text-[8px] text-slate-400 leading-snug mt-0.5">
                        {item.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating high-contrast "Take Trade?" entry prompt for active-to-trade position drawings */}
      <AnimatePresence>
        {activeToTrade && (
          <div className={`absolute ${selectedClosedDrawing ? 'top-24' : 'top-14'} right-4 z-[95] flex flex-col items-end gap-1.5`}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -15 }}
              transition={{ type: "spring", stiffness: 450, damping: 30 }}
              className={`rounded-full shadow-lg border px-4 py-1.5 flex items-center gap-2.5 select-none backdrop-blur-md text-xs font-semibold ${
                isDarkTheme
                  ? 'bg-slate-900/90 border-slate-700/60 text-white shadow-black/60'
                  : 'bg-white/90 border-slate-200 text-slate-800 shadow-slate-300/40'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    activeToTrade.type === DrawingType.LONG_POSITION ? 'bg-emerald-500' : 'bg-rose-500'
                  }`} />
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    activeToTrade.type === DrawingType.LONG_POSITION ? 'bg-emerald-500' : 'bg-rose-500'
                  }`} />
                </span>
                <span className="font-extrabold uppercase tracking-tight text-[10px]">
                  {activeToTrade.type === DrawingType.LONG_POSITION ? 'Long' : 'Short'}
                </span>
                <span className="text-slate-500/40 font-normal">|</span>
                <span className="text-slate-700 dark:text-slate-200 font-medium">Take Trade?</span>
              </div>

              <div className="flex items-center gap-1 border-l border-slate-500/10 pl-2">
                <button
                  onClick={() => handleIgnoreSetup(activeToTrade)}
                  className="w-5 h-5 rounded-full flex items-center justify-center bg-slate-500/10 hover:bg-rose-500/20 hover:text-rose-500 text-slate-400 transition-all active:scale-90 cursor-pointer"
                  title="Dismiss (No)"
                >
                  <X size={11} className="stroke-[2.5px]" />
                </button>
                <button
                  onClick={() => handleTakeTrade(activeToTrade)}
                  className="w-5 h-5 rounded-full flex items-center justify-center bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all active:scale-90 cursor-pointer"
                  title="Execute Trade (Yes)"
                >
                  <Check size={11} className="stroke-[3px]" />
                </button>
              </div>
            </motion.div>

            {/* Dropdown of setups if we have multiple and dropdown is active */}
            <AnimatePresence>
              {showSetupDropdown === activeToTrade.id && (
                <motion.div
                  initial={{ opacity: 0, y: -5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -5, scale: 0.95 }}
                  className={`rounded-2xl border p-1 z-[96] shadow-xl min-w-[155px] flex flex-col backdrop-blur-md ${
                    isDarkTheme
                      ? 'bg-slate-900/95 border-slate-700/60 text-white shadow-black/80'
                      : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/50'
                  }`}
                >
                  <div className={`text-[8px] font-black uppercase tracking-wider px-2.5 py-1 select-none border-b mb-1 ${
                    isDarkTheme ? 'text-slate-400 border-slate-700/30' : 'text-slate-400 border-slate-100'
                  }`}>
                    Select Setup Type
                  </div>
                  {(setups || []).filter(s => (s.confluences && s.confluences.length > 0) || s.image_url).map((setup) => {
                    return (
                      <button
                        key={setup.grade}
                        onClick={() => handleTakeTrade(activeToTrade, setup.grade)}
                        className={`w-full flex items-center justify-between text-left text-xs px-2 py-1.5 rounded-xl font-bold transition-all hover:bg-slate-500/10 active:scale-[0.98] cursor-pointer`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 flex items-center justify-center rounded-md text-[10px] font-extrabold ${
                            setup.grade === 'A+' ? 'bg-emerald-500/15 text-emerald-555' :
                            setup.grade === 'B' ? 'bg-indigo-500/15 text-indigo-555' :
                            'bg-amber-500/15 text-amber-555'
                          }`}>
                            {setup.grade}
                          </div>
                          <span className="text-[11px] font-medium leading-none">
                            {setup.grade === 'A+' ? 'Tier 1 Setup' : setup.grade === 'B' ? 'Secondary' : 'Tier 3 (Class C)'}
                          </span>
                        </div>
                        <span className="text-[8px] text-slate-400 font-mono font-bold">({setup.confluences?.length || 0} Cfl)</span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>

      {/* Floating compact Closed Trade Details on Selection */}
      <AnimatePresence>
        {selectedClosedDrawing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -15 }}
            transition={{ type: "spring", stiffness: 450, damping: 30 }}
            className={`absolute top-14 right-4 z-[95] rounded-full shadow-lg border px-4 py-1.5 flex items-center gap-2.5 select-none backdrop-blur-md text-xs font-semibold ${
              isDarkTheme
                ? 'bg-slate-900/90 border-slate-700/60 text-white shadow-black/60'
                : 'bg-white/90 border-slate-200 text-slate-800 shadow-slate-300/40'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className={`animate-pulse absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  selectedClosedDrawing.status === 'won' ? 'bg-emerald-500' : 'bg-rose-500'
                }`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  selectedClosedDrawing.status === 'won' ? 'bg-emerald-500' : 'bg-rose-500'
                }`} />
              </span>
              <span className={`font-extrabold uppercase tracking-tight text-[10px] ${
                selectedClosedDrawing.status === 'won' ? 'text-emerald-500' : 'text-rose-500'
              }`}>
                {selectedClosedDrawing.status === 'won' ? 'TP' : 'SL'}
              </span>
              <span className="text-slate-500/40 font-normal">|</span>
              <span className="text-slate-700 dark:text-slate-200 font-bold">{selectedClosedDrawing.type === DrawingType.LONG_POSITION ? 'Long' : 'Short'}</span>
              <span className="text-slate-500/40 font-normal">|</span>
              <span className={`font-extrabold ${selectedClosedDrawing.status === 'won' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {(() => {
                  const p0 = selectedClosedDrawing.points?.[0];
                  const p1 = selectedClosedDrawing.points?.[1];
                  const p2 = selectedClosedDrawing.points?.[2] || p0;
                  if (p0 && p1) {
                    const entry = p0.price;
                    const target = p1.price;
                    const originalStopValue = p2.price;
                    const exitPrice = selectedClosedDrawing.status === 'won' ? target : (selectedClosedDrawing.managedStopPrice ?? originalStopValue);
                    const initialStopValue = selectedClosedDrawing.initialStopPrice !== undefined ? selectedClosedDrawing.initialStopPrice : originalStopValue;
                    const risk = Math.abs(entry - initialStopValue) || 0.00000001;
                    const isLong = selectedClosedDrawing.type === DrawingType.LONG_POSITION;
                    const diff = isLong ? (exitPrice - entry) : (entry - exitPrice);
                    const rr = diff / risk;
                    return rr > 0 ? `+${rr.toFixed(2)}R` : `${rr.toFixed(2)}R`;
                  }
                  return '---';
                })()}
              </span>
              <span className="text-slate-500/40 font-normal">|</span>
              <span className="text-indigo-500 dark:text-indigo-400 font-extrabold text-[10px] uppercase bg-indigo-500/10 px-1.5 py-0.5 rounded-md">
                {selectedClosedDrawing.settings?.setupGrade || 'A+'}
              </span>
            </div>

            <div className="flex items-center gap-1 border-l border-slate-500/10 pl-2">
              <button
                onClick={() => onSelectDrawing?.(null)}
                className="w-5 h-5 rounded-full flex items-center justify-center bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 transition-all active:scale-90 cursor-pointer"
                title="Dismiss details"
              >
                <X size={11} className="stroke-[2.5px]" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Promo Upgrade Subscription Popup */}
      <AnimatePresence>
        {showPromoPopup && (
          <motion.div
            initial={{ opacity: 0, x: -60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -60, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              textRendering: 'optimizeLegibility',
              WebkitFontSmoothing: 'antialiased',
            }}
            className="absolute bottom-6 left-6 z-[1000] w-[320px] sm:w-[350px] p-4.5 rounded-2xl bg-slate-950/95 border border-amber-500/20 shadow-[0_20px_50px_rgba(0,0,0,0.55)] text-white backdrop-blur-lg flex flex-col gap-3.5 overflow-hidden select-none"
          >
            {/* Ambient Premium Glow Effects */}
            <div className="absolute -top-12 -left-12 w-28 h-28 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-28 h-28 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />

            {/* Header section */}
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8.5 h-8.5 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-[0_4px_10px_rgba(245,158,11,0.25)]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5 stroke-[2.5px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-sans text-[12px] font-black uppercase tracking-wider text-amber-400">FirstLook Premium</h3>
                  <p className="text-[8.5px] text-slate-400 font-mono tracking-widest leading-none mt-0.5">EXCLUSIVE PLUS PASS</p>
                </div>
              </div>

              {/* Candlestick X close button */}
              <div 
                className="relative flex flex-col items-center justify-center h-11 w-6 group cursor-pointer" 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setShowPromoPopup(false); 
                }} 
                title="Dismiss Offer"
              >
                {/* Candle Upper Wick */}
                <div className="w-0.5 h-1.5 bg-rose-450/70 group-hover:bg-rose-400 transition-colors" />
                {/* Candle Body */}
                <div className="w-4 h-5 bg-rose-500 rounded-sm flex items-center justify-center text-[10px] font-bold text-white shadow-[0_2px_8px_rgba(239,68,68,0.35)] border border-rose-600 group-hover:scale-105 transition-transform">
                  <X size={8} className="stroke-[4px]" />
                </div>
                {/* Candle Lower Wick */}
                <div className="w-0.5 h-1.5 bg-rose-450/70 group-hover:bg-rose-400 transition-colors" />
              </div>
            </div>

            {/* Content text */}
            <div className="relative z-10">
              <p className="text-slate-300 font-sans text-[11.5px] sm:text-xs font-medium leading-relaxed">
                Unlock the full potential of <span className="font-black text-amber-300">FirstLook</span> by upgrading to Plus or Premium for better experience
              </p>
            </div>

            {/* Actions CTA buttons */}
            <div className="relative z-10 flex items-center gap-3 justify-end mt-0.5">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPromoPopup(false);
                }}
                className="px-3 py-1 rounded-full text-[10.5px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Maybe Later
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPromoPopup(false);
                  if (onUpgradeClick) onUpgradeClick();
                }}
                className="px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 text-[11px] font-extrabold shadow-[0_4px_12px_rgba(245,158,11,0.3)] hover:shadow-[0_4px_16px_rgba(245,158,11,0.45)] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>Try Now</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 stroke-[3px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
