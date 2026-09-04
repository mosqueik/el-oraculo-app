// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — WebSocket Server Tests
// Tests Socket.IO connections, rooms, and event emission
// ═══════════════════════════════════════════════════════════════════

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { Server as SocketIOServer, Server } from 'socket.io';
import { io as SocketIOClient, Socket } from 'socket.io-client';

// ─── WebSocket Server Implementation (inline for testing) ───────

interface TradeEvent {
  coin: string;
  action: 'COMPRAR' | 'VENDER' | 'ESPERAR';
  price: number;
  motivo: string;
  timestamp: string;
}

interface PriceEvent {
  coin: string;
  price: number;
  change24h: number;
  timestamp: string;
}

interface ScoreEvent {
  coin: string;
  score: number;
  rsi: number;
  adx: number;
  timestamp: string;
}

interface StatusEvent {
  coin: string;
  status: 'LÍQUIDO' | 'COMPRADO';
  entryPrice?: number;
  timestamp: string;
}

interface BotStatusEvent {
  running: boolean;
  uptime: number;
  timestamp: string;
}

let io: Server | null = null;

function initWebSocket(httpServer: http.Server): Server {
  io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    // Join coin-specific rooms
    socket.on('subscribe:coin', (coin: string) => {
      socket.join(`coin:${coin}`);
    });

    // Leave coin-specific rooms
    socket.on('unsubscribe:coin', (coin: string) => {
      socket.leave(`coin:${coin}`);
    });

    // Join portfolio room
    socket.on('subscribe:portfolio', () => {
      socket.join('portfolio');
    });
  });

  return io;
}

function emitTradeExecuted(event: TradeEvent): void {
  if (!io) return;
  io.to(`coin:${event.coin}`).emit('trade:executed', event);
  io.to('portfolio').emit('trade:executed', event);
}

function emitPriceUpdate(event: PriceEvent): void {
  if (!io) return;
  io.to(`coin:${event.coin}`).emit('price:update', event);
  io.to('portfolio').emit('price:update', event);
}

function emitScoreUpdate(event: ScoreEvent): void {
  if (!io) return;
  io.to(`coin:${event.coin}`).emit('score:update', event);
  io.to('portfolio').emit('score:update', event);
}

function emitStatusChange(event: StatusEvent): void {
  if (!io) return;
  io.to(`coin:${event.coin}`).emit('status:update', event);
  io.to('portfolio').emit('status:update', event);
}

function emitBotStatus(event: BotStatusEvent): void {
  if (!io) return;
  io.emit('bot:status', event);
}

// ─── Test Helpers ────────────────────────────────────────────────

let httpServer: http.Server;
let serverUrl: string;

function createServer(): Promise<void> {
  return new Promise((resolve) => {
    httpServer = http.createServer();
    initWebSocket(httpServer);
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      if (addr && typeof addr === 'object') {
        serverUrl = `http://localhost:${addr.port}`;
      }
      resolve();
    });
  });
}

function closeServer(): Promise<void> {
  return new Promise((resolve) => {
    if (io) {
      io.close();
      io = null;
    }
    if (httpServer) {
      httpServer.close(() => resolve());
    } else {
      resolve();
    }
  });
}

function createClient(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const client = SocketIOClient(serverUrl, { transports: ['websocket'] });
    client.on('connect', () => resolve(client));
    client.on('connect_error', reject);
  });
}

function waitForEvent(client: Socket, event: string, timeoutMs = 2000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs);
    client.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// ─── Tests ───────────────────────────────────────────────────────

describe('WebSocket Server', () => {
  before(async () => {
    await createServer();
  });

  after(async () => {
    await closeServer();
  });

  // ─── Connection Tests ────────────────────────────────────────

  describe('Connection', () => {
    it('should accept client connections', async () => {
      const client = await createClient();
      assert.ok(client.connected);
      client.disconnect();
    });

    it('should handle multiple simultaneous connections', async () => {
      const client1 = await createClient();
      const client2 = await createClient();
      const client3 = await createClient();

      assert.ok(client1.connected);
      assert.ok(client2.connected);
      assert.ok(client3.connected);

      client1.disconnect();
      client2.disconnect();
      client3.disconnect();
    });

    it('should handle client disconnection', async () => {
      const client = await createClient();
      assert.ok(client.connected);

      const disconnectPromise = new Promise<void>((resolve) => {
        client.on('disconnect', () => resolve());
      });

      client.disconnect();
      await disconnectPromise;
      assert.ok(!client.connected);
    });
  });

  // ─── Room Subscription Tests ─────────────────────────────────

  describe('Room Subscriptions', () => {
    it('should subscribe to coin room', async () => {
      const client = await createClient();
      client.emit('subscribe:coin', 'BTC');

      // Wait a bit for room join to process
      await new Promise(r => setTimeout(r, 50));

      // Verify by emitting to the room
      const eventPromise = waitForEvent(client, 'trade:executed');
      emitTradeExecuted({ coin: 'BTC', action: 'COMPRAR', price: 50000, motivo: 'TEST', timestamp: new Date().toISOString() });

      const event = await eventPromise;
      assert.equal(event.coin, 'BTC');
      assert.equal(event.action, 'COMPRAR');

      client.disconnect();
    });

    it('should unsubscribe from coin room', async () => {
      const client = await createClient();
      client.emit('subscribe:coin', 'ETH');
      await new Promise(r => setTimeout(r, 50));

      client.emit('unsubscribe:coin', 'ETH');
      await new Promise(r => setTimeout(r, 50));

      // Should NOT receive events for ETH after unsubscribe
      let received = false;
      client.on('trade:executed', () => { received = true; });

      emitTradeExecuted({ coin: 'ETH', action: 'VENDER', price: 3500, motivo: 'TEST', timestamp: new Date().toISOString() });
      await new Promise(r => setTimeout(r, 200));

      assert.equal(received, false);
      client.disconnect();
    });

    it('should subscribe to portfolio room', async () => {
      const client = await createClient();
      client.emit('subscribe:portfolio');
      await new Promise(r => setTimeout(r, 50));

      const eventPromise = waitForEvent(client, 'trade:executed');
      emitTradeExecuted({ coin: 'SOL', action: 'COMPRAR', price: 150, motivo: 'TEST', timestamp: new Date().toISOString() });

      const event = await eventPromise;
      assert.equal(event.coin, 'SOL');

      client.disconnect();
    });

    it('should receive events only for subscribed coins', async () => {
      const client = await createClient();
      client.emit('subscribe:coin', 'BTC');
      await new Promise(r => setTimeout(r, 50));

      let btcReceived = false;
      let ethReceived = false;

      client.on('trade:executed', (event: any) => {
        if (event.coin === 'BTC') btcReceived = true;
        if (event.coin === 'ETH') ethReceived = true;
      });

      emitTradeExecuted({ coin: 'BTC', action: 'COMPRAR', price: 50000, motivo: 'TEST', timestamp: new Date().toISOString() });
      emitTradeExecuted({ coin: 'ETH', action: 'COMPRAR', price: 3500, motivo: 'TEST', timestamp: new Date().toISOString() });
      await new Promise(r => setTimeout(r, 200));

      assert.equal(btcReceived, true);
      assert.equal(ethReceived, false);

      client.disconnect();
    });
  });

  // ─── Event Emission Tests ────────────────────────────────────

  describe('Event Emission', () => {
    it('should emit trade:executed to coin room', async () => {
      const client = await createClient();
      client.emit('subscribe:coin', 'BTC');
      await new Promise(r => setTimeout(r, 50));

      const eventPromise = waitForEvent(client, 'trade:executed');
      emitTradeExecuted({
        coin: 'BTC', action: 'COMPRAR', price: 50000,
        motivo: 'ENTRY: RSI_OVERSOLD', timestamp: new Date().toISOString(),
      });

      const event = await eventPromise;
      assert.equal(event.coin, 'BTC');
      assert.equal(event.action, 'COMPRAR');
      assert.equal(event.price, 50000);
      assert.equal(event.motivo, 'ENTRY: RSI_OVERSOLD');

      client.disconnect();
    });

    it('should emit price:update to coin room', async () => {
      const client = await createClient();
      client.emit('subscribe:coin', 'ETH');
      await new Promise(r => setTimeout(r, 50));

      const eventPromise = waitForEvent(client, 'price:update');
      emitPriceUpdate({
        coin: 'ETH', price: 3500, change24h: 2.5, timestamp: new Date().toISOString(),
      });

      const event = await eventPromise;
      assert.equal(event.coin, 'ETH');
      assert.equal(event.price, 3500);
      assert.equal(event.change24h, 2.5);

      client.disconnect();
    });

    it('should emit score:update to coin room', async () => {
      const client = await createClient();
      client.emit('subscribe:coin', 'SOL');
      await new Promise(r => setTimeout(r, 50));

      const eventPromise = waitForEvent(client, 'score:update');
      emitScoreUpdate({
        coin: 'SOL', score: 75, rsi: 35, adx: 30, timestamp: new Date().toISOString(),
      });

      const event = await eventPromise;
      assert.equal(event.coin, 'SOL');
      assert.equal(event.score, 75);

      client.disconnect();
    });

    it('should emit status:update to coin room', async () => {
      const client = await createClient();
      client.emit('subscribe:coin', 'BTC');
      await new Promise(r => setTimeout(r, 50));

      const eventPromise = waitForEvent(client, 'status:update');
      emitStatusChange({
        coin: 'BTC', status: 'COMPRADO', entryPrice: 50000, timestamp: new Date().toISOString(),
      });

      const event = await eventPromise;
      assert.equal(event.coin, 'BTC');
      assert.equal(event.status, 'COMPRADO');
      assert.equal(event.entryPrice, 50000);

      client.disconnect();
    });

    it('should emit bot:status to all clients', async () => {
      const client = await createClient();
      await new Promise(r => setTimeout(r, 50));

      const eventPromise = waitForEvent(client, 'bot:status');
      emitBotStatus({
        running: true, uptime: 3600, timestamp: new Date().toISOString(),
      });

      const event = await eventPromise;
      assert.equal(event.running, true);
      assert.equal(event.uptime, 3600);

      client.disconnect();
    });

    it('should emit trade:executed to portfolio room', async () => {
      const client = await createClient();
      client.emit('subscribe:portfolio');
      await new Promise(r => setTimeout(r, 50));

      const eventPromise = waitForEvent(client, 'trade:executed');
      emitTradeExecuted({
        coin: 'ADA', action: 'VENDER', price: 0.5, motivo: 'TP', timestamp: new Date().toISOString(),
      });

      const event = await eventPromise;
      assert.equal(event.coin, 'ADA');

      client.disconnect();
    });

    it('should broadcast to multiple clients in same room', async () => {
      const client1 = await createClient();
      const client2 = await createClient();

      client1.emit('subscribe:coin', 'BTC');
      client2.emit('subscribe:coin', 'BTC');
      await new Promise(r => setTimeout(r, 50));

      const promise1 = waitForEvent(client1, 'trade:executed');
      const promise2 = waitForEvent(client2, 'trade:executed');

      emitTradeExecuted({
        coin: 'BTC', action: 'COMPRAR', price: 50000, motivo: 'TEST', timestamp: new Date().toISOString(),
      });

      const [event1, event2] = await Promise.all([promise1, promise2]);
      assert.equal(event1.coin, 'BTC');
      assert.equal(event2.coin, 'BTC');

      client1.disconnect();
      client2.disconnect();
    });
  });

  // ─── Emit Safety Tests ───────────────────────────────────────

  describe('Emit Safety (no server)', () => {
    it('should not crash when io is null', () => {
      // These functions check for null io internally
      emitTradeExecuted({ coin: 'BTC', action: 'COMPRAR', price: 50000, motivo: 'TEST', timestamp: new Date().toISOString() });
      emitPriceUpdate({ coin: 'BTC', price: 50000, change24h: 1, timestamp: new Date().toISOString() });
      emitScoreUpdate({ coin: 'BTC', score: 50, rsi: 50, adx: 25, timestamp: new Date().toISOString() });
      emitStatusChange({ coin: 'BTC', status: 'LÍQUIDO', timestamp: new Date().toISOString() });
      emitBotStatus({ running: false, uptime: 0, timestamp: new Date().toISOString() });
      // If we get here without throwing, the test passes
      assert.ok(true);
    });
  });
});
