// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Dashboard Screen (with Offline Support)
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { CoinSymbol, ACTIVE_COINS, COIN_CONFIGS } from '../shared';
import { usePortfolioStore, useConnectionStore } from '../store';
import { useWebSocket } from '../hooks/useWebSocket';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { CoinCard } from '../components/CoinCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { TradeConfirmModal } from '../components/TradeConfirmModal';
import { MiniEquityCurve } from '../components/MiniEquityCurve';
import { apiService } from '../services/api';

export function DashboardScreen({ navigation }: any) {
  const { coins, balance, loading, error, lastUpdate, refresh } = usePortfolioStore();
  const { connected } = useConnectionStore();
  const { livePrices, livePnL, getPnLForCoin } = useWebSocket({ autoConnect: true });
  const { isConnected } = useNetworkStatus(15000);

  // Trade modal state
  const [tradeModal, setTradeModal] = useState<{
    visible: boolean;
    action: 'BUY' | 'SELL';
    coin: string;
  }>({ visible: false, action: 'BUY', coin: '' });

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleBuy = (coin: string) => {
    setTradeModal({ visible: true, action: 'BUY', coin });
  };

  const handleSell = (coin: string) => {
    setTradeModal({ visible: true, action: 'SELL', coin });
  };

  const handleConfirmTrade = async (amountUsdt?: number) => {
    try {
      if (tradeModal.action === 'BUY') {
        await apiService.manualBuy(tradeModal.coin as CoinSymbol, amountUsdt || 50);
        Alert.alert('✅ Buy Order Executed', `${tradeModal.coin} purchased successfully`);
      } else {
        await apiService.manualSell(tradeModal.coin as CoinSymbol);
        Alert.alert('✅ Sell Order Executed', `${tradeModal.coin} sold successfully`);
      }
      setTradeModal({ visible: false, action: 'BUY', coin: '' });
      refresh();
    } catch (error: any) {
      Alert.alert('❌ Trade Failed', error.message || 'An error occurred');
    }
  };

  // Calculate stats
  const activePositions = coins.filter((c) => c.status === 'COMPRADO').length;
  const totalPositions = coins.length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#e94560" colors={['#e94560']} />
      }
    >
      {/* Connection / Offline indicator */}
      <View style={styles.connectionBar}>
        {!isConnected ? (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineIcon}>📡</Text>
            <Text style={styles.offlineText}>Offline — Showing cached data</Text>
          </View>
        ) : !connected ? (
          <View style={styles.reconnectingBanner}>
            <View style={styles.connectionDot} />
            <Text style={styles.connectionText}>Connecting...</Text>
          </View>
        ) : (
          <View style={styles.connectedBanner}>
            <View style={[styles.connectionDot, styles.dotConnected]} />
            <Text style={styles.connectionText}>Live</Text>
            {lastUpdate && (
              <Text style={styles.lastUpdate}>
                {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>USDT Balance</Text>
        <Text style={styles.balanceValue}>
          ${balance.usdt_free > 0
            ? balance.usdt_free.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '—'
          }
        </Text>
        {balance.usdt_total > 0 && balance.usdt_free !== balance.usdt_total && (
          <Text style={styles.balanceTotal}>
            Total: ${balance.usdt_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        )}
        <View style={styles.balanceStats}>
          <View style={styles.balanceStat}>
            <Text style={styles.statLabel}>Active</Text>
            <Text style={[styles.statValue, styles.textGreen]}>{activePositions}</Text>
          </View>
          <View style={styles.balanceStatDivider} />
          <View style={styles.balanceStat}>
            <Text style={styles.statLabel}>Liquid</Text>
            <Text style={styles.statValue}>{totalPositions - activePositions}</Text>
          </View>
          <View style={styles.balanceStatDivider} />
          <View style={styles.balanceStat}>
            <Text style={styles.statLabel}>Coins</Text>
            <Text style={styles.statValue}>{totalPositions}</Text>
          </View>
        </View>
      </View>

      {/* Mini Equity Curve */}
      <MiniEquityCurve />

      {/* PnL Summary (real-time from WebSocket) */}
      {livePnL && livePnL.summary.activeCount > 0 && (
        <View style={styles.pnlCard}>
          <Text style={styles.pnlLabel}>📊 Portfolio PnL</Text>
          <View style={styles.pnlRow}>
            <View style={styles.pnlStat}>
              <Text style={styles.pnlStatLabel}>Total PnL</Text>
              <Text style={[styles.pnlStatValue, livePnL.summary.totalPnlPct >= 0 ? styles.textGreen : styles.textRed]}>
                {livePnL.summary.totalPnlPct >= 0 ? '+' : ''}{livePnL.summary.totalPnlPct.toFixed(2)}%
              </Text>
              <Text style={[styles.pnlStatUsd, livePnL.summary.totalPnlUsd >= 0 ? styles.textGreen : styles.textRed]}>
                {livePnL.summary.totalPnlUsd >= 0 ? '+$' : '-$'}{Math.abs(livePnL.summary.totalPnlUsd).toFixed(2)}
              </Text>
            </View>
            <View style={styles.pnlStatDivider} />
            <View style={styles.pnlStat}>
              <Text style={styles.pnlStatLabel}>In Profit</Text>
              <Text style={[styles.pnlStatValue, styles.textGreen]}>{livePnL.summary.positionsInProfit}</Text>
            </View>
            <View style={styles.pnlStatDivider} />
            <View style={styles.pnlStat}>
              <Text style={styles.pnlStatLabel}>In Loss</Text>
              <Text style={[styles.pnlStatValue, styles.textRed]}>{livePnL.summary.positionsInLoss}</Text>
            </View>
          </View>
          {livePnL.positions.filter(p => p.cooldownRemaining > 0).map(p => (
            <View key={p.coin} style={styles.cooldownBadge}>
              <Text style={styles.cooldownText}>
                ⏳ {p.coin}: {p.cooldownRemaining.toFixed(0)}m cooldown
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('History')}
        >
          <Text style={styles.actionIcon}>📊</Text>
          <Text style={styles.actionLabel}>Trades</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Analytics')}
        >
          <Text style={styles.actionIcon}>📈</Text>
          <Text style={styles.actionLabel}>Analytics</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Text style={styles.actionIcon}>🔔</Text>
          <Text style={styles.actionLabel}>Alerts</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.actionIcon}>⚙️</Text>
          <Text style={styles.actionLabel}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Portfolio Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Portfolio</Text>
        <Text style={styles.sectionCount}>{totalPositions} coins</Text>
      </View>

      {/* Loading State */}
      {loading && coins.length === 0 ? (
        <LoadingSpinner message="Loading portfolio..." />
      ) : error && coins.length === 0 ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Coin Cards — sorted by absolute USDT impact */
        [...coins]
          .sort((a, b) => {
            // Active positions first
            if (a.status === 'COMPRADO' && b.status !== 'COMPRADO') return -1;
            if (a.status !== 'COMPRADO' && b.status === 'COMPRADO') return 1;
            // Then by absolute USDT PnL (biggest impact first)
            const aUsd = getPnLForCoin(a.coin)?.pnlUsd || 0;
            const bUsd = getPnLForCoin(b.coin)?.pnlUsd || 0;
            return Math.abs(bUsd) - Math.abs(aUsd);
          })
          .map((coin) => {
            // Get live PnL from WebSocket (server-calculated)
            const livePnLData = getPnLForCoin(coin.coin);

            // Get live price from WebSocket, fallback to stored data
            const livePrice = livePrices.get(coin.coin);
            const lastPrice = livePnLData?.currentPrice
              || livePrice?.price
              || (coin.lastSellPrice > 0 ? coin.lastSellPrice : coin.entryPrice);

            // Use server-calculated PnL or calculate locally
            const pnl = livePnLData?.pnlPct
              ?? (coin.status === 'COMPRADO' && coin.entryPrice > 0 && lastPrice > 0
                ? ((lastPrice - coin.entryPrice) / coin.entryPrice) * 100
                : 0);

            // USDT PnL
            const pnlUsd = livePnLData?.pnlUsd
              ?? (coin.status === 'COMPRADO' && coin.entryPrice > 0 && lastPrice > 0 && coin.montoEntrada > 0
                ? (lastPrice - coin.entryPrice) * (coin.montoEntrada / coin.entryPrice)
                : 0);

            // Cooldown remaining (from server)
            const cooldownRemaining = livePnLData?.cooldownRemaining || 0;

            const coinConfig = COIN_CONFIGS[coin.coin as CoinSymbol];

            return (
              <CoinCard
                key={coin.coin}
                coin={coin.coin as CoinSymbol}
                status={coin.status as any}
                price={lastPrice}
                entryPrice={coin.entryPrice}
                pnl={pnl}
                pnlUsd={pnlUsd}
                montoEntrada={coin.montoEntrada}
                score={0}
                threshold={coinConfig?.entry_min || 2}
                rsi={0}
                adx={0}
                momentum="NEUTRAL"
              cooldownRemaining={coin.status === 'COMPRADO' ? 0 : cooldownRemaining}
              onPress={() => navigation.navigate('CoinDetail', { coin: coin.coin })}
              onBuy={() => handleBuy(coin.coin)}
              onSell={() => handleSell(coin.coin)}
            />
            );
          })
      )}

      {/* Cache indicator */}
      {lastUpdate && !isConnected && (
        <View style={styles.cacheIndicator}>
          <Text style={styles.cacheText}>
            📦 Data cached at {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      )}

      <View style={{ height: 40 }} />

      {/* Trade Confirmation Modal */}
      <TradeConfirmModal
        visible={tradeModal.visible}
        action={tradeModal.action}
        coin={tradeModal.coin}
        currentPrice={livePrices.get(tradeModal.coin)?.price || 0}
        entryPrice={coins.find(c => c.coin === tradeModal.coin)?.entryPrice}
        montoEntrada={coins.find(c => c.coin === tradeModal.coin)?.montoEntrada}
        pnlPct={getPnLForCoin(tradeModal.coin)?.pnlPct}
        pnlUsd={getPnLForCoin(tradeModal.coin)?.pnlUsd}
        onConfirm={handleConfirmTrade}
        onCancel={() => setTradeModal({ visible: false, action: 'BUY', coin: '' })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },

  // Connection bar
  connectionBar: {
    paddingVertical: 4,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8717120',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  offlineIcon: { fontSize: 14 },
  offlineText: { color: '#f87171', fontSize: 12, fontWeight: '600' },
  reconnectingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  connectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  connectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#888' },
  dotConnected: { backgroundColor: '#4ade80' },
  connectionText: { color: '#888', fontSize: 11 },
  lastUpdate: { color: '#555', fontSize: 10, marginLeft: 8 },

  // Balance
  balanceCard: {
    backgroundColor: '#1a1a2e',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  balanceLabel: { color: '#888', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  balanceValue: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 8,
    fontFamily: 'monospace',
  },
  balanceTotal: { color: '#666', fontSize: 13, marginTop: 4, fontFamily: 'monospace' },
  balanceStats: {
    flexDirection: 'row',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4e',
  },
  balanceStat: { alignItems: 'center', flex: 1 },
  balanceStatDivider: { width: 1, backgroundColor: '#2a2a4e' },
  statLabel: { color: '#666', fontSize: 11, textTransform: 'uppercase' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  textGreen: { color: '#4ade80' },
  textRed: { color: '#f87171' },

  // PnL Card
  pnlCard: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  pnlLabel: { color: '#888', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  pnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pnlStat: { alignItems: 'center', flex: 1 },
  pnlStatDivider: { width: 1, height: 30, backgroundColor: '#2a2a4e' },
  pnlStatLabel: { color: '#666', fontSize: 11, textTransform: 'uppercase' },
  pnlStatValue: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  pnlStatUsd: { color: '#888', fontSize: 12, marginTop: 2 },
  cooldownBadge: {
    marginTop: 8,
    backgroundColor: '#f59e0b15',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  cooldownText: { color: '#f59e0b', fontSize: 11, fontWeight: '500' },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  actionIcon: { fontSize: 24 },
  actionLabel: { color: '#ccc', fontSize: 13, fontWeight: '600', marginTop: 6 },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  sectionCount: { color: '#666', fontSize: 13 },

  // Error
  errorCard: {
    backgroundColor: '#f8717115',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f8717130',
  },
  errorText: { color: '#f87171', fontSize: 14, textAlign: 'center' },
  retryButton: {
    marginTop: 12,
    backgroundColor: '#f8717120',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: { color: '#f87171', fontSize: 13, fontWeight: '600' },

  // Cache indicator
  cacheIndicator: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cacheText: {
    color: '#666',
    fontSize: 11,
    fontStyle: 'italic',
  },
});
