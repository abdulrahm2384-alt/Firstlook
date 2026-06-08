import { motion, AnimatePresence } from 'motion/react';
import { 
  Star,
  MoveVertical, 
  MoveHorizontal, 
  TrendingUp,
  ArrowRight,
  Square,
  Route,
  Pencil,
  Trash2,
  Lock,
  Unlock,
  X,
  Minus,
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowUpDown,
  CalendarDays,
  Navigation,
  AlignJustify,
  Layers,
  Type,
  Play,
  Pause,
  SkipForward,
  ChevronUp,
  Info
} from 'lucide-react';
import { DrawingType, Drawing } from '../types/drawing';
import { useState, useRef, useEffect, memo, RefObject } from 'react';
import { ColorPicker } from './ColorPicker';
import { GeneralDrawingSettingsPopover } from './GeneralDrawingSettingsPopover';

const TOOL_ICONS: Record<DrawingType, any> = {
  [DrawingType.TREND_LINE]: TrendingUp,
  [DrawingType.HORIZONTAL_RAY]: ArrowRight,
  [DrawingType.VERTICAL_LINE]: MoveVertical,
  [DrawingType.HORIZONTAL_LINE]: MoveHorizontal,
  [DrawingType.FIB_RETRACEMENT]: AlignJustify,
  [DrawingType.LONG_POSITION]: ArrowUpCircle,
  [DrawingType.SHORT_POSITION]: ArrowDownCircle,
  [DrawingType.PRICE_RANGE]: ArrowUpDown,
  [DrawingType.DATE_RANGE]: CalendarDays,
  [DrawingType.ARROW_MARKER]: Navigation,
  [DrawingType.RECTANGLE]: Square,
  [DrawingType.PATH]: Route,
  [DrawingType.BRUSH]: Pencil,
};

const LINE_STYLES = [
  { id: 'solid', icon: <div className="w-10 h-[2px] bg-slate-800/85 rounded" /> },
  { id: 'dashed', icon: <div className="w-10 h-0 border-t-2 border-dashed border-slate-800/85" /> },
  { id: 'dotted', icon: <div className="w-10 h-0 border-t-2 border-dotted border-slate-800/85" /> }
];

interface FavoriteDrawingsToolbarProps {
  favorites: DrawingType[];
  activeTool: DrawingType | null;
  onSelectTool: (tool: DrawingType | null) => void;
  pos: { x: number; y: number };
  onPosChange: (pos: { x: number; y: number }) => void;
  isMobileLandscape?: boolean;
  isMobile?: boolean;
  constraintsRef?: RefObject<HTMLDivElement | null>;
  // Optional extension props for drawing settings morphing
  selectedDrawing?: Drawing | null;
  onUpdateDrawing?: (settings: any) => void;
  onDeleteDrawing?: () => void;
  onCloseDrawing?: () => void;

  // New hooks for quick buying/selling
  setups?: any[];
  onCreateQuickTrade?: (direction: 'buy' | 'sell', setupGrade?: string) => void;

  // Playback & Simulation Integration Props
  isReplayMode?: boolean;
  isSimulating?: boolean;
  simIsPlaying?: boolean;
  replayIsPlaying?: boolean;
  togglePlayback?: () => void;
  setSimIsPlaying?: (playing: boolean) => void;
  setReplayIsPlaying?: (playing: boolean) => void;
  simSpeed?: number;
  setSimSpeed?: (speed: number) => void;
  currentSessionKey?: string | null;
  backtestSessions?: any;
  setBacktestSessions?: (sessions: any) => void;
  addNotification?: (msg: string, type: string) => void;
  subscriptionPlan?: string;
  onLockedFeature?: (feat: string) => void;
  setShowSyncInfoModal?: (show: boolean) => void;
  exitReplay?: () => void;
  setIsSimulating?: (sim: boolean) => void;
  setSimCurrentTime?: any;
  setReplayCurrentTime?: any;
  getStepSeconds?: () => number;
  historicalDataRef?: any;
  replayTrade?: any;
  sessionCurrentTimesRef?: any;
  activePrefix?: string;
  selectedSymbol?: string;
}

export const FavoriteDrawingsToolbar = memo(function FavoriteDrawingsToolbar({ 
  favorites, 
  activeTool, 
  onSelectTool, 
  pos, 
  onPosChange, 
  isMobileLandscape, 
  isMobile,
  constraintsRef,
  selectedDrawing,
  onUpdateDrawing,
  onDeleteDrawing,
  onCloseDrawing,
  setups,
  onCreateQuickTrade,

  // Playback integration props
  isReplayMode,
  isSimulating,
  simIsPlaying,
  replayIsPlaying,
  togglePlayback,
  setSimIsPlaying,
  setReplayIsPlaying,
  simSpeed,
  setSimSpeed,
  currentSessionKey,
  backtestSessions,
  setBacktestSessions,
  addNotification,
  subscriptionPlan,
  onLockedFeature,
  setShowSyncInfoModal,
  exitReplay,
  setIsSimulating,
  setSimCurrentTime,
  setReplayCurrentTime,
  getStepSeconds,
  historicalDataRef,
  replayTrade,
  sessionCurrentTimesRef,
  activePrefix,
  selectedSymbol
}: FavoriteDrawingsToolbarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSpeedOpen, setIsSpeedOpen] = useState(false);
  const [showWidthPicker, setShowWidthPicker] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [showLabelSettings, setShowLabelSettings] = useState(false);
  const [pendingTradeType, setPendingTradeType] = useState<'buy' | 'sell' | null>(null);

  const setFavoritesExpanded = (val: boolean) => {
    setIsExpanded(val);
    if (val) {
      setIsSpeedOpen(false);
    }
  };

  const setSpeedDropdownOpen = (val: boolean) => {
    setIsSpeedOpen(val);
    if (val) {
      setIsExpanded(false);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const labelSettingsRef = useRef<HTMLDivElement>(null);

  const isPortrait = isMobile && !isMobileLandscape;

  // Reset pickers and collapse expanded state when a drawing settings is active
  useEffect(() => {
    if (selectedDrawing) {
      setIsExpanded(false);
    }
    setShowWidthPicker(false);
    setShowStylePicker(false);
    setShowLabelSettings(false);
  }, [selectedDrawing?.id]);

  // Click outside to collapse or close pickers
  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      const targetNode = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(targetNode)) {
        if (!selectedDrawing) {
          setIsExpanded(false);
          setIsSpeedOpen(false);
        } else {
          setShowWidthPicker(false);
          setShowStylePicker(false);
          setShowLabelSettings(false);
        }
        setPendingTradeType(null);
      }
    };
    if (isExpanded || isSpeedOpen || selectedDrawing || pendingTradeType) {
      document.addEventListener('pointerdown', handleClickOutside, { capture: true, passive: true });
      document.addEventListener('mousedown', handleClickOutside, { capture: true, passive: true });
      document.addEventListener('touchstart', handleClickOutside, { capture: true, passive: true });
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside, { capture: true });
      document.removeEventListener('mousedown', handleClickOutside, { capture: true });
      document.removeEventListener('touchstart', handleClickOutside, { capture: true });
    };
  }, [isExpanded, isSpeedOpen, selectedDrawing, pendingTradeType]);

  // Check state categories for the active selected drawing
  const isForecasting = selectedDrawing && (selectedDrawing.type === DrawingType.LONG_POSITION || selectedDrawing.type === DrawingType.SHORT_POSITION);
  const isRectangle = selectedDrawing && selectedDrawing.type === DrawingType.RECTANGLE;
  const isClosedTrade = selectedDrawing && (selectedDrawing.status === 'won' || selectedDrawing.status === 'lost');

  // Let's decide if we are in morph mode (settings)
  const isMorphActive = !!selectedDrawing && !isClosedTrade;

  const sessionData = currentSessionKey ? backtestSessions?.[currentSessionKey] : null;
  const timeSyncEnabled = sessionData?.timeSyncEnabled || false;
  const activeTimeSyncSpeed = sessionData?.timeSyncSpeed || 60;

  if (favorites.length === 0 && !isMorphActive && !onCreateQuickTrade) return null;

  return (
    <div className="absolute inset-x-0 bottom-4 flex justify-center pointer-events-none z-[50]">
      <motion.div
        ref={containerRef}
        drag={true}
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={constraintsRef}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={(_e, info) => {
          const newPos = { x: pos.x + info.offset.x, y: pos.y + info.offset.y };
          onPosChange(newPos);
          setTimeout(() => setIsDragging(false), 50);
        }}
        whileDrag={{ scale: 1.02, cursor: 'grabbing' }}
        initial={false}
        animate={{ 
          opacity: 1, 
          scale: isMorphActive && isMobile ? 0.72 : isMobile ? 0.82 : 1.0, 
          x: pos.x, 
          y: pos.y,
          transition: { type: 'spring', damping: 30, stiffness: 400 }
        }}
        layout="position"
        className={`pointer-events-auto origin-bottom flex items-center bg-white/95 backdrop-blur border border-slate-200 shadow-2xl rounded-full cursor-move group relative ${isDragging ? 'ring-2 ring-blue-500/20' : 'hover:border-slate-300'}`}
      >
      {/* Setups list above the Buy/Sell text if there are multiple setups */}
      <AnimatePresence>
        {pendingTradeType && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute bottom-full mb-3.5 left-1/2 -translate-x-1/2 p-2 bg-white/95 backdrop-blur border border-slate-200 shadow-2xl rounded-2xl flex flex-col gap-1 z-[210] min-w-[170px]"
          >
            <div className="flex items-center justify-between px-2.5 py-1 text-[9px] font-black uppercase text-slate-400 tracking-wider border-b border-secondary-100 pb-1.5 mb-1.5 select-none">
              <span>Select Setup Category</span>
              <button 
                onClick={() => setPendingTradeType(null)}
                className="text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
              >
                <X size={10} className="stroke-[3px]" />
              </button>
            </div>
            {((setups || []).filter(s => (s.confluences && s.confluences.length > 0) || s.image_url)).map((setup) => (
              <button
                key={setup.grade}
                onClick={() => {
                  onCreateQuickTrade?.(pendingTradeType, setup.grade);
                  setPendingTradeType(null);
                }}
                className="w-full flex items-center justify-between text-left text-[11px] px-2.5 py-1.5 rounded-xl font-bold transition-all hover:bg-slate-500/10 active:scale-[0.98] cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 flex items-center justify-center rounded-md text-[9px] font-extrabold ${
                    setup.grade === 'A+' ? 'bg-emerald-500/15 text-emerald-600' :
                    setup.grade === 'B' ? 'bg-indigo-500/15 text-indigo-600' :
                    'bg-amber-500/15 text-amber-600'
                  }`}>
                    {setup.grade}
                  </div>
                  <span className="font-semibold text-slate-700">
                    {setup.grade === 'A+' ? 'Tier 1 Setup' : setup.grade === 'B' ? 'Secondary' : 'Tier 3 (Class C)'}
                  </span>
                </div>
                <span className="text-[8px] text-slate-400 font-mono font-bold">({setup.confluences?.length || 0})</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`flex items-center ${
        !isMorphActive && !isExpanded 
          ? 'p-1' 
          : 'p-1'
      } ${
        isMobileLandscape ? 'min-h-[5vh]' : isPortrait ? 'min-h-[30px]' : 'min-h-[36px]'
      }`}>
        <AnimatePresence mode="wait">
          {isMorphActive ? (
            /* Morph Settings Mode */
            <motion.div
              key="settings-morph"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center gap-1.5 md:gap-2 px-1 py-1 text-slate-700 font-semibold"
            >
              {/* Drag Handle block */}
              <div className="flex gap-[2px] pl-1 pr-1 py-1 cursor-grab active:cursor-grabbing shrink-0 text-slate-300 hover:text-slate-400">
                <div className="flex flex-col gap-[2px]">
                  <div className="w-[3px] h-[3px] bg-slate-400 rounded-full" />
                  <div className="w-[3px] h-[3px] bg-slate-400 rounded-full" />
                  <div className="w-[3px] h-[3px] bg-slate-400 rounded-full" />
                </div>
                <div className="flex flex-col gap-[2px]">
                  <div className="w-[3px] h-[3px] bg-slate-400 rounded-full" />
                  <div className="w-[3px] h-[3px] bg-slate-400 rounded-full" />
                  <div className="w-[3px] h-[3px] bg-slate-400 rounded-full" />
                </div>
              </div>

              <div className="w-px h-5 bg-slate-100 self-center" />

              {/* Color Customizers (No Labels!) */}
              <div className="flex items-center gap-1 shrink-0">
                {isForecasting ? (
                  <>
                    <ColorPicker 
                      color={selectedDrawing?.settings?.profitColor || 'rgba(0, 105, 92, 0.3)'}
                      onChange={(val) => onUpdateDrawing?.({ profitColor: val })}
                      compact={true}
                    />
                    <ColorPicker 
                      color={selectedDrawing?.settings?.lossColor || 'rgba(198, 40, 40, 0.3)'}
                      onChange={(val) => onUpdateDrawing?.({ lossColor: val })}
                      compact={true}
                    />
                  </>
                ) : isRectangle ? (
                  <>
                    <ColorPicker 
                      color={selectedDrawing?.settings?.strokeColor || selectedDrawing?.settings?.color || '#2962ff'}
                      onChange={(val) => onUpdateDrawing?.({ strokeColor: val, color: val })}
                      compact={true}
                    />
                    <ColorPicker 
                      color={selectedDrawing?.settings?.fillColor || '#2962ff33'}
                      onChange={(val) => onUpdateDrawing?.({ fillColor: val })}
                      compact={true}
                    />
                  </>
                ) : (
                  <ColorPicker 
                    color={selectedDrawing?.settings?.color || '#2962ff'}
                    onChange={(val) => onUpdateDrawing?.({ color: val })}
                    compact={true}
                  />
                )}
              </div>

              <div className="w-px h-5 bg-slate-100 self-center" />

              {/* Line Thickness Dropup Popup List (0.5px steps) */}
              {!isForecasting && (
                <div className="relative">
                  <button 
                    onClick={() => {
                      setShowWidthPicker(!showWidthPicker);
                      setShowStylePicker(false);
                    }}
                    className={`h-7 px-1.5 md:px-2 rounded-lg transition-all flex items-center gap-1 outline-none ${showWidthPicker ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                    title="Line Weight (px)"
                  >
                    <Layers size={isMobile ? 13 : 15} />
                    <span className="text-[10px] md:text-[11px] font-black tracking-tight min-w-[14px] leading-none">
                      {selectedDrawing?.settings?.lineWidth ?? selectedDrawing?.settings?.width ?? 1}
                    </span>
                  </button>
                  
                  <AnimatePresence>
                    {showWidthPicker && (
                      <motion.div
                        initial={{ opacity: 0, y: isMobile ? -6 : 6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: isMobile ? -6 : 6, scale: 0.95 }}
                        className={`absolute ${isMobile ? 'bottom-full' : 'top-full'} left-1/2 -translate-x-1/2 ${isMobile ? 'mb-2.5' : 'mt-2.5'} p-1.5 bg-white/95 backdrop-blur-md rounded-xl border border-slate-200/80 shadow-2xl flex flex-col gap-0.5 z-[210] min-w-[100px]`}
                      >
                        <div className="max-h-[160px] overflow-y-auto pr-1 flex flex-col gap-0.5 custom-scrollbar">
                          {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map(w => {
                            const currentVal = selectedDrawing?.settings?.lineWidth ?? selectedDrawing?.settings?.width ?? 1;
                            const isSelected = currentVal === w;
                            return (
                              <button
                                key={w}
                                onClick={() => {
                                  onUpdateDrawing?.({ lineWidth: w, width: w });
                                  setShowWidthPicker(false);
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-all flex items-center justify-between gap-3 ${isSelected ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'}`}
                              >
                                <span className="font-mono">{w}px</span>
                                <div className="w-8 flex items-center h-4">
                                  <div className="w-full bg-current rounded-full" style={{ height: `${Math.max(1, w * 1.5)}px` }} />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Line Style Dropup Popup List */}
              {!isForecasting && (
                <div className="relative">
                  <button 
                    onClick={() => {
                      setShowStylePicker(!showStylePicker);
                      setShowWidthPicker(false);
                    }}
                    className={`h-7 px-1.5 md:px-2 rounded-lg transition-all flex items-center gap-1 outline-none ${showStylePicker ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                    title="Line Style"
                  >
                    <div className="scale-75">
                      {LINE_STYLES.find(s => s.id === (selectedDrawing?.settings?.lineStyle ?? selectedDrawing?.settings?.style ?? 'solid'))?.icon ?? LINE_STYLES[0].icon}
                    </div>
                  </button>
                  
                  <AnimatePresence>
                    {showStylePicker && (
                      <motion.div
                        initial={{ opacity: 0, y: isMobile ? -6 : 6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: isMobile ? -6 : 6, scale: 0.95 }}
                        className={`absolute ${isMobile ? 'bottom-full' : 'top-full'} left-1/2 -translate-x-1/2 ${isMobile ? 'mb-2.5' : 'mt-2.5'} p-1.5 bg-white/95 backdrop-blur-md rounded-xl border border-slate-200/80 shadow-2xl flex flex-col gap-0.5 z-[210] min-w-[110px]`}
                      >
                        {LINE_STYLES.map(style => {
                          const currentVal = selectedDrawing?.settings?.lineStyle ?? selectedDrawing?.settings?.style ?? 'solid';
                          const isSelected = currentVal === style.id;
                          return (
                            <button
                              key={style.id}
                              onClick={() => {
                                onUpdateDrawing?.({ lineStyle: style.id, style: style.id });
                                setShowStylePicker(false);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-between gap-3 ${isSelected ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'}`}
                            >
                              <span className="capitalize">{style.id}</span>
                              <div className="text-current scale-75 opacity-80">{style.icon}</div>
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div className="w-px h-5 bg-slate-100 self-center" />

              {/* Lock / Unlock */}
              <button
                onClick={() => onUpdateDrawing?.({ locked: !selectedDrawing?.settings?.locked })}
                className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors outline-none ${
                  selectedDrawing?.settings?.locked ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
                title={selectedDrawing?.settings?.locked ? 'Unlock Drawing' : 'Lock Drawing'}
              >
                {selectedDrawing?.settings?.locked ? <Lock size={isMobile ? 12 : 14} /> : <Unlock size={12} />}
              </button>

              {selectedDrawing && onUpdateDrawing && (
                <GeneralDrawingSettingsPopover 
                  drawing={selectedDrawing} 
                  onUpdate={onUpdateDrawing} 
                  isMobile={isMobile} 
                />
              )}

              {/* Label Settings popover */}
              {selectedDrawing && onUpdateDrawing && (
                <div className="relative" ref={labelSettingsRef}>
                  <button
                    onClick={() => {
                      setShowLabelSettings(!showLabelSettings);
                      setShowWidthPicker(false);
                      setShowStylePicker(false);
                    }}
                    className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors outline-none ${showLabelSettings ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
                    title="Text Label"
                  >
                    <Type size={isMobile ? 13 : 15} />
                  </button>

                  <AnimatePresence>
                    {showLabelSettings && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: isMobile ? -8 : 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: isMobile ? -8 : 8 }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className={`absolute ${isMobile ? 'bottom-full mb-3' : 'top-full mt-3'} left-1/2 -translate-x-1/2 bg-white rounded-2xl border border-slate-200/95 shadow-2xl p-4 w-[280px] z-[310]`}
                      >
                        <div className="flex border-b border-slate-100 pb-2.5 mb-3.5 items-center gap-1.5 text-slate-800 font-bold text-xs">
                          <Type size={14} className="text-indigo-600" />
                          <span>Text Label Settings</span>
                        </div>

                        <div className="space-y-4">
                          {/* Text Input */}
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 block tracking-wider uppercase">Label Text</label>
                            <input
                              type="text"
                              value={selectedDrawing.settings?.labelText || ''}
                              onChange={(e) => onUpdateDrawing({ labelText: e.target.value })}
                              placeholder="Add label to drawing..."
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-indigo-500 text-slate-805 placeholder:text-slate-400 font-medium outline-none"
                            />
                          </div>

                          {/* Font Color */}
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">Label Color</span>
                            <ColorPicker
                              color={selectedDrawing.settings?.labelColor || selectedDrawing.settings?.color || '#000000'}
                              onChange={(color) => onUpdateDrawing({ labelColor: color })}
                              compact={true}
                            />
                          </div>

                          {/* Font Size Selector */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">Label Size</span>
                              <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                {(selectedDrawing.settings?.labelSize !== undefined ? Number(selectedDrawing.settings.labelSize) : 1.0).toFixed(1)}x
                              </span>
                            </div>
                            {/* Size pills */}
                            <div className="grid grid-cols-4 gap-1">
                              {[0.2, 0.5, 0.8, 1.0, 1.2, 1.5, 2.0, 3.0, 4.0].map(sz => {
                                const currentSize = selectedDrawing.settings?.labelSize !== undefined ? Number(selectedDrawing.settings.labelSize) : 1.0;
                                const isChosen = Math.abs(currentSize - sz) < 0.01;
                                return (
                                  <button
                                    key={sz}
                                    onClick={() => onUpdateDrawing({ labelSize: sz })}
                                    className={`px-1 py-0.5 text-[9px] font-bold rounded border transition-all ${isChosen ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                  >
                                    {sz}x
                                  </button>
                                );
                              })}
                            </div>
                            {/* Fine-grain slider */}
                            <input
                              type="range"
                              min="0.2"
                              max="4.0"
                              step="0.1"
                              value={selectedDrawing.settings?.labelSize !== undefined ? Number(selectedDrawing.settings.labelSize) : 1.0}
                              onChange={(e) => onUpdateDrawing({ labelSize: parseFloat(e.target.value) })}
                              className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                          </div>

                          {/* Horizontal Alignment */}
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">Horizontal Align</span>
                            <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-100">
                              {['left', 'center', 'right'].map(align => {
                                const active = selectedDrawing.settings?.labelAlign === align || (!selectedDrawing.settings?.labelAlign && align === 'right');
                                return (
                                  <button
                                    key={align}
                                    onClick={() => onUpdateDrawing({ labelAlign: align })}
                                    className={`px-2 py-0.5 text-[9px] font-bold rounded-md capitalize transition-all ${active ? 'bg-white shadow-sm text-slate-900 border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                  >
                                    {align}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Vertical Position / Align */}
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">Vertical Position</span>
                            <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-100">
                              {['top', 'middle', 'bottom'].map(pos => {
                                const active = selectedDrawing.settings?.labelPos === pos || (!selectedDrawing.settings?.labelPos && pos === 'top');
                                return (
                                  <button
                                    key={pos}
                                    onClick={() => onUpdateDrawing({ labelPos: pos })}
                                    className={`px-2 py-0.5 text-[9px] font-bold rounded-md capitalize transition-all ${active ? 'bg-white shadow-sm text-slate-900 border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                  >
                                    {pos}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Label Background box */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                            <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">Containers</span>
                            <button
                              onClick={() => onUpdateDrawing({ showLabelBackground: selectedDrawing.settings?.showLabelBackground === false ? true : false })}
                              className={`w-7 h-3.5 rounded-full p-0.5 transition-colors bg-slate-200 ${selectedDrawing.settings?.showLabelBackground !== false ? 'bg-indigo-600' : 'bg-slate-200'}`}
                            >
                              <motion.div
                                animate={{ x: selectedDrawing.settings?.showLabelBackground !== false ? 14 : 0 }}
                                className="w-2.5 h-2.5 bg-white rounded-full shadow"
                              />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Delete trash button */}
              {onDeleteDrawing && (
                <button
                  onClick={onDeleteDrawing}
                  className="h-7 w-7 flex items-center justify-center rounded-lg transition-colors outline-none text-red-500 hover:bg-red-50 hover:text-red-650"
                  title="Delete Drawing"
                >
                  <Trash2 size={isMobile ? 12 : 14} />
                </button>
              )}

              {/* Close Button deselect */}
              {onCloseDrawing && (
                <button
                  onClick={onCloseDrawing}
                  className="h-7 w-7 flex items-center justify-center rounded-lg transition-colors outline-none text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  title="Close Settings"
                >
                  <X size={12} />
                </button>
              )}
            </motion.div>
          ) : (
            /* Normal Favorites Toolbar Mode: Now includes BUY and SELL buttons directly */
            <div className="flex items-center gap-1 px-1 py-0.5">
              {onCreateQuickTrade && (
                <div className="flex items-center gap-1 shrink-0">
                  {/* Buy Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const activeSetups = (setups || []).filter(s => (s.confluences && s.confluences.length > 0) || s.image_url);
                      if (activeSetups.length > 1) {
                        setPendingTradeType('buy');
                      } else {
                        onCreateQuickTrade?.('buy', activeSetups[0]?.grade);
                      }
                    }}
                    className="h-7 px-3 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] md:text-[11px] uppercase tracking-wider shadow-md hover:shadow-emerald-500/25 transition-all flex items-center justify-center active:scale-95 cursor-pointer max-h-7 leading-none"
                  >
                    Buy
                  </button>

                  {/* Sell Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const activeSetups = (setups || []).filter(s => (s.confluences && s.confluences.length > 0) || s.image_url);
                      if (activeSetups.length > 1) {
                        setPendingTradeType('sell');
                      } else {
                        onCreateQuickTrade?.('sell', activeSetups[0]?.grade);
                      }
                    }}
                    className="h-7 px-3 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-black text-[10px] md:text-[11px] uppercase tracking-wider shadow-md hover:shadow-rose-500/25 transition-all flex items-center justify-center active:scale-95 cursor-pointer max-h-7 leading-none"
                  >
                    Sell
                  </button>

                  {/* Divider line before Favorites collapsible menu */}
                  <div className="w-px h-5 bg-slate-200/80 mx-1 shrink-0" />
                </div>
              )}

              {!isExpanded ? (
                /* Regular Collapsed star trigger button */
                <motion.button
                  key="collapsed-trigger"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => {
                    if (!isDragging) {
                      if (activeTool) {
                        onSelectTool(null);
                      } else {
                        setFavoritesExpanded(true);
                      }
                    }
                  }}
                  className={`rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    activeTool 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                      : 'text-amber-500 hover:text-amber-600 hover:bg-amber-50/55'
                  } ${
                    isMobileLandscape 
                      ? 'p-[1.4vh] min-w-[4.5vh] min-h-[4.5vh]' 
                      : isPortrait 
                        ? 'p-1.5 min-w-[28px] min-h-[28px]' 
                        : 'p-1.5 min-w-[30px] min-h-[30px]'
                  }`}
                  title={activeTool ? `Cancel Active ${activeTool.replace('_', ' ')}` : "Expand Favorites"}
                >
                  {activeTool ? (
                    (() => {
                      const ActiveIcon = TOOL_ICONS[activeTool] || Star;
                      return <ActiveIcon size={isMobileLandscape ? '3vh' : isPortrait ? 11 : 16} strokeWidth={2.8} />;
                    })()
                  ) : (
                    <Star size={isMobileLandscape ? '3.5vh' : isPortrait ? 13 : 18} fill="currentColor" strokeWidth={2.5} />
                  )}
                </motion.button>
              ) : (
                /* Regular Favorites list */
                <motion.div
                  key="expanded"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="flex items-center"
                >
                  <div className={`flex items-center ${isMobileLandscape ? 'gap-[1.2vh] p-[0.8vh]' : isPortrait ? 'gap-1 p-0.5' : 'gap-1 px-1'}`}>
                    {favorites.map(toolId => {
                      const Icon = TOOL_ICONS[toolId] || Star;
                      return (
                        <button
                          key={toolId}
                          onClick={() => {
                            if (!isDragging) {
                              onSelectTool(activeTool === toolId ? null : toolId);
                              setFavoritesExpanded(false); // Auto-collapse to float favorite so they can draw on screen!
                            }
                          }}
                          className={`${isMobileLandscape ? 'p-[1.5vh]' : isPortrait ? 'p-1' : 'p-1 mx-0.5'} rounded-xl transition-all shrink-0 ${activeTool === toolId ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-50'}`}
                          title={toolId}
                        >
                          <Icon size={isMobileLandscape ? '4.5vh' : isPortrait ? 12 : 18} strokeWidth={2.5} />
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Play Segment (Combined with the toolbar in desktop/landscape view) */}
              {(!isMobile || isMobileLandscape) && (
                <>
                  <div className="w-px h-5 bg-slate-200/80 mx-1 shrink-0" />
                  {(!isSimulating && !isReplayMode && !simIsPlaying) ? (
                    /* Play button launcher when not active */
                    <button
                      onClick={() => setIsSimulating?.(true)}
                      className="h-7 w-7 flex items-center justify-center rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-md active:scale-95 transition-all cursor-pointer shrink-0 ml-1"
                      title="Start Simulation"
                    >
                      <Play size={10} fill="currentColor" />
                    </button>
                  ) : (
                    /* Active playback controls segment in one bar */
                    <div className="flex items-center gap-1">
                      {/* Play/Pause Button */}
                      <button
                        onClick={togglePlayback}
                        className={`w-7 h-7 flex items-center justify-center rounded-full transition-all ${(isReplayMode ? replayIsPlaying : simIsPlaying) ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-900 text-white shadow-md'}`}
                        title={(isReplayMode ? replayIsPlaying : simIsPlaying) ? "Pause" : "Play"}
                      >
                        {(isReplayMode ? replayIsPlaying : simIsPlaying) ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                      </button>

                      {/* Step Forward Button */}
                      <button
                        onClick={() => {
                          if (isReplayMode) {
                            setReplayCurrentTime?.((prev: number) => {
                              const current = prev || (replayTrade ? replayTrade.entryTime : 0);
                              const currentData = historicalDataRef?.current;
                              const nextCandle = currentData?.find((c: any) => c.time > current);
                              return nextCandle ? nextCandle.time : current + (getStepSeconds?.() || 60);
                            });
                          } else {
                            const sessionKey = currentSessionKey || '';
                            const session = sessionKey ? (backtestSessions?.[sessionKey] || (selectedSymbol ? backtestSessions?.[activePrefix ? `${selectedSymbol}_${activePrefix}` : selectedSymbol] : null)) : null;
                            
                            if (!session) {
                              addNotification?.('No backtest session found', 'error');
                              return;
                            }

                            const current = sessionCurrentTimesRef?.current?.[sessionKey] || session.currentTime || session.startTime;
                            const currentData = historicalDataRef?.current;
                            const nextCandle = currentData?.find((c: any) => c.time > current);
                            const next = nextCandle ? nextCandle.time : current + (getStepSeconds?.() || 60);
                            
                            if (session.endTime && next > session.endTime) {
                              addNotification?.('Cannot move beyond session end date', 'warning');
                              return;
                            }

                            if (sessionCurrentTimesRef?.current) {
                              sessionCurrentTimesRef.current[sessionKey] = next;
                            }
                            setSimCurrentTime?.(next);
                          }
                        }}
                        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-full transition-all"
                        title="Step Forward"
                      >
                        <SkipForward size={10} />
                      </button>

                      {/* Speed Controller display */}
                      <div className="relative font-bold text-slate-650">
                        <button
                          onClick={() => setSpeedDropdownOpen(!isSpeedOpen)}
                          className={`h-7 px-2 flex items-center justify-center gap-0.5 rounded-full transition-all ${isSpeedOpen ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-400 hover:text-slate-900'}`}
                          title="Play Speed"
                        >
                          <span className="text-[9px] font-black leading-none">
                            {timeSyncEnabled ? 'Sync' : `${simSpeed}x`}
                          </span>
                          <ChevronUp size={7} strokeWidth={4} className={`transition-transform duration-300 ${isSpeedOpen ? 'rotate-180' : 'opacity-40'}`} />
                        </button>

                        <AnimatePresence>
                          {isSpeedOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="absolute bottom-full right-0 translate-x-1/4 mb-2 bg-white border border-slate-150 rounded-2xl shadow-xl p-2.5 w-48 overflow-hidden z-[110] flex flex-col gap-2"
                              onMouseDown={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              {/* Header */}
                              <div className="flex items-center justify-between border-b border-slate-50 pb-1">
                                <span className="text-[8px] font-extrabold uppercase tracking-wider text-slate-400">Play Speed</span>
                                {timeSyncEnabled && (
                                  <span className="text-[7.5px] bg-green-50 text-green-600 font-bold px-1 py-0.5 rounded animate-pulse">Sync Active</span>
                                )}
                              </div>

                              {/* speed list triggers */}
                              <div className="flex flex-col gap-1 text-left">
                                <span className="text-[7.5px] font-bold text-slate-400">Normal Speed</span>
                                <div className="grid grid-cols-4 gap-1">
                                  {[1, 2, 3, 4].map(s => {
                                    const active = !timeSyncEnabled && simSpeed === s;
                                    return (
                                      <button
                                        key={s}
                                        onClick={() => {
                                          setSimSpeed?.(s);
                                          if (currentSessionKey && sessionData) {
                                            setBacktestSessions?.((prev: any) => ({
                                              ...prev,
                                              [currentSessionKey]: {
                                                ...prev[currentSessionKey],
                                                timeSyncEnabled: false,
                                                timeSyncLastTimestamp: undefined
                                              }
                                            }));
                                          }
                                          setSpeedDropdownOpen(false);
                                        }}
                                        className={`py-1 text-[8px] font-black rounded transition-all ${active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 bg-slate-50'}`}
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
                                    <span className="text-[8px] font-extrabold text-slate-800 flex items-center gap-0.5">
                                      {subscriptionPlan === 'basic' && <Lock size={7} className="text-slate-400 stroke-[2.5]" />}
                                      Time Sync
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowSyncInfoModal?.(true);
                                      }}
                                      className="text-slate-400 hover:text-indigo-600 transition-colors p-0.5 rounded flex items-center justify-center font-bold"
                                      title="What is Time Sync?"
                                    >
                                      <span className="text-[7px]">?</span>
                                    </button>
                                  </div>
                                  <span className="text-[6.5px] text-slate-400 leading-none">Real-time intervals</span>
                                </div>
                                <button
                                  onClick={() => {
                                    if (!currentSessionKey) {
                                      addNotification?.("Please select an active backtest session", 'warning');
                                      return;
                                    }
                                    if (subscriptionPlan === 'basic') {
                                      onLockedFeature?.('timesync');
                                      return;
                                    }
                                    const nextEnabled = !timeSyncEnabled;
                                    setBacktestSessions?.((prev: any) => ({
                                      ...prev,
                                      [currentSessionKey]: {
                                        ...prev[currentSessionKey],
                                        timeSyncEnabled: nextEnabled,
                                        timeSyncSpeed: activeTimeSyncSpeed,
                                        timeSyncLastTimestamp: nextEnabled ? Date.now() : undefined
                                      }
                                    }));
                                  }}
                                  className={`w-7 h-3.5 rounded-full p-0.5 transition-colors duration-200 outline-none ${timeSyncEnabled ? 'bg-indigo-600' : 'bg-slate-200'} ${subscriptionPlan === 'basic' ? 'bg-slate-200/85 saturate-50 cursor-not-allowed' : ''}`}
                                >
                                  <div className={`w-2.5 h-2.5 bg-white rounded-full shadow-sm transition-transform duration-200 ${timeSyncEnabled ? 'translate-x-3.5' : 'translate-x-0'}`} />
                                </button>
                              </div>

                              {timeSyncEnabled && (
                                <div className="flex flex-col gap-1 border-t border-slate-50 pt-1 text-left">
                                  <span className="text-[7.5px] font-bold text-slate-400">Time Sync Rate</span>
                                  <div className="flex flex-col gap-0.5 max-h-[100px] overflow-y-auto pr-0.5 scrollbar-none">
                                    {[
                                      { label: "1m candle = 60s", value: 60 },
                                      { label: "1m candle = 30s", value: 30 },
                                      { label: "1m candle = 15s", value: 15 },
                                      { label: "1m candle = 10s", value: 10 },
                                      { label: "1m candle = 5s", value: 5 },
                                      { label: "1m candle = 2.5s", value: 2.5 }
                                    ].map(opt => (
                                      <button
                                        key={opt.value}
                                        onClick={() => {
                                          if (subscriptionPlan === 'basic') {
                                            onLockedFeature?.('timesync');
                                            return;
                                          }
                                          if (currentSessionKey) {
                                            setBacktestSessions?.((prev: any) => ({
                                              ...prev,
                                              [currentSessionKey]: {
                                                ...prev[currentSessionKey],
                                                timeSyncEnabled: true,
                                                timeSyncSpeed: opt.value,
                                                timeSyncLastTimestamp: Date.now()
                                              }
                                            }));
                                          }
                                        }}
                                        className={`w-full text-left px-1 py-0.5 text-[7.5px] font-bold rounded flex items-center justify-between ${activeTimeSyncSpeed === opt.value ? 'bg-indigo-50 text-indigo-700 font-extrabold' : 'text-slate-600 hover:bg-slate-50'}`}
                                      >
                                        <span>{opt.label}</span>
                                        {activeTimeSyncSpeed === opt.value && <div className="w-1 h-1 rounded-full bg-indigo-600" />}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Exit / Stop Button */}
                      <button
                        onClick={() => {
                          if (isReplayMode) {
                            exitReplay?.();
                          } else {
                            setIsSimulating?.(false);
                            setSimIsPlaying?.(false);
                          }
                        }}
                        className="w-7 h-7 flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-full transition-all"
                        title="Close Simulation"
                      >
                        <X size={10} strokeWidth={2.8} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Visual handle indicator only visible on hover */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-slate-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  </div>
  );
});
