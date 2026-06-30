import { IndicatorInstance, ChartTheme, JournalTrade } from '../types';
import { Drawing } from '../types/drawing';

export interface UserPreferences {
  theme: ChartTheme;
  indicators: IndicatorInstance[];
  activeTab: string;
  selectedTimeframeId: string;
  activeWatchlistTab?: 'ongoing' | 'completed';
  toolbarPosition?: { x: number; y: number };
  favoritesPosition?: { x: number; y: number };
  simControlsPosition?: { x: number; y: number };
  
  // Orientation-specific positions
  toolbarPositionPortrait?: { x: number; y: number };
  favoritesPositionPortrait?: { x: number; y: number };
  simControlsPositionPortrait?: { x: number; y: number };
  
  // Mode-specific states
  showFavoritesByMode?: Record<string, boolean>;
  showToolbarByMode?: Record<string, boolean>;
  positionsByMode?: Record<string, Record<string, {x: number, y: number}>>;
  drawingSettingsPosByMode?: Record<string, {x: number, y: number} | null>;

  favorites?: string[];
  showFavorites?: boolean;
  showToolbar?: boolean;
  drawingSettings?: any;
  lastSelectedSymbol?: string | null;
  activePrefix?: string | null;
  activeWatchlistItemId?: string | null;
  pinnedText?: string | null;
  streakCount?: number;
  longestStreak?: number;
  lastLoginDate?: string;
  subscriptionPlan?: 'basic' | 'plus' | 'premium';
  celebratedMilestones?: number[];
  drawingTemplates?: Record<string, any[]>;
  symbolViewStates?: Record<string, any>;
  dailyPlayLimitTracker?: { date: string; consumed: number };
  dailyJournalReplaysTracker?: { date: string; consumed: number };
  dailySyncChartsTracker?: { date: string; consumed: number };
  dailyWhatIfTracker?: { date: string; consumed: number };
}

// Helper to handle fetch abort on timeout to prevent hanging when offline
async function fetchWithTimeout(resource: string, options?: RequestInit & { timeout?: number }) {
  const { timeout = 3500, ...rest } = options || {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(resource, {
      ...rest,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// --- Drawing Compression & Optimization Helpers to Minimize Database & Payload Space ---
function simplifyPathPoints(points: any[]): any[] {
  if (!points || points.length <= 2) return points;
  const result: any[] = [points[0]];
  let lastPoint = points[0];
  
  for (let i = 1; i < points.length - 1; i++) {
    const pt = points[i];
    const timeDiff = Math.abs(pt.time - lastPoint.time);
    const priceDiff = Math.abs(pt.price - lastPoint.price);
    
    // Skip intermediate points that are extremely close in time (less than 2.5s) and price (less than 0.05 pips)
    if (timeDiff < 2500 && priceDiff < 0.000005) {
      continue;
    }
    result.push(pt);
    lastPoint = pt;
  }
  result.push(points[points.length - 1]);
  return result;
}

export function compressDrawing(d: Drawing): any {
  const rPrice = (p: any): number => {
    if (typeof p !== 'number' || isNaN(p)) return 0;
    return Math.round(p * 1000000) / 1000000; // Round to 6 decimals max for extreme space optimization
  };
  const rTime = (t: any): number => {
    if (typeof t !== 'number' || isNaN(t)) return 0;
    return Math.floor(t);
  };

  let rawPts = d.points || [];
  if (d.type === 'BRUSH' || d.type === 'PATH') {
    rawPts = simplifyPathPoints(rawPts);
  }

  // Convert points to compact array structure [[time, price]] to omit redundant object keys
  const compactPts = rawPts.map(pt => [rTime(pt.time), rPrice(pt.price)] as [number, number]);

  const compactedSettings: Record<string, any> = {};
  if (d.settings) {
    for (const [key, val] of Object.entries(d.settings)) {
      if (typeof val === 'number') {
        compactedSettings[key] = rPrice(val);
      } else {
        compactedSettings[key] = val;
      }
    }
  }

  let statusCompact: string | undefined = undefined;
  if (d.status === 'active') statusCompact = 'a';
  else if (d.status === 'won') statusCompact = 'w';
  else if (d.status === 'lost') statusCompact = 'l';

  return {
    i: d.id,
    s: d.symbol,
    p: d.prefix || undefined,
    w: d.watchlistId || undefined,
    t: d.type,
    pts: compactPts,
    st: compactedSettings,
    fav: d.isFavorite ? 1 : undefined,
    trg: d.isTriggered ? 1 : undefined,
    appr: d.isPipelineApproved ? 1 : undefined,
    aa: d.approvedAt || undefined,
    ap: d.approvedPrice || undefined,
    ta: d.triggeredAt ? rTime(d.triggeredAt) : undefined,
    pa: d.placedAt ? rTime(d.placedAt) : undefined,
    msp: d.managedStopPrice ? rPrice(d.managedStopPrice) : undefined,
    isp: d.initialStopPrice ? rPrice(d.initialStopPrice) : undefined,
    stt: statusCompact,
    sta: d.statusAt ? rTime(d.statusAt) : undefined
  };
}

export function decompressDrawing(c: any): Drawing {
  // Gracefully handle standard drawings that are already uncompressed (backward compatibility)
  if (c && typeof c === 'object' && ('id' in c || ('points' in c && Array.isArray(c.points)))) {
    return c as Drawing;
  }

  const decompactPts = (c.pts || []).map((tuple: any) => {
    if (Array.isArray(tuple)) {
      return { time: tuple[0], price: tuple[1] };
    }
    return tuple;
  });

  let statusFull: 'active' | 'won' | 'lost' | undefined = undefined;
  if (c.stt === 'a') statusFull = 'active';
  else if (c.stt === 'w') statusFull = 'won';
  else if (c.stt === 'l') statusFull = 'lost';

  return {
    id: c.i || '',
    symbol: c.s || '',
    prefix: c.p || undefined,
    watchlistId: c.w || undefined,
    type: c.t,
    points: decompactPts,
    settings: c.st || {},
    isFavorite: c.fav === 1,
    isTriggered: c.trg === 1,
    isPipelineApproved: c.appr === 1,
    approvedAt: c.aa || undefined,
    approvedPrice: c.ap || undefined,
    triggeredAt: c.ta || undefined,
    placedAt: c.pa || undefined,
    managedStopPrice: c.msp || undefined,
    initialStopPrice: c.isp || undefined,
    status: statusFull,
    statusAt: c.sta || undefined
  };
}

export const persistenceService = {
  // --- Trade Journal ---
  async saveTrade(userId: string, trade: JournalTrade) {
    try {
      // Maps UI properties to the server layout table format
      const payload = {
        id: trade.id,
        symbol: trade.symbol,
        prefix: trade.prefix,
        type: trade.type,
        entryTime: trade.entryTime,
        exitTime: trade.exitTime,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        rr: trade.rr,
        status: trade.status,
        pips: trade.pips,
        timeframe: trade.timeframe,
        duration: trade.duration,
        drawingId: trade.drawingId,
        watchlistId: trade.watchlistId,
        setupGrade: trade.setupGrade,
        confluences: trade.confluences,
        notes: trade.notes,
        realizedAt: trade.realizedAt || new Date().toISOString()
      };

      // 1. Save locally first for offline availability
      try {
        const localKey = `trades_${userId}`;
        const existingRaw = localStorage.getItem(localKey);
        const list = existingRaw ? JSON.parse(existingRaw) : [];
        const filtered = list.filter((t: any) => t.id !== trade.id);
        filtered.push(payload);
        localStorage.setItem(localKey, JSON.stringify(filtered));
      } catch (localErr) {
        console.error('[PersistenceService] Local storage saveTrade failed', localErr);
      }

      // 2. Sync with server database in background
      const response = await fetchWithTimeout('/api/persistence/save-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, trade: payload })
      });

      if (!response.ok) {
        throw new Error('Failed to save trade to backend database');
      }
    } catch (err) {
      console.warn('[PersistenceService] saveTrade error (using local backup):', err);
    }
  },

  async getTrades(userId: string): Promise<JournalTrade[]> {
    // 1. Load from localStorage immediately so we can fallback instantly (or merge)
    let localBackup: any[] = [];
    try {
      const localKey = `trades_${userId}`;
      const existingRaw = localStorage.getItem(localKey);
      if (existingRaw) {
        localBackup = JSON.parse(existingRaw);
      }
    } catch (e) {
      console.error('[PersistenceService] getTrades local cache read failed', e);
    }

    try {
      const response = await fetchWithTimeout(`/api/persistence/get-trades?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Network error loading trades');
      }

      const data = await response.json();
      const rawTrades = data.trades || [];

      // Save to local cache
      try {
        localStorage.setItem(`trades_${userId}`, JSON.stringify(rawTrades));
      } catch (lsErr) {}

      return rawTrades.map((t: any) => {
        const entryTime = Number(t.entry_time ?? t.entryTime);
        const exitTime = Number(t.exit_time ?? t.exitTime);
        return {
          id: t.id,
          user_id: t.user_id || t.userId,
          symbol: t.symbol || '',
          prefix: t.prefix,
          type: (t.type || 'LONG') as 'LONG' | 'SHORT',
          entryTime: isFinite(entryTime) ? entryTime : 0,
          exitTime: isFinite(exitTime) ? exitTime : 0,
          entryPrice: Number(t.entry_price ?? t.entryPrice) || 0,
          exitPrice: Number(t.exit_price ?? t.exitPrice) || 0,
          rr: Number(t.rr) || 0,
          status: (t.status || 'SL') as 'TP' | 'SL',
          pips: Number(t.pips) || 0,
          timeframe: t.timeframe || '1m',
          duration: t.duration || '0m',
          drawingId: t.drawing_id ?? t.drawingId,
          watchlistId: t.watchlist_id ?? t.watchlistId,
          setupGrade: t.setup_grade ?? t.setupGrade,
          confluences: typeof t.confluences === 'string' ? JSON.parse(t.confluences) : (t.confluences || []),
          notes: t.notes,
          createdAt: t.created_at ?? t.createdAt,
          realizedAt: t.realized_at ?? t.realizedAt
        };
      });
    } catch (err) {
      console.warn('[PersistenceService] getTrades (falling back to local storage):', err);
      return localBackup.map((t: any) => {
        const entryTime = Number(t.entryTime ?? t.entry_time);
        const exitTime = Number(t.exitTime ?? t.exit_time);
        return {
          id: t.id,
          user_id: t.userId ?? t.user_id,
          symbol: t.symbol || '',
          prefix: t.prefix,
          type: (t.type || 'LONG') as 'LONG' | 'SHORT',
          entryTime: isFinite(entryTime) ? entryTime : 0,
          exitTime: isFinite(exitTime) ? exitTime : 0,
          entryPrice: Number(t.entryPrice ?? t.entry_price) || 0,
          exitPrice: Number(t.exitPrice ?? t.exit_price) || 0,
          rr: Number(t.rr) || 0,
          status: (t.status || 'SL') as 'TP' | 'SL',
          pips: Number(t.pips) || 0,
          timeframe: t.timeframe || '1m',
          duration: t.duration || '0m',
          drawingId: t.drawingId ?? t.drawing_id,
          watchlistId: t.watchlistId ?? t.watchlist_id,
          setupGrade: t.setupGrade ?? t.setup_grade,
          confluences: typeof t.confluences === 'string' ? JSON.parse(t.confluences) : (t.confluences || []),
          notes: t.notes,
          createdAt: t.createdAt ?? t.created_at,
          realizedAt: t.realizedAt ?? t.realized_at
        };
      });
    }
  },

  // --- Drawings ---
  async saveDrawings(userId: string, drawings: Drawing[]) {
    try {
      const optimized = drawings.map(compressDrawing);

      // 1. Cache locally first
      try {
        localStorage.setItem(`drawings_${userId}`, JSON.stringify(optimized));
      } catch (lsErr) {}

      // 2. Transmit to server database
      const response = await fetchWithTimeout('/api/persistence/save-drawings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, drawings: optimized })
      });
      if (!response.ok) {
        throw new Error('Drawing autosave failed');
      }
    } catch (err) {
      console.warn('[PersistenceService] saveDrawings (written to local backup):', err);
    }
  },

  async getDrawings(userId: string): Promise<Drawing[]> {
    let localBackup: any[] = [];
    try {
      const rawLoc = localStorage.getItem(`drawings_${userId}`);
      if (rawLoc) {
        localBackup = JSON.parse(rawLoc);
      }
    } catch (e) {}

    try {
      const response = await fetchWithTimeout(`/api/persistence/get-drawings?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Network error loading drawings');
      }
      const data = await response.json();
      const raw = data.drawings || [];
      
      try {
        localStorage.setItem(`drawings_${userId}`, JSON.stringify(raw));
      } catch (e) {}

      return raw.map(decompressDrawing);
    } catch (err) {
      console.warn('[PersistenceService] getDrawings (falling back to local storage):', err);
      return localBackup.map(decompressDrawing);
    }
  },

  // --- Preferences ---
  async savePreferences(userId: string, prefs: Partial<UserPreferences>) {
    try {
      // 1. Get existing preferences from LocalStorage, merge, and save immediately
      let nextPrefs = { ...prefs };
      try {
        const existingRaw = localStorage.getItem(`preferences_${userId}`);
        const existing = existingRaw ? JSON.parse(existingRaw) : {};
        nextPrefs = { ...existing, ...prefs };
        localStorage.setItem(`preferences_${userId}`, JSON.stringify(nextPrefs));
      } catch (lsErr) {
        console.error('[PersistenceService] savePreferences local storage failed', lsErr);
      }

      // 2. Save merged copy to server
      const response = await fetchWithTimeout('/api/persistence/save-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, prefs: nextPrefs })
      });
      if (!response.ok) {
        throw new Error('Preferences sync failed');
      }
    } catch (err) {
      console.warn('[PersistenceService] savePreferences (saved to local backup):', err);
    }
  },

  async getPreferences(userId: string): Promise<Partial<UserPreferences> | null> {
    let localBackup: Partial<UserPreferences> | null = null;
    try {
      const rawLoc = localStorage.getItem(`preferences_${userId}`);
      if (rawLoc) {
        localBackup = JSON.parse(rawLoc);
      }
    } catch (e) {}

    try {
      const response = await fetchWithTimeout(`/api/persistence/get-preferences?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Network error loading preferences');
      }
      const data = await response.json();
      const serverPrefs = data.preferences || null;

      if (serverPrefs) {
        try {
          localStorage.setItem(`preferences_${userId}`, JSON.stringify(serverPrefs));
        } catch (e) {}
      }
      return serverPrefs || localBackup;
    } catch (err) {
      console.warn('[PersistenceService] getPreferences (falling back to local storage):', err);
      return localBackup;
    }
  },

  // --- Watchlist ---
  async saveWatchlist(userId: string, items: any[]) {
    try {
      // 1. Save locally first
      try {
        localStorage.setItem(`watchlist_${userId}`, JSON.stringify(items));
      } catch (lsErr) {}

      // 2. Post to API
      const response = await fetchWithTimeout('/api/persistence/save-watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, items })
      });
      if (!response.ok) {
        throw new Error('Watchlist sync failed');
      }
    } catch (err) {
      console.warn('[PersistenceService] saveWatchlist (saved to local backup):', err);
    }
  },

  async getWatchlist(userId: string): Promise<any[]> {
    let localBackup: any[] = [];
    try {
      const rawLoc = localStorage.getItem(`watchlist_${userId}`);
      if (rawLoc) {
        localBackup = JSON.parse(rawLoc);
      }
    } catch (e) {}

    try {
      const response = await fetchWithTimeout(`/api/persistence/get-watchlist?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Network error loading watchlist');
      }
      const data = await response.json();
      const serverItems = data.items || [];

      try {
        localStorage.setItem(`watchlist_${userId}`, JSON.stringify(serverItems));
      } catch (e) {}

      return serverItems;
    } catch (err) {
      console.warn('[PersistenceService] getWatchlist (falling back to local storage):', err);
      return localBackup;
    }
  },

  // --- Backtest Sessions ---
  async saveBacktestSessions(userId: string, sessionsMap: Record<string, any>) {
    try {
      // 1. Save locally first
      try {
        localStorage.setItem(`backtest_sessions_${userId}`, JSON.stringify(sessionsMap));
      } catch (lsErr) {}

      // 2. Sync to DB
      const response = await fetchWithTimeout('/api/persistence/save-backtest-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sessions: sessionsMap })
      });
      if (!response.ok) {
        throw new Error('Backtest history sync failed');
      }
    } catch (err: any) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        console.warn('[PersistenceService] saveBacktestSessions postponed (locally saved): Connection busy or dev server restarting.');
      } else {
        console.warn('[PersistenceService] saveBacktestSessions warning:', err);
      }
    }
  },

  async getBacktestSessions(userId: string): Promise<Record<string, any>> {
    let localBackup: Record<string, any> = {};
    try {
      const rawLoc = localStorage.getItem(`backtest_sessions_${userId}`);
      if (rawLoc) {
        localBackup = JSON.parse(rawLoc);
      }
    } catch (e) {}

    try {
      const response = await fetchWithTimeout(`/api/persistence/get-backtest-sessions?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Network error loading backtest sessions');
      }
      const data = await response.json();
      const serverSessions = data.sessions || {};

      try {
        localStorage.setItem(`backtest_sessions_${userId}`, JSON.stringify(serverSessions));
      } catch (e) {}

      return serverSessions;
    } catch (err: any) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        console.warn('[PersistenceService] getBacktestSessions postponed: Connection busy or page reloading.');
      } else {
        console.warn('[PersistenceService] getBacktestSessions warning (falling back to local storage):', err);
      }
      return localBackup;
    }
  },

  // --- Session Management ---
  async updateActiveSession(userId: string, sessionId: string) {
    try {
      const response = await fetchWithTimeout('/api/persistence/update-active-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sessionId })
      });
      if (!response.ok) {
        console.warn(`[PersistenceService] Active session update response status: ${response.status}`);
      }
    } catch (err: any) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        console.warn('[PersistenceService] Active session update postponed: Browser connection busy or page reloading.');
      } else {
        console.warn('[PersistenceService] updateActiveSession error:', err);
      }
    }
  },

  async watchSession(userId: string, onMismatch: () => void, currentSessionId: string) {
    const interval = setInterval(async () => {
      try {
        const response = await fetchWithTimeout(`/api/persistence/get-active-session?userId=${userId}`, { timeout: 2500 });
        if (response.ok) {
          const data = await response.json();
          if (data?.active_session_id && data.active_session_id !== currentSessionId) {
            onMismatch();
          }
        }
      } catch (err) {
        console.warn('[Session Monitor] Idle query failure', err);
      }
    }, 8000);

    return {
      unsubscribe: () => clearInterval(interval)
    };
  },

  // --- Setups ---
  async saveSetup(userId: string, grade: string, imageUrl: string | null, confluences: string[]) {
    try {
      const setupObj = {
        id: `setup_${Date.now()}_${grade}`,
        user_id: userId,
        grade,
        image_url: imageUrl,
        confluences,
        updated_at: new Date().toISOString()
      };

      // 1. Cache setup locally
      try {
        const localKey = `setups_${userId}`;
        const existingRaw = localStorage.getItem(localKey);
        const list = existingRaw ? JSON.parse(existingRaw) : [];
        const filtered = list.filter((s: any) => s.grade !== grade);
        filtered.push(setupObj);
        localStorage.setItem(localKey, JSON.stringify(filtered));
      } catch (e) {}

      // 2. Send setup to API
      const response = await fetchWithTimeout('/api/persistence/save-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, grade, imageUrl, confluences })
      });
      if (!response.ok) {
        throw new Error('Failed to save trade setup rules');
      }
    } catch (err) {
      console.warn('[PersistenceService] saveSetup error (saved to local backup):', err);
    }
  },

  async getSetups(userId: string) {
    let localBackup: any[] = [];
    try {
      const rawLoc = localStorage.getItem(`setups_${userId}`);
      if (rawLoc) {
        localBackup = JSON.parse(rawLoc);
      }
    } catch (e) {}

    try {
      const response = await fetchWithTimeout(`/api/persistence/get-setups?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Network error loading setups');
      }
      const data = await response.json();
      const rawSetups = data.setups || [];
      
      try {
        localStorage.setItem(`setups_${userId}`, JSON.stringify(rawSetups));
      } catch (e) {}

      return rawSetups.map((s: any) => ({
        id: s.id,
        user_id: s.user_id || s.userId,
        grade: s.grade,
        image_url: s.image_url ?? s.imageUrl,
        confluences: typeof s.confluences === 'string' ? JSON.parse(s.confluences) : (s.confluences || []),
        updated_at: s.updated_at ?? s.updatedAt
      }));
    } catch (err) {
      console.warn('[PersistenceService] getSetups (falling back to local storage):', err);
      return localBackup.map((s: any) => ({
        id: s.id,
        user_id: s.user_id ?? s.userId,
        grade: s.grade,
        image_url: s.image_url ?? s.imageUrl,
        confluences: typeof s.confluences === 'string' ? JSON.parse(s.confluences) : (s.confluences || []),
        updated_at: s.updated_at ?? s.updatedAt
      }));
    }
  },

  async deleteTradesByWatchlistId(userId: string, watchlistId: string) {
    try {
      // Clean up local trades as well
      try {
        const localKey = `trades_${userId}`;
        const existingRaw = localStorage.getItem(localKey);
        if (existingRaw) {
          const list = JSON.parse(existingRaw);
          const filtered = list.filter((t: any) => t.watchlistId !== watchlistId && t.watchlist_id !== watchlistId);
          localStorage.setItem(localKey, JSON.stringify(filtered));
        }
      } catch (lsErr) {}

      await fetchWithTimeout('/api/persistence/delete-trades-by-watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, watchlistId })
      });
    } catch (err) {
      console.warn('[PersistenceService] deleteTradesByWatchlistId error:', err);
    }
  },

  async deleteTradesForSymbol(userId: string, symbol: string, prefix?: string, watchlistId?: string) {
    try {
      // Clean up local trades as well
      try {
        const localKey = `trades_${userId}`;
        const existingRaw = localStorage.getItem(localKey);
        if (existingRaw) {
          const list = JSON.parse(existingRaw);
          const filtered = list.filter((t: any) => {
            const matchSymbol = t.symbol === symbol;
            const matchPrefix = prefix === undefined || t.prefix === prefix;
            const matchWatchlist = watchlistId === undefined || t.watchlistId === watchlistId || t.watchlist_id === watchlistId;
            return !(matchSymbol && matchPrefix && matchWatchlist);
          });
          localStorage.setItem(localKey, JSON.stringify(filtered));
        }
      } catch (lsErr) {}

      await fetchWithTimeout('/api/persistence/delete-trades-for-symbol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, symbol, prefix, watchlistId })
      });
    } catch (err) {
      console.warn('[PersistenceService] deleteTradesForSymbol error:', err);
    }
  },

  async uploadSetupImage(userId: string, grade: string, file: File) {
    return new Promise<string | null>((resolve) => {
      // Modern high-performance client-side downsampling and jpeg compression helper
      const compressImageFile = (imgFile: File, maxWidth = 1000, maxHeight = 1000, quality = 0.65): Promise<string> => {
        return new Promise((resCompress, rejCompress) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;

              // Scale down keeping aspect ratio intact
              if (width > height) {
                if (width > maxWidth) {
                  height = Math.round((height * maxWidth) / width);
                  width = maxWidth;
                }
              } else {
                if (height > maxHeight) {
                  width = Math.round((width * maxHeight) / height);
                  height = maxHeight;
                }
              }

              canvas.width = width;
              canvas.height = height;

              const ctx = canvas.getContext('2d');
              if (!ctx) {
                resCompress(e.target?.result as string); // Fallback to raw load
                return;
              }

              // Draw canvas with clean white solid fill background (for PNG transparencies)
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);

              const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
              resCompress(compressedBase64);
            };
            img.onerror = () => {
              resCompress(e.target?.result as string); // Fallback on image loading failure
            };
            img.src = e.target?.result as string;
          };
          reader.onerror = (err) => rejCompress(err);
          reader.readAsDataURL(imgFile);
        });
      };

      compressImageFile(file)
        .then(async (base64String) => {
          try {
            const response = await fetchWithTimeout('/api/persistence/upload-setup-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, grade, imageBase64: base64String })
            });
            if (response.ok) {
              const res = await response.json();
              resolve(res.publicUrl);
            } else {
              resolve(null);
            }
          } catch (err) {
            console.warn('[PersistenceService] uploadSetupImage fail, falling back to local memory string representation', err);
            resolve(base64String); // Best fallback - return the local base64 so it still renders in the browser immediately!
          }
        })
        .catch((err) => {
          console.warn('[PersistenceService] image compression failure, reading backup raw stream:', err);
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64String = reader.result as string;
            try {
              const response = await fetchWithTimeout('/api/persistence/upload-setup-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, grade, imageBase64: base64String })
              });
              if (response.ok) {
                const res = await response.json();
                resolve(res.publicUrl);
              } else {
                resolve(null);
              }
            } catch (fallbackErr) {
              resolve(base64String);
            }
          };
          reader.readAsDataURL(file);
        });
    });
  }
};
