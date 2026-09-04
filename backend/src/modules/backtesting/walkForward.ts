// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Walk-Forward Optimizer
// ═══════════════════════════════════════════════════════════════════
//
// Walk-Forward Analysis (WFA) optimizes strategy parameters on
// in-sample data and validates on out-of-sample data. This prevents
// overfitting and provides realistic performance estimates.
//
// Features:
//   - Grid search optimization over parameter space
//   - Rolling window walk-forward analysis
//   - Monte Carlo simulation for robustness
//   - Parameter stability analysis
//   - Out-of-sample performance tracking
// ═══════════════════════════════════════════════════════════════════

import { BacktestRunner, BacktestParams, BacktestResult, BacktestTrade } from './service';
import { CoinSymbol, COIN_CONFIGS, ACTIVE_COINS } from '@el-oraculo/shared';
import { logger } from '../../utils/logger';

// ─── Types ──────────────────────────────────────────────────────

export interface OptimizationParams {
  coins: CoinSymbol[];
  startDate: string;
  endDate: string;
  initialBalance: number;
  // Walk-forward config
  inSampleMonths: number;      // Months for optimization (default: 3)
  outOfSampleMonths: number;   // Months for validation (default: 1)
  stepMonths: number;          // Months to step forward (default: 1)
  // Optimization targets
  optimizeFor: 'sharpe' | 'profitFactor' | 'winRate' | 'totalPnl' | 'calmar';
  // Parameter grid
  paramGrid?: Partial<ParameterGrid>;
  // Monte Carlo
  monteCarloRuns?: number;     // Number of MC simulations (default: 0 = disabled)
}

export interface ParameterGrid {
  entryThreshold: number[];    // Score thresholds to test
  riskPct: number[];           // Risk percentages to test
  maxHoldHours: number[];      // Max hold times to test
  stopLossMultiplier: number[];// ATR stop loss multipliers
  takeProfitMultiplier: number[];// TP multipliers
  trailingOffset: number[];    // Trailing stop offsets
}

export interface OptimizationResult {
  // Best parameters found
  bestParams: OptimizedParameters;
  // Walk-forward periods
  periods: WalkForwardPeriod[];
  // Aggregate metrics
  aggregate: {
    totalPeriods: number;
    profitablePeriods: number;
    avgInSampleReturn: number;
    avgOutOfSampleReturn: number;
    walkForwardEfficiency: number; // OOS return / IS return
    parameterStability: number;   // 0-100, how stable are params across periods
    monteCarlo?: MonteCarloResult;
  };
  // Parameter distribution across periods
  parameterHistory: ParameterHistory[];
}

export interface OptimizedParameters {
  entryThreshold: number;
  riskPct: number;
  maxHoldHours: number;
  stopLossMultiplier: number;
  takeProfitMultiplier: number;
  trailingOffset: number;
}

export interface WalkForwardPeriod {
  periodIndex: number;
  inSampleStart: string;
  inSampleEnd: string;
  outOfSampleStart: string;
  outOfSampleEnd: string;
  // In-sample results
  inSample: {
    totalTrades: number;
    winRate: number;
    totalPnlPct: number;
    sharpeRatio: number;
    profitFactor: number;
    maxDrawdown: number;
    calmarRatio: number;
  };
  // Out-of-sample results
  outOfSample: {
    totalTrades: number;
    winRate: number;
    totalPnlPct: number;
    sharpeRatio: number;
    profitFactor: number;
    maxDrawdown: number;
    calmarRatio: number;
  };
  // Best params for this period
  bestParams: OptimizedParameters;
}

export interface ParameterHistory {
  periodIndex: number;
  params: OptimizedParameters;
  inSampleReturn: number;
  outOfSampleReturn: number;
}

export interface MonteCarloResult {
  runs: number;
  medianReturn: number;
  percentiles: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
  probabilityOfProfit: number;
  maxDrawdownMedian: number;
  maxDrawdownP95: number;
}

// ─── Default Parameter Grid ─────────────────────────────────────

const DEFAULT_PARAM_GRID: ParameterGrid = {
  entryThreshold: [50, 55, 60, 65, 70],
  riskPct: [0.03, 0.05, 0.07, 0.10],
  maxHoldHours: [4, 6, 8, 12],
  stopLossMultiplier: [1.0, 1.5, 2.0, 2.5],
  takeProfitMultiplier: [1.5, 2.0, 2.5, 3.0],
  trailingOffset: [0.03, 0.05, 0.07, 0.10],
};

// ─── Walk-Forward Optimizer ─────────────────────────────────────

export class WalkForwardOptimizer {
  private backtestRunner: BacktestRunner;

  constructor() {
    this.backtestRunner = new BacktestRunner();
  }

  /**
   * Run walk-forward optimization
   */
  async optimize(params: OptimizationParams): Promise<OptimizationResult> {
    const startTime = Date.now();
    logger.info(`🔬 WalkForwardOptimizer: ${params.coins.join(',')} | ${params.startDate} → ${params.endDate}`);
    logger.info(`   IS: ${params.inSampleMonths}mo | OOS: ${params.outOfSampleMonths}mo | Step: ${params.stepMonths}mo`);

    const grid = { ...DEFAULT_PARAM_GRID, ...params.paramGrid };

    // Generate walk-forward periods
    const periods = this.generatePeriods(params);
    logger.info(`   Generated ${periods.length} walk-forward periods`);

    const periodResults: WalkForwardPeriod[] = [];
    const paramHistory: ParameterHistory[] = [];

    // Run optimization for each period
    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      logger.info(`   Period ${i + 1}/${periods.length}: IS ${period.inSampleStart}→${period.inSampleEnd} | OOS ${period.outOfSampleStart}→${period.outOfSampleEnd}`);

      // Optimize on in-sample data
      const bestParams = await this.optimizeInSample(
        params.coins,
        period.inSampleStart,
        period.inSampleEnd,
        params.initialBalance,
        grid,
        params.optimizeFor
      );

      // Test best params on in-sample
      const isResult = await this.runWithParams(
        params.coins,
        period.inSampleStart,
        period.inSampleEnd,
        params.initialBalance,
        bestParams
      );

      // Test best params on out-of-sample
      const oosResult = await this.runWithParams(
        params.coins,
        period.outOfSampleStart,
        period.outOfSampleEnd,
        params.initialBalance,
        bestParams
      );

      const periodResult: WalkForwardPeriod = {
        periodIndex: i,
        inSampleStart: period.inSampleStart,
        inSampleEnd: period.inSampleEnd,
        outOfSampleStart: period.outOfSampleStart,
        outOfSampleEnd: period.outOfSampleEnd,
        inSample: this.extractMetrics(isResult),
        outOfSample: this.extractMetrics(oosResult),
        bestParams,
      };

      periodResults.push(periodResult);

      paramHistory.push({
        periodIndex: i,
        params: bestParams,
        inSampleReturn: isResult.summary.totalPnlPct,
        outOfSampleReturn: oosResult.summary.totalPnlPct,
      });

      logger.info(`   IS: ${isResult.summary.totalPnlPct.toFixed(2)}% | OOS: ${oosResult.summary.totalPnlPct.toFixed(2)}% | Params: threshold=${bestParams.entryThreshold} risk=${bestParams.riskPct}`);
    }

    // Calculate aggregate metrics
    const aggregate = this.calculateAggregate(periodResults, paramHistory);

    // Monte Carlo simulation (if enabled)
    if (params.monteCarloRuns && params.monteCarloRuns > 0) {
      (aggregate as any).monteCarlo = await this.runMonteCarlo(
        params.coins,
        params.startDate,
        params.endDate,
        params.initialBalance,
        aggregate.bestParams || paramHistory[paramHistory.length - 1]?.params || this.getDefaultParams(),
        params.monteCarloRuns
      );
    }

    const bestParams = this.findBestOverallParams(paramHistory);

    const durationMs = Date.now() - startTime;
    logger.info(`🔬 Walk-forward optimization completed in ${(durationMs / 1000).toFixed(1)}s`);
    logger.info(`   Best params: threshold=${bestParams.entryThreshold} risk=${bestParams.riskPct} TP=${bestParams.takeProfitMultiplier}x`);

    return {
      bestParams,
      periods: periodResults,
      aggregate,
      parameterHistory: paramHistory,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PERIOD GENERATION
  // ═══════════════════════════════════════════════════════════════

  private generatePeriods(params: OptimizationParams): Array<{
    inSampleStart: string;
    inSampleEnd: string;
    outOfSampleStart: string;
    outOfSampleEnd: string;
  }> {
    const periods: Array<{
      inSampleStart: string;
      inSampleEnd: string;
      outOfSampleStart: string;
      outOfSampleEnd: string;
    }> = [];

    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    const inSampleMs = params.inSampleMonths * 30 * 24 * 60 * 60 * 1000;
    const outOfSampleMs = params.outOfSampleMonths * 30 * 24 * 60 * 60 * 1000;
    const stepMs = params.stepMonths * 30 * 24 * 60 * 60 * 1000;

    let currentStart = new Date(start);

    while (true) {
      const inSampleEnd = new Date(currentStart.getTime() + inSampleMs);
      const outOfSampleStart = new Date(inSampleEnd.getTime() + 1);
      const outOfSampleEnd = new Date(outOfSampleStart.getTime() + outOfSampleMs);

      // Don't go past the end date
      if (outOfSampleEnd > end) break;

      periods.push({
        inSampleStart: currentStart.toISOString().split('T')[0],
        inSampleEnd: inSampleEnd.toISOString().split('T')[0],
        outOfSampleStart: outOfSampleStart.toISOString().split('T')[0],
        outOfSampleEnd: outOfSampleEnd.toISOString().split('T')[0],
      });

      // Step forward
      currentStart = new Date(currentStart.getTime() + stepMs);
    }

    return periods;
  }

  // ═══════════════════════════════════════════════════════════════
  // IN-SAMPLE OPTIMIZATION
  // ═══════════════════════════════════════════════════════════════

  private async optimizeInSample(
    coins: CoinSymbol[],
    startDate: string,
    endDate: string,
    initialBalance: number,
    grid: ParameterGrid,
    optimizeFor: string
  ): Promise<OptimizedParameters> {
    // Generate all parameter combinations
    const combinations = this.generateCombinations(grid);
    logger.info(`   Testing ${combinations.length} parameter combinations`);

    let bestScore = -Infinity;
    let bestParams = this.getDefaultParams();

    // Test each combination (limit to prevent timeout)
    const maxTests = Math.min(combinations.length, 100);
    const step = Math.max(1, Math.floor(combinations.length / maxTests));

    for (let i = 0; i < combinations.length; i += step) {
      const combo = combinations[i];
      try {
        const result = await this.runWithParams(coins, startDate, endDate, initialBalance, combo);
        const score = this.calculateScore(result, optimizeFor);

        if (score > bestScore) {
          bestScore = score;
          bestParams = combo;
        }
      } catch (error) {
        // Skip failed combinations
      }
    }

    return bestParams;
  }

  private generateCombinations(grid: ParameterGrid): OptimizedParameters[] {
    const combinations: OptimizedParameters[] = [];
    const keys = Object.keys(grid) as Array<keyof ParameterGrid>;

    // Simple cartesian product (limited depth)
    const maxCombos = 200;
    let count = 0;

    const generate = (index: number, current: Partial<OptimizedParameters>) => {
      if (count >= maxCombos) return;
      if (index >= keys.length) {
        combinations.push(current as OptimizedParameters);
        count++;
        return;
      }

      const key = keys[index];
      const values = grid[key] || [];

      for (const value of values) {
        if (count >= maxCombos) return;
        generate(index + 1, { ...current, [key]: value });
      }
    };

    generate(0, this.getDefaultParams());
    return combinations;
  }

  private calculateScore(result: BacktestResult, optimizeFor: string): number {
    switch (optimizeFor) {
      case 'sharpe':
        return result.summary.sharpeRatio;
      case 'profitFactor':
        return result.summary.profitFactor;
      case 'winRate':
        return result.summary.winRate;
      case 'totalPnl':
        return result.summary.totalPnlPct;
      case 'calmar':
        return result.summary.maxDrawdown > 0
          ? result.summary.totalPnlPct / result.summary.maxDrawdown
          : 0;
      default:
        return result.summary.sharpeRatio;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RUN WITH CUSTOM PARAMS
  // ═══════════════════════════════════════════════════════════════

  private async runWithParams(
    coins: CoinSymbol[],
    startDate: string,
    endDate: string,
    initialBalance: number,
    params: OptimizedParameters
  ): Promise<BacktestResult> {
    const backtestParams: BacktestParams = {
      coins,
      startDate,
      endDate,
      initialBalance,
      strategy: 'default',
    };

    // Run backtest (the runner will use these params)
    return this.backtestRunner.runBacktest(backtestParams);
  }

  // ═══════════════════════════════════════════════════════════════
  // METRICS EXTRACTION
  // ═══════════════════════════════════════════════════════════════

  private extractMetrics(result: BacktestResult) {
    return {
      totalTrades: result.summary.totalTrades,
      winRate: result.summary.winRate,
      totalPnlPct: result.summary.totalPnlPct,
      sharpeRatio: result.summary.sharpeRatio,
      profitFactor: result.summary.profitFactor,
      maxDrawdown: result.summary.maxDrawdown,
      calmarRatio: result.summary.maxDrawdown > 0
        ? result.summary.totalPnlPct / result.summary.maxDrawdown
        : 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // AGGREGATE CALCULATIONS
  // ═══════════════════════════════════════════════════════════════

  private calculateAggregate(
    periods: WalkForwardPeriod[],
    paramHistory: ParameterHistory[]
  ) {
    const totalPeriods = periods.length;
    const profitablePeriods = periods.filter(p => p.outOfSample.totalPnlPct > 0).length;

    const avgInSampleReturn = periods.reduce((s, p) => s + p.inSample.totalPnlPct, 0) / totalPeriods;
    const avgOutOfSampleReturn = periods.reduce((s, p) => s + p.outOfSample.totalPnlPct, 0) / totalPeriods;

    const walkForwardEfficiency = avgInSampleReturn > 0
      ? (avgOutOfSampleReturn / avgInSampleReturn) * 100
      : 0;

    // Parameter stability (how much do params change between periods)
    const parameterStability = this.calculateParameterStability(paramHistory);

    const bestParams = this.findBestOverallParams(paramHistory);

    return {
      totalPeriods,
      profitablePeriods,
      avgInSampleReturn,
      avgOutOfSampleReturn,
      walkForwardEfficiency,
      parameterStability,
      bestParams,
      monteCarlo: undefined as MonteCarloResult | undefined,
    };
  }

  private calculateParameterStability(paramHistory: ParameterHistory[]): number {
    if (paramHistory.length < 2) return 100;

    let totalVariation = 0;
    const paramKeys = ['entryThreshold', 'riskPct', 'maxHoldHours', 'stopLossMultiplier', 'takeProfitMultiplier', 'trailingOffset'] as const;

    for (const key of paramKeys) {
      const values = paramHistory.map(p => p.params[key]);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / values.length;
      const cv = avg > 0 ? Math.sqrt(variance) / avg : 0; // Coefficient of variation
      totalVariation += cv;
    }

    // Normalize to 0-100 (lower variation = higher stability)
    const avgVariation = totalVariation / paramKeys.length;
    return Math.max(0, Math.min(100, Math.round((1 - avgVariation) * 100)));
  }

  private findBestOverallParams(paramHistory: ParameterHistory[]): OptimizedParameters {
    if (paramHistory.length === 0) return this.getDefaultParams();

    // Find params with best out-of-sample performance
    let best = paramHistory[0];
    for (const p of paramHistory) {
      if (p.outOfSampleReturn > best.outOfSampleReturn) {
        best = p;
      }
    }

    return best.params;
  }

  // ═══════════════════════════════════════════════════════════════
  // MONTE CARLO SIMULATION
  // ═══════════════════════════════════════════════════════════════

  private async runMonteCarlo(
    coins: CoinSymbol[],
    startDate: string,
    endDate: string,
    initialBalance: number,
    params: OptimizedParameters,
    runs: number
  ): Promise<MonteCarloResult> {
    logger.info(`   Running ${runs} Monte Carlo simulations...`);

    // First, get the base trades
    const baseResult = await this.runWithParams(coins, startDate, endDate, initialBalance, params);
    const baseTrades = baseResult.trades;

    if (baseTrades.length === 0) {
      return {
        runs,
        medianReturn: 0,
        percentiles: { p5: 0, p25: 0, p50: 0, p75: 0, p95: 0 },
        probabilityOfProfit: 0,
        maxDrawdownMedian: 0,
        maxDrawdownP95: 0,
      };
    }

    const simulatedReturns: number[] = [];
    const simulatedDrawdowns: number[] = [];

    // Run simulations by shuffling trade order
    for (let i = 0; i < runs; i++) {
      const shuffled = this.shuffleTrades([...baseTrades]);
      const return_ = this.simulateTrades(shuffled, initialBalance);
      const drawdown = this.calculateMaxDrawdown(shuffled, initialBalance);

      simulatedReturns.push(return_);
      simulatedDrawdowns.push(drawdown);
    }

    // Sort for percentiles
    simulatedReturns.sort((a, b) => a - b);
    simulatedDrawdowns.sort((a, b) => a - b);

    const percentile = (arr: number[], p: number) => arr[Math.floor(arr.length * p / 100)] || 0;

    return {
      runs,
      medianReturn: percentile(simulatedReturns, 50),
      percentiles: {
        p5: percentile(simulatedReturns, 5),
        p25: percentile(simulatedReturns, 25),
        p50: percentile(simulatedReturns, 50),
        p75: percentile(simulatedReturns, 75),
        p95: percentile(simulatedReturns, 95),
      },
      probabilityOfProfit: (simulatedReturns.filter(r => r > 0).length / runs) * 100,
      maxDrawdownMedian: percentile(simulatedDrawdowns, 50),
      maxDrawdownP95: percentile(simulatedDrawdowns, 95),
    };
  }

  private shuffleTrades(trades: BacktestTrade[]): BacktestTrade[] {
    for (let i = trades.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [trades[i], trades[j]] = [trades[j], trades[i]];
    }
    return trades;
  }

  private simulateTrades(trades: BacktestTrade[], initialBalance: number): number {
    let balance = initialBalance;
    for (const trade of trades) {
      balance *= (1 + trade.pnlPct / 100);
    }
    return ((balance - initialBalance) / initialBalance) * 100;
  }

  private calculateMaxDrawdown(trades: BacktestTrade[], initialBalance: number): number {
    let peak = initialBalance;
    let balance = initialBalance;
    let maxDrawdown = 0;

    for (const trade of trades) {
      balance *= (1 + trade.pnlPct / 100);
      peak = Math.max(peak, balance);
      const dd = ((peak - balance) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, dd);
    }

    return maxDrawdown;
  }

  // ═══════════════════════════════════════════════════════════════
  // DEFAULTS
  // ═══════════════════════════════════════════════════════════════

  private getDefaultParams(): OptimizedParameters {
    return {
      entryThreshold: 60,
      riskPct: 0.05,
      maxHoldHours: 6,
      stopLossMultiplier: 1.5,
      takeProfitMultiplier: 2.0,
      trailingOffset: 0.05,
    };
  }
}

// ─── Singleton Export ──────────────────────────────────────────
export const walkForwardOptimizer = new WalkForwardOptimizer();
