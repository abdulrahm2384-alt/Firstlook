/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { POPULAR_SYMBOLS } from '../constants/symbols';

export function normalizeSymbol(symbol: string | null | undefined): string {
  if (!symbol) return '';
  return symbol.replace(/[^A-Z0-9]/g, '').toUpperCase();
}

export function getPipMultiplier(symbol: string, price?: number): number {
  const normSymbol = normalizeSymbol(symbol);
  const symbolInfo = POPULAR_SYMBOLS.find(s => normalizeSymbol(s.symbol) === normSymbol);
  
  // Forex
  if (symbolInfo?.category === 'Forex') {
    if (normSymbol.includes('JPY')) return 0.01;
    return 0.0001;
  }

  // Gold/Silver/Commodities
  if (symbolInfo?.category === 'Others') {
    if (normSymbol.includes('XAU') || normSymbol.includes('GOLD')) return 0.1;
    if (normSymbol.includes('XAG') || normSymbol.includes('SILVER')) return 0.01;
    return 0.01;
  }

  // Indices
  if (symbolInfo?.category === 'Indices') return 1.0;

  // Stocks
  if (symbolInfo?.category === 'Stocks') return 0.01;

  // Crypto - Dynamic based on price if available
  if (symbolInfo?.category === 'Crypto' || normSymbol.includes('USDT') || normSymbol.includes('USD')) {
    if (price !== undefined) {
      if (price > 1000) return 1.0;     // BTC, ETH
      if (price > 10) return 0.1;       // SOL, BNB
      if (price > 0.1) return 0.001;    // XRP, ADA
      return 0.00001;                   // PEPE, SHIB (very low satoshi)
    }
    // Fallback if no price provided
    if (normSymbol.startsWith('BTC') || normSymbol.startsWith('ETH')) return 1.0;
    return 1.0;
  }

  return 0.0001;
}

export function normalizeTimestampToMs(t: number | undefined): number | null {
  if (t === undefined || t === null || isNaN(t)) return null;
  // Year 1970 to seconds: ~0 to 2e9. 
  // Year 1970 to milliseconds: ~0 to 2e12.
  // If t is > 5e10, it's very likely ms. (5e10 seconds is year 3555).
  if (t > 50000000000) return Math.floor(t); 
  return Math.floor(t * 1000);
}

export function normalizeTimestampToSeconds(t: number | undefined): number | null {
  if (t === undefined || t === null || isNaN(t)) return null;
  if (t > 50000000000) return Math.floor(t / 1000);
  return Math.floor(t);
}

export function calculatePips(symbol: string, entryPrice: number, exitPrice: number): number {
  const multiplier = getPipMultiplier(symbol, entryPrice);
  const diff = Math.abs(exitPrice - entryPrice);
  return Number((diff / multiplier).toFixed(2));
}

export function isSpreadApplicableForSymbol(symbol: string): boolean {
  const normSymbol = normalizeSymbol(symbol);
  const symbolInfo = POPULAR_SYMBOLS.find(s => normalizeSymbol(s.symbol) === normSymbol);
  if (!symbolInfo) {
    const isForexLength = normSymbol.length === 6;
    const isMetal = normSymbol.includes('XAU') || normSymbol.includes('XAG') || normSymbol.includes('GOLD') || normSymbol.includes('SILVER');
    const isIndices = normSymbol.includes('US30') || normSymbol.includes('NAS100') || normSymbol.includes('SPX500') || normSymbol.includes('DE30') || normSymbol.includes('GER30');
    return isForexLength || isMetal || isIndices;
  }
  return ['Forex', 'Metals', 'Indices', 'Others'].includes(symbolInfo.category);
}

export function getCandleSpread(symbol: string, candle: any, isRawSpread: boolean): number {
  if (isRawSpread) return 0;

  if (candle) {
    if (typeof candle.spread_close === 'number' && !isNaN(candle.spread_close) && candle.spread_close > 0) {
      return candle.spread_close;
    }
    if (typeof candle.ask_close === 'number' && typeof candle.bid_close === 'number') {
      const s = candle.ask_close - candle.bid_close;
      if (s > 0) return s;
    }
    if (typeof candle.ask_close === 'number' && typeof candle.close === 'number') {
      const s = candle.ask_close - candle.close;
      if (s > 0) return s;
    }
  }

  if (isSpreadApplicableForSymbol(symbol)) {
    const multiplier = getPipMultiplier(symbol, candle?.close);
    const normSymbol = normalizeSymbol(symbol);
    if (normSymbol.includes('EURUSD') || normSymbol.includes('GBPUSD')) {
      return 1.2 * multiplier; // 1.2 pips
    } else if (normSymbol.includes('JPY')) {
      return 1.6 * multiplier; // 1.6 pips
    } else if (normSymbol.includes('XAU') || normSymbol.includes('GOLD')) {
      return 2.5 * multiplier; // 2.5 pips / 25 cents
    } else if (normSymbol.includes('XAG') || normSymbol.includes('SILVER')) {
      return 2.0 * multiplier; // 2.0 pips / 2 cents
    } else if (normSymbol.includes('US30') || normSymbol.includes('SPX500') || normSymbol.includes('NAS100')) {
      return 1.5 * multiplier; // 1.5 index points
    }
    return 1.5 * multiplier;
  }

  return 0;
}
