import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Eye, Save, Trash2, Check, CheckSquare, Square } from 'lucide-react';
import { Drawing } from '../types/drawing';
import { persistenceService } from '../services/persistenceService';

interface GeneralDrawingSettingsPopoverProps {
  drawing: Drawing;
  onUpdate: (settings: Partial<Drawing['settings']>) => void;
  isMobile?: boolean;
}

const TIMEFRAMES_LIST = [
  '1m', '2m', '3m', '5m', '10m', '15m', '30m', '45m',
  '1h', '2h', '4h', '8h', '12h', '1d', '1w'
];

export function GeneralDrawingSettingsPopover({ drawing, onUpdate, isMobile }: GeneralDrawingSettingsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'visibility' | 'save'>('visibility');
  const [templateName, setTemplateName] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<{ id: string; name: string; settings: any }[]>([]);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Load saved templates for this drawing type
  useEffect(() => {
    const key = `drawing_templates_${drawing.type}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setSavedTemplates(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }
  }, [drawing.type]);

  const saveTemplatesToLocalStorage = (templates: typeof savedTemplates) => {
    const key = `drawing_templates_${drawing.type}`;
    localStorage.setItem(key, JSON.stringify(templates));
    setSavedTemplates(templates);

    try {
      const userStr = localStorage.getItem('firstlook_session_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user && user.id) {
          // Gather all templates from localStorage to merge and sync to server
          const allTemplates: Record<string, any[]> = {};
          for (let i = 0; i < localStorage.length; i++) {
            const lsKey = localStorage.key(i);
            if (lsKey && lsKey.startsWith('drawing_templates_')) {
              const type = lsKey.replace('drawing_templates_', '');
              try {
                const storedVal = localStorage.getItem(lsKey);
                if (storedVal) {
                  allTemplates[type] = JSON.parse(storedVal);
                }
              } catch (e) {
                console.error(e);
              }
            }
          }
          persistenceService.savePreferences(user.id, {
            drawingTemplates: allTemplates
          });
        }
      }
    } catch (e) {
      console.error('Failed to sync drawing templates to DB:', e);
    }
  };

  // Click outside to close helper
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Determine currently selected timeframes
  const visibleTimeframes: string[] = drawing.settings?.visibleTimeframes && Array.isArray(drawing.settings.visibleTimeframes)
    ? drawing.settings.visibleTimeframes
    : [...TIMEFRAMES_LIST]; // Default all are selected

  const toggleTimeframe = (tf: string) => {
    let next: string[];
    const lowerTf = tf.toLowerCase();
    
    const isCurrentlySelected = visibleTimeframes.some(item => item.toLowerCase() === lowerTf);
    
    if (isCurrentlySelected) {
      // Remove it
      next = visibleTimeframes.filter(item => item.toLowerCase() !== lowerTf);
    } else {
      // Add it
      next = [...visibleTimeframes, tf];
    }
    
    // If we've selected all of them, reset to empty array or 'all' to save space
    if (next.length === TIMEFRAMES_LIST.length) {
      onUpdate({ visibleTimeframes: ['all'] });
    } else {
      onUpdate({ visibleTimeframes: next });
    }
  };

  const selectAll = () => {
    onUpdate({ visibleTimeframes: ['all'] });
  };

  const selectNone = () => {
    onUpdate({ visibleTimeframes: [] });
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;
    
    // Extract format-relevant style parameters
    const styleSettings = {
      color: drawing.settings.color,
      lineWidth: drawing.settings.lineWidth,
      lineStyle: drawing.settings.lineStyle,
      style: drawing.settings.style,
      strokeColor: drawing.settings.strokeColor,
      fillColor: drawing.settings.fillColor,
      opacity: drawing.settings.opacity,
    };

    const newTemplate = {
      id: Math.random().toString(36).substring(2, 9),
      name: templateName.trim(),
      settings: styleSettings
    };

    const updated = [...savedTemplates, newTemplate];
    saveTemplatesToLocalStorage(updated);
    setTemplateName('');
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedTemplates.filter(t => t.id !== id);
    saveTemplatesToLocalStorage(updated);
  };

  const handleLoadTemplate = (settings: any) => {
    onUpdate(settings);
  };

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Cog Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors outline-none ${
          isOpen ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
        }`}
        title="Drawing Visibility & Settings Templates"
      >
        <Settings size={isMobile ? 13 : 15} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-white rounded-2xl border border-slate-200/95 shadow-2xl p-4 w-[280px] z-[310]"
          >
            {/* Header Tabs */}
            <div className="flex border-b border-slate-100 pb-2.5 mb-3.5 gap-1.5">
              <button
                onClick={() => setActiveTab('visibility')}
                className={`flex-1 py-1 px-2 rounded-lg text-[10px] md:text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border-0 ${
                  activeTab === 'visibility' 
                    ? 'bg-indigo-50 text-indigo-600' 
                    : 'text-slate-500 hover:text-slate-900 duration-150'
                }`}
              >
                <Eye size={12} />
                Visibility
              </button>
              <button
                onClick={() => setActiveTab('save')}
                className={`flex-1 py-1 px-2 rounded-lg text-[10px] md:text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border-0 ${
                  activeTab === 'save' 
                    ? 'bg-indigo-50 text-indigo-600' 
                    : 'text-slate-500 hover:text-slate-900 duration-150'
                }`}
              >
                <Save size={12} />
                Save & Presets
              </button>
            </div>

            {/* TAB CONTENTS */}
            <div className="min-h-[190px]">
              {activeTab === 'visibility' ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold px-1">
                    <span>Show on timeframes</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={selectAll} 
                        className="text-indigo-600 hover:text-indigo-800 transition-colors border-0 bg-transparent p-0"
                      >
                        All
                      </button>
                      <span>•</span>
                      <button 
                        onClick={selectNone} 
                        className="text-slate-400 hover:text-red-500 transition-colors border-0 bg-transparent p-0"
                      >
                        None
                      </button>
                    </div>
                  </div>

                  {/* Timeframe Select Pills Grid */}
                  <div className="grid grid-cols-4 gap-1.5 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                    {TIMEFRAMES_LIST.map((tf) => {
                      const isSelected = visibleTimeframes.some(
                        (v) => v.toLowerCase() === tf.toLowerCase() || v.toLowerCase() === 'all'
                      );
                      
                      return (
                        <button
                          key={tf}
                          onClick={() => toggleTimeframe(tf)}
                          className={`py-1 rounded-md text-[10px] font-mono font-bold border transition-all ${
                            isSelected 
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/50 hover:border-slate-300'
                          }`}
                        >
                          {tf}
                        </button>
                      );
                    })}
                  </div>
                  
                  <div className="text-[9px] text-slate-400 font-medium leading-relaxed px-1">
                    Deselecting intervals hides this drawing on those specific chart states.
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Create Preset Form */}
                  <div className="flex flex-col gap-1 px-0.5">
                    <span className="text-[9px] text-slate-400 font-bold block mb-1">SAVE CURRENT AS STYLE PRESET</span>
                    <div className="flex gap-1.5 items-stretch">
                      <input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="Preset name (e.g. key line)"
                        className="flex-1 px-2.5 py-1 text-[11px] rounded-lg border border-slate-200 outline-none focus:border-indigo-500 text-slate-800 placeholder:text-slate-400 font-medium"
                        maxLength={15}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveTemplate();
                        }}
                      />
                      <button
                        onClick={handleSaveTemplate}
                        disabled={!templateName.trim()}
                        className={`px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-0`}
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  {/* List of presets */}
                  <div className="border-t border-slate-100/80 pt-2 flex flex-col gap-1.5">
                    <span className="text-[9px] text-slate-400 font-bold block px-0.5">LOAD PRESET</span>
                    {savedTemplates.length === 0 ? (
                      <div className="text-[10px] text-slate-400 text-center py-6 italic font-medium bg-slate-50/50 rounded-xl border border-dashed border-slate-150">
                        No templates saved yet
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 max-h-[110px] overflow-y-auto pr-0.5 custom-scrollbar">
                        {savedTemplates.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleLoadTemplate(item.settings)}
                            className="flex items-center justify-between px-2 py-1.5 rounded-lg border border-slate-100 bg-white hover:bg-indigo-50/40 hover:border-indigo-100 cursor-pointer transition-all group"
                          >
                            <span className="text-[10px] font-bold text-slate-700 group-hover:text-indigo-950 capitalize truncate flex-1">
                              {item.name}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {/* Visual swatch circle of standard color representation */}
                              <div 
                                className="w-2.5 h-2.5 rounded-full border border-black/10" 
                                style={{ backgroundColor: item.settings.color || item.settings.strokeColor || '#2962ff' }}
                              />
                              <button
                                onClick={(e) => handleDeleteTemplate(item.id, e)}
                                className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={9} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Custom confirm Apply/Close indicator banner */}
            <div className="flex justify-end pt-2 mt-3 border-t border-slate-50">
              <button
                onClick={() => setIsOpen(false)}
                className="px-3.5 py-1 text-[10px] lowercase tracking-wide font-sans font-bold text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-md transition-all uppercase"
              >
                close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
