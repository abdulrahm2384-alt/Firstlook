import React, { useState } from 'react';
import { Account } from '../types';

interface WithdrawDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onWithdraw: (amount: number, notes: string) => Promise<void>;
  account: Account;
}

export default function WithdrawDialog({ isOpen, onClose, onWithdraw, account }: WithdrawDialogProps) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid withdrawal amount.");
      return;
    }

    if (parsedAmount > account.currentBalance) {
      setError("Withdrawal amount exceeds current balance.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onWithdraw(parsedAmount, notes);
      onClose();
      setAmount('');
      setNotes('');
    } catch (err: any) {
      console.error("Withdrawal error:", err);
      setError(err.message || "Failed to process withdrawal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-white/80 backdrop-blur-sm flex items-center justify-center p-4 font-serif">
      <div className="w-full max-w-[400px] bg-white border border-black p-6 space-y-6">
        <div className="space-y-1">
          <h2 className="text-sm font-bold uppercase">Withdraw Funds</h2>
          <p className="text-[9px] opacity-50 uppercase">Deduct from {account.name} balance</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 border border-red-600 bg-red-50 text-red-600 text-[10px] uppercase font-bold">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[9px] uppercase block">Amount ({account.currency})</label>
            <input 
              type="number" step="any" required
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              placeholder="0.00" 
              className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none" 
            />
            <p className="text-[8px] opacity-40 uppercase">Available: {new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency }).format(account.currentBalance)}</p>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] uppercase block">Notes (Optional)</label>
            <textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              placeholder="Reason for withdrawal..." 
              className="w-full border border-black px-2 py-1 text-[10px] focus:outline-none min-h-[60px]" 
            />
          </div>

          <div className="pt-4 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 border border-black px-4 py-1 text-[10px] uppercase hover:bg-[#efefef] transition-colors">cancel</button>
            <button 
              type="submit" 
              className="flex-1 border border-black bg-black text-white px-4 py-1 text-[10px] uppercase hover:bg-black/80 transition-colors disabled:opacity-50" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'processing...' : 'confirm withdrawal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
