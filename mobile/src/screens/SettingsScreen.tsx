// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Settings Screen
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert,
} from 'react-native';
import { useBotStatusStore, useConnectionStore } from '../store';
import { useAuth } from '../hooks/useAuth';
import { useBiometric } from '../hooks/useBiometric';
import { useTranslation } from '../hooks/useTranslation';
import { apiService } from '../services/api';

export function SettingsScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const biometric = useBiometric();
  const { t, locale, toggleLocale } = useTranslation();
  const { running, cycleCount, uptime, fetchStatus } = useBotStatusStore();
  const { connected } = useConnectionStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleToggleBot = async () => {
    try {
      if (running) {
        Alert.alert('Stop Bot', 'Are you sure you want to stop the trading bot?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Stop',
            style: 'destructive',
            onPress: async () => {
              await apiService.getStatus(); // placeholder — need POST /api/stop
              fetchStatus();
            },
          },
        ]);
      } else {
        Alert.alert('Start Bot', 'Start the trading bot?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start',
            onPress: async () => {
              await apiService.getStatus(); // placeholder — need POST /api/start
              fetchStatus();
            },
          },
        ]);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to toggle bot');
    }
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <ScrollView style={styles.container}>
      {/* Connection Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>API Status</Text>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, connected ? styles.dotConnected : styles.dotDisconnected]} />
            <Text style={[styles.statusText, connected ? styles.textGreen : styles.textRed]}>
              {connected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
        </View>
      </View>

      {/* Bot Control */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bot Control</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Bot Status</Text>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, running ? styles.dotRunning : styles.dotStopped]} />
            <Text style={[styles.statusText, running ? styles.textGreen : styles.textRed]}>
              {running ? 'Running' : 'Stopped'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.toggleButton, running ? styles.stopButton : styles.startButton]}
          onPress={handleToggleBot}
        >
          <Text style={styles.toggleButtonText}>
            {running ? '⏹ Stop Bot' : '▶️ Start Bot'}
          </Text>
        </TouchableOpacity>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Cycles Completed</Text>
          <Text style={styles.settingValue}>{cycleCount}</Text>
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Uptime</Text>
          <Text style={styles.settingValue}>{formatUptime(uptime)}</Text>
        </View>
      </View>

      {/* Language */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🌐 Language</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>App Language</Text>
          <TouchableOpacity
            style={styles.languageToggle}
            onPress={toggleLocale}
          >
            <Text style={[styles.langOption, locale === 'en' && styles.langActive]}>EN</Text>
            <Text style={[styles.langOption, locale === 'es' && styles.langActive]}>ES</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Push Notifications</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#333', true: '#e9456040' }}
            thumbColor={notificationsEnabled ? '#e94560' : '#666'}
          />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Auto Refresh</Text>
          <Switch
            value={autoRefreshEnabled}
            onValueChange={setAutoRefreshEnabled}
            trackColor={{ false: '#333', true: '#e9456040' }}
            thumbColor={autoRefreshEnabled ? '#e94560' : '#666'}
          />
        </View>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => navigation.navigate('AlertSettings')}
        >
          <Text style={styles.settingLabel}>🔔 Alert Settings</Text>
          <Text style={styles.settingValue}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Biometric Security */}
      {biometric.isAvailable && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔐 Security</Text>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Biometric Login</Text>
              <Text style={styles.settingSublabel}>
                {biometric.biometricType === 'facial-recognition' ? 'Face ID' : 
                 biometric.biometricType === 'fingerprint' ? 'Fingerprint' : 'Biometric'}
              </Text>
            </View>
            <Switch
              value={biometric.isEnabled && biometric.hasCredentials}
              onValueChange={biometric.isEnabled ? () => biometric.disable() : () => biometric.enable()}
              trackColor={{ false: '#333', true: '#4ade8040' }}
              thumbColor={biometric.isEnabled ? '#4ade80' : '#666'}
            />
          </View>
          {biometric.isEnabled && biometric.hasCredentials && (
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Status</Text>
              <Text style={[styles.settingValue, styles.textGreen]}>✓ Enabled</Text>
            </View>
          )}
        </View>
      )}

      {/* Account */}
      {user && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Email</Text>
            <Text style={styles.settingValue}>{user.email}</Text>
          </View>
          {user.name && (
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Name</Text>
              <Text style={styles.settingValue}>{user.name}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => (navigation as any).navigate('Subscription')}
          >
            <Text style={styles.settingLabel}>Plan</Text>
            <Text style={[styles.settingValue, styles.textGreen]}>{user.plan.toUpperCase()} → ✨</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutText}>🚪 Sign Out</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Custom Indicators (Enterprise) */}
      {(user?.plan === 'enterprise' || user?.plan === 'pro') && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Custom Indicators</Text>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => navigation.navigate('CustomIndicators')}
          >
            <Text style={styles.settingLabel}>Indicator Builder</Text>
            <Text style={styles.settingValue}>→</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Version</Text>
          <Text style={styles.settingValue}>1.0.0</Text>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Engine</Text>
          <Text style={styles.settingValue}>El Oráculo</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>🪙 El Oráculo Trading Bot</Text>
        <Text style={styles.footerSubText}>Node.js + React Native</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  section: {
    backgroundColor: '#1a1a2e',
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  settingLabel: { color: '#ccc', fontSize: 15 },
  settingSublabel: { color: '#666', fontSize: 11, marginTop: 2 },
  settingValue: { color: '#888', fontSize: 14, fontFamily: 'monospace' },
  languageToggle: {
    flexDirection: 'row',
    backgroundColor: '#0f0f23',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a4e',
    overflow: 'hidden',
  },
  langOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  langActive: {
    backgroundColor: '#e94560',
    color: '#fff',
  },
  statusContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotConnected: { backgroundColor: '#4ade80' },
  dotDisconnected: { backgroundColor: '#f87171' },
  dotRunning: { backgroundColor: '#4ade80' },
  dotStopped: { backgroundColor: '#888' },
  statusText: { fontSize: 13, fontWeight: '600' },
  textGreen: { color: '#4ade80' },
  textRed: { color: '#f87171' },
  toggleButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  startButton: { backgroundColor: '#4ade8020', borderWidth: 1, borderColor: '#4ade8040' },
  stopButton: { backgroundColor: '#f8717120', borderWidth: 1, borderColor: '#f8717140' },
  toggleButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  logoutButton: {
    backgroundColor: '#f8717120',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#f8717140',
  },
  logoutText: {
    color: '#f87171',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  footerText: { color: '#555', fontSize: 14 },
  footerSubText: { color: '#333', fontSize: 12, marginTop: 4 },
});
