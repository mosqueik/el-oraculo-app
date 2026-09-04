// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Emergency Stop Button Component
// ═══════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { apiService } from '../services/api';
import { CoinSymbol } from '../shared';

interface EmergencyStopButtonProps {
  coin: CoinSymbol;
  hasPosition: boolean;
  onSuccess?: () => void;
}

export function EmergencyStopButton({ coin, hasPosition, onSuccess }: EmergencyStopButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!hasPosition) return null;

  const handleEmergencySell = async () => {
    setShowConfirm(false);
    setLoading(true);

    try {
      const result = await apiService.emergencySell(coin);

      if (result.success) {
        Alert.alert(
          '🚨 Emergency Sell Executed',
          `${coin} sold at $${result.data.price.toFixed(4)}\nPnL: ${result.data.pnl}`,
          [{ text: 'OK' }]
        );
        onSuccess?.();
      } else {
        Alert.alert('Error', result.error || 'Emergency sell failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to execute emergency sell');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={() => setShowConfirm(true)}
        disabled={loading}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.buttonText}>🚨 EMERGENCY SELL</Text>
        )}
      </TouchableOpacity>

      <Modal
        visible={showConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🚨 EMERGENCY SELL</Text>
            <Text style={styles.modalText}>
              You are about to immediately sell your {coin} position at market price.
            </Text>
            <Text style={styles.modalWarning}>
              This action cannot be undone.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowConfirm(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleEmergencySell}
              >
                <Text style={styles.confirmButtonText}>SELL NOW</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#991b1b',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    borderWidth: 2,
    borderColor: '#dc2626',
  },
  modalTitle: {
    color: '#dc2626',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalText: {
    color: '#ccc',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  modalWarning: {
    color: '#fbbf24',
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#2a2a4e',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
