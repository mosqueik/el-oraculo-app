// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Trade History Screen
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Alert, Share,
} from 'react-native';
import { CoinSymbol } from '../shared';
import { useTradesStore } from '../store';
import { useTranslation } from '../hooks/useTranslation';
import { apiService } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';

const COINS: Array<{ symbol: CoinSymbol; label: string }> = [
  { symbol: 'BTC', label: 'BTC' },
  { symbol: 'ETH', label: 'ETH' },
  { symbol: 'SOL', label: 'SOL' },
  { symbol: 'BNB', label: 'BNB' },
  { symbol: 'AVAX', label: 'AVAX' },
  { symbol: 'POL', label: 'POL' },
  { symbol: 'SUI', label: 'SUI' },
  { symbol: 'LINK', label: 'LINK' },
  { symbol: 'NEAR', label: 'NEAR' },
  { symbol: 'DOGE', label: 'DOGE' },
];

export function TradeHistoryScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const initialCoin = route?.params?.coin as CoinSymbol | undefined;
  const [selectedCoin, setSelectedCoin] = useState<CoinSymbol | 'ALL'>(initialCoin || 'ALL');
  const [exporting, setExporting] = useState(false);
  const { trades, loading, error, fetchTrades } = useTradesStore();

  useEffect(() => {
    fetchTrades(selectedCoin === 'ALL' ? undefined : selectedCoin, 100);
  }, [selectedCoin, fetchTrades]);

  // Calculate summary
  const totalTrades = trades.length;
  const buyTrades = trades.filter((t) => t.decision === 'COMPRAR').length;
  const sellTrades = trades.filter((t) => t.decision === 'VENDER').length;

  const pnls = trades
    .filter((t) => t.decision === 'VENDER' && t.pnl)
    .map((t) => {
      const match = t.pnl?.match(/([+-]?[\d.]+)/);
      return match ? parseFloat(match[1]) : 0;
    });
  const totalPnl = pnls.reduce((a, b) => a + b, 0);
  const winRate = pnls.length > 0
    ? ((pnls.filter((p) => p > 0).length / pnls.length) * 100)
    : 0;

  const renderTrade = ({ item }: { item: any }) => {
    const isBuy = item.decision === 'COMPRAR';
    const pnlVal = item.pnl ? parseFloat(item.pnl.replace(/[+%]/g, '')) : null;

    return (
      <TouchableOpacity
        style={styles.tradeRow}
        onPress={() => navigation.navigate('TradeDetail', { tradeId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.tradeHeader}>
          <View style={styles.tradeHeaderLeft}>
            <Text style={[styles.tradeAction, isBuy ? styles.actionBuy : styles.actionSell]}>
              {isBuy ? '🟢 COMPRAR' : '🔴 VENDER'}
            </Text>
            <Text style={styles.tradeCoin}>{item.coin}</Text>
          </View>
          <Text style={styles.tradeTime}>
            {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        <View style={styles.tradeDetails}>
          <View style={styles.tradeDetailItem}>
            <Text style={styles.detailLabel}>Price</Text>
            <Text style={styles.detailValue}>${item.precio?.toFixed(4) || '—'}</Text>
          </View>
          <View style={styles.tradeDetailItem}>
            <Text style={styles.detailLabel}>Monto</Text>
            <Text style={styles.detailValue}>${item.monto?.toFixed(2) || '—'}</Text>
          </View>
          {pnlVal !== null && (
            <View style={styles.tradeDetailItem}>
              <Text style={styles.detailLabel}>PnL</Text>
              <Text style={[styles.detailValue, pnlVal >= 0 ? styles.pnlPositive : styles.pnlNegative]}>
                {pnlVal >= 0 ? '+' : ''}{pnlVal.toFixed(2)}%
              </Text>
            </View>
          )}
        </View>

        {item.motivo && (
          <Text style={styles.tradeMotivo} numberOfLines={1}>{item.motivo}</Text>
        )}
      </TouchableOpacity>
    );
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      setExporting(true);
      const coin = selectedCoin === 'ALL' ? undefined : selectedCoin;
      const data = await apiService.exportTrades(format, coin);

      if (format === 'json') {
        const jsonString = JSON.stringify(data, null, 2);
        await Share.share({ message: jsonString, title: 'Trade History Export' });
      } else {
        await Share.share({ message: data, title: 'Trade History CSV' });
      }
    } catch (err) {
      Alert.alert(t('common.error'), 'Failed to export trades');
    } finally {
      setExporting(false);
    }
  };

  const showExportOptions = () => {
    Alert.alert(t('trades.export'), '', [
      { text: t('trades.exportCSV'), onPress: () => handleExport('csv') },
      { text: t('trades.exportJSON'), onPress: () => handleExport('json') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Trades</Text>
            <Text style={styles.summaryValue}>{totalTrades}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Buys</Text>
            <Text style={[styles.summaryValue, styles.textGreen]}>{buyTrades}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Sells</Text>
            <Text style={[styles.summaryValue, styles.textRed]}>{sellTrades}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Win Rate</Text>
            <Text style={[styles.summaryValue, winRate > 50 ? styles.textGreen : styles.textRed]}>
              {winRate.toFixed(0)}%
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total PnL</Text>
            <Text style={[styles.summaryValue, totalPnl >= 0 ? styles.textGreen : styles.textRed]}>
              {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Export & Backtest Buttons */}
      <View style={styles.exportRow}>
        <TouchableOpacity style={styles.exportButton} onPress={showExportOptions} disabled={exporting}>
          <Text style={styles.exportButtonText}>📤 {t('trades.export')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.backtestButton}
          onPress={() => navigation.navigate('Backtest')}
        >
          <Text style={styles.backtestButtonText}>🔬 Backtest</Text>
        </TouchableOpacity>
      </View>

      {/* Coin Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <TouchableOpacity
          style={[styles.filterChip, selectedCoin === 'ALL' && styles.filterChipActive]}
          onPress={() => setSelectedCoin('ALL')}
        >
          <Text style={[styles.filterChipText, selectedCoin === 'ALL' && styles.filterChipTextActive]}>ALL</Text>
        </TouchableOpacity>
        {COINS.map((c) => (
          <TouchableOpacity
            key={c.symbol}
            style={[styles.filterChip, selectedCoin === c.symbol && styles.filterChipActive]}
            onPress={() => setSelectedCoin(c.symbol)}
          >
            <Text style={[styles.filterChipText, selectedCoin === c.symbol && styles.filterChipTextActive]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Trade List */}
      {loading ? (
        <LoadingSpinner message="Loading trades..." />
      ) : error ? (
        <EmptyState icon="❌" title="Error" message={error} />
      ) : trades.length === 0 ? (
        <EmptyState icon="📭" title="No trades yet" message="Trades will appear here as the bot executes them." />
      ) : (
        <FlatList
          data={trades}
          renderItem={renderTrade}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  summaryCard: {
    backgroundColor: '#1a1a2e',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryLabel: { color: '#666', fontSize: 11, textTransform: 'uppercase' },
  summaryValue: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  textGreen: { color: '#4ade80' },
  textRed: { color: '#f87171' },
  exportRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  exportButton: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a4e',
    alignItems: 'center',
  },
  exportButtonText: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  backtestButton: {
    flex: 1,
    backgroundColor: '#e9456020',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9456040',
    alignItems: 'center',
  },
  backtestButtonText: { color: '#e94560', fontSize: 13, fontWeight: '600' },
  filterScroll: { paddingHorizontal: 16, maxHeight: 50 },
  filterChip: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  filterChipActive: {
    backgroundColor: '#e9456020',
    borderColor: '#e94560',
  },
  filterChipText: { color: '#888', fontSize: 13, fontWeight: '600' },
  filterChipTextActive: { color: '#e94560' },
  listContent: { padding: 16, paddingTop: 8 },
  tradeRow: {
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tradeHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tradeAction: { fontSize: 13, fontWeight: 'bold' },
  actionBuy: { color: '#4ade80' },
  actionSell: { color: '#f87171' },
  tradeCoin: { color: '#888', fontSize: 12, fontWeight: '600' },
  tradeTime: { color: '#666', fontSize: 11 },
  tradeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  tradeDetailItem: { alignItems: 'center' },
  detailLabel: { color: '#666', fontSize: 10, textTransform: 'uppercase' },
  detailValue: { color: '#ccc', fontSize: 13, fontWeight: '600', marginTop: 2, fontFamily: 'monospace' },
  pnlPositive: { color: '#4ade80' },
  pnlNegative: { color: '#f87171' },
  tradeMotivo: {
    color: '#555',
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
  },
});
