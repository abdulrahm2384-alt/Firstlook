import React, { useEffect } from 'react';

interface GoogleAdSenseUnitProps {
  client: string;
  slot: string;
}

export const GoogleAdSenseUnit: React.FC<GoogleAdSenseUnitProps> = ({ client, slot }) => {
  useEffect(() => {
    // 1. Safe inject of Google AdSense script
    const scriptId = 'google-adsense-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }

    // 2. Initialize the specific ad block on mount
    try {
      if (typeof window !== 'undefined') {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (e) {
      console.warn('[AdSense] Failed to trigger manual ad slot:', e);
    }
  }, [client, slot]);

  return (
    <div className="flex flex-col border border-slate-100/80 rounded-xl bg-slate-50/30 p-2.5 relative min-h-[46px] justify-center items-center overflow-hidden">
      {/* Low-contrast Tag to satisfy disclosure & premium look */}
      <span className="absolute right-3 top-2 px-1.5 py-0.5 rounded bg-slate-100/50 text-[5px] font-black uppercase text-slate-400/90 tracking-wider">
        Sponsored Grid
      </span>

      {/* Actual Google Publisher Display Block */}
      <div className="w-full text-center flex items-center justify-center">
        <ins
          className="adsbygoogle"
          style={{ display: 'inline-block', width: '100%', minHeight: '38px', maxHeight: '44px' }}
          data-ad-client={client}
          data-ad-slot={slot}
          data-ad-format="horizontal"
          data-full-width-responsive="false"
        />
      </div>
    </div>
  );
};
