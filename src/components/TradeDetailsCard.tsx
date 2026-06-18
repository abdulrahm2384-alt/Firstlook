import { useState } from 'react';
import { motion } from 'motion/react';
import { X, TrendingUp, TrendingDown, Clock, Target, LayoutGrid, Lock } from 'lucide-react';
import { Drawing, DrawingType } from '../types/drawing';
import { JournalTrade } from '../types';
import { calculatePips } from '../lib/marketUtils';

interface TradeDetailsCardProps {
  drawing?: Drawing;
  trade?: JournalTrade;
  onClose?: () => void;
  subscriptionPlan?: 'basic' | 'plus' | 'premium';
}

export function TradeDetailsCard({ drawing, trade, onClose, subscriptionPlan = 'basic', className }: TradeDetailsCardProps & { className?: string }) {
  const plan = typeof subscriptionPlan === 'string' ? subscriptionPlan : 'basic';
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic');
  let info = trade || drawing?.settings?.tradeInfo;

  // Recalculate or override with mathematically correct R:R based on the trigger initialStopPrice
  if (drawing && (drawing.status === 'won' || drawing.status === 'lost')) {
    const isLong = drawing.type === DrawingType.LONG_POSITION;
    const p0 = drawing.points[0];
    const p1 = drawing.points[1];
    const p2 = drawing.points[2] || p0;
    
    if (p0 && p1) {
      const entry = p0.price;
      const target = p1.price;
      const originalStopValue = p2.price;
      const exitPrice = drawing.status === 'won' ? target : (drawing.managedStopPrice ?? originalStopValue);
      const initialStopValue = drawing.initialStopPrice !== undefined ? drawing.initialStopPrice : originalStopValue;
      
      const risk = Math.abs(entry - initialStopValue) || 0.00000001;
      const diff = isLong ? (exitPrice - entry) : (entry - exitPrice);
      const computedRawRr = diff / risk;
      const computedRr = isFinite(computedRawRr) ? computedRawRr : (drawing.status === 'won' ? 10 : -10);
      
      // Duration
      const diffSec = (drawing.statusAt || Date.now() / 1000) - (drawing.triggeredAt || p0.time);
      const days = Math.floor(diffSec / 86400);
      const hours = Math.floor((diffSec % 86400) / 3600);
      const mins = Math.floor((diffSec % 3600) / 60);
      const duration = (days > 0 ? `${days}d ` : '') + (hours > 0 ? `${hours}h ` : '') + `${mins}m`;

      if (info) {
        info = {
          ...info,
          rr: parseFloat(computedRr.toFixed(2)),
          pips: calculatePips(drawing.symbol, entry, exitPrice)
        };
      } else {
        info = {
          symbol: drawing.symbol,
          type: isLong ? 'LONG' : 'SHORT',
          status: drawing.status === 'won' ? 'TP' : 'SL',
          entryPrice: entry,
          exitPrice: exitPrice,
          entryTime: drawing.triggeredAt || p0.time,
          exitTime: drawing.statusAt || Date.now() / 1000,
          rr: parseFloat(computedRr.toFixed(2)),
          pips: calculatePips(drawing.symbol, entry, exitPrice),
          duration: duration,
          setupGrade: drawing.settings?.setupGrade,
          confluences: drawing.settings?.confluences,
          notes: drawing.settings?.notes,
        };
      }
    }
  }

  if (!info) return null;

  const isWin = info.status === 'TP' || info.status === 'won' || info.status === 'WON' || info.status === 'win' || info.status === 'WIN';

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
          <span className="text-sm font-black uppercase tracking-wider">{info.symbol} {isWin ? 'TP' : 'SL'}</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer">
          <X size={16} />
        </button>
      </div>

      {/* Tabs Switcher at the top of card body */}
      <div className="flex border-b border-slate-100 bg-slate-50/50 p-1">
        <button
          onClick={() => setActiveTab('basic')}
          className={`flex-1 py-1.5 text-[9.5px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center ${
            activeTab === 'basic'
              ? 'bg-white text-slate-800 shadow-sm border border-slate-205'
              : 'text-slate-450 hover:text-slate-700 hover:bg-slate-100/70'
          }`}
        >
          Basic Specs
        </button>
        <button
          onClick={() => setActiveTab('advanced')}
          className={`flex-1 py-1.5 text-[9.5px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
            activeTab === 'advanced'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-450 hover:text-slate-700 hover:bg-slate-100/70'
          }`}
        >
          {plan === 'basic' && <Lock size={9} className="text-amber-500 fill-amber-500/10 shrink-0" />}
          Advanced Details
        </button>
      </div>

      <div className="p-4 space-y-4">
        {activeTab === 'basic' ? (
          /* BASIC VIEW */
          <div className="space-y-4">
            {/* Main Stats Display */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100/70">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-450 uppercase tracking-wider">Net RR</span>
                <span className={`text-xl font-black leading-tight ${isWin ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {info.rr > 0 ? `+${info.rr.toFixed(2)}R` : `${info.rr.toFixed(2)}R`}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black text-slate-450 uppercase tracking-wider">Pips</span>
                <span className={`text-base font-extrabold leading-tight ${isWin ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {info.pips?.toFixed(1) || '0.0'}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-black text-slate-450 uppercase tracking-wider">Duration</span>
                <span className="text-sm font-extrabold text-slate-700 leading-tight">{info.duration || '---'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-y-2 text-[11px] bg-white border border-slate-100 p-2.5 rounded-xl">
              <div className="flex flex-col">
                <span className="text-slate-400 font-bold uppercase text-[8.5px] tracking-wide">Direction</span>
                <span className="font-extrabold text-slate-700">{info.type || '---'}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-slate-400 font-bold uppercase text-[8.5px] tracking-wide">Market</span>
                <span className="font-extrabold text-slate-700">{info.symbol || '---'}</span>
              </div>
              
              <div className="h-px col-span-2 bg-slate-100/50 my-1" />

              <div className="flex flex-col">
                <span className="text-slate-400 font-bold uppercase text-[8.5px] tracking-wide">Entry Price</span>
                <span className="font-mono font-extrabold text-slate-650">{info.entryPrice ? info.entryPrice.toFixed(5) : '---'}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-slate-400 font-bold uppercase text-[8.5px] tracking-wide">Exit Price</span>
                <span className="font-mono font-extrabold text-slate-650">{info.exitPrice ? info.exitPrice.toFixed(5) : '---'}</span>
              </div>
            </div>

            {/* Action / Meta Footer */}
            <div className="pt-1 flex items-center justify-center">
              <div className="px-3 py-1 bg-slate-50/70 border border-slate-100/50 rounded-full flex items-center gap-1.5">
                <Clock size={10} className="text-slate-400" />
                <span className="text-[9px] font-medium text-slate-500">
                  Closed: {new Date(info.exitTime * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* ADVANCED VIEW */
          plan === 'basic' ? (
            /* BASIC PLAN LOCK PANEL */
            <div className="p-2 py-6 text-center flex flex-col items-center justify-center space-y-3.5 bg-slate-50/50 rounded-2xl border border-dashed border-slate-205">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-sm">
                <Lock size={18} className="stroke-[2.5]" />
              </div>
              <div className="space-y-1 max-w-[250px]">
                <h5 className="text-[11px] font-black uppercase text-slate-800 tracking-wider">Advanced Metrics Locked</h5>
                <p className="text-[9.5px] text-slate-500 leading-relaxed font-bold">
                  Custom confluences, execution classes, automated commission analysis, and journal logs require a subscription to <span className="text-indigo-600 font-black">Plus</span> or <span className="text-indigo-600 font-black">Premium</span> plans.
                </p>
              </div>
            </div>
          ) : (
            /* ADVANCED METRICS CONTENT */
            <div className="space-y-4">
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

              {/* Timeframe indicator */}
              <div className="grid grid-cols-2 gap-2 text-[11.5px] bg-white border border-slate-100 p-2 rounded-xl">
                <div className="flex flex-col">
                  <span className="text-slate-400 font-bold uppercase text-[8px] tracking-wide">Analysis Timeframe</span>
                  <span className="font-extrabold text-slate-850">{info.timeframe || 'Not Registered'}</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-slate-400 font-bold uppercase text-[8px] tracking-wide">Play Interval</span>
                  <span className="font-extrabold text-slate-850">{info.timeframe ? `${info.timeframe} simulation` : 'Manual Canvas'}</span>
                </div>
              </div>

              {/* Commission/Fee simulation if present */}
              {info.grossRr !== undefined && info.commission !== undefined && info.commission > 0 ? (
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 flex items-center justify-between text-[10px]">
                  <div className="flex flex-col">
                    <span className="text-[8px] text-slate-400 uppercase font-bold">Gross Gain</span>
                    <span className="font-bold text-slate-700">{info.grossRr > 0 ? '+' : ''}{info.grossRr.toFixed(2)}R</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] text-slate-400 uppercase font-bold">Fee (0.05 per R)</span>
                    <span className="font-bold text-rose-500 font-mono">-{info.commission.toFixed(3)}R</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] text-slate-400 uppercase font-bold">Net R realized</span>
                    <span className={`font-black ${isWin ? 'text-emerald-600' : 'text-rose-600'}`}>{info.rr > 0 ? '+' : ''}{info.rr.toFixed(2)}R</span>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50/30 border border-emerald-100/45 rounded-xl px-3 py-2 text-center">
                  <span className="text-[8.5px] uppercase font-black tracking-wider text-emerald-650 block">Commission Shield Active</span>
                  <p className="text-[9.5px] text-slate-550 mt-0.5 font-medium leading-relaxed">
                    Zero flat-rate broker fees or margin commissions applied to this live historical replay.
                  </p>
                </div>
              )}

              {/* Notes Journal Entry section */}
              {info.notes ? (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-105">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Log Commentary notes</span>
                  <p className="text-[10px] text-slate-600 leading-relaxed italic pr-1 max-h-[80px] overflow-y-auto">{info.notes}</p>
                </div>
              ) : (
                <div className="bg-slate-50/50 p-3 rounded-xl border border-dashed border-slate-200 text-center font-bold">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Log Commentary notes</span>
                  <span className="text-[9px] text-slate-400 mt-1 block">No notes logged for this setup.</span>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </motion.div>
  );
}
