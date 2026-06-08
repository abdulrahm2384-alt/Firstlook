/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { JournalTrade } from '../types';

interface TradingCalendarProps {
  trades: JournalTrade[];
  simulatedTime?: number; // timestamp in seconds
}

export function TradingCalendar({ trades, simulatedTime }: TradingCalendarProps) {
  // Use simulated time if provided, otherwise real current date
  const baseDate = useMemo(() => 
    simulatedTime ? new Date(simulatedTime * 1000) : new Date(), 
    [simulatedTime]
  );
  
  const [viewDate, setViewDate] = useState(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));

  // Reset view date if baseDate month changes significantly (e.g. simulation jumped far)
  React.useEffect(() => {
    setViewDate(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
  }, [baseDate.getFullYear(), baseDate.getMonth()]);

  const dailyPerformance = useMemo(() => {
    const perf: Record<string, number> = {};
    trades.forEach(t => {
      if (!t.exitTime || isNaN(t.exitTime)) return;
      const dateRaw = new Date(t.exitTime * 1000);
      if (isNaN(dateRaw.getTime())) return;
      const date = dateRaw.toISOString().split('T')[0];
      perf[date] = (perf[date] || 0) + (t.rr || 0);
    });
    return perf;
  }, [trades]);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const handleNextMonth = () => setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = viewDate.toLocaleString('default', { month: 'long' });

  const days = [];
  const startDay = firstDayOfMonth(year, month);
  const totalDays = daysInMonth(year, month);

  // Fill in empty slots for the first week
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }

  // Fill in the actual days
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const perf = dailyPerformance[dateStr];
    days.push({ day: d, perf, dateStr });
  }

  const simulatedDateStr = baseDate.toISOString().split('T')[0];
  const isActuallySimulating = !!simulatedTime;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-3 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isActuallySimulating ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`} />
            <span className={`text-[8px] font-black uppercase tracking-widest ${isActuallySimulating ? 'text-indigo-600' : 'text-slate-400'}`}>
              {isActuallySimulating ? 'Simulated Phase' : 'Real-Time Mode'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">
              {monthName} {year}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={handlePrevMonth}
            className="p-1 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all text-slate-400"
          >
            <ChevronLeft size={14} />
          </button>
          <button 
            onClick={handleNextMonth}
            className="p-1 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all text-slate-400"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={`weekday-${i}-${d}`} className="text-[7px] font-bold text-slate-400 text-center uppercase py-1">{d}</div>
        ))}
        {days.map((d, i) => {
          if (!d) return <div key={`empty-${i}`} className="aspect-square" />;
          
          const isSimulatedDay = d.dateStr === simulatedDateStr;
          const hasTrade = d.perf !== undefined;
          const isWin = (d.perf || 0) > 0;
          const isNeutral = (d.perf || 0) === 0;

          return (
            <div 
              key={`day-${d.dateStr}`} 
              className={`
                aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all border
                ${isSimulatedDay ? 'border-indigo-400 ring-2 ring-indigo-50 shadow-sm z-10' : 'border-transparent'}
                ${hasTrade && isWin ? 'bg-emerald-500 text-white border-emerald-600' : ''}
                ${hasTrade && !isWin && !isNeutral ? 'bg-rose-500 text-white border-rose-600' : ''}
                ${!hasTrade || isNeutral ? 'text-slate-400 hover:bg-slate-50' : ''}
              `}
            >
              <span className={`text-[8px] font-black ${hasTrade ? 'text-white' : ''}`}>{d.day}</span>
              {hasTrade && isWin && (
                <div className="absolute top-0.5 right-0.5 text-white/80">
                  <CheckCircle2 size={6} strokeWidth={4} />
                </div>
              )}
              {hasTrade && (
                <span className={`text-[6px] font-black leading-none mt-0.5 ${hasTrade ? 'text-white/90' : 'text-slate-400'}`}>
                   {d.perf > 0 ? '+' : ''}{d.perf?.toFixed(1)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      
      {isActuallySimulating && (
        <div className="flex items-center justify-between px-1 pt-1 border-t border-slate-50">
          <div className="flex items-center gap-1.5">
            {!isSimulatedDayVisible(days, simulatedDateStr) && <div className="w-1 h-1 rounded-full bg-indigo-400" />}
            <span className="text-[7px] font-bold text-indigo-500 uppercase tracking-widest">
              {isSimulatedDayVisible(days, simulatedDateStr) ? 'Active Phase' : 'Session Date'}
            </span>
          </div>
          <div className="text-[8px] font-black text-slate-900 flex items-center gap-1">
            <span className="text-slate-400 font-bold uppercase tracking-tighter mr-0.5">EST.</span>
            {baseDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      )}
    </div>
  );
}

function isSimulatedDayVisible(days: (any | null)[], simulatedDateStr: string) {
  return days.some(d => d && d.dateStr === simulatedDateStr);
}
