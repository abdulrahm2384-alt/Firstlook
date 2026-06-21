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

  const handleFinish = async () => {
    setDismissed(true);
    localStorage.setItem('firstlook_onboarding_dismissed', 'true');
    
    if (user?.id) {
      try {
        await supabase.auth.updateProfile({ onboarding_dismissed: true });
      } catch (e) {
        console.warn('Silent sync error updating user profile:', e);
      }
    }
    onDismiss();
  };

  const handleSkip = async () => {
    // Dismiss/cancel immediately with no confirmation popups for ultra-slick native feeling
    await handleFinish();
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

      {/* 2. FLOATING STEP STATUS CONTROLLER BAR (SMALL & AT THE TOP-LEFT EDGE) */}
      <div className="fixed top-16 left-4 z-[99999] max-w-[280px] w-[85vw] md:w-[280px]">
        <motion.div
          initial={{ opacity: 0, x: -30, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -30, scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className="bg-slate-950/95 backdrop-blur-md text-white rounded-2xl p-3.5 border border-slate-800/80 shadow-[0_15px_40px_rgba(0,0,0,0.5)] flex flex-col gap-3 overflow-hidden relative"
        >
          {/* Subtle Ambient Background Flare */}
          <div className="absolute -top-12 -right-12 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 bg-indigo-950/30 rounded-lg flex items-center justify-center border border-indigo-500/30">
                <Sparkles size={10} className="text-indigo-400 animate-pulse" />
              </div>
              <span className="text-[9px] font-black tracking-[0.15em] text-slate-300 uppercase">FirstLook Guide</span>
            </div>
            
            <button 
              onClick={handleSkip}
              className="p-1 hover:bg-white/[0.06] rounded-lg transition-colors text-slate-400 hover:text-white"
              title="Skip Walkthrough"
            >
              <X size={12} />
            </button>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="space-y-2"
              >
                <h4 className="text-[10.5px] font-black tracking-[0.05em] text-indigo-400 uppercase">Step 1: Set Target Pair</h4>
                <p className="text-[10px] text-slate-300 font-medium leading-relaxed">
                  Let's load up an active pair! Add your first trading pair (like <strong className="text-white font-black bg-white/[0.06] px-1 py-0.5 rounded-md">EURUSD</strong>) inside the input box, and then click on the pair to open the chart.
                </p>
                <div className="text-[9px] bg-slate-900/40 p-2 rounded-xl text-slate-400 font-semibold flex items-center gap-2 border border-white/[0.02]">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  <span>Waiting for target symbol...</span>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="space-y-2"
              >
                <h4 className="text-[10.5px] font-black tracking-[0.05em] text-indigo-400 uppercase">Step 2: Stream Live Candles</h4>
                <p className="text-[10px] text-slate-300 font-medium leading-relaxed">
                  Click the <strong className="text-emerald-400 font-black">Play</strong> button in the floating bar to initiate the bar-by-bar candle feed stream.
                </p>
                <div className="text-[9px] bg-slate-900/40 p-2 rounded-xl text-slate-400 font-semibold flex items-center gap-2 border border-white/[0.02]">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  <span>Tap Play to see active candles...</span>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="space-y-2"
              >
                <h4 className="text-[10.5px] font-black tracking-[0.05em] text-indigo-400 uppercase">Step 3: Deploy Setup</h4>
                <p className="text-[10px] text-slate-300 font-medium leading-relaxed">
                  Tap the <strong className="text-emerald-400 font-black">BUY</strong> or <strong className="text-rose-400 font-black">SELL</strong> tool to place a live risk-reward forecasting layout on the chart.
                </p>
                <div className="text-[9px] bg-slate-900/40 p-2 rounded-xl text-slate-400 font-semibold flex items-center gap-2 border border-white/[0.02]">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  <span>Deploy setup tool...</span>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-2.5"
              >
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Award size={14} className="animate-bounce" />
                  <h4 className="text-[10.5px] font-black uppercase tracking-wider">Strategy Deployed!</h4>
                </div>
                <p className="text-[10px] text-slate-300 font-medium leading-relaxed">
                  Superb execution! Drag the green and red handle limits on the chart to adjust Stop Loss and Take Profit levels.
                </p>
                <button
                  onClick={handleFinish}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[9px] py-2.5 rounded-xl transition-all shadow-md hover:shadow-indigo-600/35 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 duration-200"
                >
                  <span>Sandbox Terminal</span>
                  <ArrowRight size={11} strokeWidth={2.5} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom Step Dots Indicator Tracker */}
          {step <= 3 && (
            <div className="flex items-center justify-between border-t border-white/[0.04] pt-2 text-[8px] font-black uppercase tracking-wider text-slate-500">
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      step === s ? 'w-4 bg-indigo-500' : 'w-1 bg-slate-800'
                    }`}
                  />
                ))}
              </div>
              <span>Step {step} of 3</span>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
};
