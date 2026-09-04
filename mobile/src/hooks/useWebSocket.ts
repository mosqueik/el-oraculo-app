// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — useWebSocket Hook (Real-time Updates)
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { CoinSymbol } from '../shared';
import { useConnectionStore, usePortfolioStore } from '../store';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'http://localhost:3001';

// ─── Types ──────────────────────────────────────────────────────
export interface LivePrice {
  coin: string;
  price: number;
  change24h: number;
  timestamp: string;
}

export interface LiveScore {
  coin: string;
  score: number;
  rsi: number;
  adx: number;
  timestamp: string;
}

export interface LiveTrade {
  coin: string;
  action: 'COMPRAR' | 'VENDER' | 'ESPERAR';
  price: number;
  motivo: string;
  timestamp: string;
}

export interface LivePnL {
  positions: Array<{
    coin: string;
    status: string;
    currentPrice: number;
    entryPrice: number;
    pnlPct: number;
    pnlUsd: number;
    hoursHeld: number;
    cooldownRemaining: number;
  }>;
  summary: {
    activeCount: number;
    totalPnlPct: number;
    totalPnlUsd: number;
    positionsInProfit: number;
    positionsInLoss: number;
  };
  timestamp: string;
}

interface UseWebSocketOptions {
  autoConnect?: boolean;
  coin?: string;
}

interface UseWebSocketResult {
  socket: Socket | null;
  subscribeToCoin: (coin: string) => void;
  unsubscribeFromCoin: (coin: string) => void;
  livePrices: Map<string, LivePrice>;
  liveScores: Map<string, LiveScore>;
  lastTrade: LiveTrade | null;
  livePnL: LivePnL | null;
  getPrice: (coin: string) => LivePrice | undefined;
  getScore: (coin: string) => LiveScore | undefined;
  getPnLForCoin: (coin: string) => any | undefined;
}

/**
 * Hook for WebSocket real-time connection
 * Listens for price:update, score:update, trade:executed, status:update events
 */
export function useWebSocket({ autoConnect = true, coin }: UseWebSocketOptions = {}): UseWebSocketResult {
  const socketRef = useRef<Socket | null>(null);
  const { setConnected } = useConnectionStore();
  const [livePrices, setLivePrices] = useState<Map<string, LivePrice>>(new Map());
  const [liveScores, setLiveScores] = useState<Map<string, LiveScore>>(new Map());
  const [lastTrade, setLastTrade] = useState<LiveTrade | null>(null);
  const [livePnL, setLivePnL] = useState<LivePnL | null>(null);

  useEffect(() => {
    if (!autoConnect) return;

    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);

      // Subscribe to portfolio updates
      socket.emit('subscribe:portfolio');

      // Subscribe to specific coin if provided
      if (coin) {
        socket.emit('subscribe:coin', coin);
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', () => {
      setConnected(false);
    });

    // ─── Price Updates ───────────────────────────────────────
    socket.on('price:update', (data: LivePrice) => {
      setLivePrices((prev) => {
        const next = new Map(prev);
        next.set(data.coin, data);
        return next;
      });
    });

    // ─── Score Updates ───────────────────────────────────────
    socket.on('score:update', (data: LiveScore) => {
      setLiveScores((prev) => {
        const next = new Map(prev);
        next.set(data.coin, data);
        return next;
      });
    });

    // ─── Trade Events ────────────────────────────────────────
    socket.on('trade:executed', (data: LiveTrade) => {
      setLastTrade(data);
      // Refresh portfolio after trade
      usePortfolioStore.getState().refreshAll();
    });

    // ─── Status Changes ──────────────────────────────────────
    socket.on('status:update', () => {
      usePortfolioStore.getState().fetchPortfolio();
    });

    // ─── PnL Updates ─────────────────────────────────────────
    socket.on('pnl:update', (data: LivePnL) => {
      setLivePnL(data);
    });

    return () => {
      if (coin) {
        socket.emit('unsubscribe:coin', coin);
      }
      socket.emit('unsubscribe:portfolio');
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [autoConnect, coin, setConnected]);

  const subscribeToCoin = useCallback((coinSymbol: string) => {
    socketRef.current?.emit('subscribe:coin', coinSymbol);
  }, []);

  const unsubscribeFromCoin = useCallback((coinSymbol: string) => {
    socketRef.current?.emit('unsubscribe:coin', coinSymbol);
  }, []);

  const getPrice = useCallback((coinSymbol: string): LivePrice | undefined => {
    return livePrices.get(coinSymbol);
  }, [livePrices]);

  const getScore = useCallback((coinSymbol: string): LiveScore | undefined => {
    return liveScores.get(coinSymbol);
  }, [liveScores]);

  const getPnLForCoin = useCallback((coinSymbol: string): any | undefined => {
    return livePnL?.positions.find(p => p.coin === coinSymbol);
  }, [livePnL]);

  return {
    socket: socketRef.current,
    subscribeToCoin,
    unsubscribeFromCoin,
    livePrices,
    liveScores,
    lastTrade,
    livePnL,
    getPrice,
    getScore,
    getPnLForCoin,
  };
}
