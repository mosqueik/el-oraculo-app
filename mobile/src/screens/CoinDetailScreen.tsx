// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Coin Detail Screen (Live WebSocket Updates)
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Animated,
} from 'react-native';
import { CoinSymbol, COIN_CONFIGS } from '../shared';
import { apiService } from '../services/api';
import { useWebSocket, LivePrice } from '../hooks/useWebSocket';
import { PriceChart } from '../components/PriceChart';
import { ScoreGauge } from '../components/ScoreGauge';
import { IndicatorGauge } from '../components/IndicatorGauge';
import { StatusBadge } from '../components/StatusBadge';
import { PnLBadge } from '../components/PnLBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface CoinDetailData {
  state: any;
  trades: any[];
  executions: any[];
  klines: any[];
}

export function CoinDetailScreen({ route, navigation }: any) {
  const coin = (route?.params?.coin || 'BTC') as CoinSymbol;
  const config = COIN_CONFIGS[coin];
  const [data, setData] = useState<CoinDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live WebSocket data
  const { subscribeToCoin, unsubscribeFromCoin, getPrice, getScore, lastTrade } = useWebSocket({
    autoConnect: true,
    coin,
  });

  // Price animation
  const priceAnim = useRef(new Animated.Value(1)).current;
  const prevPriceRef = useRef<number>(0);

  const fetchData = useCallback(async () => {
    try {
      const [stateRes, tradesRes, executionsRes, klinesRes] = await Promise.allSettled([
        apiService.getPortfolioByCoin(coin),
        apiService.getTradeHistory(coin),
        apiService.getExecutions(20),
        apiService.getKlines(coin, '15m', 100),
      ]);

      const state = stateRes.status === 'fulfilled' ? stateRes.value : null;
      const trades = tradesRes.status === 'fulfilled' ? (Array.isArray(tradesRes.value) ? tradesRes.value : []) : [];
      const executions = executionsRes.status === 'fulfilled' ? (Array.isArray(executionsRes.value) ? executionsRes.value : []) : [];
      const klines = klinesRes.status === 'fulfilled' ? (klinesRes.value?.klines || []) : [];

      setData({ state, trades, executions, klines });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [coin]);

  useEffect(() => {
    fetchData();
    subscribeToCoin(coin);
    return () => unsubscribeFromCoin(coin);
  }, [fetchData, coin, subscribeToCoin, unsubscribeFromCoin]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Animate price on change
  const livePrice = getPrice(coin);
  const liveScore = getScore(coin);

  useEffect(() => {
    if (livePrice && livePrice.price !== prevPriceRef.current) {
      const prev = prevPriceRef.current || livePrice.price;
      const isUp = livePrice.price > prev;

      // Flash animation
      Animated.sequence([
        Animated.timing(priceAnim, {
          toValue: 1.1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(priceAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();

      prevPriceRef.current = livePrice.price;
    }
  }, [livePrice?.price, priceAnim]);

  if (loading) return <LoadingSpinner message={`Loading ${coin}...`} fullScreen />;
  if (error && !data) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>⚠️ {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const state = data?.state;
  const trades = data?.trades || [];
  const executions = data?.executions || [];
  const klines = data?.klines || [];

  // Current price: prefer live WebSocket, fallback to klines
  const wsPrice = livePrice?.price;
  const klinePrice = klines.length > 0 ? klines[klines.length - 1].close : 0;
  const currentPrice = wsPrice || klinePrice || (state?.lastSellPrice || state?.entryPrice || 0);

  // Position info
  const status = (state?.status || 'LÍQUIDO') as 'COMPRADO' | 'LÍQUIDO';
  const entryPrice = state?.entryPrice || 0;
  const pisoActual = state?.pisoActual || 0;
  const streakLosses = state?.streakLosses || 0;
  const montoEntrada = state?.montoEntrada || 0;
  const lastSellReason = state?.lastSellReason || '';

  // PnL calculation
  const pnl = status === 'COMPRADO' && entryPrice > 0 && currentPrice > 0
    ? ((currentPrice - entryPrice) / entryPrice) * 100
    : 0;

  // Last execution data (prefer live score, fallback to execution log)
  const lastExec = executions.find((e) => e.coin === coin);
  const lastDecision = lastExec?.decision || 'ESPERAR';
  const lastMotivo = lastExec?.motivo || '';
  const lastRsi = liveScore?.rsi || lastExec?.rsi || 0;
  const lastAdx = liveScore?.adx || lastExec?.adx || 0;
  const lastScore = liveScore?.score ?? lastExec?.score ?? 0;

  // Recent trades for this coin (last 5)
  const recentTrades = trades.slice(0, 5);

  // TP target
  const tpTarget = config?.tp_base || 1.0;
  const tpPrice = entryPrice > 0 ? entryPrice * (1 + tpTarget / 100) : 0;

  // Price color based on live change
  const priceChangeColor = livePrice
    ? livePrice.change24h >= 0 ? '#4ade80' : '#f87171'
    : '#fff';

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" colors={['#e94560']} />
      }
    >
      {/* Coin Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.coinSymbol}>{coin}</Text>
          <Text style={styles.coinPair}>{config?.pair || `${coin}USDT`}</Text>
        </View>
        <View style={styles.headerRight}>
          <StatusBadge status={status} size="medium" />
          {wsPrice && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
      </View>

      {/* Price + PnL */}
      <View style={styles.priceSection}>
        <Animated.Text style={[styles.currentPrice, { transform: [{ scale: priceAnim }] }, { color: priceChangeColor }]}>
          ${currentPrice > 0
            ? currentPrice.toLocaleString(undefined, {
                minimumFractionDigits: currentPrice > 100 ? 2 : 4,
                maximumFractionDigits: currentPrice > 100 ? 2 : 4,
              })
            : '—'}
        </Animated.Text>
        {status === 'COMPRADO' && (
          <PnLBadge pnl={pnl} size="large" />
        )}
      </View>

      {/* Live Price Badge */}
      {wsPrice && livePrice?.change24h !== 0 && (
        <View style={styles.changeBadge}>
          <Text style={[styles.changeText, { color: priceChangeColor }]}>
            {livePrice.change24h >= 0 ? '▲' : '▼'} {livePrice.change24h >= 0 ? '+' : ''}{livePrice.change24h.toFixed(2)}% cycle
          </Text>
        </View>
      )}

      {/* Price Chart */}
      <View style={styles.section}>
        <PriceChart
          klines={klines}
          entryPrice={entryPrice}
          piso={pisoActual}
          tp={tpPrice}
          coin={coin}
        />
      </View>

      {/* Position Info (if COMPRADO) */}
      {status === 'COMPRADO' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Position</Text>
          <View style={styles.positionGrid}>
            <View style={styles.positionItem}>
              <Text style={styles.positionLabel}>Entry</Text>
              <Text style={styles.positionValue}>${entryPrice.toFixed(4)}</Text>
            </View>
            <View style={styles.positionItem}>
              <Text style={styles.positionLabel}>Monto</Text>
              <Text style={styles.positionValue}>${montoEntrada.toFixed(2)}</Text>
            </View>
            <View style={styles.positionItem}>
              <Text style={styles.positionLabel}>Floor</Text>
              <Text style={[styles.positionValue, styles.textYellow]}>
                ${pisoActual > 0 ? pisoActual.toFixed(4) : '—'}
              </Text>
            </View>
            <View style={styles.positionItem}>
              <Text style={styles.positionLabel}>TP Target</Text>
              <Text style={[styles.positionValue, styles.textGreen]}>
                ${tpPrice > 0 ? tpPrice.toFixed(4) : '—'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Last Sell Info (if LÍQUIDO) */}
      {status === 'LÍQUIDO' && lastSellReason && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📤 Last Sell</Text>
          <View style={styles.lastSellCard}>
            <Text style={styles.lastSellReason}>{lastSellReason}</Text>
            {state?.lastSellPrice > 0 && (
              <Text style={styles.lastSellPrice}>@ ${state.lastSellPrice.toFixed(4)}</Text>
            )}
          </View>
        </View>
      )}

      {/* Indicator Gauges (live from WebSocket) */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📊 Indicators</Text>
          {liveScore && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDotSmall} />
              <Text style={styles.liveTextSmall}>LIVE</Text>
            </View>
          )}
        </View>

        <IndicatorGauge
          label="RSI (14)"
          value={lastRsi}
          zones={[
            { from: 0, to: 30, color: '#4ade80', label: 'Oversold' },
            { from: 30, to: 40, color: '#a78bfa' },
            { from: 40, to: 60, color: '#888' },
            { from: 60, to: 70, color: '#fbbf24' },
            { from: 70, to: 100, color: '#f87171', label: 'Overbought' },
          ]}
          markers={[
            { value: config?.rsi_oversold || 35, color: '#4ade80', label: 'OS' },
            { value: config?.rsi_overbought || 70, color: '#f87171', label: 'OB' },
          ]}
        />

        <IndicatorGauge
          label="ADX (14)"
          value={lastAdx}
          zones={[
            { from: 0, to: 20, color: '#888', label: 'Weak' },
            { from: 20, to: 25, color: '#fbbf24', label: 'Moderate' },
            { from: 25, to: 50, color: '#4ade80', label: 'Strong' },
            { from: 50, to: 100, color: '#a78bfa', label: 'Very Strong' },
          ]}
          markers={[
            { value: 25, color: '#fff', label: '25' },
          ]}
        />
      </View>

      {/* Score Gauge + Decision */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎯 Entry Score</Text>
        <View style={styles.gaugeDecisionRow}>
          <ScoreGauge
            score={lastScore}
            threshold={config?.entry_min || 2}
            maxScore={8}
            size={140}
          />

          <View style={styles.decisionPanel}>
            <View style={[styles.decisionBadge, lastDecision === 'COMPRAR' ? styles.decisionBuy : lastDecision === 'VENDER' ? styles.decisionSell : styles.decisionWait]}>
              <Text style={styles.decisionText}>
                {lastDecision === 'COMPRAR' ? '🟢 BUY' : lastDecision === 'VENDER' ? '🔴 SELL' : '⏳ WAIT'}
              </Text>
            </View>
            {lastMotivo ? (
              <Text style={styles.decisionMotivo} numberOfLines={3}>{lastMotivo}</Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Coin Config Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ Config</Text>
        <View style={styles.configGrid}>
          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Risk %</Text>
            <Text style={styles.configValue}>{((config?.risk_pct || 0) * 100).toFixed(1)}%</Text>
          </View>
          <View style={styles.configItem}>
            <Text style={styles.configLabel}>TP Base</Text>
            <Text style={styles.configValue}>{config?.tp_base || 0}%</Text>
          </View>
          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Stop Loss</Text>
            <Text style={[styles.configValue, styles.textRed]}>{config?.stop_loss || 0}%</Text>
          </View>
          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Max Hours</Text>
            <Text style={styles.configValue}>{config?.time_exit_max_hours || 0}h</Text>
          </View>
          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Streak</Text>
            <Text style={[styles.configValue, streakLosses > 0 ? styles.textRed : styles.textGreen]}>
              {streakLosses}
            </Text>
          </View>
          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Entry Min</Text>
            <Text style={styles.configValue}>{config?.entry_min || 2}</Text>
          </View>
        </View>
      </View>

      {/* Recent Trades */}
      {recentTrades.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📋 Recent Trades</Text>
            <TouchableOpacity onPress={() => navigation.navigate('History', { coin })}>
              <Text style={styles.seeAll}>See All →</Text>
            </TouchableOpacity>
          </View>
          {recentTrades.map((trade: any) => {
            const isBuy = trade.decision === 'COMPRAR';
            const pnlVal = trade.pnl ? parseFloat(trade.pnl.replace(/[+%]/g, '')) : null;

            return (
              <View key={trade.id} style={styles.tradeRow}>
                <View style={styles.tradeLeft}>
                  <Text style={[styles.tradeAction, isBuy ? styles.textGreen : styles.textRed]}>
                    {isBuy ? '🟢' : '🔴'} {trade.decision}
                  </Text>
                  <Text style={styles.tradePrice}>${trade.precio?.toFixed(4)}</Text>
                </View>
                <View style={styles.tradeRight}>
                  {pnlVal !== null && (
                    <Text style={[styles.tradePnl, pnlVal >= 0 ? styles.textGreen : styles.textRed]}>
                      {pnlVal >= 0 ? '+' : ''}{pnlVal.toFixed(2)}%
                    </Text>
                  )}
                  <Text style={styles.tradeTime}>
                    {new Date(trade.timestamp).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0f0f23',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: { color: '#f87171', fontSize: 16, textAlign: 'center' },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#e9456020',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9456040',
  },
  retryText: { color: '#e94560', fontSize: 14, fontWeight: '600' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  coinSymbol: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  coinPair: { color: '#666', fontSize: 14, alignSelf: 'flex-end', marginBottom: 2 },

  // Live indicator
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4ade8015',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ade80',
  },
  liveText: {
    color: '#4ade80',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#4ade80',
  },
  liveTextSmall: {
    color: '#4ade80',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // Price
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 12,
  },
  currentPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  changeBadge: {
    paddingHorizontal: 16,
    marginTop: 4,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },

  // Sections
  section: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  seeAll: {
    color: '#e94560',
    fontSize: 12,
    fontWeight: '600',
  },

  // Position
  positionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  positionItem: {
    backgroundColor: '#1a1a2e',
    padding: 12,
    borderRadius: 10,
    width: '48%',
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  positionLabel: { color: '#666', fontSize: 11, textTransform: 'uppercase' },
  positionValue: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 4, fontFamily: 'monospace' },

  // Last sell
  lastSellCard: {
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  lastSellReason: { color: '#ccc', fontSize: 13 },
  lastSellPrice: { color: '#888', fontSize: 12, fontFamily: 'monospace', marginTop: 4 },

  // Gauge + Decision
  gaugeDecisionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  decisionPanel: {
    flex: 1,
  },
  decisionBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  decisionBuy: { backgroundColor: '#4ade8015' },
  decisionSell: { backgroundColor: '#f8717115' },
  decisionWait: { backgroundColor: '#88888815' },
  decisionText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  decisionMotivo: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },

  // Config
  configGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  configItem: {
    backgroundColor: '#1a1a2e',
    padding: 10,
    borderRadius: 8,
    width: '31%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  configLabel: { color: '#666', fontSize: 10, textTransform: 'uppercase' },
  configValue: { color: '#ccc', fontSize: 14, fontWeight: 'bold', marginTop: 2, fontFamily: 'monospace' },

  // Trades
  tradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  tradeLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tradeAction: { fontSize: 13, fontWeight: 'bold' },
  tradePrice: { color: '#ccc', fontSize: 13, fontFamily: 'monospace' },
  tradeRight: { alignItems: 'flex-end' },
  tradePnl: { fontSize: 13, fontWeight: 'bold', fontFamily: 'monospace' },
  tradeTime: { color: '#666', fontSize: 10, marginTop: 2 },

  // Colors
  textGreen: { color: '#4ade80' },
  textRed: { color: '#f87171' },
  textYellow: { color: '#fbbf24' },
});
