import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, ChevronRight } from 'lucide-react';
import { Drawing } from '../types/drawing';

interface TriggerSetupModalProps {
  drawing: Drawing | null;
  setups: any[];
  onSelect: (setupId: string, notes?: string) => void;
}

export function TriggerSetupModal({ drawing, setups, onSelect }: TriggerSetupModalProps) {
  const [notes, setNotes] = useState('');
  if (!drawing) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col"
        >
          <div className="p-6 border-b border-slate-50 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-lg font-black text-slate-900 leading-tight">Trade Triggered!</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Select your execution setup</p>
            </div>
          </div>

          <div className="p-4 flex-1 overflow-y-auto scrollbar-hide space-y-6">
            <div className="space-y-2">
              {setups
                .filter(s => (s.confluences && s.confluences.length > 0) || s.image_url)
                .sort((a, b) => {
                  const order: Record<string, number> = { 'A+': 1, 'B': 2, 'C': 3 };
                  return (order[a.grade] || 99) - (order[b.grade] || 99);
                })
                .map((setup) => {
                  const grade = setup.grade;
                  return (
                    <button
                      key={grade}
                      onClick={() => onSelect(grade, notes)}
                      className="w-full group relative flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-slate-50 transition-all text-left"
                    >
                      <div className={`w-12 h-12 flex items-center justify-center rounded-xl font-black text-xl shadow-sm ${
                        grade === 'A+' ? 'bg-emerald-50 text-emerald-600' :
                        grade === 'B' ? 'bg-indigo-50 text-indigo-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {grade}
                      </div>
                      
                      <div className="flex-1">
                        <div className="text-[11px] font-black text-slate-900 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">
                          {grade === 'A+' ? 'Tier 1 Action' : grade === 'B' ? 'Secondary Model' : 'Class C Execution'}
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">
                          {setup.confluences?.length || 0} Registered Confluences
                        </div>
                      </div>

                      <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                    </button>
                  );
                })}
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Trade Observations (Notes)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did you see in this entry? (e.g. displacement, liquidity sweep, etc)"
                className="w-full h-24 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/5 transition-all resize-none"
              />
            </div>
          </div>

          <div className="p-6 bg-slate-50/50 flex flex-col gap-3 shrink-0">
             <div className="flex items-start gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                <CheckCircle2 size={16} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                  Journaling this trade will automatically include the selected setup and its confluences in your history.
                </p>
             </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
