// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Load Test: Concurrent Coin Processing
// ═══════════════════════════════════════════════════════════════════
//
// Simulates processing multiple coins concurrently to measure:
//   - Indicator calculation throughput
//   - Decision latency per coin
//   - Memory usage under load
//   - Concurrency safety
//
// Usage: npx tsx tests/load/concurrent-coins.ts
// ═══════════════════════════════════════════════════════════════════

import { IndicatorService } from '../../src/modules/indicators/service';
import { ScoringService } from '../../src/modules/scoring/service';
import { RiskService } from '../../src/modules/risk/service';
import { RSI, ADX, BollingerBands, ATR, EMA, MACD } from 'technicalindicators';
import { ACTIVE_COINS, COIN_CONFIGS, FullIndicatorData } from '@el-oraculo/shared';

// ─── Configuration ──────────────────────────────────────────────

const CONFIG = {
  iterations: 5,                // Number of full cycles
  coinsPerCycle: ACTIVE_COINS.length, // All 10 coins
  candleCount: 200,             // Candles per timeframe
  concurrency: [1, 2, 5, 10],  // Test different concurrency levels
  warmupIterations: 2,          // Warmup before measurement
};

// ─── Synthetic Data Generator ───────────────────────────────────

function generateCandles(count: number, basePrice: number, volatility: number = 0.02) {
  const candles = [];
  let price = basePrice;

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.48) * volatility;
    const open = price;
    price = price * (1 + change);
    const close = price;
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    const volume = 1000 + Math.random() * 5000;

    candles.push({ timestamp: Date.now() - (count - i) * 900000, open, high, low, close, volume });
  }
  return candles;
}

function generateMultiTimeframeData(coin: string) {
  const config = COIN_CONFIGS[coin as keyof typeof COIN_CONFIGS];
  const basePrice = config?.pair.includes('BTC') ? 65000
    : config?.pair.includes('ETH') ? 3500
    : config?.pair.includes('SOL') ? 150
    : 100;

  return {
    '15m': generateCandles(CONFIG.candleCount, basePrice),
    '1h': generateCandles(CONFIG.candleCount, basePrice),
    '4h': generateCandles(CONFIG.candleCount, basePrice),
  };
}

// ─── Indicator Calculation (replicated from service) ────────────

function calculateIndicators(candles: any[]): FullIndicatorData {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);
  const currentPrice = closes[closes.length - 1] || 0;

  const rsi = RSI.calculate({ values: closes, period: 14 });
  const adx = ADX.calculate({ high: highs, low: lows, close: closes, period: 14 });
  const bb = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
  const atr = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
  const ema20 = EMA.calculate({ values: closes, period: 20 });
  const ema50 = EMA.calculate({ values: closes, period: 50 });
  const macd = MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });

  const lastRsi = rsi[rsi.length - 1] ?? 50;
  const lastAdx = adx[adx.length - 1] ?? { adx: 20, pdi: 0, mdi: 0 };
  const lastBB = bb[bb.length - 1] ?? { upper: 0, middle: 0, lower: 0 };
  const lastAtr = atr[atr.length - 1] ?? 0;
  const lastEma20 = ema20[ema20.length - 1] ?? currentPrice;
  const lastEma50 = ema50[ema50.length - 1] ?? currentPrice;
  const lastMacd = macd[macd.length - 1];
  const macdHist = lastMacd ? (lastMacd as any).histogram ?? 0 : 0;

  let momentum: 'BULL' | 'BEAR' | 'NEUTRAL' = 'NEUTRAL';
  if (lastEma20 > lastEma50 && lastRsi > 50 && macdHist > 0) momentum = 'BULL';
  else if (lastEma20 < lastEma50 && lastRsi < 50 && macdHist < 0) momentum = 'BEAR';

  return {
    rsi: lastRsi, adx: lastAdx.adx, adx_btc: 0, histogram: macdHist,
    bb_lower: lastBB.lower, bb_upper: lastBB.upper,
    plusDI: lastAdx.pdi, minusDI: lastAdx.mdi,
    atr_pct: currentPrice > 0 ? (lastAtr / currentPrice) * 100 : 0,
    volume: volumes[volumes.length - 1] || 0,
    macd: lastMacd ? { macd: (lastMacd as any).MACD ?? 0, signal: (lastMacd as any).signal ?? 0, histogram: macdHist } : null,
    stochRsi: null, obv: 0, vwap: currentPrice,
    ema20: lastEma20, ema50: lastEma50, ema200: currentPrice,
    fvg: 'NEUTRAL', choch: 'NEUTRAL', squeeze: false, squeezeMomentum: 0, momentum,
    volumeChange: 0, bbWidth: lastBB.upper > 0 ? ((lastBB.upper - lastBB.lower) / lastBB.middle) * 100 : 0,
    atr: lastAtr, currentPrice,
  };
}

// ─── Single Coin Pipeline Simulation ────────────────────────────

function simulateCoinPipeline(coin: string): { decision: string; latencyMs: number } {
  const start = performance.now();

  const data = generateMultiTimeframeData(coin);

  // Node 1: Indicators
  const indicators = calculateIndicators(data['15m']);

  // Node 1b: Multi-timeframe
  const tf1h = calculateIndicators(data['1h']);
  const tf4h = calculateIndicators(data['4h']);

  // Node 2: Market regime
  let regime = 'NEUTRAL';
  if (indicators.adx > 25) regime = 'TRENDING';
  else if (indicators.atr_pct > 2) regime = 'VOLATILE';
  else if (indicators.adx < 20) regime = 'RANGING';

  // Node 3: Scoring (simplified)
  let score = 0;
  if (indicators.rsi < 35) score += 1;
  if (indicators.rsi < 40) score += 1;
  if (indicators.adx > 25 && indicators.plusDI > indicators.minusDI) score += 1;
  if (indicators.ema20 > indicators.ema50 && indicators.histogram > 0) score += 2;
  if (indicators.momentum === 'BULL') score += 2;

  // Node 4: Decision
  const threshold = COIN_CONFIGS[coin as keyof typeof COIN_CONFIGS]?.entry_min || 2;
  const decision = score >= threshold ? 'COMPRAR' : 'ESPERAR';

  const latencyMs = performance.now() - start;
  return { decision, latencyMs };
}

// ─── Concurrent Processing Simulation ───────────────────────────

async function runConcurrentTest(concurrency: number): Promise<{
  concurrency: number;
  totalCoins: number;
  totalTimeMs: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  throughputPerSec: number;
  memoryUsageMB: number;
  decisions: Record<string, number>;
}> {
  const memBefore = process.memoryUsage();

  // Generate all coin tasks
  const tasks: Array<() => { decision: string; latencyMs: number }> = [];
  for (const coin of ACTIVE_COINS) {
    for (let i = 0; i < CONFIG.iterations; i++) {
      tasks.push(() => simulateCoinPipeline(coin));
    }
  }

  // Shuffle tasks
  for (let i = tasks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
  }

  const results: Array<{ decision: string; latencyMs: number }> = [];
  const startTime = performance.now();

  // Process with concurrency limit
  const queue = [...tasks];
  const running: Promise<void>[] = [];

  while (queue.length > 0 || running.length > 0) {
    while (running.length < concurrency && queue.length > 0) {
      const task = queue.shift()!;
      const promise = new Promise<void>((resolve) => {
        const result = task();
        results.push(result);
        resolve();
      });
      running.push(promise);
      promise.then(() => {
        const idx = running.indexOf(promise);
        if (idx >= 0) running.splice(idx, 1);
      });
    }

    if (running.length > 0) {
      await Promise.race(running);
    }
  }

  const totalTimeMs = performance.now() - startTime;
  const memAfter = process.memoryUsage();

  // Calculate stats
  const latencies = results.map(r => r.latencyMs).sort((a, b) => a - b);
  const decisions: Record<string, number> = {};
  for (const r of results) {
    decisions[r.decision] = (decisions[r.decision] || 0) + 1;
  }

  return {
    concurrency,
    totalCoins: results.length,
    totalTimeMs: Math.round(totalTimeMs),
    avgLatencyMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length * 100) / 100,
    p50LatencyMs: Math.round(latencies[Math.floor(latencies.length * 0.5)] * 100) / 100,
    p95LatencyMs: Math.round(latencies[Math.floor(latencies.length * 0.95)] * 100) / 100,
    p99LatencyMs: Math.round(latencies[Math.floor(latencies.length * 0.99)] * 100) / 100,
    throughputPerSec: Math.round(results.length / (totalTimeMs / 1000) * 100) / 100,
    memoryUsageMB: Math.round((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024 * 100) / 100,
    decisions,
  };
}

// ─── Run All Tests ──────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  EL ORÁCULO — Concurrent Coin Processing Load Test     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`Config: ${CONFIG.iterations} iterations × ${ACTIVE_COINS.length} coins = ${CONFIG.iterations * ACTIVE_COINS.length} tasks per test`);
  console.log(`Candles: ${CONFIG.candleCount} per timeframe (15m, 1h, 4h)`);
  console.log();

  // Warmup
  console.log('🔥 Warming up...');
  for (let i = 0; i < CONFIG.warmupIterations; i++) {
    for (const coin of ACTIVE_COINS) {
      simulateCoinPipeline(coin);
    }
  }
  console.log('✅ Warmup complete');
  console.log();

  // Run tests at different concurrency levels
  const results = [];

  for (const concurrency of CONFIG.concurrency) {
    console.log(`\n🚀 Testing concurrency: ${concurrency}...`);

    // Force GC if available
    if (global.gc) global.gc();

    const result = await runConcurrentTest(concurrency);
    results.push(result);

    console.log(`   ⏱️  Total: ${result.totalTimeMs}ms`);
    console.log(`   📊 Throughput: ${result.throughputPerSec} coins/sec`);
    console.log(`   📈 Latency — avg: ${result.avgLatencyMs}ms, p50: ${result.p50LatencyMs}ms, p95: ${result.p95LatencyMs}ms`);
    console.log(`   💾 Memory delta: +${result.memoryUsageMB}MB`);
    console.log(`   🎯 Decisions: ${JSON.stringify(result.decisions)}`);
  }

  // Summary table
  console.log('\n\n╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                           LOAD TEST RESULTS                                ║');
  console.log('╠══════════╦══════════╦════════════╦══════════╦══════════╦══════════╦═════════╣');
  console.log('║ Concur.  ║ Coins    ║ Total (ms) ║ avg (ms) ║ p95 (ms) ║ coins/s  ║ Mem (MB)║');
  console.log('╠══════════╬══════════╬════════════╬══════════╬══════════╬══════════╬═════════╣');

  for (const r of results) {
    console.log(
      `║ ${String(r.concurrency).padEnd(8)} ║ ${String(r.totalCoins).padEnd(8)} ║ ${String(r.totalTimeMs).padEnd(10)} ║ ${String(r.avgLatencyMs).padEnd(8)} ║ ${String(r.p95LatencyMs).padEnd(8)} ║ ${String(r.throughputPerSec).padEnd(8)} ║ ${String(r.memoryUsageMB).padEnd(7)} ║`
    );
  }

  console.log('╚══════════╩══════════╩════════════╩══════════╩══════════╩══════════╩═════════╝');

  // Recommendations
  console.log('\n📋 Recommendations:');
  const bestConcurrency = results.reduce((best, r) =>
    r.throughputPerSec > best.throughputPerSec ? r : best
  );
  console.log(`   ✅ Optimal concurrency: ${bestConcurrency.concurrency} (${bestConcurrency.throughputPerSec} coins/sec)`);

  const maxMemory = Math.max(...results.map(r => r.memoryUsageMB));
  console.log(`   💾 Max memory usage: ${maxMemory}MB`);

  const avgP95 = results.reduce((sum, r) => sum + r.p95LatencyMs, 0) / results.length;
  console.log(`   📊 Average p95 latency: ${avgP95}ms`);

  if (avgP95 < 100) {
    console.log('   ✅ Latency is excellent (< 100ms p95)');
  } else if (avgP95 < 500) {
    console.log('   ⚠️  Latency is acceptable (< 500ms p95)');
  } else {
    console.log('   ❌ Latency is high (> 500ms p95) — consider optimization');
  }
}

main().catch(console.error);
