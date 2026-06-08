import { Candle, IndicatorInstance } from '../types';

export interface ChartStateCache {
  symbol: string;
  timeframeId: string;
  candles: Candle[];
  simCurrentTime: number | null;
  replayCurrentTime: number | null;
  indicators: IndicatorInstance[];
}

export class ChartCacheDB {
  private dbName = 'FirstLookChartCache';
  private dbVersion = 3; // Upgraded version
  private db: IDBDatabase | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onupgradeneeded = (e) => {
        const db = request.result;
        if (!db.objectStoreNames.contains('candles_v3')) {
          db.createObjectStore('candles_v3', { keyPath: 'key' });
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async get(key: string): Promise<ChartStateCache | null> {
    try {
      const db = await this.init();
      return new Promise((resolve) => {
        const transaction = db.transaction('candles_v3', 'readonly');
        const store = transaction.objectStore('candles_v3');
        const request = store.get(key);
        request.onsuccess = () => {
          resolve(request.result ? request.result.data : null);
        };
        request.onerror = () => resolve(null);
      });
    } catch (err) {
      console.warn('[CacheDB] get cache failed:', err);
      return null;
    }
  }

  async set(key: string, data: ChartStateCache): Promise<void> {
    try {
      const db = await this.init();
      return new Promise((resolve) => {
        const transaction = db.transaction('candles_v3', 'readwrite');
        const store = transaction.objectStore('candles_v3');
        store.put({ key, data, updatedAt: Date.now() });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
      });
    } catch (err) {
      console.warn('[CacheDB] set cache failed:', err);
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.init();
      return new Promise((resolve) => {
        const transaction = db.transaction('candles_v3', 'readwrite');
        const store = transaction.objectStore('candles_v3');
        store.clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
      });
    } catch (err) {
      console.warn('[CacheDB] clear failed:', err);
    }
  }
}

// In-memory cache map
const inMemoryCache = new Map<string, ChartStateCache>();
const dbInstance = new ChartCacheDB();

// Build a unique key for the symbol + timeframe
export function getCacheKey(symbol: string, timeframeId: string, prefix?: string): string {
  const cleanSymbol = symbol.replace('/', '_').toUpperCase();
  const cleanPrefix = prefix ? `_${prefix}` : '';
  return `${cleanSymbol}${cleanPrefix}_${timeframeId}`;
}

// Pruning candles helper to keep candles around active playback head + at least 500 future candles
export function pruneCachedCandles(candles: Candle[], playbackTime: number | null): Candle[] {
  if (candles.length === 0) return candles;
  
  // If no playback head is established, use the latest candle as dummy reference
  const referenceTime = playbackTime !== null ? playbackTime : candles[candles.length - 1].time;
  
  // Find index of the playback position (close match)
  let playbackIndex = candles.findIndex(c => c.time >= referenceTime);
  if (playbackIndex === -1) {
    playbackIndex = candles.length - 1;
  }

  // Slice around playback reference index.
  // We keep up to 1000 past candles to compile smooth historical indicators (MA, Bollinger Bands, MACD, etc.)
  // and keep at least 500 future candles from playbackTime to prevent unnecessary storage growth.
  const startIdx = Math.max(0, playbackIndex - 1000);
  const endIdx = Math.min(candles.length, playbackIndex + 600); // 500 candles limit with some extra bumpers

  return candles.slice(startIdx, endIdx);
}

// Main save cache function
export async function saveChartStateToCache(
  symbol: string,
  timeframeId: string,
  prefix: string | undefined,
  candles: Candle[],
  simCurrentTime: number | null,
  replayCurrentTime: number | null,
  indicators: IndicatorInstance[]
): Promise<void> {
  const key = getCacheKey(symbol, timeframeId, prefix);
  
  // Prune candles before saving to prevent storage growth
  const prunedCandles = pruneCachedCandles(candles, simCurrentTime || replayCurrentTime);

  const cacheState: ChartStateCache = {
    symbol,
    timeframeId,
    candles: prunedCandles,
    simCurrentTime,
    replayCurrentTime,
    indicators
  };

  // 1. Save in-memory
  inMemoryCache.set(key, cacheState);

  // 2. Save to IndexedDB
  await dbInstance.set(key, cacheState);
}

// Get from Cache with Priority Layers
export function getChartStateFromCacheSync(
  symbol: string,
  timeframeId: string,
  prefix?: string
): ChartStateCache | null {
  const key = getCacheKey(symbol, timeframeId, prefix);
  return inMemoryCache.get(key) || null;
}

export async function getChartStateFromCache(
  symbol: string,
  timeframeId: string,
  prefix?: string
): Promise<ChartStateCache | null> {
  const key = getCacheKey(symbol, timeframeId, prefix);

  // Layer 1: In-memory
  if (inMemoryCache.has(key)) {
    return inMemoryCache.get(key) || null;
  }

  // Layer 2: IndexedDB
  const dbData = await dbInstance.get(key);
  if (dbData) {
    // Populate in-memory for subsequent loads
    inMemoryCache.set(key, dbData);
    return dbData;
  }

  return null;
}

// Clear setup caches
export async function clearAllLocalChartCaches(): Promise<void> {
  inMemoryCache.clear();
  await dbInstance.clear();
}

/**
 * Assesses whether the cached candles cover the requested past and future time ranges.
 * If there is some coverage but some parts are missing, we query only the missing intervals.
 */
export function getMissingCandleRanges(
  cachedCandles: Candle[],
  targetTime: number,
  needFuture: boolean
): {
  needPast: boolean;
  needPastTargetTime: number;
  needPastCount: number;
  needFuture: boolean;
  needFutureStartTime: number;
} {
  if (cachedCandles.length === 0) {
    return {
      needPast: true,
      needPastTargetTime: targetTime,
      needPastCount: 500,
      needFuture: needFuture,
      needFutureStartTime: targetTime + 1
    };
  }

  const oldestTime = cachedCandles[0].time;
  const newestTime = cachedCandles[cachedCandles.length - 1].time;

  let needPast = false;
  let needPastTargetTime = targetTime;
  let needPastCount = 500;

  let needFutureReq = false;
  let needFutureStartTime = targetTime + 1;

  // 1. Past candles coverage
  if (targetTime < oldestTime) {
    // We are requesting an earlier point which is before any of our cached candles
    needPast = true;
    needPastTargetTime = targetTime;
    needPastCount = 500;
  } else if (targetTime > newestTime) {
    // We request a targetTime that is ahead of whatever we cached
    needPast = true;
    needPastTargetTime = targetTime;
    needPastCount = 500;
  }

  // 2. Future candles coverage
  if (needFuture) {
    const futureCandles = cachedCandles.filter(c => c.time > targetTime);
    if (futureCandles.length < 500) {
      needFutureReq = true;
      needFutureStartTime = newestTime + 1;
    }
  }

  return {
    needPast,
    needPastTargetTime,
    needPastCount,
    needFuture: needFutureReq,
    needFutureStartTime
  };
}
