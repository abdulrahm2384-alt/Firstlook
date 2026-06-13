import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  BookOpen, 
  Shield, 
  FileText, 
  Mail, 
  MapPin, 
  MessageSquare, 
  Layers, 
  ChevronRight, 
  CheckCircle2, 
  Send, 
  Sparkles, 
  Cpu,
  RefreshCw,
  Wallet
} from 'lucide-react';

export type LegalTabType = 'about' | 'contact' | 'privacy' | 'terms';

interface LegalAndSpecsPagesProps {
  initialTab?: LegalTabType;
  onBack: () => void;
  userEmail?: string;
  isLoggedIn?: boolean;
}

export const LegalAndSpecsPages: React.FC<LegalAndSpecsPagesProps> = ({
  initialTab = 'about',
  onBack,
  userEmail = '',
  isLoggedIn = false
}) => {
  const [activeTab, setActiveTab] = useState<LegalTabType>(initialTab);
  
  // Contact Form states
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState(userEmail);
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState('');
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccessMsg, setContactSuccessMsg] = useState('');

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactEmail || !contactMessage) return;
    
    setIsSubmitting(true);
    setContactError(null);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullname: contactName || 'Anonymous',
          usermail: contactEmail,
          subject: contactSubject || 'Direct Helpdesk Inquiry',
          message: contactMessage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message.');
      }

      const result = await response.json();
      console.log('Message sent successfully:', result);
      
      setSubmittedTicketId(result.id || '');
      setContactSuccessMsg(result.message || 'Inquiry transmitted successfully.');
      setShowSuccessToast(true);
      setContactSubject('');
      setContactMessage('');
      setTimeout(() => setShowSuccessToast(false), 9000);
    } catch (err: any) {
      console.error('Contact submit error:', err);
      setContactError(err.message || 'Error occurred while sending message.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const menuItems = [
    { id: 'about' as LegalTabType, label: 'About FirstLook', icon: BookOpen, desc: 'Our mission and backtesting strategy' },
    { id: 'contact' as LegalTabType, label: 'Contact Support', icon: Mail, desc: 'Direct technical support node' },
    { id: 'privacy' as LegalTabType, label: 'Privacy Policy', icon: Shield, desc: 'IndexedDB & token parameters' },
    { id: 'terms' as LegalTabType, label: 'Terms of Service', icon: FileText, desc: 'Rules & simulation disclaimers' },
  ];

  return (
    <div className="min-h-screen bg-[#fafbfc] text-slate-800 flex flex-col font-sans">
      {/* Top sticky navigation header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            id="legal-back-head-btn"
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer text-slate-500 hover:text-slate-900 flex items-center justify-center"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-black tracking-widest bg-slate-900 text-white px-2 py-0.5 rounded-md">FIRSTLOOK</span>
            <span className="text-xs font-semibold text-slate-400">/</span>
            <span className="text-xs font-black uppercase tracking-wider text-slate-600">Information Desk</span>
          </div>
        </div>
        <button 
          type="button"
          id="legal-back-nav-btn"
          onClick={onBack}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer flex items-center gap-1.5"
        >
          {isLoggedIn ? 'Back to Workspace' : 'Go to Login'}
          <ChevronRight size={14} />
        </button>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8 md:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side Sidebar */}
        <aside className="lg:col-span-4 h-fit bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-sm font-black uppercase bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-indigo-950 tracking-widest">Document Portal</h2>
            <p className="text-[10px] text-slate-400">Select an informational node below to load details.</p>
          </div>

          <nav className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  id={`legal-nav-${item.id}`}
                  onClick={() => {
                    setActiveTab(item.id);
                    // Match push state for smooth browser integration
                    const pathMap: Record<LegalTabType, string> = {
                      about: '/about',
                      contact: '/contact',
                      privacy: '/privacy-policy',
                      terms: '/terms'
                    };
                    window.history.pushState(null, '', pathMap[item.id]);
                  }}
                  className={`w-full flex items-start text-left gap-3.5 p-4 rounded-2xl border transition-all duration-250 cursor-pointer ${
                    isActive 
                      ? 'bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/10' 
                      : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100/60 hover:border-slate-200'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${isActive ? 'bg-white/10 text-white' : 'bg-white border border-slate-200/50 text-slate-500'}`}>
                    <Icon size={16} />
                  </div>
                  <div className="space-y-0.5">
                    <span className={`text-[11.5px] font-extrabold tracking-tight uppercase block ${isActive ? 'text-white' : 'text-slate-800'}`}>
                      {item.label}
                    </span>
                    <span className={`text-[9.5px] font-medium leading-tight block ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                      {item.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-[#3bca84]/10 rounded-xl flex items-center justify-center text-[#3bca84] shrink-0">
              <Sparkles size={16} />
            </div>
            <div>
              <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-900 block">Smarter Analytics</span>
              <span className="text-[8.5px] text-slate-400 block leading-tight">FirstLook Labs Backtesting Engine v3.4.1</span>
            </div>
          </div>
        </aside>

        {/* Right Side Main Content Panel */}
        <main className="lg:col-span-8 bg-white border border-slate-200/85 rounded-3xl p-6 md:p-10 shadow-sm min-h-[500px] flex flex-col justify-between">
          <AnimatePresence mode="wait">
            {activeTab === 'about' && (
              <motion.div
                key="about"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                {/* About Content */}
                <div className="space-y-3 pb-4 border-b border-slate-100">
                  <div className="inline-flex gap-1.5 px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[8px] font-black uppercase tracking-widest rounded-md">
                    <Cpu size={10} /> ENGINE OVERVIEW
                  </div>
                  <h1 className="text-xl md:text-2xl font-black tracking-tight text-[#011b33] uppercase leading-none">About FirstLook Labs</h1>
                  <p className="text-slate-500 text-xs md:text-sm leading-relaxed font-semibold">
                    We engineer simulation sandboxes to scale trading intuition safely through iterative, high-density deliberate backtesting.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                    <div className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
                      <Cpu size={16} />
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Deliberate Practice Framework</h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                      Unlike static spreadsheets, FirstLook offers a high-performance interactive interface. Traders can launch historical datasets, scrub step-by-step, control speed multipliers, indicators (RSI, Bollinger, MACD), and test rules in absolute fidelity.
                    </p>
                  </div>

                  <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                    <div className="w-9 h-9 bg-emerald-600 text-white rounded-xl flex items-center justify-center">
                      <RefreshCw size={16} />
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Multi-Layer Healing Caches</h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                      Built for resilience against erratic network limits. Real market candles from premium warehouses are cached in a dual local layer (IndexedDB and RAM Map objects). Any corrupt entries are automatically pruned and healed on consecutive executions.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#011b33]">The Core Team & Mission</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                    FirstLook Labs was founded by veteran algorithmic traders and systems UI engineers who realized that true trading skill is built through hours of high-density corrective testing rather than chasing speculative live trends. We maintain a full-stack, stateful backtest interface synced to premium global telemetry hubs to log mock positions, calculate risk ratios, check win-streak percentages, and grant progression achievements to celebrate your dedication.
                  </p>
                </div>

                <div className="p-4 bg-indigo-50/50 border border-indigo-100/70 rounded-2xl">
                  <span className="text-[9px] font-black uppercase tracking-widest text-indigo-700 block mb-1">Simulative Disclaimer</span>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                    All charts, logs, drawdowns, and practice outcomes within FirstLook Labs are completely artificial and virtual. Zero live money or broker interfaces are exposed. FirstLook does not guarantee any financial growth or predict live financial products.
                  </p>
                </div>
              </motion.div>
            )}

            {activeTab === 'contact' && (
              <motion.div
                key="contact"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Contact Content */}
                <div className="space-y-3 pb-4 border-b border-slate-100">
                  <div className="inline-flex gap-1.5 px-2 py-0.5 bg-[#3bca84]/10 border border-[#3bca84]/30 text-[#3bca84] text-[8px] font-black uppercase tracking-widest rounded-md">
                    <Mail size={10} /> COMMUNICATIONS
                  </div>
                  <h1 className="text-xl md:text-2xl font-black tracking-tight text-[#011b33] uppercase leading-none">Contact Support & Partners</h1>
                  <p className="text-slate-500 text-xs md:text-sm leading-relaxed font-semibold">
                    Have inquiries regarding platform limits, Paystack conversions, API warehouse updates, or billing? Hit our direct Technical Support node below.
                  </p>
                </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="p-4 bg-indigo-50/50 border border-indigo-100/60 rounded-2xl flex flex-col justify-between">
                     <div>
                       <span className="text-[9.5px] font-black uppercase tracking-widest text-indigo-700 block mb-1">Direct Live Assistance</span>
                       <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                         You can contact and text our support team directly online within the Watchlist page of the application using our integrated real-time assistance widget.
                       </p>
                     </div>
                   </div>

                   <div className="p-4 bg-emerald-50/50 border border-emerald-100/60 rounded-2xl flex flex-col justify-between">
                     <div>
                       <span className="text-[9.5px] font-black uppercase tracking-widest text-[#3bca84] block mb-1">Direct Helpdesk Email</span>
                       <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                         Need direct assistance via email? Shoot an inquiry to our support staff anytime at:
                       </p>
                       <a 
                         href="mailto:support@firstlooklabs.xyz" 
                         className="inline-flex items-center gap-1.5 text-xs font-black text-[#2e9e67] hover:text-[#21724a] underline mt-2"
                       >
                         <Mail size={12} />
                         support@firstlooklabs.xyz
                       </a>
                     </div>
                   </div>
                 </div>

                {/* Form */}
                <form onSubmit={handleContactSubmit} className="space-y-4 pt-2">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Send an Encrypted Request</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-wider text-slate-500" htmlFor="contact-name">Your Full Name</label>
                      <input 
                        type="text" 
                        id="contact-name"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="e.g. Liam Trader"
                        className="w-full text-[11px] font-semibold p-3 border border-slate-200 rounded-xl focus:border-slate-900 focus:outline-none transition-colors"
                        required
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-wider text-slate-500" htmlFor="contact-email">Secure Communication Email</label>
                      <input 
                        type="email" 
                        id="contact-email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full text-[11px] font-semibold p-3 border border-slate-200 rounded-xl focus:border-slate-900 focus:outline-none transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-500" htmlFor="contact-sub">Inquiry Subject Context</label>
                    <input 
                      type="text" 
                      id="contact-sub"
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      placeholder="e.g. Account Regional Settlement / Currency Rate"
                      className="w-full text-[11px] font-semibold p-3 border border-slate-200 rounded-xl focus:border-slate-900 focus:outline-none transition-colors"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-500" htmlFor="contact-msg">Message Query Node</label>
                    <textarea 
                      id="contact-msg"
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="Include details about your query context..."
                      rows={4}
                      className="w-full text-[11px] font-semibold p-3 border border-slate-200 rounded-xl focus:border-slate-900 focus:outline-none transition-colors"
                      required
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-4 flex-wrap">
                    <button
                      type="submit"
                      id="contact-submit-btn"
                      disabled={isSubmitting || !contactEmail || !contactMessage}
                      className="px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-[10.5px] font-black uppercase tracking-widest transition-all shadow-md shadow-slate-900/15 cursor-pointer flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          Transmitting Node...
                        </>
                      ) : (
                        <>
                          <Send size={12} />
                          Dispatch Message
                        </>
                      )}
                    </button>

                    <AnimatePresence>
                      {showSuccessToast && (
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 text-[#2fb071] rounded-xl"
                        >
                          <CheckCircle2 size={14} className="shrink-0" />
                          <span className="text-[10px] font-bold">{contactSuccessMsg || "Inquiry transmitted."} Ticket ID: <strong className="font-mono bg-emerald-100/40 px-1 py-0.5 rounded text-emerald-800">{submittedTicketId}</strong>. We reply within 2 hours.</span>
                        </motion.div>
                      )}
                      {contactError && (
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl"
                        >
                          <span className="text-[10px] font-bold">⚠️ {contactError}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </form>
              </motion.div>
            )}

            {activeTab === 'privacy' && (
              <motion.div
                key="privacy"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Privacy Content */}
                <div className="space-y-3 pb-4 border-b border-slate-100">
                  <div className="inline-flex gap-1.5 px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[8px] font-black uppercase tracking-widest rounded-md">
                    <Shield size={10} /> SECURE CRYPTOGRAPHY
                  </div>
                  <h1 className="text-xl md:text-2xl font-black tracking-tight text-[#011b33] uppercase leading-none">Privacy & Token Security</h1>
                  <p className="text-slate-500 text-xs md:text-sm leading-relaxed font-semibold">
                    FirstLook Labs maintains the absolute security of your charts, session logs, and local preferences with high-efficiency architecture.
                  </p>
                </div>

                <div className="space-y-5 text-xs text-slate-600 leading-relaxed font-semibold">
                  <div className="space-y-1.5">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-[#3bca84] rounded-full" /> 1. Data Aggregation and Storage
                    </h3>
                    <p className="pl-3 text-slate-500">
                      We index registration parameters (securely hashed credentials in database containers) to enable cross-platform syncing of backtest sessions, logs, and billing. User settings and drawings are stored relative to user IDs and remain confidential.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-[#3bca84] rounded-full" /> 2. Dual Caching and Self-Healing Telemetry
                    </h3>
                    <p className="pl-3 text-slate-500">
                      To optimize loading times under poor network conditions, the system caches candlestick arrays in your browser's local sandbox (IndexedDB database stores under <span className="font-mono bg-slate-100 text-slate-700 px-1 py-0.2 rounded text-[10px]">candles_v3</span>). The application evaluates downloaded segments on startup and automatically heals or discards any corrupted segments, keeping your environment error-free.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-[#3bca84] rounded-full" /> 3. Regional Checkout Integrity
                    </h3>
                    <p className="pl-3 text-slate-500">
                      For upgrades to Plus and Premium tiers, we route secure payment handshakes via Paystack's tokenized SSL pipeline. FirstLook Labs processes user registration countries to accurately convert base rates (e.g. $5 or $20 USD) to valid local regional currency amounts without caching raw billing tokens or banking information on our servers.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-[#3bca84] rounded-full" /> 4. Device Conflict Checks
                    </h3>
                    <p className="pl-3 text-slate-500">
                      Session tokens are strictly single-device. If our security server determines concurrency overrides, active sockets are paused to safeguard personal journal metrics from dual unauthorized overwrites.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-[#ea3323] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-[#ea3323] rounded-full" /> 5. Single Account Restriction Policy
                    </h3>
                    <p className="pl-3 text-slate-500">
                      To safeguard account identity and prevent platform exploitation, users are strictly prohibited from creating, operating, or maintaining multiple registered accounts. Each user is restricted to exactly a single account profile. Any duplicate registrations detected through structural telemetry, matching emails, or device signature footprints will result in immediate permanent suspension of all related credentials.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-2">
                  <span className="text-[9.5px] font-black text-slate-400">LAST POLICIES UPDATE: SECURE STATE 2026.06.09</span>
                </div>
              </motion.div>
            )}

            {activeTab === 'terms' && (
              <motion.div
                key="terms"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Terms Content */}
                <div className="space-y-3 pb-4 border-b border-slate-100">
                  <div className="inline-flex gap-1.5 px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[8px] font-black uppercase tracking-widest rounded-md">
                    <Layers size={10} /> BINDING PARAMETERS
                  </div>
                  <h1 className="text-xl md:text-2xl font-black tracking-tight text-[#011b33] uppercase leading-none">Terms of Service</h1>
                  <p className="text-slate-500 text-xs md:text-sm leading-relaxed font-semibold">
                    Legal framework and simulation guidelines bound to the usage of FirstLook Labs Backtesting, Replay, and Deliberate Practice features.
                  </p>
                </div>

                <div className="space-y-5 text-xs text-slate-600 leading-relaxed font-semibold">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Wallet size={13} className="text-slate-400" />
                      <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800">1. Subscriptions & Regional Compliance</h3>
                    </div>
                    <p className="pl-5 text-slate-500">
                      Users selecting the Basic (Free), Plus ($5.00/mo or $50.40/yr), or Premium ($20.00/mo or $201.60/yr) tier represent that they reside in the stated country of billing. Local transaction totals are continuously calculated on real-time country-specific conversion dynamics to provide a fair region-specific checkout experience globally (supporting USD, NGN, ZAR, KES, GHS, etc.).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Cpu size={13} className="text-slate-400" />
                      <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800">2. System Load Allowances</h3>
                    </div>
                    <p className="pl-5 text-slate-500">
                      To preserve platform throughput, the Favorites shortcut menu bar is locked to active on high-efficiency layouts. Symbol streaming buffers, indicators capacity per template, and replay steps are bound strictly by your active plan parameters. Excess loads or custom scripting overloading Binance data warehouses may result in temporal socket throttles.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText size={13} className="text-slate-400" />
                      <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800">3. Non-Relational Simulative Disclaimer</h3>
                    </div>
                    <p className="pl-5 text-slate-500 text-amber-700 bg-amber-50/50 p-2 border border-amber-100/50 rounded-xl">
                      <strong>CRITICAL ADVISORY:</strong> FIRSTLOOK LABS IS STATED SOLELY AS A PRACTICE SIMULATION MODULE. We do not provide real broker licenses, broker connectivity, or real-time trade clearing. Playback metrics belong entirely to artificial client state and never map onto live brokerage terminals.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Shield size={13} className="text-[#ea3323]" />
                      <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800">4. Abuse and Termination</h3>
                    </div>
                    <p className="pl-5 text-slate-500">
                      FirstLook Labs reserves the right to terminate access slots for accounts found utilizing third-party bypass mechanisms, scraping raw database warehouses, or falsifying geographic billing regions during settlement authorization.
                    </p>
                    <p className="pl-5 pt-1 text-slate-500">
                      Furthermore, matching our strict single-account mandate, you must not use or establish multiple accounts. Registering more than one account per individual user constitutes a fundamental breach of these terms, triggering automated systems to lock and terminate all associated simulation slots and profile databases immediately.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                  <span className="text-[9.5px] font-bold text-indigo-600">BOUND TO REGISTERED USERS GLOBALLY</span>
                  <span className="text-[9.5px] font-bold text-slate-400">ESTABLISHED 2026.06.09</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Core Footer Inside Box */}
          <div className="mt-12 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 font-semibold gap-4">
            <span>© {new Date().getFullYear()} FirstLook Labs. All simulation logs cleared on legal validation.</span>
            <div className="flex items-center gap-4">
              <span className="hover:text-slate-800 transition-colors cursor-pointer" onClick={() => setActiveTab('privacy')}>Privacy</span>
              <span className="hover:text-slate-800 transition-colors cursor-pointer" onClick={() => setActiveTab('terms')}>Terms</span>
              <span className="hover:text-slate-800 transition-colors cursor-pointer" onClick={() => setActiveTab('contact')}>Help Node</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
