// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — ScoreGauge Component (Circular Gauge)
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ScoreGaugeProps {
  score: number;
  threshold: number;
  maxScore?: number;
  size?: number;
  label?: string;
}

export function ScoreGauge({
  score,
  threshold,
  maxScore = 8,
  size = 120,
  label = 'Score',
}: ScoreGaugeProps) {
  const ratio = Math.min(score / maxScore, 1);
  const thresholdRatio = Math.min(threshold / maxScore, 1);
  const isReady = score >= threshold;

  // Color based on score vs threshold
  const getColor = () => {
    if (isReady) return '#4ade80';
    if (ratio >= thresholdRatio * 0.7) return '#fbbf24';
    return '#f87171';
  };

  const color = getColor();
  const halfSize = size / 2;
  const lineWidth = 8;
  const radius = halfSize - lineWidth;

  // Generate arc segments (simplified as colored segments)
  const totalSegments = 40;
  const filledSegments = Math.round(ratio * totalSegments);
  const thresholdSegment = Math.round(thresholdRatio * totalSegments);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Background ring segments */}
      <View style={[styles.gaugeOuter, { width: size, height: size, borderRadius: halfSize }]}>
        {Array.from({ length: totalSegments }).map((_, i) => {
          const angle = (i / totalSegments) * 360 - 90;
          const rad = (angle * Math.PI) / 180;
          const x = halfSize + radius * Math.cos(rad) - lineWidth / 2;
          const y = halfSize + radius * Math.sin(rad) - lineWidth / 2;

          const isFilled = i < filledSegments;
          const isThreshold = i === thresholdSegment - 1;

          let segmentColor = '#1e1e3a';
          if (isFilled) segmentColor = color;
          if (isThreshold) segmentColor = '#fff';

          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: lineWidth,
                height: lineWidth,
                borderRadius: lineWidth / 2,
                backgroundColor: segmentColor,
              }}
            />
          );
        })}
      </View>

      {/* Center text */}
      <View style={styles.centerContainer}>
        <Text style={[styles.scoreValue, { color }]}>{score}</Text>
        <Text style={styles.scoreDivider}>/ {threshold}</Text>
        <Text style={[styles.scoreLabel, isReady && styles.scoreLabelReady]}>
          {isReady ? '✓ READY' : label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeOuter: {
    position: 'absolute',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  scoreDivider: {
    color: '#666',
    fontSize: 14,
    marginTop: -4,
  },
  scoreLabel: {
    color: '#888',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  scoreLabelReady: {
    color: '#4ade80',
    fontWeight: 'bold',
  },
});
