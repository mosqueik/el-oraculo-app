// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — WebSocket Server (Socket.IO + Rate Limiting)
// ═══════════════════════════════════════════════════════════════════
//
// Protections:
//   1. Connection rate limit: max connections per IP per minute
//   2. Subscription rate limit: max subscribe events per socket per minute
//   3. Event flood protection: max events per socket per second
//   4. Max rooms per socket: prevent room explosion
//   5. Connection timeout: auto-disconnect idle sockets
// ═══════════════════════════════════════════════════════════════════

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { getRateLimitStore } from '../middleware/rateLimitStore';

// ─── Configuration ──────────────────────────────────────────────

const WS_CONFIG = {
  // Connection limits
  maxConnectionsPerIP: 5,          // Max 5 simultaneous connections per IP
  connectionWindowMs: 60_000,      // 1 minute window for connection counting

  // Subscription limits
  maxSubscriptionsPerMinute: 30,   // Max 30 subscribe/unsubscribe events per minute
  maxRoomsPerSocket: 15,           // Max 15 rooms per socket (10 coins + portfolio + extras)

  // Event flood protection
  maxEventsPerSecond: 50,          // Max 50 custom events per second per socket

  // Idle timeout
  idleTimeoutMs: 30 * 60_000,     // 30 minutes idle = disconnect

  // Cleanup interval
  cleanupIntervalMs: 60_000,       // Check for stale connections every minute
} as const;

// ─── Per-Socket Tracking ────────────────────────────────────────

interface SocketTracker {
  id: string;
  ip: string;
  connectedAt: number;
  lastActivity: number;
  eventCount: number;           // Events in current second
  eventWindowStart: number;     // Start of current second window
  subscriptionCount: number;    // Subscribe events in current minute
  subscriptionWindowStart: number;
  roomCount: number;
}

const socketTrackers = new Map<string, SocketTracker>();

// ─── Connection Tracking by IP ──────────────────────────────────

const ipConnections = new Map<string, { count: number; windowStart: number }>();

function incrementIPConnection(ip: string): boolean {
  const now = Date.now();
  const existing = ipConnections.get(ip);

  if (!existing || now - existing.windowStart > WS_CONFIG.connectionWindowMs) {
    ipConnections.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (existing.count >= WS_CONFIG.maxConnectionsPerIP) {
    return false; // Rate limited
  }

  existing.count++;
  return true;
}

function decrementIPConnection(ip: string): void {
  const existing = ipConnections.get(ip);
  if (existing && existing.count > 0) {
    existing.count--;
    if (existing.count <= 0) {
      ipConnections.delete(ip);
    }
  }
}

function getConnectionCount(ip: string): number {
  const existing = ipConnections.get(ip);
  if (!existing || Date.now() - existing.windowStart > WS_CONFIG.connectionWindowMs) {
    return 0;
  }
  return existing.count;
}

// ─── Event Flood Tracking ───────────────────────────────────────

function checkEventFlood(tracker: SocketTracker): boolean {
  const now = Date.now();
  const currentSecond = Math.floor(now / 1000);

  if (currentSecond !== tracker.eventWindowStart) {
    // New second — reset counter
    tracker.eventCount = 0;
    tracker.eventWindowStart = currentSecond;
  }

  tracker.eventCount++;
  tracker.lastActivity = now;

  return tracker.eventCount <= WS_CONFIG.maxEventsPerSecond;
}

// ─── Subscription Rate Limiting ─────────────────────────────────

function checkSubscriptionRate(tracker: SocketTracker): boolean {
  const now = Date.now();

  if (now - tracker.subscriptionWindowStart > 60_000) {
    // New minute — reset counter
    tracker.subscriptionCount = 0;
    tracker.subscriptionWindowStart = now;
  }

  tracker.subscriptionCount++;
  return tracker.subscriptionCount <= WS_CONFIG.maxSubscriptionsPerMinute;
}

// ─── Socket.IO Connection Rate Limit Store ──────────────────────

let wsRateLimitStore: any = null;

function getWSRateLimitStore() {
  if (wsRateLimitStore) return wsRateLimitStore;

  const store = getRateLimitStore();
  if (store) {
    // Create a prefixed store for WebSocket limits
    const { SqliteRateLimitStore } = require('../middleware/rateLimitStore');
    wsRateLimitStore = new SqliteRateLimitStore(store.db, 'ws:');
  }

  return wsRateLimitStore;
}

// ─── Event Types ────────────────────────────────────────────────

export interface TradeEvent {
  coin: string;
  action: 'COMPRAR' | 'VENDER' | 'ESPERAR' | 'EMERGENCY_SELL';
  price: number;
  motivo: string;
  timestamp: string;
}

export interface PriceEvent {
  coin: string;
  price: number;
  change24h: number;
  timestamp: string;
}

export interface ScoreEvent {
  coin: string;
  score: number;
  rsi: number;
  adx: number;
  timestamp: string;
}

export interface StatusEvent {
  coin: string;
  status: 'LÍQUIDO' | 'COMPRADO';
  entryPrice?: number;
  timestamp: string;
}

export interface BotStatusEvent {
  running: boolean;
  uptime: number;
  timestamp: string;
}

export interface PnLEvent {
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

let io: Server | null = null;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

// ─── Initialize WebSocket Server ────────────────────────────────

/**
 * Initialize WebSocket server with rate limiting
 */
export function initWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
    // Connection state recovery (reconnect after disconnect)
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
    },
  });

  io.use((socket, next) => {
    // Extract IP
    const ip = getSocketIP(socket);

    // Check connection rate limit
    if (!incrementIPConnection(ip)) {
      const count = getConnectionCount(ip);
      logger.warn(`🔌 WebSocket connection rejected: IP ${ip} has ${count} connections (max ${WS_CONFIG.maxConnectionsPerIP})`);

      // Also track in SQLite store
      const store = getWSRateLimitStore();
      if (store) {
        store.increment(`conn:${ip}`);
      }

      return next(new Error('Too many connections from this IP'));
    }

    next();
  });

  io.on('connection', (socket: Socket) => {
    const ip = getSocketIP(socket);
    logger.info(`🔌 Client connected: ${socket.id} from ${ip}`);

    // Create tracker for this socket
    const tracker: SocketTracker = {
      id: socket.id,
      ip,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      eventCount: 0,
      eventWindowStart: Math.floor(Date.now() / 1000),
      subscriptionCount: 0,
      subscriptionWindowStart: Date.now(),
      roomCount: 0,
    };
    socketTrackers.set(socket.id, tracker);

    // ── Subscribe to coin room ──
    socket.on('subscribe:coin', (coin: string) => {
      if (!checkEventFlood(tracker)) {
        logger.warn(`🔌 Event flood detected from ${socket.id}, ignoring subscribe:coin`);
        return;
      }

      if (!checkSubscriptionRate(tracker)) {
        socket.emit('error', { message: 'Subscription rate limit exceeded (30/min)' });
        logger.warn(`🔌 Subscription rate limit exceeded from ${socket.id}`);
        return;
      }

      if (tracker.roomCount >= WS_CONFIG.maxRoomsPerSocket) {
        socket.emit('error', { message: `Max rooms reached (${WS_CONFIG.maxRoomsPerSocket})` });
        logger.warn(`🔌 Max rooms reached for ${socket.id}: ${tracker.roomCount}`);
        return;
      }

      // Validate coin parameter
      const validCoins = ['BTC', 'ETH', 'SOL', 'BNB', 'AVAX', 'POL', 'SUI', 'LINK', 'NEAR', 'DOGE'];
      const coinUpper = coin?.toUpperCase();
      if (!coinUpper || !validCoins.includes(coinUpper)) {
        socket.emit('error', { message: 'Invalid coin' });
        return;
      }

      const roomName = `coin:${coinUpper}`;
      if (!socket.rooms.has(roomName)) {
        socket.join(roomName);
        tracker.roomCount++;
      }

      socket.emit('subscribed', { coin: coinUpper, room: roomName });
      logger.debug(`Client ${socket.id} subscribed to ${coinUpper} (${tracker.roomCount} rooms)`);
    });

    // ── Unsubscribe from coin room ──
    socket.on('unsubscribe:coin', (coin: string) => {
      if (!checkEventFlood(tracker)) return;

      const coinUpper = coin?.toUpperCase();
      if (!coinUpper) return;

      const roomName = `coin:${coinUpper}`;
      if (socket.rooms.has(roomName)) {
        socket.leave(roomName);
        tracker.roomCount = Math.max(0, tracker.roomCount - 1);
      }

      socket.emit('unsubscribed', { coin: coinUpper });
      logger.debug(`Client ${socket.id} unsubscribed from ${coinUpper} (${tracker.roomCount} rooms)`);
    });

    // ── Subscribe to portfolio room ──
    socket.on('subscribe:portfolio', () => {
      if (!checkEventFlood(tracker)) return;

      if (!checkSubscriptionRate(tracker)) {
        socket.emit('error', { message: 'Subscription rate limit exceeded (30/min)' });
        return;
      }

      if (tracker.roomCount >= WS_CONFIG.maxRoomsPerSocket) {
        socket.emit('error', { message: `Max rooms reached (${WS_CONFIG.maxRoomsPerSocket})` });
        return;
      }

      if (!socket.rooms.has('portfolio')) {
        socket.join('portfolio');
        tracker.roomCount++;
      }

      socket.emit('subscribed', { room: 'portfolio' });
      logger.debug(`Client ${socket.id} subscribed to portfolio (${tracker.roomCount} rooms)`);
    });

    // ── Ping/Pong for keepalive ──
    socket.on('ping', () => {
      tracker.lastActivity = Date.now();
      socket.emit('pong', { timestamp: Date.now() });
    });

    // ── Custom event handler with flood protection ──
    socket.onAny((eventName, ...args) => {
      if (!checkEventFlood(tracker)) {
        logger.warn(`🔌 Event flood from ${socket.id}: ${eventName}`);
        return;
      }
    });

    // ── Disconnect ──
    socket.on('disconnect', (reason) => {
      logger.info(`🔌 Client disconnected: ${socket.id} (${reason})`);
      socketTrackers.delete(socket.id);
      decrementIPConnection(ip);
    });
  });

  // ── Start cleanup timer ──
  cleanupTimer = setInterval(cleanupStaleConnections, WS_CONFIG.cleanupIntervalMs);

  logger.info(`🔌 WebSocket server initialized (max ${WS_CONFIG.maxConnectionsPerIP} conn/IP, ${WS_CONFIG.maxSubscriptionsPerMinute} subs/min)`);
  return io;
}

// ─── Cleanup Stale Connections ──────────────────────────────────

function cleanupStaleConnections(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [socketId, tracker] of socketTrackers.entries()) {
    if (now - tracker.lastActivity > WS_CONFIG.idleTimeoutMs) {
      const socket = io?.sockets.sockets.get(socketId);
      if (socket) {
        logger.info(`🔌 Disconnecting idle socket: ${socketId} (idle ${Math.round((now - tracker.lastActivity) / 60_000)}min)`);
        socket.disconnect(true);
      }
      socketTrackers.delete(socketId);
      decrementIPConnection(tracker.ip);
      cleaned++;
    }
  }

  // Also cleanup expired IP tracking windows
  for (const [ip, data] of ipConnections.entries()) {
    if (now - data.windowStart > WS_CONFIG.connectionWindowMs * 2) {
      ipConnections.delete(ip);
    }
  }

  if (cleaned > 0) {
    logger.debug(`🔌 Cleaned ${cleaned} stale WebSocket connections`);
  }
}

// ─── Helper: Get Socket IP ──────────────────────────────────────

function getSocketIP(socket: Socket): string {
  const handshake = socket.handshake;
  return (handshake.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || handshake.address
    || 'unknown';
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Get WebSocket server instance
 */
export function getIO(): Server | null {
  return io;
}

/**
 * Get WebSocket stats
 */
export function getWSStats(): {
  totalConnections: number;
  totalRooms: number;
  connectionsByIP: Record<string, number>;
  idleConnections: number;
} {
  const now = Date.now();
  const connectionsByIP: Record<string, number> = {};
  let totalRooms = 0;
  let idleConnections = 0;

  for (const tracker of socketTrackers.values()) {
    connectionsByIP[tracker.ip] = (connectionsByIP[tracker.ip] || 0) + 1;
    totalRooms += tracker.roomCount;
    if (now - tracker.lastActivity > WS_CONFIG.idleTimeoutMs) {
      idleConnections++;
    }
  }

  return {
    totalConnections: socketTrackers.size,
    totalRooms,
    connectionsByIP,
    idleConnections,
  };
}

/**
 * Get connection count for an IP
 */
export function getConnectionCountForIP(ip: string): number {
  return getConnectionCount(ip);
}

// ─── Event Emitters (unchanged, with null safety) ───────────────

export function emitTradeExecuted(event: TradeEvent): void {
  if (!io) return;
  io.to(`coin:${event.coin}`).emit('trade:executed', event);
  io.to('portfolio').emit('trade:executed', event);
}

export function emitPriceUpdate(event: PriceEvent): void {
  if (!io) return;
  io.to(`coin:${event.coin}`).emit('price:update', event);
  io.to('portfolio').emit('price:update', event);
}

export function emitScoreUpdate(event: ScoreEvent): void {
  if (!io) return;
  io.to(`coin:${event.coin}`).emit('score:update', event);
  io.to('portfolio').emit('score:update', event);
}

export function emitStatusChange(event: StatusEvent): void {
  if (!io) return;
  io.to(`coin:${event.coin}`).emit('status:update', event);
  io.to('portfolio').emit('status:update', event);
}

export function emitBotStatus(event: BotStatusEvent): void {
  if (!io) return;
  io.emit('bot:status', event);
}

export function emitPnLUpdate(event: PnLEvent): void {
  if (!io) return;
  io.to('portfolio').emit('pnl:update', event);
  io.emit('pnl:update', event);
}

export function broadcast(event: string, data: any): void {
  if (!io) return;
  io.emit(event, data);
}

// ─── Shutdown ───────────────────────────────────────────────────

export function shutdownWebSocket(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
  socketTrackers.clear();
  ipConnections.clear();
  io = null;
}
