import React from 'react';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const colors = [
    '#000000', '#787b86', '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899',
    '#ffffff', '#c1c4cd', '#fca5a5', '#fdba74', '#fcd34d', '#6ee7b7', '#67e8f9', '#93c5fd', '#a5b4fc', '#c4b5fd', '#f5d0fe', '#f9a8d4'
  ];

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-8 rounded border border-slate-200 flex items-center p-1 gap-2 hover:bg-slate-50 transition-colors"
      >
        <div 
          className="w-4 h-4 rounded-sm border border-black/10" 
          style={{ backgroundColor: color }}
        />
        <span className="text-[10px] font-mono font-medium text-slate-500 uppercase">
          {color.toUpperCase()}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 p-2 bg-white rounded-xl shadow-2xl border border-slate-200 z-[300] grid grid-cols-6 gap-1 w-max">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => {
                onChange(c);
                setIsOpen(false);
              }}
              className={`w-6 h-6 rounded-md border transition-all ${
                color.toLowerCase() === c.toLowerCase() ? 'border-slate-900 scale-110 shadow-sm' : 'border-black/5 hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <div className="col-span-6 mt-1 pt-1 border-t border-slate-100">
             <input 
              type="color" 
              value={color} 
              onChange={(e) => onChange(e.target.value)}
              className="w-full h-6 rounded border-0 p-0 bg-transparent cursor-pointer"
             />
          </div>
        </div>
      )}
    </div>
  );
}
