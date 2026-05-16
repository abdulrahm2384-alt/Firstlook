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
}
