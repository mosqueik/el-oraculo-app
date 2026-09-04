// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Shared Trading Types
// ═══════════════════════════════════════════════════════════════════

export type CoinSymbol = 'BTC' | 'ETH' | 'SOL' | 'BNB' | 'AVAX' | 'POL' | 'SUI' | 'LINK' | 'NEAR' | 'DOGE' | 'XRP' | 'ARB' | 'ADA' | 'ESP';

export type TradeAction = 'COMPRAR' | 'VENDER' | 'ESPERAR';

export type CoinStatus = 'LÍQUIDO' | 'COMPRADO';

export type MarketDirection = 'BULLISH' | 'BEARISH' | 'UNKNOWN';

export type FVGType = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export type MarketRegime = 'TRENDING' | 'RANGING' | 'VOLATILE' | 'NEUTRAL';

export type TechRegime = 'TRENDING' | 'RANGING' | 'VOLATILE' | 'NEUTRAL';

export interface CoinConfig {
  symbol: CoinSymbol;
  pair: string;
  risk_pct: number;
  entry_min: number;
  entry_max: number;
  stop_loss: number;
  hard_stop: number;
  tp_base: number;
  tp_nocturno: number;
  tp_hard_limit: number;
  time_exit_max_hours: number;
  sell_rsi_floor: number;
  sell_time_exit_adjustment: number;
  precision_qty: number;
  precision_price: number;
  adx_exit: number;
  adx_btc_danger: number;
  rsi_oversold: number;
  rsi_overbought: number;
}

export interface IndicatorData {
  rsi: number;
  adx: number;
  adx_btc: number;
  histogram: number;
  bb_lower: number;
  bb_upper: number;
  plusDI: number;
  minusDI: number;
  atr_pct: number;
  volume: number;
}

export interface FullIndicatorData extends IndicatorData {
  // L2 Indicators
  macd: { macd: number; signal: number; histogram: number } | null;
  stochRsi: { k: number; d: number } | null;
  obv: number;
  vwap: number;
  ema20: number;
  ema50: number;
  ema200: number;

  // L3 Indicators
  fvg: FVGType;
  choch: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  squeeze: boolean;
  squeezeMomentum: number;
  momentum: 'BULL' | 'BEAR' | 'NEUTRAL';

  // Extra
  volumeChange: number;
  bbWidth: number;
  atr: number;
  currentPrice: number;
}

export interface MarketRegimeData {
  regime: MarketRegime;
  techRegime: TechRegime;
  divergence: number;
  lsRatio: number;
  longPct: number;
  sentiment: string;
  atrPct: number;
  rsiPrev: number;
  rsiRising: boolean;
  rsiFalling: boolean;
  adxRising: boolean;
  prevFvg: FVGType;
  regimeMultiplier: number;
}

export interface ScoringResult {
  entryScore: number;
  entryThreshold: number;
  entryReasons: string[];
}

export interface RiskData {
  hardStop: number;
  stopLoss: number;
  tp_target: number;
  v_piso: number;
  hoursHeld: number;
  maxHoldHours: number;
  beActive: boolean;
  antiWhipsawActive: boolean;
  circuitBreakerActive: boolean;
}

export interface DecisionResult {
  decision: TradeAction;
  motivo: string;
  monto_reporte: number;
}

export interface TradeLog {
  id: string;
  coin: CoinSymbol;
  decision: TradeAction;
  motivo: string;
  monto: number;
  precio: number;
  rsi: number;
  adx: number;
  direction: MarketDirection;
  entry_price: number;
  entry_time: string;
  pnl: string;
  timestamp: string;
}

export interface BotState {
  coin: CoinSymbol;
  status: CoinStatus;
  entry_price: number;
  entry_time: string;
  tp_target: number;
  piso_actual: number;
  streak_losses: number;
  monto_entrada: number;
  last_sell_time: string;
  last_sell_reason: string;
  last_sell_price: number;
  updated_at: string;
}

// ─── Multi-Timeframe SM Types ──────────────────────────────
export type Timeframe = '15m' | '1h' | '4h';

export interface OrderBlock {
  type: 'BULLISH' | 'BEARISH';
  high: number;
  low: number;
  candleIndex: number;
  strength: number; // 0-100 based on volume + displacement
}

export interface LiquidityZone {
  type: 'BUY_SIDE' | 'SELL_SIDE';
  price: number;
  strength: number;
  touches: number;
}

export interface StructureBreak {
  type: 'BULLISH' | 'BEARISH';
  level: number;
  candleIndex: number;
}

export interface VolumeProfile {
  poc: number;  // Point of Control (highest volume price)
  vah: number;  // Value Area High
  val: number;  // Value Area Low
  totalVolume: number;
}

export interface SMIndicators {
  orderBlocks: OrderBlock[];
  liquidityZones: LiquidityZone[];
  structureBreaks: StructureBreak[];
  volumeProfile: VolumeProfile;
  fibLevels: { level: number; price: number }[];
  premiumDiscount: 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRIUM';
}

export interface TimeframeData {
  timeframe: Timeframe;
  indicators: FullIndicatorData;
  sm: SMIndicators;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: number; // 0-100
}

export interface MultiTimeframeData {
  coin: string;
  timeframes: Record<Timeframe, TimeframeData>;
  htfBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confluenceScore: number; // 0-100
  alignment: boolean; // all timeframes agree
}

export interface BalanceData {
  usdt_free: number;
  usdt_total: number;
  [key: `${string}_free`]: number;
  [key: `${string}_total`]: number;
}

export interface ExecutionResult {
  id: string;
  coin: CoinSymbol;
  status: 'success' | 'error' | 'running';
  decision: TradeAction;
  motivo: string;
  monto: number;
  entry_price: number;
  timestamp: string;
  error?: string;
}
