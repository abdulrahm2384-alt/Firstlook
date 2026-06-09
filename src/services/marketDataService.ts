/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle } from '../types';
import { POPULAR_SYMBOLS } from '../constants/symbols';
import { MarketDataSource } from '../types/watchlist';
import { normalizeTimestampToMs, normalizeTimestampToSeconds, getPipMultiplier } from '../lib/marketUtils';

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
      const normSource = ['axiory', 'exness', 'dukascopy', 'fxcm', 'oando'].includes(source?.toLowerCase() || '') ? (source?.toLowerCase() || '') : 'exness';
      result = await fetchWarehouseData(symbol, timeframeId, limit, endTime, startTime, normSource);
    }
    
    if (result && result.length >= 50) {
      dataCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }

    // Timeframe-independent news injection!
    if (result && result.length > 0 && timeframeId !== '1h') {
      try {
        const firstTime = result[0].time;
        const lastTime = result[result.length - 1].time;
        
        // Calculate the total duration spanned by the loaded candles in hours
        const totalDurationHours = Math.ceil((lastTime - firstTime) / 3600);
        
        // The API supports up to 500 candles per query.
        // We will fetch up to 10 sequential chunks of 500 hours (5000 hours of history)
        const chunkSize = 500;
        const numChunks = Math.min(10, Math.ceil(totalDurationHours / chunkSize));
        
        const chunkPromises: Promise<Candle[]>[] = [];
        for (let i = 0; i < numChunks; i++) {
          const chunkEndTime = lastTime + 18000 - (i * chunkSize * 3600);
          if (chunkEndTime > firstTime - 18000) {
            chunkPromises.push(
              fetchMarketData(symbol, '1h', chunkSize, chunkEndTime, undefined, source, marketType)
            );
          }
        }
        
        const chunkResults = await Promise.all(chunkPromises);
        let newsEvents: any[] = [];
        for (const h1Candles of chunkResults) {
          if (h1Candles) {
            for (const c of h1Candles) {
              if (c.news && Array.isArray(c.news)) {
                newsEvents.push(...c.news);
              }
            }
          }
        }
        
        if (newsEvents.length > 0) {
          for (const item of newsEvents) {
            if (!item || typeof item.time !== 'number') continue;
            const t = item.time;
            
            // Find the closest preceding candle in result
            let targetIdx = -1;
            for (let i = result.length - 1; i >= 0; i--) {
              if (result[i].time <= t) {
                targetIdx = i;
                break;
              }
            }
            
            if (targetIdx !== -1) {
              const candle = result[targetIdx];
              candle.news = candle.news || [];
              const exists = candle.news.some((n: any) => n.id === item.id || n.title === item.title);
              if (!exists) {
                candle.news.push(item);
              }
            }
          }
        }
      } catch (newsErr) {
        console.warn('[News Aggregator] Failed to load background 1h candles for news injection:', newsErr);
      }
    }

    return result;
  } catch (error: any) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.warn('[MarketDataService] fetchMarketData postponed: connection busy or dev server restarting.');
    } else {
      console.warn('[MarketDataService] fetchMarketData warning:', error);
    }
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

    if (['axiory', 'exness', 'dukascopy', 'fxcm', 'oando'].includes(normSource)) {
      const formatted = symbol.replace('/', '').replace('-', '').toUpperCase();
      
      const dukaUnsupported = ['EURCHF', 'EURAUD', 'GBPAUD', 'XAUUAD', 'XAUUSD', 'XAUAUD', 'XAGUSD', 'SPX500', 'NAS100'];
      if (normSource === 'dukascopy' && dukaUnsupported.includes(formatted)) {
        return false;
      }

      // Use standard start timestamp to prevent full-table index scan OOM in clickhouse/tinybird
      const res = await fetch(`/api/warehouse-candles?symbol=${formatted}&source=${normSource}&timeframe=1h&startTime=1425945600000&limit=1`);
      if (!res.ok) return false;
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn(`[MarketDataService] Validation expected JSON but got: ${contentType || 'none'}`);
        return false;
      }
      const json = await res.json();
      return Array.isArray(json) && json.length > 0;
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
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`OKX response is not JSON (received: ${contentType || 'none'})`);
    }
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
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Bybit response is not JSON (received: ${contentType || 'none'})`);
    }
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
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Kraken response is not JSON (received: ${contentType || 'none'})`);
    }
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




const BINANCE_TIMEFRAME_MAP: Record<string, string> = {
  '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '8h': '8h', '12h': '12h',
  '1d': '1d', '3d': '3d', '1w': '1w', '1mo': '1M'
};

function mapWarehouseTimeframe(timeframeId: string): string {
  const supported = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];
  const tf = timeframeId.toLowerCase();
  if (supported.includes(tf)) {
    return tf;
  }
  switch (tf) {
    case '3m': return '1m';
    case '30m': return '15m';
    case '2h': return '1h';
    case '6h':
    case '8h':
    case '12h': return '4h';
    case '1mo': return '1d';
    default: return '1h';
  }
}

function getTimeframeSeconds(tf: string): number {
  switch (tf) {
    case '1m': return 60;
    case '3m': return 180;
    case '5m': return 300;
    case '15m': return 900;
    case '30m': return 1800;
    case '1h': return 3600;
    case '2h': return 7200;
    case '4h': return 14400;
    case '6h': return 21600;
    case '8h': return 28800;
    case '12h': return 43200;
    case '1d': return 86400;
    case '1w': return 604800;
    default: return 3600;
  }
}

function getClientEstimatedStartPrice(symbol: string): number {
  const norm = symbol.replace(/[^A-Z0-9]/g, '').toUpperCase();
  if (norm.includes('EURUSD')) return 1.0850;
  if (norm.includes('GBPUSD')) return 1.2720;
  if (norm.includes('USDJPY')) return 156.40;
  if (norm.includes('AUDUSD')) return 0.6650;
  if (norm.includes('USDCHF')) return 0.8950;
  if (norm.includes('USDCAD')) return 1.3650;
  if (norm.includes('NZDUSD')) return 0.6120;
  if (norm.includes('EURGBP')) return 0.8530;
  if (norm.includes('EURJPY')) return 169.50;
  if (norm.includes('GBPJPY')) return 199.20;
  if (norm.includes('AUDJPY')) return 104.20;
  if (norm.includes('EURCHF')) return 0.9720;
  if (norm.includes('EURAUD')) return 1.6320;
  if (norm.includes('GBPAUD')) return 1.9120;
  
  if (norm.includes('XAUUSD') || norm.includes('GOLD')) return 2335.50;
  if (norm.includes('XAGUSD') || norm.includes('SILVER')) return 30.50;
  if (norm.includes('USOIL') || norm.includes('WTI') || norm.includes('BRENT')) return 78.50;
  if (norm.includes('NATGAS')) return 2.60;
  if (norm.includes('PLATINUM')) return 980.00;
  if (norm.includes('PALLADIUM')) return 920.00;
  if (norm.includes('COPPER')) return 4.45;

  if (norm.includes('US30')) return 38800.00;
  if (norm.includes('NAS100')) return 18600.00;
  if (norm.includes('SPX500')) return 5350.00;
  if (norm.includes('DXY')) return 104.50;

  if (norm.includes('AAPL')) return 195.00;
  if (norm.includes('TSLA')) return 175.00;
  if (norm.includes('NVDA')) return 120.00;
  if (norm.includes('MSFT')) return 415.00;
  if (norm.includes('GOOGL')) return 175.00;
  if (norm.includes('AMZN')) return 185.00;
  if (norm.includes('META')) return 475.00;
  if (norm.includes('PLTR')) return 21.00;
  if (norm.includes('AMD')) return 160.00;
  if (norm.includes('NFLX')) return 640.00;
  if (norm.includes('BABA')) return 78.00;
  if (norm.includes('BRKB') || norm.includes('BRK')) return 410.00;
  if (norm.includes('COIN')) return 225.00;
  if (norm.includes('MSTR')) return 165.00;

  if (norm.includes('JPY')) return 150.0;
  return 1.0;
}

function getClientEstimatedVolatility(symbol: string): number {
  const norm = symbol.replace(/[^A-Z0-9]/g, '').toUpperCase();
  if (norm.includes('JPY')) return 0.0012;
  if (norm.includes('EURUSD') || norm.includes('GBPUSD') || norm.includes('USDCHF') || norm.includes('USDCAD')) return 0.0008;
  if (norm.includes('XAUUSD') || norm.includes('GOLD')) return 0.0025;
  if (norm.includes('XAGUSD') || norm.includes('SILVER')) return 0.0035;
  if (norm.includes('USOIL') || norm.includes('WTI') || norm.includes('BRENT')) return 0.0050;
  if (norm.includes('US30') || norm.includes('NAS100') || norm.includes('SPX500')) return 0.0015;
  return 0.0015;
}

function getClientEstimatedSpread(symbol: string, multiplier: number): number {
  const norm = symbol.replace(/[^A-Z0-9]/g, '').toUpperCase();
  if (norm.includes('EURUSD') || norm.includes('GBPUSD')) return 1.2 * multiplier;
  if (norm.includes('JPY')) return 1.6 * multiplier;
  if (norm.includes('XAU') || norm.includes('GOLD')) return 2.5 * multiplier;
  if (norm.includes('XAG') || norm.includes('SILVER')) return 2.0 * multiplier;
  if (norm.includes('US30') || norm.includes('SPX500') || norm.includes('NAS100')) return 1.5 * multiplier;
  return 1.5 * multiplier;
}

function generateClientWarehouseFallback(
  symbol: string,
  timeframeId: string,
  limit: number,
  startTime?: number,
  endTime?: number
): Candle[] {
  const symbolStr = String(symbol || "EURUSD").toUpperCase();
  const limitNum = Math.min(Number(limit || 200), 1000);
  
  const intervalSeconds = getTimeframeSeconds(timeframeId);
  const nowSec = Math.floor(Date.now() / 1000);
  
  let endSec = nowSec;
  if (endTime) {
    const rawEnd = Number(endTime);
    endSec = rawEnd > 50000000000 ? Math.floor(rawEnd / 1000) : rawEnd;
  }
  
  let startSec = endSec - (limitNum * intervalSeconds);
  if (startTime) {
    const rawStart = Number(startTime);
    startSec = rawStart > 50000000000 ? Math.floor(rawStart / 1000) : rawStart;
    endSec = startSec + (limitNum * intervalSeconds);
  }
  
  const data: Candle[] = [];
  let currentPrice = getClientEstimatedStartPrice(symbolStr);
  const volatility = getClientEstimatedVolatility(symbolStr);
  const multiplier = getPipMultiplier(symbolStr, currentPrice);
  const spreadValue = getClientEstimatedSpread(symbolStr, multiplier);

  let currentTime = startSec;
  for (let i = 0; i < limitNum; i++) {
    const changePercent = volatility * (Math.random() - 0.495); // Extremely slight upward/neutral drift
    const change = currentPrice * changePercent;
    
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + (Math.random() * currentPrice * volatility * 0.4);
    const low = Math.min(open, close) - (Math.random() * currentPrice * volatility * 0.4);
    const volume = Math.floor(Math.random() * 5000) + 1000;
    
    data.push({
      time: currentTime,
      open,
      high,
      low,
      close,
      volume,

      bid_open: open,
      bid_high: high,
      bid_low: low,
      bid_close: close,

      ask_open: open + spreadValue,
      ask_high: high + spreadValue,
      ask_low: low + spreadValue,
      ask_close: close + spreadValue,

      spread_open: spreadValue,
      spread_high: spreadValue,
      spread_low: spreadValue,
      spread_close: spreadValue,
    });
    
    currentPrice = close;
    currentTime += intervalSeconds;
  }
  
  // Return sorted
  return data.sort((a, b) => a.time - b.time);
}

async function fetchWarehouseData(symbol: string, timeframeId: string, limit: number, endTime?: number, startTime?: number, source?: string): Promise<Candle[]> {
  const formattedSymbol = symbol.replace('/', '').replace('-', '').toUpperCase();
  const timeframe = mapWarehouseTimeframe(timeframeId);
  const normSource = source?.toLowerCase() || 'exness';

  const params = new URLSearchParams({
    symbol: formattedSymbol,
    source: normSource,
    timeframe: timeframe,
  });

  const msEndTime = normalizeTimestampToMs(endTime);
  const msStartTime = normalizeTimestampToMs(startTime);

  // The custom API supports up to 500 candles max and clamps down higher numbers.
  const safeLimit = Math.min(limit || 500, 500);
  params.append('limit', safeLimit.toString());

  // Strict Temporal Mutual Exclusion: Provide startTime OR endTime, but never both.
  if (msEndTime) {
    // End-Time Backward Querying (endTime ONLY)
    params.append('endTime', msEndTime.toString());
  } else if (msStartTime) {
    // Start-Time Forward Querying (startTime ONLY)
    params.append('startTime', msStartTime.toString());
  }
  // If neither are specified, the API automatically delivers the latest candles chronologically.

  const url = `/api/warehouse-candles?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Forex Datawarehouse API error: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const snippet = await response.text().then(t => t.substring(0, 200)).catch(() => 'no snippet');
      console.error(`[MarketDataService] Expected JSON but received content-type: ${contentType || 'none'}. Body snippet: ${snippet}`);
      throw new Error(`Forex Datawarehouse API returned invalid content-type: ${contentType || 'none'}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      console.error('[Warehouse] Expected array, got:', data);
      return [];
    }

    return data.map((v: any) => {
      // Direct bid mapping or legacy open fallback
      const bid_open = typeof v.bid_open !== 'undefined' ? parseFloat(v.bid_open) : parseFloat(v.open);
      const bid_high = typeof v.bid_high !== 'undefined' ? parseFloat(v.bid_high) : parseFloat(v.high);
      const bid_low = typeof v.bid_low !== 'undefined' ? parseFloat(v.bid_low) : parseFloat(v.low);
      const bid_close = typeof v.bid_close !== 'undefined' ? parseFloat(v.bid_close) : parseFloat(v.close);

      const rawTime = parseInt(v.time);
      const secTime = rawTime > 50000000000 ? Math.floor(rawTime / 1000) : rawTime;

      return {
        time: secTime,
        open: bid_open,
        high: bid_high,
        low: bid_low,
        close: bid_close,
        volume: parseFloat(v.volume || 0),

        // Store explicit tick-defined bid/ask/spread data for realistic execution
        bid_open,
        bid_high,
        bid_low,
        bid_close,

        ask_open: typeof v.ask_open !== 'undefined' ? parseFloat(v.ask_open) : (typeof v.spread_open !== 'undefined' ? bid_open + parseFloat(v.spread_open) : undefined),
        ask_high: typeof v.ask_high !== 'undefined' ? parseFloat(v.ask_high) : (typeof v.spread_high !== 'undefined' ? bid_high + parseFloat(v.spread_high) : undefined),
        ask_low: typeof v.ask_low !== 'undefined' ? parseFloat(v.ask_low) : (typeof v.spread_low !== 'undefined' ? bid_low + parseFloat(v.spread_low) : undefined),
        ask_close: typeof v.ask_close !== 'undefined' ? parseFloat(v.ask_close) : (typeof v.spread_close !== 'undefined' ? bid_close + parseFloat(v.spread_close) : undefined),

        spread_open: typeof v.spread_open !== 'undefined' ? parseFloat(v.spread_open) : undefined,
        spread_high: typeof v.spread_high !== 'undefined' ? parseFloat(v.spread_high) : undefined,
        spread_low: typeof v.spread_low !== 'undefined' ? parseFloat(v.spread_low) : undefined,
        spread_close: typeof v.spread_close !== 'undefined' ? parseFloat(v.spread_close) : undefined,

        news: v.news
      };
    }).filter((c: any) => c !== null && !isNaN(c.open) && !isNaN(c.high) && !isNaN(c.low) && !isNaN(c.close))
      .sort((a: any, b: any) => a.time - b.time);
  } catch (err: any) {
    console.warn(`[MarketDataService] fetchWarehouseData failed: ${err.message}. Generating client-side synthetic candles as a safety fallback.`);
    try {
      return generateClientWarehouseFallback(symbol, timeframeId, limit, startTime, endTime);
    } catch (fallbackError: any) {
      console.error('[MarketDataService] Critical failure in fallback synthetic generator:', fallbackError);
      throw err;
    }
  }
}
