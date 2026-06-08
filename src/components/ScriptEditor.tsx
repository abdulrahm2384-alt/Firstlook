import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Info, Code2, BookOpen } from 'lucide-react';
import { LiteScriptGuide } from './LiteScriptGuide';

interface ScriptEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (code: string) => void;
  initialCode?: string;
}

const DEFAULT_CODE = `// LiteScript v1 (Super Simple Syntax)
// No "const" or "return" needed

fast = ta.ema(close, 9)
slow = ta.ema(close, 21)

// Plot the lines
plot(fast, "#10b981")
plot(slow, "#ef4444")
`;

export function ScriptEditor({ isOpen, onClose, onSave, initialCode }: ScriptEditorProps) {
  const [code, setCode] = useState(initialCode || DEFAULT_CODE);
  const [showGuide, setShowGuide] = useState(false);

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 md:p-8"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-5xl h-[700px] bg-[#131722] rounded-lg overflow-hidden shadow-2xl border border-[#363a45] flex flex-col md:flex-row">
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between p-3 bg-[#1e222d] border-b border-[#363a45]">
             <div className="flex items-center gap-3">
               <div>
                 <h3 className="text-slate-200 font-bold text-xs uppercase tracking-tight">LiteScript Editor</h3>
               </div>
             </div>
             <div className="flex items-center gap-1">
                <button 
                  onClick={() => setShowGuide(!showGuide)}
                  className={`flex items-center gap-2 px-3 py-1 rounded transition-all ${showGuide ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-[#2a2e39] hover:text-slate-200'}`}
                >
                   <BookOpen size={14} />
                   <span className="text-[10px] font-bold uppercase tracking-wider">Reference</span>
                </button>
                <div className="w-px h-4 bg-[#363a45] mx-1" />
                <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-2">
                   <X size={18} />
                </button>
             </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 relative font-mono text-sm bg-[#131722]">
             <textarea 
               autoFocus
               value={code}
               onChange={(e) => setCode(e.target.value)}
               spellCheck={false}
               className="absolute inset-0 w-full h-full bg-transparent text-[#d1d4dc] p-6 resize-none focus:outline-none leading-relaxed custom-scrollbar"
             />
          </div>

          {/* Footer */}
          <div className="p-3 bg-[#1e222d] border-t border-[#363a45] flex justify-between items-center">
             <div className="text-[10px] text-slate-500 font-medium font-mono uppercase tracking-widest">
               LITESCRIPT v1.0 • FAST COMPILE
             </div>
             <div className="flex gap-2">
                <button 
                  onClick={onClose}
                  className="px-4 py-1.5 rounded text-slate-400 hover:text-slate-200 transition-colors text-[10px] font-bold uppercase"
                >
                  Close
                </button>
                <button 
                  onClick={() => {
                    onSave(code);
                    onClose();
                  }}
                  className="px-6 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold transition-all uppercase tracking-wider"
                >
                  Compile & Plot
                </button>
             </div>
          </div>
        </div>

        {/* Sidebar Documentation */}
        <AnimatePresence>
          {showGuide && (
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute md:relative inset-0 md:inset-auto md:w-96 bg-[#111622] border-l border-slate-800 z-10"
            >
               <LiteScriptGuide onBack={() => setShowGuide(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
