import React, { useState, useEffect } from 'react';
import { Share, PlusSquare, X, Download, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const InstallPrompt: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [promptType, setPromptType] = useState<'ios' | 'android' | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // 1. Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');

    if (isStandalone) return;

    // 2. Detect Platform
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    // 3. Setup Install Logic
    if (isIOS) {
      // Check if it's Safari (iOS prompts only work reliably in Safari)
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      if (isSafari) {
        // Delay showing to not nag immediately
        const timer = setTimeout(() => {
          setIsVisible(true);
          setPromptType('ios');
        }, 5000);
        return () => clearTimeout(timer);
      }
    } else {
      const handleBeforeInstallPrompt = (e: any) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later.
        setDeferredPrompt(e);
        // Delay showing
        setTimeout(() => {
          setIsVisible(true);
          setPromptType('android');
        }, 5000);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const closePrompt = () => {
    setIsVisible(false);
    // Remember dismissal for this session
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  // Don't show if dismissed this session
  if (sessionStorage.getItem('pwa_prompt_dismissed')) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[calc(100%-32px)] max-w-md"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 flex items-start gap-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
                <img src="/logo.svg" alt="Logo" className="w-8 h-8" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black text-slate-900 leading-tight mb-1">Install FirstLook</h3>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  {promptType === 'ios' 
                    ? 'Install FirstLook on your home screen for the full native experience.' 
                    : 'Get the FirstLook app for a faster, professional trading experience.'}
                </p>
              </div>

              <button 
                onClick={closePrompt}
                className="p-1.5 hover:bg-slate-50 rounded-full transition-colors"
              >
                <X size={16} className="text-slate-400" />
              </button>
            </div>

            <div className="px-5 pb-5 pt-0">
              {promptType === 'ios' ? (
                <div className="bg-slate-50 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center shadow-sm">
                      <Share size={12} className="text-indigo-600" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600">1. Tap the Share button at the bottom</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center shadow-sm">
                      <PlusSquare size={12} className="text-indigo-600" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600">2. Select "Add to Home Screen"</span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleInstallClick}
                  className="w-full bg-slate-900 text-white py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-600 transition-colors"
                >
                  <Download size={14} />
                  Install App
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
