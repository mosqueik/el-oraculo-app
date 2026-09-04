// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Mini Equity Curve Component
// Compact PnL chart for Dashboard header
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { apiService } from '../services/api';

interface EquityPoint {
  date: string;
  pnl: number;
  cumulative: number;
  drawdown: number;
}

interface EquityData {
  curve: EquityPoint[];
  summary: {
    totalPnl: number;
    maxDrawdown: number;
    dataPoints: number;
  };
}

export function MiniEquityCurve() {
  const [data, setData] = useState<EquityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEquityData();
  }, []);

  const loadEquityData = async () => {
    try {
      const result = await apiService.getEquityCurve();
      setData(result);
    } catch (error) {
      // Silently fail — chart is optional
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data || data.curve.length < 2) {
    return null; // Don't show if no data
  }

  const { curve, summary } = data;
  const isPositive = summary.totalPnl >= 0;

  // Prepare chart data — take last 20 points for compact view
  const recentCurve = curve.slice(-20);
  const chartData = recentCurve.map((p) => p.cumulative);

  // Calculate min/max for chart
  const minVal = Math.min(...chartData);
  const maxVal = Math.max(...chartData);
  const range = maxVal - minVal || 1;

  // Normalize to 0-100 for better visualization
  const normalizedData = chartData.map((v) => ((v - minVal) / range) * 100);

  // Labels — show first and last date
  const firstDate = new Date(recentCurve[0].date);
  const lastDate = new Date(recentCurve[recentCurve.length - 1].date);
  const formatDate = (d: Date) =>
    `${d.getDate()}/${d.getMonth() + 1}`;

  const screenWidth = Dimensions.get('window').width - 64; // margins

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.label}>📈 Equity Curve</Text>
          <Text style={styles.dataPoints}>{summary.dataPoints} trades</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.totalPnl, isPositive ? styles.textGreen : styles.textRed]}>
            {isPositive ? '+' : ''}{summary.totalPnl.toFixed(2)}%
          </Text>
          <Text style={styles.drawdown}>
            Max DD: {summary.maxDrawdown.toFixed(1)}%
          </Text>
        </View>
      </View>

      <LineChart
        data={{
          labels: [formatDate(firstDate), '', '', '', formatDate(lastDate)],
          datasets: [
            {
              data: normalizedData.length > 0 ? normalizedData : [0],
              color: () => isPositive ? '#4ade80' : '#f87171',
              strokeWidth: 2,
            },
          ],
        }}
        width={screenWidth}
        height={100}
        withDots={false}
        withInnerLines={false}
        withOuterLines={false}
        withVerticalLabels={true}
        withHorizontalLabels={false}
        fromZero={false}
        chartConfig={{
          backgroundColor: 'transparent',
          backgroundGradientFrom: '#1a1a2e',
          backgroundGradientTo: '#1a1a2e',
          decimalPlaces: 0,
          color: (opacity = 1) => isPositive
            ? `rgba(74, 222, 128, ${opacity})`
            : `rgba(248, 113, 113, ${opacity})`,
          labelColor: () => '#666',
          propsForDots: {
            r: '0',
          },
          propsForBackgroundLines: {
            strokeDasharray: '',
            stroke: '#2a2a4e',
            strokeWidth: 0.5,
          },
        }}
        bezier
        style={styles.chart}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerLeft: {
    gap: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  label: {
    color: '#888',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dataPoints: {
    color: '#555',
    fontSize: 10,
  },
  totalPnl: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  drawdown: {
    color: '#888',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  chart: {
    marginLeft: -20,
    marginTop: -10,
    marginBottom: -15,
  },
  textGreen: { color: '#4ade80' },
  textRed: { color: '#f87171' },
});
