import { motion, AnimatePresence } from 'motion/react';
import { 
  Palette, 
  Trash2, 
  Settings2, 
  Layers, 
  Lock, 
  Unlock,
  Eye,
  EyeOff,
  Minus,
  Plus,
  TrendingUp,
  MoveVertical,
  MoveHorizontal,
  ArrowRight,
  Square,
  Route,
  Pencil,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowUpDown,
  CalendarDays,
  Navigation,
  AlignJustify,
  Type
} from 'lucide-react';
import { Drawing, DrawingType } from '../types/drawing';
import { useState, useEffect, useRef } from 'react';
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

interface DrawingSettingsBoxProps {
  drawing: Drawing;
  onUpdate: (settings: Partial<Drawing['settings']>) => void;
  onDelete: () => void;
  onClose: () => void;
  pos?: {x: number, y: number} | null;
  onPosChange?: (p: {x: number, y: number}) => void;
}

const LINE_STYLES = [
  { id: 'solid', icon: <div className="w-6 h-0.5 bg-current" /> },
  { id: 'dashed', icon: <div className="flex gap-1"><div className="w-1.5 h-0.5 bg-current" /><div className="w-1.5 h-0.5 bg-current" /><div className="w-1.5 h-0.5 bg-current" /></div> },
  { id: 'dotted', icon: <div className="flex gap-0.5"><div className="w-0.5 h-0.5 bg-current rounded-full" /><div className="w-0.5 h-0.5 bg-current rounded-full" /><div className="w-0.5 h-0.5 bg-current rounded-full" /></div> }
];

export function DrawingSettingsBox({ drawing, onUpdate, onDelete, onClose, pos, onPosChange }: DrawingSettingsBoxProps) {
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [showWidthPicker, setShowWidthPicker] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showLabelSettings, setShowLabelSettings] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  const advancedMenuRef = useRef<HTMLDivElement>(null);
  const labelSettingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobileLandscape = isMobile && !isPortrait;

  const isForecasting = drawing.type === DrawingType.LONG_POSITION || drawing.type === DrawingType.SHORT_POSITION;
  const isFib = drawing.type === DrawingType.FIB_RETRACEMENT;
  
  const isClosed = drawing.status === 'won' || drawing.status === 'lost';
  const isTriggeredAndOngoing = isForecasting && drawing.isTriggered && !isClosed;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (advancedMenuRef.current && !advancedMenuRef.current.contains(e.target as Node)) {
        setShowAdvancedSettings(false);
      }
    };
    if (showAdvancedSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAdvancedSettings]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (labelSettingsRef.current && !labelSettingsRef.current.contains(e.target as Node)) {
        setShowLabelSettings(false);
      }
    };
    if (showLabelSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLabelSettings]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      // Don't close if actively typing in an input
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.tagName === 'SELECT' ||
        activeEl.hasAttribute('contenteditable')
      )) {
        return;
      }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const defaultFibLevels = [
    { value: 0, color: '#787b86', visible: true },
    { value: 0.236, color: '#f23645', visible: true },
    { value: 0.382, color: '#ff9800', visible: true },
    { value: 0.5, color: '#4caf50', visible: true },
    { value: 0.618, color: '#089981', visible: true },
    { value: 0.786, color: '#2196f3', visible: true },
    { value: 1, color: '#787b86', visible: true }
  ];

  const [currentFibLevels = defaultFibLevels] = [drawing.settings.levels];

  const updateFibLevel = (index: number, updates: any) => {
    const newLevels = [...currentFibLevels];
    newLevels[index] = { ...newLevels[index], ...updates };
    onUpdate({ levels: newLevels });
  };

  return (
    <motion.div
      drag={true}
      dragMomentum={false}
      dragElastic={0}
      onDragEnd={(_e, info) => {
        const newPos = { x: info.offset.x + (pos?.x || 0), y: info.offset.y + (pos?.y || 0) };
        onPosChange?.(newPos);
      }}
      initial={pos ? { opacity: 0, x: pos.x, y: pos.y, scale: 0.7 } : { opacity: 0, y: 10, scale: 0.7 }}
      animate={pos ? { opacity: 1, x: pos.x, y: pos.y, scale: isMobile ? 0.78 : 1 } : { opacity: 1, y: 0, scale: isMobile ? 0.78 : 1 }}
      exit={{ opacity: 0, scale: 0.7 }}
      className={`fixed ${isMobile ? (isMobileLandscape ? 'top-4' : 'bottom-24 top-auto') : 'top-20'} left-1/2 -translate-x-1/2 z-[200] flex items-center md:gap-1.5 gap-1 p-1 bg-white/95 backdrop-blur shadow-2xl rounded-full border border-slate-200/90 min-w-max cursor-move active:cursor-grabbing transition-all duration-300`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Visual Drag Grip Handle */}
      <div className="flex gap-[2px] pl-2 pr-0.5 py-1 cursor-grab active:cursor-grabbing shrink-0 text-slate-300 hover:text-slate-400">
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

      {/* Main Color Toggle */}
      {!isForecasting && drawing.type !== DrawingType.RECTANGLE && (
        <div className="flex items-center shrink-0">
          <ColorPicker 
            color={drawing.settings.color || '#000000'}
            onChange={(color) => onUpdate({ color })}
            compact={true}
          />
        </div>
      )}

      {/* Specialized Colors for Rectangle (No Labels) */}
      {drawing.type === DrawingType.RECTANGLE && (
        <div className="flex items-center gap-1 shrink-0">
          <ColorPicker 
            color={drawing.settings.strokeColor || drawing.settings.color || '#2962ff'}
            onChange={(strokeColor) => onUpdate({ strokeColor })}
            compact={true}
          />
          <ColorPicker 
            color={drawing.settings.fillColor || (drawing.settings.color || '#2962ff') + '33'}
            onChange={(fillColor) => onUpdate({ fillColor })}
            compact={true}
          />
        </div>
      )}

      {/* Specialized Colors for Long/Short (No Labels) */}
      {isForecasting && (
        <div className="flex items-center gap-1 shrink-0">
          <ColorPicker 
            color={drawing.settings.profitColor || 'rgba(0, 105, 92, 0.3)'}
            onChange={(profitColor) => onUpdate({ profitColor })}
            compact={true}
          />
          <ColorPicker 
            color={drawing.settings.lossColor || 'rgba(198, 40, 40, 0.3)'}
            onChange={(lossColor) => onUpdate({ lossColor })}
            compact={true}
          />
        </div>
      )}

      <div className="w-px h-5 bg-slate-100 self-center" />

      <div className="flex items-center md:gap-0.5 gap-0.25">
        {/* Line Width - Scrollable Drop-up Menu */}
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
            <span className="text-[10px] md:text-[11px] font-black tracking-tight min-w-[14px] leading-none">{drawing.settings.lineWidth ?? drawing.settings.width ?? 1}</span>
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
                    const currentVal = drawing.settings.lineWidth ?? drawing.settings.width ?? 1;
                    const isSelected = currentVal === w;
                    return (
                      <button
                        key={w}
                        onClick={() => {
                          onUpdate({ lineWidth: w, width: w });
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

        {/* Line Style - Drop-up Menu */}
        <div className="relative">
          <button 
            onClick={() => {
              setShowStylePicker(!showStylePicker);
              setShowWidthPicker(false);
            }}
            className={`h-7 md:px-2 px-1.5 rounded-lg transition-all flex items-center outline-none ${showStylePicker ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
            title="Line Style"
          >
            <div className="scale-75">
              {LINE_STYLES.find(s => s.id === (drawing.settings.lineStyle ?? drawing.settings.style ?? 'solid'))?.icon}
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
                  const currentVal = drawing.settings.lineStyle ?? drawing.settings.style ?? 'solid';
                  const isSelected = currentVal === style.id;
                  return (
                    <button
                      key={style.id}
                      onClick={() => {
                        onUpdate({ lineStyle: style.id as any, style: style.id as any });
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

        <div className="w-px h-5 bg-slate-100 self-center" />

        <button 
          onClick={() => onUpdate({ hidden: !drawing.settings.hidden })}
          className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors outline-none ${drawing.settings.hidden ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
          title="Toggle Visibility"
        >
          {drawing.settings.hidden ? <EyeOff size={isMobile ? 13 : 15} /> : <Eye size={isMobile ? 13 : 15} />}
        </button>

        <button 
          onClick={() => onUpdate({ locked: !drawing.settings.locked })}
          className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors outline-none ${drawing.settings.locked ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
          title="Lock/Unlock Drawing"
        >
          {drawing.settings.locked ? <Lock size={isMobile ? 13 : 15} /> : <Unlock size={isMobile ? 12 : 14} />}
        </button>

        <GeneralDrawingSettingsPopover drawing={drawing} onUpdate={onUpdate} isMobile={isMobile} />

        {/* Label Settings popover */}
        <div className="relative" ref={labelSettingsRef}>
          <button
            onClick={() => {
              setShowLabelSettings(!showLabelSettings);
              setShowWidthPicker(false);
              setShowStylePicker(false);
              setShowAdvancedSettings(false);
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
                      value={drawing.settings.labelText || ''}
                      onChange={(e) => onUpdate({ labelText: e.target.value })}
                      placeholder="Add label to drawing..."
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-indigo-500 text-slate-805 placeholder:text-slate-400 font-medium outline-none"
                    />
                  </div>

                  {/* Font Color */}
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">Label Color</span>
                    <ColorPicker
                      color={drawing.settings.labelColor || drawing.settings.color || '#000000'}
                      onChange={(color) => onUpdate({ labelColor: color })}
                      compact={true}
                    />
                  </div>

                  {/* Font Size Selector */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">Label Size</span>
                      <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {(drawing.settings.labelSize !== undefined ? Number(drawing.settings.labelSize) : 1.0).toFixed(1)}x
                      </span>
                    </div>
                    {/* Size pills */}
                    <div className="grid grid-cols-4 gap-1">
                      {[0.2, 0.5, 0.8, 1.0, 1.2, 1.5, 2.0, 3.0, 4.0].map(sz => {
                        const currentSize = drawing.settings.labelSize !== undefined ? Number(drawing.settings.labelSize) : 1.0;
                        const isChosen = Math.abs(currentSize - sz) < 0.01;
                        return (
                          <button
                            key={sz}
                            onClick={() => onUpdate({ labelSize: sz })}
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
                      value={drawing.settings.labelSize !== undefined ? Number(drawing.settings.labelSize) : 1.0}
                      onChange={(e) => onUpdate({ labelSize: parseFloat(e.target.value) })}
                      className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  {/* Horizontal Alignment */}
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">Horizontal Align</span>
                    <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-100">
                      {['left', 'center', 'right'].map(align => {
                        const active = drawing.settings.labelAlign === align || (!drawing.settings.labelAlign && align === 'right');
                        return (
                          <button
                            key={align}
                            onClick={() => onUpdate({ labelAlign: align })}
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
                        const active = drawing.settings.labelPos === pos || (!drawing.settings.labelPos && pos === 'top');
                        return (
                          <button
                            key={pos}
                            onClick={() => onUpdate({ labelPos: pos })}
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
                      onClick={() => onUpdate({ showLabelBackground: drawing.settings.showLabelBackground === false ? true : false })}
                      className={`w-7 h-3.5 rounded-full p-0.5 transition-colors bg-slate-200 ${drawing.settings.showLabelBackground !== false ? 'bg-indigo-600' : 'bg-slate-200'}`}
                    >
                      <motion.div
                        animate={{ x: drawing.settings.showLabelBackground !== false ? 14 : 0 }}
                        className="w-2.5 h-2.5 bg-white rounded-full shadow"
                      />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {isFib && (
          <div className="relative">
            <button 
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className={`h-7 w-7 flex items-center justify-center transition-colors rounded-lg outline-none ${showAdvancedSettings ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
              title="Fibonacci Settings"
            >
              <Settings2 size={isMobile ? 13 : 15} />
            </button>

            <AnimatePresence>
              {showAdvancedSettings && (
                <motion.div
                  ref={advancedMenuRef}
                  initial={{ opacity: 0, scale: 0.95, y: isMobile ? -10 : 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: isMobile ? -10 : 10 }}
                  className={`absolute ${isMobile ? 'bottom-full' : 'top-full'} right-0 ${isMobile ? 'mb-4' : 'mt-4'} bg-white p-3 md:p-4 rounded-2xl border border-slate-200 shadow-2xl min-w-[280px] md:min-w-[300px] z-[300]`}
                >
                  <h3 className="text-xs font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Settings2 size={12} /> Fibonacci Levels
                  </h3>

                  <div className="space-y-2 max-h-[250px] md:max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {currentFibLevels.map((lvl: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 py-1">
                        <input 
                          type="checkbox" 
                          checked={lvl.visible}
                          onChange={(e) => updateFibLevel(idx, { visible: e.target.checked })}
                          className="w-3.5 h-3.5 rounded border-slate-300 transition-colors cursor-pointer"
                        />
                        <span className="text-[10px] font-mono font-bold w-12 text-slate-500">{lvl.value.toFixed(3)}</span>
                        <div className="flex-1 h-px bg-slate-100" />
                        <ColorPicker 
                          color={lvl.color}
                          onChange={(color) => updateFibLevel(idx, { color })}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] md:text-[10px] font-bold text-slate-500">Label Alignment</span>
                      <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-100">
                        {['left', 'center', 'right'].map(align => (
                          <button
                            key={align}
                            onClick={() => onUpdate({ labelAlign: align })}
                            className={`px-1.5 md:px-2 py-1 text-[8px] md:text-[9px] font-bold rounded-md transition-all capitalize ${drawing.settings.labelAlign === align || (!drawing.settings.labelAlign && align === 'right') ? 'bg-white shadow-sm text-slate-900 border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            {align}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[9px] md:text-[10px] font-bold text-slate-500">Label Position</span>
                      <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-100">
                        {['top', 'middle', 'bottom'].map(pos => (
                          <button
                            key={pos}
                            onClick={() => onUpdate({ labelPos: pos })}
                            className={`px-1.5 md:px-2 py-1 text-[8px] md:text-[9px] font-bold rounded-md transition-all capitalize ${drawing.settings.labelPos === pos || (!drawing.settings.labelPos && pos === 'top') ? 'bg-white shadow-sm text-slate-900 border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            {pos}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[9px] md:text-[10px] font-bold text-slate-500">Background Fill</span>
                      <button 
                        onClick={() => onUpdate({ showBackground: drawing.settings.showBackground === false ? true : false })}
                        className={`w-7 md:w-8 h-3.5 md:h-4 rounded-full p-0.5 transition-colors ${drawing.settings.showBackground !== false ? 'bg-black' : 'bg-slate-200'}`}
                      >
                        <motion.div 
                          animate={{ x: drawing.settings.showBackground !== false ? (isMobile ? 14 : 16) : 0 }}
                          className="w-2.5 md:w-3 h-2.5 md:h-3 bg-white rounded-full shadow-sm"
                        />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="w-px h-5 bg-slate-100 self-center" />

        <button 
          onClick={onDelete}
          className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors outline-none ${
            isTriggeredAndOngoing 
              ? 'text-slate-300 cursor-not-allowed bg-slate-50' 
              : 'text-red-500 hover:bg-red-50 hover:text-red-600'
          }`}
          title={isTriggeredAndOngoing ? "Cannot delete active ongoing position" : "Delete Drawing"}
          disabled={isTriggeredAndOngoing}
        >
          <Trash2 size={isMobile ? 13 : 15} />
        </button>
      </div>
    </motion.div>
  );
}
