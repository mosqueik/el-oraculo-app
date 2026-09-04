// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Backtest Screen
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Share,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { apiService } from '../services/api';
import { CoinSymbol, ACTIVE_COINS } from '../shared';

const screenWidth = Dimensions.get('window').width;

interface BacktestResult {
  params: any;
  summary: {
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    totalPnl: number;
    totalReturn: number;
    maxDrawdown: number;
    profitFactor: number;
    sharpeRatio: number;
    avgTrade: number;
    avgWin: number;
    avgLoss: number;
    bestTrade: number;
    worstTrade: number;
    avgHoldHours: number;
  };
  trades: any[];
  equityCurve: Array<{ date: string; balance: number; drawdown: number }>;
  monthlyReturns: Array<{ month: string; return: number; trades: number }>;
}

interface Preset {
  name: string;
  description: string;
  params: {
    riskPct: number;
    entryThreshold: number;
    stopLossPct: number;
    takeProfitPct: number;
    maxHoldHours: number;
  };
}

export function BacktestScreen() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<CoinSymbol>('BTC');
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2025-12-31');
  const [initialBalance, setInitialBalance] = useState('10000');
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);

  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const data = await apiService.getBacktestPresets();
      setPresets(data);
    } catch (err) {
      console.error('Failed to load presets:', err);
    }
  };

  const runBacktest = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const data = await apiService.runBacktest({
        coin: selectedCoin,
        startDate,
        endDate,
        initialBalance: parseFloat(initialBalance),
        ...(selectedPreset?.params || {}),
      });

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backtest failed');
    } finally {
      setLoading(false);
    }
  };

  const exportResults = async () => {
    if (!result) return;

    try {
      const lines = [
        `Backtest Results — ${selectedCoin}`,
        `Period: ${startDate} to ${endDate}`,
        `Initial Balance: $${initialBalance}`,
        '',
        'Summary:',
        `- Total Trades: ${result.summary.totalTrades}`,
        `- Win Rate: ${result.summary.winRate.toFixed(1)}%`,
        `- Total Return: ${result.summary.totalReturn >= 0 ? '+' : ''}${result.summary.totalReturn.toFixed(2)}%`,
        `- Profit Factor: ${result.summary.profitFactor.toFixed(2)}`,
        `- Sharpe Ratio: ${result.summary.sharpeRatio.toFixed(2)}`,
        `- Max Drawdown: ${result.summary.maxDrawdown.toFixed(2)}%`,
        '',
        'Trades:',
        ...result.trades.map(t =>
          `${t.entryDate} → ${t.exitDate}: ${t.pnlPct >= 0 ? '+' : ''}${t.pnlPct.toFixed(2)}% (${t.exitReason})`
        ),
      ].join('\n');

      await Share.share({
        message: lines,
        title: `Backtest ${selectedCoin} ${startDate}-${endDate}`,
      });
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🔬 Backtesting</Text>
        <Text style={styles.subtitle}>Test strategies against historical data</Text>
      </View>

      {/* Configuration */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Configuration</Text>

        {/* Coin Selector */}
        <Text style={styles.label}>Coin</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.coinScroll}>
          {ACTIVE_COINS.map(coin => (
            <TouchableOpacity
              key={coin}
              style={[styles.coinBtn, selectedCoin === coin && styles.coinBtnActive]}
              onPress={() => setSelectedCoin(coin)}
            >
              <Text style={[styles.coinBtnText, selectedCoin === coin && styles.coinBtnTextActive]}>
                {coin}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Date Range */}
        <View style={styles.dateRow}>
          <View style={styles.dateInput}>
            <Text style={styles.label}>Start Date</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#666"
            />
          </View>
          <View style={styles.dateInput}>
            <Text style={styles.label}>End Date</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#666"
            />
          </View>
        </View>

        {/* Initial Balance */}
        <Text style={styles.label}>Initial Balance (USDT)</Text>
        <TextInput
          style={styles.input}
          value={initialBalance}
          onChangeText={setInitialBalance}
          keyboardType="numeric"
          placeholder="10000"
          placeholderTextColor="#666"
        />
      </View>

      {/* Presets */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Strategy Presets</Text>
        <View style={styles.presetsGrid}>
          {presets.map((preset) => (
            <TouchableOpacity
              key={preset.name}
              style={[
                styles.presetCard,
                selectedPreset?.name === preset.name && styles.presetCardActive,
              ]}
              onPress={() => setSelectedPreset(
                selectedPreset?.name === preset.name ? null : preset
              )}
            >
              <Text style={styles.presetName}>{preset.name}</Text>
              <Text style={styles.presetDesc}>{preset.description}</Text>
              <View style={styles.presetParams}>
                <Text style={styles.presetParam}>SL: {preset.params.stopLossPct}%</Text>
                <Text style={styles.presetParam}>TP: {preset.params.takeProfitPct}%</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Run Button */}
      <TouchableOpacity
        style={[styles.runBtn, loading && styles.runBtnDisabled]}
        onPress={runBacktest}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.runBtnText}>🚀 Run Backtest</Text>
        )}
      </TouchableOpacity>

      {/* Error */}
      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>❌ {error}</Text>
        </View>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary Stats */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Results</Text>
              <TouchableOpacity style={styles.exportBtn} onPress={exportResults}>
                <Text style={styles.exportBtnText}>📤 Share</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
              <View style={[styles.statBox, result.summary.totalReturn >= 0 ? styles.statGreen : styles.statRed]}>
                <Text style={styles.statLabel}>Return</Text>
                <Text style={[styles.statValue, result.summary.totalReturn >= 0 ? styles.textGreen : styles.textRed]}>
                  {result.summary.totalReturn >= 0 ? '+' : ''}{result.summary.totalReturn.toFixed(2)}%
                </Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Win Rate</Text>
                <Text style={[styles.statValue, result.summary.winRate > 50 ? styles.textGreen : styles.textRed]}>
                  {result.summary.winRate.toFixed(1)}%
                </Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Trades</Text>
                <Text style={styles.statValue}>{result.summary.totalTrades}</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Sharpe</Text>
                <Text style={[styles.statValue, result.summary.sharpeRatio > 1 ? styles.textGreen : styles.textYellow]}>
                  {result.summary.sharpeRatio.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Extended Stats */}
            <View style={styles.extendedStats}>
              <View style={styles.extRow}>
                <Text style={styles.extLabel}>Profit Factor</Text>
                <Text style={[styles.extValue, result.summary.profitFactor > 1 ? styles.textGreen : styles.textRed]}>
                  {result.summary.profitFactor.toFixed(2)}
                </Text>
              </View>
              <View style={styles.extRow}>
                <Text style={styles.extLabel}>Max Drawdown</Text>
                <Text style={[styles.extValue, styles.textRed]}>{result.summary.maxDrawdown.toFixed(2)}%</Text>
              </View>
              <View style={styles.extRow}>
                <Text style={styles.extLabel}>Avg Win</Text>
                <Text style={[styles.extValue, styles.textGreen]}>+{result.summary.avgWin.toFixed(2)}%</Text>
              </View>
              <View style={styles.extRow}>
                <Text style={styles.extLabel}>Avg Loss</Text>
                <Text style={[styles.extValue, styles.textRed]}>{result.summary.avgLoss.toFixed(2)}%</Text>
              </View>
              <View style={styles.extRow}>
                <Text style={styles.extLabel}>Best Trade</Text>
                <Text style={[styles.extValue, styles.textGreen]}>+{result.summary.bestTrade.toFixed(2)}%</Text>
              </View>
              <View style={styles.extRow}>
                <Text style={styles.extLabel}>Worst Trade</Text>
                <Text style={[styles.extValue, styles.textRed]}>{result.summary.worstTrade.toFixed(2)}%</Text>
              </View>
              <View style={styles.extRow}>
                <Text style={styles.extLabel}>Avg Hold Time</Text>
                <Text style={styles.extValue}>{result.summary.avgHoldHours.toFixed(1)}h</Text>
              </View>
            </View>
          </View>

          {/* Equity Curve Chart */}
          {result.equityCurve.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Equity Curve</Text>
              <LineChart
                data={{
                  labels: result.equityCurve
                    .filter((_, i) => i % Math.max(1, Math.floor(result.equityCurve.length / 6)) === 0)
                    .map(p => p.date.substring(5)),
                  datasets: [{
                    data: result.equityCurve.map(p => p.balance),
                    color: () => '#4ade80',
                    strokeWidth: 2,
                  }],
                }}
                width={screenWidth - 64}
                height={200}
                chartConfig={{
                  backgroundColor: '#1a1a2e',
                  backgroundGradientFrom: '#1a1a2e',
                  backgroundGradientTo: '#1a1a2e',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(74, 222, 128, ${opacity})`,
                  labelColor: () => '#888',
                  propsForDots: { r: '3', strokeWidth: '1', stroke: '#4ade80' },
                }}
                bezier
                style={styles.chart}
              />
            </View>
          )}

          {/* Monthly Returns */}
          {result.monthlyReturns.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Monthly Returns</Text>
              {result.monthlyReturns.map((m) => (
                <View key={m.month} style={styles.monthRow}>
                  <Text style={styles.monthLabel}>{m.month}</Text>
                  <Text style={[styles.monthReturn, m.return >= 0 ? styles.textGreen : styles.textRed]}>
                    {m.return >= 0 ? '+' : ''}{m.return.toFixed(2)}%
                  </Text>
                  <Text style={styles.monthTrades}>{m.trades} trades</Text>
                </View>
              ))}
            </View>
          )}

          {/* Recent Trades */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Trades</Text>
            {result.trades.slice(0, 10).map((trade, i) => (
              <View key={i} style={styles.tradeRow}>
                <View style={styles.tradeInfo}>
                  <Text style={styles.tradeDate}>{trade.entryDate} → {trade.exitDate}</Text>
                  <Text style={styles.tradeReason}>{trade.exitReason}</Text>
                </View>
                <Text style={[styles.tradePnl, trade.pnlPct >= 0 ? styles.textGreen : styles.textRed]}>
                  {trade.pnlPct >= 0 ? '+' : ''}{trade.pnlPct.toFixed(2)}%
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  header: { padding: 16, paddingTop: 8 },
  title: { color: '#e94560', fontSize: 24, fontWeight: 'bold' },
  subtitle: { color: '#888', fontSize: 14, marginTop: 4 },
  card: {
    backgroundColor: '#1a1a2e',
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  label: { color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#0f0f23',
    borderWidth: 1,
    borderColor: '#2a2a4e',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
  },
  coinScroll: { marginBottom: 8 },
  coinBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0f0f23',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  coinBtnActive: { backgroundColor: '#e9456020', borderColor: '#e94560' },
  coinBtnText: { color: '#888', fontSize: 13, fontWeight: '600' },
  coinBtnTextActive: { color: '#e94560' },
  dateRow: { flexDirection: 'row', gap: 12 },
  dateInput: { flex: 1 },
  presetsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetCard: {
    width: '48%',
    backgroundColor: '#0f0f23',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  presetCardActive: { borderColor: '#e94560', backgroundColor: '#e9456010' },
  presetName: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  presetDesc: { color: '#888', fontSize: 11, marginTop: 4 },
  presetParams: { flexDirection: 'row', gap: 8, marginTop: 8 },
  presetParam: { color: '#666', fontSize: 10 },
  runBtn: {
    backgroundColor: '#e94560',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  runBtnDisabled: { opacity: 0.6 },
  runBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  errorCard: {
    backgroundColor: '#f8717120',
    margin: 16,
    marginBottom: 0,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f8717140',
  },
  errorText: { color: '#f87171', fontSize: 14 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statBox: {
    width: '48%',
    backgroundColor: '#0f0f23',
    padding: 12,
    borderRadius: 8,
  },
  statGreen: { borderWidth: 1, borderColor: '#4ade8040' },
  statRed: { borderWidth: 1, borderColor: '#f8717140' },
  statLabel: { color: '#888', fontSize: 11, textTransform: 'uppercase' },
  statValue: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  textGreen: { color: '#4ade80' },
  textRed: { color: '#f87171' },
  textYellow: { color: '#fbbf24' },
  extendedStats: { borderTopWidth: 1, borderTopColor: '#2a2a4e', paddingTop: 12 },
  extRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e20',
  },
  extLabel: { color: '#888', fontSize: 13 },
  extValue: { color: '#fff', fontSize: 13, fontWeight: '600', fontFamily: 'monospace' },
  chart: { borderRadius: 8 },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e20',
  },
  monthLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  monthReturn: { fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace' },
  monthTrades: { color: '#888', fontSize: 12 },
  tradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e20',
  },
  tradeInfo: { flex: 1 },
  tradeDate: { color: '#fff', fontSize: 13 },
  tradeReason: { color: '#888', fontSize: 11, marginTop: 2 },
  tradePnl: { fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace' },
  exportBtn: {
    backgroundColor: '#e9456020',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e9456040',
  },
  exportBtnText: { color: '#e94560', fontSize: 12, fontWeight: '600' },
});
