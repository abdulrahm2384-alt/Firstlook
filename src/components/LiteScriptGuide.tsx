import { motion } from 'motion/react';
import { Book, Code, Clock, TrendingUp, Info, Sliders, ChevronLeft } from 'lucide-react';

interface LiteScriptGuideProps {
  onBack?: () => void;
}

export function LiteScriptGuide({ onBack }: LiteScriptGuideProps) {
  return (
    <div className="p-6 space-y-10 text-[#d1d4dc] overflow-y-auto h-full custom-scrollbar bg-[#131722]">
      <header className="space-y-3">
        {onBack && (
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors mb-2 group"
          >
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Back to Editor</span>
          </button>
        )}
        <h1 className="text-xl font-bold text-slate-200 tracking-tight">LiteScript Reference</h1>
        <p className="text-slate-500 leading-relaxed text-[11px]">
          Pine-inspired logic for custom indicators. Direct and fast.
        </p>
      </header>

      {/* Basic Structure */}
      <section className="space-y-4">
        <h2 className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
          Basic Syntax
        </h2>
        <div className="bg-[#1e222d] border border-[#363a45] rounded p-4 font-mono text-[11px] leading-relaxed">
          <div className="text-slate-500">// Variables</div>
          <div className="text-blue-400">ma = ta.sma(close, 20)</div>
          <div className="text-slate-500 mt-2">// Final execution</div>
          <div className="text-blue-400">ma</div>
        </div>
      </section>

      {/* NEW: Inputs section */}
      <section className="space-y-4">
        <h2 className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
          Inputs
        </h2>
        <div className="bg-[#1e222d] border border-[#363a45] rounded p-4 font-mono text-[11px] leading-relaxed">
          <div className="text-slate-500">// External parameter</div>
          <div className="text-blue-400">len = input(20, "Length")</div>
          <div className="text-blue-400">ma = ta.ema(close, len)</div>
          <div className="text-blue-400">plot(ma, "#3b82f6")</div>
        </div>
      </section>

      {/* Reference Table */}
      <section className="space-y-4">
        <h2 className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
          API Functions
        </h2>
        <div className="overflow-hidden rounded border border-[#363a45]">
          <table className="w-full text-left text-[11px]">
            <tbody className="divide-y divide-[#363a45] bg-[#1e222d]/50 text-slate-400">
              <tr>
                <td className="p-3 text-blue-400 font-mono">input(v, n)</td>
                <td className="p-3">Creates UI setting.</td>
              </tr>
              <tr>
                <td className="p-3 text-blue-400 font-mono">plot(s, c)</td>
                <td className="p-3">Draws line on chart.</td>
              </tr>
              <tr>
                <td className="p-3 text-blue-400 font-mono">bgcolor(c, q)</td>
                <td className="p-3">Highlights background.</td>
              </tr>
              <tr>
                <td className="p-3 text-blue-400 font-mono">ta.highest(s, l)</td>
                <td className="p-3">Max value in N bars.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
