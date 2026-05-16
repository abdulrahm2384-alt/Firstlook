import { motion, AnimatePresence } from 'motion/react';
import { 
  Star,
  TrendingUp, 
  MoveVertical, 
  MoveHorizontal, 
  ArrowUpRight, 
  ArrowDownRight,
  Maximize,
  Calendar,
  ArrowRight,
  Square,
  Share2,
  Pencil,
  Activity,
  ArrowUpCircle,
  ArrowDownCircle,
  SeparatorVertical,
  SeparatorHorizontal,
  Tally4,
  ArrowUpDown,
  ArrowLeftRight,
  Navigation,
  Shapes,
  Paintbrush,
  MoveUpRight
} from 'lucide-react';
import { DrawingType } from '../types/drawing';
import { useState, useRef, useEffect, memo, RefObject } from 'react';

const TOOL_ICONS: Record<DrawingType, any> = {
  [DrawingType.TREND_LINE]: MoveUpRight,
  [DrawingType.HORIZONTAL_RAY]: ArrowUpRight,
  [DrawingType.VERTICAL_LINE]: SeparatorVertical,
  [DrawingType.HORIZONTAL_LINE]: SeparatorHorizontal,
  [DrawingType.FIB_RETRACEMENT]: Tally4,
  [DrawingType.LONG_POSITION]: ArrowUpCircle,
  [DrawingType.SHORT_POSITION]: ArrowDownCircle,
  [DrawingType.PRICE_RANGE]: ArrowUpDown,
  [DrawingType.DATE_RANGE]: ArrowLeftRight,
  [DrawingType.ARROW_MARKER]: Navigation,
  [DrawingType.RECTANGLE]: Square,
  [DrawingType.PATH]: Share2,
  [DrawingType.BRUSH]: Paintbrush,
};

interface FavoriteDrawingsToolbarProps {
  favorites: DrawingType[];
  activeTool: DrawingType | null;
  onSelectTool: (tool: DrawingType | null) => void;
  pos: { x: number; y: number };
  onPosChange: (pos: { x: number; y: number }) => void;
  isMobileLandscape?: boolean;
  isMobile?: boolean; // Added isMobile to distinguish portrait
  constraintsRef?: RefObject<HTMLDivElement | null>;
}

export const FavoriteDrawingsToolbar = memo(function FavoriteDrawingsToolbar({ 
  favorites, 
  activeTool, 
  onSelectTool, 
  pos, 
  onPosChange, 
  isMobileLandscape, 
  isMobile,
  constraintsRef
}: FavoriteDrawingsToolbarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isPortrait = isMobile && !isMobileLandscape;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

  if (favorites.length === 0) return null;

  return (
    <motion.div
      ref={containerRef}
      drag
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={constraintsRef}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={(_e, info) => {
        const newPos = { x: pos.x + info.offset.x, y: pos.y + info.offset.y };
        onPosChange(newPos);
        setTimeout(() => setIsDragging(false), 50);
      }}
      whileDrag={{ scale: 1.02, cursor: 'grabbing' }}
      initial={false}
      animate={{ 
        opacity: 1, 
        scale: 1, 
        x: pos.x, 
        y: pos.y,
        transition: { type: 'spring', damping: 30, stiffness: 400 }
      }}
      className={`fixed ${isMobileLandscape ? 'bottom-[4vh]' : 'bottom-[10vh]'} left-1/2 -translate-x-1/2 flex items-center bg-white border border-slate-200 shadow-2xl rounded-2xl cursor-move group pointer-events-auto z-[100] ${isDragging ? 'ring-2 ring-blue-500/20' : 'hover:border-slate-300'}`}
    >
      <div className={`flex items-center p-1 ${isMobileLandscape ? 'min-h-[5vh]' : isPortrait ? 'min-h-[40px]' : 'min-h-[60px] md:min-h-[72px]'}`}>
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            <motion.button
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDragging && setIsExpanded(true)}
              className={`${isMobileLandscape ? 'p-[2vh]' : isPortrait ? 'p-2' : 'p-7 md:p-8'} rounded-xl text-slate-500 hover:bg-slate-50 transition-colors`}
            >
              <Star size={isMobileLandscape ? '5vh' : isPortrait ? 16 : 32} strokeWidth={2.5} />
            </motion.button>
          ) : (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="flex items-center"
            >
              <div className={`flex items-center ${isMobileLandscape ? 'gap-[1.5vh] p-[1vh]' : isPortrait ? 'gap-1.5 p-2' : 'gap-3 px-5'}`}>
                {favorites.map(toolId => {
                  const Icon = TOOL_ICONS[toolId] || Star;
                  return (
                    <button
                      key={toolId}
                      onClick={() => {
                        if (!isDragging) {
                          onSelectTool(activeTool === toolId ? null : toolId);
                          setIsExpanded(false);
                        }
                      }}
                      className={`${isMobileLandscape ? 'p-[1.8vh]' : isPortrait ? 'p-2' : 'p-5 md:p-6'} rounded-xl transition-all shrink-0 ${activeTool === toolId ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-50'}`}
                      title={toolId}
                    >
                      <Icon size={isMobileLandscape ? '5vh' : isPortrait ? 16 : 28} strokeWidth={2.5} />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Visual handle indicator only visible on hover */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-slate-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
});
