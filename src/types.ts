/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MarketCategory = 'Crypto' | 'Forex' | 'Stocks' | 'Indices' | 'Metals' | 'Others';

export type MarketType = 'spot' | 'usdt-futures' | 'coin-futures';

export interface MarketSymbol {
  id?: string;
  symbol: string;
  name: string;
  category: MarketCategory;
  marketType?: MarketType;
  description?: string;
  comingSoon?: boolean;
  marketStart: string; // ISO Date String YYYY-MM-DD
  logo?: string;
  source?: string; // Data source for this symbol
}

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface JournalTrade {
  id?: string;
  user_id?: string;
  watchlistId?: string; // Link to the specific watchlist item instance
  symbol: string;
  prefix?: string;
  type: 'LONG' | 'SHORT';
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  rr: number;
  status: 'TP' | 'SL';
  pips: number;
  timeframe: string;
  duration: string;
  drawingId?: string; // Link to the original drawing
  setupGrade?: string;
  confluences?: string[];
  notes?: string;
  createdAt?: string;
  realizedAt?: string; // New: Actual real-world timestamp
}

export interface Trade {
  id: string;
  type: 'LONG' | 'SHORT';
  entryTime: number;
  entryPrice: number;
  exitTime?: number;
  exitPrice?: number;
  pips?: number;
  profit: number; // In currency
  profitPercent: number; // In percentage
}

export interface BacktestResult {
  trades: Trade[];
  equityCurve: { time: number; value: number }[];
  totalProfit: number;
  winRate: number;
  maxDrawdown: number;
  totalTrades: number;
  sharpeRatio: number;
}

export interface IndicatorInstance {
  id: string;
  type: 'SMA' | 'EMA' | 'WMA' | 'HMA' | 'RSI' | 'MACD' | 'BB' | 'VWAP' | 'ATR' | 'SUPERTREND' | 'STOCH' | 'SCRIPT' | 'LEVELS';
  category: 'INDICATOR' | 'STRATEGY' | 'SCRIPT';
  params: Record<string, any>;
  code?: string; // For custom scripts
  color: string;
  lineWidth: number;
  visible: boolean;
  scriptResults?: any;
}

export interface StrategyParams {
  [key: string]: any;
}

export interface BacktestSession {
  symbol: string;
  startTime: number;
  endTime?: number;
  currentTime: number;
  createdAt: number;
  isCompleted?: boolean;
  prefix?: string;
  description?: string;
}

export interface ChartTheme {
  upColor: string;
  upBorder: string;
  upWick: string;
  downColor: string;
  downBorder: string;
  downWick: string;
  bg: string;
  grid: string;
  text: string;
  showGrid?: boolean;
  timezone?: string;
}
