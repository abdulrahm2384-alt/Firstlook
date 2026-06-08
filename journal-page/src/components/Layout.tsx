import React, { useState, useEffect } from 'react';

interface LayoutProps {
  children: React.ReactNode;
  user: any;
  onLogout: () => void;
}

export default function Layout({ children, user, onLogout }: LayoutProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    });

    window.addEventListener('appinstalled', () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
    });
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-white text-black font-serif selection:bg-black selection:text-white flex flex-col">
      <header className="border-b border-black py-4">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm uppercase tracking-widest">Tracker</span>
            {isInstallable && (
              <button 
                onClick={handleInstall}
                className="text-[9px] bg-black text-white px-2 py-0.5 hover:bg-black/80 transition-colors uppercase ml-4"
              >
                Install App
              </button>
            )}
          </div>
          
          {user && (
            <div className="flex items-center gap-4">
              <span className="text-[10px] opacity-60 uppercase">{user.email}</span>
              <button 
                onClick={onLogout}
                className="text-[10px] border border-black px-2 py-0.5 hover:bg-[#efefef] transition-colors uppercase"
              >
                logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main className={`max-w-5xl mx-auto px-4 flex-grow w-full flex flex-col ${!user ? 'justify-center' : 'py-12'}`}>
        {children}
      </main>

      <footer className="border-t border-black py-4 mt-auto">
        <div className="max-w-5xl mx-auto px-4 flex justify-between items-center">
          <p className="text-[9px] opacity-40 uppercase tracking-widest">
            © {new Date().getFullYear()} Tracker
          </p>
          <div className="flex gap-4 opacity-40 text-[9px] uppercase tracking-widest">
            <a href="#" className="hover:opacity-100 transition-opacity">Privacy</a>
            <a href="#" className="hover:opacity-100 transition-opacity">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
