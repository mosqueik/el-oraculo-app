// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — PnLBadge Component (with USDT amount)
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface PnLBadgeProps {
  pnl: number;
  pnlUsd?: number;
  showAbsolute?: boolean;
  price?: number;
  entryPrice?: number;
  montoEntrada?: number;
  size?: 'small' | 'medium' | 'large';
}

export function PnLBadge({ pnl, pnlUsd, showAbsolute = false, price = 0, entryPrice = 0, montoEntrada = 0, size = 'medium' }: PnLBadgeProps) {
  // Calculate percentage
  const pct = showAbsolute && entryPrice > 0 && price > 0
    ? ((price - entryPrice) / entryPrice) * 100
    : pnl;

  // Calculate absolute USDT if not provided
  const usdPnl = pnlUsd !== undefined
    ? pnlUsd
    : (showAbsolute && entryPrice > 0 && price > 0 && montoEntrada > 0
      ? (price - entryPrice) * (montoEntrada / entryPrice)
      : 0);

  const isPositive = pct >= 0;
  const isSmall = size === 'small';
  const isLarge = size === 'large';

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.badge,
          isPositive ? styles.badgePositive : styles.badgeNegative,
          isSmall && styles.badgeSmall,
          isLarge && styles.badgeLarge,
        ]}
      >
        <Text
          style={[
            styles.text,
            isPositive ? styles.textPositive : styles.textNegative,
            isSmall && styles.textSmall,
            isLarge && styles.textLarge,
          ]}
        >
          {isPositive ? '▲' : '▼'} {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
        </Text>
      </View>
      {showAbsolute && usdPnl !== 0 && (
        <Text
          style={[
            styles.usdText,
            isPositive ? styles.usdPositive : styles.usdNegative,
            isSmall && styles.usdSmall,
          ]}
        >
          {isPositive ? '+' : ''}{usdPnl >= 0 ? '$' : '-$'}{Math.abs(usdPnl).toFixed(2)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    gap: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeLarge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  badgePositive: {
    backgroundColor: '#4ade8015',
  },
  badgeNegative: {
    backgroundColor: '#f8717115',
  },
  text: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  textSmall: {
    fontSize: 11,
  },
  textLarge: {
    fontSize: 18,
  },
  textPositive: {
    color: '#4ade80',
  },
  textNegative: {
    color: '#f87171',
  },
  usdText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  usdSmall: {
    fontSize: 9,
  },
  usdPositive: {
    color: '#4ade80',
  },
  usdNegative: {
    color: '#f87171',
  },
});
