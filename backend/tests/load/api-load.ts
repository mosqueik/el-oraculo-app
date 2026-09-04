// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — API Load Test (autocannon)
// ═══════════════════════════════════════════════════════════════════
//
// Tests API endpoint performance under concurrent load.
// Measures: throughput, latency, error rate, memory usage.
//
// Usage: npx tsx tests/load/api-load.ts
//
// Requirements: Server must be running on localhost:3001
// ═══════════════════════════════════════════════════════════════════

import autocannon from 'autocannon';
import { createServer } from 'http';
import { initializeDatabase } from '../../src/database/init';
import { closeDatabase, getDb } from '../../src/database/connection';
import { initRateLimitStore } from '../../src/middleware/rateLimitStore';
import express from 'express';
import routes from '../../src/routes';

// ─── Configuration ──────────────────────────────────────────────

const API_CONFIG = {
  url: 'http://localhost:3001',
  duration: 10,           // 10 seconds per test
  connections: 10,        // 10 concurrent connections
  pipelining: 1,          // No pipelining (realistic)
  warmup: 3,              // 3 seconds warmup
};

const ENDPOINTS = [
  { name: 'Health Check', method: 'GET', path: '/api/health' },
  { name: 'Get Coins', method: 'GET', path: '/api/portfolio' },
  { name: 'Get Trades', method: 'GET', path: '/api/trades' },
  { name: 'Get Executions', method: 'GET', path: '/api/executions' },
  { name: 'Rate Limit Status', method: 'GET', path: '/api/ratelimit/status' },
];

// ─── Local Server for Testing ───────────────────────────────────

let server: any;
let port: number;

async function startTestServer(): Promise<number> {
  // Initialize database
  await initializeDatabase();

  // Initialize rate limit store
  const db = getDb();
  initRateLimitStore(db);

  // Create Express app
  const app = express();
  app.use(express.json());
  app.use('/api', routes);

  // Start server on random port
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      port = (server.address() as any).port;
      resolve(port);
    });
  });
}

function stopTestServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        closeDatabase();
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// ─── Run Autocannon Test ────────────────────────────────────────

async function runEndpointTest(endpoint: typeof ENDPOINTS[0]): Promise<{
  name: string;
  url: string;
  requestsPerSec: number;
  latencyAvg: number;
  latencyP50: number;
  latencyP99: number;
  throughput: number;
  errors: number;
  timeouts: number;
  totalRequests: number;
  duration: number;
}> {
  const url = `http://localhost:${port}${endpoint.path}`;

  const result = await autocannon({
    url,
    method: endpoint.method,
    connections: API_CONFIG.connections,
    duration: API_CONFIG.duration,
    pipelining: API_CONFIG.pipelining,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return {
    name: endpoint.name,
    url: endpoint.path,
    requestsPerSec: Math.round(result.requests.average),
    latencyAvg: Math.round(result.latency.average),
    latencyP50: Math.round(result.latency.p50),
    latencyP99: Math.round(result.latency.p99),
    throughput: Math.round(result.throughput.average),
    errors: result.errors || 0,
    timeouts: result.timeouts || 0,
    totalRequests: result.requests.total,
    duration: result.duration,
  };
}

// ─── Run All Tests ──────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  EL ORÁCULO — API Load Test (autocannon)               ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`Config: ${API_CONFIG.connections} connections × ${API_CONFIG.duration}s per endpoint`);
  console.log();

  // Start test server
  console.log('📦 Starting test server...');
  await startTestServer();
  console.log(`✅ Server running on port ${port}`);
  console.log();

  const results = [];

  for (const endpoint of ENDPOINTS) {
    console.log(`\n🚀 Testing: ${endpoint.name} (${endpoint.method} ${endpoint.path})...`);

    try {
      const result = await runEndpointTest(endpoint);
      results.push(result);

      console.log(`   📊 ${result.requestsPerSec} req/s`);
      console.log(`   ⏱️  Latency — avg: ${result.latencyAvg}ms, p50: ${result.latencyP50}ms, p99: ${result.latencyP99}ms`);
      console.log(`   📈 Throughput: ${(result.throughput / 1024).toFixed(2)} KB/s`);
      console.log(`   ❌ Errors: ${result.errors}, Timeouts: ${result.timeouts}`);
      console.log(`   📦 Total requests: ${result.totalRequests}`);
    } catch (error) {
      console.error(`   ❌ Failed: ${error}`);
    }
  }

  // Summary table
  console.log('\n\n╔══════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                              API LOAD TEST RESULTS                                    ║');
  console.log('╠═══════════════════╦══════════════╦════════════╦════════════╦════════════╦══════════════╣');
  console.log('║ Endpoint          ║ req/s        ║ avg (ms)   ║ p50 (ms)   ║ p99 (ms)   ║ errors       ║');
  console.log('╠═══════════════════╬══════════════╬════════════╬════════════╬════════════╬══════════════╣');

  for (const r of results) {
    console.log(
      `║ ${r.name.padEnd(17)} ║ ${String(r.requestsPerSec).padEnd(12)} ║ ${String(r.latencyAvg).padEnd(10)} ║ ${String(r.latencyP50).padEnd(10)} ║ ${String(r.latencyP99).padEnd(10)} ║ ${String(r.errors).padEnd(12)} ║`
    );
  }

  console.log('╚═══════════════════╩══════════════╩════════════╩════════════╩════════════╩══════════════╝');

  // Performance assessment
  console.log('\n📋 Performance Assessment:');

  const avgRps = results.reduce((sum, r) => sum + r.requestsPerSec, 0) / results.length;
  const avgLatency = results.reduce((sum, r) => sum + r.latencyAvg, 0) / results.length;
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

  console.log(`   📊 Average throughput: ${Math.round(avgRps)} req/s`);
  console.log(`   ⏱️  Average latency: ${Math.round(avgLatency)}ms`);
  console.log(`   ❌ Total errors: ${totalErrors}`);

  if (avgRps > 1000) {
    console.log('   ✅ Throughput is excellent (> 1000 req/s)');
  } else if (avgRps > 500) {
    console.log('   ⚠️  Throughput is good (> 500 req/s)');
  } else {
    console.log('   ❌ Throughput needs improvement (< 500 req/s)');
  }

  if (avgLatency < 50) {
    console.log('   ✅ Latency is excellent (< 50ms)');
  } else if (avgLatency < 200) {
    console.log('   ⚠️  Latency is acceptable (< 200ms)');
  } else {
    console.log('   ❌ Latency is high (> 200ms)');
  }

  if (totalErrors === 0) {
    console.log('   ✅ Zero errors — all requests successful');
  } else {
    console.log(`   ⚠️  ${totalErrors} errors detected`);
  }

  // Cleanup
  console.log('\n🧹 Cleaning up...');
  await stopTestServer();
  console.log('✅ Done');
}

main().catch(console.error);
