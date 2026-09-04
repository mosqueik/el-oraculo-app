// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Memory Stress Test
// ═══════════════════════════════════════════════════════════════════
//
// Simulates long-running trading cycles to detect memory leaks.
// Runs 100 cycles and monitors heap usage growth.
//
// Usage: npx tsx tests/load/memory-stress.ts
// ═══════════════════════════════════════════════════════════════════

import { RSI, ADX, BollingerBands, ATR, EMA, MACD } from 'technicalindicators';
import { ACTIVE_COINS, COIN_CONFIGS, FullIndicatorData } from '@el-oraculo/shared';

// ─── Configuration ──────────────────────────────────────────────

const CONFIG = {
  cycles: 100,
  coinsPerCycle: ACTIVE_COINS.length,
  candleCount: 200,
  checkInterval: 10,         // Log memory every 10 cycles
  gcInterval: 25,            // Force GC every 25 cycles
};

// ─── Synthetic Data Generator ───────────────────────────────────

function generateCandles(count: number, basePrice: number) {
  const candles = [];
  let price = basePrice;

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.48) * 0.02;
    const open = price;
    price = price * (1 + change);
    const close = price;
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = 1000 + Math.random() * 5000;

    candles.push({ timestamp: Date.now() - (count - i) * 900000, open, high, low, close, volume });
  }
  return candles;
}

// ─── Indicator Calculation ──────────────────────────────────────

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

// ─── Single Cycle Simulation ────────────────────────────────────

function simulateCycle(cycleNumber: number): {
  coinsProcessed: number;
  decisions: Record<string, number>;
} {
  const decisions: Record<string, number> = {};

  for (const coin of ACTIVE_COINS) {
    const config = COIN_CONFIGS[coin as keyof typeof COIN_CONFIGS];
    const basePrice = config?.pair.includes('BTC') ? 65000
      : config?.pair.includes('ETH') ? 3500
      : config?.pair.includes('SOL') ? 150
      : 100;

    // Generate data
    const candles15m = generateCandles(CONFIG.candleCount, basePrice);
    const candles1h = generateCandles(CONFIG.candleCount, basePrice);
    const candles4h = generateCandles(CONFIG.candleCount, basePrice);

    // Calculate indicators
    const indicators = calculateIndicators(candles15m);
    const tf1h = calculateIndicators(candles1h);
    const tf4h = calculateIndicators(candles4h);

    // Scoring (simplified)
    let score = 0;
    if (indicators.rsi < 35) score += 1;
    if (indicators.adx > 25 && indicators.plusDI > indicators.minusDI) score += 1;
    if (indicators.ema20 > indicators.ema50 && indicators.histogram > 0) score += 2;
    if (indicators.momentum === 'BULL') score += 2;

    // Decision
    const threshold = config?.entry_min || 2;
    const decision = score >= threshold ? 'COMPRAR' : 'ESPERAR';
    decisions[decision] = (decisions[decision] || 0) + 1;
  }

  return { coinsProcessed: ACTIVE_COINS.length, decisions };
}

// ─── Memory Tracking ────────────────────────────────────────────

interface MemorySnapshot {
  cycle: number;
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  externalMB: number;
}

function getMemorySnapshot(cycle: number): MemorySnapshot {
  const mem = process.memoryUsage();
  return {
    cycle,
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
    rssMB: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
    externalMB: Math.round(mem.external / 1024 / 1024 * 100) / 100,
  };
}

// ─── Run Stress Test ────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  EL ORÁCULO — Memory Stress Test                        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`Config: ${CONFIG.cycles} cycles × ${ACTIVE_COINS.length} coins = ${CONFIG.cycles * ACTIVE_COINS.length} pipeline runs`);
  console.log();

  const snapshots: MemorySnapshot[] = [];
  const startTime = performance.now();

  // Initial snapshot
  snapshots.push(getMemorySnapshot(0));
  console.log(`[Cycle 0] 📊 Heap: ${snapshots[0].heapUsedMB}MB | RSS: ${snapshots[0].rssMB}MB`);

  for (let cycle = 1; cycle <= CONFIG.cycles; cycle++) {
    // Force GC at intervals
    if (cycle % CONFIG.gcInterval === 0 && global.gc) {
      global.gc();
    }

    // Run cycle
    simulateCycle(cycle);

    // Log memory at intervals
    if (cycle % CONFIG.checkInterval === 0 || cycle === CONFIG.cycles) {
      const snapshot = getMemorySnapshot(cycle);
      snapshots.push(snapshot);

      const delta = snapshot.heapUsedMB - snapshots[0].heapUsedMB;
      const sign = delta >= 0 ? '+' : '';
      console.log(`[Cycle ${String(cycle).padEnd(3)}] 📊 Heap: ${snapshot.heapUsedMB}MB (${sign}${delta}MB) | RSS: ${snapshot.rssMB}MB`);
    }
  }

  const totalTimeMs = performance.now() - startTime;

  // Analysis
  console.log('\n\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                    MEMORY ANALYSIS                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const heapGrowth = last.heapUsedMB - first.heapUsedMB;
  const heapGrowthPerCycle = heapGrowth / CONFIG.cycles;
  const rssGrowth = last.rssMB - first.rssMB;

  console.log(`\n📊 Memory Growth:`);
  console.log(`   Heap: ${first.heapUsedMB}MB → ${last.heapUsedMB}MB (${heapGrowth >= 0 ? '+' : ''}${heapGrowth.toFixed(2)}MB)`);
  console.log(`   RSS:  ${first.rssMB}MB → ${last.rssMB}MB (${rssGrowth >= 0 ? '+' : ''}${rssGrowth.toFixed(2)}MB)`);
  console.log(`   Per cycle: ${heapGrowthPerCycle.toFixed(4)}MB/cycle`);

  console.log(`\n⏱️  Performance:`);
  console.log(`   Total time: ${(totalTimeMs / 1000).toFixed(2)}s`);
  console.log(`   Cycles/sec: ${(CONFIG.cycles / (totalTimeMs / 1000)).toFixed(2)}`);
  console.log(`   Coins/sec: ${((CONFIG.cycles * ACTIVE_COINS.length) / (totalTimeMs / 1000)).toFixed(2)}`);

  // Memory leak detection
  console.log(`\n🔍 Leak Detection:`);

  // Check for consistent growth
  let growthCount = 0;
  for (let i = 1; i < snapshots.length; i++) {
    if (snapshots[i].heapUsedMB > snapshots[i - 1].heapUsedMB) {
      growthCount++;
    }
  }

  const growthRatio = growthCount / (snapshots.length - 1);
  console.log(`   Growth frequency: ${(growthRatio * 100).toFixed(1)}% of intervals`);

  if (heapGrowth < 1) {
    console.log('   ✅ Memory is stable (< 1MB growth over 100 cycles)');
  } else if (heapGrowth < 5) {
    console.log('   ⚠️  Minor memory growth detected (1-5MB) — monitor in production');
  } else {
    console.log('   ❌ Significant memory growth detected (> 5MB) — possible leak');
  }

  if (growthRatio > 0.8) {
    console.log('   ⚠️  Memory grows in > 80% of intervals — likely leak');
  } else {
    console.log('   ✅ Memory growth is intermittent — likely normal GC behavior');
  }

  console.log('\n✅ Stress test complete');
}

main().catch(console.error);
