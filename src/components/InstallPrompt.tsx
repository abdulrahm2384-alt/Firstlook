import React, { useState, useEffect, useMemo } from 'react';
import { X, Download, Smartphone, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const InstallPrompt: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [promptType, setPromptType] = useState<'ios' | 'android' | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Check if user dismissed the prompt previously
    // Using a fresh key 'pwa_prompt_v6_light' to override previous dismissal actions during design iteration
    const isDismissed = localStorage.getItem('pwa_prompt_v6_light') === 'true';
    if (isDismissed) {
      return;
    }

    // 3. Detect Platform
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    // Smooth delay after loading the applet so it has time to breathe
    const timer = setTimeout(() => {
      if (isIOS) {
        setPromptType('ios');
        setIsVisible(true);
      } else {
        setPromptType('android');
        setIsVisible(true);
      }
    }, 1200);

    // Watch for native browsers installer trigger
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (promptType === 'ios') {
      setShowSteps(prev => !prev);
      return;
    }

    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
          setIsVisible(false);
        }
      } catch (err) {
        console.warn('PWA setup prompt declined or failed', err);
        setShowSteps(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowSteps(prev => !prev);
    }
  };

  const closePrompt = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
    localStorage.setItem('pwa_prompt_v6_light', 'true');
  };

  // Dynamically tailor instructions based on the active browser agent detected
  const pwaStepHelper = useMemo(() => {
    const ua = navigator.userAgent.toLowerCase();
    
    if (promptType === 'ios') {
      if (ua.includes('crios')) { // Chrome on iOS
        return {
          browser: 'Chrome (iOS)',
          steps: [
            "Tap Chrome's Share or Options icon next to the address bar",
            "Scroll down the sheet and select 'Add to Home Screen'"
          ]
        };
      }
      if (ua.includes('fxios')) { // Firefox on iOS
        return {
          browser: 'Firefox (iOS)',
          steps: [
            "Tap Firefox's bottom Menu button (☰)",
            "Choose 'Add to Home Screen' from the options list"
          ]
        };
      }
      if (ua.includes('edg/')) { // Edge on iOS
        return {
          browser: 'Edge (iOS)',
          steps: [
            "Tap Edge's bottom menu button (⋯)",
            "Scroll up and select 'Add to Home Screen'"
          ]
        };
      }
      // Standard iOS Safari
      return {
        browser: 'Safari',
        steps: [
          "Tap Safari's Share button (📤 square with up-arrow)",
          "Scroll down the sheet and select 'Add to Home Screen'"
        ]
      };
    } else {
      // Android / Generic Desktop Browser
      if (ua.includes('firefox')) {
        return {
          browser: 'Firefox',
          steps: [
            "Tap Firefox options menu (⋮) in the address bar",
            "Choose 'Install' or 'Add to Home Screen'"
          ]
        };
      }
      if (ua.includes('samsungbrowser')) {
        return {
          browser: 'Samsung Internet',
          steps: [
            "Tap menu (☰) at the bottom right corner",
            "Select 'Add page to' and select 'Home screen'"
          ]
        };
      }
      if (ua.includes('opera')) {
        return {
          browser: 'Opera',
          steps: [
            "Tap the red Opera icon or vertical options menu (⋮)",
            "Select 'Add to Home screen' or 'Install app'"
          ]
        };
      }
      // Generic Chrome / Edge / Android core browsers
      return {
        browser: 'Browser',
        steps: [
          "Tap your browser's options menu (usually three vertical dots ⋮)",
          "Select 'Install app' or 'Add to Home screen' directly"
        ]
      };
    }
  }, [promptType]);

  if (isInstalled || !isVisible) return null;

  return (
    <AnimatePresence>
      {/* Outer wrapper that coordinates layout responsive positioning without CSS transform collisions */}
      <div className="fixed top-2.5 landscape:top-4 md:top-4 left-0 right-0 md:right-auto md:left-4 landscape:left-4 landscape:right-auto flex justify-center landscape:justify-start md:justify-start pointer-events-none z-[1050] px-3 animate-none">
        <motion.div
          initial={{ y: -70, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -70, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="w-full max-w-[280px] sm:max-w-[300px] pointer-events-auto"
        >
          <div className="bg-white/95 border border-indigo-150 rounded-xl shadow-[0_12px_35px_-6px_rgba(79,70,229,0.14),0_4px_12px_rgba(0,0,0,0.03)] backdrop-blur-md overflow-hidden select-none">
            
            {/* Main super-slim, premium interactive row */}
            <div className="px-3 py-2 flex items-center justify-between gap-2 min-h-[40px]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6.5 h-6.5 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100">
                  <Smartphone size={12} className="text-indigo-600" />
                </div>
                
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-900 leading-tight">FirstLook Compact</span>
                  <span className="text-[7px] font-bold text-slate-500 tracking-wider uppercase truncate leading-none mt-0.5">
                    {promptType === 'ios' ? 'Add to Home Screen' : 'Lightweight companion'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Call to Action Button */}
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 font-extrabold uppercase text-[7.5px] tracking-wider text-white rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs shadow-indigo-600/10"
                >
                  {deferredPrompt ? (
                    <>
                      <Download size={8.5} className="stroke-[3]" />
                      <span>Install</span>
                    </>
                  ) : (
                    <>
                      <HelpCircle size={9} className="stroke-[2.5]" />
                      <span>{promptType === 'ios' ? 'Add App' : 'Get App'}</span>
                    </>
                  )}
                </button>

                {/* Minimal Dismiss button */}
                <button 
                  onClick={closePrompt}
                  className="w-5.5 h-5.5 rounded-md hover:bg-slate-100 flex items-center justify-center transition-all text-slate-400 hover:text-slate-600 cursor-pointer active:scale-90"
                  title="Dismiss installer"
                >
                  <X size={11} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Guide Steps Collapse block */}
            <AnimatePresence>
              {showSteps && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="border-t border-slate-100 bg-slate-50/55"
                >
                  <div className="px-3 py-2 pb-2.5">
                    <p className="text-[7px] text-indigo-600 font-extrabold uppercase tracking-widest mb-1.5">
                      How-To setup App on {pwaStepHelper.browser}
                    </p>
                    
                    <div className="flex flex-col gap-1.5">
                      {pwaStepHelper.steps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <div className="w-3.5 h-3.5 bg-indigo-50 rounded flex items-center justify-center border border-indigo-100 font-black text-[7.5px] text-indigo-600 font-mono shrink-0 select-none">
                            {idx + 1}
                          </div>
                          <p className="text-[7.5px] font-bold text-slate-700 uppercase tracking-wide leading-normal pt-0.5">
                            {step}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
