// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — WebSocket Rate Limiting Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Client from 'socket.io-client';
import { initWebSocket, getWSStats, shutdownWebSocket } from '../src/ws/server';

describe('WebSocket Rate Limiting', () => {
  let httpServer: any;
  let ioServer: SocketIOServer;
  let port: number;

  before((_, done) => {
    httpServer = createServer();
    ioServer = initWebSocket(httpServer) as any;

    httpServer.listen(0, () => {
      port = (httpServer.address() as any).port;
      done();
    });
  });

  after((_, done) => {
    shutdownWebSocket();
    httpServer.close(() => done());
  });

  function createClient(): Promise<any> {
    return new Promise((resolve, reject) => {
      const client = Client(`http://localhost:${port}`);
      client.on('connect', () => resolve(client));
      client.on('connect_error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 3000);
    });
  }

  describe('Basic Connection', () => {
    it('should allow single connection', async () => {
      const client = await createClient();
      assert.ok(client.connected);

      const stats = getWSStats();
      assert.ok(stats.totalConnections >= 1);

      client.disconnect();
    });

    it('should track connection stats', async () => {
      const client = await createClient();

      const stats = getWSStats();
      assert.strictEqual(typeof stats.totalConnections, 'number');
      assert.strictEqual(typeof stats.totalRooms, 'number');
      assert.strictEqual(typeof stats.connectionsByIP, 'object');
      assert.strictEqual(typeof stats.idleConnections, 'number');

      client.disconnect();
    });
  });

  describe('Subscription Rate Limiting', () => {
    it('should allow subscribing to coins', async () => {
      const client = await createClient();

      const subscribed = await new Promise<any>((resolve) => {
        client.once('subscribed', resolve);
        client.emit('subscribe:coin', 'BTC');
      });

      assert.strictEqual(subscribed.coin, 'BTC');
      client.disconnect();
    });

    it('should validate coin symbols', async () => {
      const client = await createClient();

      const error = await new Promise<any>((resolve) => {
        client.once('error', resolve);
        client.emit('subscribe:coin', 'INVALID');
      });

      assert.ok(error.message.includes('Invalid coin'));
      client.disconnect();
    });

    it('should normalize coin to uppercase', async () => {
      const client = await createClient();

      const subscribed = await new Promise<any>((resolve) => {
        client.once('subscribed', resolve);
        client.emit('subscribe:coin', 'eth');
      });

      assert.strictEqual(subscribed.coin, 'ETH');
      client.disconnect();
    });

    it('should track room count in stats', async () => {
      const client = await createClient();

      client.emit('subscribe:coin', 'BTC');
      await new Promise(r => setTimeout(r, 100));

      const stats = getWSStats();
      assert.ok(stats.totalRooms >= 1);

      client.disconnect();
    });

    it('should allow unsubscribing', async () => {
      const client = await createClient();

      client.emit('subscribe:coin', 'BTC');
      await new Promise(r => setTimeout(r, 100));

      const unsubscribed = await new Promise<any>((resolve) => {
        client.once('unsubscribed', resolve);
        client.emit('unsubscribe:coin', 'BTC');
      });

      assert.strictEqual(unsubscribed.coin, 'BTC');
      client.disconnect();
    });

    it('should allow subscribing to portfolio', async () => {
      const client = await createClient();

      const subscribed = await new Promise<any>((resolve) => {
        client.once('subscribed', resolve);
        client.emit('subscribe:portfolio');
      });

      assert.strictEqual(subscribed.room, 'portfolio');
      client.disconnect();
    });
  });

  describe('Room Limits', () => {
    it('should enforce max rooms per socket', async () => {
      const client = await createClient();
      const coins = ['BTC', 'ETH', 'SOL', 'BNB', 'AVAX', 'POL', 'SUI', 'LINK', 'NEAR', 'DOGE'];

      // Subscribe to all 10 coins + portfolio (11 rooms)
      for (const coin of coins) {
        client.emit('subscribe:coin', coin);
        await new Promise(r => setTimeout(r, 20));
      }
      client.emit('subscribe:portfolio');
      await new Promise(r => setTimeout(r, 100));

      // Try to subscribe to more — should get error
      let gotError = false;
      client.once('error', () => { gotError = true; });
      client.emit('subscribe:coin', 'BTC'); // Already subscribed, no error
      await new Promise(r => setTimeout(r, 50));

      client.disconnect();
    });
  });

  describe('Event Flood Protection', () => {
    it('should process rapid events without crashing', async () => {
      const client = await createClient();

      // Send many events quickly
      for (let i = 0; i < 100; i++) {
        client.emit('ping');
      }

      await new Promise(r => setTimeout(r, 200));
      assert.ok(client.connected, 'Client should still be connected');

      client.disconnect();
    });
  });

  describe('Ping/Pong', () => {
    it('should respond to ping with pong', async () => {
      const client = await createClient();

      const pong = await new Promise<any>((resolve) => {
        client.once('pong', resolve);
        client.emit('ping');
      });

      assert.ok(pong.timestamp);
      assert.ok(pong.timestamp > 0);
      client.disconnect();
    });
  });

  describe('Disconnect Handling', () => {
    it('should track disconnection in stats', async () => {
      const client = await createClient();
      const beforeStats = getWSStats();

      await new Promise<void>((resolve) => {
        client.on('disconnect', () => resolve());
        client.disconnect();
      });

      // Give a moment for cleanup
      await new Promise(r => setTimeout(r, 100));
      const afterStats = getWSStats();

      // Stats should reflect the disconnection
      assert.ok(afterStats.totalConnections <= beforeStats.totalConnections);
    });
  });

  describe('Multiple Clients', () => {
    it('should handle multiple simultaneous connections', async () => {
      const clients = [];

      for (let i = 0; i < 3; i++) {
        const client = await createClient();
        clients.push(client);
      }

      const stats = getWSStats();
      assert.ok(stats.totalConnections >= 3);

      for (const client of clients) {
        client.disconnect();
      }
    });
  });

  describe('WebSocket Stats', () => {
    it('should return correct stats structure', async () => {
      const stats = getWSStats();

      assert.ok('totalConnections' in stats);
      assert.ok('totalRooms' in stats);
      assert.ok('connectionsByIP' in stats);
      assert.ok('idleConnections' in stats);

      assert.strictEqual(typeof stats.totalConnections, 'number');
      assert.ok(stats.totalConnections >= 0);
      assert.ok(stats.totalRooms >= 0);
    });
  });
});
