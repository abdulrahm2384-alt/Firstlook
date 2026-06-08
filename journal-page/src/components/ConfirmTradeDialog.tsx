import React, { useState, useEffect, useRef } from 'react';
import { Trade, Account } from '../types';
import ImageCropper from './ImageCropper';
import { calculatePipValue, isIndexOrCrypto, isCommodity } from '../services/forexService';

interface ConfirmTradeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (tradeId: string, updates: Partial<Trade>) => void;
  trade: Trade;
  account: Account;
}

export default function ConfirmTradeDialog({ isOpen, onClose, onConfirm, trade, account }: ConfirmTradeDialogProps) {
  const [exitPrice, setExitPrice] = useState('');
  const [additionalLoss, setAdditionalLoss] = useState('0');
  const [notes, setNotes] = useState(trade?.notes || '');
  const [calculatedPL, setCalculatedPL] = useState<number | null>(null);
  const [afterImageUrl, setAfterImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const calculatePL = async () => {
      if (!isOpen || !trade || !exitPrice) {
        setCalculatedPL(null);
        return;
      }

      const exit = parseFloat(exitPrice);
      const entry = trade.entryPrice;
      const lots = trade.lotSize || 0;
      const addLoss = parseFloat(additionalLoss) || 0;

      if (isNaN(exit)) {
        setCalculatedPL(null);
        return;
      }

      let pl = 0;
      const pairUpper = trade.pair.toUpperCase();

      // P/L Calculation Logic (Reverse of Lot Size)
      if (isCommodity(pairUpper)) {
        if (pairUpper.includes('XAU') || pairUpper.includes('GOLD')) {
          pl = (exit - entry) * 100 * lots;
        } else if (pairUpper.includes('OIL') || pairUpper.includes('WTI') || pairUpper.includes('BRENT')) {
          pl = (exit - entry) * 1000 * lots;
        } else {
          pl = (exit - entry) * 5000 * lots;
        }
      } else if (isIndexOrCrypto(pairUpper)) {
        pl = (exit - entry) * lots;
      } else {
        // Forex
        const isJpy = pairUpper.includes('JPY');
        const pipSize = isJpy ? 0.01 : 0.0001;
        const pips = (exit - entry) / pipSize;
        const pipValuePerLot = await calculatePipValue(pairUpper, account.currency || 'USD');
        pl = pips * pipValuePerLot * lots;
      }

      // Adjust for Buy/Sell
      if (trade.type === 'sell') {
        pl = -pl;
      }

      // Subtract additional loss
      pl -= addLoss;

      setCalculatedPL(Math.round(pl * 100) / 100);
    };

    calculatePL();
  }, [exitPrice, additionalLoss, trade, isOpen, account.currency]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onConfirm(trade.id, {
        exitPrice: parseFloat(exitPrice),
        additionalLoss: parseFloat(additionalLoss),
        profitLoss: calculatedPL || 0,
        notes,
        afterImageUrl,
        status: 'closed',
        closedAt: new Date().toISOString()
      });
      onClose();
    } catch (err: any) {
      console.error("Error confirming trade:", err);
      setError(err.message || "Failed to confirm trade. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-white/80 backdrop-blur-sm flex items-center justify-center p-4 font-serif">
      <div className="w-full max-w-[400px] bg-white border border-black p-6 space-y-6">
        <div className="space-y-1">
          <h2 className="text-sm font-bold uppercase">Confirm Trade Result</h2>
          <p className="text-[9px] opacity-50 uppercase">{trade.pair} {trade.type} @ {trade.entryPrice}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 border border-red-600 bg-red-50 text-red-600 text-[10px] uppercase font-bold">
              {error}
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[9px] uppercase block">Exit Price (TP/Actual)</label>
            <input 
              type="number" step="any" required
              value={exitPrice} 
              onChange={(e) => setExitPrice(e.target.value)} 
              placeholder={trade.takeProfit?.toString() || "1.0900"} 
              className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none" 
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] uppercase block">Additional Loss/Fees ({account.currency})</label>
            <input 
              type="number" step="any"
              value={additionalLoss} 
              onChange={(e) => setAdditionalLoss(e.target.value)} 
              placeholder="0" 
              className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none" 
            />
          </div>

          <div className="p-3 border border-black bg-[#f9f9f9] space-y-1">
            <label className="text-[8px] uppercase block opacity-50">Calculated Profit/Loss</label>
            <div className={`text-lg font-bold ${calculatedPL && calculatedPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {calculatedPL !== null 
                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency }).format(calculatedPL)
                : '--'}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] uppercase block">Final Notes</label>
            <textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              placeholder="How did it go?" 
              className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none min-h-[60px]" 
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] uppercase block">After Screenshot (Optional)</label>
            <div className="border border-black p-4 text-center space-y-2">
              {afterImageUrl ? (
                <div className="relative">
                  <img src={afterImageUrl} alt="After Preview" className="max-h-32 mx-auto border border-black" referrerPolicy="no-referrer" />
                  <button type="button" onClick={() => setAfterImageUrl('')} className="mt-2 text-[9px] underline uppercase">remove</button>
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

          <div className="pt-2 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 border border-black px-4 py-1 text-[10px] uppercase hover:bg-[#efefef] transition-colors">cancel</button>
            <button 
              type="submit" 
              className="flex-1 border border-black bg-black text-white px-4 py-1 text-[10px] uppercase hover:bg-black/80 transition-colors disabled:opacity-50" 
              disabled={isUploading || isSubmitting}
            >
              {isSubmitting ? 'confirming...' : isUploading ? 'wait...' : 'confirm & close'}
            </button>
          </div>
        </form>

        {tempImage && (
          <ImageCropper 
            image={tempImage} 
            onCropComplete={(cropped) => {
              setAfterImageUrl(cropped);
              setTempImage(null);
            }}
            onCancel={() => setTempImage(null)}
          />
        )}
      </div>
    </div>
  );
}
