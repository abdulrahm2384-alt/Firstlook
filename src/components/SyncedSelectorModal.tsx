import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Globe, Coins, BarChart2, Check, Lock, LineChart } from 'lucide-react';
import { MarketSymbol, MarketType } from '../types';
import { POPULAR_SYMBOLS } from '../constants/symbols';

interface SyncedSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (symbol: string, source: string, marketType: MarketType | null) => void;
  currentSymbol: string;
}

const SOURCE_METADATA: Record<string, { name: string; desc: string }> = {
  binance: { name: 'Binance', desc: "World's Largest Exchange" },
  okx: { name: 'OKX', desc: 'Global Crypto Ecosystem' },
  bybit: { name: 'Bybit', desc: 'Fastest Matching Engine' },
  bitflyer: { name: 'bitFlyer', desc: "Japan's Leading Exchange" },
  axiory: { name: 'Axiory', desc: 'Premium Forex Trading' },
  exness: { name: 'Exness', desc: 'Global Multi-Asset Broker' },
  dukascopy: { name: 'Dukascopy', desc: 'Swiss ECN Forex Provider' },
  fxcm: { name: 'FXCM', desc: 'Leading FX & CFD Broker' },
  oando: { name: 'Oando', desc: 'Global CFD & Forex Broker' },
};

const getSourceMeta = (id: string) => {
  return SOURCE_METADATA[id.toLowerCase()] || { name: id.toUpperCase(), desc: 'Alternative Data Feed' };
};

export function SyncedSelectorModal({ isOpen, onClose, onSelect, currentSymbol }: SyncedSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'CRYPTO' | 'FOREX' | 'METALS' | 'INDICES'>('ALL');
  const [selectedSymbolInfo, setSelectedSymbolInfo] = useState<MarketSymbol | null>(null);
  const [brokerSource, setBrokerSource] = useState<string>('');
  const [cryptoMarketType, setCryptoMarketType] = useState<MarketType>('spot');
  
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState<boolean>(false);

  const isSyncable = (category: string) => {
    return ['Crypto', 'Forex', 'Metals', 'Indices', 'Stocks'].includes(category);
  };

  // Filter symbols
  const filteredSymbols = useMemo(() => {
    return POPULAR_SYMBOLS.filter(s => {
      // Don't compare with the exact same main symbol
      if (s.symbol.toUpperCase() === currentSymbol.toUpperCase()) return false;

      const matchesSearch = s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            s.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (activeTab === 'ALL') return true;
      if (activeTab === 'CRYPTO') return s.category === 'Crypto';
      if (activeTab === 'FOREX') return s.category === 'Forex';
      if (activeTab === 'METALS') return s.category === 'Metals';
      if (activeTab === 'INDICES') return s.category === 'Indices' || s.category === 'Stocks' || s.category === 'Others';
      return true;
    });
  }, [searchQuery, activeTab, currentSymbol]);

  const handleSelectSymbol = async (symbol: MarketSymbol) => {
    if (!isSyncable(symbol.category)) return;

    setSelectedSymbolInfo(symbol);
    setAvailableSources([]);

    if ((symbol.category as string) === 'Crypto') {
      setAvailableSources(['binance', 'bybit', 'okx']);
      setBrokerSource('binance');
      setIsLoadingSources(false);
      return;
    }

    setIsLoadingSources(true);

    try {
      const response = await fetch(`/api/sources?symbol=${encodeURIComponent(symbol.symbol)}`);
      if (response.ok) {
        const ct = response.headers.get('content-type');
        if (!ct || !ct.includes('application/json')) {
          throw new Error(`Expected JSON but received: ${ct || 'none'}`);
        }
        const data = await response.json();
        let sources = data.sources || [];
        if (sources.length === 0) {
          const cat = (symbol.category || '').toLowerCase();
          if (cat === 'crypto') {
            sources = ['binance', 'bybit', 'okx'];
          } else if (cat === 'stocks') {
            sources = ['exness', 'axiory'];
          } else {
            sources = ['exness', 'dukascopy', 'fxcm', 'oando', 'axiory'];
          }
        }
        setAvailableSources(sources);
        const preferred = sources.find(s => s.toLowerCase() === 'exness') || 
                          sources.find(s => !['axiory', 'fxcm', 'oando', 'dukascopy'].includes(s.toLowerCase())) || 
                          sources[0];
        setBrokerSource(preferred);
      } else {
        const fallbacks = (symbol.category as string) === 'Crypto' 
          ? ['binance', 'okx', 'bybit', 'bitflyer'] 
          : (symbol.category as string) === 'Stocks'
            ? ['exness', 'axiory']
            : ['exness', 'dukascopy', 'fxcm', 'oando', 'axiory'];
        setAvailableSources(fallbacks);
        setBrokerSource(fallbacks[0]);
      }
    } catch (err) {
      console.error('Error fetching sources for sync:', err);
      const fallbacks = (symbol.category as string) === 'Crypto' 
        ? ['binance', 'okx', 'bybit', 'bitflyer'] 
        : (symbol.category as string) === 'Stocks'
          ? ['exness', 'axiory']
          : ['exness', 'dukascopy', 'fxcm', 'oando', 'axiory'];
      setAvailableSources(fallbacks);
      setBrokerSource(fallbacks[0]);
    } finally {
      setIsLoadingSources(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedSymbolInfo) return;
    
    // Pass lowercase source ID to match correct route filters
    onSelect(
      selectedSymbolInfo.symbol,
      brokerSource.toLowerCase(),
      selectedSymbolInfo.category === 'Crypto' ? cryptoMarketType : null
    );
    // Reset state and close
    setSelectedSymbolInfo(null);
    setSearchQuery('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]"
        >
          {/* Modal Header */}
          <div className="p-6 border-b border-slate-50 flex items-center justify-between shrink-0 bg-white">
            <div>
              <h2 className="text-base font-black text-slate-900 leading-tight">Synced Chart Comparison</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Select an instrument & Broker feed to lock comparison</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-all active:scale-95 cursor-pointer"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          <div className="p-5 flex-grow overflow-y-auto scrollbar-hide space-y-4">
            {!selectedSymbolInfo ? (
              <>
                {/* Search query input */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search comparison assets..."
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 py-3 text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/5 transition-all"
                  />
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-100 p-0.5 rounded-[1.25rem] gap-0.5 shrink-0">
                  {(['ALL', 'CRYPTO', 'FOREX', 'METALS', 'INDICES'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        activeTab === tab 
                          ? 'bg-white text-slate-900 shadow-sm' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Asset List */}
                <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
                  {filteredSymbols.length > 0 ? (
                    filteredSymbols.slice(0, 30).map((sym) => {
                      const syncable = isSyncable(sym.category);
                      return (
                        <button
                          key={sym.symbol}
                          disabled={!syncable}
                          onClick={() => syncable && handleSelectSymbol(sym)}
                          className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left group relative ${
                            syncable 
                              ? 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/70 hover:shadow-sm cursor-pointer' 
                              : 'border-slate-100 bg-slate-50/50 opacity-45 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center font-bold text-xs">
                              {sym.category === 'Crypto' ? (
                                <Coins size={14} className="text-amber-500" />
                              ) : sym.category === 'Forex' ? (
                                <Globe size={14} className="text-indigo-500" />
                              ) : sym.category === 'Metals' ? (
                                <BarChart2 size={14} className="text-teal-500" />
                              ) : sym.category === 'Indices' ? (
                                <LineChart size={14} className="text-pink-500" />
                              ) : (
                                <Lock size={12} className="text-slate-400 animate-pulse" />
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-900 leading-none group-hover:text-indigo-600 transition-colors">
                                {sym.symbol}
                              </div>
                              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">
                                {sym.name}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            {!syncable && (
                              <span className="text-[7.5px] font-black uppercase tracking-wider bg-slate-250 border border-slate-300/40 text-slate-400 px-2 py-0.5 rounded-full">
                                Locked
                              </span>
                            )}
                            <span className="text-[8px] font-black uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">
                              {sym.category}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-slate-300 font-bold text-xs">No assets found matching query.</div>
                  )}
                </div>
              </>
            ) : (
              /* Config Step */
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                {isLoadingSources ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Discovering Available Feeds...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center font-bold text-sm text-indigo-600 ring-1 ring-slate-100">
                        {selectedSymbolInfo.symbol.substring(0, 2)}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900">{selectedSymbolInfo.symbol}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedSymbolInfo.name}</p>
                      </div>
                      <button 
                        onClick={() => setSelectedSymbolInfo(null)}
                        className="ml-auto text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                      >
                        Change
                      </button>
                    </div>

                    {/* Broker feed source */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Broker Feed / Data Source</label>
                      <div className="grid grid-cols-2 gap-2">
                        {availableSources.filter(src => {
                          if (selectedSymbolInfo.category === 'Stocks') {
                            return ['exness', 'axiory'].includes(src.toLowerCase());
                          }
                          return true;
                        }).map(src => {
                          const meta = getSourceMeta(src);
                          const isSelected = brokerSource.toLowerCase() === src.toLowerCase();
                          const isStocks = selectedSymbolInfo.category === 'Stocks';
                          const isCustomCat = ['Forex', 'Metals', 'Indices'].includes(selectedSymbolInfo.category);
                          const isDisabled = (isCustomCat && ['fxcm', 'oando', 'axiory'].includes(src.toLowerCase())) ||
                                             (selectedSymbolInfo.category === 'Crypto' && src.toLowerCase() === 'okx') ||
                                             (isStocks && src.toLowerCase() === 'axiory');
                          const isRecommended = ((isCustomCat || isStocks) && src.toLowerCase() === 'exness') ||
                                                (selectedSymbolInfo.category === 'Crypto' && src.toLowerCase() === 'binance');
                          const isPoor = isCustomCat && src.toLowerCase() === 'dukascopy';
                          return (
                            <button
                              key={src}
                              disabled={isDisabled}
                              onClick={() => !isDisabled && setBrokerSource(src)}
                              className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between min-h-[82px] ${
                                isDisabled 
                                  ? 'bg-slate-50 border-slate-100 text-slate-300 opacity-40 cursor-not-allowed select-none' 
                                  : isSelected 
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm cursor-pointer' 
                                    : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50/80 hover:border-slate-200 cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center gap-2 justify-between w-full">
                                <span className={`text-xs font-black uppercase tracking-tight flex items-center gap-1 flex-wrap ${isDisabled ? 'text-slate-400' : ''}`}>
                                  {meta.name}
                                  {isRecommended && (
                                    <span className="inline-block shrink-0 px-1 py-0.5 rounded-full text-[6px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100/60 font-sans">
                                      REC
                                    </span>
                                  )}
                                  {isPoor && (
                                    <span className="inline-block shrink-0 px-1 py-0.5 rounded-full text-[6px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100/60 font-sans">
                                      POOR
                                    </span>
                                  )}
                                  {isDisabled && (
                                    <span className="inline-block shrink-0 px-1 py-0.5 rounded-full text-[6px] font-black uppercase tracking-wider bg-slate-100 text-slate-400 border border-slate-200 font-sans">
                                      SOON
                                    </span>
                                  )}
                                </span>
                                <img 
                                  src={`https://logo.clearbit.com/${src}.com`} 
                                  className={`w-4 h-4 rounded-md object-contain error-logo opacity-80 ${isDisabled ? 'grayscale opacity-30' : ''}`}
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <span className="text-[9px] font-bold text-slate-400 tracking-tight leading-tight mt-1 line-clamp-1">{meta.desc}</span>
                              {isSelected && !isDisabled && (
                                <div className="absolute top-2 right-2 bg-indigo-600 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center">
                                  <Check size={9} strokeWidth={3} />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Crypto market options (Spot vs Perpetual) */}
                    {selectedSymbolInfo.category === 'Crypto' && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Market Segment</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setCryptoMarketType('spot')}
                            className={`flex-1 p-2.5 rounded-xl border text-[10px] font-bold tracking-tight uppercase transition-all cursor-pointer ${
                              cryptoMarketType === 'spot' 
                                ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                                : 'bg-white text-slate-600 border-slate-100 hover:bg-slate-50'
                            }`}
                          >
                            Spot Market
                          </button>
                          <button
                            onClick={() => setCryptoMarketType('coin-futures')}
                            className={`flex-1 p-2.5 rounded-xl border text-[10px] font-bold tracking-tight uppercase transition-all cursor-pointer ${
                              cryptoMarketType === 'coin-futures' 
                                ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                                : 'bg-white text-slate-600 border-slate-100 hover:bg-slate-50'
                            }`}
                          >
                            Perpetual Futures
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </div>

          <div className="p-6 bg-slate-50/50 border-t border-slate-50/50 flex gap-3 shrink-0 bg-white">
            {selectedSymbolInfo && !isLoadingSources && (
              <button
                onClick={handleConfirm}
                className="w-full bg-slate-950 text-white rounded-[2rem] py-4 font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10 active:scale-95 cursor-pointer"
              >
                <Check size={14} strokeWidth={2.5} />
                Activate Comparison
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
