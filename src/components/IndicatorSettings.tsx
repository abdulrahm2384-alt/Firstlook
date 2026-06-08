import { useState } from 'react';
import { motion } from 'motion/react';
import { X, Settings2, Sliders, Palette, Check } from 'lucide-react';
import { IndicatorInstance } from '../types';
import { ColorPicker } from './ColorPicker';

interface IndicatorSettingsProps {
  indicator: IndicatorInstance;
  onSave: (id: string, updates: Partial<IndicatorInstance>) => void;
  onClose: () => void;
}

const TIMEFRAMES_IDS = ['1m', '2m', '3m', '5m', '10m', '15m', '30m', '45m', '1h', '2h', '4h', '8h', '12h', '1d', '1w'];

export function IndicatorSettings({ indicator, onSave, onClose }: IndicatorSettingsProps) {
  const [params, setParams] = useState(indicator.params);
  const [color, setColor] = useState(indicator.color);
  const [lineWidth, setLineWidth] = useState(indicator.lineWidth);
  const [visible, setVisible] = useState(indicator.visible);
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>(indicator.visibilityTimeframes || []);

  const handleSave = () => {
    onSave(indicator.id, {
      params,
      color,
      lineWidth,
      visible,
      visibilityTimeframes: selectedTimeframes
    });
    onClose();
  };

  const updateParam = (key: string, value: any) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const renderParam = (key: string, value: any) => {
    const isColor = (key.toLowerCase().includes('color') || key.toLowerCase().includes('colour')) && typeof value === 'string';
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^show/, 'Enable')
      .replace(/london|ny|asian/gi, (m) => m.toUpperCase())
      .replace(/Start/, 'Start (H)')
      .replace(/End/, 'End (H)')
      .trim();

    return (
      <div key={key} className="flex items-center justify-between gap-4 p-1">
         <label className="text-[11px] text-slate-400 font-medium whitespace-nowrap">{label}</label>
         
         {typeof value === 'boolean' ? (
            <button 
              onClick={() => updateParam(key, !value)}
              className={`w-8 h-4 rounded-full relative flex items-center transition-colors ${value ? 'bg-blue-600' : 'bg-[#363a45]'}`}
            >
               <div className={`w-3 h-3 bg-white rounded-full transition-all absolute ${value ? 'right-0.5' : 'left-0.5'}`} />
            </button>
         ) : isColor ? (
           <div className="w-32">
             <ColorPicker 
               color={value} 
               onChange={(c) => updateParam(key, c)} 
             />
           </div>
         ) : (
           <input 
             type={typeof value === 'number' ? 'number' : 'text'}
             value={value}
             onChange={(e) => updateParam(key, typeof value === 'number' ? Number(e.target.value) : e.target.value)}
             className="w-24 bg-[#1e222d] border border-[#363a45] rounded-sm py-1.5 px-2 text-[11px] text-slate-200 focus:outline-none focus:border-blue-500 transition-colors font-mono text-right"
           />
         )}
      </div>
    );
  };

  const renderSelectParam = (key: string, value: string, options: string[]) => {
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^show/, 'Enable')
      .replace(/prev/gi, 'Prev')
      .replace(/vline/gi, 'VLine')
      .replace(/Days/, 'Days To Show')
      .replace(/Time/, 'Exact Time')
      .replace(/Color/, 'Color')
      .replace(/Width/, 'Thickness')
      .replace(/Style/, 'Line Style')
      .replace(/ExtensionPips/, 'Extension Pips')
      .trim();

    return (
      <div key={key} className="flex items-center justify-between gap-4 p-1">
        <label className="text-[11px] text-slate-400 font-medium whitespace-nowrap">{label}</label>
        <select
          value={value}
          onChange={(e) => updateParam(key, e.target.value)}
          className="w-24 bg-[#1e222d] border border-[#363a45] rounded-sm py-1 px-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-blue-500 transition-colors font-mono"
        >
          {options.map(opt => (
            <option key={opt} value={opt}>{opt.toUpperCase()}</option>
          ))}
        </select>
      </div>
    );
  };

  const isLevels = indicator.type === 'LEVELS';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      
      <motion.div 
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-xl bg-[#131722] rounded-lg border border-[#363a45] shadow-2xl overflow-hidden flex flex-col max-h-[85dvh] lg:max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#363a45] bg-[#1e222d]">
           <div className="flex items-center gap-3">
             <div className="text-slate-300">
                <Settings2 size={20} />
             </div>
             <div>
               <h3 className="text-sm text-slate-200 font-bold tracking-tight uppercase">{indicator.type} Settings</h3>
               <div className="flex items-center gap-2">
                 <span className="text-[10px] text-slate-500 font-mono font-bold tracking-widest uppercase">{indicator.category}</span>
               </div>
             </div>
           </div>
           <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-300 transition-colors">
              <X size={20} />
           </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar bg-[#131722]">
           <div className="p-6 space-y-10">
              {/* Visibility Group */}
              <div className="flex items-center justify-between p-4 bg-[#1e222d]/50 border border-[#363a45] rounded-md">
                 <div>
                    <h4 className="text-slate-300 font-bold text-xs uppercase tracking-wider">Indicator Visibility</h4>
                 </div>
                 <button 
                   onClick={() => setVisible(!visible)}
                   className={`w-10 h-5 rounded-full transition-all duration-200 relative flex items-center ${visible ? 'bg-blue-600' : 'bg-[#363a45]'}`}
                 >
                    <motion.div 
                      initial={false}
                      animate={{ x: visible ? 22 : 2 }}
                      className="w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                 </button>
              </div>

              {/* Timeframe Visibility Section */}
              <div className="space-y-4 p-4 bg-[#1e222d]/30 border border-[#363a45] rounded-md">
                <div className="flex items-center justify-between">
                  <h4 className="text-[#98a1c0] font-bold text-xs uppercase tracking-wider">Timeframe Visibility</h4>
                  <button 
                    type="button"
                    onClick={() => {
                      if (selectedTimeframes.length === TIMEFRAMES_IDS.length) {
                        setSelectedTimeframes([]);
                      } else {
                        setSelectedTimeframes([...TIMEFRAMES_IDS]);
                      }
                    }}
                    className="text-[10px] text-blue-500 font-bold hover:underline uppercase tracking-wider"
                  >
                    Toggle All
                  </button>
                </div>
                
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Select which timeframes this indicator should be active on. If none are selected, it will default to showing on all timeframes.
                </p>
                
                <div className="grid grid-cols-5 gap-2 pt-2">
                  {TIMEFRAMES_IDS.map((tfId) => {
                    const isSelected = selectedTimeframes.includes(tfId);
                    return (
                      <button
                        key={tfId}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedTimeframes(selectedTimeframes.filter(id => id !== tfId));
                          } else {
                            setSelectedTimeframes([...selectedTimeframes, tfId]);
                          }
                        }}
                        className={`py-1.5 px-2 rounded font-mono text-[10px] font-bold text-center border transition-all duration-150 ${
                          isSelected 
                            ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                            : 'bg-[#1e222d] border-[#363a45] text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        {tfId}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Parameters section */}
              <div className="space-y-6">
                 {isLevels ? (
                   <>
                     {/* GROUP: London */}
                     <div className="space-y-3 p-3 bg-[#1e222d]/20 border border-[#363a45] rounded rounded-md">
                        <h5 className="text-[10px] text-slate-300 font-bold uppercase tracking-widest border-b border-[#363a45] pb-1">London Session</h5>
                        <div className="grid grid-cols-1 gap-1">
                          {['showLondon', 'londonStart', 'londonEnd', 'londonColor'].map(k => renderParam(k, params[k] ?? (k.includes('Start') ? 8 : k.includes('End') ? 16 : k.includes('Color') ? 'rgba(0,255,0,0.1)' : true)))}
                        </div>
                     </div>

                     {/* GROUP: New York */}
                     <div className="space-y-3 p-3 bg-[#1e222d]/20 border border-[#363a45] rounded rounded-md">
                        <h5 className="text-[10px] text-slate-300 font-bold uppercase tracking-widest border-b border-[#363a45] pb-1">New York Session</h5>
                        <div className="grid grid-cols-1 gap-1">
                          {['showNY', 'nyStart', 'nyEnd', 'nyColor'].map(k => renderParam(k, params[k] ?? (k.includes('Start') ? 13 : k.includes('End') ? 21 : k.includes('Color') ? 'rgba(0,0,255,0.1)' : true)))}
                        </div>
                     </div>

                     {/* GROUP: Asian */}
                     <div className="space-y-3 p-3 bg-[#1e222d]/20 border border-[#363a45] rounded rounded-md">
                        <h5 className="text-[10px] text-slate-300 font-bold uppercase tracking-widest border-b border-[#363a45] pb-1">Asian Session</h5>
                        <div className="grid grid-cols-1 gap-1">
                          {['showAsian', 'asianStart', 'asianEnd', 'asianColor'].map(k => renderParam(k, params[k] ?? (k.includes('Start') ? 0 : k.includes('End') ? 8 : k.includes('Color') ? 'rgba(255,0,0,0.1)' : true)))}
                        </div>
                     </div>

                     {/* GROUP: Global Labels and Outline */}
                     <div className="space-y-3 p-3 bg-[#1e222d]/20 border border-[#363a45] rounded rounded-md">
                        <h5 className="text-[10px] text-slate-300 font-bold uppercase tracking-widest border-b border-[#363a45] pb-1">Appearance & Labels</h5>
                        <div className="grid grid-cols-1 gap-1">
                          {['showOutline', 'showSessionLabels', 'showRayLabels'].map(k => renderParam(k, params[k] ?? true))}
                        </div>
                     </div>

                     {/* GROUP: Previous Day High/Low */}
                     <div className="space-y-3 p-3 bg-[#1e222d]/25 border border-[#363a45] rounded rounded-md">
                        <h5 className="text-[10px] text-emerald-400 font-semibold uppercase tracking-widest border-b border-[#363a45] pb-1">Previous Day High & Low</h5>
                        <div className="grid grid-cols-1 gap-1 mt-2">
                          {renderParam('showPrevDay', params.showPrevDay ?? true)}
                          {(params.showPrevDay ?? true) ? (
                            <>
                              {renderParam('prevDayColor', params.prevDayColor ?? "#10b981")}
                              {renderParam('prevDayWidth', params.prevDayWidth ?? 1.5)}
                              {renderSelectParam('prevDayStyle', params.prevDayStyle ?? "dashed", ['solid', 'dashed', 'dotted'])}
                            </>
                          ) : null}
                        </div>
                     </div>

                     {/* GROUP: Previous Week High/Low */}
                     <div className="space-y-3 p-3 bg-[#1e222d]/25 border border-[#363a45] rounded rounded-md">
                        <h5 className="text-[10px] text-blue-400 font-semibold uppercase tracking-widest border-b border-[#363a45] pb-1">Previous Week High & Low</h5>
                        <div className="grid grid-cols-1 gap-1 mt-2">
                          {renderParam('showPrevWeek', params.showPrevWeek ?? true)}
                          {(params.showPrevWeek ?? true) ? (
                            <>
                              {renderParam('prevWeekColor', params.prevWeekColor ?? "#3b82f6")}
                              {renderParam('prevWeekWidth', params.prevWeekWidth ?? 1.5)}
                              {renderSelectParam('prevWeekStyle', params.prevWeekStyle ?? "dashed", ['solid', 'dashed', 'dotted'])}
                            </>
                          ) : null}
                        </div>
                     </div>

                     {/* GROUP: Previous Month High/Low */}
                     <div className="space-y-3 p-3 bg-[#1e222d]/25 border border-[#363a45] rounded rounded-md">
                        <h5 className="text-[10px] text-amber-500 font-semibold uppercase tracking-widest border-b border-[#363a45] pb-1">Previous Month High & Low</h5>
                        <div className="grid grid-cols-1 gap-1 mt-2">
                          {renderParam('showPrevMonth', params.showPrevMonth ?? true)}
                          {(params.showPrevMonth ?? true) ? (
                            <>
                              {renderParam('prevMonthColor', params.prevMonthColor ?? "#f59e0b")}
                              {renderParam('prevMonthWidth', params.prevMonthWidth ?? 1.5)}
                              {renderSelectParam('prevMonthStyle', params.prevMonthStyle ?? "dashed", ['solid', 'dashed', 'dotted'])}
                            </>
                          ) : null}
                        </div>
                     </div>

                     {/* GROUP: Vertical Line 1 */}
                     <div className="space-y-3 p-3 bg-[#1e222d]/25 border border-[#ec4899]/30 rounded rounded-md">
                        <h5 className="text-[10px] text-pink-400 font-semibold uppercase tracking-widest border-b border-[#363a45] pb-1">Vertical Line Marker 1</h5>
                        <div className="grid grid-cols-1 gap-1 mt-2">
                          {renderParam('showVLine1', params.showVLine1 ?? false)}
                          {(params.showVLine1 ?? false) ? (
                            <>
                              {renderParam('vline1Days', params.vline1Days ?? 3)}
                              {renderParam('vline1Time', params.vline1Time ?? "09:30")}
                              {renderParam('vline1ExtensionPips', params.vline1ExtensionPips ?? 5)}
                              {renderParam('vline1Color', params.vline1Color ?? "#ec4899")}
                              {renderParam('vline1Width', params.vline1Width ?? 2)}
                              {renderSelectParam('vline1Style', params.vline1Style ?? "dashed", ['solid', 'dashed', 'dotted'])}
                            </>
                          ) : null}
                        </div>
                     </div>

                     {/* GROUP: Vertical Line 2 */}
                     <div className="space-y-3 p-3 bg-[#1e222d]/25 border border-[#06b6d4]/30 rounded rounded-md">
                        <h5 className="text-[10px] text-cyan-400 font-semibold uppercase tracking-widest border-b border-[#363a45] pb-1">Vertical Line Marker 2</h5>
                        <div className="grid grid-cols-1 gap-1 mt-2">
                          {renderParam('showVLine2', params.showVLine2 ?? false)}
                          {(params.showVLine2 ?? false) ? (
                            <>
                              {renderParam('vline2Days', params.vline2Days ?? 3)}
                              {renderParam('vline2Time', params.vline2Time ?? "14:00")}
                              {renderParam('vline2ExtensionPips', params.vline2ExtensionPips ?? 5)}
                              {renderParam('vline2Color', params.vline2Color ?? "#06b6d4")}
                              {renderParam('vline2Width', params.vline2Width ?? 2)}
                              {renderSelectParam('vline2Style', params.vline2Style ?? "dashed", ['solid', 'dashed', 'dotted'])}
                            </>
                          ) : null}
                        </div>
                     </div>
                   </>
                 ) : (
                   <div className="grid grid-cols-1 gap-2">
                      {Object.entries(params).map(([key, value]) => renderParam(key, value))}
                   </div>
                 )}
              </div>

              {/* Style section */}
              <div className="space-y-4 pt-4 border-t border-[#363a45]">
                 <div className="flex items-center gap-2 px-1">
                    <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Style</h4>
                 </div>
                 
                 <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center justify-between gap-4">
                       <label className="text-[11px] text-slate-400 font-medium">Main Color</label>
                       <div className="w-32">
                        <ColorPicker 
                          color={color} 
                          onChange={setColor} 
                        />
                       </div>
                    </div>
                    
                    <div className="flex items-center justify-between gap-4">
                       <label className="text-[11px] text-slate-400 font-medium">Thickness</label>
                       <div className="flex items-center gap-3 w-32">
                          <input 
                            type="range"
                            min="1"
                            max="5"
                            step="1"
                            value={lineWidth}
                            onChange={(e) => setLineWidth(Number(e.target.value))}
                            className="flex-1 appearance-none bg-[#363a45] h-0.5 rounded-full accent-blue-600"
                          />
                          <span className="text-[10px] text-slate-500 font-mono w-4">{lineWidth}</span>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#363a45] flex items-center justify-between bg-[#1e222d]">
           <button 
             onClick={onClose}
             className="px-4 py-2 rounded text-slate-400 hover:text-slate-200 transition-all text-[11px] font-bold uppercase tracking-wider"
           >
             Cancel
           </button>
           <button 
             onClick={handleSave}
             className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-black transition-all uppercase tracking-widest"
           >
             Apply
           </button>
        </div>
      </motion.div>

    </div>
  );
}
