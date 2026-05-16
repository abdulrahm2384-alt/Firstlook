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
  TrendingDown
} from 'lucide-react';
import { Drawing, DrawingType } from '../types/drawing';
import { useState, useEffect, useRef } from 'react';
import { ColorPicker } from './ColorPicker';

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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  const advancedMenuRef = useRef<HTMLDivElement>(null);

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
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.addEventListener('keydown', handleEsc);
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
      drag={!isMobile}
      dragMomentum={false}
      dragElastic={0}
      onDragEnd={(_e, info) => {
        const newPos = { x: info.offset.x + (pos?.x || 0), y: info.offset.y + (pos?.y || 0) };
        onPosChange?.(newPos);
      }}
      initial={pos ? { opacity: 0, x: pos.x, y: pos.y, scale: 0.7 } : { opacity: 0, y: 10, scale: 0.7 }}
      animate={pos ? { opacity: 1, x: pos.x, y: pos.y, scale: isMobile ? 0.9 : 1 } : { opacity: 1, y: 0, scale: isMobile ? 0.9 : 1 }}
      exit={{ opacity: 0, scale: 0.7 }}
      className={`fixed ${isMobile ? (isMobileLandscape ? 'top-4' : 'bottom-20 top-auto') : 'top-20'} left-1/2 -translate-x-1/2 z-[200] flex items-center gap-0 p-1.5 bg-white shadow-2xl rounded-xl border border-slate-200 min-w-max cursor-move active:cursor-grabbing transition-all duration-300`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Main Color Toggle */}
      {!isForecasting && drawing.type !== DrawingType.RECTANGLE && (
        <div className={`${isMobile ? 'w-20' : 'w-28'} px-1 border-r border-slate-100 mr-1`}>
          <ColorPicker 
            color={drawing.settings.color || '#000000'}
            onChange={(color) => onUpdate({ color })}
          />
        </div>
      )}

      {/* Specialized Colors for Rectangle */}
      {drawing.type === DrawingType.RECTANGLE && (
        <div className="flex items-center gap-1 border-r border-slate-100 pr-1 mr-1">
          <div className={`${isMobile ? 'w-12' : 'w-16'}`} title="Border Color">
            <ColorPicker 
              color={drawing.settings.strokeColor || drawing.settings.color || '#2962ff'}
              onChange={(strokeColor) => onUpdate({ strokeColor })}
            />
          </div>
          <div className={`${isMobile ? 'w-12' : 'w-16'}`} title="Fill Color">
            <ColorPicker 
              color={drawing.settings.fillColor || (drawing.settings.color || '#2962ff') + '33'}
              onChange={(fillColor) => onUpdate({ fillColor })}
            />
          </div>
        </div>
      )}

      {/* Specialized Colors for Long/Short */}
      {isForecasting && (
        <div className="flex items-center gap-1 border-r border-slate-100 pr-1 mr-1">
          <div className={`${isMobile ? 'w-14' : 'w-20'}`} title="Profit Color">
            <ColorPicker 
              color={drawing.settings.profitColor || 'rgba(0, 105, 92, 0.3)'}
              onChange={(profitColor) => onUpdate({ profitColor })}
            />
          </div>
          <div className={`${isMobile ? 'w-14' : 'w-20'}`} title="Stop Loss Color">
            <ColorPicker 
              color={drawing.settings.lossColor || 'rgba(198, 40, 40, 0.3)'}
              onChange={(lossColor) => onUpdate({ lossColor })}
            />
          </div>
        </div>
      )}

      <div className="flex items-center">
        {/* Line Width */}
        <div className="relative">
          <button 
            onClick={() => {
              setShowWidthPicker(!showWidthPicker);
              setShowStylePicker(false);
            }}
            className={`p-1.5 md:p-2 rounded-md transition-colors flex items-center gap-1.5 ${showWidthPicker ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
            title="Line Width"
          >
            <Layers size={isMobile ? 14 : 18} />
            <span className="text-[10px] md:text-[11px] font-bold min-w-[18px] md:min-w-[24px] text-center">{drawing.settings.lineWidth || 1}</span>
          </button>
          
          <AnimatePresence>
            {showWidthPicker && (
              <motion.div
                initial={{ opacity: 0, y: isMobile ? -5 : 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: isMobile ? -5 : 5 }}
                className={`absolute ${isMobile ? 'bottom-full' : 'top-full'} left-0 ${isMobile ? 'mb-2' : 'mt-2'} p-1 bg-white rounded-lg border border-slate-200 shadow-xl flex flex-col gap-0.5 z-10 min-w-[60px]`}
              >
                {[0.5, 1, 1.5, 2, 2.5, 3, 4].map(w => (
                  <button
                    key={w}
                    onClick={() => {
                      onUpdate({ lineWidth: w });
                      setShowWidthPicker(false);
                    }}
                    className={`px-2 py-1 rounded-md text-[10px] text-left transition-colors font-bold ${drawing.settings.lineWidth === w ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {w}px
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Line Style */}
        <div className="relative">
          <button 
            onClick={() => {
              setShowStylePicker(!showStylePicker);
              setShowWidthPicker(false);
            }}
            className={`p-1 md:p-1.5 rounded-md transition-colors flex items-center ${showStylePicker ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
            title="Line Style"
          >
            <div className="scale-75">
              {LINE_STYLES.find(s => s.id === (drawing.settings.lineStyle || 'solid'))?.icon}
            </div>
          </button>
          
          <AnimatePresence>
            {showStylePicker && (
              <motion.div
                initial={{ opacity: 0, y: isMobile ? -5 : 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: isMobile ? -5 : 5 }}
                className={`absolute ${isMobile ? 'bottom-full' : 'top-full'} left-0 ${isMobile ? 'mb-2' : 'mt-2'} p-1 bg-white rounded-lg border border-slate-200 shadow-xl flex flex-col gap-0.5 z-10`}
              >
                {LINE_STYLES.map(style => (
                  <button
                    key={style.id}
                    onClick={() => {
                      onUpdate({ lineStyle: style.id as any });
                      setShowStylePicker(false);
                    }}
                    className={`p-2 rounded-md transition-colors min-w-[80px] flex items-center justify-center ${drawing.settings.lineStyle === style.id ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                  >
                    <div className="text-slate-900 scale-75">{style.icon}</div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!isMobile && <div className="w-px h-5 bg-slate-100 mx-0.5" />}

        <button 
          onClick={() => onUpdate({ hidden: !drawing.settings.hidden })}
          className="p-1.5 md:p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
          title="Toggle Visibility"
        >
          {drawing.settings.hidden ? <EyeOff size={isMobile ? 14 : 18} /> : <Eye size={isMobile ? 14 : 18} />}
        </button>

        <button 
          onClick={() => onUpdate({ locked: !drawing.settings.locked })}
          className="p-1.5 md:p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
          title="Lock Drawing"
        >
          {drawing.settings.locked ? <Lock size={isMobile ? 14 : 18} /> : <Unlock size={isMobile ? 14 : 18} />}
        </button>

        {isFib && (
          <div className="relative">
            <button 
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className={`p-1 md:p-1.5 transition-colors rounded-md ${showAdvancedSettings ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100'}`}
              title="Fibonacci Settings"
            >
              <Settings2 size={isMobile ? 12 : 14} />
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

        <div className="w-px h-5 bg-slate-100 mx-0.5" />

        <button 
          onClick={onDelete}
          className="p-1.5 md:p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors"
          title="Delete Drawing"
        >
          <Trash2 size={isMobile ? 14 : 18} />
        </button>
      </div>
    </motion.div>
  );
}
