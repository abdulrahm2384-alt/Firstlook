export type AccountType = 'prop' | 'live' | 'prop-live';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  createdAt: any;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  phase?: number;
  initialBalance: number;
  currentBalance: number;
  currency: string;
  createdAt: any;
  propType?: '1-phase' | '2-phase';
  maxDrawdown?: number;
  dailyDrawdown?: number;
  profitTarget?: number;
  status?: 'active' | 'passed' | 'failed';
  riskPerTrade?: number;
  riskType?: 'percent' | 'fixed';
  drawdownType?: 'percentage' | 'fixed' | 'trailing';
  drawdownValue?: number;
  liveTargetAmount?: number;
}

export interface Trade {
  id: string;
  accountId: string;
  userId: string;
  pair: string;
  type: 'buy' | 'sell';
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number;
  lotSize?: number;
  riskAmount?: number;
  exitPrice?: number;
  profitLoss?: number;
  additionalLoss?: number;
  status: 'open' | 'closed';
  imageUrl?: string;
  afterImageUrl?: string;
  notes?: string;
  analysisBy?: string;
  createdAt: any;
  closedAt?: any;
}

export interface Withdrawal {
  id: string;
  accountId: string;
  userId: string;
  amount: number;
  notes?: string;
  createdAt: any;
}
