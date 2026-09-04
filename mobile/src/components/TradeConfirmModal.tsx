// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Trade Confirmation Modal
// ═══════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';

interface TradeConfirmModalProps {
  visible: boolean;
  action: 'BUY' | 'SELL';
  coin: string;
  currentPrice: number;
  entryPrice?: number;
  montoEntrada?: number;
  pnlPct?: number;
  pnlUsd?: number;
  onConfirm: (amountUsdt?: number) => Promise<void>;
  onCancel: () => void;
}

export function TradeConfirmModal({
  visible,
  action,
  coin,
  currentPrice,
  entryPrice,
  montoEntrada,
  pnlPct,
  pnlUsd,
  onConfirm,
  onCancel,
}: TradeConfirmModalProps) {
  const [amount, setAmount] = useState('50');
  const [loading, setLoading] = useState(false);

  const isBuy = action === 'BUY';
  const amountNum = parseFloat(amount) || 0;
  const estimatedQty = currentPrice > 0 ? amountNum / currentPrice : 0;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (isBuy) {
        await onConfirm(amountNum);
      } else {
        await onConfirm();
      }
    } finally {
      setLoading(false);
      setAmount('50');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={[styles.header, isBuy ? styles.headerBuy : styles.headerSell]}>
            <Text style={styles.headerIcon}>{isBuy ? '🟢' : '🔴'}</Text>
            <Text style={styles.headerTitle}>{isBuy ? 'BUY' : 'SELL'} {coin}</Text>
          </View>

          {/* Current Price */}
          <View style={styles.priceSection}>
            <Text style={styles.priceLabel}>Current Price</Text>
            <Text style={styles.priceValue}>${currentPrice.toFixed(4)}</Text>
          </View>

          {/* Position Info (for SELL) */}
          {!isBuy && entryPrice && entryPrice > 0 && (
            <View style={styles.positionInfo}>
              <View style={styles.positionRow}>
                <Text style={styles.positionLabel}>Entry Price</Text>
                <Text style={styles.positionValue}>${entryPrice.toFixed(4)}</Text>
              </View>
              <View style={styles.positionRow}>
                <Text style={styles.positionLabel}>Position Size</Text>
                <Text style={styles.positionValue}>${montoEntrada?.toFixed(2) || '—'}</Text>
              </View>
              {pnlPct !== undefined && (
                <View style={styles.positionRow}>
                  <Text style={styles.positionLabel}>Current PnL</Text>
                  <Text style={[styles.positionValue, pnlPct >= 0 ? styles.textGreen : styles.textRed]}>
                    {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}% (${Math.abs(pnlUsd || 0).toFixed(2)})
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Amount Input (for BUY) */}
          {isBuy && (
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Amount (USDT)</Text>
              <View style={styles.inputRow}>
                <TouchableOpacity
                  style={styles.amountButton}
                  onPress={() => setAmount(String(Math.max(10, amountNum - 10)))}
                >
                  <Text style={styles.amountButtonText}>-10</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="50"
                  placeholderTextColor="#666"
                />
                <TouchableOpacity
                  style={styles.amountButton}
                  onPress={() => setAmount(String(amountNum + 10))}
                >
                  <Text style={styles.amountButtonText}>+10</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.inputHint}>
                ≈ {estimatedQty.toFixed(8)} {coin}
              </Text>

              {/* Quick Amount Buttons */}
              <View style={styles.quickAmounts}>
                {[25, 50, 100, 200].map((q) => (
                  <TouchableOpacity
                    key={q}
                    style={[styles.quickButton, amountNum === q && styles.quickButtonActive]}
                    onPress={() => setAmount(String(q))}
                  >
                    <Text style={[styles.quickButtonText, amountNum === q && styles.quickButtonTextActive]}>
                      ${q}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Warning */}
          <View style={styles.warning}>
            <Text style={styles.warningText}>
              {isBuy
                ? '⚠️ This will place a market buy order on Binance'
                : '⚠️ This will sell your entire position at market price'}
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={loading}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, isBuy ? styles.confirmBuy : styles.confirmSell]}
              onPress={handleConfirm}
              disabled={loading || (isBuy && amountNum < 10)}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>
                  {isBuy ? `Buy $${amountNum}` : `Sell All`}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    width: '100%',
    maxWidth: 380,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  headerBuy: {
    backgroundColor: '#4ade8015',
  },
  headerSell: {
    backgroundColor: '#f8717115',
  },
  headerIcon: { fontSize: 28 },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  priceSection: {
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  priceLabel: {
    color: '#888',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  priceValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginTop: 4,
  },
  positionInfo: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
    gap: 8,
  },
  positionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  positionLabel: {
    color: '#888',
    fontSize: 13,
  },
  positionValue: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  inputSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  inputLabel: {
    color: '#888',
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amountButton: {
    backgroundColor: '#2a2a4e',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  amountButtonText: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    backgroundColor: '#0f0f23',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 18,
    fontFamily: 'monospace',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  inputHint: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  quickButton: {
    backgroundColor: '#2a2a4e',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  quickButtonActive: {
    backgroundColor: '#4ade8030',
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  quickButtonText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  quickButtonTextActive: {
    color: '#4ade80',
  },
  warning: {
    padding: 12,
    backgroundColor: '#f59e0b10',
  },
  warningText: {
    color: '#f59e0b',
    fontSize: 11,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#2a2a4e',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBuy: {
    backgroundColor: '#4ade80',
  },
  confirmSell: {
    backgroundColor: '#f87171',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  textGreen: { color: '#4ade80' },
  textRed: { color: '#f87171' },
});
