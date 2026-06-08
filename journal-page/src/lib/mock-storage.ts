import { Account, Trade } from '../types';

const ACCOUNTS_KEY = 'forex_tracker_accounts';
const TRADES_KEY = 'forex_tracker_trades';

const getLocal = (key: string) => JSON.parse(localStorage.getItem(key) || '[]');
const setLocal = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

export const mockSubscribeToAccounts = (callback: (accounts: Account[]) => void) => {
  const accounts = getLocal(ACCOUNTS_KEY);
  callback(accounts);
  return () => {};
};

export const mockAddAccount = async (accountData: any) => {
  const accounts = getLocal(ACCOUNTS_KEY);
  const newAccount = { 
    ...accountData, 
    id: Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString()
  };
  setLocal(ACCOUNTS_KEY, [...accounts, newAccount]);
  return newAccount.id;
};

export const mockSubscribeToTrades = (accountId: string, callback: (trades: Trade[]) => void) => {
  const trades = getLocal(TRADES_KEY).filter((t: any) => t.accountId === accountId);
  callback(trades);
  return () => {};
};

export const mockAddTrade = async (tradeData: any) => {
  const trades = getLocal(TRADES_KEY);
  const newTrade = { 
    ...tradeData, 
    id: Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString()
  };
  setLocal(TRADES_KEY, [...trades, newTrade]);

  // Update account balance
  const accounts = getLocal(ACCOUNTS_KEY);
  const accountIndex = accounts.findIndex((a: any) => a.id === tradeData.accountId);
  if (accountIndex > -1 && tradeData.profitLoss) {
    accounts[accountIndex].currentBalance = (accounts[accountIndex].currentBalance || 0) + tradeData.profitLoss;
    setLocal(ACCOUNTS_KEY, accounts);
  }

  return newTrade.id;
};

export const mockDeleteTrade = async (tradeId: string, accountId: string, profitLoss: number) => {
  const trades = getLocal(TRADES_KEY).filter((t: any) => t.id !== tradeId);
  setLocal(TRADES_KEY, trades);

  const accounts = getLocal(ACCOUNTS_KEY);
  const accountIndex = accounts.findIndex((a: any) => a.id === accountId);
  if (accountIndex > -1 && profitLoss) {
    accounts[accountIndex].currentBalance = (accounts[accountIndex].currentBalance || 0) - profitLoss;
    setLocal(ACCOUNTS_KEY, accounts);
  }
};
