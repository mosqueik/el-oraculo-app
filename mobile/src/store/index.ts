// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Zustand Store (Global State) with Cache
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { CoinSymbol, BotState, TradeLog, ExecutionResult } from '../shared';
import { apiService } from '../services/api';

// ─── Portfolio State ──────────────────────────────────────────
interface PortfolioState {
  coins: BotState[];
  balance: { usdt_free: number; usdt_total: number };
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  fromCache: boolean;
  fetchPortfolio: () => Promise<void>;
  fetchBalance: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  coins: [],
  balance: { usdt_free: 0, usdt_total: 0 },
  loading: false,
  error: null,
  lastUpdate: null,
  fromCache: false,

  fetchPortfolio: async () => {
    try {
      const coins = await apiService.getPortfolio();
      set({ coins, lastUpdate: new Date(), error: null, fromCache: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch portfolio' });
    }
  },

  fetchBalance: async () => {
    try {
      const balance = await apiService.getBalance();
      set({ balance, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch balance' });
    }
  },

  refreshAll: async () => {
    set({ loading: true, error: null });
    try {
      const [coins, balance] = await Promise.all([
        apiService.getPortfolio(),
        apiService.getBalance(),
      ]);
      set({ coins, balance, loading: false, lastUpdate: new Date(), error: null, fromCache: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to refresh',
      });
    }
  },
}));

// ─── Trades State ─────────────────────────────────────────────
interface TradesState {
  trades: TradeLog[];
  loading: boolean;
  error: string | null;
  fetchTrades: (coin?: CoinSymbol, limit?: number) => Promise<void>;
}

export const useTradesStore = create<TradesState>((set) => ({
  trades: [],
  loading: false,
  error: null,

  fetchTrades: async (coin?: CoinSymbol, limit: number = 50) => {
    set({ loading: true, error: null });
    try {
      const trades = await apiService.getTradeHistory(coin);
      set({ trades: trades.slice(0, limit), loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch trades',
      });
    }
  },
}));

// ─── Executions State ─────────────────────────────────────────
interface ExecutionsState {
  executions: ExecutionResult[];
  loading: boolean;
  error: string | null;
  fetchExecutions: (limit?: number) => Promise<void>;
}

export const useExecutionsStore = create<ExecutionsState>((set) => ({
  executions: [],
  loading: false,
  error: null,

  fetchExecutions: async (limit: number = 50) => {
    set({ loading: true, error: null });
    try {
      const executions = await apiService.getExecutions(limit);
      set({ executions, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch executions',
      });
    }
  },
}));

// ─── Bot Status State ─────────────────────────────────────────
interface BotStatusState {
  running: boolean;
  cycleCount: number;
  uptime: number;
  fetchStatus: () => Promise<void>;
}

export const useBotStatusStore = create<BotStatusState>((set) => ({
  running: false,
  cycleCount: 0,
  uptime: 0,

  fetchStatus: async () => {
    try {
      const status = await apiService.getStatus();
      set({
        running: status.running,
        cycleCount: status.cycleCount,
        uptime: status.uptime,
      });
    } catch {
      // Ignore errors for status
    }
  },
}));

// ─── Connection State ─────────────────────────────────────────
interface ConnectionState {
  connected: boolean;
  setConnected: (connected: boolean) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  connected: false,
  setConnected: (connected) => set({ connected }),
}));
