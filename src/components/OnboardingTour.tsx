import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Award, ArrowRight, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface OnboardingTourProps {
  user: any;
  selectedSymbol: string | null;
  simIsPlaying: boolean;
  drawingsCount: number;
  watchlistCount: number;
  onDismiss: () => void;
}

interface CoordinateProps {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  user,
  selectedSymbol,
  simIsPlaying,
  drawingsCount,
  watchlistCount,
  onDismiss,
}) => {
  const [step, setStep] = useState<number>(1);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [initialDrawingsCount] = useState<number>(drawingsCount);

  // Dynamic coordinates tracking for pulse highlighting
  const [coords, setCoords] = useState<CoordinateProps | null>(null);

  // Identify current targeting needs
  const currentTarget = useMemo(() => {
    if (step === 1) {
      if (watchlistCount === 0) {
        return {
          id: 'onboarding-add-pair-btn',
          message: 'Register EURUSD or your choice pair here!',
          shape: 'circle' as const,
        };
      } else {
        return {
          id: 'onboarding-watchlist-item-0',
          message: 'Click on the pair to launch the chart console!',
          shape: 'rect' as const,
        };
      }
    } else if (step === 2) {
      return {
        id: 'onboarding-play-btn',
        message: 'Tap the Play button to stream live market candles!',
        shape: 'circle' as const,
      };
    } else if (step === 3) {
      return {
        id: 'onboarding-buy-btn',
        message: 'Tap BUY/SELL to deploy first trade setup!',
        shape: 'circle' as const,
      };
    }
    return null;
  }, [step, watchlistCount]);

  // Position listener loop: Using FIXED coordinates relative to viewport (100% Bug-Free)
  useEffect(() => {
    if (!currentTarget) {
      setCoords(null);
      return;
    }

    const updatePosition = () => {
      const el = document.getElementById(currentTarget.id);
      if (el) {
        const rect = el.getBoundingClientRect();
        // Since we position the pulse overlay with position "fixed",
        // getBoundingClientRect() viewport coordinates are exact! No window.scrollY math needed.
        setCoords({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      } else {
        setCoords(null);
      }
    };

    updatePosition();
    const interval = setInterval(updatePosition, 250);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [currentTarget]);

  // Sync step mechanics based on the active route view (Watchlist or Chart Room)
  useEffect(() => {
    if (selectedSymbol) {
      if (step === 1) {
        setStep(2);
      }
    } else {
      if (step > 1 && step < 4) {
        setStep(1); // Reset back to step 1 when returning to the Watchlist page
      }
    }
  }, [selectedSymbol, step]);

  useEffect(() => {
    if (selectedSymbol && step === 2 && simIsPlaying) {
      setStep(3);
    }
  }, [simIsPlaying, step, selectedSymbol]);

  useEffect(() => {
    if (selectedSymbol && step === 3 && drawingsCount > initialDrawingsCount) {
      setStep(4);
    }
  }, [drawingsCount, initialDrawingsCount, step, selectedSymbol]);

  if (dismissed) return null;

  const handleFinish = () => {
    setDismissed(true);
    localStorage.setItem('firstlook_onboarding_dismissed', 'true');
    
    if (user?.id) {
      supabase.auth.updateProfile({ onboarding_dismissed: true })
        .catch(e => console.warn('Silent sync error updating user profile:', e));
    }
    onDismiss();
  };

  const handleSkip = () => {
    // Dismiss/cancel immediately with no confirmation popups for ultra-slick native feeling
    handleFinish();
  };

  const isTargetNearBottom = coords ? coords.top > window.innerHeight * 0.55 : false;

  return (
    <>
      {/* 1. PULSE HIGHLIGHT RING OVERLAY OVER COORDS (FIXED POSITIONING) */}
      <AnimatePresence>
        {coords && currentTarget && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: coords.width,
              height: coords.height,
              pointerEvents: 'none',
              zIndex: 99990,
            }}
          >
            {/* Pulsing focal ring */}
            <div 
              className={`absolute inset-0 border-3 border-indigo-500 animate-ping opacity-60 ${
                currentTarget.shape === 'circle' ? 'rounded-full' : 'rounded-lg'
              }`} 
              style={{ animationDuration: '2s' }}
            />
            <div 
              className={`absolute -inset-1 border-2 border-indigo-400 opacity-80 ${
                currentTarget.shape === 'circle' ? 'rounded-full' : 'rounded-lg'
              }`} 
            />

            {/* Glowing Arrow / Tooltip Label with dynamic overlap prevention */}
            <div 
              className={`absolute left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-white text-[9.5px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl whitespace-nowrap shadow-[0_10px_35px_rgba(0,0,0,0.4)] flex items-center gap-1.5 z-[99995] animate-bounce ${
                isTargetNearBottom ? 'bottom-full mb-3' : 'top-full mt-3'
              }`}
            >
              <Sparkles size={11} className="text-amber-400 animate-spin" style={{ animationDuration: '3s' }} />
              <span>{currentTarget.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. FLOATING STEP STATUS CONTROLLER BAR (DYNAMICALLY POSITIONED - COMPACT & POLISHED) */}
      <div 
        className={`fixed z-[99999] max-w-[218px] w-[88vw] md:w-[218px] transition-all duration-300 ${
          selectedSymbol 
            ? "top-16 left-4 md:top-20 md:left-6" 
            : "bottom-24 left-1/2 -translate-x-1/2"
        }`}
      >
        <motion.div
          initial={{ opacity: 0, y: selectedSymbol ? -15 : 15, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: selectedSymbol ? -15 : 15, scale: 0.9 }}
          transition={{ type: 'spring', damping: 22, stiffness: 220 }}
          className="bg-slate-950/95 backdrop-blur-md text-white rounded-xl p-2.5 border border-slate-800/80 shadow-[0_12px_30px_rgba(0,0,0,0.5)] flex flex-col gap-2 overflow-hidden relative"
        >
          {/* Subtle Ambient Background Flare */}
          <div className="absolute -top-12 -right-12 w-16 h-16 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-1">
            <div className="flex items-center gap-1">
              <div className="w-3.5 h-3.5 bg-indigo-950/30 rounded flex items-center justify-center border border-indigo-500/20">
                <Sparkles size={7} className="text-indigo-400 animate-pulse" />
              </div>
              <span className="text-[8px] font-black tracking-[0.12em] text-slate-300 uppercase">FirstLook Guide</span>
            </div>
            
            <button 
              onClick={handleSkip}
              className="p-1 hover:bg-white/[0.06] rounded-md transition-colors text-slate-400 hover:text-white"
              title="Skip Walkthrough"
            >
              <X size={10} />
            </button>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-1"
              >
                <h4 className="text-[9.5px] font-bold tracking-wide text-indigo-400 uppercase">1: Set Pair</h4>
                <p className="text-[9px] text-slate-300 font-medium leading-relaxed">
                  Search a trading pair (e.g., <strong className="text-white font-extrabold bg-white/[0.06] px-1 py-0.2 rounded">EURUSD</strong>) on the Watchlist to load the chart.
                </p>
                <div className="text-[8px] bg-slate-900/40 p-1 rounded text-slate-400 font-semibold flex items-center gap-1 border border-white/[0.02]">
                  <span className="flex h-1 w-1 rounded-full bg-indigo-500 animate-pulse" />
                  <span>Waiting for target symbol...</span>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-1"
              >
                <h4 className="text-[9.5px] font-bold tracking-wide text-indigo-400 uppercase">2: Stream Candles</h4>
                <p className="text-[9px] text-slate-300 font-medium leading-relaxed">
                  Press <strong className="text-emerald-400 font-bold">Play</strong> in the toolbar to stream historical bar-by-bar candle ticks.
                </p>
                <div className="text-[8px] bg-slate-900/40 p-1 rounded text-slate-400 font-semibold flex items-center gap-1 border border-white/[0.02]">
                  <span className="flex h-1 w-1 rounded-full bg-indigo-500 animate-pulse" />
                  <span>Waiting for play click...</span>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-1"
              >
                <h4 className="text-[9.5px] font-bold tracking-wide text-indigo-400 uppercase">3: Deploy Setup</h4>
                <p className="text-[9px] text-slate-300 font-medium leading-relaxed">
                  Click <strong className="text-emerald-400 font-bold">BUY</strong> or <strong className="text-rose-400 font-bold">SELL</strong> on the chart to apply your risk-to-reward forecast tool.
                </p>
                <div className="text-[8px] bg-slate-900/40 p-1 rounded text-slate-400 font-semibold flex items-center gap-1 border border-white/[0.02]">
                  <span className="flex h-1 w-1 rounded-full bg-indigo-500 animate-pulse" />
                  <span>Waiting for drawing placement...</span>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-1.5"
              >
                <div className="flex items-center gap-1 text-emerald-400">
                  <Award size={11} className="animate-bounce" />
                  <h4 className="text-[9.5px] font-bold uppercase tracking-wider">Strategy Deployed!</h4>
                </div>
                <p className="text-[9px] text-slate-300 font-medium leading-relaxed">
                  Excellent! Drag the red/green handle limits on the chart to adjust Take Profit and Stop Loss levels.
                </p>
                <button
                  onClick={handleFinish}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-widest text-[8px] py-1.5 rounded-lg transition-all shadow-md hover:shadow-indigo-600/20 flex items-center justify-center gap-1 cursor-pointer active:scale-95 duration-150 text-center"
                >
                  <span>Finish Tutorial</span>
                  <ArrowRight size={9} strokeWidth={2.5} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom Step Dots Indicator Tracker and Skip Link */}
          {step <= 3 && (
            <div className="flex items-center justify-between border-t border-white/[0.04] pt-1.5 text-[7.5px] font-black uppercase tracking-wider text-slate-500">
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-0.5 rounded-full transition-all duration-300 ${
                      step === s ? 'w-2.5 bg-indigo-500' : 'w-0.5 bg-slate-800'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <span>Step {step}/3</span>
                <span>•</span>
                <button 
                  onClick={handleSkip} 
                  className="text-slate-400 hover:text-white capitalize font-medium underline decoration-slate-700 cursor-pointer text-[7.5px]"
                >
                  Skip
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
};
