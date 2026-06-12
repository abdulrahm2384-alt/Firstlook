import { MarketSymbol, MarketType } from '../types';

export type MarketDataSource = string;

export interface WatchlistItem extends MarketSymbol {
  id: string;
  price: string;
  change: string;
  isDown: boolean;
  vol?: string;
  status: 'ongoing' | 'completed';
  dataSource?: MarketDataSource;
  marketType?: MarketType;
  prefix?: string;
  description?: string;
  setupImage?: string;
  createdAt: number;
  timeSync?: boolean;
  timeFrame?: string;
  lastCandlePlayAt?: number;
  lastSimulationTime?: number;
  timeSyncSpeed?: number;
  start_time?: number;
  last_play_candle_time?: number;
  end_time?: number;
  hasBeenExtended?: boolean;
}
