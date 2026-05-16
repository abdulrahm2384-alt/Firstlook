import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown,
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
  Star,
  Activity,
  LineChart,
  MoveUpRight,
  SeparatorVertical,
  SeparatorHorizontal,
  GanttChartSquare,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowUpDown,
  ArrowLeftRight,
  Shapes,
  Paintbrush,
  Tally4,
  Navigation,
  PenTool
} from 'lucide-react';
import { DrawingType } from '../types/drawing';
import { useState, memo } from 'react';

interface DrawingToolbarProps {
  activeTool: DrawingType | null;
  onSelectTool: (tool: DrawingType | null) => void;
  favorites: DrawingType[];
  onToggleFavorite: (toolId: DrawingType) => void;
  isMobile?: boolean;
  isMobileLandscape?: boolean;
  xPos?: number;
}

const DRAWING_GROUPS = [
  {
    id: 'lines',
    icon: PenTool,
    label: 'Lines',
    tools: [
      { id: DrawingType.TREND_LINE, label: 'Trend Line', icon: MovingUpRightIcon },
      { id: DrawingType.HORIZONTAL_RAY, label: 'Horizontal Ray', icon: ArrowUpRight },
      { id: DrawingType.VERTICAL_LINE, label: 'Vertical Line', icon: SeparatorVertical },
      { id: DrawingType.HORIZONTAL_LINE, label: 'Horizontal Line', icon: SeparatorHorizontal },
    ]
  },
  {
    id: 'forecasting',
    icon: GanttChartSquare,
    label: 'Forecasting',
    tools: [
      { id: DrawingType.FIB_RETRACEMENT, label: 'Fib Retracement', icon: Tally4 },
      { id: DrawingType.LONG_POSITION, label: 'Long Position', icon: ArrowUpCircle },
      { id: DrawingType.SHORT_POSITION, label: 'Short Position', icon: ArrowDownCircle },
      { id: DrawingType.PRICE_RANGE, label: 'Price Range', icon: ArrowUpDown },
      { id: DrawingType.DATE_RANGE, label: 'Date Range', icon: ArrowLeftRight },
    ]
  },
  {
    id: 'shapes',
    icon: Shapes,
    label: 'Shapes',
    tools: [
      { id: DrawingType.ARROW_MARKER, label: 'Arrow Marker', icon: Navigation },
      { id: DrawingType.RECTANGLE, label: 'Rectangle', icon: Square },
      { id: DrawingType.PATH, label: 'Path', icon: Share2 },
      { id: DrawingType.BRUSH, label: 'Brush', icon: Paintbrush },
    ]
  }
];

function MovingUpRightIcon({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return <MoveUpRight size={size} strokeWidth={strokeWidth} />;
}

export const DrawingToolbar = memo(function DrawingToolbar({ 
  activeTool, 
  onSelectTool, 
  favorites, 
  onToggleFavorite, 
  isMobile,
  isMobileLandscape,
  xPos = 0
}: DrawingToolbarProps) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  // isBig applies to Desktop and Mobile Landscape
  const isBig = !isMobile || isMobileLandscape;

  // Detect if toolbar is on the right side of the screen to flip menus
  // xPos is the delta from initial left position.
  const isRightSide = xPos > (window.innerWidth / 3); 

  return (
    <div className={`flex flex-col ${isBig ? (isMobileLandscape ? 'gap-[1vh] p-[1vh] w-[9vh]' : 'gap-2.5 p-2.5 md:p-3 w-14 md:w-16') : 'gap-2 p-2 w-12'} bg-white/95 backdrop-blur-md rounded-2xl border border-slate-100 shadow-2xl overflow-visible pointer-events-auto relative ring-1 ring-black/5`}>
      {/* Click-away overlay when a group is open */}
      <AnimatePresence>
        {openGroup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-transparent cursor-default"
            onClick={() => setOpenGroup(null)}
          />
        )}
      </AnimatePresence>

      {/* Main Groups */}
      <div className={`flex flex-col ${isBig ? (isMobileLandscape ? 'gap-[1.2vh]' : 'gap-2.5') : 'gap-1'}`}>
        {DRAWING_GROUPS.map(group => (
          <div key={group.id} className="relative group/btn">
            <button
              onClick={() => setOpenGroup(openGroup === group.id ? null : group.id)}
              className={`w-full flex items-center justify-center ${isBig ? (isMobileLandscape ? 'p-[1.5vh] rounded-xl' : 'p-3 md:p-4 rounded-xl') : 'p-2.5 rounded-lg'} transition-all ${openGroup === group.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <group.icon size={isBig ? (isMobileLandscape ? '4.5vh' : 24) : 18} strokeWidth={2.5} />
            </button>

            <AnimatePresence>
              {openGroup === group.id && (
                <motion.div
                  initial={{ opacity: 0, x: isRightSide ? -10 : 10, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: isRightSide ? -10 : 10, scale: 0.95 }}
                  style={{ originX: isRightSide ? 1 : 0 }}
                  className={`
                    absolute top-0 z-[100] p-4 bg-white border border-slate-100 rounded-2xl shadow-[20px_0_60px_-15px_rgba(0,0,0,0.15)]
                    ${isRightSide ? 'right-full mr-6' : 'left-full ml-6'}
                    ${isBig ? (isMobileLandscape ? 'w-[60vh] max-h-[85vh] overflow-y-auto' : 'w-96') : 'w-64'}
                  `}
                >
                  <div className={`text-[0.7rem] font-black uppercase tracking-widest text-slate-400 px-3 ${isBig ? (isMobileLandscape ? 'py-[1.2vh] mb-[0.8vh]' : 'py-3.5 mb-2') : 'py-2 mb-1'} border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white z-10`}>
                    <span>{group.label}</span>
                  </div>
                  <div className={`flex flex-col ${isBig ? (isMobileLandscape ? 'gap-[0.8vh]' : 'gap-1') : 'gap-1'} max-h-[60vh] md:max-h-[70vh] overflow-y-auto custom-scrollbar pr-1 overflow-x-hidden`}>
                    {group.tools.map(tool => (
                      <div key={tool.id} className="flex items-center gap-2 group/item min-w-0">
                        <button
                          onClick={() => {
                            onSelectTool(activeTool === tool.id ? null : tool.id);
                            setOpenGroup(null);
                          }}
                          className={`flex-1 flex items-center gap-3 px-3 ${isBig ? (isMobileLandscape ? 'py-[1.2vh]' : 'py-2.5') : 'py-2'} rounded-xl text-left transition-all min-w-0 ${activeTool === tool.id ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          <div className="shrink-0">
                            <tool.icon size={isBig ? (isMobileLandscape ? '3vh' : 20) : 16} strokeWidth={2.5} />
                          </div>
                          <span className={`font-bold tracking-tight block flex-1 ${isBig ? (isMobileLandscape ? 'text-[1.8vh]' : 'text-[13px]') : 'text-[11px]'}`}>{tool.label}</span>
                        </button>
                        <button 
                          onClick={() => onToggleFavorite(tool.id)}
                          className={`shrink-0 ${isBig ? (isMobileLandscape ? 'p-[1.2vh]' : 'p-2.5') : 'p-2'} rounded-xl transition-all ${favorites.includes(tool.id) ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-500 hover:bg-amber-50'}`}
                          title="Add to Favorites"
                        >
                          <Star size={isBig ? (isMobileLandscape ? '2.5vh' : 16) : 13} fill={favorites.includes(tool.id) ? 'currentColor' : 'none'} strokeWidth={2.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
});
