// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Trade Detail Screen (with AI Analysis)
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from 'react-native';
import { apiService } from '../services/api';

interface TradeDetail {
  id: number;
  coin: string;
  decision: string;
  motivo: string;
  monto: number;
  precio: number;
  rsi: number;
  adx: number;
  direction: string;
  entryPrice: number;
  entryTime: string;
  pnl: string;
  timestamp: string;
}

interface AIAnalysis {
  summary: string;
  reason: string;
  riskAssessment: string;
  lessons: string[];
  recommendation: string;
  confidence: number;
  tags: string[];
}

export function TradeDetailScreen({ route }: any) {
  const { tradeId } = route.params;
  const [trade, setTrade] = useState<TradeDetail | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTrade();
  }, [tradeId]);

  const loadTrade = async () => {
    try {
      setLoading(true);
      // Get trade from history
      const trades = await apiService.getTradeHistory(undefined, 1000);
      const found = trades.find((t: any) => t.id === tradeId);
      if (found) {
        setTrade(found);
      } else {
        setError('Trade not found');
      }
    } catch (err) {
      setError('Failed to load trade');
    } finally {
      setLoading(false);
    }
  };

  const analyzeTrade = async () => {
    if (!trade) return;

    try {
      setAnalyzing(true);
      const result = await apiService.analyzeTrade(trade.id);
      if (result.success) {
        setAnalysis(result.data);
      }
    } catch (err) {
      console.error('Analysis error:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const shareTrade = async () => {
    if (!trade) return;

    const pnlText = trade.pnl ? `PnL: ${trade.pnl}` : '';
    const text = `🪙 ${trade.coin} ${trade.decision} @ $${trade.precio?.toFixed(4)}\n${trade.motivo}\n${pnlText}`;

    try {
      await Share.share({ message: text });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e94560" />
        <Text style={styles.loadingText}>Loading trade...</Text>
      </View>
    );
  }

  if (error || !trade) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || 'Trade not found'}</Text>
      </View>
    );
  }

  const isBuy = trade.decision === 'COMPRAR';
  const pnlValue = trade.pnl ? parseFloat(trade.pnl.replace(/[+%]/g, '')) : null;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.actionBadge, isBuy ? styles.buyBadge : styles.sellBadge]}>
            {isBuy ? '🟢 BUY' : '🔴 SELL'}
          </Text>
          <Text style={styles.coinSymbol}>{trade.coin}</Text>
        </View>
        <Text style={styles.timestamp}>
          {new Date(trade.timestamp).toLocaleDateString()}{' '}
          {new Date(trade.timestamp).toLocaleTimeString()}
        </Text>
      </View>

      {/* Trade Info Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Trade Details</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Price</Text>
          <Text style={styles.infoValue}>${trade.precio?.toFixed(4) || '—'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Monto</Text>
          <Text style={styles.infoValue}>${trade.monto?.toFixed(2) || '—'}</Text>
        </View>

        {trade.entryPrice > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Entry Price</Text>
            <Text style={styles.infoValue}>${trade.entryPrice.toFixed(4)}</Text>
          </View>
        )}

        {pnlValue !== null && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>PnL</Text>
            <Text style={[styles.infoValue, pnlValue >= 0 ? styles.pnlPositive : styles.pnlNegative]}>
              {pnlValue >= 0 ? '+' : ''}{pnlValue.toFixed(2)}%
            </Text>
          </View>
        )}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Direction</Text>
          <Text style={styles.infoValue}>{trade.direction || '—'}</Text>
        </View>
      </View>

      {/* Indicators Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Indicators at Trade Time</Text>

        <View style={styles.indicatorsRow}>
          <View style={styles.indicatorItem}>
            <Text style={styles.indicatorLabel}>RSI</Text>
            <Text style={[
              styles.indicatorValue,
              trade.rsi > 70 ? styles.overbought : trade.rsi < 30 ? styles.oversold : styles.neutral
            ]}>
              {trade.rsi?.toFixed(1) || '—'}
            </Text>
          </View>

          <View style={styles.indicatorItem}>
            <Text style={styles.indicatorLabel}>ADX</Text>
            <Text style={[
              styles.indicatorValue,
              trade.adx > 25 ? styles.strongTrend : styles.weakTrend
            ]}>
              {trade.adx?.toFixed(1) || '—'}
            </Text>
          </View>
        </View>
      </View>

      {/* Reason Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Why This Trade?</Text>
        <Text style={styles.reasonText}>{trade.motivo}</Text>
      </View>

      {/* AI Analysis Section */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>🧠 AI Analysis</Text>
          <TouchableOpacity
            style={styles.analyzeButton}
            onPress={analyzeTrade}
            disabled={analyzing}
          >
            {analyzing ? (
              <ActivityIndicator size="small" color="#e94560" />
            ) : (
              <Text style={styles.analyzeButtonText}>
                {analysis ? '🔄 Re-analyze' : '✨ Analyze'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {analysis ? (
          <View style={styles.analysisContent}>
            <Text style={styles.analysisSummary}>{analysis.summary}</Text>

            <View style={styles.analysisSection}>
              <Text style={styles.analysisSectionTitle}>Reasoning</Text>
              <Text style={styles.analysisText}>{analysis.reason}</Text>
            </View>

            <View style={styles.analysisSection}>
              <Text style={styles.analysisSectionTitle}>Risk Assessment</Text>
              <Text style={styles.analysisText}>{analysis.riskAssessment}</Text>
            </View>

            {analysis.lessons.length > 0 && (
              <View style={styles.analysisSection}>
                <Text style={styles.analysisSectionTitle}>Lessons</Text>
                {analysis.lessons.map((lesson, i) => (
                  <Text key={i} style={styles.lessonItem}>• {lesson}</Text>
                ))}
              </View>
            )}

            <View style={styles.analysisSection}>
              <Text style={styles.analysisSectionTitle}>Recommendation</Text>
              <Text style={styles.analysisText}>{analysis.recommendation}</Text>
            </View>

            <View style={styles.analysisFooter}>
              <Text style={styles.confidenceText}>
                Confidence: {(analysis.confidence * 100).toFixed(0)}%
              </Text>
              {analysis.tags.length > 0 && (
                <View style={styles.tagsContainer}>
                  {analysis.tags.map((tag, i) => (
                    <View key={i} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : (
          <Text style={styles.noAnalysis}>
            Tap "Analyze" to get AI insights about this trade
          </Text>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.shareButton} onPress={shareTrade}>
          <Text style={styles.shareButtonText}>📤 Share Trade</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f23' },
  loadingText: { color: '#888', marginTop: 12 },
  errorText: { color: '#f87171', fontSize: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionBadge: {
    fontSize: 14,
    fontWeight: 'bold',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  buyBadge: { backgroundColor: '#4ade8020', color: '#4ade80' },
  sellBadge: { backgroundColor: '#f8717120', color: '#f87171' },
  coinSymbol: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  timestamp: { color: '#666', fontSize: 12 },
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  infoLabel: { color: '#888', fontSize: 14 },
  infoValue: { color: '#fff', fontSize: 14, fontWeight: '600', fontFamily: 'monospace' },
  pnlPositive: { color: '#4ade80' },
  pnlNegative: { color: '#f87171' },
  indicatorsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  indicatorItem: { alignItems: 'center' },
  indicatorLabel: { color: '#888', fontSize: 12, marginBottom: 4 },
  indicatorValue: { color: '#fff', fontSize: 24, fontWeight: 'bold', fontFamily: 'monospace' },
  overbought: { color: '#f87171' },
  oversold: { color: '#4ade80' },
  neutral: { color: '#fbbf24' },
  strongTrend: { color: '#4ade80' },
  weakTrend: { color: '#888' },
  reasonText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 22,
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
  analysisSummary: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 16,
  },
  analysisSection: { marginBottom: 16 },
  analysisSectionTitle: {
    color: '#e94560',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  analysisText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
  lessonItem: {
    color: '#ccc',
    fontSize: 13,
    lineHeight: 20,
    marginLeft: 8,
  },
  analysisFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4e',
  },
  confidenceText: { color: '#888', fontSize: 12 },
  tagsContainer: { flexDirection: 'row', gap: 6 },
  tag: {
    backgroundColor: '#2a2a4e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tagText: { color: '#888', fontSize: 10 },
  noAnalysis: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  actions: { padding: 16 },
  shareButton: {
    backgroundColor: '#2a2a4e',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  shareButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
