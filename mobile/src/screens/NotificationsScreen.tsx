// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Notifications Screen
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { apiService } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string;
  coin?: string;
  action?: string;
  price?: number;
  pnl?: string;
  sentVia: string;
  sentCount: number;
  errorCount: number;
  timestamp: string;
}

const TYPE_FILTERS = ['all', 'trade', 'alert', 'daily_report'] as const;

export function NotificationsScreen({ navigation }: any) {
  const { hasPermission, requestPermission, sendTestNotification } = useNotifications();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [activeTokenCount, setActiveTokenCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await apiService.getNotificationHistory(100);
      setNotifications(Array.isArray(data) ? data : []);
      setError(null);

      const tokenCount = await apiService.getActiveTokenCount();
      setActiveTokenCount(tokenCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const handleSendTest = async () => {
    try {
      await sendTestNotification();
      Alert.alert('✅ Test Sent', 'Check your device for the notification');
    } catch (err) {
      Alert.alert('❌ Error', 'Failed to send test notification');
    }
  };

  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    if (!granted) {
      Alert.alert(
        '⚠️ Permission Required',
        'Enable push notifications in your device settings to receive trade alerts.'
      );
    }
  };

  // Filter notifications
  const filteredNotifications = activeFilter === 'all'
    ? notifications
    : notifications.filter((n) => n.type === activeFilter);

  const getNotificationIcon = (type: string, action?: string) => {
    if (type === 'trade') {
      return action === 'COMPRAR' ? '🟢' : action === 'VENDER' ? '🔴' : '⏳';
    }
    if (type === 'alert') return '⚠️';
    if (type === 'daily_report') return '📊';
    if (type === 'test') return '🧪';
    return 'ℹ️';
  };

  const renderNotification = ({ item }: { item: NotificationItem }) => {
    const icon = getNotificationIcon(item.type, item.action);
    const hasError = item.errorCount > 0;

    return (
      <View style={[styles.notifCard, hasError && styles.notifCardError]}>
        <View style={styles.notifHeader}>
          <View style={styles.notifHeaderLeft}>
            <Text style={styles.notifIcon}>{icon}</Text>
            <View style={styles.notifTitleContainer}>
              <Text style={styles.notifTitle} numberOfLines={1}>{item.title}</Text>
              {item.coin && (
                <Text style={styles.notifCoin}>{item.coin}</Text>
              )}
            </View>
          </View>
          <Text style={styles.notifTime}>
            {new Date(item.timestamp).toLocaleDateString()} {' '}
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>

        <View style={styles.notifFooter}>
          <Text style={styles.notifType}>{item.type}</Text>
          <Text style={[styles.notifSent, hasError && styles.notifSentError]}>
            {hasError ? `⚠️ ${item.errorCount} failed` : `✅ ${item.sentCount} sent`}
          </Text>
          {item.price && (
            <Text style={styles.notifPrice}>${item.price.toFixed(4)}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Permission Banner */}
      {!hasPermission && (
        <View style={styles.permissionBanner}>
          <Text style={styles.permissionText}>
            📱 Enable push notifications to receive trade alerts
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={handleRequestPermission}>
            <Text style={styles.permissionButtonText}>Enable</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Stats Header */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{notifications.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{activeTokenCount}</Text>
          <Text style={styles.statLabel}>Devices</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{notifications.filter((n) => n.type === 'trade').length}</Text>
          <Text style={styles.statLabel}>Trades</Text>
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {TYPE_FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>
              {filter === 'all' ? 'ALL' : filter === 'daily_report' ? 'Reports' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Test Button */}
      <TouchableOpacity style={styles.testButton} onPress={handleSendTest}>
        <Text style={styles.testButtonText}>🧪 Send Test Notification</Text>
      </TouchableOpacity>

      {/* Notification List */}
      {loading ? (
        <LoadingSpinner message="Loading notifications..." />
      ) : error ? (
        <EmptyState icon="❌" title="Error" message={error} />
      ) : filteredNotifications.length === 0 ? (
        <EmptyState
          icon="🔔"
          title="No notifications yet"
          message="Trade alerts and bot notifications will appear here."
        />
      ) : (
        <FlatList
          data={filteredNotifications}
          renderItem={renderNotification}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" colors={['#e94560']} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },

  // Permission
  permissionBanner: {
    backgroundColor: '#e9456020',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e9456040',
  },
  permissionText: { color: '#ccc', fontSize: 12, flex: 1, marginRight: 8 },
  permissionButton: {
    backgroundColor: '#e94560',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  permissionButtonText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  statLabel: { color: '#666', fontSize: 11, textTransform: 'uppercase', marginTop: 4 },
  statDivider: { width: 1, height: 30, backgroundColor: '#2a2a4e' },

  // Filter
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  filterChipActive: {
    backgroundColor: '#e9456020',
    borderColor: '#e94560',
  },
  filterText: { color: '#888', fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#e94560' },

  // Test
  testButton: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#1a1a2e',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  testButtonText: { color: '#e94560', fontSize: 13, fontWeight: '600' },

  // List
  listContent: { padding: 16, paddingTop: 8 },

  // Notification Card
  notifCard: {
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  notifCardError: {
    borderColor: '#f8717140',
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  notifHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  notifIcon: { fontSize: 20 },
  notifTitleContainer: { flex: 1 },
  notifTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  notifCoin: { color: '#e94560', fontSize: 11, fontWeight: '600', marginTop: 2 },
  notifTime: { color: '#666', fontSize: 10, marginLeft: 8 },
  notifBody: { color: '#aaa', fontSize: 12, marginTop: 8, lineHeight: 18 },
  notifFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4e',
  },
  notifType: { color: '#666', fontSize: 10, textTransform: 'uppercase' },
  notifSent: { color: '#4ade80', fontSize: 10 },
  notifSentError: { color: '#f87171' },
  notifPrice: { color: '#ccc', fontSize: 11, fontFamily: 'monospace' },
});
