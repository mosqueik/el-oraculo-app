// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — usePortfolio Hook
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useCallback } from 'react';
import { usePortfolioStore } from '../store';

/**
 * Hook to fetch and manage portfolio data
 * Auto-refreshes every 30 seconds
 */
export function usePortfolio(autoRefresh = true) {
  const { coins, balance, loading, error, lastUpdate, fetchPortfolio, fetchBalance, refreshAll } =
    usePortfolioStore();

  useEffect(() => {
    // Initial fetch
    refreshAll();

    if (!autoRefresh) return;

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      refreshAll();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshAll]);

  const manualRefresh = useCallback(() => {
    refreshAll();
  }, [refreshAll]);

  // Calculate summary stats
  const totalPnl = coins.reduce((acc, coin) => {
    if (coin.status === 'COMPRADO' && coin.entryPrice > 0) {
      // We'd need current price for real PnL, but we can estimate from last trade
    }
    return acc;
  }, 0);

  const activePositions = coins.filter((c) => c.status === 'COMPRADO').length;
  const liquidPositions = coins.filter((c) => c.status === 'LÍQUIDO').length;

  return {
    coins,
    balance,
    loading,
    error,
    lastUpdate,
    activePositions,
    liquidPositions,
    refresh: manualRefresh,
    fetchPortfolio,
    fetchBalance,
  };
}
