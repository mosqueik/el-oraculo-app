// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — API Service (Mobile → Backend) with Cache
// ═══════════════════════════════════════════════════════════════════

import axios from 'axios';
import { CoinSymbol, BotState, TradeLog, ExecutionResult } from '../shared';
import { cache, CACHE_KEYS, CACHE_TTL } from '../utils/cache';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

// ─── Auth Token Interceptor ──────────────────────────────────
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

// ─── Portfolio ────────────────────────────────────────────────
export class ApiService {
  async getPortfolio(): Promise<BotState[]> {
    const { data } = await cache.fetchWithFallback(
      CACHE_KEYS.PORTFOLIO,
      async () => {
        const { data } = await api.get('/api/portfolio');
        return data.data || data;
      },
      CACHE_TTL.PORTFOLIO
    );
    return data;
  }

  async getPortfolioByCoin(coin: CoinSymbol): Promise<BotState> {
    const { data } = await cache.fetchWithFallback(
      `portfolio:${coin}`,
      async () => {
        const { data } = await api.get(`/api/portfolio/${coin}`);
        return data.data || data;
      },
      CACHE_TTL.PORTFOLIO
    );
    return data;
  }

  async getBalance(): Promise<{ usdt_free: number; usdt_total: number }> {
    const { data } = await cache.fetchWithFallback(
      CACHE_KEYS.BALANCE,
      async () => {
        const { data } = await api.get('/api/balance');
        return data.data || data;
      },
      CACHE_TTL.BALANCE
    );
    return data;
  }

  async getBalanceSummary(): Promise<any> {
    const { data } = await cache.fetchWithFallback(
      'balance:summary',
      async () => {
        const { data } = await api.get('/api/balance/summary');
        return data.data || data;
      },
      CACHE_TTL.BALANCE
    );
    return data;
  }

  // ─── Trades ───────────────────────────────────────────────────
  async getTradeHistory(coin?: CoinSymbol): Promise<TradeLog[]> {
    const { data } = await cache.fetchWithFallback(
      CACHE_KEYS.TRADES(coin),
      async () => {
        const { data } = await api.get('/api/trades', { params: coin ? { coin } : {} });
        return data.data || data;
      },
      CACHE_TTL.TRADES
    );
    return data;
  }

  async getRecentTrades(hours: number = 24): Promise<TradeLog[]> {
    const { data } = await cache.fetchWithFallback(
      `trades:recent:${hours}`,
      async () => {
        const { data } = await api.get('/api/trades/recent', { params: { hours } });
        return data.data || data;
      },
      CACHE_TTL.TRADES
    );
    return data;
  }

  // ─── Executions ───────────────────────────────────────────────
  async getExecutions(limit: number = 50): Promise<ExecutionResult[]> {
    const { data } = await cache.fetchWithFallback(
      CACHE_KEYS.EXECUTIONS,
      async () => {
        const { data } = await api.get('/api/executions', { params: { limit } });
        return data.data || data;
      },
      CACHE_TTL.EXECUTIONS
    );
    return data;
  }

  async getRecentExecutions(hours: number = 24): Promise<ExecutionResult[]> {
    const { data } = await cache.fetchWithFallback(
      `executions:recent:${hours}`,
      async () => {
        const { data } = await api.get('/api/executions/recent', { params: { hours } });
        return data.data || data;
      },
      CACHE_TTL.EXECUTIONS
    );
    return data;
  }

  async getExecutionErrors(hours: number = 24): Promise<any> {
    const { data } = await api.get('/api/executions/errors', { params: { hours } });
    return data.data || data;
  }

  // ─── Bot Status ───────────────────────────────────────────────
  async getStatus(): Promise<any> {
    const { data } = await cache.fetchWithFallback(
      CACHE_KEYS.BOT_STATUS,
      async () => {
        const { data } = await api.get('/api/status');
        return data.data || data;
      },
      CACHE_TTL.BOT_STATUS
    );
    return data;
  }

  async startBot(): Promise<any> {
    const { data } = await api.post('/api/start');
    // Invalidate bot status cache
    await cache.remove(CACHE_KEYS.BOT_STATUS);
    return data.data || data;
  }

  async stopBot(): Promise<any> {
    const { data } = await api.post('/api/stop');
    // Invalidate bot status cache
    await cache.remove(CACHE_KEYS.BOT_STATUS);
    return data.data || data;
  }

  // ─── Auth ─────────────────────────────────────────────────────
  async register(email: string, password: string, name?: string): Promise<any> {
    const { data } = await api.post('/api/auth/register', { email, password, name });
    return data.data || data;
  }

  async login(email: string, password: string): Promise<any> {
    const { data } = await api.post('/api/auth/login', { email, password });
    const result = data.data || data;
    if (result.token) {
      setAuthToken(result.token);
      // Cache user data
      await cache.set(CACHE_KEYS.USER, result.user, CACHE_TTL.USER);
    }
    return result;
  }

  async getMe(): Promise<any> {
    const { data } = await cache.fetchWithFallback(
      CACHE_KEYS.USER,
      async () => {
        const { data } = await api.get('/api/auth/me');
        return data.data || data;
      },
      CACHE_TTL.USER
    );
    return data;
  }

  // ─── Klines (Chart Data) ───────────────────────────────────────
  async getKlines(coin: CoinSymbol, interval: string = '15m', limit: number = 100): Promise<any> {
    const { data } = await cache.fetchWithFallback(
      CACHE_KEYS.KLINES(coin, interval),
      async () => {
        const { data } = await api.get(`/api/klines/${coin}`, { params: { interval, limit } });
        return data.data || data;
      },
      CACHE_TTL.KLINES
    );
    return data;
  }

  // ─── Notifications ─────────────────────────────────────────────
  async registerPushToken(token: string, platform: 'ios' | 'android' | 'web'): Promise<any> {
    const { data } = await api.post('/api/notifications/register', { token, platform });
    return data.data || data;
  }

  async unregisterPushToken(token: string): Promise<any> {
    const { data } = await api.post('/api/notifications/unregister', { token });
    return data.data || data;
  }

  async getNotificationHistory(limit: number = 50, coin?: string): Promise<any[]> {
    const { data } = await cache.fetchWithFallback(
      CACHE_KEYS.NOTIFICATIONS,
      async () => {
        const { data } = await api.get('/api/notifications/history', { params: { limit, coin } });
        return data.data || data;
      },
      CACHE_TTL.NOTIFICATIONS
    );
    return data;
  }

  async getActiveTokenCount(): Promise<number> {
    const { data } = await api.get('/api/notifications/tokens');
    return data.data?.activeTokens || 0;
  }

  async sendTestPush(): Promise<any> {
    const { data } = await api.post('/api/notifications/test');
    return data.data || data;
  }

  // ─── Billing (Stripe) ─────────────────────────────────────────
  async getPlans(): Promise<any> {
    const { data } = await api.get('/api/billing/plans');
    return data.data || data;
  }

  async getSubscription(): Promise<any> {
    const { data } = await api.get('/api/billing/subscription');
    return data.data || data;
  }

  async createCheckout(params: { planId: string; successUrl?: string; cancelUrl?: string }): Promise<any> {
    const { data } = await api.post('/api/billing/checkout', params);
    return data.data || data;
  }

  async createPortal(): Promise<any> {
    const { data } = await api.post('/api/billing/portal');
    return data.data || data;
  }

  async getInvoices(): Promise<any[]> {
    const { data } = await api.get('/api/billing/invoices');
    return data.data || data;
  }

  // ─── Manual Trading Controls ───────────────────────────────────
  async manualBuy(coin: CoinSymbol, amountUsdt: number): Promise<any> {
    const { data } = await api.post(`/api/trading/manual-buy/${coin}`, { amountUsdt });
    // Invalidate portfolio cache
    await cache.remove(CACHE_KEYS.PORTFOLIO);
    await cache.remove(CACHE_KEYS.BALANCE);
    return data.data || data;
  }

  async manualSell(coin: CoinSymbol): Promise<any> {
    const { data } = await api.post(`/api/trading/manual-sell/${coin}`);
    // Invalidate portfolio cache
    await cache.remove(CACHE_KEYS.PORTFOLIO);
    await cache.remove(CACHE_KEYS.BALANCE);
    return data.data || data;
  }

  // ─── Emergency Trading Controls ────────────────────────────────
  async emergencySell(coin: CoinSymbol): Promise<any> {
    const { data } = await api.post(`/api/trading/emergency-sell/${coin}`);
    // Invalidate portfolio and trade cache
    await cache.remove(CACHE_KEYS.PORTFOLIO);
    await cache.remove(CACHE_KEYS.TRADES());
    return data.data || data;
  }

  async pauseCoin(coin: CoinSymbol): Promise<any> {
    const { data } = await api.post(`/api/trading/pause/${coin}`);
    return data.data || data;
  }

  async resumeCoin(coin: CoinSymbol): Promise<any> {
    const { data } = await api.post(`/api/trading/resume/${coin}`);
    return data.data || data;
  }

  async getPausedCoins(): Promise<string[]> {
    const { data } = await api.get('/api/trading/paused');
    return data.data?.paused || [];
  }

  // ─── AI Analysis ──────────────────────────────────────────────
  async analyzeTrade(tradeId: number): Promise<any> {
    const { data } = await api.post(`/api/analytics/analyze-trade/${tradeId}`);
    return data.data || data;
  }

  async analyzePortfolio(): Promise<any> {
    const { data } = await api.post('/api/analytics/analyze-portfolio');
    return data.data || data;
  }

  async getCoinRecommendation(coin: CoinSymbol): Promise<any> {
    const { data } = await api.post(`/api/analytics/recommendation/${coin}`);
    return data.data || data;
  }

  // ─── Performance Analytics ────────────────────────────────────
  async getPerformance(): Promise<any> {
    const { data } = await api.get('/api/analytics/performance');
    return data.data || data;
  }

  async getEquityCurve(): Promise<any> {
    const { data } = await api.get('/api/analytics/equity-curve');
    return data.data || data;
  }

  async getCoinAnalytics(coin: CoinSymbol): Promise<any> {
    const { data } = await api.get(`/api/analytics/coin/${coin}`);
    return data.data || data;
  }

  // ─── Data Export ──────────────────────────────────────────────
  async exportTrades(format: 'csv' | 'json' = 'json', coin?: string): Promise<any> {
    const params: any = { format };
    if (coin) params.coin = coin;
    const { data } = await api.get('/api/export/trades', { params });
    return data;
  }

  async exportExecutions(format: 'csv' | 'json' = 'json'): Promise<any> {
    const { data } = await api.get('/api/export/executions', { params: { format } });
    return data;
  }

  async exportPerformance(): Promise<any> {
    const { data } = await api.get('/api/export/performance');
    return data;
  }

  async exportAll(): Promise<any> {
    const { data } = await api.get('/api/export/all');
    return data;
  }

  // ─── Custom Indicators ────────────────────────────────────────
  async getIndicatorTemplates(): Promise<any> {
    const { data } = await api.get('/api/indicators/templates');
    return data.data || data;
  }

  async getCustomIndicators(): Promise<any> {
    const { data } = await api.get('/api/indicators/custom');
    return data.data || data;
  }

  async getCustomIndicator(id: number): Promise<any> {
    const { data } = await api.get(`/api/indicators/custom/${id}`);
    return data.data || data;
  }

  async createCustomIndicator(params: {
    name: string;
    description?: string;
    formula: any;
    type: string;
    timeframe?: string;
    parameters?: Record<string, number>;
  }): Promise<any> {
    const { data } = await api.post('/api/indicators/custom', params);
    return data.data || data;
  }

  async updateCustomIndicator(id: number, params: Partial<{
    name: string;
    description: string;
    formula: any;
    type: string;
    timeframe: string;
    parameters: Record<string, number>;
    enabled: boolean;
  }>): Promise<any> {
    const { data } = await api.put(`/api/indicators/custom/${id}`, params);
    return data.data || data;
  }

  async deleteCustomIndicator(id: number): Promise<any> {
    const { data } = await api.delete(`/api/indicators/custom/${id}`);
    return data;
  }

  async testCustomIndicator(id: number, prices: number[]): Promise<any> {
    const { data } = await api.post(`/api/indicators/custom/${id}/test`, { prices });
    return data.data || data;
  }

  async getIndicatorUsage(coin: string): Promise<any> {
    const { data } = await api.get(`/api/indicators/usage/${coin}`);
    return data.data || data;
  }

  async setIndicatorUsage(indicatorId: number, coin: string, weight: number, enabled: boolean): Promise<any> {
    const { data } = await api.post('/api/indicators/usage', { indicatorId, coin, weight, enabled });
    return data.data || data;
  }

  // ─── Obsidian Export ─────────────────────────────────────────
  async exportObsidian(coin?: string): Promise<string> {
    const params: any = {};
    if (coin) params.coin = coin;
    const { data } = await api.get('/api/export/obsidian', { params, responseType: 'text' });
    return data;
  }

  // ─── Backtesting ─────────────────────────────────────────────
  async getBacktestCoins(): Promise<any> {
    const { data } = await api.get('/api/backtest/coins');
    return data.data || data;
  }

  async getBacktestPresets(): Promise<any> {
    const { data } = await api.get('/api/backtest/presets');
    return data.data || data;
  }

  async runBacktest(params: {
    coin: string;
    startDate: string;
    endDate: string;
    initialBalance?: number;
    riskPct?: number;
    entryThreshold?: number;
    stopLossPct?: number;
    takeProfitPct?: number;
    maxHoldHours?: number;
  }): Promise<any> {
    const { data } = await api.post('/api/backtest/run', params);
    return data.data || data;
  }

  async compareBacktests(scenarios: any[]): Promise<any> {
    const { data } = await api.post('/api/backtest/compare', { scenarios });
    return data.data || data;
  }

  async exportBacktest(params: any): Promise<any> {
    const { data } = await api.post('/api/backtest/export', params, { responseType: 'blob' });
    return data;
  }

  // ─── Real-time PnL ────────────────────────────────────────────
  async getPnL(): Promise<any> {
    const { data } = await api.get('/api/portfolio/pnl');
    return data.data || data;
  }

  async getPnLByCoin(coin: string): Promise<any> {
    const { data } = await api.get(`/api/portfolio/pnl/${coin}`);
    return data.data || data;
  }

  // ─── Alert Config ─────────────────────────────────────────────
  async getAlerts(): Promise<any> {
    const { data } = await api.get('/api/alerts');
    return data.data || data;
  }

  async getAlertsByCoin(coin: string): Promise<any> {
    const { data } = await api.get(`/api/alerts/${coin}`);
    return data.data || data;
  }

  async createAlert(params: {
    coin: string;
    alertType: string;
    threshold: number;
    cooldownMinutes?: number;
  }): Promise<any> {
    const { data } = await api.post('/api/alerts', params);
    return data.data || data;
  }

  async updateAlert(id: number, params: {
    threshold?: number;
    enabled?: boolean;
    cooldownMinutes?: number;
  }): Promise<any> {
    const { data } = await api.put(`/api/alerts/${id}`, params);
    return data.data || data;
  }

  async deleteAlert(id: number): Promise<any> {
    const { data } = await api.delete(`/api/alerts/${id}`);
    return data;
  }

  async checkAlerts(): Promise<any> {
    const { data } = await api.post('/api/alerts/check');
    return data.data || data;
  }

  async getAlertHistory(limit: number = 50): Promise<any[]> {
    const { data } = await api.get('/api/alerts/history/all', { params: { limit } });
    return data.data || data;
  }

  async getAlertHistoryByCoin(coin: string, limit: number = 50): Promise<any[]> {
    const { data } = await api.get(`/api/alerts/history/${coin}`, { params: { limit } });
    return data.data || data;
  }

  async getAlertSummary(coin: string): Promise<any> {
    const { data } = await api.get(`/api/alerts/summary/${coin}`);
    return data.data || data;
  }

  // ─── Health ───────────────────────────────────────────────────
  async healthCheck(): Promise<boolean> {
    try {
      const { data } = await api.get('/api/health');
      return data.status === 'ok';
    } catch {
      return false;
    }
  }

  // ─── Cache Management ─────────────────────────────────────────
  async clearCache(): Promise<void> {
    await cache.clearAll();
  }

  async getCacheStats(): Promise<{ totalEntries: number; totalSize: number }> {
    return cache.getStats();
  }
}

export const apiService = new ApiService();
