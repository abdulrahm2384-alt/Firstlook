import React, { useState, useEffect } from 'react';

interface RiskCalculatorProps {
  initialBalance: number;
  currentBalance: number;
  currency: string;
  accountType?: 'prop' | 'live' | 'prop-live';
  defaultDrawdownType?: DrawdownType;
  defaultDrawdownValue?: number;
  openRisk?: number;
}

type DrawdownType = 'percentage' | 'fixed' | 'trailing';

export default function RiskCalculator({ 
  initialBalance,
  currentBalance, 
  currency, 
  accountType = 'prop',
  defaultDrawdownType = 'percentage',
  defaultDrawdownValue = 10,
  openRisk = 0
}: RiskCalculatorProps) {
  const [drawdownType, setDrawdownType] = useState<DrawdownType>(defaultDrawdownType);
  const [drawdownValue, setDrawdownValue] = useState<string>(defaultDrawdownValue.toString());
  const [edd, setEdd] = useState<number>(0);

  const isLive = accountType === 'live';
  const isPropLive = accountType === 'prop-live';

  const effectiveBalance = currentBalance - openRisk;

  const propTiers = [
    { name: 'Tier 1 (10%+)', threshold: 10, riskFactor: 0.30, basePercent: 0.10, label: 'Safe' },
    { name: 'Tier 2 (6%+)', threshold: 6, riskFactor: 0.34, basePercent: 0.06, label: 'Caution' },
    { name: 'Tier 3 (3%+)', threshold: 3, riskFactor: 0.34, basePercent: 0.03, label: 'Warning' },
    { name: 'Tier 4 (<3%)', threshold: 0, riskFactor: 1, basePercent: 0.0066, label: 'Critical' },
  ];

  const liveTiers = [
    { name: 'Tier 1660+', threshold: 1660, risk: 160, label: 'Safe' },
    { name: 'Tier 880+', threshold: 880, risk: 80, label: 'Safe' },
    { name: 'Tier 440+', threshold: 440, risk: 40, label: 'Safe' },
    { name: 'Tier 220+', threshold: 220, risk: 20, label: 'Caution' },
    { name: 'Tier 110+', threshold: 110, risk: 10, label: 'Caution' },
    { name: 'Tier 15+', threshold: 15, risk: 5, label: 'Warning' },
    { name: 'Tier <15', threshold: 0, risk: 2.5, label: 'Critical' },
  ];

  const exampleAccounts = [5000, 10000, 25000, 50000, 100000, 200000, 300000, 400000, 500000, 1000000];

  useEffect(() => {
    const val = parseFloat(drawdownValue) || 0;
    let calculatedEdd = 0;

    if (drawdownType === 'percentage') {
      calculatedEdd = currentBalance * (val / 100);
    } else if (drawdownType === 'fixed') {
      calculatedEdd = val;
    } else if (drawdownType === 'trailing') {
      calculatedEdd = Math.max(0, currentBalance - val);
    }

    setEdd(calculatedEdd);
  }, [drawdownType, drawdownValue, currentBalance]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  const remainingDDAmount = (currentBalance - initialBalance) + edd - openRisk;
  const remainingDDPercent = (remainingDDAmount / initialBalance) * 100;

  const currentPropTier = propTiers.find(t => remainingDDPercent >= t.threshold) || propTiers[propTiers.length - 1];
  const currentLiveTier = liveTiers.find(t => effectiveBalance >= t.threshold) || liveTiers[liveTiers.length - 1];
  
  // Prop Live Logic
  const maxDDPercent = defaultDrawdownValue; // Using the drawdown value set for the account
  const initialDDAmount = initialBalance * (maxDDPercent / 100);
  const propLiveProfit = currentBalance - initialBalance;
  const availableBuffer = (initialDDAmount + propLiveProfit) - openRisk;
  const propLiveThreshold = initialDDAmount * 0.60;
  
  let propLiveRisk = 0;
  if (availableBuffer <= propLiveThreshold) {
    // Risk 6% of the initial drawdown amount
    propLiveRisk = initialDDAmount * 0.06;
  } else {
    // Risk 10% of the available buffer (drawdown + profit)
    propLiveRisk = availableBuffer * 0.10;
  }

  const recommendedRisk = isLive 
    ? currentLiveTier.risk 
    : isPropLive
    ? propLiveRisk
    : currentPropTier.riskFactor * (currentPropTier.basePercent * initialBalance);

  return (
    <div className="space-y-8 font-serif">
      {!isLive && !isPropLive && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-black p-4 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold uppercase">Risk Parameters</h3>
              <p className="text-[9px] opacity-50 uppercase">Configure your prop firm drawdown rules</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] uppercase block">Drawdown Type</label>
                <select 
                  value={drawdownType} 
                  onChange={(e) => setDrawdownType(e.target.value as DrawdownType)}
                  className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none bg-white"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount</option>
                  <option value="trailing">Trailing Level</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase block">
                  {drawdownType === 'percentage' ? 'Drawdown Percentage (%)' : 
                   drawdownType === 'fixed' ? 'Total Drawdown Amount' : 'Trailing Stop Level'}
                </label>
                <input 
                  type="number" 
                  value={drawdownValue} 
                  onChange={(e) => setDrawdownValue(e.target.value)}
                  className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none"
                  placeholder={drawdownType === 'percentage' ? '10' : '1000'}
                />
              </div>

              <div className="pt-2 border-t border-black/10 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] uppercase opacity-50">Effective Drawdown (EDD)</span>
                  <span className="text-sm font-bold">{formatCurrency(edd)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] uppercase opacity-50">Remaining Margin</span>
                  <span className={`text-sm font-bold ${remainingDDAmount < 0 ? 'text-red-600' : ''}`}>
                    {formatCurrency(remainingDDAmount)} ({remainingDDPercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-black p-4 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold uppercase">Current Recommendation</h3>
              <p className="text-[9px] opacity-50 uppercase">Based on your current remaining margin</p>
            </div>
            <div className="bg-black text-white p-4 border border-black space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase opacity-70">Suggested Risk</span>
                <span className="text-lg font-bold">{formatCurrency(recommendedRisk)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase opacity-70">Active Tier</span>
                <span className="text-[10px] border border-white px-1 uppercase">{currentPropTier.name}</span>
              </div>
              <p className="text-[8px] opacity-50 uppercase pt-2">
                Risk is calculated as {currentPropTier.riskFactor * 100}% of {currentPropTier.basePercent * 100}% of initial balance
              </p>
            </div>
          </div>
        </div>
      )}

      {isLive && (
        <div className="border border-black p-4 space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold uppercase">Live Risk Recommendation</h3>
            <p className="text-[9px] opacity-50 uppercase">
              Balance: {formatCurrency(currentBalance)} 
              {openRisk > 0 && ` • Open Risk: ${formatCurrency(openRisk)}`}
              {openRisk > 0 && ` • Effective: ${formatCurrency(effectiveBalance)}`}
            </p>
          </div>
          <div className="bg-black text-white p-4 border border-black space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase opacity-70">Suggested Risk</span>
              <span className="text-lg font-bold">{formatCurrency(recommendedRisk)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase opacity-70">Active Tier</span>
              <span className="text-[10px] border border-white px-1 uppercase">{currentLiveTier.name}</span>
            </div>
            <p className="text-[8px] opacity-50 uppercase pt-2">
              Step-based scaling model: Risk increases only when balance reaches a new tier.
            </p>
          </div>
        </div>
      )}

      {isPropLive && (
        <div className="border border-black p-4 space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold uppercase">Prop Live Risk Recommendation</h3>
            <p className="text-[9px] opacity-50 uppercase">
              Buffer: {formatCurrency(initialDDAmount + propLiveProfit)}
              {openRisk > 0 && ` • Open Risk: ${formatCurrency(openRisk)}`}
              {openRisk > 0 && ` • Effective: ${formatCurrency(availableBuffer)}`}
            </p>
          </div>
          <div className="bg-black text-white p-4 border border-black space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase opacity-70">Suggested Risk</span>
              <span className="text-lg font-bold">{formatCurrency(recommendedRisk)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase opacity-70">Strategy</span>
              <span className="text-[10px] border border-white px-1 uppercase">Buffer-Based Scaling</span>
            </div>
            <div className="pt-2 border-t border-white/10 space-y-1">
              <div className="flex justify-between text-[8px] uppercase opacity-50">
                <span>Initial Drawdown ({maxDDPercent}%)</span>
                <span>{formatCurrency(initialDDAmount)}</span>
              </div>
              <div className="flex justify-between text-[8px] uppercase opacity-50">
                <span>Current Profit/Loss</span>
                <span>{formatCurrency(propLiveProfit)}</span>
              </div>
              <div className="flex justify-between text-[8px] uppercase opacity-50">
                <span>Threshold (60% of DD)</span>
                <span>{formatCurrency(propLiveThreshold)}</span>
              </div>
            </div>
            <p className="text-[8px] opacity-50 uppercase pt-2">
              {availableBuffer <= propLiveThreshold 
                ? `Buffer (${formatCurrency(availableBuffer)}) is below 60% threshold. Risking 6% of initial drawdown.`
                : `Buffer (${formatCurrency(availableBuffer)}) is above threshold. Risking 10% of total available buffer.`}
            </p>
          </div>
        </div>
      )}

      {!isPropLive && (
        <div className="border border-black overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#efefef] border-b border-black">
                <th className="text-[9px] uppercase p-2 font-bold">Risk Tier</th>
                {!isLive && <th className="text-[9px] uppercase p-2 font-bold">Calculation</th>}
                <th className="text-[9px] uppercase p-2 font-bold">Risk Per Trade</th>
                <th className="text-[9px] uppercase p-2 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {(isLive ? liveTiers : propTiers).map((tier: any) => {
                const riskAmount = isLive ? tier.risk : tier.riskFactor * (tier.basePercent * initialBalance);
                const isActive = isLive ? currentLiveTier.name === tier.name : currentPropTier.name === tier.name;
                return (
                  <tr key={tier.name} className={`border-b border-black/10 transition-colors ${isActive ? 'bg-black/5 font-bold' : 'hover:bg-[#f9f9f9]'}`}>
                    <td className="p-2">
                      <span className="text-[9px] border border-black px-1 uppercase">
                        {tier.name}
                      </span>
                    </td>
                    {!isLive && (
                      <td className="p-2 text-[10px] opacity-60">
                        {tier.riskFactor} × {(tier.basePercent * 100).toFixed(2)}% of Initial
                      </td>
                    )}
                    <td className="p-2 text-[10px]">
                      {formatCurrency(riskAmount)}
                    </td>
                    <td className="p-2">
                      <span className={`text-[9px] uppercase px-1 border ${
                        tier.label === 'Safe' ? 'border-green-600 text-green-600' : 
                        tier.label === 'Caution' ? 'border-yellow-600 text-yellow-600' : 
                        'border-red-600 text-red-600'
                      }`}>
                        {tier.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isLive && !isPropLive && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold uppercase">Dynamic Scaling Reference</h3>
            <p className="text-[9px] opacity-50 uppercase">How this strategy scales across different account sizes</p>
          </div>
          <div className="border border-black overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#efefef] border-b border-black">
                  <th className="text-[9px] uppercase p-2 font-bold">Account Size</th>
                  <th className="text-[9px] uppercase p-2 font-bold">Tier 1 (3%)</th>
                  <th className="text-[9px] uppercase p-2 font-bold">Tier 2 (2.04%)</th>
                  <th className="text-[9px] uppercase p-2 font-bold">Tier 3 (1.02%)</th>
                  <th className="text-[9px] uppercase p-2 font-bold">Tier 4 (0.66%)</th>
                </tr>
              </thead>
              <tbody>
                {exampleAccounts.map((size) => (
                  <tr key={size} className="border-b border-black/10 hover:bg-[#f9f9f9] transition-colors">
                    <td className="p-2 text-[10px] font-bold">{formatCurrency(size)}</td>
                    <td className="p-2 text-[10px]">{formatCurrency(size * 0.03)}</td>
                    <td className="p-2 text-[10px]">{formatCurrency(size * 0.0204)}</td>
                    <td className="p-2 text-[10px]">{formatCurrency(size * 0.0102)}</td>
                    <td className="p-2 text-[10px] font-bold text-red-600">{formatCurrency(size * 0.0066)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
