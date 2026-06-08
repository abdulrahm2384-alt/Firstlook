import React from 'react';
import { Trade } from '@/src/types';

interface TradeDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  trade: Trade | null;
}

export default function TradeDetailDialog({ isOpen, onClose, trade }: TradeDetailDialogProps) {
  if (!isOpen || !trade) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-sm flex items-center justify-center p-4 font-serif">
      <div className="w-full max-w-[600px] bg-white border border-black p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start border-b border-black pb-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold uppercase">{trade.pair}</h2>
            <p className="text-[9px] opacity-50 uppercase">
              {new Date(trade.createdAt || Date.now()).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-2">
            <span className="text-[9px] border border-black px-1 uppercase">{trade.type}</span>
            <span className="text-[9px] border border-black px-1 uppercase">{trade.status}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-0.5 border border-black p-2">
                <p className="text-[8px] opacity-40 uppercase">Entry</p>
                <p className="text-sm font-bold">{trade.entryPrice}</p>
              </div>
              <div className="space-y-0.5 border border-black p-2">
                <p className="text-[8px] opacity-40 uppercase">Exit</p>
                <p className="text-sm font-bold">{trade.exitPrice || '-'}</p>
              </div>
              <div className="space-y-0.5 border border-black p-2">
                <p className="text-[8px] opacity-40 uppercase">Risk</p>
                <p className="text-sm font-bold">{trade.riskAmount || '-'}</p>
              </div>
              <div className="space-y-0.5 border border-black p-2">
                <p className="text-[8px] opacity-40 uppercase">P/L</p>
                <p className="text-sm font-bold">
                  {trade.profitLoss ? (trade.profitLoss > 0 ? `+${trade.profitLoss}` : trade.profitLoss) : '-'}
                </p>
              </div>
              {trade.analysisBy && trade.analysisBy !== 'None' && (
                <div className="space-y-0.5 border border-black p-2 col-span-2">
                  <p className="text-[8px] opacity-40 uppercase">Analysis By</p>
                  <p className="text-sm font-bold uppercase">{trade.analysisBy}</p>
                </div>
              )}
            </div>

            {trade.notes && (
              <div className="space-y-1 border border-black p-2">
                <p className="text-[8px] opacity-40 uppercase">Notes</p>
                <p className="text-[10px] leading-relaxed whitespace-pre-wrap">{trade.notes}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-[8px] opacity-40 uppercase">Before Screenshot</p>
              {trade.imageUrl ? (
                <div className="border border-black p-1">
                  <img 
                    src={trade.imageUrl} 
                    alt={`${trade.pair} before`} 
                    className="w-full h-auto border border-black/10"
                    referrerPolicy="no-referrer"
                  />
                  <div className="mt-2 text-center">
                    <a 
                      href={trade.imageUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[9px] underline uppercase"
                    >
                      view full image
                    </a>
                  </div>
                </div>
              ) : (
                <div className="border border-black py-4 text-center opacity-40">
                  <p className="text-[9px] uppercase">No before screenshot</p>
                </div>
              )}
            </div>

            {trade.afterImageUrl && (
              <div className="space-y-2">
                <p className="text-[8px] opacity-40 uppercase">After Screenshot</p>
                <div className="border border-black p-1">
                  <img 
                    src={trade.afterImageUrl} 
                    alt={`${trade.pair} after`} 
                    className="w-full h-auto border border-black/10"
                    referrerPolicy="no-referrer"
                  />
                  <div className="mt-2 text-center">
                    <a 
                      href={trade.afterImageUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[9px] underline uppercase"
                    >
                      view full image
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-black">
          <button 
            onClick={onClose}
            className="w-full border border-black px-4 py-1 text-[10px] uppercase hover:bg-[#efefef] transition-colors"
          >
            close
          </button>
        </div>
      </div>
    </div>
  );
}
