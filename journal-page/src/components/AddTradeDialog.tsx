import React, { useState, useRef, useEffect } from 'react';
import { Account, Trade } from '../types';
import ImageCropper from './ImageCropper';
import { calculatePipValue, isIndexOrCrypto, isCommodity } from '../services/forexService';

interface AddTradeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (trade: any) => void;
  account: Account;
  trades: Trade[];
}

export default function AddTradeDialog({ isOpen, onClose, onAdd, account, trades }: AddTradeDialogProps) {
  const [selectedPair, setSelectedPair] = useState('EURUSD');
  const [customPair, setCustomPair] = useState('');
  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [lotSize, setLotSize] = useState<number | null>(null);
  const [actualRisk, setActualRisk] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  
  const [imageUrl, setImageUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [analysisBy, setAnalysisBy] = useState('None');
  const [customAnalysisBy, setCustomAnalysisBy] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentPair = selectedPair === 'CUSTOM' ? customPair : selectedPair;

  // Check if already traded today (Prop Rule)
  const today = new Date().toLocaleDateString();
  const hasTradedToday = account?.type === 'prop' && trades ? trades.some(t => new Date(t.createdAt).toLocaleDateString() === today) : false;

  // Calculate Effective Drawdown (EDD) and Risk Amount based on Account Type
  const riskCalculation = React.useMemo(() => {
    if (!account) return { edd: 0, risk: 0, remainingDDPercent: 0, remainingDDAmount: 0, openRisk: 0 };
    
    const initialBalance = account.initialBalance;
    const currentBalance = account.currentBalance;

    // Calculate total risk of currently open trades
    const openTrades = trades?.filter(t => t.status === 'open') || [];
    const openRiskTotal = openTrades.reduce((sum, t) => sum + (t.riskAmount || 0), 0);

    // LIVE ACCOUNT CALCULATION
    if (account.type === 'live') {
      // Deduct open risk from current balance for tier calculation
      const effectiveBalance = currentBalance - openRiskTotal;
      let risk = 2.5;
      if (effectiveBalance >= 1660) risk = 160;
      else if (effectiveBalance >= 880) risk = 80;
      else if (effectiveBalance >= 440) risk = 40;
      else if (effectiveBalance >= 220) risk = 20;
      else if (effectiveBalance >= 110) risk = 10;
      else if (effectiveBalance >= 15) risk = 5;
      else risk = 2.5;
      
      return { edd: 0, risk, remainingDDPercent: 0, remainingDDAmount: effectiveBalance, openRisk: openRiskTotal };
    }
    
    // PROP LIVE ACCOUNT CALCULATION
    if (account.type === 'prop-live') {
      const maxDDPercent = account.maxDrawdown || 10;
      const initialDDAmount = initialBalance * (maxDDPercent / 100);
      const profit = currentBalance - initialBalance;
      // Deduct open risk from available buffer
      const availableBuffer = (initialDDAmount + profit) - openRiskTotal;
      const threshold = initialDDAmount * 0.60;
      
      let risk = 0;
      if (availableBuffer <= threshold) {
        risk = initialDDAmount * 0.06;
      } else {
        risk = availableBuffer * 0.10;
      }
      return { edd: 0, risk, remainingDDPercent: 0, remainingDDAmount: availableBuffer, openRisk: openRiskTotal };
    }
    
    // PROP ACCOUNT CALCULATION (Existing Logic)
    const maxDDPercent = account.maxDrawdown || 10;
    
    // 1. Calculate Initial Drawdown Amount (EDD)
    const edd = initialBalance * (maxDDPercent / 100);
    
    // 2. Calculate Amount Remaining in Drawdown (Deducting open risk)
    const remainingDDAmount = (currentBalance - initialBalance) + edd - openRiskTotal;
    const remainingDDPercent = (remainingDDAmount / initialBalance) * 100;

    // 3. Determine Risk based on Tiers
    let risk = 0;
    if (remainingDDPercent >= 10) {
      risk = 0.30 * (0.10 * initialBalance);
    } else if (remainingDDPercent >= 6) {
      risk = 0.34 * (0.06 * initialBalance);
    } else if (remainingDDPercent >= 3) {
      risk = 0.34 * (0.03 * initialBalance);
    } else {
      risk = 0.0066 * initialBalance;
    }
    
    return { edd, risk, remainingDDPercent, remainingDDAmount, openRisk: openRiskTotal };
  }, [account, trades]);

  const riskAmount = Math.round(riskCalculation.risk * 100) / 100;
  const eddAmount = riskCalculation.edd;
  const remainingDDPercent = riskCalculation.remainingDDPercent;
  const openRiskTotal = riskCalculation.openRisk;

  // Lot Size and Actual Risk Calculation Logic
  useEffect(() => {
    const calculateLots = async () => {
      if (!isOpen || !account || !entryPrice || !stopLoss || !currentPair) {
        setLotSize(null);
        setActualRisk(null);
        setWarning(null);
        return;
      }

      const entry = parseFloat(entryPrice);
      const sl = parseFloat(stopLoss);
      const targetRisk = riskAmount;
      
      if (isNaN(entry) || isNaN(sl)) {
        setLotSize(null);
        setActualRisk(null);
        return;
      }

      if (targetRisk <= 0) {
        setLotSize(null);
        setActualRisk(null);
        setWarning("Risk amount must be greater than 0.");
        return;
      }

      const diff = Math.abs(entry - sl);
      if (diff === 0) {
        setLotSize(null);
        setActualRisk(null);
        setWarning("Entry and SL cannot be the same");
        return;
      }

      let calculatedLots = 0;
      const pairUpper = currentPair.toUpperCase();

      // Determine Asset Class and Contract Size
      if (isCommodity(pairUpper)) {
        if (pairUpper.includes('XAU') || pairUpper.includes('GOLD')) {
          calculatedLots = targetRisk / (100 * diff);
        } else if (pairUpper.includes('OIL') || pairUpper.includes('WTI') || pairUpper.includes('BRENT')) {
          calculatedLots = targetRisk / (1000 * diff);
        } else {
          // Other commodities (Silver, etc.)
          calculatedLots = targetRisk / (5000 * diff);
        }
      } else if (isIndexOrCrypto(pairUpper)) {
        calculatedLots = targetRisk / diff;
      } else {
        // Forex
        const isJpy = pairUpper.includes('JPY');
        const pipSize = isJpy ? 0.01 : 0.0001;
        const pips = diff / pipSize;
        
        // Use the new service for accurate pip value
        const pipValuePerLot = await calculatePipValue(pairUpper, account.currency || 'USD');
        calculatedLots = targetRisk / (pips * pipValuePerLot);
      }

      const finalLots = Math.floor(calculatedLots * 100) / 100;
      
      if (finalLots < 0.01) {
        setLotSize(0);
        setActualRisk(0);
        setWarning(`Risk too low for ${pairUpper}. Min lot 0.01.`);
      } else {
        setLotSize(finalLots);
        
        // Calculate ACTUAL risk based on rounded lots
        let actual = 0;
        if (isCommodity(pairUpper)) {
          if (pairUpper.includes('XAU') || pairUpper.includes('GOLD')) {
            actual = finalLots * 100 * diff;
          } else if (pairUpper.includes('OIL') || pairUpper.includes('WTI') || pairUpper.includes('BRENT')) {
            actual = finalLots * 1000 * diff;
          } else {
            actual = finalLots * 5000 * diff;
          }
        } else if (isIndexOrCrypto(pairUpper)) {
          actual = finalLots * diff;
        } else {
          const isJpy = pairUpper.includes('JPY');
          const pipSize = isJpy ? 0.01 : 0.0001;
          const pips = diff / pipSize;
          const pipValuePerLot = await calculatePipValue(pairUpper, account.currency || 'USD');
          actual = finalLots * pips * pipValuePerLot;
        }
        setActualRisk(Math.round(actual * 100) / 100);
        setWarning(null);
      }
    };

    calculateLots();
  }, [entryPrice, stopLoss, currentPair, isOpen, account, riskAmount]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (hasTradedToday) {
      setError("Prop Rule: Only one trade allowed per day.");
      return;
    }
    if (warning && lotSize === 0) return;

    const safeParse = (val: string) => {
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    };

    const parsedEntry = safeParse(entryPrice);
    const parsedSL = safeParse(stopLoss);

    if (parsedEntry === null || parsedSL === null) {
      setError("Please enter valid entry and stop loss prices");
      return;
    }

    setIsSubmitting(true);
    try {
      await onAdd({
        pair: currentPair.toUpperCase(),
        type,
        entryPrice: parsedEntry,
        stopLoss: parsedSL,
        takeProfit: safeParse(takeProfit),
        lotSize: lotSize,
        riskAmount: actualRisk || riskAmount,
        status: 'open',
        imageUrl,
        notes,
        analysisBy: analysisBy === 'Custom' ? customAnalysisBy : analysisBy,
        createdAt: new Date().toISOString()
      });
      onClose();
      // Reset
      setSelectedPair('EURUSD');
      setCustomPair('');
      setEntryPrice('');
      setStopLoss('');
      setTakeProfit('');
      setLotSize(null);
      setImageUrl('');
      setNotes('');
      setAnalysisBy('None');
      setCustomAnalysisBy('');
    } catch (err: any) {
      console.error("Trade submit error:", err);
      setError(err.message || "Failed to record trade. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-sm flex items-center justify-center p-4 font-serif">
      <div className="w-full max-w-[450px] bg-white border border-black p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="space-y-1">
          <h2 className="text-sm font-bold uppercase">Record Trade</h2>
          <p className="text-[9px] opacity-50 uppercase">
            {hasTradedToday ? "DAILY LIMIT REACHED" : "Enter the details of your trade execution"}
          </p>
        </div>

        {hasTradedToday ? (
          <div className="space-y-4">
            <div className="p-4 border border-black bg-red-50 text-red-600 text-[10px] uppercase font-bold text-center">
              Prop Rule: You have already taken a trade today. You cannot trade again until tomorrow.
            </div>
            <button onClick={onClose} className="w-full border border-black px-4 py-2 text-[10px] uppercase hover:bg-[#efefef] transition-colors">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 border border-red-600 bg-red-50 text-red-600 text-[10px] uppercase font-bold">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] uppercase block">Pair</label>
                <select 
                  value={selectedPair} 
                  onChange={(e) => setSelectedPair(e.target.value)}
                  className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none bg-white"
                >
                  <option value="EURUSD">EURUSD</option>
                  <option value="GBPUSD">GBPUSD</option>
                  <option value="NAS100">NAS100</option>
                  <option value="SPX500">SPX500</option>
                  <option value="XAUUSD">GOLD (XAUUSD)</option>
                  <option value="USOIL">USOIL</option>
                  <option value="BTCUSD">BTCUSD</option>
                  <option value="ETHUSD">ETHUSD</option>
                  <option value="SOLUSD">SOLUSD</option>
                  <option value="CUSTOM">CUSTOM...</option>
                </select>
                {selectedPair === 'CUSTOM' && (
                  <input 
                    value={customPair} 
                    onChange={(e) => setCustomPair(e.target.value)} 
                    placeholder="E.g. AUDUSD" 
                    required 
                    className="w-full border border-black px-2 py-1 text-[10px] mt-1 focus:outline-none uppercase" 
                  />
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase block">Type</label>
                <select 
                  value={type} 
                  onChange={(e) => setType(e.target.value as 'buy' | 'sell')}
                  className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none bg-white"
                >
                  <option value="buy">BUY</option>
                  <option value="sell">SELL</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] uppercase block">Analysis By *</label>
              <select 
                value={analysisBy} 
                onChange={(e) => setAnalysisBy(e.target.value)}
                required
                className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none bg-white"
              >
                <option value="None">None</option>
                <option value="Abdulrahmon">Abdulrahmon</option>
                <option value="Kelvin">Kelvin</option>
                <option value="ME">ME</option>
                <option value="Custom">Custom...</option>
              </select>
              {analysisBy === 'Custom' && (
                <input 
                  value={customAnalysisBy} 
                  onChange={(e) => setCustomAnalysisBy(e.target.value)} 
                  placeholder="Enter name" 
                  required 
                  className="w-full border border-black px-2 py-1 text-[10px] mt-1 focus:outline-none" 
                />
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] uppercase block">Entry *</label>
                <input 
                  type="number" step="any" required
                  value={entryPrice} 
                  onChange={(e) => setEntryPrice(e.target.value)} 
                  placeholder="1.0850" 
                  className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase block">Stop Loss *</label>
                <input 
                  type="number" step="any" required
                  value={stopLoss} 
                  onChange={(e) => setStopLoss(e.target.value)} 
                  placeholder="1.0800" 
                  className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase block">Take Profit</label>
                <input 
                  type="number" step="any"
                  value={takeProfit} 
                  onChange={(e) => setTakeProfit(e.target.value)} 
                  placeholder="1.1000" 
                  className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] uppercase block">Risk per Trade ({account?.currency})</label>
                <div className="w-full border border-black px-2 py-1 text-[10px] bg-[#f9f9f9] h-[26px] flex items-center font-bold">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: account?.currency || 'USD' }).format(riskAmount)}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase block">Calculated Lot Size</label>
                <div className="w-full border border-black px-2 py-1 text-[10px] bg-[#f9f9f9] h-[26px] flex items-center font-bold">
                  {lotSize !== null ? lotSize : '--'}
                </div>
              </div>
            </div>

            <div className="p-2 border border-black bg-[#f9f9f9] space-y-2">
              {account.type === 'prop' || account.type === 'prop-live' ? (
                <>
                  <div className="flex justify-between items-center border-b border-black/10 pb-1">
                    <span className="text-[8px] uppercase opacity-50">Open Trades Risk:</span>
                    <span className="text-[10px] font-bold text-orange-600">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: account?.currency || 'USD' }).format(openRiskTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-black/10 pb-1">
                    <span className="text-[8px] uppercase opacity-50">Remaining Margin (Adjusted):</span>
                    <span className={`text-[10px] font-bold ${riskCalculation.remainingDDAmount < 0 ? 'text-red-600' : ''}`}>
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: account?.currency || 'USD' }).format(riskCalculation.remainingDDAmount)}
                    </span>
                  </div>
                  {account.type === 'prop' && (
                    <div className="flex justify-between items-center border-b border-black/10 pb-1">
                      <span className="text-[8px] uppercase opacity-50">Effective Drawdown (EDD):</span>
                      <span className="text-[10px] font-bold">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: account?.currency || 'USD' }).format(eddAmount)}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center border-b border-black/10 pb-1">
                    <span className="text-[8px] uppercase opacity-50">Open Trades Risk:</span>
                    <span className="text-[10px] font-bold text-orange-600">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: account?.currency || 'USD' }).format(openRiskTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-black/10 pb-1">
                    <span className="text-[8px] uppercase opacity-50">Effective Balance:</span>
                    <span className="text-[10px] font-bold">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: account?.currency || 'USD' }).format(account.currentBalance - openRiskTotal)}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center">
                <span className="text-[8px] uppercase opacity-50">Actual Risk with {lotSize || 0} Lots:</span>
                <span className="text-[10px] font-bold">
                  {actualRisk !== null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: account?.currency || 'USD' }).format(actualRisk) : '--'}
                </span>
              </div>
              <div className="pt-1">
                <p className="text-[7px] opacity-40 uppercase">
                  {account.type === 'prop' ? (
                    <>Tier: {remainingDDPercent >= 10 ? '10%+' : remainingDDPercent >= 6 ? '6%+' : remainingDDPercent >= 3 ? '3%+' : '<3%'} ({((riskAmount / eddAmount) * 100).toFixed(2)}% of EDD)</>
                  ) : (
                    <>Live Tier: {riskCalculation.remainingDDAmount >= 1660 ? '1660+' : riskCalculation.remainingDDAmount >= 880 ? '880+' : riskCalculation.remainingDDAmount >= 440 ? '440+' : riskCalculation.remainingDDAmount >= 220 ? '220+' : riskCalculation.remainingDDAmount >= 110 ? '110+' : riskCalculation.remainingDDAmount >= 15 ? '15+' : '<15'}</>
                  )}
                </p>
              </div>
            </div>

            {warning && (
              <div className="p-2 border border-red-600 bg-red-50 text-red-600 text-[8px] uppercase font-bold">
                Warning: {warning}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[9px] uppercase block">Screenshot</label>
              <div className="border border-black p-4 text-center space-y-2">
                {imageUrl ? (
                  <div className="relative">
                    <img src={imageUrl} alt="Preview" className="max-h-40 mx-auto border border-black" referrerPolicy="no-referrer" />
                    <button type="button" onClick={() => setImageUrl('')} className="mt-2 text-[9px] underline uppercase">remove</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="cursor-pointer text-[10px] underline uppercase block">
                      {isUploading ? 'uploading...' : 'select file'}
                      <input type="file" className="hidden" accept="image/*" ref={fileInputRef} onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsUploading(true);
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setTempImage(reader.result as string);
                          setIsUploading(false);
                        };
                        reader.readAsDataURL(file);
                      }} disabled={isUploading} />
                    </label>
                    <p className="text-[8px] opacity-40 uppercase">PNG, JPG up to 1MB</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] uppercase block">Notes</label>
              <textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder="Confluence..." 
                className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none min-h-[60px]" 
              />
            </div>

            <div className="pt-4 flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 border border-black px-4 py-1 text-[10px] uppercase hover:bg-[#efefef] transition-colors">cancel</button>
              <button 
                type="submit" 
                className="flex-1 border border-black bg-black text-white px-4 py-1 text-[10px] uppercase hover:bg-black/80 transition-colors disabled:opacity-50" 
                disabled={isUploading || isSubmitting || (lotSize === 0 && !!warning)}
              >
                {isSubmitting ? 'recording...' : isUploading ? 'wait...' : 'save'}
              </button>
            </div>
          </form>
        )}

        {tempImage && (
          <ImageCropper 
            image={tempImage} 
            onCropComplete={(cropped) => {
              setImageUrl(cropped);
              setTempImage(null);
            }}
            onCancel={() => setTempImage(null)}
          />
        )}
      </div>
    </div>
  );
}
