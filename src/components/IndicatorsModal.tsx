import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, Trash2, LineChart, Activity, Zap, BarChart3, TrendingUp, Code2, Plus, Settings } from 'lucide-react';
import { IndicatorInstance } from '../types';
import { ScriptEditor } from './ScriptEditor';

interface IndicatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeIndicators: IndicatorInstance[];
  onAddIndicator: (type: string, code?: string) => void;
  onRemoveIndicator: (id: string) => void;
  onSettings: (ind: IndicatorInstance) => void;
}

const AVAILABLE_INDICATORS = [
  { type: 'SMA', name: 'Simple Moving Average', description: 'Moving average of price over a period', icon: TrendingUp, category: 'INDICATOR' },
  { type: 'EMA', name: 'Exponential Moving Average', description: 'Faster moving average weighted to recent price', icon: Zap, category: 'INDICATOR' },
  { type: 'WMA', name: 'Weighted Moving Average', description: 'Weighted average where recent data is more significant', icon: Zap, category: 'INDICATOR' },
  { type: 'HMA', name: 'Hull Moving Average', description: 'Extremely fast and smooth moving average', icon: Zap, category: 'INDICATOR' },
  { type: 'RSI', name: 'Relative Strength Index', description: 'Momentum oscillator measuring speed and change of price', icon: Activity, category: 'INDICATOR' },
  { type: 'MACD', name: 'MACD', description: 'Trend-following momentum indicator', icon: BarChart3, category: 'INDICATOR' },
  { type: 'BB', name: 'Bollinger Bands', description: 'Volatility bands based on standard deviation', icon: LineChart, category: 'INDICATOR' },
  { type: 'VWAP', name: 'VWAP', description: 'Volume Weighted Average Price', icon: BarChart3, category: 'INDICATOR' },
  { type: 'ATR', name: 'Average True Range', description: 'Measures market volatility', icon: Activity, category: 'INDICATOR' },
  { type: 'SUPERTREND', name: 'Supertrend', description: 'Trend-following indicator based on ATR', icon: TrendingUp, category: 'INDICATOR' },
  { type: 'STOCH', name: 'Stochastic Oscillator', description: 'Compares closing price to price range', icon: Activity, category: 'INDICATOR' },
  { type: 'LEVELS', name: 'Market Structure & Sessions', description: 'Prev Day/Week/Month High/Low + Trading Sessions', icon: Zap, category: 'STRATEGY' },
];

export function IndicatorsModal({ isOpen, onClose, activeIndicators, onAddIndicator, onRemoveIndicator, onSettings }: IndicatorsModalProps) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'BUILTIN' | 'STRATEGY' | 'SCRIPTS'>('BUILTIN');
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const filteredIndicators = useMemo(() => {
    let base = AVAILABLE_INDICATORS;
    if (activeTab === 'BUILTIN') base = base.filter(i => i.category === 'INDICATOR');
    if (activeTab === 'STRATEGY') base = base.filter(i => i.category === 'STRATEGY');
    if (activeTab === 'SCRIPTS') return [];

    return base.filter(ind => 
      ind.name.toLowerCase().includes(search.toLowerCase()) || 
      ind.type.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, activeTab]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
          />

          {/* Modal / Drawer */}
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed bottom-0 left-0 right-0 lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:bottom-auto lg:w-[650px] lg:h-[600px] bg-white lg:rounded-3xl shadow-2xl z-[201] flex flex-col rounded-t-3xl overflow-hidden max-h-[90vh] transition-all duration-300`}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-black tracking-tight">Technical Analysis</h2>
              <button 
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-50 transition-colors"
              >
                <X size={24} className="text-slate-400" />
              </button>
            </div>

            {/* Categorization Tabs */}
            <div className="px-6 py-2 border-b border-slate-100 flex gap-1">
               {(['BUILTIN', 'STRATEGY', 'SCRIPTS'] as const).map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab)}
                   className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-black text-white' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}
                 >
                   {tab === 'BUILTIN' ? 'Indicators' : tab === 'STRATEGY' ? 'Strategies' : 'My Scripts'}
                 </button>
               ))}
            </div>

            {/* Search */}
            <div className="px-6 py-4 bg-slate-50/30">
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  autoFocus
                  placeholder="Find anything..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-black/5 transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
              {/* Active Section */}
              {activeIndicators.length > 0 && (
                <section>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-2">
                    <span className="w-1 h-1 bg-emerald-500 rounded-full" />
                    Running Indicators ({activeIndicators.length})
                  </h3>
                  <div className="space-y-2">
                    {activeIndicators.map(ind => (
                      <div key={ind.id} className="group flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 hover:border-black transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-1.5 h-10 rounded-full shrink-0" style={{ backgroundColor: ind.color }} />
                          <div>
                            <div className="text-sm font-black flex items-center gap-2 uppercase tracking-tight">
                              {ind.type}
                              {ind.category === 'SCRIPT' && <Code2 size={12} className="text-blue-500" />}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">
                              {ind.category}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => onSettings(ind)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-black hover:text-white transition-all shadow-sm"
                          >
                            <Settings size={16} />
                          </button>
                          <button 
                            onClick={() => onRemoveIndicator(ind.id)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Browse Section */}
              <section>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-1">
                   {activeTab === 'SCRIPTS' ? 'Custom Creations' : 'Available ' + activeTab.toLowerCase()}
                </h3>

                {activeTab === 'SCRIPTS' ? (
                   <div className="space-y-4">
                      <button 
                         onClick={() => setIsEditorOpen(true)}
                         className="w-full flex flex-col items-center justify-center p-12 rounded-[32px] border-2 border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50/30 transition-all gap-4 group"
                      >
                         <div className="w-16 h-16 rounded-[24px] bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
                            <Plus size={32} />
                         </div>
                         <div className="text-center">
                            <div className="text-sm font-black uppercase tracking-widest text-slate-900">Create New Script</div>
                            <p className="text-xs text-slate-400 mt-1">Write your own Python-style indicators</p>
                         </div>
                      </button>
                   </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredIndicators.map(ind => (
                      <button 
                        key={ind.type}
                        onClick={() => onAddIndicator(ind.type)}
                        className="group flex items-start gap-4 p-4 rounded-3xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-black hover:shadow-2xl hover:shadow-black/5 transition-all text-left"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all shadow-sm">
                          <ind.icon size={24} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-black leading-tight mb-1 text-slate-900 group-hover:text-black uppercase tracking-tight">{ind.name}</div>
                          <div className="text-[10px] text-slate-400 leading-relaxed font-bold uppercase tracking-widest">{ind.category}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </motion.div>

          <ScriptEditor 
            isOpen={isEditorOpen}
            onClose={() => setIsEditorOpen(false)}
            onSave={(code) => onAddIndicator('SCRIPT', code)}
          />
        </>
      )}
    </AnimatePresence>
  );
}
