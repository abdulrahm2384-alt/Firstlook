import React, { useState } from 'react';
import { Account, Trade, Withdrawal } from '@/src/types';
import RiskCalculator from './RiskCalculator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ConfirmTradeDialog from './ConfirmTradeDialog';
import { Wallet } from 'lucide-react';

interface TradeListProps {
  account: Account;
  trades: Trade[];
  withdrawals: Withdrawal[];
  onBack: () => void;
  onAddTrade: () => void;
  onWithdraw: () => void;
  onDeleteTrade: (tradeId: string) => void;
  onViewTrade: (trade: Trade) => void;
  onUpdateTrade: (tradeId: string, updates: Partial<Trade>) => void;
}

export default function TradeList({ account, trades, withdrawals, onBack, onAddTrade, onWithdraw, onDeleteTrade, onViewTrade, onUpdateTrade }: TradeListProps) {
  const [confirmTrade, setConfirmTrade] = useState<Trade | null>(null);
  const isProp = account.type === 'prop';
  const canWithdraw = account.type === 'live' || account.type === 'prop-live';
  
  // Calculate prop metrics
  const profit = account.currentBalance - account.initialBalance;
  const profitPercentage = (profit / account.initialBalance) * 100;
  
  // Daily P/L calculation
  const today = new Date().toLocaleDateString();
  const todayTrades = trades.filter(t => new Date(t.createdAt).toLocaleDateString() === today);
  const dailyPL = todayTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  const startOfDayBalance = account.currentBalance - dailyPL;
  const dailyDrawdownUsed = dailyPL < 0 ? (Math.abs(dailyPL) / startOfDayBalance) * 100 : 0;
  
  // Max Drawdown calculation
  const maxDrawdownUsed = profit < 0 ? (Math.abs(profit) / account.initialBalance) * 100 : 0;

  // Live progress calculation
  const liveTarget = account.liveTargetAmount || 0;
  const liveProfit = account.currentBalance - account.initialBalance;
  const liveProgress = liveTarget > 0 ? (liveProfit / liveTarget) * 100 : 0;

  // Status determination
  let status = account.status || 'active';
  if (isProp) {
    if (maxDrawdownUsed >= (account.maxDrawdown || 10)) status = 'failed';
    else if (dailyDrawdownUsed >= (account.dailyDrawdown || 4)) status = 'failed';
    else if (profitPercentage >= (account.profitTarget || 10)) status = 'passed';
  }

  const openTrades = trades.filter(t => t.status === 'open').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const closedTrades = trades.filter(t => t.status === 'closed').sort((a, b) => new Date(b.closedAt || b.createdAt).getTime() - new Date(a.closedAt || a.createdAt).getTime());

  return (
    <div className="space-y-12 font-serif">
      <div className="flex justify-between items-end border-b border-black pb-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-[10px] underline uppercase">
            back
          </button>
          <div className="space-y-1">
            <h1 className="text-xl font-bold uppercase">{account.name}</h1>
            <p className="text-[10px] opacity-50 uppercase">
              {isProp ? `${account.propType || '2-Phase'} • Phase ${account.phase}` : account.type} • {account.currency}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isProp && (
            <span className={`text-[10px] border border-black px-2 py-1 uppercase font-bold ${
              status === 'passed' ? 'bg-black text-white' : 
              status === 'failed' ? 'bg-red-50 text-red-600 border-red-600' : ''
            }`}>
              {status}
            </span>
          )}
          {canWithdraw && (
            <button 
              onClick={onWithdraw}
              className="border border-black bg-white px-4 py-1 text-[10px] uppercase hover:bg-[#efefef] transition-colors flex items-center gap-2"
            >
              <Wallet size={10} />
              withdraw
            </button>
          )}
          <button 
            onClick={onAddTrade}
            className="border border-black bg-[#efefef] px-4 py-1 text-[10px] uppercase hover:bg-[#e5e5e5] transition-colors"
          >
            add trade
          </button>
        </div>
      </div>

      {isProp && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-black p-4 space-y-3">
            <div className="flex justify-between items-end">
              <p className="text-[8px] opacity-40 uppercase">Profit Target</p>
              <p className="text-[10px] font-bold">{profitPercentage.toFixed(2)}% / {account.profitTarget}%</p>
            </div>
            <div className="h-1 w-full bg-[#efefef] border border-black/10 overflow-hidden">
              <div 
                className="h-full bg-black transition-all duration-500" 
                style={{ width: `${Math.min(Math.max(profitPercentage, 0) / (account.profitTarget || 10) * 100, 100)}%` }}
              />
            </div>
          </div>
          
          <div className="border border-black p-4 space-y-3">
            <div className="flex justify-between items-end">
              <p className="text-[8px] opacity-40 uppercase">Daily Drawdown</p>
              <p className="text-[10px] font-bold">{dailyDrawdownUsed.toFixed(2)}% / {account.dailyDrawdown}%</p>
            </div>
            <div className="h-1 w-full bg-[#efefef] border border-black/10 overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${dailyDrawdownUsed > (account.dailyDrawdown || 4) * 0.8 ? 'bg-red-600' : 'bg-black'}`}
                style={{ width: `${Math.min(dailyDrawdownUsed / (account.dailyDrawdown || 4) * 100, 100)}%` }}
              />
            </div>
          </div>

          <div className="border border-black p-4 space-y-3">
            <div className="flex justify-between items-end">
              <p className="text-[8px] opacity-40 uppercase">Max Drawdown</p>
              <p className="text-[10px] font-bold">{maxDrawdownUsed.toFixed(2)}% / {account.maxDrawdown}%</p>
            </div>
            <div className="h-1 w-full bg-[#efefef] border border-black/10 overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${maxDrawdownUsed > (account.maxDrawdown || 10) * 0.8 ? 'bg-red-600' : 'bg-black'}`}
                style={{ width: `${Math.min(maxDrawdownUsed / (account.maxDrawdown || 10) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {account.type === 'live' && account.liveTargetAmount && (
        <div className="border border-black p-4 space-y-3">
          <div className="flex justify-between items-end">
            <p className="text-[8px] opacity-40 uppercase">Target Progress</p>
            <p className="text-[10px] font-bold">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency }).format(liveProfit)} / {new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency }).format(account.liveTargetAmount)}
              ({liveProgress.toFixed(1)}%)
            </p>
          </div>
          <div className="h-1 w-full bg-[#efefef] border border-black/10 overflow-hidden">
            <div 
              className="h-full bg-black transition-all duration-500" 
              style={{ width: `${Math.min(Math.max(liveProgress, 0), 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border border-black p-4 space-y-1">
          <p className="text-[8px] opacity-40 uppercase">Balance</p>
          <p className="text-lg font-bold">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency }).format(account.currentBalance)}
          </p>
        </div>
        <div className="border border-black p-4 space-y-1">
          <p className="text-[8px] opacity-40 uppercase">Total Trades</p>
          <p className="text-lg font-bold">{trades.length}</p>
        </div>
        <div className="border border-black p-4 space-y-1">
          <p className="text-[8px] opacity-40 uppercase">Win Rate</p>
          <p className="text-lg font-bold">
            {closedTrades.length > 0 
              ? `${((closedTrades.filter(t => (t.profitLoss || 0) > 0).length / closedTrades.length) * 100).toFixed(1)}%`
              : '0%'}
          </p>
        </div>
      </div>

      <Tabs defaultValue="log" className="w-full space-y-6">
        <TabsList className="bg-transparent p-0 h-auto border-b border-black rounded-none w-full justify-start gap-4">
          <TabsTrigger value="log" className="uppercase text-[10px] font-bold px-0 py-2 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-black bg-transparent">
            Trade Log
          </TabsTrigger>
          <TabsTrigger value="risk" className="uppercase text-[10px] font-bold px-0 py-2 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-black bg-transparent">
            Risk Calculator
          </TabsTrigger>
          <TabsTrigger value="insights" className="uppercase text-[10px] font-bold px-0 py-2 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-black bg-transparent">
            Insights
          </TabsTrigger>
          {canWithdraw && (
            <TabsTrigger value="withdrawals" className="uppercase text-[10px] font-bold px-0 py-2 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-black bg-transparent">
              Withdrawals
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="log" className="mt-0 space-y-8">
          {/* Ongoing Trades Section */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase border-l-2 border-black pl-2">Ongoing Trades</h3>
            <div className="border border-black overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#efefef] border-b border-black">
                    <th className="text-[9px] uppercase p-2 font-bold">Date</th>
                    <th className="text-[9px] uppercase p-2 font-bold">Pair</th>
                    <th className="text-[9px] uppercase p-2 font-bold">Type</th>
                    <th className="text-[9px] uppercase p-2 font-bold">Entry</th>
                    <th className="text-[9px] uppercase p-2 font-bold">Lots</th>
                    <th className="text-[9px] uppercase p-2 font-bold">Analysis</th>
                    <th className="text-[9px] uppercase p-2 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {openTrades.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-6 opacity-40 text-[10px] uppercase">No active trades</td>
                    </tr>
                  ) : (
                    openTrades.map((trade) => (
                      <tr key={trade.id} className="border-b border-black/10 hover:bg-[#f9f9f9] transition-colors">
                        <td className="text-[10px] p-2">{new Date(trade.createdAt).toLocaleDateString()}</td>
                        <td className="text-[10px] p-2 font-bold">{trade.pair}</td>
                        <td className="text-[10px] p-2 uppercase">{trade.type}</td>
                        <td className="text-[10px] p-2">{trade.entryPrice}</td>
                        <td className="text-[10px] p-2 font-bold">{trade.lotSize}</td>
                        <td className="text-[10px] p-2 uppercase opacity-50">{trade.analysisBy || 'None'}</td>
                        <td className="text-right p-2">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setConfirmTrade(trade)} className="text-[9px] border border-black px-2 py-0.5 uppercase font-bold hover:bg-black hover:text-white transition-colors">Confirm Result</button>
                            <button onClick={() => onDeleteTrade(trade.id)} className="text-[9px] underline uppercase">del</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trade History Section */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase border-l-2 border-black pl-2 opacity-50">Trade History</h3>
            <div className="border border-black overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#efefef] border-b border-black">
                    <th className="text-[9px] uppercase p-2 font-bold">Closed Date</th>
                    <th className="text-[9px] uppercase p-2 font-bold">Pair</th>
                    <th className="text-[9px] uppercase p-2 font-bold">Type</th>
                    <th className="text-[9px] uppercase p-2 font-bold">P/L</th>
                    <th className="text-[9px] uppercase p-2 font-bold">Analysis</th>
                    <th className="text-[9px] uppercase p-2 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {closedTrades.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 opacity-40 text-[10px] uppercase">No trade history</td>
                    </tr>
                  ) : (
                    closedTrades.map((trade) => (
                      <tr key={trade.id} className="border-b border-black/10 hover:bg-[#f9f9f9] transition-colors">
                        <td className="text-[10px] p-2">{new Date(trade.closedAt || trade.createdAt).toLocaleDateString()}</td>
                        <td className="text-[10px] p-2 font-bold">{trade.pair}</td>
                        <td className="text-[10px] p-2 uppercase">{trade.type}</td>
                        <td className={`text-[10px] p-2 font-bold ${(trade.profitLoss || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {trade.profitLoss ? (trade.profitLoss > 0 ? `+${trade.profitLoss}` : trade.profitLoss) : '0'}
                        </td>
                        <td className="text-[10px] p-2 uppercase opacity-50">{trade.analysisBy || 'None'}</td>
                        <td className="text-right p-2">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => onViewTrade(trade)} className="text-[9px] underline uppercase">view</button>
                            <button onClick={() => onDeleteTrade(trade.id)} className="text-[9px] underline uppercase">del</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="risk" className="mt-0">
          <RiskCalculator 
            initialBalance={account.initialBalance}
            currentBalance={account.currentBalance} 
            currency={account.currency} 
            accountType={account.type}
            defaultDrawdownType={account.drawdownType}
            defaultDrawdownValue={account.drawdownValue || account.maxDrawdown}
            openRisk={trades.filter(t => t.status === 'open').reduce((sum, t) => sum + (t.riskAmount || 0), 0)}
          />
        </TabsContent>

        <TabsContent value="insights" className="mt-0 space-y-8">
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase border-l-2 border-black pl-2">Performance by Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from(new Set(trades.map(t => t.analysisBy || 'None'))).map(analyst => {
                const analystTrades = trades.filter(t => (t.analysisBy || 'None') === analyst && t.status === 'closed');
                const total = analystTrades.length;
                const wins = analystTrades.filter(t => (t.profitLoss || 0) > 0).length;
                const losses = analystTrades.filter(t => (t.profitLoss || 0) < 0).length;
                const totalPL = analystTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
                const winRate = total > 0 ? (wins / total) * 100 : 0;

                return (
                  <div key={analyst} className="border border-black p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <h4 className="text-[11px] font-bold uppercase">{analyst}</h4>
                      <span className="text-[8px] opacity-40 uppercase">{total} Trades</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <p className="text-[7px] opacity-40 uppercase">Win Rate</p>
                        <p className="text-xs font-bold">{winRate.toFixed(1)}%</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[7px] opacity-40 uppercase">Total P/L</p>
                        <p className={`text-xs font-bold ${totalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency }).format(totalPL)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <div className="flex-1 h-1 bg-green-100 overflow-hidden">
                        <div className="h-full bg-green-600" style={{ width: `${winRate}%` }} />
                      </div>
                      <div className="flex-1 h-1 bg-red-100 overflow-hidden">
                        <div className="h-full bg-red-600" style={{ width: `${total > 0 ? (losses / total) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <p className="text-[7px] opacity-40 uppercase">
                      {wins} Wins / {losses} Losses / {total - wins - losses} Breakeven
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border border-black p-6 space-y-4 bg-[#f9f9f9]">
            <h3 className="text-[10px] font-bold uppercase">Strategic Insight</h3>
            <div className="space-y-2">
              {(() => {
                const analystStats = Array.from(new Set(trades.map(t => t.analysisBy || 'None'))).map(analyst => {
                  const analystTrades = trades.filter(t => (t.analysisBy || 'None') === analyst && t.status === 'closed');
                  const totalPL = analystTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
                  const winRate = analystTrades.length > 0 ? (analystTrades.filter(t => (t.profitLoss || 0) > 0).length / analystTrades.length) * 100 : 0;
                  return { analyst, totalPL, winRate, count: analystTrades.length };
                }).filter(s => s.count > 0);

                if (analystStats.length === 0) return <p className="text-[10px] uppercase opacity-50 italic">Not enough data for insights yet.</p>;

                const bestAnalyst = [...analystStats].sort((a, b) => b.totalPL - a.totalPL)[0];
                const highestWinRate = [...analystStats].sort((a, b) => b.winRate - a.winRate)[0];

                return (
                  <div className="space-y-3">
                    <div className="flex gap-2 items-start">
                      <div className="w-1 h-1 bg-black mt-1.5" />
                      <p className="text-[10px] uppercase leading-relaxed">
                        <span className="font-bold">{bestAnalyst.analyst}</span> is currently your most profitable analyst with a total return of <span className="font-bold text-green-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency }).format(bestAnalyst.totalPL)}</span>.
                      </p>
                    </div>
                    <div className="flex gap-2 items-start">
                      <div className="w-1 h-1 bg-black mt-1.5" />
                      <p className="text-[10px] uppercase leading-relaxed">
                        Highest accuracy comes from <span className="font-bold">{highestWinRate.analyst}</span> with a <span className="font-bold">{highestWinRate.winRate.toFixed(1)}%</span> win rate.
                      </p>
                    </div>
                    {analystStats.some(s => s.totalPL < 0) && (
                      <div className="flex gap-2 items-start">
                        <div className="w-1 h-1 bg-red-600 mt-1.5" />
                        <p className="text-[10px] uppercase leading-relaxed">
                          Caution: Analysis by <span className="font-bold text-red-600">{analystStats.sort((a, b) => a.totalPL - b.totalPL)[0].analyst}</span> is currently resulting in net losses. Consider reviewing these setups.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="withdrawals" className="mt-0 space-y-4">
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase border-l-2 border-black pl-2">Withdrawal History</h3>
            <div className="border border-black overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#efefef] border-b border-black">
                    <th className="text-[9px] uppercase p-2 font-bold">Date</th>
                    <th className="text-[9px] uppercase p-2 font-bold">Amount</th>
                    <th className="text-[9px] uppercase p-2 font-bold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-6 opacity-40 text-[10px] uppercase">No withdrawal history</td>
                    </tr>
                  ) : (
                    withdrawals.map((w) => (
                      <tr key={w.id} className="border-b border-black/10 hover:bg-[#f9f9f9] transition-colors">
                        <td className="text-[10px] p-2">{new Date(w.createdAt).toLocaleDateString()}</td>
                        <td className="text-[10px] p-2 font-bold text-red-600">
                          -{new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency }).format(w.amount)}
                        </td>
                        <td className="text-[10px] p-2 opacity-60">{w.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {confirmTrade && (
        <ConfirmTradeDialog 
          isOpen={!!confirmTrade}
          onClose={() => setConfirmTrade(null)}
          onConfirm={onUpdateTrade}
          trade={confirmTrade}
          account={account}
        />
      )}
    </div>
  );
}
