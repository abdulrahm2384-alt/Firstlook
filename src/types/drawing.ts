export enum DrawingType {
  // Lines
  TREND_LINE = 'TREND_LINE',
  HORIZONTAL_RAY = 'HORIZONTAL_RAY',
  VERTICAL_LINE = 'VERTICAL_LINE',
  HORIZONTAL_LINE = 'HORIZONTAL_LINE',
  
  // Forecasting
  FIB_RETRACEMENT = 'FIB_RETRACEMENT',
  LONG_POSITION = 'LONG_POSITION',
  SHORT_POSITION = 'SHORT_POSITION',
  PRICE_RANGE = 'PRICE_RANGE',
  DATE_RANGE = 'DATE_RANGE',
  
  // Shapes
  ARROW_MARKER = 'ARROW_MARKER',
  RECTANGLE = 'RECTANGLE',
  PATH = 'PATH',
  BRUSH = 'BRUSH'
}

export interface DrawingPoint {
  time: number;
  price: number;
}

export interface Drawing {
  id: string;
  symbol: string;
  prefix?: string;
  watchlistId?: string;
  type: DrawingType;
  points: DrawingPoint[];
  settings: Record<string, any>;
  isFavorite?: boolean;
  isTriggered?: boolean;
  triggeredAt?: number; // timestamp
  placedAt?: number; // timestamp for simulation validation
  managedStopPrice?: number; // For SL Ray management
  status?: 'active' | 'won' | 'lost';
  statusAt?: number; // timestamp
}
