// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Portfolio Risk Service
// ═══════════════════════════════════════════════════════════════════
//
// Portfolio-level risk management:
//   - Total exposure limits (max % of balance in positions)
//   - Correlation analysis between coins
//   - Position sizing based on portfolio heat
//   - Sector/asset class exposure limits
//   - Drawdown circuit breaker
//   - Risk-adjusted position sizing
// ═══════════════════════════════════════════════════════════════════

import { BotStateRepository } from '../../database/repositories';
import {
  CoinSymbol, ACTIVE_COINS, COIN_CONFIGS,
  BalanceData, FullIndicatorData, MarketRegimeData,
} from '@el-oraculo/shared';
import { logger } from '../../utils/logger';

// ─── Types ──────────────────────────────────────────────────────

export interface PortfolioRiskConfig {
  // Exposure limits
  maxTotalExposurePct: number;      // Max % of balance in all positions (default: 80%)
  maxSinglePositionPct: number;     // Max % of balance in one position (default: 20%)
  maxCorrelatedPositions: number;   // Max positions in highly correlated coins (default: 3)
  correlationThreshold: number;     // Correlation threshold for "highly correlated" (default: 0.7)

  // Drawdown limits
  maxDrawdownPct: number;           // Max portfolio drawdown before circuit breaker (default: 15%)
  drawdownCooldownMinutes: number;  // Minutes to wait after drawdown trigger (default: 60)

  // Sector limits
  maxSectorExposurePct: number;     // Max % in same sector (default: 40%)
  sectors: Record<CoinSymbol, string>; // Coin → sector mapping

  // Risk scoring
  portfolioHeatThreshold: number;   // Max portfolio heat score (0-100, default: 70)
  reduceHeatThreshold: number;      // Start reducing positions above this (default: 80)
}

export interface PortfolioRiskState {
  totalExposurePct: number;
  positionsCount: number;
  portfolioHeat: number;
  correlatedPairs: Array<{ coin1: CoinSymbol; coin2: CoinSymbol; correlation: number }>;
  sectorExposure: Record<string, number>;
  drawdown: number;
  circuitBreakerActive: boolean;
  circuitBreakerUntil?: string;
}

export interface PositionSizeResult {
  allowed: boolean;
  requestedMonto: number;
  adjustedMonto: number;
  reason: string;
  riskScore: number; // 0-100, higher = riskier
}

export interface CorrelationMatrix {
  coins: CoinSymbol[];
  matrix: number[][]; // [i][j] = correlation between coin i and j
  timestamp: string;
}

// ─── Default Config ─────────────────────────────────────────────

const DEFAULT_CONFIG: PortfolioRiskConfig = {
  maxTotalExposurePct: 80,
  maxSinglePositionPct: 20,
  maxCorrelatedPositions: 3,
  correlationThreshold: 0.7,
  maxDrawdownPct: 15,
  drawdownCooldownMinutes: 60,
  maxSectorExposurePct: 40,
  sectors: {
    BTC: 'store_of_value',
    ETH: 'smart_contracts',
    SOL: 'smart_contracts',
    BNB: 'exchange',
    AVAX: 'smart_contracts',
    POL: 'smart_contracts',
    SUI: 'smart_contracts',
    LINK: 'oracle',
    NEAR: 'smart_contracts',
    DOGE: 'meme',
    XRP: 'payment',
    ARB: 'layer2',
    ADA: 'smart_contracts',
    ESP: 'meme',
  } as Record<CoinSymbol, string>,
  portfolioHeatThreshold: 70,
  reduceHeatThreshold: 80,
};

// ─── Portfolio Risk Service ─────────────────────────────────────

export class PortfolioRiskService {
  private config: PortfolioRiskConfig;
  private correlationMatrix: CorrelationMatrix | null = null;
  private priceHistory: Map<CoinSymbol, number[]> = new Map();
  private peakBalance: number = 0;
  private circuitBreakerUntil: number = 0;

  constructor(config: Partial<PortfolioRiskConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN RISK CHECK (called before each trade)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Check if a new position is allowed based on portfolio risk
   */
  checkNewPosition(
    coin: CoinSymbol,
    requestedMonto: number,
    balance: BalanceData,
    indicators: FullIndicatorData
  ): PositionSizeResult {
    const totalBalance = balance.usdt_total;
    const freeBalance = balance.usdt_free;

    // Update peak balance for drawdown calculation
    this.peakBalance = Math.max(this.peakBalance, totalBalance);

    // Check circuit breaker
    if (this.isCircuitBreakerActive()) {
      return {
        allowed: false,
        requestedMonto,
        adjustedMonto: 0,
        reason: `🛑 CIRCUIT BREAKER: Drawdown exceeded ${this.config.maxDrawdownPct}%. Wait ${this.getCooldownRemaining()}min.`,
        riskScore: 100,
      };
    }

    // Get current portfolio state
    const state = this.getPortfolioState(totalBalance);

    // Calculate risk score
    let riskScore = 0;
    const reasons: string[] = [];

    // 1. Total exposure check
    const currentExposure = this.calculateTotalExposure(totalBalance);
    const newExposurePct = ((currentExposure + requestedMonto) / totalBalance) * 100;

    if (newExposurePct > this.config.maxTotalExposurePct) {
      const maxAdditional = (this.config.maxTotalExposurePct / 100 * totalBalance) - currentExposure;
      if (maxAdditional <= 0) {
        const currentExposurePctCalc = (currentExposure / totalBalance) * 100;
        return {
          allowed: false,
          requestedMonto,
          adjustedMonto: 0,
          reason: `🚫 MAX EXPOSURE: ${currentExposurePctCalc.toFixed(1)}% already invested (max ${this.config.maxTotalExposurePct}%)`,
          riskScore: 100,
        };
      }

      // Reduce monto to fit within limit
      requestedMonto = Math.min(requestedMonto, maxAdditional);
      riskScore += 20;
      reasons.push(`exposure ${(newExposurePct).toFixed(1)}%`);
    }

    // 2. Single position check
    const singlePositionPct = (requestedMonto / totalBalance) * 100;
    if (singlePositionPct > this.config.maxSinglePositionPct) {
      requestedMonto = this.config.maxSinglePositionPct / 100 * totalBalance;
      riskScore += 15;
      reasons.push(`single pos ${singlePositionPct.toFixed(1)}%`);
    }

    // 3. Correlation check
    const correlationRisk = this.checkCorrelationRisk(coin);
    if (correlationRisk.blocked) {
      return {
        allowed: false,
        requestedMonto,
        adjustedMonto: 0,
        reason: `🔗 CORRELATION: ${correlationRisk.reason}`,
        riskScore: 100,
      };
    }
    if (correlationRisk.warning) {
      riskScore += 10;
      reasons.push(correlationRisk.reason);
    }

    // 4. Sector exposure check
    const sectorRisk = this.checkSectorExposure(coin, requestedMonto, totalBalance);
    if (sectorRisk.blocked) {
      return {
        allowed: false,
        requestedMonto,
        adjustedMonto: 0,
        reason: `🏢 SECTOR: ${sectorRisk.reason}`,
        riskScore: 100,
      };
    }
    if (sectorRisk.warning) {
      riskScore += 10;
      reasons.push(sectorRisk.reason);
    }

    // 5. Portfolio heat check
    const heat = this.calculatePortfolioHeat(state, indicators);
    if (heat > this.config.reduceHeatThreshold) {
      // Reduce position size based on heat
      const heatMultiplier = Math.max(0.3, 1 - (heat - this.config.reduceHeatThreshold) / 50);
      requestedMonto *= heatMultiplier;
      riskScore += 20;
      reasons.push(`heat ${heat.toFixed(0)}/100`);
    } else if (heat > this.config.portfolioHeatThreshold) {
      riskScore += 10;
      reasons.push(`heat ${heat.toFixed(0)}/100`);
    }

    // 6. Drawdown check
    const drawdown = this.calculateDrawdown(totalBalance);
    if (drawdown > this.config.maxDrawdownPct * 0.7) {
      // Approaching drawdown limit — reduce size
      const ddMultiplier = Math.max(0.5, 1 - (drawdown / this.config.maxDrawdownPct));
      requestedMonto *= ddMultiplier;
      riskScore += 15;
      reasons.push(`drawdown ${drawdown.toFixed(1)}%`);
    }

    // 7. Balance sufficiency
    if (requestedMonto > freeBalance) {
      requestedMonto = freeBalance * 0.95; // Leave 5% buffer
      riskScore += 5;
      reasons.push('balance limit');
    }

    // Ensure minimum trade size
    const minMonto = COIN_CONFIGS[coin]?.entry_min || 10;
    if (requestedMonto < minMonto) {
      return {
        allowed: false,
        requestedMonto,
        adjustedMonto: 0,
        reason: `💰 TOO SMALL: $${requestedMonto.toFixed(2)} < min $${minMonto}`,
        riskScore,
      };
    }

    const reason = reasons.length > 0
      ? `⚡ RISK ADJUSTED: $${requestedMonto.toFixed(2)} (${reasons.join(', ')})`
      : `✅ CLEAR: $${requestedMonto.toFixed(2)}`;

    return {
      allowed: true,
      requestedMonto,
      adjustedMonto: requestedMonto,
      reason,
      riskScore: Math.min(100, riskScore),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PORTFOLIO STATE
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get current portfolio risk state
   */
  getPortfolioState(totalBalance: number): PortfolioRiskState {
    const botStates = BotStateRepository.getAll();
    const activePositions = botStates.filter(b => b.status === 'COMPRADO');

    const totalExposure = activePositions.reduce((sum, p) => sum + (p.montoEntrada || 0), 0);
    const totalExposurePct = totalBalance > 0 ? (totalExposure / totalBalance) * 100 : 0;

    // Sector exposure
    const sectorExposure: Record<string, number> = {};
    for (const pos of activePositions) {
      const sector = this.config.sectors[pos.coin as CoinSymbol] || 'unknown';
      sectorExposure[sector] = (sectorExposure[sector] || 0) + (pos.montoEntrada || 0);
    }
    // Convert to percentages
    for (const sector of Object.keys(sectorExposure)) {
      sectorExposure[sector] = totalBalance > 0
        ? (sectorExposure[sector] / totalBalance) * 100
        : 0;
    }

    // Correlated pairs
    const correlatedPairs = this.findCorrelatedPairs(activePositions.map(p => p.coin as CoinSymbol));

    // Drawdown
    const drawdown = this.calculateDrawdown(totalBalance);

    // Portfolio heat
    const heat = this.calculatePortfolioHeatFromState(activePositions, totalBalance);

    return {
      totalExposurePct,
      positionsCount: activePositions.length,
      portfolioHeat: heat,
      correlatedPairs,
      sectorExposure,
      drawdown,
      circuitBreakerActive: this.isCircuitBreakerActive(),
      circuitBreakerUntil: this.circuitBreakerUntil > 0
        ? new Date(this.circuitBreakerUntil).toISOString()
        : undefined,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // CORRELATION ANALYSIS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Update price history for correlation calculation
   */
  updatePriceHistory(coin: CoinSymbol, price: number): void {
    if (!this.priceHistory.has(coin)) {
      this.priceHistory.set(coin, []);
    }
    const history = this.priceHistory.get(coin)!;
    history.push(price);

    // Keep last 100 prices (about 8 hours at 5min intervals)
    if (history.length > 100) {
      history.shift();
    }

    // Recalculate correlation matrix periodically
    if (history.length % 20 === 0 && history.length >= 40) {
      this.recalculateCorrelationMatrix();
    }
  }

  /**
   * Calculate correlation matrix between all coins
   */
  recalculateCorrelationMatrix(): void {
    const coins = ACTIVE_COINS.filter(c => this.priceHistory.has(c) && this.priceHistory.get(c)!.length >= 20);

    if (coins.length < 2) return;

    const matrix: number[][] = [];

    for (let i = 0; i < coins.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < coins.length; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else if (j < i) {
          matrix[i][j] = matrix[j][i]; // Symmetric
        } else {
          matrix[i][j] = this.calculateCorrelation(
            this.priceHistory.get(coins[i])!,
            this.priceHistory.get(coins[j])!
          );
        }
      }
    }

    this.correlationMatrix = {
      coins,
      matrix,
      timestamp: new Date().toISOString(),
    };

    logger.debug(`📊 Correlation matrix updated for ${coins.length} coins`);
  }

  /**
   * Calculate Pearson correlation between two price series
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 10) return 0;

    // Use returns instead of prices for better correlation
    const returnsX: number[] = [];
    const returnsY: number[] = [];
    for (let i = 1; i < n; i++) {
      if (x[i - 1] > 0 && y[i - 1] > 0) {
        returnsX.push((x[i] - x[i - 1]) / x[i - 1]);
        returnsY.push((y[i] - y[i - 1]) / y[i - 1]);
      }
    }

    if (returnsX.length < 10) return 0;

    const m = returnsX.length;
    const meanX = returnsX.reduce((a, b) => a + b, 0) / m;
    const meanY = returnsY.reduce((a, b) => a + b, 0) / m;

    let sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < m; i++) {
      const dx = returnsX[i] - meanX;
      const dy = returnsY[i] - meanY;
      sumXY += dx * dy;
      sumX2 += dx * dx;
      sumY2 += dy * dy;
    }

    const denom = Math.sqrt(sumX2 * sumY2);
    return denom > 0 ? sumXY / denom : 0;
  }

  /**
   * Get correlation between two specific coins
   */
  getCorrelation(coin1: CoinSymbol, coin2: CoinSymbol): number {
    if (!this.correlationMatrix) return 0;

    const i = this.correlationMatrix.coins.indexOf(coin1);
    const j = this.correlationMatrix.coins.indexOf(coin2);

    if (i === -1 || j === -1) return 0;
    return this.correlationMatrix.matrix[i][j];
  }

  /**
   * Find all highly correlated pairs in active positions
   */
  private findCorrelatedPairs(positions: CoinSymbol[]): Array<{
    coin1: CoinSymbol;
    coin2: CoinSymbol;
    correlation: number;
  }> {
    const pairs: Array<{ coin1: CoinSymbol; coin2: CoinSymbol; correlation: number }> = [];

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const corr = this.getCorrelation(positions[i], positions[j]);
        if (Math.abs(corr) >= this.config.correlationThreshold) {
          pairs.push({
            coin1: positions[i],
            coin2: positions[j],
            correlation: corr,
          });
        }
      }
    }

    return pairs;
  }

  // ═══════════════════════════════════════════════════════════════
  // RISK CHECKS
  // ═══════════════════════════════════════════════════════════════

  private calculateTotalExposure(totalBalance: number): number {
    const botStates = BotStateRepository.getAll();
    return botStates
      .filter(b => b.status === 'COMPRADO')
      .reduce((sum, b) => sum + (b.montoEntrada || 0), 0);
  }

  private checkCorrelationRisk(coin: CoinSymbol): {
    blocked: boolean;
    warning: boolean;
    reason: string;
  } {
    if (!this.correlationMatrix) {
      return { blocked: false, warning: false, reason: '' };
    }

    const activePositions = BotStateRepository.getAll()
      .filter(b => b.status === 'COMPRADO')
      .map(b => b.coin as CoinSymbol);

    // Count positions highly correlated with this coin
    let highlyCorrelatedCount = 0;
    let maxCorrelation = 0;

    for (const pos of activePositions) {
      if (pos === coin) continue;
      const corr = this.getCorrelation(coin, pos);
      if (Math.abs(corr) >= this.config.correlationThreshold) {
        highlyCorrelatedCount++;
        maxCorrelation = Math.max(maxCorrelation, corr);
      }
    }

    if (highlyCorrelatedCount >= this.config.maxCorrelatedPositions) {
      return {
        blocked: true,
        warning: false,
        reason: `${highlyCorrelatedCount} positions already correlated with ${coin} (max ${this.config.maxCorrelatedPositions})`,
      };
    }

    if (highlyCorrelatedCount > 0) {
      return {
        blocked: false,
        warning: true,
        reason: `${highlyCorrelatedCount} correlated positions (max corr: ${maxCorrelation.toFixed(2)})`,
      };
    }

    return { blocked: false, warning: false, reason: '' };
  }

  private checkSectorExposure(
    coin: CoinSymbol,
    newMonto: number,
    totalBalance: number
  ): { blocked: boolean; warning: boolean; reason: string } {
    const sector = this.config.sectors[coin] || 'unknown';

    const currentSectorExposure = BotStateRepository.getAll()
      .filter(b => b.status === 'COMPRADO' && this.config.sectors[b.coin as CoinSymbol] === sector)
      .reduce((sum, b) => sum + (b.montoEntrada || 0), 0);

    const newSectorPct = ((currentSectorExposure + newMonto) / totalBalance) * 100;

    if (newSectorPct > this.config.maxSectorExposurePct) {
      return {
        blocked: true,
        warning: false,
        reason: `${sector} sector would be ${newSectorPct.toFixed(1)}% (max ${this.config.maxSectorExposurePct}%)`,
      };
    }

    if (newSectorPct > this.config.maxSectorExposurePct * 0.8) {
      return {
        blocked: false,
        warning: true,
        reason: `${sector} sector at ${newSectorPct.toFixed(1)}%`,
      };
    }

    return { blocked: false, warning: false, reason: '' };
  }

  private calculatePortfolioHeat(
    state: PortfolioRiskState,
    indicators: FullIndicatorData
  ): number {
    let heat = 0;

    // Factor 1: Exposure (0-30 points)
    heat += Math.min(30, state.totalExposurePct * 0.375);

    // Factor 2: Number of positions (0-20 points)
    heat += Math.min(20, state.positionsCount * 4);

    // Factor 3: Correlation (0-20 points)
    heat += Math.min(20, state.correlatedPairs.length * 7);

    // Factor 4: Market regime (0-15 points)
    if (indicators.adx > 30) heat += 10; // Strong trend = more risk
    if (indicators.atr_pct > 2) heat += 5; // High volatility = more risk

    // Factor 5: Drawdown (0-15 points)
    heat += Math.min(15, state.drawdown * 1);

    return Math.min(100, heat);
  }

  private calculatePortfolioHeatFromState(
    positions: any[],
    totalBalance: number
  ): number {
    let heat = 0;

    const totalExposure = positions.reduce((sum, p) => sum + (p.montoEntrada || 0), 0);
    const exposurePct = totalBalance > 0 ? (totalExposure / totalBalance) * 100 : 0;

    heat += Math.min(30, exposurePct * 0.375);
    heat += Math.min(20, positions.length * 4);

    const correlatedPairs = this.findCorrelatedPairs(positions.map(p => p.coin));
    heat += Math.min(20, correlatedPairs.length * 7);

    const drawdown = this.calculateDrawdown(totalBalance);
    heat += Math.min(15, drawdown * 1);

    return Math.min(100, heat);
  }

  private calculateDrawdown(currentBalance: number): number {
    if (this.peakBalance <= 0) return 0;
    return Math.max(0, ((this.peakBalance - currentBalance) / this.peakBalance) * 100);
  }

  // ═══════════════════════════════════════════════════════════════
  // CIRCUIT BREAKER
  // ═══════════════════════════════════════════════════════════════

  /**
   * Check if drawdown circuit breaker should trigger
   */
  checkDrawdownCircuitBreaker(currentBalance: number): boolean {
    const drawdown = this.calculateDrawdown(currentBalance);

    if (drawdown >= this.config.maxDrawdownPct) {
      this.circuitBreakerUntil = Date.now() + this.config.drawdownCooldownMinutes * 60 * 1000;
      logger.warn(`🛑 CIRCUIT BREAKER TRIGGERED: Drawdown ${drawdown.toFixed(1)}% > ${this.config.maxDrawdownPct}%`);
      return true;
    }

    return false;
  }

  private isCircuitBreakerActive(): boolean {
    return Date.now() < this.circuitBreakerUntil;
  }

  private getCooldownRemaining(): number {
    if (!this.isCircuitBreakerActive()) return 0;
    return Math.ceil((this.circuitBreakerUntil - Date.now()) / 60000);
  }

  // ═══════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Update risk configuration
   */
  updateConfig(updates: Partial<PortfolioRiskConfig>): void {
    this.config = { ...this.config, ...updates };
    logger.info('⚙️ Portfolio risk config updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): PortfolioRiskConfig {
    return { ...this.config };
  }

  /**
   * Get correlation matrix
   */
  getCorrelationMatrix(): CorrelationMatrix | null {
    return this.correlationMatrix;
  }

  /**
   * Reset peak balance (for testing)
   */
  resetPeakBalance(balance: number): void {
    this.peakBalance = balance;
  }

  /**
   * Reset circuit breaker (for testing or manual override)
   */
  resetCircuitBreaker(): void {
    this.circuitBreakerUntil = 0;
    logger.info('🔄 Circuit breaker reset');
  }
}

// ─── Singleton Export ──────────────────────────────────────────
export const portfolioRiskService = new PortfolioRiskService();
