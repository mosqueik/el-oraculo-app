// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — StatusBadge Component
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CoinStatus } from '../shared';

interface StatusBadgeProps {
  status: CoinStatus;
  size?: 'small' | 'medium';
}

export function StatusBadge({ status, size = 'small' }: StatusBadgeProps) {
  const isComprado = status === 'COMPRADO';
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        isComprado ? styles.badgeComprado : styles.badgeLiquido,
        isSmall && styles.badgeSmall,
      ]}
    >
      <Text
        style={[
          styles.text,
          isComprado ? styles.textComprado : styles.textLiquido,
          isSmall && styles.textSmall,
        ]}
      >
        {isComprado ? '● COMPRADO' : '○ LÍQUIDO'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeComprado: {
    backgroundColor: '#4ade8015',
  },
  badgeLiquido: {
    backgroundColor: '#88888815',
  },
  text: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  textSmall: {
    fontSize: 10,
  },
  textComprado: {
    color: '#4ade80',
  },
  textLiquido: {
    color: '#888',
  },
});
