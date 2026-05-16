import { motion, AnimatePresence, Reorder } from 'motion/react';
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
  Shield,
  Layers,
  Database,
  AlertCircle
} from 'lucide-react';
import React, { useState, useEffect, useRef, useMemo, memo, useCallback, useDeferredValue } from 'react';
import { BacktestSession, MarketSymbol, MarketType } from '../types';
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
  isMenuOpen: boolean;
  onToggleMenu: (id: string | null) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  setups: any[];
}

const WatchlistItemRow = memo(({ 
  item, 
  session, 
  onSelect, 
  onToggleStatus, 
  onDelete, 
  onEditNotes,
  isMenuOpen,
  onToggleMenu,
  menuRef,
  setups
}: WatchlistItemRowProps) => {
  const sessionKey = item.prefix ? `${item.symbol}_${item.prefix}` : item.symbol;
  
  const setup = useMemo(() => {
    const itemSymbolNorm = normalizeSymbol(item.symbol);
    return setups.find(s => normalizeSymbol(s.symbol) === itemSymbolNorm);
  }, [item.symbol, setups]);

  const progress = useMemo(() => {
    if (!session) return { percent: '0.00%', fraction: 0, label: '0.00%' };
    // session.startTime and session.currentTime are in seconds. createdAt is in ms.
    const start = session.startTime; 
    const target = session.createdAt / 1000;
    const cur = session.currentTime;
    
    const p = target > start ? Math.min(100, Math.max(0, ((cur - start) / (target - start)) * 100)) : 100;
    const label = p > 0 && p < 0.01 ? ">0.01%" : `${p.toFixed(2)}%`;
    return {
      percent: `${p}%`,
      fraction: p,
      label
    };
  }, [session?.currentTime, session?.startTime, session?.createdAt]);

  return (
    <Reorder.Item 
      key={item.id}
      value={item}
      className="relative will-change-transform transform-gpu"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <div 
        onClick={() => onSelect(item.symbol, item.prefix, item.id)}
        className="flex gap-4 px-4 py-2.5 rounded-2xl items-center hover:bg-slate-50 transition-all group cursor-pointer border border-transparent hover:border-slate-100 bg-white"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
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
            <span className="font-black text-slate-900 text-[11px] uppercase tracking-tight truncate flex items-center gap-1.5">
              {item.symbol} 
              {setup && (
                 <span className="px-1 py-0.5 rounded bg-slate-900 text-white text-[7px] font-black uppercase leading-none">
                   {setup.grade}
                 </span>
              )}
              {item.prefix && (
                <span className="text-indigo-500 ml-1.5 opacity-80">
                   ({item.prefix.length > 8 ? `${item.prefix.substring(0, 7)}...` : item.prefix})
                </span>
              )}
            </span>
            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider truncate">
                {item.dataSource || item.name} {item.marketType ? `• ${item.marketType.replace('-', ' ')}` : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-10 shrink-0 pointer-events-none">
          <div className="flex flex-col items-end">
            <span className="text-[6px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Start</span>
            <span className="font-mono font-bold text-[8px] tracking-tight text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded-full border border-slate-100/50">
              {session ? new Date(session.startTime * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : '---'}
            </span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[6px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Progress</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-[9px] tracking-tight text-indigo-600">
                {progress.label}
              </span>
              <div className="w-10 h-1 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                <div 
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                  style={{ width: progress.fraction > 0 ? `${Math.max(2, progress.fraction)}%` : '0%' }} 
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end hidden lg:flex">
            <span className="text-[6px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Created</span>
            <span className="font-mono font-bold text-[8px] tracking-tight text-slate-400">
              {session ? new Date(session.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '---'}
            </span>
          </div>
        </div>

        <div className="flex justify-end items-center ml-2 relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu(isMenuOpen ? null : sessionKey);
            }}
            className="p-1 text-slate-300 hover:text-slate-900 hover:bg-slate-100 rounded transition-all"
          >
            <MoreVertical size={14} />
          </button>
          {isMenuOpen && (
            <div 
              ref={menuRef}
              className="absolute right-0 top-8 w-32 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 overflow-hidden py-1 shadow-indigo-500/10"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  onEditNotes(item);
                  onToggleMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
              >
                <LineChart size={12} className="text-slate-400" />
                <span className="text-[8px] font-black uppercase tracking-widest leading-none">Notes</span>
              </button>
              {item.status === 'completed' && (
                <button
                  onClick={() => onToggleStatus(item.symbol, item.prefix)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                >
                  <Clock size={12} className="text-indigo-500" />
                  <span className="text-[8px] font-black uppercase tracking-widest leading-none">Restore</span>
                </button>
              )}
              <button
                onClick={() => onDelete(item.symbol, item.prefix, item.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-red-50 text-red-500 transition-colors"
              >
                <Trash2 size={12} />
                <span className="text-[8px] font-black uppercase tracking-widest leading-none">Delete</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </Reorder.Item>
  );
}, (prev, next) => {
  return prev.item === next.item && 
         prev.session?.currentTime === next.session?.currentTime && 
         prev.session?.startTime === next.session?.startTime &&
         prev.isMenuOpen === next.isMenuOpen &&
         prev.setups === next.setups;
});

interface WatchlistPageProps {
  userId?: string;
  onSelectSymbol: (symbol: string, prefix?: string, id?: string, source?: string, marketType?: MarketType) => void;
  onDeleteItem?: (symbol: string, prefix?: string, id?: string) => void;
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
  setups = []
}: WatchlistPageProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
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
    
    // Fetch available sources for this symbol
    setIsLoadingSources(true);
    try {
      const response = await fetch(`/api/sources?symbol=${encodeURIComponent(asset.symbol)}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableSources(data.sources || []);
      } else {
        setAvailableSources(['binance', 'coinbase', 'twelvedata']); // Base fallbacks
      }
    } catch (err) {
      console.error('Failed to fetch sources:', err);
      setAvailableSources(['binance', 'coinbase', 'twelvedata']);
    } finally {
      setIsLoadingSources(false);
    }
  }, []);

  const filteredSources = useMemo(() => {
    if (!selectedAssetForSource) return [];
    
    const allPotentialSources = [
      { id: 'binance', name: 'Binance', description: 'World\'s Largest Exchange' },
      { id: 'okx', name: 'OKX', description: 'Global Crypto Ecosystem' },
      { id: 'bybit', name: 'Bybit', description: 'Fastest Matching Engine' },
      { id: 'bitflyer', name: 'bitFlyer', description: 'Japan\'s Leading Exchange' },
      { id: 'twelvedata', name: 'TwelveData', description: 'Premium Market Feed' }
    ];

    return allPotentialSources.filter(s => {
      if (selectedAssetForSource.category === 'Crypto') {
        if (s.id === 'twelvedata') return false;
        return availableSources.includes(s.id);
      }
      return s.id === 'twelvedata'; 
    });
  }, [selectedAssetForSource, availableSources]);

  const addToWatchlist = async (asset: MarketSymbol, source: string) => {
    setValidatingSymbol(true);
    setValidationError(null);
    
    try {
      // Just a quick check to see if the source supports the symbol
      const isSupported = await validateSymbolSupport(asset.symbol, source);
      
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
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
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

  return (
    <div className="flex flex-col h-full bg-white text-slate-900 relative overflow-hidden antialiased">
      {/* Header */}
      <div className="px-8 py-6 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900">Watchlist</h2>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="w-8 h-8 bg-slate-900 text-white rounded-lg hover:bg-black transition-all flex items-center justify-center shadow-sm"
        >
          <Plus size={18} strokeWidth={2.5} />
        </motion.button>
      </div>

      {/* Tabs */}
      <div className="px-8 mb-8 shrink-0">
        <div className={`flex bg-slate-100/50 p-1.5 rounded-[1.5rem] border border-slate-100 ${!isMobile ? 'max-w-md mx-auto p-2' : ''}`}>
          <button
            onClick={() => setActiveTab('ongoing')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-[1.2rem] transition-all px-4 ${
              isMobileLandscape ? 'py-[1.5vh] text-[1.8vh]' : !isMobile ? 'py-4 text-xs' : 'py-3 text-[10px]'
            } font-black uppercase tracking-widest ${
              activeTab === 'ongoing' 
                ? 'bg-white text-slate-900 shadow-md border border-slate-100' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Clock size={isMobileLandscape ? '2.5vh' : !isMobile ? 18 : 14} strokeWidth={activeTab === 'ongoing' ? 3 : 2} />
            Ongoing
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-[1.2rem] transition-all px-4 ${
              isMobileLandscape ? 'py-[1.5vh] text-[1.8vh]' : !isMobile ? 'py-4 text-xs' : 'py-3 text-[10px]'
            } font-black uppercase tracking-widest ${
              activeTab === 'completed' 
                ? 'bg-white text-slate-900 shadow-md border border-slate-100' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <CheckCircle2 size={isMobileLandscape ? '2.5vh' : !isMobile ? 18 : 14} strokeWidth={activeTab === 'completed' ? 3 : 2} />
            Completed
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 pb-12 overflow-x-hidden">
        <div className="max-w-4xl mx-auto px-4 py-2">
          {isLoading ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="flex gap-4 px-4 py-3 rounded-2xl items-center bg-white border border-slate-50 animate-pulse">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 shrink-0" />
                  <div className="flex flex-col flex-1 gap-2">
                    <div className="h-3 w-20 bg-slate-50 rounded" />
                    <div className="h-2 w-32 bg-slate-50/50 rounded" />
                  </div>
                  <div className="flex items-center gap-6 md:gap-12">
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="h-1.5 w-6 bg-slate-50 rounded" />
                      <div className="h-3 w-14 bg-slate-50 rounded-full" />
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="h-1.5 w-10 bg-slate-50 rounded" />
                      <div className="h-3 w-20 bg-slate-50 rounded-full" />
                    </div>
                  </div>
                  <div className="w-4 h-4 rounded bg-slate-50 ml-2" />
                </div>
              ))}
            </div>
          ) : currentItems.length > 0 ? (
            <Reorder.Group axis="y" values={currentItems} onReorder={handleReorder} className="space-y-1">
              {currentItems.map((item) => {
                const sessionKey = item.prefix ? `${item.symbol}_${item.prefix}` : item.symbol;
                return (
                  <WatchlistItemRow
                    key={item.id}
                    item={item}
                    session={backtestSessions[sessionKey]}
                    onSelect={handleSelect}
                    onToggleStatus={toggleStatus}
                    onDelete={deleteItem}
                    onEditNotes={handleEditNotes}
                    isMenuOpen={menuOpenId === sessionKey}
                    onToggleMenu={handleToggleMenu}
                    menuRef={menuRef}
                    setups={setups}
                  />
                );
              })}
            </Reorder.Group>
          ) : (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-200">
                {activeTab === 'ongoing' ? <Clock size={32} /> : <CheckCircle2 size={32} />}
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">No {activeTab} pairs</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Start by adding an asset to your watch board</p>
            </div>
          )}
        </div>
      </div>

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
                        {filteredSources.map(source => (
                          <button
                            key={source.id}
                            onClick={() => addToWatchlist(selectedAssetForSource!, source.id)}
                            className="w-full group flex items-center justify-between p-6 rounded-3xl transition-all text-left border bg-slate-50/50 hover:bg-slate-900 hover:border-slate-800 border-slate-100 hover:scale-[1.01] active:scale-[0.99] transform-gpu"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm group-hover:bg-white/10 overflow-hidden shrink-0">
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
                                      text.className = 'text-[10px] font-black text-indigo-500 group-hover:text-white';
                                      text.innerText = source.name.substring(0, 2).toUpperCase();
                                      parent.appendChild(text);
                                    }
                                  }}
                                />
                              </div>
                              <div>
                                <span className="font-black text-slate-900 group-hover:text-white uppercase tracking-tight text-base block">{source.name}</span>
                                <span className="text-[8px] font-black uppercase tracking-[0.1em] text-slate-400 group-hover:text-white/60">
                                  {source.description}
                                </span>
                              </div>
                            </div>
                            <ChevronRight size={20} className="text-slate-300 group-hover:text-white" />
                          </button>
                        ))}
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
                    disabled={true}
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
