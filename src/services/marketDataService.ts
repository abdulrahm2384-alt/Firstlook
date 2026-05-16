/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle } from '../types';
import { POPULAR_SYMBOLS } from '../constants/symbols';
import { MarketDataSource } from '../types/watchlist';
import { normalizeTimestampToMs, normalizeTimestampToSeconds } from '../lib/marketUtils';

const dataCache = new Map<string, { data: Candle[], timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

/**
 * Unified service for fetching historical market data across different asset classes.
 */
export async function fetchMarketData(symbol: string, timeframeId: string, limit: number = 500, endTime?: number, startTime?: number, source?: string, marketType?: string): Promise<Candle[]> {
  if (!symbol || typeof symbol !== 'string') {
    console.error('Invalid symbol passed to fetchMarketData:', symbol);
    return [];
  }

  const cacheKey = `${symbol}_${timeframeId}_${limit}_${endTime || 'now'}_${startTime || 'start'}_${source || 'default'}_${marketType || 'default'}`;
  const cached = dataCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const normalizedSymbol = symbol.replace('/', '').replace('-', '').toUpperCase();
  const asset = POPULAR_SYMBOLS.find(s => s.symbol === symbol || s.symbol.replace('/', '').replace('-', '').toUpperCase() === normalizedSymbol);
  
  // Smarter category detection
  let category = asset?.category;
  if (!category) {
    if (symbol.includes('/') || normalizedSymbol.endsWith('USDT') || (normalizedSymbol.endsWith('USD') && (normalizedSymbol.startsWith('BTC') || normalizedSymbol.startsWith('ETH') || normalizedSymbol.startsWith('SOL')))) {
      category = 'Crypto';
    } else {
      category = 'Forex';
    }
  }

  let result: Candle[];
  try {
    if (category === 'Crypto') {
      const cryptoSource = source?.toLowerCase() || 'binance';
      
      switch (cryptoSource) {
        case 'okx':
          result = await fetchOkxData(symbol, timeframeId, limit, endTime, startTime, marketType);
          break;
        case 'bybit':
          result = await fetchBybitData(symbol, timeframeId, limit, endTime, startTime, marketType);
          break;
        case 'kraken':
          result = await fetchKrakenData(symbol, timeframeId, limit, endTime, startTime);
          break;
        case 'binance':
        case 'coinbase': 
        case 'gemini':
        case 'bitflyer':
        default:
          result = await fetchBinanceData(symbol, timeframeId, limit, endTime, startTime, marketType);
          break;
      }
    } else {
      // Forex and Metals via Twelve Data (supports years of 1m data for free)
      result = await fetchTwelveData(symbol, timeframeId, limit, endTime, startTime, source);
    }
    
    dataCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error('fetchMarketData error:', error);
    throw error;
  }
}

/**
 * Validates if a symbol is supported by a specific source.
 */
export async function validateSymbolSupport(symbol: string, source: string, marketType: string = 'spot'): Promise<boolean> {
  const normSource = source.toLowerCase();
  
  // Normalization
  const normalizedSymbol = symbol.replace('/', '').replace('-', '').toUpperCase();
  
  try {
    if (normSource === 'binance') {
      let binanceSymbol = normalizedSymbol;
      if (marketType === 'coin-futures') {
        if (!binanceSymbol.includes('_')) {
           if (binanceSymbol.endsWith('USDT')) binanceSymbol = binanceSymbol.replace('USDT', 'USD');
           if (!binanceSymbol.endsWith('USD')) binanceSymbol += 'USD';
           binanceSymbol += '_PERP';
        }
      } else {
        if (!binanceSymbol.endsWith('USDT') && !binanceSymbol.includes('BUSD') && !binanceSymbol.includes('USDC')) {
          binanceSymbol += 'USDT';
        }
      }
      
      const res = await fetch(`/api/binance?symbol=${binanceSymbol}&interval=1h&limit=1&marketType=${marketType}`);
      return res.ok;
    }
    
    if (normSource === 'okx') {
      let okxSymbol = symbol.replace('/', '-').toUpperCase();
      if (marketType === 'usdt-futures' || marketType === 'perps') {
        if (!okxSymbol.endsWith('-SWAP')) {
          if (okxSymbol.endsWith('-USD')) okxSymbol = okxSymbol.replace('-USD', '-USDT');
          okxSymbol += '-SWAP';
        }
      }
      const res = await fetch(`/api/okx?instId=${okxSymbol}&bar=1h&limit=1&marketType=${marketType}`);
      return res.ok;
    }
    
    if (normSource === 'bybit') {
      const res = await fetch(`/api/bybit?symbol=${normalizedSymbol}&interval=60&limit=1&marketType=${marketType}`);
      return res.ok;
    }
    
    if (normSource === 'kraken') {
      let krakenSymbol = symbol.replace('/', '').toUpperCase();
      if (krakenSymbol.startsWith('BTC')) krakenSymbol = krakenSymbol.replace('BTC', 'XBT');
      const res = await fetch(`/api/kraken?pair=${krakenSymbol}&interval=60`);
      return res.ok;
    }

    if (normSource === 'twelvedata') {
      const formatted = formatTwelveDataSymbol(symbol);
      const res = await fetch(`/api/twelvedata?symbol=${encodeURIComponent(formatted)}&interval=1h&outputsize=1`);
      if (!res.ok) return false;
      const json = await res.json();
      return json.status === 'ok' && json.values && json.values.length > 0;
    }
    
    return true; // Default to true for other cases or if check isn't implemented
  } catch (e) {
    console.error('Validation failed:', e);
    return false;
  }
}

async function fetchOkxData(symbol: string, timeframeId: string, limit: number, endTime?: number, startTime?: number, marketType?: string): Promise<Candle[]> {
  // OKX uses BASE-QUOTE for spot
  let okxSymbol = symbol.replace('/', '-').toUpperCase();
  
  // Handle OKX instrument ID naming conventions
  if (marketType === 'usdt-futures' || marketType === 'perps') {
    if (!okxSymbol.endsWith('-SWAP')) {
       // Ensure symbol uses USDT for USDT futures if it was just BASE/USD
       if (okxSymbol.endsWith('-USD')) okxSymbol = okxSymbol.replace('-USD', '-USDT');
       okxSymbol += '-SWAP';
    }
  } else if (marketType === 'coin-futures' || marketType === 'inverse') {
    // Inverse usually uses -USD-SWAP or -USD-YYMMDD
    if (okxSymbol.endsWith('-USDT')) okxSymbol = okxSymbol.replace('-USDT', '-USD');
    if (!okxSymbol.endsWith('-SWAP') && !/\d{6}$/.test(okxSymbol)) {
      okxSymbol += '-SWAP';
    }
  }

  const barMap: Record<string, string> = {
    '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1H', '2h': '2H', '4h': '4H', '1d': '1D', '1w': '1W', '1mo': '1M'
  };
  const bar = barMap[timeframeId] || '1H';
  
  const msEndTime = normalizeTimestampToMs(endTime);
  const msStartTime = normalizeTimestampToMs(startTime);

  const queryParams = new URLSearchParams({
    instId: okxSymbol,
    bar,
    limit: Math.min(limit, 100).toString(),
    marketType: marketType || 'spot'
  });
  
  if (msEndTime) {
     queryParams.append('after', msEndTime.toString());
  }

  try {
    const response = await fetch(`/api/okx?${queryParams.toString()}`);
    if (!response.ok) throw new Error(`OKX error: ${response.status}`);
    const json = await response.json();
    const data = json.data || [];
    
    return data.map((d: any) => ({
      time: Math.floor(parseInt(d[0]) / 1000),
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    })).filter((c: any) => !isNaN(c.time) && !isNaN(c.open)).sort((a: any, b: any) => a.time - b.time);
  } catch (err) {
    console.error('OKX fetch error:', err);
    return [];
  }
}

async function fetchBybitData(symbol: string, timeframeId: string, limit: number, endTime?: number, startTime?: number, marketType?: string): Promise<Candle[]> {
  // Bybit Spot uses BASEQUOTE (no separator)
  const bbSymbol = symbol.replace('/', '').replace('-', '').toUpperCase();
  const intervalMap: Record<string, string> = {
    '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30', '1h': '60', '2h': '120', '4h': '240', '1d': 'D', '1w': 'W', '1mo': 'M'
  };
  const interval = intervalMap[timeframeId] || '60';
  
  const msStartTime = normalizeTimestampToMs(startTime);
  const msEndTime = normalizeTimestampToMs(endTime);

  const queryParams = new URLSearchParams({
    symbol: bbSymbol,
    interval,
    limit: Math.min(limit, 200).toString(),
    marketType: marketType || 'spot'
  });

  if (msStartTime && msEndTime) {
    queryParams.append('start', msStartTime.toString());
    queryParams.append('end', msEndTime.toString());
  } else if (msEndTime) {
    queryParams.append('end', msEndTime.toString());
  }

  try {
    const response = await fetch(`/api/bybit?${queryParams.toString()}`);
    if (!response.ok) throw new Error(`Bybit error: ${response.status}`);
    const json = await response.json();
    const list = json.result?.list || [];
    
    return list.map((d: any) => ({
      time: Math.floor(parseInt(d[0]) / 1000),
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    })).filter((c: any) => !isNaN(c.time) && !isNaN(c.open)).sort((a: any, b: any) => a.time - b.time);
  } catch (err) {
    console.error('Bybit fetch error:', err);
    return [];
  }
}

async function fetchKrakenData(symbol: string, timeframeId: string, limit: number, endTime?: number, startTime?: number): Promise<Candle[]> {
  // Kraken pair name can be tricky but usually BTCUSD or XBTUSD works
  let krakenSymbol = symbol.replace('/', '').toUpperCase();
  if (krakenSymbol.startsWith('BTC')) krakenSymbol = krakenSymbol.replace('BTC', 'XBT');
  
  const intervalMap: Record<string, number> = {
    '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '4h': 240, '1d': 1440, '1w': 10080
  };
  const interval = intervalMap[timeframeId] || 60;
  
  const queryParams = new URLSearchParams({
    pair: krakenSymbol,
    interval: interval.toString()
  });
  const msStartTime = normalizeTimestampToMs(startTime);
  if (msStartTime) queryParams.append('since', Math.floor(msStartTime / 1000).toString());

  try {
    const response = await fetch(`/api/kraken?${queryParams.toString()}`);
    if (!response.ok) throw new Error(`Kraken error: ${response.status}`);
    const json = await response.json();
    if (json.error && json.error.length > 0) throw new Error(json.error[0]);

    const resultKeys = Object.keys(json.result || {});
    // result contains key like "XXBTZUSD" and "last"
    const pairKey = resultKeys.find(k => k !== 'last');
    const data = pairKey ? json.result[pairKey] : [];
    
    return data.map((d: any) => ({
      time: d[0],
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[6]),
    })).filter((c: any) => !isNaN(c.time) && !isNaN(c.open)).sort((a: any, b: any) => a.time - b.time);
  } catch (err) {
    console.error('Kraken fetch error:', err);
    return [];
  }
}

async function fetchBinanceData(symbol: string, timeframeId: string, limit: number, endTime?: number, startTime?: number, marketType?: string): Promise<Candle[]> {
  // Normalize symbol for Binance
  let normalizedSymbol = symbol.replace('/', '').replace('-', '').toUpperCase();
  
  // Custom mapping for some common mismatches
  if (normalizedSymbol === 'BTCUSD') normalizedSymbol = 'BTCUSDT';
  if (normalizedSymbol === 'ETHUSD') normalizedSymbol = 'ETHUSDT';
  
  if (marketType === 'coin-futures') {
    // Coin futures use formats like BTCUSD_PERP or BTCUSD_250627
    if (!normalizedSymbol.includes('_')) {
      // If it ends with USDT, change to USD
      if (normalizedSymbol.endsWith('USDT')) normalizedSymbol = normalizedSymbol.replace('USDT', 'USD');
      // If it doesn't end with USD, append it
      if (!normalizedSymbol.endsWith('USD')) normalizedSymbol += 'USD';
      normalizedSymbol += '_PERP';
    }
  } else {
    // If the symbol doesn't already contain a common quote currency, append USDT for spot/usdt-futures
    if (!normalizedSymbol.endsWith('USDT') && !normalizedSymbol.includes('BUSD') && !normalizedSymbol.includes('USDC') && !normalizedSymbol.includes('BTC') && !normalizedSymbol.includes('ETH')) {
      normalizedSymbol += 'USDT';
    }
  }

  const interval = BINANCE_TIMEFRAME_MAP[timeframeId] || (timeframeId === '8h' ? '8h' : timeframeId === '6h' ? '6h' : timeframeId === '12h' ? '12h' : timeframeId === '2h' ? '2h' : '1h');
  
  const queryParams = new URLSearchParams({
    symbol: normalizedSymbol,
    interval,
    limit: Math.min(limit, 1000).toString()
  });
  
  if (marketType) queryParams.append('marketType', marketType);
  
  const msEndTime = normalizeTimestampToMs(endTime);
  const msStartTime = normalizeTimestampToMs(startTime);
  
  if (msEndTime) queryParams.append('endTime', msEndTime.toString());
  if (msStartTime) queryParams.append('startTime', msStartTime.toString());

  let url = `/api/binance?${queryParams.toString()}`;
  
  try {
    const fetchWithRetry = async (url: string, retries: number = 3): Promise<Response> => {
      for (let i = 0; i < retries; i++) {
        try {
          const response = await fetch(url);
          // If it's a 5xx, it might be the proxy or cloudflare issues
          if (response.status >= 500) {
            throw new Error(`Server Error (${response.status})`);
          }
          return response;
        } catch (err) {
          if (i === retries - 1) throw err;
          await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, i)));
        }
      }
      throw new Error('All retries failed');
    };

    const response = await fetchWithRetry(url);
    if (!response.ok) {
      const respData = await response.json().catch(() => ({}));
      // Extract better error message from proxy response
      const apiError = respData.message || respData.msg || respData.error || `Proxy error ${response.status}`;
      
      throw new Error(`Binance fetch error: ${apiError}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error(`Binance fetch error: Expected JSON but got ${contentType}. Body snippet: ${text.substring(0, 200)}`);
      throw new Error(`Binance fetch error: Expected JSON but got ${contentType}.`);
    }

    const data = await response.json();
    
    return data.map((d: any) => ({
      time: Math.floor(d[0] / 1000),
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    })).filter((c: any) => !isNaN(c.time) && !isNaN(c.open) && !isNaN(c.high) && !isNaN(c.low) && !isNaN(c.close));
  } catch (error) {
    const isNetworkError = error instanceof TypeError && error.message === 'Failed to fetch';
    const message = isNetworkError ? `Network error: Could not reach the proxy server at ${url}. Please check your connection or wait for the server to restart.` : (error instanceof Error ? error.message : String(error));
    console.error('Binance fetch error:', message);
    throw new Error(`Binance fetch error: ${message}`);
  }
}

export function formatTwelveDataSymbol(symbol: string): string {
  if (!symbol) return '';
  let formattedSymbol = symbol.toUpperCase();
  
  // Handle Indices compatibility for Twelve Data (Twelve Data often uses specific US tickers)
  const indexMap: Record<string, string> = {
    'DAX': 'DAX',
    'GER30': 'DAX',
    'GER40': 'DAX',
    'CAC': 'CAC',
    'FRA40': 'CAC',
    'FTSE': 'FTSE',
    'UK100': 'FTSE',
    'NI225': 'NI225',
    'JP225': 'NI225',
    'HSI': 'HSI',
    'DXY': 'DXY',
    'USDX': 'DXY',
    'VIX': 'VIX',
    'SPX': 'SPX', 
    'SP500': 'SPX',
    'IXIC': 'IXIC',
    'NASDAQ': 'IXIC',
    'DJI': 'DJI',
    'US30': 'DJI',
    'NAS100': 'NAS100',
    'US100': 'NAS100'
  };

  if (indexMap[formattedSymbol]) {
    return indexMap[formattedSymbol];
  }
  
  // Format Forex, Metals, and Crypto pairs for Twelve Data
  // Twelve Data almost always expects a slash for pairs: BASE/QUOTE
  if (!formattedSymbol.includes('/')) {
    // 1. Forex & Metals (6 characters)
    if (formattedSymbol.length === 6) {
      formattedSymbol = `${formattedSymbol.slice(0, 3)}/${formattedSymbol.slice(3)}`;
    } 
    // 2. Crypto with common quote currencies (USDT/USDC/BUSD/USD)
    else if (formattedSymbol.endsWith('USDT') && formattedSymbol.length > 4) {
      const base = formattedSymbol.replace('USDT', '');
      formattedSymbol = `${base}/USDT`;
    } else if (formattedSymbol.endsWith('USDC') && formattedSymbol.length > 4) {
      const base = formattedSymbol.replace('USDC', '');
      formattedSymbol = `${base}/USDC`;
    } else if (formattedSymbol.endsWith('BUSD') && formattedSymbol.length > 4) {
      const base = formattedSymbol.replace('BUSD', '');
      formattedSymbol = `${base}/BUSD`;
    } else if (formattedSymbol.endsWith('USD') && formattedSymbol.length > 3) {
      const base = formattedSymbol.replace('USD', '');
      formattedSymbol = `${base}/USD`;
    }
    // 3. Specific aliases
    else if (formattedSymbol === 'GOLD') {
      formattedSymbol = 'XAU/USD';
    } else if (formattedSymbol === 'SILVER') {
      formattedSymbol = 'XAG/USD';
    } else if (formattedSymbol === 'BTC' || formattedSymbol === 'ETH' || formattedSymbol === 'SOL') {
      formattedSymbol = `${formattedSymbol}/USD`;
    }
  }

  // Common Commodities
  if (formattedSymbol === 'WTI') formattedSymbol = 'WTI/USD';
  if (formattedSymbol === 'BRENT') formattedSymbol = 'BRENT/USD';

  return formattedSymbol;
}

async function fetchTwelveData(symbol: string, timeframeId: string, limit: number, endTime?: number, startTime?: number, exchange?: string): Promise<Candle[]> {
  const formattedSymbol = formatTwelveDataSymbol(symbol);
  
  if (!formattedSymbol) {
    console.error('[Twelve Data] Symbol formatting resulted in empty string for:', symbol);
    return [];
  }
  
  const intervalMap: Record<string, string> = {
    '1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min',
    '1h': '1h', '4h': '4h', '1d': '1day', '1w': '1week', '1mo': '1month'
  };
  const interval = intervalMap[timeframeId] || '1h';

  // Format date for Twelve Data: YYYY-MM-DD HH:MM:SS
  let dateParams = '';
  const msEndTime = normalizeTimestampToMs(endTime);
  const msStartTime = normalizeTimestampToMs(startTime);

  if (msEndTime) {
    const end = new Date(msEndTime);
    // Twelve Data prefers space between YYYY-MM-DD and HH:MM:SS
    const datePart = end.toISOString().split('T')[0];
    const timePart = end.toISOString().split('T')[1].split('.')[0];
    dateParams += `&end_date=${encodeURIComponent(datePart + ' ' + timePart)}`;
  }
  if (msStartTime) {
    const start = new Date(msStartTime);
    const datePart = start.toISOString().split('T')[0];
    const timePart = start.toISOString().split('T')[1].split('.')[0];
    dateParams += `&start_date=${encodeURIComponent(datePart + ' ' + timePart)}`;
  }

  // Standardize exchange names for Twelve Data
  let twelveDataExchange = exchange;
  if (twelveDataExchange) {
    // Capitalize first letter (e.g. coinbase -> Coinbase)
    twelveDataExchange = twelveDataExchange.charAt(0).toUpperCase() + twelveDataExchange.slice(1);
    if (twelveDataExchange === 'Okx') twelveDataExchange = 'OKX';
  }

  // We increase outputsize to 500 by default for Twelve Data to reduce number of requests
  // The server handles API key rotation and caching
  let url = `/api/twelvedata?symbol=${encodeURIComponent(formattedSymbol)}&interval=${interval}&outputsize=500${dateParams}`;
  if (twelveDataExchange && twelveDataExchange.toLowerCase() !== 'twelvedata') {
    url += `&exchange=${encodeURIComponent(twelveDataExchange)}`;
  }

  try {
    const response = await fetch(url);
    
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    
    if (!response.ok) {
      if (isJson) {
        const errorData = await response.json();
        if (errorData.code === 429 || errorData.status === 'error') {
          if (errorData.code === 429) throw new Error('RATE_LIMIT');
          throw new Error(errorData.message || `API Error ${response.status}`);
        }
      }
      throw new Error(`Twelve Data proxy error: ${response.status}`);
    }
    
    if (!isJson) {
      const text = await response.text();
      console.error(`Twelve Data fetch error: Expected JSON but got ${contentType}. Body snippet: ${text.substring(0, 100)}`);
      return [];
    }

    const data = await response.json();
    
    if (data.status === 'error') {
      if (data.code === 429) {
        console.warn('Twelve Data Rate Limit reached (8 calls/min). Please wait a moment.');
        throw new Error('RATE_LIMIT');
      }
      
      const errorMsg = data.message || data.status || 'Twelve Data API Error';
      console.error(`[Twelve Data] API reported error for ${formattedSymbol}: ${errorMsg} (Code: ${data.code})`);
      throw new Error(`[Twelve Data] API reported error: ${errorMsg} (Code: ${data.code || 404})`);
    }

    if (!data.values || !Array.isArray(data.values)) {
      if (data.status === 'ok') {
        throw new Error('No data available for this symbol/timeframe');
      }
      throw new Error('Invalid data format received from Twelve Data');
    }

    return data.values.map((v: any) => {
      // Twelve Data datetime can be "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS"
      // Date.parse is generally robust, but replacing space with T for ISO compliance
      const timestamp = v.datetime.includes(' ') ? v.datetime.replace(' ', 'T') : v.datetime;
      const timeLong = new Date(timestamp).getTime();
      
      if (isNaN(timeLong)) {
        console.warn(`[Twelve Data] Invalid datetime received: ${v.datetime}`);
        return null;
      }

      return {
        time: Math.floor(timeLong / 1000),
        open: parseFloat(v.open),
        high: parseFloat(v.high),
        low: parseFloat(v.low),
        close: parseFloat(v.close),
        volume: parseFloat(v.volume || 0),
      };
    }).filter((c: any) => c !== null && !isNaN(c.open) && !isNaN(c.high) && !isNaN(c.low) && !isNaN(c.close))
      .sort((a: any, b: any) => a.time - b.time);
  } catch (error: any) {
    console.error('Twelve Data fetch error:', error);
    throw error;
  }
}

const BINANCE_TIMEFRAME_MAP: Record<string, string> = {
  '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '8h': '8h', '12h': '12h',
  '1d': '1d', '3d': '3d', '1w': '1w', '1mo': '1M'
};
