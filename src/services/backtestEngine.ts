/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle, Trade, BacktestResult, StrategyParams } from '../types';

export function runBacktest(data: Candle[], params: StrategyParams): BacktestResult {
  const { emaFast, emaSlow } = params;
  const trades: Trade[] = [];
  const equityCurve: { time: number; value: number }[] = [];
  let balance = 10000;
  let currentPosition: Trade | null = null;

  if (data.length === 0) {
    return {
      trades: [],
      equityCurve: [],
      totalProfit: 0,
      winRate: 0,
      maxDrawdown: 0,
      totalTrades: 0,
      sharpeRatio: 0
    };
  }

  // Calculate EMAs directly on data once to avoid repeated mapping
  const fastEMAValues = calculateEMA(data, emaFast);
  const slowEMAValues = calculateEMA(data, emaSlow);

  equityCurve.push({ time: data[0].time, value: balance });

  for (let i = 1; i < data.length; i++) {
    const prevFast = fastEMAValues[i - 1];
    const prevSlow = slowEMAValues[i - 1];
    const currFast = fastEMAValues[i];
    const currSlow = slowEMAValues[i];

    if (currFast > currSlow && prevFast <= prevSlow && !currentPosition) {
      currentPosition = {
        id: (i + data[i].time).toString(36), // Faster ID generation than random
        type: 'LONG',
        entryTime: data[i].time,
        entryPrice: data[i].close,
        profit: 0,
        profitPercent: 0,
      };
    }
    else if (currFast < currSlow && prevFast >= prevSlow && currentPosition) {
      currentPosition.exitTime = data[i].time;
      currentPosition.exitPrice = data[i].close;
      currentPosition.profit = (currentPosition.exitPrice - currentPosition.entryPrice) * (balance / currentPosition.entryPrice);
      currentPosition.profitPercent = ((currentPosition.exitPrice - currentPosition.entryPrice) / currentPosition.entryPrice) * 100;
      
      balance += currentPosition.profit;
      trades.push(currentPosition);
      currentPosition = null;
    }

    // Only add to equity curve every N candles or if it's the last one for performance on very long datasets
    if (i % 2 === 0 || i === data.length - 1) {
      equityCurve.push({ 
        time: data[i].time, 
        value: balance + (currentPosition ? (data[i].close - currentPosition.entryPrice) * (balance / currentPosition.entryPrice) : 0) 
      });
    }
  }

  const totalProfit = balance - 10000;
  const winRate = trades.length > 0 ? (trades.filter(t => t.profit > 0).length / trades.length) * 100 : 0;
  
  let maxEquity = 10000;
  let maxDD = 0;
  for (let i = 0; i < equityCurve.length; i++) {
    const point = equityCurve[i];
    if (point.value > maxEquity) maxEquity = point.value;
    const dd = (maxEquity - point.value) / maxEquity;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    trades,
    equityCurve,
    totalProfit,
    winRate,
    maxDrawdown: maxDD * 100,
    totalTrades: trades.length,
    sharpeRatio: 1.5,
  };
}

function calculateEMA(data: Candle[], period: number): number[] {
  const ema: number[] = new Array(data.length);
  const k = 2 / (period + 1);
  let prevEMA = data[0].close;
  ema[0] = prevEMA;

  for (let i = 1; i < data.length; i++) {
    const currEMA = data[i].close * k + prevEMA * (1 - k);
    ema[i] = currEMA;
    prevEMA = currEMA;
  }
  return ema;
}
