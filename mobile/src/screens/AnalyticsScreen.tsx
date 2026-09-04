// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Analytics Screen (Performance Dashboard)
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { apiService } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';

const screenWidth = Dimensions.get('window').width;

interface PerformanceData {
  overview: {
    totalTrades: number;
    totalSells: number;
    winRate: number;
    totalPnl: number;
    avgPnl: number;
    profitFactor: string;
    expectancy: string;
    sharpeRatio: string;
  };
  streaks: {
    current: number;
    maxWin: number;
    maxLoss: number;
  };
  extremes: {
    bestTrade: number;
    worstTrade: number;
    avgWin: string;
    avgLoss: string;
  };
  risk: {
    maxDrawdown: string;
    variance: string;
    stdDev: string;
  };
  frequency: {
    last24h: number;
    lastWeek: number;
    avgPerDay: string;
  };
  coinBreakdown: Array<{
    coin: string;
    totalTrades: number;
    winRate: number;
    totalPnl: number;
    avgPnl: number;
    bestTrade: number;
    worstTrade: number;
  }>;
}

interface PortfolioAnalysis {
  overallAssessment: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  riskLevel: string;
  suggestedActions: string[];
}

export function AnalyticsScreen() {
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [equityCurve, setEquityCurve] = useState<Array<{ date: string; pnl: number; cumulative: number; drawdown: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'coins' | 'ai' | 'equity'>('overview');

  useEffect(() => {
    loadPerformance();
  }, []);

  const loadPerformance = async () => {
    try {
      const [perfResult, curveResult] = await Promise.all([
        apiService.getPerformance(),
        apiService.getEquityCurve(),
      ]);
      if (perfResult.success) {
        setPerformance(perfResult.data);
      }
      if (curveResult?.curve) {
        setEquityCurve(curveResult.curve);
      }
    } catch (err) {
      console.error('Failed to load performance:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPerformance();
    setRefreshing(false);
  };

  const analyzePortfolio = async () => {
    try {
      setAnalyzing(true);
      const result = await apiService.analyzePortfolio();
      if (result.success) {
        setAiAnalysis(result.data);
        setActiveTab('ai');
      }
    } catch (err) {
      console.error('Portfolio analysis error:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading analytics..." />;
  }

  if (!performance) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load performance data</Text>
      </View>
    );
  }

  const { overview, streaks, extremes, risk, frequency, coinBreakdown } = performance;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />}
    >
      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>Overview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'equity' && styles.tabActive]}
            onPress={() => setActiveTab('equity')}
          >
            <Text style={[styles.tabText, activeTab === 'equity' && styles.tabTextActive]}>📈 Equity</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'coins' && styles.tabActive]}
            onPress={() => setActiveTab('coins')}
          >
            <Text style={[styles.tabText, activeTab === 'coins' && styles.tabTextActive]}>By Coin</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'ai' && styles.tabActive]}
            onPress={() => setActiveTab('ai')}
          >
            <Text style={[styles.tabText, activeTab === 'ai' && styles.tabTextActive]}>🤖 AI</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Main Stats */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, overview.totalPnl >= 0 ? styles.statGreen : styles.statRed]}>
              <Text style={styles.statLabel}>Total PnL</Text>
              <Text style={[styles.statValue, overview.totalPnl >= 0 ? styles.textGreen : styles.textRed]}>
                {overview.totalPnl >= 0 ? '+' : ''}{overview.totalPnl.toFixed(2)}%
              </Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Win Rate</Text>
              <Text style={[styles.statValue, overview.winRate > 50 ? styles.textGreen : styles.textRed]}>
                {overview.winRate.toFixed(1)}%
              </Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total Trades</Text>
              <Text style={styles.statValue}>{overview.totalTrades}</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Profit Factor</Text>
              <Text style={[styles.statValue, parseFloat(overview.profitFactor) > 1 ? styles.textGreen : styles.textRed]}>
                {overview.profitFactor}
              </Text>
            </View>
          </View>

          {/* Extended Stats */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Performance Metrics</Text>

            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Expectancy</Text>
                <Text style={styles.metricValue}>{overview.expectancy}%</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Sharpe Ratio</Text>
                <Text style={styles.metricValue}>{overview.sharpeRatio}</Text>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Avg Win</Text>
                <Text style={[styles.metricValue, styles.textGreen]}>+{extremes.avgWin}%</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Avg Loss</Text>
                <Text style={[styles.metricValue, styles.textRed]}>{extremes.avgLoss}%</Text>
              </View>
            </View>
          </View>

          {/* Streaks */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Streaks</Text>
            <View style={styles.streaksRow}>
              <View style={styles.streakItem}>
                <Text style={styles.streakLabel}>Current</Text>
                <Text style={[styles.streakValue, streaks.current >= 0 ? styles.textGreen : styles.textRed]}>
                  {streaks.current > 0 ? `+${streaks.current}` : streaks.current}
                </Text>
              </View>
              <View style={styles.streakItem}>
                <Text style={styles.streakLabel}>Max Win</Text>
                <Text style={[styles.streakValue, styles.textGreen]}>+{streaks.maxWin}</Text>
              </View>
              <View style={styles.streakItem}>
                <Text style={styles.streakLabel}>Max Loss</Text>
                <Text style={[styles.streakValue, styles.textRed]}>-{streaks.maxLoss}</Text>
              </View>
            </View>
          </View>

          {/* Risk */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Risk Analysis</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Max Drawdown</Text>
              <Text style={[styles.infoValue, styles.textRed]}>{risk.maxDrawdown}%</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Std Deviation</Text>
              <Text style={styles.infoValue}>{risk.stdDev}%</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Best Trade</Text>
              <Text style={[styles.infoValue, styles.textGreen]}>+{extremes.bestTrade.toFixed(2)}%</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Worst Trade</Text>
              <Text style={[styles.infoValue, styles.textRed]}>{extremes.worstTrade.toFixed(2)}%</Text>
            </View>
          </View>

          {/* Frequency */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Trading Frequency</Text>
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Last 24h</Text>
                <Text style={styles.metricValue}>{frequency.last24h}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Last 7d</Text>
                <Text style={styles.metricValue}>{frequency.lastWeek}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Avg/Day</Text>
                <Text style={styles.metricValue}>{frequency.avgPerDay}</Text>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Coins Tab */}
      {activeTab === 'coins' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Performance by Coin</Text>

          {coinBreakdown.length === 0 ? (
            <Text style={styles.noData}>No trade data available</Text>
          ) : (
            coinBreakdown.map((coin) => (
              <View key={coin.coin} style={styles.coinRow}>
                <View style={styles.coinHeader}>
                  <Text style={styles.coinSymbol}>{coin.coin}</Text>
                  <Text style={[styles.coinPnl, coin.totalPnl >= 0 ? styles.textGreen : styles.textRed]}>
                    {coin.totalPnl >= 0 ? '+' : ''}{coin.totalPnl.toFixed(2)}%
                  </Text>
                </View>

                <View style={styles.coinMetrics}>
                  <View style={styles.coinMetric}>
                    <Text style={styles.coinMetricLabel}>Trades</Text>
                    <Text style={styles.coinMetricValue}>{coin.totalTrades}</Text>
                  </View>
                  <View style={styles.coinMetric}>
                    <Text style={styles.coinMetricLabel}>Win Rate</Text>
                    <Text style={[styles.coinMetricValue, coin.winRate > 50 ? styles.textGreen : styles.textRed]}>
                      {coin.winRate.toFixed(0)}%
                    </Text>
                  </View>
                  <View style={styles.coinMetric}>
                    <Text style={styles.coinMetricLabel}>Best</Text>
                    <Text style={[styles.coinMetricValue, styles.textGreen]}>+{coin.bestTrade.toFixed(1)}%</Text>
                  </View>
                  <View style={styles.coinMetric}>
                    <Text style={styles.coinMetricLabel}>Worst</Text>
                    <Text style={[styles.coinMetricValue, styles.textRed]}>{coin.worstTrade.toFixed(1)}%</Text>
                  </View>
                </View>

                {/* Win Rate Bar */}
                <View style={styles.winRateBar}>
                  <View style={[styles.winRateFill, { width: `${coin.winRate}%` }]} />
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* Equity Curve Tab */}
      {activeTab === 'equity' && (
        <>
          {equityCurve.length > 0 ? (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>📈 Cumulative PnL</Text>
                <LineChart
                  data={{
                    labels: equityCurve
                      .filter((_, i) => i % Math.max(1, Math.floor(equityCurve.length / 6)) === 0)
                      .map(p => new Date(p.date).toLocaleDateString().substring(5)),
                    datasets: [{
                      data: equityCurve.map(p => p.cumulative),
                      color: () => equityCurve[equityCurve.length - 1]?.cumulative >= 0 ? '#4ade80' : '#f87171',
                      strokeWidth: 2,
                    }],
                  }}
                  width={screenWidth - 64}
                  height={220}
                  yAxisSuffix="%"
                  chartConfig={{
                    backgroundColor: '#1a1a2e',
                    backgroundGradientFrom: '#1a1a2e',
                    backgroundGradientTo: '#1a1a2e',
                    decimalPlaces: 1,
                    color: (opacity = 1) => `rgba(74, 222, 128, ${opacity})`,
                    labelColor: () => '#888',
                    propsForDots: { r: '3', strokeWidth: '1', stroke: '#4ade80' },
                  }}
                  bezier
                  style={styles.chart}
                />
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>📉 Drawdown</Text>
                <LineChart
                  data={{
                    labels: equityCurve
                      .filter((_, i) => i % Math.max(1, Math.floor(equityCurve.length / 6)) === 0)
                      .map(p => new Date(p.date).toLocaleDateString().substring(5)),
                    datasets: [{
                      data: equityCurve.map(p => -p.drawdown),
                      color: () => '#f87171',
                      strokeWidth: 2,
                    }],
                  }}
                  width={screenWidth - 64}
                  height={180}
                  yAxisSuffix="%"
                  chartConfig={{
                    backgroundColor: '#1a1a2e',
                    backgroundGradientFrom: '#1a1a2e',
                    backgroundGradientTo: '#1a1a2e',
                    decimalPlaces: 1,
                    color: (opacity = 1) => `rgba(248, 113, 113, ${opacity})`,
                    labelColor: () => '#888',
                    propsForDots: { r: '2', strokeWidth: '1', stroke: '#f87171' },
                  }}
                  bezier
                  style={styles.chart}
                />
              </View>

              {/* Trade List in Equity Tab */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Trade History</Text>
                {equityCurve.map((point, i) => (
                  <View key={i} style={styles.equityRow}>
                    <Text style={styles.equityDate}>{new Date(point.date).toLocaleDateString()}</Text>
                    <Text style={[styles.equityPnl, point.pnl >= 0 ? styles.textGreen : styles.textRed]}>
                      {point.pnl >= 0 ? '+' : ''}{point.pnl.toFixed(2)}%
                    </Text>
                    <Text style={styles.equityCumulative}>
                      {point.cumulative >= 0 ? '+' : ''}{point.cumulative.toFixed(2)}%
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.card}>
              <Text style={styles.noData}>No equity curve data yet. Trades will appear here as the bot executes them.</Text>
            </View>
          )}
        </>
      )}

      {/* AI Tab */}
      {activeTab === 'ai' && (
        <>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>🤖 AI Portfolio Analysis</Text>
              <TouchableOpacity
                style={styles.analyzeButton}
                onPress={analyzePortfolio}
                disabled={analyzing}
              >
                {analyzing ? (
                  <ActivityIndicator size="small" color="#e94560" />
                ) : (
                  <Text style={styles.analyzeButtonText}>
                    {aiAnalysis ? '🔄 Re-analyze' : '✨ Analyze'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {aiAnalysis ? (
              <View style={styles.analysisContent}>
                <Text style={styles.assessment}>{aiAnalysis.overallAssessment}</Text>

                {aiAnalysis.strengths.length > 0 && (
                  <View style={styles.analysisSection}>
                    <Text style={styles.sectionTitle}>✅ Strengths</Text>
                    {aiAnalysis.strengths.map((s, i) => (
                      <Text key={i} style={styles.analysisItem}>• {s}</Text>
                    ))}
                  </View>
                )}

                {aiAnalysis.weaknesses.length > 0 && (
                  <View style={styles.analysisSection}>
                    <Text style={styles.sectionTitle}>⚠️ Weaknesses</Text>
                    {aiAnalysis.weaknesses.map((w, i) => (
                      <Text key={i} style={styles.analysisItem}>• {w}</Text>
                    ))}
                  </View>
                )}

                {aiAnalysis.recommendations.length > 0 && (
                  <View style={styles.analysisSection}>
                    <Text style={styles.sectionTitle}>💡 Recommendations</Text>
                    {aiAnalysis.recommendations.map((r, i) => (
                      <Text key={i} style={styles.analysisItem}>• {r}</Text>
                    ))}
                  </View>
                )}

                <View style={styles.riskBadge}>
                  <Text style={styles.riskLabel}>Risk Level:</Text>
                  <Text style={[
                    styles.riskValue,
                    aiAnalysis.riskLevel === 'HIGH' ? styles.textRed :
                    aiAnalysis.riskLevel === 'LOW' ? styles.textGreen : styles.textYellow
                  ]}>
                    {aiAnalysis.riskLevel}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.noAnalysis}>
                Tap "Analyze" to get AI insights about your portfolio
              </Text>
            )}
          </View>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#f87171', fontSize: 16 },
  tabsScroll: { paddingTop: 16 },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#e9456020', borderWidth: 1, borderColor: '#e94560' },
  tabText: { color: '#888', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#e94560' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 8,
  },
  statCard: {
    backgroundColor: '#1a1a2e',
    width: '48%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  statGreen: { borderColor: '#4ade8040' },
  statRed: { borderColor: '#f8717140' },
  statLabel: { color: '#888', fontSize: 12, textTransform: 'uppercase' },
  statValue: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 4 },
  textGreen: { color: '#4ade80' },
  textRed: { color: '#f87171' },
  textYellow: { color: '#fbbf24' },
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
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  metricItem: { alignItems: 'center' },
  metricLabel: { color: '#888', fontSize: 11, textTransform: 'uppercase' },
  metricValue: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 4, fontFamily: 'monospace' },
  streaksRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  streakItem: { alignItems: 'center' },
  streakLabel: { color: '#888', fontSize: 11, textTransform: 'uppercase' },
  streakValue: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  infoLabel: { color: '#888', fontSize: 14 },
  infoValue: { color: '#fff', fontSize: 14, fontWeight: '600', fontFamily: 'monospace' },
  coinRow: {
    backgroundColor: '#0f0f23',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  coinHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  coinSymbol: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  coinPnl: { fontSize: 16, fontWeight: 'bold', fontFamily: 'monospace' },
  coinMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  coinMetric: { alignItems: 'center' },
  coinMetricLabel: { color: '#666', fontSize: 10, textTransform: 'uppercase' },
  coinMetricValue: { color: '#ccc', fontSize: 12, fontWeight: '600', marginTop: 2 },
  winRateBar: {
    height: 4,
    backgroundColor: '#f8717140',
    borderRadius: 2,
    overflow: 'hidden',
  },
  winRateFill: {
    height: '100%',
    backgroundColor: '#4ade80',
    borderRadius: 2,
  },
  analyzeButton: {
    backgroundColor: '#e9456020',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e9456040',
  },
  analyzeButtonText: { color: '#e94560', fontSize: 12, fontWeight: '600' },
  analysisContent: { marginTop: 4 },
  assessment: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  analysisSection: { marginBottom: 16 },
  sectionTitle: {
    color: '#e94560',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  analysisItem: {
    color: '#ccc',
    fontSize: 13,
    lineHeight: 20,
    marginLeft: 8,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4e',
  },
  riskLabel: { color: '#888', fontSize: 13 },
  riskValue: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  noAnalysis: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  noData: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  chart: { borderRadius: 8, marginTop: 8 },
  equityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e20',
  },
  equityDate: { color: '#888', fontSize: 13, flex: 1 },
  equityPnl: { fontSize: 13, fontWeight: 'bold', fontFamily: 'monospace', flex: 1, textAlign: 'center' },
  equityCumulative: { fontSize: 13, fontWeight: '600', fontFamily: 'monospace', flex: 1, textAlign: 'right' },
});
