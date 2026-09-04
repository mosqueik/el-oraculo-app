// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Alert Settings Screen
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert as RNAlert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useTranslation } from '../hooks/useTranslation';
import { api } from '../services/api';
import { Ionicons } from '@expo/vector-icons';

const COINS = ['BTC', 'ETH', 'SOL', 'BNB', 'AVAX', 'POL', 'SUI', 'LINK', 'NEAR', 'DOGE'];

const ALERT_TYPES = [
  { key: 'profit_pct', label: '🟢 Profit %', description: 'Notify when profit reaches X%' },
  { key: 'loss_pct', label: '🔴 Loss %', description: 'Notify when loss reaches X%' },
  { key: 'profit_usdt', label: '🟢 Profit USDT', description: 'Notify when profit reaches $X' },
  { key: 'loss_usdt', label: '🔴 Loss USDT', description: 'Notify when loss reaches $X' },
  { key: 'price_above', label: '📈 Price Above', description: 'Notify when price goes above $X' },
  { key: 'price_below', label: '📉 Price Below', description: 'Notify when price drops below $X' },
];

interface AlertConfig {
  id: number;
  coin: string;
  alertType: string;
  threshold: number;
  enabled: boolean;
  triggered: boolean;
  cooldownMinutes: number;
  lastTriggeredAt?: string;
}

interface AlertHistory {
  id: number;
  coin: string;
  alertType: string;
  threshold: number;
  currentValue: number;
  message: string;
  timestamp: string;
}

export default function AlertSettingsScreen() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<AlertConfig[]>([]);
  const [history, setHistory] = useState<AlertHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'config' | 'history'>('config');

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCoin, setNewCoin] = useState('BTC');
  const [showCoinPicker, setShowCoinPicker] = useState(false);
  const [newAlertType, setNewAlertType] = useState('profit_pct');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [newThreshold, setNewThreshold] = useState('');
  const [newCooldown, setNewCooldown] = useState('60');
  const [creating, setCreating] = useState(false);

  const loadAlerts = useCallback(async () => {
    try {
      const response = await api.getAlerts();
      setAlerts(response.data || []);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const response = await api.getAlertHistory();
      setHistory(response.data || []);
    } catch (error) {
      console.error('Failed to load alert history:', error);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadAlerts(), loadHistory()]).then(() => setLoading(false));
  }, [loadAlerts, loadHistory]);

  const handleToggle = async (alert: AlertConfig) => {
    try {
      await api.updateAlert(alert.id, { enabled: !alert.enabled });
      setAlerts(prev =>
        prev.map(a => (a.id === alert.id ? { ...a, enabled: !a.enabled } : a))
      );
    } catch (error) {
      console.error('Failed to toggle alert:', error);
    }
  };

  const handleDelete = (alert: AlertConfig) => {
    RNAlert.alert(
      'Delete Alert',
      `Delete ${alert.coin} ${alert.alertType} alert?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteAlert(alert.id);
              setAlerts(prev => prev.filter(a => a.id !== alert.id));
            } catch (error) {
              console.error('Failed to delete alert:', error);
            }
          },
        },
      ]
    );
  };

  const handleCreate = async () => {
    if (!newThreshold || isNaN(parseFloat(newThreshold))) {
      RNAlert.alert('Error', 'Please enter a valid threshold value');
      return;
    }

    setCreating(true);
    try {
      const response = await api.createAlert({
        coin: newCoin,
        alertType: newAlertType,
        threshold: parseFloat(newThreshold),
        cooldownMinutes: parseInt(newCooldown) || 60,
      });
      setAlerts(prev => [...prev, response.data]);
      setShowCreateModal(false);
      setNewThreshold('');
      setNewCooldown('60');
    } catch (error) {
      console.error('Failed to create alert:', error);
      RNAlert.alert('Error', 'Failed to create alert');
    } finally {
      setCreating(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'profit_pct':
      case 'profit_usdt':
        return '🟢';
      case 'loss_pct':
      case 'loss_usdt':
        return '🔴';
      case 'price_above':
        return '📈';
      case 'price_below':
        return '📉';
      default:
        return '🔔';
    }
  };

  const getAlertTypeLabel = (type: string) => {
    return ALERT_TYPES.find(a => a.key === type)?.label || type;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00C9A7" />
        <Text style={styles.loadingText}>Loading alerts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Header */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === 'config' && styles.activeTab]}
          onPress={() => setTab('config')}
        >
          <Text style={[styles.tabText, tab === 'config' && styles.activeTabText]}>
            ⚙️ Config ({alerts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'history' && styles.activeTab]}
          onPress={() => setTab('history')}
        >
          <Text style={[styles.tabText, tab === 'history' && styles.activeTabText]}>
            📋 History ({history.length})
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'config' ? (
        <ScrollView style={styles.scrollContainer}>
          {/* Quick Presets */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚡ Quick Presets</Text>
            <View style={styles.presetsRow}>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => {
                  setNewAlertType('loss_usdt');
                  setNewThreshold('5');
                  setShowCreateModal(true);
                }}
              >
                <Text style={styles.presetText}>🔴 Stop Loss $5</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => {
                  setNewAlertType('profit_usdt');
                  setNewThreshold('20');
                  setShowCreateModal(true);
                }}
              >
                <Text style={styles.presetText}>🟢 Take Profit $20</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.presetsRow}>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => {
                  setNewAlertType('loss_pct');
                  setNewThreshold('3');
                  setShowCreateModal(true);
                }}
              >
                <Text style={styles.presetText}>🔴 -3% Alert</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => {
                  setNewAlertType('profit_pct');
                  setNewThreshold('5');
                  setShowCreateModal(true);
                }}
              >
                <Text style={styles.presetText}>🟢 +5% Alert</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Active Alerts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔔 Active Alerts</Text>
            {alerts.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No alerts configured</Text>
                <Text style={styles.emptySubtext}>Create one below or use a quick preset</Text>
              </View>
            ) : (
              alerts.map((alert) => (
                <View
                  key={alert.id}
                  style={[styles.alertCard, !alert.enabled && styles.alertCardDisabled]}
                >
                  <View style={styles.alertHeader}>
                    <Text style={styles.alertCoin}>{getAlertIcon(alert.alertType)} {alert.coin}</Text>
                    <Switch
                      value={alert.enabled}
                      onValueChange={() => handleToggle(alert)}
                      trackColor={{ false: '#333', true: '#00C9A7' }}
                      thumbColor={alert.enabled ? '#fff' : '#666'}
                    />
                  </View>
                  <Text style={styles.alertType}>{getAlertTypeLabel(alert.alertType)}</Text>
                  <Text style={styles.alertThreshold}>
                    Threshold: {alert.alertType.includes('usdt') ? '$' : ''}{alert.threshold}
                    {alert.alertType.includes('pct') ? '%' : ''}
                  </Text>
                  <View style={styles.alertFooter}>
                    <Text style={styles.alertCooldown}>
                      ⏱ Cooldown: {alert.cooldownMinutes}min
                    </Text>
                    {alert.triggered && (
                      <Text style={styles.triggeredBadge}>⚡ TRIGGERED</Text>
                    )}
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(alert)}
                    >
                      <Text style={styles.deleteBtnText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Create Button */}
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.createBtnText}>+ Create Custom Alert</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        /* History Tab */
        <ScrollView style={styles.scrollContainer}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 Recent Triggers</Text>
            {history.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No alerts triggered yet</Text>
              </View>
            ) : (
              history.map((h) => (
                <View key={h.id} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyCoin}>
                      {getAlertIcon(h.alertType)} {h.coin}
                    </Text>
                    <Text style={styles.historyTime}>{formatTime(h.timestamp)}</Text>
                  </View>
                  <Text style={styles.historyMessage}>{h.message}</Text>
                  <View style={styles.historyFooter}>
                    <Text style={styles.historyValue}>
                      Value: {h.alertType.includes('usdt') ? '$' : ''}{h.currentValue.toFixed(2)}
                      {h.alertType.includes('pct') ? '%' : ''}
                    </Text>
                    <Text style={styles.historyThreshold}>
                      Threshold: {h.alertType.includes('usdt') ? '$' : ''}{h.threshold}
                      {h.alertType.includes('pct') ? '%' : ''}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Create Alert Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🔔 New Alert</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Coin Picker */}
            <Text style={styles.fieldLabel}>Coin</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowCoinPicker(true)}
            >
              <Text style={styles.pickerText}>{newCoin}</Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>

            {/* Alert Type Picker */}
            <Text style={styles.fieldLabel}>Alert Type</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowTypePicker(true)}
            >
              <Text style={styles.pickerText}>{getAlertTypeLabel(newAlertType)}</Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>

            {/* Threshold */}
            <Text style={styles.fieldLabel}>
              Threshold ({newAlertType.includes('pct') ? '%' : 'USDT'})
            </Text>
            <TextInput
              style={styles.input}
              value={newThreshold}
              onChangeText={setNewThreshold}
              placeholder={newAlertType.includes('pct') ? 'e.g., 5.0' : 'e.g., 25.0'}
              placeholderTextColor="#666"
              keyboardType="numeric"
            />

            {/* Cooldown */}
            <Text style={styles.fieldLabel}>Cooldown (minutes)</Text>
            <TextInput
              style={styles.input}
              value={newCooldown}
              onChangeText={setNewCooldown}
              placeholder="60"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />

            {/* Create Button */}
            <TouchableOpacity
              style={[styles.createBtnModal, creating && styles.createBtnDisabled]}
              onPress={handleCreate}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createBtnTextModal}>Create Alert</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Coin Picker Modal */}
      <Modal visible={showCoinPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <Text style={styles.modalTitle}>Select Coin</Text>
            {COINS.map((coin) => (
              <TouchableOpacity
                key={coin}
                style={[styles.pickerOption, newCoin === coin && styles.pickerOptionActive]}
                onPress={() => {
                  setNewCoin(coin);
                  setShowCoinPicker(false);
                }}
              >
                <Text style={[styles.pickerOptionText, newCoin === coin && styles.pickerOptionTextActive]}>
                  {coin}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Alert Type Picker Modal */}
      <Modal visible={showTypePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <Text style={styles.modalTitle}>Select Alert Type</Text>
            {ALERT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[styles.pickerOption, newAlertType === type.key && styles.pickerOptionActive]}
                onPress={() => {
                  setNewAlertType(type.key);
                  setShowTypePicker(false);
                }}
              >
                <Text style={[styles.pickerOptionText, newAlertType === type.key && styles.pickerOptionTextActive]}>
                  {type.label}
                </Text>
                <Text style={styles.pickerOptionDesc}>{type.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    color: '#666',
    marginTop: 10,
    fontSize: 14,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#00C9A7',
  },
  tabText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#00C9A7',
  },
  scrollContainer: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  presetText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  alertCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  alertCardDisabled: {
    opacity: 0.5,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  alertCoin: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  alertType: {
    color: '#00C9A7',
    fontSize: 13,
    marginBottom: 4,
  },
  alertThreshold: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 6,
  },
  alertFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertCooldown: {
    color: '#666',
    fontSize: 12,
  },
  triggeredBadge: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#332d00',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  deleteBtn: {
    padding: 6,
  },
  deleteBtnText: {
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    color: '#666',
    fontSize: 15,
  },
  emptySubtext: {
    color: '#444',
    fontSize: 12,
    marginTop: 4,
  },
  createBtn: {
    backgroundColor: '#00C9A7',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    alignItems: 'center',
  },
  createBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  // History
  historyCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyCoin: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  historyTime: {
    color: '#666',
    fontSize: 11,
  },
  historyMessage: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 6,
  },
  historyFooter: {
    flexDirection: 'row',
    gap: 16,
  },
  historyValue: {
    color: '#00C9A7',
    fontSize: 12,
    fontWeight: '600',
  },
  historyThreshold: {
    color: '#666',
    fontSize: 12,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  modalClose: {
    color: '#666',
    fontSize: 20,
    fontWeight: '700',
  },
  fieldLabel: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
  },
  picker: {
    backgroundColor: '#0a0a0a',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  pickerText: {
    color: '#fff',
    fontSize: 14,
  },
  pickerArrow: {
    color: '#666',
    fontSize: 12,
  },
  input: {
    backgroundColor: '#0a0a0a',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#333',
  },
  createBtnModal: {
    backgroundColor: '#00C9A7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  createBtnDisabled: {
    opacity: 0.6,
  },
  createBtnTextModal: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  // Picker modals
  pickerModal: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
  },
  pickerOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  pickerOptionActive: {
    backgroundColor: '#00C9A715',
    borderRadius: 8,
  },
  pickerOptionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  pickerOptionTextActive: {
    color: '#00C9A7',
  },
  pickerOptionDesc: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
});
