// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — IndicatorGauge Component (RSI/ADX Bar)
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface IndicatorGaugeProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  zones?: Array<{ from: number; to: number; color: string; label?: string } };
  markers?: Array<{ value: number; color: string; label?: string } };
  format?: (v: number) => string;
}

const DEFAULT_RSI_ZONES = [
  { from: 0, to: 30, color: '#4ade80', label: 'Oversold' },
  { from: 30, to: 40, color: '#a78bfa' },
  { from: 40, to: 60, color: '#888' },
  { from: 60, to: 70, color: '#fbbf24' },
  { from: 70, to: 100, color: '#f87171', label: 'Overbought' },
];

const DEFAULT_ADX_ZONES = [
  { from: 0, to: 20, color: '#888', label: 'Weak' },
  { from: 20, to: 25, color: '#fbbf24' },
  { from: 25, to: 50, color: '#4ade80', label: 'Strong' },
  { from: 50, to: 100, color: '#a78bfa', label: 'Very Strong' },
];

export function IndicatorGauge({
  label,
  value,
  min = 0,
  max = 100,
  zones,
  markers,
  format,
}: IndicatorGaugeProps) {
  const displayValue = format ? format(value) : value.toFixed(1);
  const ratio = Math.max(0, Math.min((value - min) / (max - min), 1));

  // Find current zone color
  const activeZones = zones || (label.includes('RSI') ? DEFAULT_RSI_ZONES : DEFAULT_ADX_ZONES);
  const activeZone = activeZones.find((z) => value >= z.from && value < z.to) || activeZones[activeZones.length - 1];
  const color = activeZone?.color || '#888';

  return (
    <View style={styles.container}>
      {/* Label + Value */}
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color }]}>{displayValue}</Text>
      </View>

      {/* Bar */}
      <View style={styles.barContainer}>
        {/* Zone backgrounds */}
        <View style={styles.bar}>
          {activeZones.map((zone, i) => {
            const zoneWidth = ((zone.to - zone.from) / (max - min)) * 100;
            const zoneStart = ((zone.from - min) / (max - min)) * 100;
            return (
              <View
                key={i}
                style={[
                  styles.zone,
                  {
                    left: `${zoneStart}%`,
                    width: `${zoneWidth}%`,
                    backgroundColor: zone.color + '30',
                  },
                ]}
              />
            );
          })}

          {/* Filled portion */}
          <View
            style={[
              styles.filled,
              {
                width: `${ratio * 100}%`,
                backgroundColor: color,
              },
            ]}
          />

          {/* Marker lines */}
          {markers?.map((marker, i) => {
            const markerRatio = (marker.value - min) / (max - min);
            return (
              <View
                key={i}
                style={[
                  styles.marker,
                  { left: `${markerRatio * 100}%`, backgroundColor: marker.color },
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* Zone label */}
      {activeZone?.label && (
        <Text style={[styles.zoneLabel, { color }]}>{activeZone.label}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  barContainer: {
    position: 'relative',
  },
  bar: {
    height: 8,
    backgroundColor: '#1e1e3a',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  zone: {
    position: 'absolute',
    top: 0,
    height: '100%',
  },
  filled: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 4,
  },
  marker: {
    position: 'absolute',
    top: -2,
    width: 2,
    height: 12,
    borderRadius: 1,
    zIndex: 10,
  },
  zoneLabel: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
  },
});
