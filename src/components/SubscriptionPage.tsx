import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getCurrencyForCountry } from '../utils/currencyConverter';
import { 
  Check, 
  X, 
  Zap, 
  Sparkles, 
  Shield, 
  Crown, 
  Users, 
  CreditCard, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  UserPlus, 
  CheckCircle2, 
  Trophy,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Loader2,
  Lock,
  Globe,
  Coins,
  DollarSign,
  AlertCircle,
  ArrowRight,
  Search
} from 'lucide-react';

interface SubscriptionPageProps {
  user?: any;
  currentPlan: 'basic' | 'plus' | 'premium';
  onUpdateSubscription: (plan: 'basic' | 'plus' | 'premium') => void;
  onBack: () => void;
  backLabel?: string;
}

interface TeamMember {
  id: string;
  email: string;
  role: string;
  joinedAt: string;
  winRate: number;
  tradesCount: number;
}

const loadPaystackScript = () => {
  return new Promise<boolean>((resolve) => {
    if ((window as any).PaystackPop) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export function SubscriptionPage({ 
  user,
  currentPlan, 
  onUpdateSubscription, 
  onBack,
  backLabel
}: SubscriptionPageProps) {
  const [invitedEmail, setInvitedEmail] = useState('');
  const [invitedRole, setInvitedRole] = useState('Analyst');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [openFaqKey, setOpenFaqKey] = useState<string | null>(null);
  const [faqSearchQuery, setFaqSearchQuery] = useState('');
  const [faqSelectedCategory, setFaqSelectedCategory] = useState<'all' | 'billing' | 'limits' | 'charting' | 'performance'>('all');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(true);

  // Auto-detected state using the real life strategy currency converter based on user registration country
  const userCountry = user?.country || 'United States';
  const currencyInfo = getCurrencyForCountry(userCountry);
  const { symbol, rate: fxRate, name: fxName, code: preferredCurrency } = currencyInfo;

  // Checkout states
  const [selectedPlanDetails, setSelectedPlanDetails] = useState<{
    id: 'plus' | 'premium';
    name: string;
    description: string;
    usdAmount: number;
  } | null>(null);

  const [premiumFeedback, setPremiumFeedback] = useState<'idle' | 'loading' | 'message'>('idle');

  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [recurringToggle, setRecurringToggle] = useState(false);

  const normCountry = (userCountry || '').trim().toLowerCase();
  const isLocalAfricanCountry = 
    normCountry.includes('nigeria') || normCountry.includes('nigerian') ||
    normCountry.includes('kenya') || normCountry.includes('kenyan') ||
    normCountry.includes('ghana') || normCountry.includes('ghanaian') ||
    normCountry.includes('south africa') || normCountry.includes('south african');

  const showBankTransfer = isLocalAfricanCountry && !recurringToggle;

  const hasActiveUpgrade = currentPlan === 'plus' || currentPlan === 'premium';

  // Simulator states
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simulatorDetails, setSimulatorDetails] = useState<{
    reference: string;
    email: string;
    amount: number;
    currency: string;
    plan: 'plus' | 'premium';
    callbackUrl: string;
    isSubscriptionRecurring?: boolean;
    billingCycle?: string;
  } | null>(null);

  const [simulatorCard, setSimulatorCard] = useState({
    number: '',
    expiry: '',
    cvv: '',
    pin: ''
  });
  const [simulatorMethod, setSimulatorMethod] = useState<'card' | 'bank' | 'ussd'>('card');
  const [simulatorStatus, setSimulatorStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');

  const [projectMode, setProjectMode] = useState<'test' | 'live' | ''>('');
  const [serverIsMock, setServerIsMock] = useState(true);

  // Real-time personal transaction history state
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchPaymentHistory = async () => {
    if (!user?.id) return;
    setLoadingHistory(true);
    try {
      const response = await fetch(`/api/persistence/get-payment-history?userId=${user.id}`);
      const data = await response.json();
      if (data && data.success) {
        setPaymentHistory(data.history || []);
      }
    } catch (err) {
      console.error("[Billing History] Failed to load transaction records:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchPaymentHistory();
  }, [user?.id, currentPlan]);

  useEffect(() => {
    fetch('/api/paystack/config')
      .then(res => res.json())
      .then(data => {
        if (data.mode) setProjectMode(data.mode);
        if (data.isMock !== undefined) setServerIsMock(data.isMock);
      })
      .catch(err => console.error('[Paystack Config Load Error]', err));
  }, []);

  const formatPrice = (usdVal: number) => {
    if (usdVal === 0) return 'FREE';
    const localVal = usdVal * fxRate;
    return `${symbol}${localVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  // Enhanced interactive FAQ structures
  const faqs = [
    {
      category: "billing" as const,
      q: "What are the exact plan differences?",
      a: "• Basic (Free): Lifetime indicators, 3 watchlist symbols, and standard fixed spreads.\n• Plus ($5.00/mo): Raw spreads toggle, unlimited watchlist items, historic replay engine, and competition access.\n• Premium ($20.00/mo): Adds unlimited competition slots and multi-seat team management with 10 team seats."
    },
    {
      category: "billing" as const,
      q: "How do I cancel active auto-renewal?",
      a: "Click 'Stop Auto-Renewal' at the top of this page. Your premium benefits will remain fully active until your current cycle ends, then gracefully downgrade to Basic."
    },
    {
      category: "limits" as const,
      q: "Is there a Symbol Watchlist limit?",
      a: "Yes, the Basic tier is limited to 3 active symbols. Upgrading to Plus or Premium removes all watchlist limitations."
    },
    {
      category: "limits" as const,
      q: "How do simulated competitions work?",
      a: "Test strategies under live simulation. Plus members unlock available slots, and Premium members unlock completely unlimited concurrent competition entries."
    },
    {
      category: "charting" as const,
      q: "How do Custom Broker Spreads work?",
      a: "Plus and Premium members can simulate zero-spread commission environments (like Pepperstone Razor) or select default spread behaviors."
    },
    {
      category: "charting" as const,
      q: "What is the Trade Replay engine?",
      a: "Step backward on your chart to execute strategy evaluations. Advance candles at adjustable step speeds to test pattern triggers. Available on Plus and Premium."
    },
    {
      category: "performance" as const,
      q: "Can I install FirstLook as a native PWA?",
      a: "Yes. Tap 'Share' > 'Add to Home Screen' on Safari iOS, 'Install App' on Android Chrome, or click the desktop install shortcut directly in your browser tab."
    },
    {
      category: "performance" as const,
      q: "What if the charts lag?",
      a: "FirstLook computes charts locally. If memory buffers grow, refresh your tab or click 'Clear Local Setups' in your Profile to rebuild clean cache."
    }
  ];

  // Save/Load team members (Multi-user Premium feature)
  useEffect(() => {
    const saved = localStorage.getItem('premium_team_members');
    if (saved) {
      setTeamMembers(JSON.parse(saved));
    } else {
      const initialTeam: TeamMember[] = [
        { id: '1', email: 'junior_trader@firstlook.com', role: 'Trader', joinedAt: '2026-04-10', winRate: 54.2, tradesCount: 42 },
        { id: '2', email: 'system_bot_alpha@firstlook.com', role: 'Copilot Bot', joinedAt: '2026-05-01', winRate: 61.8, tradesCount: 110 }
      ];
      setTeamMembers(initialTeam);
      localStorage.setItem('premium_team_members', JSON.stringify(initialTeam));
    }
  }, []);

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitedEmail.trim()) return;
    
    const newMember: TeamMember = {
      id: Math.random().toString(36).substring(2, 9),
      email: invitedEmail.trim(),
      role: invitedRole,
      joinedAt: new Date().toISOString().split('T')[0],
      winRate: parseFloat((45 + Math.random() * 25).toFixed(1)),
      tradesCount: Math.floor(10 + Math.random() * 50)
    };

    const updated = [...teamMembers, newMember];
    setTeamMembers(updated);
    localStorage.setItem('premium_team_members', JSON.stringify(updated));
    setInvitedEmail('');
    setSuccessMessage(`Team member "${newMember.email}" invited successfully!`);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handleRemoveMember = (id: string) => {
    const updated = teamMembers.filter(m => m.id !== id);
    setTeamMembers(updated);
    localStorage.setItem('premium_team_members', JSON.stringify(updated));
  };

  // User Preferences cached state for active subscription details
  const [prefs, setPrefs] = useState<any>(null);
  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [cancellingAutoRenew, setCancellingAutoRenew] = useState(false);

  const fetchPrefs = async () => {
    if (!user?.id) return;
    setLoadingPrefs(true);
    try {
      const response = await fetch(`/api/persistence/get-preferences?userId=${user.id}`);
      const data = await response.json();
      if (data && data.preferences) {
        setPrefs(data.preferences);
      }
    } catch (e) {
      console.error("Error loading preferences in SubscriptionPage:", e);
    } finally {
      setLoadingPrefs(false);
    }
  };

  useEffect(() => {
    fetchPrefs();
  }, [user?.id, currentPlan]);

  const handleStopAutoRenew = async () => {
    if (!user?.id || !prefs) return;
    if (!window.confirm("Are you sure you want to stop auto-renewal? Your subscription benefits will remain active until the end of the current billing cycle, but you won't be charged again.")) {
      return;
    }
    setCancellingAutoRenew(true);
    try {
      const response = await fetch("/api/persistence/save-preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: user.id,
          prefs: {
            isSubscriptionRecurring: false
          }
        })
      });
      const data = await response.json();
      if (data.success) {
        setSuccessMessage("Auto-renewal successfully stopped.");
        // Reload preferences
        await fetchPrefs();
        setTimeout(() => setSuccessMessage(''), 4000);
      } else {
        alert("Failed to stop auto-renewal. Please try again.");
      }
    } catch (err) {
      console.error("Error stopping auto-renewal:", err);
      alert("Network error. Please try again.");
    } finally {
      setCancellingAutoRenew(false);
    }
  };

  const planCards = [
    {
      id: 'basic' as const,
      name: 'Basic',
      price: '$0',
      period: 'forever',
      description: 'Access core indicator mechanics and raw charting setups.',
      icon: Shield,
      color: 'border-slate-200 text-slate-950 bg-white hover:border-slate-300',
      headerBg: 'bg-slate-50 text-slate-800',
      iconColor: 'text-slate-500',
      features: [
        { text: 'Complete Indicator Toolsets', included: true },
        { text: 'Interactive Drawing Tools', included: true },
        { text: 'Watchlist (Max 3 Active Pairs)', included: true },
        { text: 'Daily Candle Playback (Max 500 candles)', included: true },
        { text: 'Replay Journal Trades (Last 10 ONLY)', included: true },
        { text: 'Create/Edit Indicator Script', included: false },
        { text: 'Synced Side-by-Side Charts', included: false },
        { text: 'Simulated Competitions', included: false },
        { text: 'Forex Spreads (Cannot be disabled)', included: true },
        { text: 'Multi-User Team Management', included: false },
      ],
      ctaText: 'Default Plan',
      isCurrent: currentPlan === 'basic',
      rawAmount: 0
    },
    {
      id: 'plus' as const,
      name: 'Plus',
      price: billingCycle === 'monthly' ? formatPrice(5.00) : formatPrice(4.20),
      period: 'month',
      billedText: billingCycle === 'yearly' ? `Billed annually (${formatPrice(50.40)}/yr)` : undefined,
      description: 'Unlock historical replay engines and speed up your setup tests.',
      icon: Zap,
      color: 'border-indigo-500 text-indigo-950 bg-indigo-50/10 shadow-xl relative ring-2 ring-indigo-500/20 scale-[1.01]',
      headerBg: 'bg-indigo-600 text-white',
      iconColor: 'text-white',
      badge: 'Highly Recommended',
      features: [
        { text: 'Complete Indicator Toolsets', included: true },
        { text: 'Interactive Drawing Tools', included: true },
        { text: 'Unlimited Watchlist Pairs', included: true },
        { text: 'Daily Candle Playback (Max 3,000 candles)', included: true },
        { text: 'Replay All Historical Journal Trades', included: true },
        { text: 'Custom LiteScripts (Max 1 Active)', included: true },
        { text: 'Synced Side-by-Side Charts', included: true },
        { text: 'All Available Competition Slots', included: true },
        { text: 'Customizable Forex Spreads (Disable option)', included: true },
        { text: 'Multi-User Team Management', included: false },
      ],
      ctaText: currentPlan === 'basic' ? 'Upgrade to Plus' : 'Select Plus Tier',
      isCurrent: currentPlan === 'plus',
      rawAmount: billingCycle === 'monthly' ? 5.00 : 50.40
    },
    {
      id: 'premium' as const,
      name: 'Premium',
      price: billingCycle === 'monthly' ? formatPrice(20.00) : formatPrice(16.80),
      period: 'month',
      billedText: billingCycle === 'yearly' ? `Billed annually (${formatPrice(201.60)}/yr)` : undefined,
      description: 'Our complete professional suite for multi-user trading teams.',
      icon: Crown,
      color: 'border-indigo-900 text-indigo-950 bg-gradient-to-b from-indigo-50/5 to-indigo-100/10 shadow-2xl relative ring-4 ring-indigo-950/20',
      headerBg: 'bg-indigo-950 text-white',
      iconColor: 'text-amber-400',
      badge: 'Full Suite Workspace',
      features: [
        { text: 'Complete Indicator Toolsets', included: true },
        { text: 'Interactive Drawing Tools', included: true },
        { text: 'Unlimited Watchlist Pairs', included: true },
        { text: 'Unconstrained Daily Candles (No Limit)', included: true },
        { text: 'Replay All Historical Journal Trades', included: true },
        { text: 'Unlimited Compiled LiteScripts', included: true },
        { text: 'Synced Side-by-Side Charts', included: true },
        { text: 'Unlimited Simulated Competition Slots', included: true },
        { text: 'Customizable Forex Spreads (Disable option)', included: true },
        { text: 'Invite multiple user slots to account (10 seats)', included: true },
      ],
      ctaText: currentPlan === 'premium' ? 'Current Active Tier' : 'Upgrade to Premium',
      isCurrent: currentPlan === 'premium',
      rawAmount: billingCycle === 'monthly' ? 20.00 : 201.60
    }
  ];

  const handleCheckoutCtaClick = (plan: typeof planCards[0]) => {
    if (plan.id === 'basic') return;
    if (hasActiveUpgrade) return;
    
    if (plan.id === 'premium') {
      setPremiumFeedback('loading');
      setTimeout(() => {
        setPremiumFeedback('message');
      }, 1500);
      return;
    }

    setSelectedPlanDetails({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      usdAmount: plan.rawAmount
    });
    setRecurringToggle(false); // Default to false/disabled as requested
    setCheckoutError('');
    setCheckoutSuccess(false);
  };

  const handlePaystackCheckout = async () => {
    if (!selectedPlanDetails) return;
    setLoadingCheckout(true);
    setCheckoutError('');
    
    try {
      const response = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan: selectedPlanDetails.id,
          billingCycle,
          email: user?.email || 'guest@firstlook.com',
          userId: user?.id || 'guest-id',
          country: userCountry,
          recurring: recurringToggle
        })
      });

      const resData = await response.json();
      if (!response.ok || !resData.status) {
        throw new Error(resData.error || 'Check out process failed to initialize');
      }

      const { authorization_url, reference, isMock, currency, localAmount, usdAmount, publicKey, access_code } = resData.data;

      if (isMock) {
        // Run simulator overlay right here!
        setSimulatorDetails({
          reference,
          email: user?.email || 'guest@firstlook.com',
          amount: localAmount,
          currency,
          plan: selectedPlanDetails.id,
          callbackUrl: resData.data.authorization_url,
          isSubscriptionRecurring: resData.data.isSubscriptionRecurring,
          billingCycle: resData.data.billingCycle
        });
        setSimulatorStatus('idle');
        setSimulatorCard({ number: '', expiry: '', cvv: '', pin: '' });
        setSimulatorMethod('card');
        setIsSimulatorOpen(true);
      } else {
        // Production redirection/popup flow
        const scriptLoaded = await loadPaystackScript();
        const keyToUse = publicKey || (import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY;
        const fallbackUrl = authorization_url || `https://checkout.paystack.com/${access_code}`;

        if (!scriptLoaded || !keyToUse || !access_code) {
          console.log("[Paystack Inline Debug] Falling back to standard merchant redirect:", fallbackUrl);
          window.location.href = fallbackUrl;
          return;
        }

        try {
          console.log("[Paystack Inline] Opening secure payment overlay inline with access code:", access_code);
          const paystack = (window as any).PaystackPop.setup({
            key: keyToUse,
            access_code: access_code,
            callback: async (verifiedResponse: any) => {
              console.log("[Paystack Inline] Completed on client, verifying reference:", verifiedResponse.reference);
              setLoadingCheckout(true);
              setCheckoutError('');
              try {
                // Verify directly inside the running browser session (no page reload needed!)
                const verifyRes = await fetch(`/api/paystack/verify/${verifiedResponse.reference || reference}`);
                const verifyResult = await verifyRes.json();
                
                if (verifyResult.status && (verifyResult.data?.status === 'success' || verifyResult.data?.isMock)) {
                  console.log("[Paystack Inline] Real-time verification success. Applying upgrade inline!");
                  onUpdateSubscription(selectedPlanDetails.id);
                  setSelectedPlanDetails(null);
                } else {
                  console.warn("[Paystack Inline] Verification response status negative:", verifyResult);
                  setCheckoutError("Dynamic verification did not complete instantly. Your workspace will automatically upgrade within a minute via background webhook! Please do not double pay.");
                }
              } catch (err) {
                console.error("[Paystack Inline Verification Catch]", err);
                setCheckoutError("Secure session verification postponed. Your plan will activate automatically via our backend webhook within a moment!");
              } finally {
                setLoadingCheckout(false);
              }
            },
            onClose: () => {
              console.log("[Paystack Inline] Window closed manually");
              setCheckoutError("Payment overlay was dismissed.");
            }
          });
          paystack.openIframe();
        } catch (sdkError) {
          console.error("[Paystack SDK Popup Error, falling back to redirect]", sdkError);
          window.location.href = fallbackUrl;
        }
      }
    } catch (err: any) {
      console.error("[Paystack Checkout Initialize Failed]", err);
      setCheckoutError(err.message || 'Payment server took too long. Please try again.');
    } finally {
      setLoadingCheckout(false);
    }
  };

  const handleSimulatorSubmit = async () => {
    if (!simulatorDetails) return;
    setSimulatorStatus('processing');

    setTimeout(async () => {
      try {
        const response = await fetch('/api/paystack/verify-mock', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: user?.id || 'guest-id',
            plan: simulatorDetails.plan,
            reference: simulatorDetails.reference,
            isSubscriptionRecurring: simulatorDetails.isSubscriptionRecurring,
            billingCycle: simulatorDetails.billingCycle
          })
        });

        if (!response.ok) {
          throw new Error('Simulation validation failed');
        }

        setSimulatorStatus('success');
        setTimeout(() => {
          onUpdateSubscription(simulatorDetails.plan);
          setIsSimulatorOpen(false);
          setSelectedPlanDetails(null);
          setSimulatorDetails(null);
        }, 1500);
      } catch (err) {
        setSimulatorStatus('failed');
      }
    }, 1200);
  };

  return (
    <div className="flex flex-col h-full bg-neutral-55 relative overflow-hidden font-sans">
      {/* Header Bar */}
      <div className="sticky top-0 z-35 px-6 py-4 flex items-center justify-between shrink-0 bg-white/95 backdrop-blur-md border-b border-rose-50/20 shadow-sm">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 group cursor-pointer"
        >
          <ArrowLeft size={16} className="text-black group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-black uppercase tracking-[0.25em] text-black">{backLabel || "Back to Profile"}</span>
        </button>
        <div className="flex items-center gap-3">
          {projectMode === 'live' ? (
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/50 px-2.5 py-1 text-[9.5px] font-black uppercase tracking-widest rounded-lg animate-fade-in">
              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0"></span>
              <span>LIVE Mode</span>
            </div>
          ) : projectMode === 'test' ? (
            <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-800 border border-indigo-200/50 px-2.5 py-1 text-[9.5px] font-black uppercase tracking-widest rounded-lg animate-fade-in">
              <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-pulse shrink-0"></span>
              <span>TEST SANDBOX</span>
            </div>
          ) : null}
          <div className="flex items-center gap-1.5 bg-black/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-black rounded-lg">
            <CreditCard size={12} />
            <span>Subscription Plans Upgrade Panel</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8 space-y-8 pb-32 max-w-6xl mx-auto w-full">
        {hasActiveUpgrade && (
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 sm:p-5 max-w-2xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-left shadow-sm">
            <div className="flex items-start gap-3">
              <Lock className="text-amber-600 shrink-0 mt-0.5" size={16} />
              <div className="space-y-1">
                <h4 className="text-[11.5px] font-bold text-amber-900 uppercase tracking-wider">Active Subscription Engaged ({currentPlan.toUpperCase()})</h4>
                <p className="text-[10.5px] font-medium text-amber-800 leading-relaxed">
                  Your workspace is active under the premium <strong>{currentPlan.toUpperCase()}</strong> membership tier. To ensure billing integrity, purchasing other plans is locked until your current plan has completed its duration.
                  {prefs && prefs.subscriptionExpiry && (
                    <>
                      {" "}This plan is active until <strong>{new Date(prefs.subscriptionExpiry).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</strong>.
                    </>
                  )}
                </p>
                {prefs && (
                  <div className="flex items-center gap-2 mt-1.5 bg-white/40 px-2 py-1 rounded-md border border-amber-200/40 w-fit">
                    <span className="flex h-2 w-2 relative">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${prefs.isSubscriptionRecurring ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${prefs.isSubscriptionRecurring ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                    </span>
                    <span className="text-[9.5px] text-amber-900 font-extrabold uppercase tracking-wide">
                      Auto-Debit Status: {prefs.isSubscriptionRecurring ? "Active Recurring Billing" : "Deactivated (One-Time Period)"}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {prefs && prefs.isSubscriptionRecurring && (
              <button
                type="button"
                disabled={cancellingAutoRenew}
                onClick={handleStopAutoRenew}
                className="shrink-0 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border border-rose-200 flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {cancellingAutoRenew ? (
                  <>
                    <Loader2 size={11} className="animate-spin" />
                    Stopping...
                  </>
                ) : (
                  <>
                    <X size={11} />
                    Stop Auto-Renewal
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Pitch Headline */}
        <div className="text-center space-y-2 max-w-2xl mx-auto flex flex-col justify-center">
          {projectMode === 'test' && (
            <div className="inline-flex items-center gap-2.5 bg-indigo-50/50 border border-indigo-100 px-4 py-2 rounded-2xl mx-auto mb-4 text-left shadow-sm">
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <p className="text-[10px] sm:text-[10.5px] font-semibold text-indigo-950 leading-normal">
                <strong>Project Test Sandbox Mode Active:</strong> Interactive checkout simulators are enabled so you can test mock subscriptions safely with simulated credit card or bank details.
              </p>
            </div>
          )}
          {projectMode === 'live' && (
            <div className="inline-flex items-center gap-2.5 bg-emerald-50/50 border border-emerald-100 px-4 py-2 rounded-2xl mx-auto mb-4 text-left shadow-sm">
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <p className="text-[10px] sm:text-[10.5px] font-semibold text-emerald-950 leading-normal">
                <strong>Project Live Mode Active:</strong> Secured production checkouts are active. Dynamic testing backdoors and simulation bypasses are strictly locked down.
              </p>
            </div>
          )}
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950">
            A Plan for Every Level of Consistency
          </h1>
          <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium leading-relaxed max-w-lg mx-auto">
            Elevate your strategy, sync broker feeds, replay trading history, and enter competitions to grow your performance.
          </p>

          {/* Controls Panel: Toggle & Currency Dropdown */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-5 pb-2">
            {/* Billing Cycle Toggle */}
            <div className="flex items-center gap-3 select-none bg-slate-100 p-1.5 rounded-full border border-slate-200">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`text-[9.5px] font-black uppercase tracking-wider px-3 py-1 rounded-full transition-all cursor-pointer ${billingCycle === 'monthly' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-850'}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`text-[9.5px] font-black uppercase tracking-wider px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${billingCycle === 'yearly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-850'}`}
              >
                Yearly
                <span className="bg-indigo-50 text-indigo-700 text-[7px] font-black px-1 rounded uppercase tracking-tight">Save 16%</span>
              </button>
            </div>

            {/* Auto-detected Currency Badge */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-2xl shadow-sm">
              <Globe size={13} className="text-[#3bca84]" />
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Billing Country:</span>
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-tight">{userCountry}</span>
              <span className="mx-1 text-slate-300">|</span>
              <span className="text-[11px] font-extrabold text-indigo-600 bg-indigo-55/10 px-2 py-0.5 rounded uppercase tracking-wider">{preferredCurrency} ({symbol})</span>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {planCards.map((plan) => {
            const PlanIcon = plan.icon;
            return (
              <div 
                key={plan.id}
                className={`flex flex-col rounded-3xl border overflow-hidden transition-all duration-300 bg-white relative ${
                  plan.isCurrent ? 'ring-4 ring-emerald-550 shadow-2xl scale-[1.01]' : 'hover:shadow-2xl hover:scale-[1.01]'
                } ${plan.color}`}
              >
                {/* Badge if exists */}
                {plan.badge && (
                  <div className={`absolute top-3.5 right-4 z-10 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-md ${
                    plan.id === 'premium' ? 'bg-indigo-900 text-amber-300 border border-indigo-700' : 'bg-white text-indigo-700 border border-indigo-200'
                  }`}>
                    {plan.badge}
                  </div>
                )}

                {/* Card Title Header */}
                <div className={`p-6 border-b border-slate-100 ${plan.headerBg} relative`}>
                  <div className="flex items-center gap-2 mb-2">
                    <PlanIcon size={18} className={plan.iconColor} />
                    <span className="text-sm font-black uppercase tracking-wider">{plan.name}</span>
                  </div>
                  
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl font-black tracking-tight">{plan.price}</span>
                    <span className={`text-[10px] uppercase font-bold ${(plan.id === 'plus' || plan.id === 'premium') ? 'text-indigo-200' : 'text-slate-400'}`}>/ {plan.period}</span>
                  </div>
                  {plan.billedText && (
                    <div className={`mt-0.5 text-[8.5px] font-black uppercase tracking-wider ${plan.id === 'premium' ? 'text-amber-300' : 'text-yellow-200'}`}>
                      {plan.billedText}
                    </div>
                  )}
                  {plan.id !== 'basic' && preferredCurrency !== 'USD' && (
                    <div className={`mt-1 text-[8px] font-semibold uppercase tracking-wider ${(plan.id === 'plus' || plan.id === 'premium') ? 'text-indigo-200/80' : 'text-slate-400'}`}>
                      Rate: 1 USD = {fxRate} {preferredCurrency}
                    </div>
                  )}
                  <p className={`text-[10px] font-semibold mt-2.5 leading-relaxed ${(plan.id === 'plus' || plan.id === 'premium') ? 'text-indigo-100/90' : 'text-slate-500'}`}>
                    {plan.description}
                  </p>
                </div>

                {/* Feature List */}
                <div className="p-6 flex-grow space-y-3.5 bg-white">
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex gap-2.5 items-start text-[10.5px]">
                      {feat.included ? (
                        <Check size={13} className="text-indigo-600 stroke-[3] mt-0.5 shrink-0" />
                      ) : (
                        <X size={13} className="text-slate-300 stroke-[2.5] mt-0.5 shrink-0" />
                      )}
                      <span className={`font-semibold ${feat.included ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                        {feat.text}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Pricing CTA */}
                <div className="p-6 pt-0 bg-white">
                  <button
                    disabled={plan.isCurrent || (hasActiveUpgrade && !plan.isCurrent)}
                    onClick={() => handleCheckoutCtaClick(plan)}
                    className={`w-full py-3.5 rounded-2xl text-[9.5px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                      plan.isCurrent
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 cursor-not-allowed'
                        : (hasActiveUpgrade && !plan.isCurrent)
                          ? 'bg-slate-50 border border-slate-200 text-slate-400 cursor-not-allowed'
                          : plan.id === 'plus'
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl hover:shadow-indigo-100 cursor-pointer active:scale-[0.98]'
                            : plan.id === 'premium'
                              ? 'bg-indigo-950 text-white hover:bg-slate-900 shadow-xl hover:shadow-indigo-200 cursor-pointer active:scale-[0.98]'
                              : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100 cursor-pointer active:scale-[0.98]'
                    }`}
                  >
                    {plan.isCurrent && <CheckCircle2 size={12} className="stroke-[3]" />}
                    {(!plan.isCurrent && hasActiveUpgrade) && <Lock size={11} />}
                    {plan.isCurrent 
                      ? 'Current Active Tier' 
                      : (hasActiveUpgrade && !plan.isCurrent)
                        ? 'Plan Deactivated'
                        : plan.ctaText
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>



        {/* PREMIUM UNIQUE: MULTI-USER/TEAM MANAGEMENT WORKSPACE */}
        {currentPlan === 'premium' && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border-2 border-slate-950 rounded-3xl p-6 shadow-xl space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-950 text-white rounded-2xl flex items-center justify-center border border-slate-850">
                  <Users size={18} className="text-yellow-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">Multi-User Seat Management</h3>
                    <span className="px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-white text-[7px] font-black uppercase tracking-widest rounded-full">
                      Premium Activated
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manage team members, analysts, and copilot bots sharing credentials</p>
                </div>
              </div>
            </div>

            {successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] font-bold rounded-xl flex items-center gap-2 animate-fade-in uppercase">
                <Check size={14} className="stroke-[3]" />
                {successMessage}
              </div>
            )}

            {/* Invite Seat Form */}
            <form onSubmit={handleAddMember} className="bg-slate-50 p-4 border border-slate-100 rounded-2xl grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-6 space-y-1.5">
                <label className="text-[8.5px] font-black uppercase tracking-widest text-slate-400">Team Member Email Address</label>
                <input 
                  type="email"
                  required
                  placeholder="analyst@yourbroker.com"
                  value={invitedEmail}
                  onChange={e => setInvitedEmail(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500"
                />
              </div>

              <div className="sm:col-span-3 space-y-1.5">
                <label className="text-[8.5px] font-black uppercase tracking-widest text-slate-400">Seat Role / Classification</label>
                <select 
                  value={invitedRole}
                  onChange={e => setInvitedRole(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500"
                >
                  <option value="Trader">Trader</option>
                  <option value="Senior Trader">Senior Trader</option>
                  <option value="Analyst">Analyst</option>
                  <option value="Copilot Bot">Copilot Bot</option>
                  <option value="Risk Manager">Risk Manager</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  className="w-full bg-slate-950 text-white hover:bg-slate-850 rounded-xl py-2 text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                >
                  <UserPlus size={12} />
                  Add To Seat
                </button>
              </div>
            </form>

            {/* Invitees lists */}
            <div className="space-y-2">
              <span className="text-[8.5px] font-black uppercase tracking-widest text-slate-400">Active Authorized Seats ({teamMembers.length} seats filled, 10 slots maximum)</span>
              {teamMembers.length > 0 ? (
                <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                  {teamMembers.map(member => (
                    <div key={member.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white hover:bg-slate-50/55 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-100 font-bold text-[11px] text-slate-600 shrink-0">
                          {member.email[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{member.email}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 text-[6.5px] font-black uppercase rounded">
                              {member.role}
                            </span>
                            <span className="text-[7.5px] font-semibold text-slate-400 uppercase tracking-wider">Joined {member.joinedAt}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 self-end sm:self-auto shrink-0 select-none">
                        <div className="text-right">
                          <div className="text-[11px] font-black text-slate-900">{member.winRate}%</div>
                          <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest">Shared Winrate</span>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] font-black text-indigo-600">{member.tradesCount}</div>
                          <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest">Trades</span>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer active:scale-90"
                          title="Revoke seat authorization"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 border border-dashed border-slate-200 text-center rounded-2xl bg-slate-50/40">
                  <p className="text-[10px] uppercase font-bold text-slate-400 italic">No assigned team seats. Invite your squad to join!</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* FAQ ACCORDION SECTION */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <HelpCircle size={15} className="text-indigo-600 animate-pulse" />
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Frequently Asked Questions</h3>
                <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest mt-1">Resolve setup or billing queries instantly</p>
              </div>
            </div>
            {/* Realtime Search Query Box */}
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-450" size={13} />
              <input 
                type="text" 
                placeholder="Search queries (e.g. watchlist, PWA, sandbox)..." 
                value={faqSearchQuery}
                onChange={e => {
                  setFaqSearchQuery(e.target.value);
                  setOpenFaqKey(null); // reset active expanded items to avoid mismatched indexes
                }}
                className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl pl-9 pr-12 py-2.5 text-[11px] font-semibold text-slate-850 placeholder:text-slate-400/80 focus:outline-none focus:ring-4 focus:ring-indigo-55/50 focus:border-indigo-500 transition-all font-sans"
              />
              {faqSearchQuery && (
                <button 
                  type="button"
                  onClick={() => setFaqSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-600 hover:text-indigo-800 text-[9px] font-black uppercase tracking-wider transition-colors px-1 py-1"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Interactive Category Tabs */}
          <div className="flex flex-wrap gap-2 select-none">
            {[
              { id: 'all', label: 'All FAQs', count: faqs.length },
              { id: 'billing', label: 'Billing & Sandbox', count: faqs.filter(f => f.category === 'billing').length },
              { id: 'limits', label: 'Limits & Slots', count: faqs.filter(f => f.category === 'limits').length },
              { id: 'charting', label: 'Charting & Spreads', count: faqs.filter(f => f.category === 'charting').length },
              { id: 'performance', label: 'Performance & App Guide', count: faqs.filter(f => f.category === 'performance').length },
            ].map(tab => {
              const isActive = faqSelectedCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setFaqSelectedCategory(tab.id as any);
                    setOpenFaqKey(null);
                  }}
                  className={`text-[9.5px] font-black uppercase tracking-wider px-3.5 py-2.5 rounded-2xl transition-all flex items-center gap-1.5 cursor-pointer border ${
                    isActive 
                      ? 'bg-indigo-650 border-indigo-650 text-white shadow-xl shadow-indigo-100' 
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/80 hover:text-slate-850'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[7.5px] font-black px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-indigo-700/60 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>{tab.count}</span>
                </button>
              );
            })}
          </div>

          {/* FAQ Accordion Lists */}
          <div className="space-y-3">
            {(() => {
              const filtered = faqs.filter(faq => {
                const matchesCategory = faqSelectedCategory === 'all' || faq.category === faqSelectedCategory;
                const matchesSearch = faq.q.toLowerCase().includes(faqSearchQuery.toLowerCase()) || 
                                      faq.a.toLowerCase().includes(faqSearchQuery.toLowerCase());
                return matchesCategory && matchesSearch;
              });

              if (filtered.length === 0) {
                return (
                  <div className="py-12 border border-dashed border-slate-200 text-center rounded-2xl bg-slate-50/40 space-y-2">
                    <HelpCircle size={22} className="mx-auto text-slate-350 opacity-40 animate-bounce" />
                    <p className="text-[10.5px] uppercase font-bold text-slate-400 tracking-wider">No matching queries found</p>
                    <p className="text-[10px] text-slate-400 font-semibold leading-normal">
                      Try checking another category filter above or search keywords like "watchlist", "spreads" or "sandbox".
                    </p>
                  </div>
                );
              }

              return filtered.map((faq, index) => {
                const isOpen = openFaqKey === faq.q;
                return (
                  <div 
                    key={faq.q}
                    className={`border rounded-2xl overflow-hidden transition-all duration-300 ${
                      isOpen 
                        ? 'border-indigo-200 bg-indigo-50/10 shadow-sm' 
                        : 'border-slate-100 bg-slate-100/5 hover:border-slate-200 hover:bg-slate-50/20'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqKey(isOpen ? null : faq.q)}
                      className="w-full flex items-center justify-between p-4 text-left cursor-pointer transition-colors focus:outline-none"
                    >
                      <div className="flex gap-2.5 items-start">
                        <span className={`px-2 py-0.5 mt-0.5 text-[7px] font-black uppercase rounded tracking-wider select-none shrink-0 ${
                          faq.category === 'billing' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/50' :
                          faq.category === 'limits' ? 'bg-amber-50 text-amber-800 border border-amber-200/50' :
                          faq.category === 'charting' ? 'bg-indigo-50 text-indigo-850 border border-indigo-200/50' :
                          'bg-slate-100 text-slate-650 border border-slate-200/50'
                        }`}>
                          {faq.category}
                        </span>
                        <span className={`text-[11px] leading-snug transition-colors ${
                          isOpen ? 'text-indigo-950 font-black' : 'text-slate-900 font-bold'
                        }`}>{faq.q}</span>
                      </div>
                      <div className={`shrink-0 ml-4 text-slate-400 transition-transform duration-350 ${
                        isOpen ? 'rotate-180 text-indigo-650' : ''
                      }`}>
                        <ChevronDown size={13} />
                      </div>
                    </button>
                    <motion.div
                      initial={false}
                      animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-4 pt-1 text-[10.5px] text-slate-500 font-semibold leading-relaxed border-t border-slate-105/10 whitespace-pre-line select-text">
                        {faq.a}
                      </div>
                    </motion.div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* PERSONAL TRANSACTION HISTORY SECTION */}
        <div id="personal-transaction-history" className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 animate-fade-in">
          <div 
            onClick={() => setIsHistoryCollapsed(!isHistoryCollapsed)}
            className="flex flex-row items-center justify-between gap-3 cursor-pointer select-none border-b border-slate-100 pb-3"
          >
            <div className="flex items-center gap-2">
              <CreditCard size={15} className="text-[#3bca84]" />
              <h3 className="text-xs font-black uppercase tracking-widest text-[#011b33]">Your Transaction & Invoice History</h3>
              {paymentHistory.length > 0 && (
                <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">
                  {paymentHistory.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fetchPaymentHistory();
                }}
                disabled={loadingHistory}
                className="text-[9px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {loadingHistory ? (
                  <>
                    <Loader2 size={10} className="animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  "Refresh History"
                )}
              </button>
              <div className={`text-slate-400 transition-transform duration-200 ${!isHistoryCollapsed ? 'rotate-180 text-indigo-650' : ''}`}>
                <ChevronDown size={14} />
              </div>
            </div>
          </div>

          <motion.div
            initial={false}
            animate={{ height: !isHistoryCollapsed ? "auto" : 0, opacity: !isHistoryCollapsed ? 1 : 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pt-2 space-y-4">
              {paymentHistory.length > 0 ? (
                <div className="space-y-4">
                  {/* Highlight card for the last paid amount */}
                  <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[8.5px] font-black uppercase tracking-widest text-[#2fb071] block">Last Payment Success</span>
                      <div className="text-lg font-black text-slate-900">
                        {paymentHistory[0].currency} {parseFloat(paymentHistory[0].amount_local).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="text-[10px] font-semibold text-slate-400 ml-1.5">
                          ({paymentHistory[0].currency === 'USD' ? '' : `~$${parseFloat(paymentHistory[0].amount_usd).toFixed(2)} `}USD)
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                        Upgraded workspace to <strong className="uppercase bg-indigo-50 text-indigo-700 px-1.5 py-0.5 border border-indigo-100/50 rounded">{paymentHistory[0].plan}</strong> via reference: <span className="font-mono text-indigo-900 bg-indigo-50/50 px-1 py-0.5 rounded text-[9.5px] font-bold select-all">{paymentHistory[0].reference}</span>
                      </div>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <div className="text-[10.5px] font-extrabold text-slate-800">
                        {new Date(paymentHistory[0].created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <span className="inline-flex px-2 py-0.5 mt-1 bg-emerald-100 text-emerald-800 border border-emerald-200/50 text-[7.5px] font-black uppercase tracking-widest rounded-lg">
                        SUCCESSFULLY BILLED
                      </span>
                    </div>
                  </div>

                  {/* Paginated / scrollable detailed history */}
                  <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="p-3 text-[8.5px] font-black uppercase tracking-widest text-slate-400">Date/Time</th>
                          <th className="p-3 text-[8.5px] font-black uppercase tracking-widest text-slate-400">Plan Purchased</th>
                          <th className="p-3 text-[8.5px] font-black uppercase tracking-widest text-slate-400">Total Billed</th>
                          <th className="p-3 text-[8.5px] font-black uppercase tracking-widest text-slate-400">Payment Reference</th>
                          <th className="p-3 text-[8.5px] font-black uppercase tracking-widest text-slate-400">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paymentHistory.map((pmt: any) => (
                          <tr key={pmt.id || pmt.reference} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 text-[10px] font-semibold text-slate-600">
                              {new Date(pmt.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[8.5px] font-black uppercase rounded">
                                {pmt.plan}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="text-[10.5px] font-bold text-slate-900">
                                {pmt.currency} {parseFloat(pmt.amount_local).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </div>
                              <span className="text-[8.5px] font-semibold text-slate-400 block">
                                (${parseFloat(pmt.amount_usd).toFixed(2)} USD)
                              </span>
                            </td>
                            <td className="p-3 text-[9.5px] font-mono text-slate-500 font-semibold select-all">
                              {pmt.reference}
                            </td>
                            <td className="p-3">
                              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/50 text-[7.5px] font-black uppercase rounded">
                                SUCCESS
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="py-8 border border-dashed border-slate-200 text-center rounded-2xl bg-slate-50/40">
                  <p className="text-[10px] uppercase font-bold text-slate-400 italic">No historical subscription payments found on your profile.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* --- SECURE RESILIENT CHECKOUT DIALOG OVERLAY --- */}
      <AnimatePresence>
        {selectedPlanDetails && !isSimulatorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlanDetails(null)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative border border-slate-100 z-10 space-y-4 sm:space-y-5 my-auto shrink-0 max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">Checkout Verification</h3>
                    <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Secure paystack transaction gateway</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedPlanDetails(null)}
                  className="p-1 px-2.5 rounded-lg text-slate-350 hover:bg-slate-50 text-xs font-black uppercase tracking-tight transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>

              {checkoutError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 text-[10.5px] font-semibold rounded-xl flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0 text-rose-600" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {/* Conversion Display Block */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-baseline border-b border-dashed border-slate-200 pb-2">
                  <span className="text-[10px] uppercase font-black text-slate-400">Total Billed Amt</span>
                  <div className="text-right">
                    <span className="text-xl font-black text-slate-900">
                      {formatPrice(selectedPlanDetails.usdAmount)}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 capitalize block mt-0.5">
                      {billingCycle} plan cycle renews
                    </span>
                  </div>
                </div>

                {/* Exchange Rates summary */}
                <div className="space-y-1.5 text-[10px] text-slate-500 font-semibold pt-0.5">
                  <div className="flex justify-between">
                    <span>Selected Plan Tier:</span>
                    <span className="font-extrabold uppercase text-indigo-600">{selectedPlanDetails.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Base Amount:</span>
                    <span className="text-slate-900 font-extrabold">${selectedPlanDetails.usdAmount.toFixed(2)} USD</span>
                  </div>
                  {preferredCurrency !== 'USD' && (
                    <>
                      <div className="flex justify-between">
                        <span>Gateway Conversion Rate:</span>
                        <span className="text-slate-950 font-extrabold">1 USD = {fxRate} {preferredCurrency}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200/50 pt-1.5 text-slate-900">
                        <span className="font-bold">Locally Settled Amount:</span>
                        <span className="font-black text-xs text-emerald-600">
                          {symbol}{(selectedPlanDetails.usdAmount * fxRate).toLocaleString(undefined, { minimumFractionDigits: 2 })} {preferredCurrency}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Recurring subscription toggle option */}
              <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center justify-between text-left">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black uppercase text-indigo-950 tracking-wider">Auto-renew monthly</span>
                  <p className="text-[8.5px] text-indigo-700 font-semibold leading-relaxed max-w-[260px]">
                    Check this option to enable monthly automatic recurrence using Paystack's Managed plans. Your card details will be securely saved.
                  </p>
                </div>
                <input 
                  type="checkbox"
                  checked={recurringToggle}
                  onChange={(e) => setRecurringToggle(e.target.checked)}
                  className="w-4 h-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
                />
              </div>

              {/* Customer billing address inputs */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[8.5px] font-black uppercase tracking-widest text-slate-400 block">Customer Account Email (Receives Paystack Receipt)</label>
                  <input 
                    type="email"
                    disabled
                    value={user?.email || 'guest@firstlook.com'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8.5px] font-black uppercase tracking-widest text-slate-400 block">Payout Origin Country (Locked)</label>
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Globe size={13} className="text-[#3bca84]" />
                    <span>{userCountry} ({preferredCurrency}) - Locked to Signup Settings</span>
                  </div>
                </div>
              </div>

              {/* Secure paystack notice */}
              <p className="text-[9px] text-slate-400 leading-relaxed text-center font-medium">
                * Note: Local African cards from Nigeria, Ghana, Kenya, and South Africa are integrated instantly with full channel compatibility. Other countries compile via international Master/Visa channels.
              </p>

              {/* Modal Call To Action */}
              <button
                type="button"
                disabled={loadingCheckout}
                onClick={handlePaystackCheckout}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-55 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingCheckout ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Connecting secure backend api...
                  </>
                ) : (
                  <>
                    <Lock size={12} className="stroke-[2.5]" />
                    Proceed with Paystack Gateway
                  </>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- PREMIUM UPGRADE BLOCKED NOTIFICATION DIALOG --- */}
      <AnimatePresence>
        {premiumFeedback !== 'idle' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (premiumFeedback === 'message') {
                  setPremiumFeedback('idle');
                }
              }}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative border border-slate-100 z-[101] space-y-5 text-center my-auto shrink-0"
            >
              {premiumFeedback === 'loading' ? (
                <div className="py-6 space-y-4 flex flex-col items-center justify-center">
                  <div className="relative flex items-center justify-center">
                    <div className="h-14 w-14 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                    <Crown size={22} className="absolute text-indigo-600 animate-pulse animate-duration-1000" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">Initializing Premium Plan Gateway</h3>
                    <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-widest mt-1">Connecting to subscription systems...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Icon Badge */}
                  <div className="mx-auto w-12 h-12 bg-amber-50 border border-amber-200 text-amber-600 rounded-full flex items-center justify-center shadow-inner">
                    <AlertCircle size={24} />
                  </div>

                  {/* Header */}
                  <div className="space-y-1">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">Premium Plan On Hold</h3>
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">Development Updates in Progress</p>
                  </div>

                  {/* Message body matching user specifications */}
                  <p className="text-[11.5px] text-slate-600 font-semibold leading-relaxed px-1 text-left sm:text-center">
                    Oops! We're sorry, you can't purchase the Premium plan right now. We are currently working on more features of the Premium plan so it is not available for now. You can pay for the Plus plan instead. We will get back to you once we're done! Thanks!
                  </p>

                  {/* CTA Buttons */}
                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPremiumFeedback('idle');
                        const plusCard = planCards.find(p => p.id === 'plus');
                        if (plusCard) {
                          handleCheckoutCtaClick(plusCard);
                        }
                      }}
                      className="w-full py-3 bg-indigo-650 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Zap size={12} />
                      Pay for Plus Plan instead
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setPremiumFeedback('idle')}
                      className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-500 text-[9.5px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer border border-slate-200"
                    >
                      Close & Back to Plans
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- PAYSTACK SECURE INTERACTIVE TESTING CHECKOUT SIMULATOR --- */}
      <AnimatePresence>
        {isSimulatorOpen && simulatorDetails && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm"
              onClick={() => setIsSimulatorOpen(false)}
            />

            {/* Simulator Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#fafbfc] rounded-2xl sm:rounded-3xl max-w-lg w-full shadow-2xl z-10 overflow-hidden border border-slate-200/90 flex flex-col md:flex-row h-auto md:h-[510px] my-auto relative shrink-0"
            >
              {/* Sidebar Channels Selector (Paystack design layout) */}
              <div className="w-full md:w-5/12 bg-[#011b33] p-4 sm:p-5 text-white flex flex-col justify-between shrink-0">
                <div className="space-y-6">
                  {/* Paystack secure badge */}
                  <div className="flex items-center gap-1.5 opacity-80">
                    <div className="w-4 h-4 rounded bg-[#3bca84]/20 flex items-center justify-center text-[#3bca84]">
                      <Lock size={9} />
                    </div>
                    <span className="text-[8px] font-bold tracking-widest text-[#3bca84] uppercase">TEST TRANSACTION BY PAYSTACK</span>
                  </div>

                  {/* Transaction metadata */}
                  <div className="space-y-3.5">
                    <div>
                      <span className="text-[8.5px] text-slate-400 block uppercase tracking-wider font-extrabold">Bill For FirstLook</span>
                      <h4 className="text-[13px] font-black truncate text-slate-100">Upgrade to {simulatorDetails.plan.toUpperCase()}</h4>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[8.5px] text-slate-400 block uppercase tracking-widest font-extrabold">Checkout Amount</span>
                      <div className="text-xl font-black text-white">
                        {simulatorDetails.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {simulatorDetails.currency}
                      </div>
                      {simulatorDetails.currency !== 'USD' && (
                        <span className="text-[8px] text-slate-400 block font-semibold leading-none">
                          Invoiced base $USD converted rate
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Left tab menus */}
                <div className="space-y-2 pt-6 border-t border-slate-800">
                  <button 
                    onClick={() => setSimulatorMethod('card')}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${simulatorMethod === 'card' ? 'bg-[#102d4d] text-white border-l-4 border-[#3bca84]' : 'text-slate-400 hover:text-white'}`}
                  >
                    <CreditCard size={12} />
                    Pay with Card
                  </button>
                  {showBankTransfer && (
                    <button 
                      onClick={() => setSimulatorMethod('bank')}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${simulatorMethod === 'bank' ? 'bg-[#102d4d] text-white border-l-4 border-[#3bca84]' : 'text-slate-400 hover:text-white'}`}
                    >
                      <Coins size={12} />
                      Bank Transfer
                    </button>
                  )}
                </div>
              </div>

              {/* Main Pay Field Workspace */}
              <div className="flex-1 p-6 flex flex-col justify-between bg-white relative">
                {simulatorStatus === 'processing' && (
                  <div className="absolute inset-0 bg-white/95 z-20 flex flex-col items-center justify-center p-4 space-y-3.5 animate-fade-in">
                    <Loader2 size={32} className="text-[#3bca84] animate-spin stroke-[3]" />
                    <div className="text-center">
                      <h4 className="text-xs font-black uppercase tracking-widest text-[#011b33]">Verifying with Processor</h4>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Authorizing local secure gateway channel...</p>
                    </div>
                  </div>
                )}

                {simulatorStatus === 'success' && (
                  <div className="absolute inset-0 bg-white z-20 flex flex-col items-center justify-center p-4 space-y-4 animate-fade-in text-center">
                    <div className="w-12 h-12 bg-emerald-50 rounded-full border border-emerald-100 flex items-center justify-center text-[#3bca84] animate-bounce">
                      <CheckCircle2 size={24} className="stroke-[2.5]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#011b33] uppercase tracking-wider">Upgrade Processed!</h4>
                      <p className="text-[9.5px] text-[#3bca84] font-black uppercase tracking-widest mt-1">Transaction Ref: {simulatorDetails.reference}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-2.5">Returning safely back to FirstLook dashboard...</p>
                    </div>
                  </div>
                )}

                {/* Close Button top-right */}
                <div className="flex justify-between items-center pb-2 border-b border-slate-100 shrink-0">
                  <span className="text-[9.5px] font-extrabold uppercase text-[#011b33] tracking-wider">{simulatorMethod} payment screen</span>
                  <button 
                    onClick={() => setIsSimulatorOpen(false)}
                    className="text-slate-400 hover:text-slate-600 text-[10px] font-bold uppercase"
                  >
                    Cancel
                  </button>
                </div>

                {/* Form content */}
                <div className="flex-1 py-4 overflow-y-auto space-y-4">
                  {/* Card Simulator Screen details */}
                  {simulatorMethod === 'card' && (
                    <div className="space-y-4">
                      {/* Interactive visual card */}
                      <div className="bg-gradient-to-tr from-[#02213d] to-[#102d4d] text-white p-4 rounded-2xl shadow-md border border-slate-800 space-y-4 relative overflow-hidden">
                        <div className="flex justify-between items-center">
                          <span className="text-[8px] font-black tracking-widest uppercase opacity-70">Secured Card</span>
                          <span className="text-xs font-black tracking-tighter text-[#3bca84]">Paystack</span>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[7.5px] font-black uppercase tracking-widest opacity-60">TEST CARD NUMBER</label>
                          <input 
                            type="text"
                            placeholder="4012  8888  8888  1881"
                            value={simulatorCard.number}
                            onChange={(e) => setSimulatorCard({ ...simulatorCard, number: e.target.value })}
                            className="bg-transparent text-sm font-bold tracking-widest focus:outline-none border-b border-slate-700/60 w-full placeholder-slate-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-[7px] font-black tracking-wider opacity-60 uppercase">CARD EXPIRY</span>
                            <input 
                              type="text"
                              placeholder="12/28"
                              value={simulatorCard.expiry}
                              onChange={(e) => setSimulatorCard({ ...simulatorCard, expiry: e.target.value })}
                              className="bg-transparent text-xs font-extrabold focus:outline-none border-b border-slate-700/60 w-full placeholder-slate-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[7px] font-black tracking-wider opacity-60 uppercase">SECURITY CODE</span>
                            <input 
                              type="text"
                              placeholder="111"
                              value={simulatorCard.cvv}
                              onChange={(e) => setSimulatorCard({ ...simulatorCard, cvv: e.target.value })}
                              className="bg-transparent text-xs font-extrabold focus:outline-none border-b border-slate-700/60 w-full placeholder-slate-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Click-to-fill Help Prompt */}
                      <div 
                        onClick={() => setSimulatorCard({ number: '4012 8888 8888 1881', expiry: '12/28', cvv: '111', pin: '1234' })}
                        className="p-2.5 bg-indigo-50/50 border border-indigo-100 hover:bg-indigo-50 rounded-xl text-[9px] text-slate-600 font-semibold cursor-pointer select-none text-center transition-all active:scale-[0.98]"
                      >
                        💡 <span className="text-indigo-600 font-bold underline">Click here</span> to autofill compliant Paystack standard test credentials.
                      </div>
                    </div>
                  )}

                  {/* Bank Transfer Simulator Screen details */}
                  {simulatorMethod === 'bank' && (
                    <div className="space-y-3 bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
                      <Coins className="mx-auto text-[#3bca84] shrink-0" size={24} />
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-black text-slate-400">Recipient Bank</span>
                        <div className="text-xs font-black text-[#011b33]">TITAN TRUST BANK (SIMULATED)</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-black text-slate-400">Account Number</span>
                        <div className="text-base font-black text-slate-900 flex items-center justify-center gap-1">
                          9938817260
                          <span className="px-1 py-0.5 bg-slate-200 text-[6.5px] font-extrabold rounded uppercase tracking-wider">Test Account</span>
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-500 font-medium">To test this simulation, simply click "Confirm Asset Transfer" below to simulate bank routing credit confirmation.</p>
                    </div>
                  )}

                  {/* USSD Transfer Simulator Screen details */}
                  {simulatorMethod === 'ussd' && (
                    <div className="space-y-4 bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
                      <Globe className="mx-auto text-indigo-600 shrink-0" size={24} />
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-black text-slate-400">Simulated Dial Code</span>
                        <div className="text-lg font-black text-[#011b33] flex items-center justify-center gap-1">
                          *737*1*9938817260#
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-500 font-medium">Dial the USSD code from your register SIM card (or simulate directly by clicking the confirmation button below) to approve the debit instructions.</p>
                    </div>
                  )}
                </div>

                {/* Footer and Submit Actions */}
                <div className="shrink-0 space-y-3">
                  {simulatorStatus === 'failed' && (
                    <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-800 text-[9px] font-bold rounded-xl flex items-center gap-1.5 uppercase">
                      <AlertCircle size={12} className="text-rose-600 shrink-0" />
                      Checkout failed. Incorrect card format pin.
                    </div>
                  )}

                  <button
                    onClick={handleSimulatorSubmit}
                    className="w-full py-3 bg-[#3bca84] hover:bg-[#2fb071] text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>Authorize Secure Payment</span>
                    <ArrowRight size={11} className="stroke-[2.5]" />
                  </button>

                  <div className="text-center">
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wide">SECURE ENCRYPTED BY PAYSTACK TRUSTED SYSTEM</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

