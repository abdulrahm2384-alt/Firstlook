/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import TradeList from './components/TradeList';
import AddAccountDialog from './components/AddAccountDialog';
import AddTradeDialog from './components/AddTradeDialog';
import WithdrawDialog from './components/WithdrawDialog';
import TradeDetailDialog from './components/TradeDetailDialog';
import { Account, Trade, Withdrawal } from './types';
import { supabase } from './lib/supabase';
import { 
  subscribeToAccounts, 
  getAccounts,
  addAccount, 
  subscribeToTrades, 
  subscribeToAllUserTrades,
  subscribeToAllUserWithdrawals,
  subscribeToWithdrawals,
  addTrade, 
  addWithdrawal,
  deleteTrade,
  updateTrade,
  updateAccount
} from './lib/supabase-utils';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [allWithdrawals, setAllWithdrawals] = useState<Withdrawal[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isAddTradeOpen, setIsAddTradeOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      setAccountsLoading(true);
      const unsubscribeAccounts = subscribeToAccounts(user.id, (data) => {
        setAccounts(data);
        setAccountsLoading(false);
      });
      
      const unsubscribeTrades = subscribeToAllUserTrades(user.id, (data) => {
        setAllTrades(data);
      });

      const unsubscribeWithdrawals = subscribeToAllUserWithdrawals(user.id, (data) => {
        setAllWithdrawals(data);
      });

      return () => {
        unsubscribeAccounts();
        unsubscribeTrades();
        unsubscribeWithdrawals();
      };
    } else {
      setAccounts([]);
      setAllTrades([]);
      setAllWithdrawals([]);
      setAccountsLoading(false);
    }
  }, [user]);

  // Sync selectedAccount with accounts list whenever accounts update
  useEffect(() => {
    if (selectedAccount) {
      const updated = accounts.find(a => a.id === selectedAccount.id);
      if (updated && (
        updated.currentBalance !== selectedAccount.currentBalance || 
        updated.status !== selectedAccount.status ||
        updated.name !== selectedAccount.name
      )) {
        setSelectedAccount(updated);
      }
    }
  }, [accounts]);

  useEffect(() => {
    if (user && selectedAccount) {
      const unsubscribeTrades = subscribeToTrades(selectedAccount.id, (data) => {
        setTrades(data);
      });
      const unsubscribeWithdrawals = subscribeToWithdrawals(selectedAccount.id, (data) => {
        setWithdrawals(data);
      });
      return () => {
        unsubscribeTrades();
        unsubscribeWithdrawals();
      };
    } else {
      setTrades([]);
      setWithdrawals([]);
    }
  }, [user, selectedAccount]);

  const handleLogin = async (email: string, pass: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
    } catch (error: any) {
      console.error("Login error:", error.message);
      if (error.message === 'Failed to fetch') {
        throw new Error("Connection Error: Could not connect to the database. Please check your internet connection and Supabase URL in settings.");
      }
      if (error.message.includes("Email not confirmed")) {
        const resend = window.confirm("Email not confirmed. Would you like us to resend the confirmation link?");
        if (resend) {
          await supabase.auth.resend({
            type: 'signup',
            email: email,
            options: {
              emailRedirectTo: window.location.origin
            }
          });
          alert("Confirmation email resent. Please check your inbox (and spam).");
        }
        throw new Error("Email not confirmed. Please check your inbox.");
      } else if (error.message.includes("Invalid login credentials")) {
        throw new Error("Invalid email or password.");
      } else {
        throw error;
      }
    }
  };

  const handleSignUp = async (email: string, pass: string) => {
    try {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password: pass,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      if (error) throw error;
      alert("Check your email for the confirmation link!");
    } catch (error: any) {
      console.error("Sign up error:", error.message);
      if (error.message === 'Failed to fetch') {
        throw new Error("Connection Error: Could not connect to the database. Please check your internet connection and Supabase URL in settings.");
      }
      throw error;
    }
  };

  const handleLogout = () => supabase.auth.signOut();

  const handleAddAccount = async (accountData: any) => {
    try {
      console.log('Adding account:', accountData);
      const id = await addAccount(accountData);
      if (!id) throw new Error("Failed to create account record. Are you logged in?");
      
      // Instant refresh
      if (user) {
        const updatedAccounts = await getAccounts(user.id);
        setAccounts(updatedAccounts);
      }
      
      setIsAddAccountOpen(false);
      return id;
    } catch (error: any) {
      console.error("Add account error:", error);
      throw error;
    }
  };

  const handleAddTrade = async (tradeData: any) => {
    if (selectedAccount) {
      await addTrade({ ...tradeData, accountId: selectedAccount.id });
    }
  };

  const handleAddWithdrawal = async (amount: number, notes: string) => {
    if (selectedAccount) {
      await addWithdrawal({
        accountId: selectedAccount.id,
        amount,
        notes,
        createdAt: new Date().toISOString()
      });
    }
  };

  const handleUpdateTrade = async (tradeId: string, updates: Partial<Trade>) => {
    if (selectedAccount) {
      console.log('Updating trade:', tradeId, updates);
      await updateTrade(tradeId, updates);
      
      // If closing trade, update account balance
      if (updates.status === 'closed' && updates.profitLoss !== undefined) {
        // We use the most up-to-date balance from selectedAccount
        const newBalance = (selectedAccount.currentBalance || 0) + updates.profitLoss;
        console.log('Closing trade, updating balance:', {
          old: selectedAccount.currentBalance,
          profit: updates.profitLoss,
          new: newBalance
        });
        
        try {
          await updateAccount(selectedAccount.id, { currentBalance: newBalance });
          // The subscription in useEffect will handle updating the state
        } catch (error) {
          console.error("Failed to update account balance:", error);
          alert("Trade closed but failed to update account balance. Please refresh.");
        }
      }
    }
  };

  const handleDeleteTrade = async (tradeId: string) => {
    if (selectedAccount) {
      const trade = trades.find(t => t.id === tradeId);
      if (trade) {
        await deleteTrade(tradeId, selectedAccount.id, trade.profitLoss || 0);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center font-serif">
        <div className="text-[10px] uppercase tracking-widest animate-pulse">loading...</div>
      </div>
    );
  }

  const isConfigMissing = false;

  return (
    <Layout user={user} onLogout={handleLogout}>
      {!user ? (
        <Auth onLogin={handleLogin} onSignUp={handleSignUp} />
      ) : selectedAccount ? (
        <TradeList 
          account={selectedAccount} 
          trades={trades}
          withdrawals={withdrawals}
          onBack={() => setSelectedAccount(null)}
          onAddTrade={() => setIsAddTradeOpen(true)}
          onWithdraw={() => setIsWithdrawOpen(true)}
          onDeleteTrade={handleDeleteTrade}
          onViewTrade={(trade) => setSelectedTrade(trade)}
          onUpdateTrade={handleUpdateTrade}
        />
      ) : (
        <Dashboard 
          accounts={accounts} 
          trades={allTrades}
          withdrawals={allWithdrawals}
          loading={accountsLoading}
          onAddAccount={() => setIsAddAccountOpen(true)}
          onSelectAccount={(account) => setSelectedAccount(account)}
        />
      )}

      <AddAccountDialog 
        isOpen={isAddAccountOpen} 
        onClose={() => setIsAddAccountOpen(false)} 
        onAdd={handleAddAccount} 
      />

      <AddTradeDialog 
        isOpen={isAddTradeOpen} 
        onClose={() => setIsAddTradeOpen(false)} 
        onAdd={handleAddTrade} 
        account={selectedAccount!}
        trades={trades}
      />

      {selectedAccount && (
        <WithdrawDialog
          isOpen={isWithdrawOpen}
          onClose={() => setIsWithdrawOpen(false)}
          onWithdraw={handleAddWithdrawal}
          account={selectedAccount}
        />
      )}

      <TradeDetailDialog 
        isOpen={!!selectedTrade} 
        onClose={() => setSelectedTrade(null)} 
        trade={selectedTrade} 
      />
    </Layout>
  );
}
