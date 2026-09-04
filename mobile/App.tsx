// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — React Native App Entry Point (with Auth + Biometric)
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useAuth } from './src/hooks/useAuth';
import { useBiometric } from './src/hooks/useBiometric';
import { i18n } from './src/i18n';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { CoinDetailScreen } from './src/screens/CoinDetailScreen';
import { TradeHistoryScreen } from './src/screens/TradeHistoryScreen';
import { TradeDetailScreen } from './src/screens/TradeDetailScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { SubscriptionScreen } from './src/screens/SubscriptionScreen';
import { CustomIndicatorScreen } from './src/screens/CustomIndicatorScreen';
import { BacktestScreen } from './src/screens/BacktestScreen';
import AlertSettingsScreen from './src/screens/AlertSettingsScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { LoadingSpinner } from './src/components/LoadingSpinner';

const AuthStack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator();

// ─── Auth Navigator ─────────────────────────────────────────────
function AuthNavigator() {
  const auth = useAuth();
  const biometric = useBiometric();
  const [screen, setScreen] = useState<'login' | 'register'>('login');

  const handleBiometricLogin = useCallback(async (): Promise<boolean> => {
    // Authenticate with biometric
    const authenticated = await biometric.authenticate();
    if (!authenticated) return false;

    // Get stored credentials
    const credentials = await biometric.getCredentials();
    if (!credentials) {
      return false;
    }

    // Login with stored credentials
    return auth.login(credentials.email, credentials.password);
  }, [biometric, auth]);

  if (screen === 'register') {
    return (
      <RegisterScreen
        onRegister={auth.register}
        onGoToLogin={() => { setScreen('login'); auth.clearError(); }}
        error={auth.error}
        loading={auth.loading}
        clearError={auth.clearError}
      />
    );
  }

  return (
    <LoginScreen
      onLogin={auth.login}
      onGoToRegister={() => { setScreen('register'); auth.clearError(); }}
      error={auth.error}
      loading={auth.loading}
      clearError={auth.clearError}
      biometricAvailable={biometric.isAvailable}
      biometricType={biometric.biometricType}
      biometricEnabled={biometric.isEnabled && biometric.hasCredentials}
      onBiometricLogin={handleBiometricLogin}
    />
  );
}

// ─── Main Navigator ─────────────────────────────────────────────
function MainNavigator() {
  return (
    <MainStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1a1a2e' },
        headerTintColor: '#e94560',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <MainStack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: '🪙 El Oráculo' }}
      />
      <MainStack.Screen
        name="CoinDetail"
        component={CoinDetailScreen}
        options={({ route }: any) => ({ title: `🪙 ${route.params?.coin || 'Coin'}` })}
      />
      <MainStack.Screen
        name="History"
        component={TradeHistoryScreen}
        options={{ title: '📊 Trade History' }}
      />
      <MainStack.Screen
        name="TradeDetail"
        component={TradeDetailScreen}
        options={{ title: '📋 Trade Detail' }}
      />
      <MainStack.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ title: '📈 Analytics' }}
      />
      <MainStack.Screen
        name="CustomIndicators"
        component={CustomIndicatorScreen}
        options={{ title: '📊 Custom Indicators' }}
      />
      <MainStack.Screen
        name="Backtest"
        component={BacktestScreen}
        options={{ title: '🔬 Backtesting' }}
      />
      <MainStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: '🔔 Notifications' }}
      />
      <MainStack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{ title: '💎 Subscription' }}
      />
      <MainStack.Screen
        name="AlertSettings"
        component={AlertSettingsScreen}
        options={{ title: '🔔 Alert Settings' }}
      />
      <MainStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: '⚙️ Settings' }}
      />
    </MainStack.Navigator>
  );
}

// ─── Root App ───────────────────────────────────────────────────
export default function App() {
  const { isAuthenticated, loading } = useAuth();

  // Initialize i18n on mount
  useEffect(() => {
    i18n.init();
  }, []);

  // ─── Notification Handler (foreground) ────────────────────────
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }, []);

  // ─── Loading State ───────────────────────────────────────────
  if (loading) {
    return (
      <NavigationContainer>
        <StatusBar style="light" />
        <LoadingSpinner message="Loading El Oráculo..." fullScreen />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
