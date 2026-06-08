import React, { useState } from 'react';
import { AccountType } from '@/src/types';

interface AddAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (account: any) => void;
}

export default function AddAccountDialog({ isOpen, onClose, onAdd }: AddAccountDialogProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('prop');
  const [propType, setPropType] = useState<'1-phase' | '2-phase'>('2-phase');
  const [phase, setPhase] = useState('1');
  const [initialBalance, setInitialBalance] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Custom prop parameters
  const [maxDrawdown, setMaxDrawdown] = useState('10');
  const [dailyDrawdown, setDailyDrawdown] = useState('4');
  const [profitTarget, setProfitTarget] = useState('10');
  const [drawdownType, setDrawdownType] = useState<'percentage' | 'fixed' | 'trailing'>('percentage');
  const [drawdownValue, setDrawdownValue] = useState('10');
  const [liveTargetAmount, setLiveTargetAmount] = useState('');

  if (!isOpen) return null;

  // Update defaults when propType or phase changes
  const handlePropTypeChange = (val: '1-phase' | '2-phase') => {
    setPropType(val);
    if (val === '1-phase') {
      setMaxDrawdown('6');
      setDrawdownValue('6');
      setDailyDrawdown('4');
      setProfitTarget('10');
    } else {
      // 2-phase defaults
      setMaxDrawdown('10');
      setDrawdownValue('10');
      setDailyDrawdown('4');
      setProfitTarget(phase === '1' ? '10' : '5');
    }
  };

  const handlePhaseChange = (val: string) => {
    setPhase(val);
    if (propType === '2-phase') {
      setProfitTarget(val === '1' ? '10' : '5');
    }
  };

  const handleInitialBalanceChange = (val: string) => {
    setInitialBalance(val);
    // Sync current balance if it hasn't been manually edited or is empty
    if (!currentBalance || currentBalance === initialBalance) {
      setCurrentBalance(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validation
    const parsedInitial = parseFloat(initialBalance);
    const parsedCurrent = parseFloat(currentBalance || initialBalance);
    
    if (isNaN(parsedInitial)) {
      setError("Please enter a valid initial balance");
      return;
    }

    setIsSubmitting(true);
    
    const safeParse = (val: string) => {
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    };

    try {
      await onAdd({
        name,
        type,
        propType: type === 'prop' ? propType : null,
        phase: type === 'prop' ? parseInt(phase) : null,
        maxDrawdown: type === 'prop' ? safeParse(maxDrawdown) : null,
        dailyDrawdown: type === 'prop' ? safeParse(dailyDrawdown) : null,
        profitTarget: type === 'prop' ? safeParse(profitTarget) : null,
        drawdownType,
        drawdownValue: safeParse(drawdownValue) || 0,
        liveTargetAmount: type === 'live' ? safeParse(liveTargetAmount) : null,
        initialBalance: parsedInitial,
        currentBalance: parsedCurrent,
        currency,
        status: 'active',
        createdAt: new Date().toISOString()
      });
      onClose();
      setName('');
      setType('prop');
      setPhase('1');
      setInitialBalance('');
      setCurrentBalance('');
    } catch (err: any) {
      console.error("Submit error:", err);
      setError(err.message || "Failed to create account. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-sm flex items-center justify-center p-4 font-serif">
      <div className="w-full max-w-[400px] bg-white border border-black p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="space-y-1">
          <h2 className="text-sm font-bold uppercase">New Account</h2>
          <p className="text-[9px] opacity-50 uppercase">Create a new trading account to track</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 border border-red-600 bg-red-50 text-red-600 text-[10px] uppercase font-bold">
              {error}
            </div>
          )}
          <div className="space-y-1">
            <label htmlFor="name" className="text-[9px] uppercase block">Account Name</label>
            <input 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g. My Prop Challenge" 
              required 
              className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none" 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="type" className="text-[9px] uppercase block">Type</label>
              <select 
                value={type} 
                onChange={(e) => setType(e.target.value as AccountType)}
                className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none bg-white"
              >
                <option value="prop">Prop Firm</option>
                <option value="live">Live Account</option>
                <option value="prop-live">Prop Live</option>
              </select>
            </div>
            
            {(type === 'prop' || type === 'prop-live') && (
              <div className="space-y-1">
                <label htmlFor="propType" className="text-[9px] uppercase block">Prop Type</label>
                <select 
                  value={propType} 
                  onChange={(e) => handlePropTypeChange(e.target.value as '1-phase' | '2-phase')}
                  className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none bg-white"
                >
                  <option value="1-phase">1-Phase</option>
                  <option value="2-phase">2-Phase</option>
                </select>
              </div>
            )}
          </div>

          {type === 'prop' && propType === '2-phase' && (
            <div className="space-y-1">
              <label htmlFor="phase" className="text-[9px] uppercase block">Current Phase</label>
              <select 
                value={phase} 
                onChange={(e) => handlePhaseChange(e.target.value)}
                className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none bg-white"
              >
                <option value="1">Phase 1</option>
                <option value="2">Phase 2</option>
              </select>
            </div>
          )}

          {(type === 'prop' || type === 'prop-live') && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-3 border border-black bg-[#f9f9f9]">
                <div className="space-y-1">
                  <label className="text-[8px] uppercase block">Drawdown Type</label>
                  <select 
                    value={drawdownType} 
                    onChange={(e) => setDrawdownType(e.target.value as any)}
                    className="w-full border border-black px-1 py-0.5 text-[10px] focus:outline-none bg-white"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount</option>
                    <option value="trailing">Trailing Level</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] uppercase block">Drawdown Value</label>
                  <input 
                    type="number" 
                    value={drawdownValue} 
                    onChange={(e) => setDrawdownValue(e.target.value)}
                    className="w-full border border-black px-1 py-0.5 text-[10px] focus:outline-none" 
                    placeholder={drawdownType === 'percentage' ? '10' : '1000'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 border border-black bg-[#f9f9f9]">
                <div className="space-y-1">
                  <label className="text-[8px] uppercase block">Daily DD %</label>
                  <input 
                    type="number" 
                    value={dailyDrawdown} 
                    onChange={(e) => setDailyDrawdown(e.target.value)}
                    className="w-full border border-black px-1 py-0.5 text-[10px] focus:outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] uppercase block">Target %</label>
                  <input 
                    type="number" 
                    value={profitTarget} 
                    onChange={(e) => setProfitTarget(e.target.value)}
                    className="w-full border border-black px-1 py-0.5 text-[10px] focus:outline-none" 
                  />
                </div>
              </div>
            </div>
          )}

          {type === 'live' && (
            <div className="space-y-1">
              <label htmlFor="liveTarget" className="text-[9px] uppercase block">Target Amount ({currency})</label>
              <input 
                id="liveTarget" 
                type="number" 
                value={liveTargetAmount} 
                onChange={(e) => setLiveTargetAmount(e.target.value)} 
                placeholder="e.g. 5000" 
                className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none" 
              />
              <p className="text-[7px] opacity-40 uppercase">Optional: Set a profit target for this live account</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="balance" className="text-[9px] uppercase block">Initial Balance</label>
              <input 
                id="balance" 
                type="number" 
                value={initialBalance} 
                onChange={(e) => handleInitialBalanceChange(e.target.value)} 
                placeholder="10000" 
                required 
                className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none" 
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="currentBalance" className="text-[9px] uppercase block">Current Balance</label>
              <input 
                id="currentBalance" 
                type="number" 
                value={currentBalance} 
                onChange={(e) => setCurrentBalance(e.target.value)} 
                placeholder="10000" 
                required 
                className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none bg-[#f9f9f9]" 
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="currency" className="text-[9px] uppercase block">Currency</label>
            <select 
              value={currency} 
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none bg-white"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="JPY">JPY</option>
            </select>
          </div>

          <div className="pt-4 flex gap-2">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 border border-black px-4 py-1 text-[10px] uppercase hover:bg-[#efefef] transition-colors"
            >
              cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="flex-1 border border-black bg-black text-white px-4 py-1 text-[10px] uppercase hover:bg-black/80 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'creating...' : 'create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
