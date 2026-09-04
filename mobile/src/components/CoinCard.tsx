// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — CoinCard Component
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CoinSymbol, CoinStatus } from '../shared';
import { StatusBadge } from './StatusBadge';
import { PnLBadge } from './PnLBadge';

interface CoinCardProps {
  coin: CoinSymbol;
  status: CoinStatus;
  price: number;
  entryPrice: number;
  pnl: number;
  pnlUsd?: number;
  montoEntrada?: number;
  score: number;
  threshold: number;
  rsi: number;
  adx: number;
  momentum: string;
  cooldownRemaining?: number;
  onPress: () => void;
  onBuy?: () => void;
  onSell?: () => void;
}

export function CoinCard({
  coin,
  status,
  price,
  entryPrice,
  pnl,
  pnlUsd,
  montoEntrada,
  score,
  threshold,
  rsi,
  adx,
  momentum,
  cooldownRemaining,
  onPress,
  onBuy,
  onSell,
}: CoinCardProps) {
  const momentumColor = momentum === 'BULL' ? '#4ade80' : momentum === 'BEAR' ? '#f87171' : '#888';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.symbol}>{coin}</Text>
          <StatusBadge status={status} />
        </View>
        <PnLBadge
          pnl={pnl}
          pnlUsd={pnlUsd}
          showAbsolute={status === 'COMPRADO'}
          price={price}
          entryPrice={entryPrice}
          montoEntrada={montoEntrada}
        />
      </View>

      {/* Price */}
      <Text style={styles.price}>${price > 0 ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: price > 100 ? 2 : 4 }) : '—'}</Text>

      {/* Indicators Row */}
      <View style={styles.indicators}>
        <View style={styles.indicator}>
          <Text style={styles.indicatorLabel}>RSI</Text>
          <Text style={[styles.indicatorValue, rsi < 35 ? styles.rsiOversold : rsi > 70 ? styles.rsiOverbought : styles.rsiNeutral]}>
            {rsi > 0 ? rsi.toFixed(1) : '—'}
          </Text>
        </View>
        <View style={styles.indicator}>
          <Text style={styles.indicatorLabel}>ADX</Text>
          <Text style={[styles.indicatorValue, adx > 25 ? styles.adxStrong : styles.adxWeak]}>
            {adx > 0 ? adx.toFixed(1) : '—'}
          </Text>
        </View>
        <View style={styles.indicator}>
          <Text style={styles.indicatorLabel}>Score</Text>
          <Text style={[styles.indicatorValue, score >= threshold ? styles.scoreReady : styles.scoreNotReady]}>
            {score}/{threshold}
          </Text>
        </View>
        <View style={styles.indicator}>
          <Text style={styles.indicatorLabel}>Mom</Text>
          <Text style={[styles.indicatorValue, { color: momentumColor }]}>
            {momentum || '—'}
          </Text>
        </View>
      </View>

      {/* Entry Info + Actions */}
      <View style={styles.entryRow}>
        {status === 'COMPRADO' && entryPrice > 0 ? (
          <View style={styles.entryInfo}>
            <Text style={styles.entryLabel}>Entry: ${entryPrice.toFixed(4)}</Text>
            {montoEntrada > 0 && (
              <Text style={styles.entryLabel}>Size: ${montoEntrada.toFixed(2)}</Text>
            )}
          </View>
        ) : (
          <View style={styles.entryInfo}>
            <Text style={styles.entryLabel}>Ready to trade</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {status === 'LÍQUIDO' && onBuy && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.buyBtn]}
              onPress={onBuy}
            >
              <Text style={styles.buyBtnText}>🟢 BUY</Text>
            </TouchableOpacity>
          )}
          {status === 'COMPRADO' && onSell && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.sellBtn]}
              onPress={onSell}
            >
              <Text style={styles.sellBtnText}>🔴 SELL</Text>
            </TouchableOpacity>
          )}
        </View>

        {cooldownRemaining !== undefined && cooldownRemaining > 0 && (
          <View style={styles.cooldownBadge}>
            <Text style={styles.cooldownText}>⏳ {cooldownRemaining.toFixed(0)}m</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  symbol: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  price: {
    color: '#ccc',
    fontSize: 22,
    fontWeight: '600',
    marginTop: 8,
    fontFamily: 'monospace',
  },
  indicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4e',
  },
  indicator: {
    alignItems: 'center',
  },
  indicatorLabel: {
    color: '#666',
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  indicatorValue: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  rsiOversold: { color: '#4ade80' },
  rsiOverbought: { color: '#f87171' },
  rsiNeutral: { color: '#a78bfa' },
  adxStrong: { color: '#fbbf24' },
  adxWeak: { color: '#888' },
  scoreReady: { color: '#4ade80' },
  scoreNotReady: { color: '#888' },
  entryRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4e',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryInfo: {
    gap: 2,
  },
  entryLabel: {
    color: '#888',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  cooldownBadge: {
    backgroundColor: '#f59e0b15',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  cooldownText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  buyBtn: {
    backgroundColor: '#4ade8020',
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  sellBtn: {
    backgroundColor: '#f8717120',
    borderWidth: 1,
    borderColor: '#f87171',
  },
  buyBtnText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: 'bold',
  },
  sellBtnText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
