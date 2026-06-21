/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle } from '../types';
import { POPULAR_SYMBOLS } from '../constants/symbols';
import { MarketDataSource } from '../types/watchlist';
import { normalizeTimestampToMs, normalizeTimestampToSeconds, getPipMultiplier } from '../lib/marketUtils';

const dataCache = new Map<string, { data: Candle[], timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes cache TTL for blazing fast timeframe switches

// Memory cache to store fetched news per symbol to completely prevent redundant background network fetches
const symbolNewsCache = new Map<string, any[]>();
const newsFetchingSymbols = new Set<string>();

// Helper to inject news events into candles
function injectNewsEvents(candles: Candle[], newsEvents: any[]): void {
  if (!newsEvents || newsEvents.length === 0 || !candles || candles.length === 0) return;
  for (const item of newsEvents) {
    if (!item || typeof item.time !== 'number') continue;
    const t = item.time;
    
    // Find the closest preceding candle in candles
    let targetIdx = -1;
    for (let i = candles.length - 1; i >= 0; i--) {
      if (candles[i].time <= t) {
        targetIdx = i;
        break;
      }
    }
    
    if (targetIdx !== -1) {
      const candle = candles[targetIdx];
      candle.news = candle.news || [];
      const exists = candle.news.some((n: any) => n.id === item.id || n.title === item.title);
      if (!exists) {
        candle.news.push(item);
      }
    }
  }
}

export function clearMarketDataCache(): void {
  dataCache.clear();
}

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

  let result: Candle[] = [];
  try {
    if (category === 'Crypto') {
      const cryptoSource = source?.toLowerCase() || 'binance';
      try {
        result = await fetchWarehouseData(symbol, timeframeId, limit, endTime, startTime, cryptoSource, marketType);
        if (!result || result.length < 5) {
          throw new Error('Incomplete data from warehouse');
        }
      } catch (warehouseErr) {
        console.warn(`[MarketDataService] Warehouse fetch failed or empty for crypto. Falling back to direct client-side exchange API. Source: ${cryptoSource}`, warehouseErr);
        if (cryptoSource === 'binance') {
          result = await fetchBinanceData(symbol, timeframeId, limit, endTime, startTime, marketType);
        } else if (cryptoSource === 'bybit') {
          result = await fetchBybitData(symbol, timeframeId, limit, endTime, startTime, marketType);
        } else if (cryptoSource === 'okx') {
          result = await fetchOkxData(symbol, timeframeId, limit, endTime, startTime, marketType);
        } else if (cryptoSource === 'kraken') {
          result = await fetchKrakenData(symbol, timeframeId, limit, endTime, startTime);
        } else {
          result = await fetchBinanceData(symbol, timeframeId, limit, endTime, startTime, marketType);
        }
      }
    } else {
      const normSource = ['axiory', 'exness', 'dukascopy', 'fxcm', 'oando'].includes(source?.toLowerCase() || '') ? (source?.toLowerCase() || '') : 'exness';
      result = await fetchWarehouseData(symbol, timeframeId, limit, endTime, startTime, normSource);
    }
    
    if (result && result.length >= 50) {
      dataCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }

    // Timeframe-independent news injection (Asynchronously non-blocking to prevent UI/API render delays!)
    if (result && result.length > 0 && timeframeId !== '1h') {
      const symbolKey = symbol.toUpperCase();
      const cachedNewsForSymbol = symbolNewsCache.get(symbolKey);
      
      if (cachedNewsForSymbol && cachedNewsForSymbol.length > 0) {
        // Instant memory lookup! Completely bypasses background network calls.
        injectNewsEvents(result, cachedNewsForSymbol);
      } else if (!newsFetchingSymbols.has(symbolKey)) {
        newsFetchingSymbols.add(symbolKey);
        (async () => {
          try {
            const firstTime = result[0].time;
            const lastTime = result[result.length - 1].time;
            
            // Calculate the total duration spanned by the loaded candles in hours
            const totalDurationHours = Math.ceil((lastTime - firstTime) / 3600);
            const chunkSize = 500;
            const numChunks = Math.min(4, Math.ceil(totalDurationHours / chunkSize));
            
            const chunkPromises: Promise<Candle[]>[] = [];
            for (let i = 0; i < numChunks; i++) {
              const chunkEndTime = lastTime + 18000 - (i * chunkSize * 3600);
              if (chunkEndTime > firstTime - 18000) {
                // Fetch directly from the backend API warehouse to keep it extremely light and isolated
                chunkPromises.push(
                  fetchWarehouseData(symbol, '1h', chunkSize, chunkEndTime, undefined, source, marketType)
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
              // De-duplicate news events
              const uniqueNewsMap = new Map<string, any>();
              for (const item of newsEvents) {
                if (item && item.id) {
                  uniqueNewsMap.set(String(item.id), item);
                } else if (item && item.title) {
                  uniqueNewsMap.set(item.title, item);
                }
              }
              const deduplicatedNews = Array.from(uniqueNewsMap.values());
              
              symbolNewsCache.set(symbolKey, deduplicatedNews);
              injectNewsEvents(result, deduplicatedNews);
            }
          } catch (newsErr) {
            console.warn('[News Aggregator] Failed to load background 1h candles for news injection:', newsErr);
          } finally {
            newsFetchingSymbols.delete(symbolKey);
          }
        })();
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
    if (['binance', 'okx', 'bybit', 'kraken', 'coinbase', 'gemini', 'bitflyer'].includes(normSource)) {
      const formatted = symbol.replace('/', '').replace('-', '').toUpperCase();
      let finalTradeType = marketType.toLowerCase();
      if (finalTradeType === 'spot') finalTradeType = 'spot';
      else if (finalTradeType === 'usdt-futures' || finalTradeType === 'usdt_futures' || finalTradeType === 'usdt_future') finalTradeType = 'usdt_future';
      else if (finalTradeType === 'coin-futures' || finalTradeType === 'coin_futures' || finalTradeType === 'coin_future') finalTradeType = 'coin_future';
      else finalTradeType = finalTradeType.replace('-', '_');

      const res = await fetch(`/api/warehouse-candles?symbol=${formatted}&source=${normSource}&timeframe=1h&limit=1&tradeType=${finalTradeType}`);
      if (!res.ok) return false;
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return false;
      }
      const json = await res.json();
      return Array.isArray(json) && json.length > 0;
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

async function fetchFromOkxProxyOrDirect(queryParams: URLSearchParams): Promise<any> {
  const proxyUrl = `/api/okx?${queryParams.toString()}`;
  try {
    const response = await fetch(proxyUrl);
    if (response.ok) {
      const data = await response.json();
      if (data && data.data) return data;
    }
    throw new Error(`Proxy status: ${response.status}`);
  } catch (proxyErr) {
    console.warn("[Proxy OKX Fallback] OKX proxy failed. Trying direct client-side fallback...", proxyErr);
    
    // Fallback directly to native OKX endpoints
    const okxBases = [
      'https://aws.okx.com',
      'https://www.okx.com',
      'https://okx.com'
    ];
    
    const after = queryParams.get('after');
    const before = queryParams.get('before');
    const pathsToTry = (after || before) 
      ? ['/api/v5/market/history-candles'] 
      : ['/api/v5/market/candles', '/api/v5/market/history-candles'];

    // Clone and strip 'marketType' which isn't recognized by native OKX API
    const directParams = new URLSearchParams(queryParams);
    directParams.delete('marketType');

    for (const base of okxBases) {
      for (const endpointPath of pathsToTry) {
        const directUrl = `${base}${endpointPath}?${directParams.toString()}`;
        try {
          const res = await fetch(directUrl);
          if (res.ok) {
            const data = await res.json();
            if (data && data.code === "0" && data.data) {
              console.log(`[Proxy OKX Fallback] Successfully fetched directly from ${base}${endpointPath}`);
              return data;
            }
          }
        } catch (directErr) {
          console.warn(`[Proxy OKX Fallback] Direct fetch from ${base}${endpointPath} failed:`, directErr);
        }
      }
    }
    
    throw proxyErr;
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

  const tfSeconds = getTimeframeSeconds(timeframeId);
  const allRawCandles: any[] = [];

  try {
    if (msEndTime) {
      // 1. Fetching PAST data (going backward from msEndTime)
      let currentAfter = msEndTime + 1000;
      let fetchedCount = 0;
      const maxPages = Math.ceil(limit / 100);

      for (let p = 0; p < maxPages; p++) {
        const queryParams = new URLSearchParams({
          instId: okxSymbol,
          bar,
          limit: Math.min(limit - fetchedCount, 100).toString(),
          after: currentAfter.toString(),
          marketType: marketType || 'spot'
        });
        
        let json;
        try {
          json = await fetchFromOkxProxyOrDirect(queryParams);
        } catch (err) {
          console.warn(`OKX page ${p} fetch failed:`, err);
          break;
        }
        const data = json.data || [];
        if (data.length === 0) break;

        allRawCandles.push(...data);
        fetchedCount += data.length;

        // The oldest candle is the last item in OKX's newest-first response. We set currentAfter to its timestamp to get older candles on next iteration.
        const oldestCandleTimestamp = parseInt(data[data.length - 1][0]);
        if (isNaN(oldestCandleTimestamp)) break;
        currentAfter = oldestCandleTimestamp;

        if (data.length < 100) break;
      }
    } else if (msStartTime) {
      // 2. Fetching FUTURE data (going forward starting from msStartTime)
      // Since OKX's history-candles endpoint returns the absolute newest candles first,
      // to avoid receiving the global newest candles and creating massive gaps,
      // we load sequentially in forward-sliding chunks. Each chunk defines chunkEndTimeMs = currentStart + chunkSpan
      // and passes after = chunkEndTimeMs to fetch candles going backward down to currentStart.
      let currentStartTime = msStartTime;
      let fetchedCount = 0;
      const targetCount = limit;
      const maxPages = Math.ceil(targetCount / 100);

      for (let p = 0; p < maxPages; p++) {
        const chunkSize = Math.min(targetCount - fetchedCount, 100);
        const chunkEndTimeMs = currentStartTime + (chunkSize * tfSeconds * 1000);
        
        const queryParams = new URLSearchParams({
          instId: okxSymbol,
          bar,
          limit: chunkSize.toString(),
          after: (chunkEndTimeMs + 1000).toString(),
          marketType: marketType || 'spot'
        });

        let json;
        try {
          json = await fetchFromOkxProxyOrDirect(queryParams);
        } catch (err) {
          console.warn(`OKX future page ${p} fetch failed:`, err);
          break;
        }
        const data = json.data || [];
        if (data.length === 0) break;

        allRawCandles.push(...data);
        fetchedCount += data.length;

        // Move the sliding window forward
        const newestCandleTimestamp = parseInt(data[0][0]);
        if (!isNaN(newestCandleTimestamp) && newestCandleTimestamp > currentStartTime) {
          currentStartTime = newestCandleTimestamp + tfSeconds * 1000;
        } else {
          currentStartTime = chunkEndTimeMs + tfSeconds * 1000;
        }

        if (data.length < chunkSize) break;
      }
    } else {
      // 3. Current newest candles
      const queryParams = new URLSearchParams({
        instId: okxSymbol,
        bar,
        limit: Math.min(limit, 100).toString(),
        marketType: marketType || 'spot'
      });
      const json = await fetchFromOkxProxyOrDirect(queryParams);
      allRawCandles.push(...(json.data || []));
    }

    let candles = allRawCandles.map((d: any) => ({
      time: Math.floor(parseInt(d[0]) / 1000),
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    })).filter((c: any) => !isNaN(c.time) && !isNaN(c.open));

    // Remove duplicates by timestamp
    const seen = new Set<number>();
    candles = candles.filter((c: any) => {
      if (seen.has(c.time)) return false;
      seen.add(c.time);
      return true;
    });

    if (endTime) {
      candles = candles.filter((c: any) => c.time <= endTime);
    }
    if (startTime) {
      candles = candles.filter((c: any) => c.time >= startTime);
    }

    return candles.sort((a: any, b: any) => a.time - b.time);
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

  if (msStartTime) {
    queryParams.append('start', msStartTime.toString());
  }
  if (msEndTime) {
    queryParams.append('end', msEndTime.toString());
  }

  let list: any[] = [];
  try {
    const response = await fetch(`/api/bybit?${queryParams.toString()}`);
    if (!response.ok) throw new Error(`Bybit error: ${response.status}`);
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Bybit response is not JSON (received: ${contentType || 'none'})`);
    }
    const json = await response.json();
    list = json.result?.list || [];
  } catch (err) {
    console.warn("[Proxy Bybit Fallback] Bybit proxy failed. Trying direct client-side fallback...", err);
    
    // Direct client fallback
    const bybitBases = [
      'https://api.bybit.com',
      'https://api.bytick.com'
    ];
    
    const directParams = new URLSearchParams({
      symbol: bbSymbol,
      interval,
      limit: Math.min(limit, 200).toString()
    });
    if (msStartTime) directParams.append('start', msStartTime.toString());
    if (msEndTime) directParams.append('end', msEndTime.toString());

    let directSuccess = false;
    for (const base of bybitBases) {
      const url = `${base}/v5/market/kline?${directParams.toString()}`;
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const json = await resp.json();
          if (json.result?.list) {
            list = json.result.list;
            directSuccess = true;
            console.log(`[Proxy Bybit Fallback] Successfully fetched directly from Bybit: ${base}`);
            break;
          }
        }
      } catch (directErr) {
        console.warn(`[Proxy Bybit Fallback] Direct fetch from ${base} failed:`, directErr);
      }
    }

    if (!directSuccess) {
      console.error('Bybit fetch error (both proxy and direct failed):', err);
      return [];
    }
  }

  return list.map((d: any) => ({
    time: Math.floor(parseInt(d[0]) / 1000),
    open: parseFloat(d[1]),
    high: parseFloat(d[2]),
    low: parseFloat(d[3]),
    close: parseFloat(d[4]),
    volume: parseFloat(d[5]),
  })).filter((c: any) => !isNaN(c.time) && !isNaN(c.open)).sort((a: any, b: any) => a.time - b.time);
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
  let data: any = null;
  
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

    try {
      const response = await fetchWithRetry(url);
      if (!response.ok) {
        throw new Error(`Proxy error code ${response.status}`);
      }
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Proxy response not JSON`);
      }
      data = await response.json();
    } catch (proxyError) {
      console.warn("[Proxy Binance Fallback] Proxy failed. Trying direct client fallback...", proxyError);
      
      let directBases = [`https://api.binance.com`, `https://api-gcp.binance.com`, `https://api1.binance.com` ];
      let directEndpoint = `/api/v3/klines`;

      if (marketType === 'usdt-futures') {
        directBases = [`https://fapi.binance.com` ];
        directEndpoint = `/fapi/v1/klines`;
      } else if (marketType === 'coin-futures') {
        directBases = [`https://dapi.binance.com` ];
        directEndpoint = `/dapi/v1/klines`;
      }

      const directParams = new URLSearchParams({
        symbol: normalizedSymbol,
        interval,
        limit: Math.min(limit, 1000).toString()
      });
      if (msEndTime) directParams.append('endTime', msEndTime.toString());
      if (msStartTime) directParams.append('startTime', msStartTime.toString());

      let success = false;
      for (const base of directBases) {
        const directUrl = `${base}${directEndpoint}?${directParams.toString()}`;
        try {
          const directResp = await fetch(directUrl);
          if (directResp.ok) {
            data = await directResp.json();
            success = true;
            console.log(`[Proxy Binance Fallback] Direct fetch successful from ${base}`);
            break;
          }
        } catch (directErr) {
          console.warn(`[Proxy Binance Fallback] Direct fetch from ${base} failed:`, directErr);
        }
      }

      if (!success) {
        throw proxyError;
      }
    }
    
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
    const message = isNetworkError ? `Network error: Could not reach the proxy server or Binance API.` : (error instanceof Error ? error.message : String(error));
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

async function fetchWarehouseData(symbol: string, timeframeId: string, limit: number, endTime?: number, startTime?: number, source?: string, marketType?: string): Promise<Candle[]> {
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

  if (marketType) {
    const mt = marketType.toLowerCase();
    let finalTradeType = mt;
    if (mt === 'spot') finalTradeType = 'spot';
    else if (mt === 'usdt-futures' || mt === 'usdt_futures' || mt === 'usdt_future') finalTradeType = 'usdt_future';
    else if (mt === 'coin-futures' || mt === 'coin_futures' || mt === 'coin_future') finalTradeType = 'coin_future';
    else finalTradeType = mt.replace('-', '_');
    params.append('tradeType', finalTradeType);
  }

  const url = `/api/warehouse-candles?${params.toString()}`;

  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
      lastError = err;
      console.warn(`[MarketDataService] fetchWarehouseData attempt ${attempt} failed: ${err.message}.`);
      if (attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }

  throw lastError || new Error(`Failed to load Forex Data after ${maxRetries} attempts`);
}
