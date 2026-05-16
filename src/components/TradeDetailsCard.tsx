import { motion } from 'motion/react';
import { X, TrendingUp, TrendingDown, Clock, Target, LayoutGrid } from 'lucide-react';
import { Drawing, DrawingType } from '../types/drawing';
import { JournalTrade } from '../types';
import { calculatePips } from '../lib/marketUtils';

interface TradeDetailsCardProps {
  drawing?: Drawing;
  trade?: JournalTrade;
  onClose?: () => void;
}

export function TradeDetailsCard({ drawing, trade, onClose, className }: TradeDetailsCardProps & { className?: string }) {
  let info = trade || drawing?.settings.tradeInfo;

  // Fallback: If drawing is closed but tradeInfo is missing from settings, compute it
  if (!info && drawing && (drawing.status === 'won' || drawing.status === 'lost')) {
    const isLong = drawing.type === DrawingType.LONG_POSITION;
    const p0 = drawing.points[0];
    const p1 = drawing.points[1];
    const p2 = drawing.points[2] || p0;
    
    if (p0 && p1) {
      const entry = p0.price;
      const target = p1.price;
      const originalStopValue = p2.price;
      const exitPrice = drawing.status === 'won' ? target : (drawing.managedStopPrice ?? originalStopValue);
      
      const risk = Math.abs(entry - originalStopValue) || 1;
      const reward = Math.abs(exitPrice - entry);
      const rr = (reward / risk) * (drawing.status === 'won' ? 1 : -1);
      
      // Duration
      const diffSec = (drawing.statusAt || Date.now() / 1000) - (drawing.triggeredAt || p0.time);
      const days = Math.floor(diffSec / 86400);
      const hours = Math.floor((diffSec % 86400) / 3600);
      const mins = Math.floor((diffSec % 3600) / 60);
      const duration = (days > 0 ? `${days}d ` : '') + (hours > 0 ? `${hours}h ` : '') + `${mins}m`;

      info = {
        symbol: drawing.symbol,
        type: isLong ? 'LONG' : 'SHORT',
        status: drawing.status === 'won' ? 'TP' : 'SL',
        entryPrice: entry,
        exitPrice: exitPrice,
        entryTime: drawing.triggeredAt || p0.time,
        exitTime: drawing.statusAt || Date.now() / 1000,
        rr: parseFloat(rr.toFixed(2)),
        pips: calculatePips(drawing.symbol, entry, exitPrice),
        duration: duration,
        setupGrade: drawing.settings?.setupGrade,
        confluences: drawing.settings?.confluences,
        notes: drawing.settings?.notes,
      };
    }
  }

  if (!info) return null;

  const isWin = info.status === 'TP';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      className={className || "w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden pointer-events-auto"}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Mini Header */}
      <div className={`px-4 py-3 flex items-center justify-between ${isWin ? 'bg-emerald-500' : 'bg-rose-500'} text-white`}>
        <div className="flex items-center gap-2">
          {info.type === 'LONG' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          <span className="text-sm font-black uppercase tracking-wider">{info.symbol} {info.status}</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Setup Grade Highlight - MUCH MORE PROMINENT */}
        <div className="bg-slate-900 rounded-2xl p-4 flex items-center justify-between shadow-lg overflow-hidden relative group">
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-indigo-600/10 skew-x-[-20deg] translate-x-16 group-hover:translate-x-12 transition-transform" />
          <div className="relative z-10">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] block mb-1">Execution Class</span>
            <div className="text-2xl font-black text-white flex items-center gap-2">
               {info.setupGrade || 'UNRANKED'}
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Setup</span>
            </div>
          </div>
          <div className="text-right relative z-10">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] block mb-1">Confluences</span>
            <span className="text-xl font-black text-white">{info.confluences?.length || 0}</span>
          </div>
        </div>

        {/* Main Stats Display */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">RR</span>
            <span className={`text-xl font-black leading-tight ${isWin ? 'text-emerald-600' : 'text-rose-600'}`}>
              {info.rr > 0 ? `+${info.rr}R` : `${info.rr}R`}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Pips</span>
            <span className={`text-sm font-bold leading-tight ${isWin ? 'text-emerald-600' : 'text-rose-600'}`}>
              {info.pips?.toFixed(1) || '0.0'}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Duration</span>
            <span className="text-sm font-bold text-slate-700 leading-tight">{info.duration}</span>
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        <div className="grid grid-cols-2 gap-y-2 text-[11px]">
          <div className="flex flex-col">
            <span className="text-slate-400 font-medium">Type</span>
            <span className="font-bold text-slate-700">{info.type}</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-slate-400 font-medium">Timeframe</span>
            <span className="font-bold text-slate-700">{info.timeframe || '---'}</span>
          </div>
          <div className="flex flex-col border-r border-slate-50 pr-2">
            <span className="text-slate-400 font-medium">Entry</span>
            <span className="font-mono text-slate-600">{info.entryPrice.toFixed(5)}</span>
          </div>
          <div className="flex flex-col pl-2 text-right">
            <span className="text-slate-400 font-medium">Exit</span>
            <span className="font-mono text-slate-600">{info.exitPrice.toFixed(5)}</span>
          </div>
        </div>

        {info.notes && (
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight block mb-1">Notes</span>
            <p className="text-[10px] text-slate-600 leading-relaxed italic">{info.notes}</p>
          </div>
        )}

        {/* Action / Meta Footer */}
        <div className="pt-1 flex items-center justify-center">
            <div className="px-3 py-1 bg-slate-50 rounded-full flex items-center gap-1.5">
                <Clock size={10} className="text-slate-400" />
                <span className="text-[9px] font-medium text-slate-500">
                    {new Date(info.exitTime * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </div>
      </div>
    </motion.div>
  );
}
