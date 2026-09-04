// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — PriceChart Component (react-native-chart-kit)
// ═══════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

interface KlineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PriceChartProps {
  klines: KlineData[];
  entryPrice?: number;
  piso?: number;
  tp?: number;
  coin?: string;
}

type TimeframeOption = '15m' | '1h' | '4h' | '1d';

const SCREEN_WIDTH = Dimensions.get('window').width;

export function PriceChart({
  klines,
  entryPrice = 0,
  piso = 0,
  tp = 0,
  coin = '',
}: PriceChartProps) {
  const [timeframe, setTimeframe] = useState<TimeframeOption>('15m');

  if (!klines || klines.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>📊 No chart data</Text>
      </View>
    );
  }

  // Extract close prices for line chart
  const prices = klines.map((k) => k.close);
  const labels = klines
    .filter((_, i) => i % Math.max(1, Math.floor(klines.length / 6)) === 0)
    .map((k) => {
      const d = new Date(k.time);
      return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
    });

  // Calculate chart bounds
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const padding = (maxPrice - minPrice) * 0.1;

  // Reference lines (entry, piso, tp)
  const referenceLines: Array<{ value: number; color: string; label: string }> = [];
  if (entryPrice > 0) referenceLines.push({ value: entryPrice, color: '#e94560', label: 'Entry' });
  if (piso > 0) referenceLines.push({ value: piso, color: '#fbbf24', label: 'Floor' });
  if (tp > 0) referenceLines.push({ value: tp, color: '#4ade80', label: 'TP' });

  // Chart config
  const chartConfig = {
    backgroundColor: '#1a1a2e',
    backgroundGradientFrom: '#1a1a2e',
    backgroundGradientTo: '#0f0f23',
    decimalPlaces: coin === 'BTC' ? 0 : coin === 'DOGE' ? 5 : 4,
    color: (opacity = 1) => `rgba(233, 69, 96, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(136, 136, 136, ${opacity})`,
    style: {
      borderRadius: 12,
    },
    propsForDots: {
      r: '0',
      strokeWidth: '0',
    },
    propsForBackgroundLines: {
      strokeDasharray: '4',
      stroke: '#2a2a4e',
      strokeWidth: 1,
    },
    fillShadowGradientFrom: '#e94560',
    fillShadowGradientTo: '#0f0f23',
    fillShadowGradientFromOpacity: 0.3,
    fillShadowGradientToOpacity: 0,
  };

  // Build datasets with reference lines
  const datasets: any[] = [
    {
      data: prices,
      color: (opacity = 1) => `rgba(233, 69, 96, ${opacity})`,
      strokeWidth: 2,
    },
  ];

  // Add reference line datasets
  for (const ref of referenceLines) {
    datasets.push({
      data: Array(prices.length).fill(ref.value),
      color: () => ref.color,
      strokeWidth: 1,
      withDots: false,
      strokeDasharray: '5,5',
    });
  }

  return (
    <View style={styles.container}>
      {/* Timeframe Selector */}
      <View style={styles.timeframeRow}>
        {(['15m', '1h', '4h', '1d'] as TimeframeOption[]).map((tf) => (
          <TouchableOpacity
            key={tf}
            style={[styles.timeframeButton, timeframe === tf && styles.timeframeActive]}
            onPress={() => setTimeframe(tf)}
          >
            <Text style={[styles.timeframeText, timeframe === tf && styles.timeframeTextActive]}>
              {tf}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Chart */}
      <LineChart
        data={datasets}
        width={SCREEN_WIDTH - 32}
        height={220}
        chartConfig={chartConfig}
        bezier
        style={styles.chart}
        withInnerLines={true}
        withOuterLines={false}
        withVerticalLabels={true}
        withHorizontalLabels={true}
        fromZero={false}
        yAxisLabel="$"
        yAxisSuffix=""
        segments={5}
        formatYLabel={(value) => {
          const num = parseFloat(value);
          if (num >= 1000) return `$${(num / 1000).toFixed(1)}k`;
          if (num >= 1) return `$${num.toFixed(2)}`;
          return `$${num.toFixed(4)}`;
        }}
      />

      {/* Legend */}
      {referenceLines.length > 0 && (
        <View style={styles.legend}>
          {referenceLines.map((ref, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: ref.color }]} />
              <Text style={styles.legendLabel}>{ref.label}: ${ref.value.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Price Range */}
      <View style={styles.rangeRow}>
        <Text style={styles.rangeLabel}>Low: ${minPrice.toFixed(2)}</Text>
        <Text style={styles.rangeLabel}>High: ${maxPrice.toFixed(2)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  emptyContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
  },
  timeframeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  timeframeButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#0f0f23',
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  timeframeActive: {
    backgroundColor: '#e9456020',
    borderColor: '#e94560',
  },
  timeframeText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  timeframeTextActive: {
    color: '#e94560',
  },
  chart: {
    borderRadius: 12,
    marginVertical: 4,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: '#888',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4e',
  },
  rangeLabel: {
    color: '#666',
    fontSize: 11,
    fontFamily: 'monospace',
  },
});
