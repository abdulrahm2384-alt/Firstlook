import { supabase } from './supabase';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token || '';
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Account Operations
export const getAccounts = async (userId: string) => {
  try {
    const data = await fetchWithAuth('/api/journal/accounts');
    return data.accounts || [];
  } catch (err) {
    console.error('Error fetching accounts:', err);
    return [];
  }
};

export const subscribeToAccounts = (userId: string, callback: (accounts: any[]) => void) => {
  let active = true;
  const poll = async () => {
    if (!active) return;
    const accounts = await getAccounts(userId);
    callback(accounts);
  };
  poll();
  const interval = setInterval(poll, 4000);
  return () => {
    active = false;
    clearInterval(interval);
  };
};

export const addAccount = async (accountData: any) => {
  const data = await fetchWithAuth('/api/journal/accounts', {
    method: 'POST',
    body: JSON.stringify(accountData)
  });
  return data.id;
};

export const deleteAccount = async (accountId: string) => {
  await fetchWithAuth(`/api/journal/accounts/${accountId}`, {
    method: 'DELETE'
  });
};

export const updateAccount = async (accountId: string, updates: any) => {
  await fetchWithAuth(`/api/journal/accounts/${accountId}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
};

// Trade Operations
export const getTrades = async (accountId?: string) => {
  try {
    const query = accountId ? `?accountId=${accountId}` : '';
    const data = await fetchWithAuth(`/api/journal/trades${query}`);
    return data.trades || [];
  } catch (err) {
    console.error('Error fetching trades:', err);
    return [];
  }
};

export const subscribeToTrades = (accountId: string, callback: (trades: any[]) => void) => {
  let active = true;
  const poll = async () => {
    if (!active) return;
    const trades = await getTrades(accountId);
    callback(trades);
  };
  poll();
  const interval = setInterval(poll, 4000);
  return () => {
    active = false;
    clearInterval(interval);
  };
};

export const subscribeToAllUserTrades = (userId: string, callback: (trades: any[]) => void) => {
  let active = true;
  const poll = async () => {
    if (!active) return;
    const trades = await getTrades();
    callback(trades);
  };
  poll();
  const interval = setInterval(poll, 4000);
  return () => {
    active = false;
    clearInterval(interval);
  };
};

// Withdrawal Operations
export const getWithdrawals = async (accountId?: string) => {
  try {
    const query = accountId ? `?accountId=${accountId}` : '';
    const data = await fetchWithAuth(`/api/journal/withdrawals${query}`);
    return data.withdrawals || [];
  } catch (err) {
    console.error('Error fetching withdrawals:', err);
    return [];
  }
};

export const subscribeToWithdrawals = (accountId: string, callback: (withdrawals: any[]) => void) => {
  let active = true;
  const poll = async () => {
    if (!active) return;
    const withdrawals = await getWithdrawals(accountId);
    callback(withdrawals);
  };
  poll();
  const interval = setInterval(poll, 4000);
  return () => {
    active = false;
    clearInterval(interval);
  };
};

export const subscribeToAllUserWithdrawals = (userId: string, callback: (withdrawals: any[]) => void) => {
  let active = true;
  const poll = async () => {
    if (!active) return;
    const withdrawals = await getWithdrawals();
    callback(withdrawals);
  };
  poll();
  const interval = setInterval(poll, 4000);
  return () => {
    active = false;
    clearInterval(interval);
  };
};

export const addTrade = async (tradeData: any) => {
  const data = await fetchWithAuth('/api/journal/trades', {
    method: 'POST',
    body: JSON.stringify(tradeData)
  });
  return data.id;
};

export const updateTrade = async (tradeId: string, updates: any) => {
  await fetchWithAuth(`/api/journal/trades/${tradeId}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
};

export const deleteTrade = async (tradeId: string, accountId: string, profitLoss: number) => {
  await fetchWithAuth(`/api/journal/trades/${tradeId}`, {
    method: 'DELETE'
  });
};

export const addWithdrawal = async (withdrawalData: any) => {
  const data = await fetchWithAuth('/api/journal/withdrawals', {
    method: 'POST',
    body: JSON.stringify(withdrawalData)
  });
  return data.id;
};
