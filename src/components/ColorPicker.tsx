import React from 'react';

export function parseColorAndOpacity(colorString: string): { hex: string; opacity: number } {
  if (!colorString) return { hex: '#2962ff', opacity: 0.45 };
  
  const trimmed = colorString.trim();

  // If hex format
  if (trimmed.startsWith('#')) {
    if (trimmed.length === 9) {
      // #RRGGBBAA
      const hex = trimmed.slice(0, 7);
      const alphaHex = trimmed.slice(7, 9);
      const opacity = parseInt(alphaHex, 16) / 255;
      return { hex, opacity: Math.round(opacity * 100) / 100 };
    } else if (trimmed.length === 5) {
      // #RGBA
      const hex = '#' + trimmed[1] + trimmed[1] + trimmed[2] + trimmed[2] + trimmed[3] + trimmed[3];
      const alphaHex = trimmed[4] + trimmed[4];
      const opacity = parseInt(alphaHex, 16) / 255;
      return { hex, opacity: Math.round(opacity * 100) / 100 };
    } else {
      // #RRGGBB or #RGB without alpha - default to 0.45
      let hex = trimmed;
      if (trimmed.length === 4) {
        hex = '#' + trimmed[1] + trimmed[1] + trimmed[2] + trimmed[2] + trimmed[3] + trimmed[3];
      }
      return { hex, opacity: 0.45 };
    }
  }

  // If rgba(r, g, b, a) or rgb(r, g, b)
  const rgbaMatch = trimmed.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 0.45;
    
    const toHex = (n: number) => {
      const h = n.toString(16);
      return h.length === 1 ? '0' + h : h;
    };
    return {
      hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
      opacity: Math.round(a * 100) / 100
    };
  }

  return { hex: trimmed, opacity: 0.45 };
}

export function formatColorAndOpacity(hex: string, opacity: number): string {
  const alphaVal = Math.round(opacity * 255);
  const alphaHex = alphaVal.toString(16).padStart(2, '0');
  return `${hex}${alphaHex}`;
}

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  compact?: boolean;
}

export function ColorPicker({ color, onChange, compact }: ColorPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#787b86', '#000000', '#ffffff',
    '#fca5a5', '#fdba74', '#fcd34d', '#6ee7b7', '#67e8f9', '#93c5fd', '#a5b4fc', '#c4b5fd', '#f9a8d4', '#c1c4cd', '#475569', '#cbd5e1'
  ];

  const { hex, opacity } = parseColorAndOpacity(color);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpacitySliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    const currentOpacity = val / 100;
    const formatted = formatColorAndOpacity(hex, currentOpacity);
    onChange(formatted);
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedHex = e.target.value;
    const formatted = formatColorAndOpacity(selectedHex, opacity);
    onChange(formatted);
  };

  const handlePaletteSelect = (selectedHex: string) => {
    const formatted = formatColorAndOpacity(selectedHex, opacity);
    onChange(formatted);
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {compact ? (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-7 h-7 rounded-full border border-slate-200/85 flex items-center justify-center bg-white hover:bg-slate-100/50 hover:scale-105 shadow-sm transition-all focus:outline-none shrink-0"
          title={`${color} (${Math.round(opacity * 100)}%)`}
          style={{
            backgroundImage: 'conic-gradient(#ccc 25%, #eee 0 50%, #ccc 0 75%, #eee 0)',
            backgroundSize: '8px 8px'
          }}
        >
          <div 
            className="w-full h-full rounded-full border border-black/10 shrink-0 shadow-inner" 
            style={{ backgroundColor: color }}
          />
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full h-8 rounded border border-slate-200 flex items-center justify-center md:justify-start p-1.5 md:p-1 md:gap-2 bg-white hover:bg-slate-50 transition-colors"
          style={{
            backgroundImage: 'conic-gradient(#ccc 25%, #eee 0 50%, #ccc 0 75%, #eee 0)',
            backgroundSize: '12px 12px'
          }}
        >
          <div 
            className="w-4 h-4 rounded-sm border border-black/10 shrink-0" 
            style={{ backgroundColor: formatColorAndOpacity(hex, opacity) }}
          />
          <span className="text-[10px] font-mono font-medium text-slate-700 bg-white/80 px-1 rounded uppercase hidden md:inline truncate">
            {hex.toUpperCase()} ({Math.round(opacity * 100)}%)
          </span>
        </button>
      )}

      {isOpen && (
        <div 
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-white rounded-xl shadow-2xl border border-slate-200 z-[300] flex flex-col gap-2.5 w-[164px]"
        >
          {/* Colors Grid */}
          <div className="grid grid-cols-6 gap-1">
            {colors.map((c) => {
              const isSelected = hex.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  onClick={() => handlePaletteSelect(c)}
                  className={`w-5.5 h-5.5 rounded-md border transition-all ${
                    isSelected ? 'border-slate-900 scale-110 shadow-sm' : 'border-black/5 hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
            {/* Range Slider for Opacity */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500">
                <span>Opacity</span>
                <span className="font-mono">{Math.round(opacity * 100)}%</span>
              </div>
              <div className="relative w-full h-4 flex items-center rounded-md overflow-hidden border border-slate-100/80">
                {/* Checkerboard track represent transperence */}
                <div 
                  className="absolute inset-0 z-0"
                  style={{
                    backgroundImage: 'conic-gradient(#eee 25%, #fff 0 50%, #eee 0 75%, #fff 0)',
                    backgroundSize: '6px 6px'
                  }}
                />
                {/* Visual gradient showing opacity levels for chosen hex */}
                <div 
                  className="absolute inset-0 z-1" 
                  style={{
                    background: `linear-gradient(to right, transparent, ${hex})`
                  }}
                />
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={Math.round(opacity * 100)} 
                  onChange={handleOpacitySliderChange}
                  className="absolute inset-x-1 z-10 h-3 w-[calc(100%-8px)] opacity-100 ring-0 outline-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>

            {/* Custom Hex Picker Input */}
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] font-semibold text-slate-500">Hex</span>
              <div className="relative flex-1 flex items-center h-6 rounded border border-slate-200">
                <input 
                  type="color" 
                  value={hex} 
                  onChange={handleCustomColorChange}
                  className="w-5 h-full border-0 p-0 bg-transparent cursor-pointer ml-1"
                />
                <span className="text-[10px] font-mono text-slate-700 ml-1.5 uppercase truncate flex-1 leading-none self-center">
                  {hex}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
