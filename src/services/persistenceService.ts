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

      const response = await fetch('/api/persistence/save-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, trade: payload })
      });

      if (!response.ok) {
        throw new Error('Failed to save trade to backend database');
      }
    } catch (err) {
      console.error('[PersistenceService] saveTrade error:', err);
    }
  },

  async getTrades(userId: string): Promise<JournalTrade[]> {
    try {
      const response = await fetch(`/api/persistence/get-trades?userId=${userId}`);
      if (!response.ok) return [];

      const data = await response.json();
      const rawTrades = data.trades || [];

      return rawTrades.map((t: any) => {
        const entryTime = Number(t.entry_time);
        const exitTime = Number(t.exit_time);
        return {
          id: t.id,
          user_id: t.user_id,
          symbol: t.symbol || '',
          prefix: t.prefix,
          type: (t.type || 'LONG') as 'LONG' | 'SHORT',
          entryTime: isFinite(entryTime) ? entryTime : 0,
          exitTime: isFinite(exitTime) ? exitTime : 0,
          entryPrice: Number(t.entry_price) || 0,
          exitPrice: Number(t.exit_price) || 0,
          rr: Number(t.rr) || 0,
          status: (t.status || 'SL') as 'TP' | 'SL',
          pips: Number(t.pips) || 0,
          timeframe: t.timeframe || '1m',
          duration: t.duration || '0m',
          drawingId: t.drawing_id,
          watchlistId: t.watchlist_id,
          setupGrade: t.setup_grade,
          confluences: typeof t.confluences === 'string' ? JSON.parse(t.confluences) : (t.confluences || []),
          notes: t.notes,
          createdAt: t.created_at,
          realizedAt: t.realized_at
        };
      });
    } catch (err) {
      console.error('[PersistenceService] getTrades error:', err);
      return [];
    }
  },

  // --- Drawings ---
  async saveDrawings(userId: string, drawings: Drawing[]) {
    try {
      const optimized = drawings.map(compressDrawing);
      const response = await fetch('/api/persistence/save-drawings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, drawings: optimized })
      });
      if (!response.ok) {
        throw new Error('Drawing autosave failed');
      }
    } catch (err) {
      console.error('[PersistenceService] saveDrawings error:', err);
    }
  },

  async getDrawings(userId: string): Promise<Drawing[]> {
    try {
      const response = await fetch(`/api/persistence/get-drawings?userId=${userId}`);
      if (!response.ok) return [];
      const data = await response.json();
      const raw = data.drawings || [];
      return raw.map(decompressDrawing);
    } catch (err) {
      console.error('[PersistenceService] getDrawings error:', err);
      return [];
    }
  },

  // --- Preferences ---
  async savePreferences(userId: string, prefs: Partial<UserPreferences>) {
    try {
      const response = await fetch('/api/persistence/save-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, prefs })
      });
      if (!response.ok) {
        throw new Error('Preferences sync failed');
      }
    } catch (err) {
      console.error('[PersistenceService] savePreferences error:', err);
    }
  },

  async getPreferences(userId: string): Promise<Partial<UserPreferences> | null> {
    try {
      const response = await fetch(`/api/persistence/get-preferences?userId=${userId}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.preferences || null;
    } catch (err) {
      console.error('[PersistenceService] getPreferences error:', err);
      return null;
    }
  },

  // --- Watchlist ---
  async saveWatchlist(userId: string, items: any[]) {
    try {
      const response = await fetch('/api/persistence/save-watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, items })
      });
      if (!response.ok) {
        throw new Error('Watchlist sync failed');
      }
    } catch (err) {
      console.error('[PersistenceService] saveWatchlist error:', err);
    }
  },

  async getWatchlist(userId: string): Promise<any[]> {
    try {
      const response = await fetch(`/api/persistence/get-watchlist?userId=${userId}`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.items || [];
    } catch (err) {
      console.error('[PersistenceService] getWatchlist error:', err);
      return [];
    }
  },

  // --- Backtest Sessions ---
  async saveBacktestSessions(userId: string, sessionsMap: Record<string, number>) {
    try {
      const response = await fetch('/api/persistence/save-backtest-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sessions: sessionsMap })
      });
      if (!response.ok) {
        throw new Error('Backtest history sync failed');
      }
    } catch (err: any) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        console.warn('[PersistenceService] saveBacktestSessions postponed: Connection busy or dev server restarting.');
      } else {
        console.warn('[PersistenceService] saveBacktestSessions warning:', err);
      }
    }
  },

  async getBacktestSessions(userId: string): Promise<Record<string, number>> {
    try {
      const response = await fetch(`/api/persistence/get-backtest-sessions?userId=${userId}`);
      if (!response.ok) return {};
      const data = await response.json();
      return data.sessions || {};
    } catch (err: any) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        console.warn('[PersistenceService] getBacktestSessions postponed: Connection busy or page reloading.');
      } else {
        console.warn('[PersistenceService] getBacktestSessions warning:', err);
      }
      return {};
    }
  },

  // --- Session Management ---
  async updateActiveSession(userId: string, sessionId: string) {
    try {
      const response = await fetch('/api/persistence/update-active-session', {
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
        console.error('[PersistenceService] updateActiveSession error:', err);
      }
    }
  },

  async watchSession(userId: string, onMismatch: () => void, currentSessionId: string) {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/persistence/get-active-session?userId=${userId}`);
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
      const response = await fetch('/api/persistence/save-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, grade, imageUrl, confluences })
      });
      if (!response.ok) {
        throw new Error('Failed to save trade setup rules');
      }
    } catch (err) {
      console.error('[PersistenceService] saveSetup error:', err);
    }
  },

  async getSetups(userId: string) {
    try {
      const response = await fetch(`/api/persistence/get-setups?userId=${userId}`);
      if (!response.ok) return [];
      const data = await response.json();
      const rawSetups = data.setups || [];
      return rawSetups.map((s: any) => ({
        id: s.id,
        user_id: s.user_id,
        grade: s.grade,
        image_url: s.image_url,
        confluences: typeof s.confluences === 'string' ? JSON.parse(s.confluences) : (s.confluences || []),
        updated_at: s.updated_at
      }));
    } catch (err) {
      console.error('[PersistenceService] getSetups error:', err);
      return [];
    }
  },

  async deleteTradesByWatchlistId(userId: string, watchlistId: string) {
    try {
      await fetch('/api/persistence/delete-trades-by-watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, watchlistId })
      });
    } catch (err) {
      console.error('[PersistenceService] deleteTradesByWatchlistId error:', err);
    }
  },

  async deleteTradesForSymbol(userId: string, symbol: string, prefix?: string, watchlistId?: string) {
    try {
      await fetch('/api/persistence/delete-trades-for-symbol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, symbol, prefix, watchlistId })
      });
    } catch (err) {
      console.error('[PersistenceService] deleteTradesForSymbol error:', err);
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
            const response = await fetch('/api/persistence/upload-setup-image', {
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
            console.error('[PersistenceService] uploadSetupImage fail, falling back to local memory string representation', err);
            resolve(base64String); // Best fallback - return the local base64 so it still renders in the browser immediately!
          }
        })
        .catch((err) => {
          console.error('[PersistenceService] image compression failure, reading backup raw stream:', err);
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64String = reader.result as string;
            try {
              const response = await fetch('/api/persistence/upload-setup-image', {
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
