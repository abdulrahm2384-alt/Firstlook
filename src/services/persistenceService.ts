import { supabase, isSupabasePlaceholder } from '../lib/supabase';
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
  twelveDataKey?: string;
  lastSelectedSymbol?: string | null;
  activePrefix?: string | null;
  activeWatchlistItemId?: string | null;
  pinnedText?: string | null;
}

let hasWarnedMissingTables = false;

const handleSupabaseError = (error: any, context: string) => {
  // Silence network fetch errors which are common if Supabase is misconfigured or blocked
  const isNetworkError = (err: any) => {
    const msg = err?.message || String(err);
    return msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed');
  };

  const isStorageNotFoundError = (err: any) => {
    const msg = err?.message || String(err);
    return msg.includes('Bucket not found') || msg.includes('does not exist');
  };

  const isTableMissingError = (err: any) => {
    const msg = err?.message || String(err);
    const code = err?.code;
    // Postgres error 42P01 is undefined_table
    // PostgREST "schema cache" error happens when tables are missing but the client is initialized
    return code === '42P01' || msg.includes('schema cache') || (msg.includes('relation') && msg.includes('does not exist'));
  };

  if (isNetworkError(error) || (context === 'uploadSetupImage' && isStorageNotFoundError(error))) {
    // Suppress network errors or missing bucket errors if we have a fallback
    return;
  }

  if (isTableMissingError(error)) {
    if (!hasWarnedMissingTables) {
      console.warn(`[PersistenceService] ${context} failed: One or more tables are missing in Supabase. Please run the SQL script in SUPABASE_SETUP.md in your Supabase SQL Editor to initialize your database.`);
      hasWarnedMissingTables = true;
    }
    return;
  }

  console.error(`[PersistenceService] ${context} error:`, error);
};

export const persistenceService = {
  // --- Trade Journal ---
  async saveTrade(userId: string, trade: JournalTrade) {
    if (isSupabasePlaceholder) return;
    try {
      const payload: any = {
        user_id: userId,
        symbol: trade.symbol,
        prefix: trade.prefix,
        type: trade.type,
        entry_time: trade.entryTime,
        exit_time: trade.exitTime,
        entry_price: trade.entryPrice,
        exit_price: trade.exitPrice,
        rr: trade.rr,
        status: trade.status,
        timeframe: trade.timeframe,
        duration: trade.duration,
        pips: trade.pips,
        setup_grade: trade.setupGrade,
        confluences: trade.confluences,
        notes: trade.notes,
        watchlist_id: trade.watchlistId,
        realized_at: new Date().toISOString()
      };

      // Only add drawing_id if it's provided
      if (trade.drawingId) {
        payload.drawing_id = trade.drawingId;
      }

      const { error } = await supabase
        .from('user_trades')
        .insert(payload);

      if (error) {
        // Handle missing column gracefully by retrying without the offending column
        // 42703 is the Postgres error code for undefined_column
        if (error.code === '42703' || (error.message && error.message.includes('column'))) {
          const possibleNewColumns = ['drawing_id', 'prefix', 'realized_at', 'setup_grade', 'watchlist_id', 'confluences', 'notes'];
          let fallbackPayload = { ...payload };
          let foundOffending = false;

          possibleNewColumns.forEach(col => {
            if (error.message && error.message.includes(col)) {
              delete fallbackPayload[col];
              foundOffending = true;
            }
          });

          // If we couldn't find it in the message, but it's a column missing error,
          // we can try stripping drawing_id first as it's the most likely culprit
          if (!foundOffending && fallbackPayload.drawing_id) {
            delete fallbackPayload.drawing_id;
            foundOffending = true;
          }

          if (foundOffending) {
            console.warn('[PersistenceService] Retrying insert without potentially missing columns:', error.message);
            const { error: retryError } = await supabase.from('user_trades').insert(fallbackPayload);
            if (!retryError) return;
            throw retryError;
          }
        }

        throw error;
      }
    } catch (err) {
      handleSupabaseError(err, 'saveTrade');
    }
  },

  async getTrades(userId: string): Promise<JournalTrade[]> {
    if (isSupabasePlaceholder) return [];
    try {
      const { data, error } = await supabase
        .from('user_trades')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.message?.includes('Failed to fetch')) return [];
        return [];
      }
      
      return (data || []).map(t => {
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
          confluences: t.confluences,
          notes: t.notes,
          createdAt: t.created_at,
          realizedAt: t.realized_at
        };
      });
    } catch (err) {
      handleSupabaseError(err, 'getTrades');
      return [];
    }
  },

  // --- Drawings ---
  async saveDrawings(userId: string, drawings: Drawing[]) {
    if (isSupabasePlaceholder) return;
    try {
      const { error } = await supabase
        .from('user_drawings')
        .upsert({ 
          user_id: userId, 
          drawings: drawings,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      
      if (error) {
        throw error;
      }
    } catch (err) {
      handleSupabaseError(err, 'saveDrawings');
    }
  },

  async getDrawings(userId: string): Promise<Drawing[]> {
    if (isSupabasePlaceholder) return [];
    try {
      const { data, error } = await supabase
        .from('user_drawings')
        .select('drawings')
        .eq('user_id', userId)
        .maybeSingle();
        
      if (error) {
        if (error.message?.includes('Failed to fetch')) return [];
        return [];
      }
      return data?.drawings || [];
    } catch (err) {
      handleSupabaseError(err, 'getDrawings');
      return [];
    }
  },

  // --- Preferences ---
  async savePreferences(userId: string, prefs: Partial<UserPreferences>) {
    if (isSupabasePlaceholder) return;
    try {
      const { data: existing } = await supabase
        .from('user_preferences')
        .select('settings')
        .eq('user_id', userId)
        .maybeSingle();

      const mergedSettings = { ...(existing?.settings || {}), ...prefs };

      const { error } = await supabase
        .from('user_preferences')
        .upsert({ 
          user_id: userId, 
          settings: mergedSettings,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      
      if (error) {
        throw error;
      }
    } catch (err) {
      handleSupabaseError(err, 'savePreferences');
    }
  },

  async getPreferences(userId: string): Promise<Partial<UserPreferences> | null> {
    if (isSupabasePlaceholder) return null;
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('settings')
        .eq('user_id', userId)
        .maybeSingle();
        
      if (error) {
        if (error.message?.includes('Failed to fetch')) return null;
        return null;
      }
      return data?.settings || null;
    } catch (err) {
      handleSupabaseError(err, 'getPreferences');
      return null;
    }
  },

  // --- Watchlist ---
  async saveWatchlist(userId: string, items: any[]) {
    if (isSupabasePlaceholder) return;
    try {
      const { error } = await supabase
        .from('user_watchlist')
        .upsert({ 
          user_id: userId, 
          items: items,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      
      if (error) {
        throw error;
      }
    } catch (err) {
      handleSupabaseError(err, 'saveWatchlist');
    }
  },

  async getWatchlist(userId: string): Promise<any[]> {
    if (isSupabasePlaceholder) return [];
    try {
      const { data, error } = await supabase
        .from('user_watchlist')
        .select('items')
        .eq('user_id', userId)
        .maybeSingle();
        
      if (error) {
        if (error.message?.includes('Failed to fetch')) return [];
        return [];
      }
      return data?.items || [];
    } catch (err) {
      handleSupabaseError(err, 'getWatchlist');
      return [];
    }
  },

  // --- Backtest Sessions ---
  async saveBacktestSessions(userId: string, sessionsMap: Record<string, number>) {
    if (isSupabasePlaceholder) return;
    try {
      const { error } = await supabase
        .from('user_backtest_sessions')
        .upsert({ 
          user_id: userId, 
          sessions: sessionsMap,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      
      if (error) {
        throw error;
      }
    } catch (err) {
      handleSupabaseError(err, 'saveBacktestSessions');
    }
  },

  async getBacktestSessions(userId: string): Promise<Record<string, number>> {
    if (isSupabasePlaceholder) return {};
    try {
      const { data, error } = await supabase
        .from('user_backtest_sessions')
        .select('sessions')
        .eq('user_id', userId)
        .maybeSingle();
        
      if (error) {
        if (error.message?.includes('Failed to fetch')) return {};
        return {};
      }
      return data?.sessions || {};
    } catch (err) {
      handleSupabaseError(err, 'getBacktestSessions');
      return {};
    }
  },

  // --- Session Management ---
  async updateActiveSession(userId: string, sessionId: string) {
    if (isSupabasePlaceholder) return;
    try {
      const { error } = await supabase
        .from('user_sessions')
        .upsert({ 
          user_id: userId, 
          active_session_id: sessionId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      
      if (error) {
         console.warn('[PersistenceService] Error updating session:', error.message);
      }
    } catch (err) {
      handleSupabaseError(err, 'updateActiveSession');
    }
  },

  async watchSession(userId: string, onMismatch: () => void, currentSessionId: string) {
     if (isSupabasePlaceholder) return { unsubscribe: () => {} };
     return supabase
      .channel('session_watch')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_sessions',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          if (payload.new && payload.new.active_session_id !== currentSessionId) {
            onMismatch();
          }
        }
      )
      .subscribe();
  },

  // --- Setups ---
  async saveSetup(userId: string, grade: string, imageUrl: string | null, confluences: string[]) {
    if (isSupabasePlaceholder) return;
    try {
      const { error } = await supabase
        .from('setups')
        .upsert({
          user_id: userId,
          grade: grade,
          image_url: imageUrl,
          confluences: confluences,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,grade' });
      
      if (error) {
        if (error.message?.includes('Failed to fetch')) return;
        throw error;
      }
    } catch (err) {
      handleSupabaseError(err, 'saveSetup');
    }
  },

  async getSetups(userId: string) {
    if (isSupabasePlaceholder) return [];
    try {
      const { data, error } = await supabase
        .from('setups')
        .select('*')
        .eq('user_id', userId);
      
      if (error) {
        // Return empty if table doesn't exist yet
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          return [];
        }
        if (error.message?.includes('Failed to fetch')) return [];
        throw error;
      }
      return data || [];
    } catch (err) {
      handleSupabaseError(err, 'getSetups');
      return [];
    }
  },

  async deleteTradesByWatchlistId(userId: string, watchlistId: string) {
    if (isSupabasePlaceholder) return;
    try {
      const { error } = await supabase
        .from('user_trades')
        .delete()
        .eq('user_id', userId)
        .eq('watchlist_id', watchlistId);
      
      if (error) {
        if (error.message?.includes('Failed to fetch')) return;
        console.error('[PersistenceService] Error deleting trades by watchlist ID:', error);
      }
    } catch (err) {
      handleSupabaseError(err, 'deleteTradesByWatchlistId');
    }
  },

  async deleteTradesForSymbol(userId: string, symbol: string, prefix?: string, watchlistId?: string) {
    if (isSupabasePlaceholder) return;
    try {
      if (watchlistId) {
        return this.deleteTradesByWatchlistId(userId, watchlistId);
      }

      let query = supabase
        .from('user_trades')
        .delete()
        .eq('user_id', userId)
        .eq('symbol', symbol);
      
      if (prefix && prefix.trim() !== '') {
        query = query.eq('prefix', prefix);
      } else {
        // Handle cases where prefix might be null or empty string
        query = query.or('prefix.is.null,prefix.eq.""');
      }

      const { error } = await query;
      if (error) {
        if (error.message?.includes('Failed to fetch')) return;
        console.error('[PersistenceService] Error deleting trades for symbol:', error);
      }
    } catch (err) {
      handleSupabaseError(err, 'deleteTradesForSymbol');
    }
  },

  async uploadSetupImage(userId: string, grade: string, file: File) {
    if (isSupabasePlaceholder) return null;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}_${grade}_${Date.now()}.${fileExt}`;
      const filePath = `setups/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('setups')
        .upload(filePath, file);

      if (uploadError) {
        // If bucket is missing, we return null to trigger base64 fallback in UI
        if (uploadError.message?.includes('not found') || uploadError.message?.includes('exist')) {
          return null;
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('setups')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (err) {
      handleSupabaseError(err, 'uploadSetupImage');
      return null;
    }
  }
};
