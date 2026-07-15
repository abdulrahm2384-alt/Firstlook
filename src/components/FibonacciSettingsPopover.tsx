import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings2, 
  Trash2, 
  Plus, 
  Eye, 
  EyeOff, 
  Layers, 
  Type, 
  X, 
  RotateCcw,
  Sliders
} from 'lucide-react';
import { ColorPicker } from './ColorPicker';
import { Drawing } from '../types/drawing';

interface FibonacciSettingsPopoverProps {
  drawing: Drawing;
  onUpdate: (updates: any) => void;
  isMobile: boolean;
}

export function FibonacciSettingsPopover({ drawing, onUpdate, isMobile }: FibonacciSettingsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'levels' | 'lines' | 'labels'>('levels');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const defaultFibLevels = [
    { value: 0, color: '#787b86', visible: true },
    { value: 0.236, color: '#f23645', visible: true },
    { value: 0.382, color: '#ff9800', visible: true },
    { value: 0.5, color: '#4caf50', visible: true },
    { value: 0.618, color: '#089981', visible: true },
    { value: 0.786, color: '#2196f3', visible: true },
    { value: 1, color: '#787b86', visible: true }
  ];

  const currentFibLevels = drawing.settings.levels || defaultFibLevels;

  const updateFibLevel = (index: number, updates: any) => {
    const newLevels = [...currentFibLevels];
    newLevels[index] = { ...newLevels[index], ...updates };
    onUpdate({ levels: newLevels });
  };

  const handleAddFibLevel = () => {
    const nextVal = currentFibLevels.length > 0 
      ? Math.max(...currentFibLevels.map((l: any) => typeof l.value === 'number' ? l.value : parseFloat(l.value) || 0)) + 0.236 
      : 1.618;
    const newLevels = [...currentFibLevels, { value: parseFloat(nextVal.toFixed(3)), color: '#787b86', visible: true }];
    onUpdate({ levels: newLevels });
  };

  const handleDeleteFibLevel = (index: number) => {
    const newLevels = currentFibLevels.filter((_: any, i: number) => i !== index);
    onUpdate({ levels: newLevels });
  };

  const handleResetFibLevels = () => {
    onUpdate({
      levels: defaultFibLevels,
      showBackground: true,
      backgroundOpacity: 0.1,
      extendLinesLeft: false,
      extendLinesRight: false,
      showTrendline: true,
      trendlineColor: '#787b8688',
      trendlineStyle: 'dotted',
      useSingleColor: false,
      showLabels: true,
      showPrices: true,
      showValues: true,
      labelAlign: 'right',
      labelPos: 'top'
    });
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`h-7 w-7 flex items-center justify-center transition-all rounded-lg outline-none border ${
          isOpen 
            ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm' 
            : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
        }`}
        title="Fibonacci Levels & Range Style"
      >
        <Settings2 size={isMobile ? 13 : 15} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: isMobile ? -8 : 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: isMobile ? -8 : 8 }}
            className={`absolute ${isMobile ? 'bottom-full mb-3' : 'top-full mt-3'} right-0 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-2xl p-4 w-[310px] md:w-[330px] z-[320]`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
              <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
                <Settings2 size={13} className="text-indigo-600 animate-spin-slow" />
                <span>Fibonacci Settings</span>
              </div>
              <button 
                onClick={handleResetFibLevels}
                className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1 py-0.5 px-1.5 rounded hover:bg-slate-50 transition-all"
                title="Reset to Default Settings"
              >
                <RotateCcw size={10} />
                <span>Reset</span>
              </button>
            </div>

            {/* Tabs Selector */}
            <div className="flex bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/40 mb-3.5">
              {(['levels', 'lines', 'labels'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1.5 rounded-md text-[10px] md:text-[11px] font-bold capitalize transition-all ${
                    activeTab === tab 
                      ? 'bg-white shadow-sm text-slate-900 border border-slate-200/30 font-black' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab === 'lines' ? 'Lines & Trend' : tab === 'labels' ? 'Style & Labels' : tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="min-h-[190px] max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
              {activeTab === 'levels' && (
                <div className="space-y-3">
                  {/* Single Color option */}
                  <div className="flex items-center justify-between px-1 py-1 border-b border-slate-100/50">
                    <span className="text-[10px] font-bold text-slate-500">Use Single Color (All Lines)</span>
                    <button 
                      onClick={() => onUpdate({ useSingleColor: !drawing.settings.useSingleColor })}
                      className={`w-7 h-4 rounded-full p-0.5 transition-colors ${drawing.settings.useSingleColor ? 'bg-indigo-600' : 'bg-slate-200'}`}
                    >
                      <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${drawing.settings.useSingleColor ? 'translate-x-3' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* Levels list */}
                  <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1.5 custom-scrollbar">
                    {currentFibLevels.map((lvl: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 py-0.5 group">
                        <button
                          type="button"
                          onClick={() => updateFibLevel(idx, { visible: lvl.visible === false ? true : false })}
                          className={`p-1 rounded transition-colors ${lvl.visible !== false ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-300 hover:text-slate-400'}`}
                          title={lvl.visible !== false ? 'Hide Line' : 'Show Line'}
                        >
                          {lvl.visible !== false ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                        <input
                          type="number"
                          step="0.001"
                          value={lvl.value}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            updateFibLevel(idx, { value: isNaN(val) ? 0 : val });
                          }}
                          className="text-[10px] font-mono font-bold w-16 text-slate-700 bg-slate-50 hover:bg-slate-100/60 focus:bg-white px-1.5 py-0.5 rounded border border-slate-200 outline-none focus:border-indigo-500 text-center transition-all"
                        />
                        <div className="flex-1 h-px border-t border-dashed border-slate-200" />
                        
                        {!drawing.settings.useSingleColor && (
                          <ColorPicker 
                            color={lvl.color || '#787b86'}
                            onChange={(color) => updateFibLevel(idx, { color })}
                          />
                        )}
                        
                        <button
                          onClick={() => handleDeleteFibLevel(idx)}
                          className="p-1 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Remove Level"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add level */}
                  <button
                    onClick={handleAddFibLevel}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 border border-dashed border-indigo-200 hover:border-indigo-500 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/30 rounded-xl text-[10px] font-bold transition-all"
                  >
                    <Plus size={11} /> Add Fibonacci Level
                  </button>
                </div>
              )}

              {activeTab === 'lines' && (
                <div className="space-y-4">
                  {/* Extend Lines */}
                  <div className="space-y-2.5">
                    <h4 className="text-[9px] font-black tracking-wider text-slate-400 uppercase">Extend Lines</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => onUpdate({ extendLinesLeft: !drawing.settings.extendLinesLeft })}
                        className={`py-1.5 px-2.5 rounded-lg border text-[10px] font-bold text-center transition-all ${
                          drawing.settings.extendLinesLeft 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Extend Left
                      </button>
                      <button
                        onClick={() => onUpdate({ extendLinesRight: !drawing.settings.extendLinesRight })}
                        className={`py-1.5 px-2.5 rounded-lg border text-[10px] font-bold text-center transition-all ${
                          drawing.settings.extendLinesRight 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Extend Right
                      </button>
                    </div>
                  </div>

                  {/* Trendline Settings */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[9px] font-black tracking-wider text-slate-400 uppercase">Trendline (Slanted)</h4>
                      <button 
                        onClick={() => onUpdate({ showTrendline: drawing.settings.showTrendline !== false })}
                        className={`w-7 h-4 rounded-full p-0.5 transition-colors ${drawing.settings.showTrendline !== false ? 'bg-indigo-600' : 'bg-slate-200'}`}
                      >
                        <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${drawing.settings.showTrendline !== false ? 'translate-x-3' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {drawing.settings.showTrendline !== false && (
                      <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-slate-500 block">Style</span>
                          <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
                            {['dotted', 'dashed', 'solid'].map(style => (
                              <button
                                key={style}
                                onClick={() => onUpdate({ trendlineStyle: style })}
                                className={`flex-1 py-1 text-[8px] font-bold rounded-md capitalize transition-all ${
                                  (drawing.settings.trendlineStyle || 'dotted') === style 
                                    ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
                                    : 'text-slate-400 hover:text-slate-600'
                                }`}
                              >
                                {style}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1 flex flex-col justify-between">
                          <span className="text-[9px] font-bold text-slate-500 block">Color</span>
                          <div className="flex items-center gap-1.5 h-7">
                            <ColorPicker 
                              color={drawing.settings.trendlineColor || '#787b8688'}
                              onChange={(trendlineColor) => onUpdate({ trendlineColor })}
                            />
                            <span className="text-[9px] font-mono font-medium text-slate-400 truncate max-w-[50px]">
                              {drawing.settings.trendlineColor || '#787b8688'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'labels' && (
                <div className="space-y-4">
                  {/* Label Toggles */}
                  <div className="space-y-2">
                    <h4 className="text-[9px] font-black tracking-wider text-slate-400 uppercase mb-2">Display Data Labels</h4>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => onUpdate({ showLabels: drawing.settings.showLabels !== false })}
                        className={`py-1.5 px-1.5 rounded-lg border text-[9px] font-bold text-center transition-all ${
                          drawing.settings.showLabels !== false 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                            : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        All Labels
                      </button>
                      <button
                        onClick={() => onUpdate({ showValues: drawing.settings.showValues !== false })}
                        className={`py-1.5 px-1.5 rounded-lg border text-[9px] font-bold text-center transition-all ${
                          drawing.settings.showValues !== false 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                            : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        Level Values
                      </button>
                      <button
                        onClick={() => onUpdate({ showPrices: drawing.settings.showPrices !== false })}
                        className={`py-1.5 px-1.5 rounded-lg border text-[9px] font-bold text-center transition-all ${
                          drawing.settings.showPrices !== false 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                            : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        Price Values
                      </button>
                    </div>
                  </div>

                  {/* Label alignment & position */}
                  {drawing.settings.showLabels !== false && (
                    <div className="space-y-2.5 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] md:text-[10px] font-bold text-slate-500">Alignment</span>
                        <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-100">
                          {['left', 'center', 'right'].map(align => (
                            <button
                              key={align}
                              onClick={() => onUpdate({ labelAlign: align })}
                              className={`px-1.5 md:px-2 py-0.5 text-[8px] md:text-[9px] font-bold rounded-md transition-all capitalize ${
                                drawing.settings.labelAlign === align || (!drawing.settings.labelAlign && align === 'right') 
                                  ? 'bg-white shadow-sm text-slate-900 border border-slate-200/50' 
                                  : 'text-slate-400 hover:text-slate-600'
                              }`}
                            >
                              {align}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[9px] md:text-[10px] font-bold text-slate-500">Position</span>
                        <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-100">
                          {['top', 'middle', 'bottom'].map(pos => (
                            <button
                              key={pos}
                              onClick={() => onUpdate({ labelPos: pos })}
                              className={`px-1.5 md:px-2 py-0.5 text-[8px] md:text-[9px] font-bold rounded-md transition-all capitalize ${
                                drawing.settings.labelPos === pos || (!drawing.settings.labelPos && pos === 'top') 
                                  ? 'bg-white shadow-sm text-slate-900 border border-slate-200/50' 
                                  : 'text-slate-400 hover:text-slate-600'
                              }`}
                            >
                              {pos}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Background Fill */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] md:text-[10px] font-bold text-slate-500">Fill Ranges (Bands)</span>
                      <button 
                        onClick={() => onUpdate({ showBackground: drawing.settings.showBackground === false ? true : false })}
                        className={`w-7 h-4 rounded-full p-0.5 transition-colors ${drawing.settings.showBackground !== false ? 'bg-indigo-600' : 'bg-slate-200'}`}
                      >
                        <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${drawing.settings.showBackground !== false ? 'translate-x-3' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {drawing.settings.showBackground !== false && (
                      <div className="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-100/50">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">Opacity</span>
                          <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                            {Math.round((drawing.settings.backgroundOpacity !== undefined ? drawing.settings.backgroundOpacity : 0.1) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={drawing.settings.backgroundOpacity !== undefined ? drawing.settings.backgroundOpacity : 0.1}
                          onChange={(e) => onUpdate({ backgroundOpacity: parseFloat(e.target.value) })}
                          className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
