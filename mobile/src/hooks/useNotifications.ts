// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — useNotifications Hook
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiService } from '../services/api';

// ─── Notification Handler Config ────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Types ──────────────────────────────────────────────────────
interface NotificationPayload {
  type: 'trade' | 'alert' | 'daily_report' | 'test';
  coin?: string;
  action?: string;
  price?: number;
  level?: string;
}

interface UseNotificationsResult {
  expoPushToken: string | null;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
  sendTestNotification: () => Promise<void>;
  lastNotification: Notifications.Notification | null;
}

/**
 * Hook for push notification management
 * Handles permissions, token registration, and incoming notifications
 */
export function useNotifications(): UseNotificationsResult {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [lastNotification, setLastNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  // ─── Register for Push Notifications ──────────────────────────
  const registerForPushNotifications = useCallback(async () => {
    if (!Device.isDevice) {
      console.warn('⚠️ Push notifications require a physical device');
      return null;
    }

    // Check existing permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('⚠️ Push notification permission not granted');
      setHasPermission(false);
      return null;
    }

    setHasPermission(true);

    // Get Expo push token
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;
      setExpoPushToken(token);

      // Register token with backend
      try {
        await apiService.registerPushToken(token, Platform.OS as 'ios' | 'android');
        console.log('✅ Push token registered with backend');
      } catch (err) {
        console.warn('⚠️ Failed to register token with backend:', err);
      }

      // Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('trades', {
          name: 'Trade Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#e94560',
        });

        await Notifications.setNotificationChannelAsync('alerts', {
          name: 'Bot Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#f87171',
        });

        await Notifications.setNotificationChannelAsync('reports', {
          name: 'Daily Reports',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250],
          lightColor: '#4ade80',
        });
      }

      return token;
    } catch (error) {
      console.error('❌ Failed to get push token:', error);
      return null;
    }
  }, []);

  // ─── Request Permission ───────────────────────────────────────
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const token = await registerForPushNotifications();
    return token !== null;
  }, [registerForPushNotifications]);

  // ─── Send Test Notification ───────────────────────────────────
  const sendTestNotification = useCallback(async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🪙 El Oráculo — Test',
        body: 'Push notifications are working! You will receive alerts for trades and bot events.',
        data: { type: 'test' } as NotificationPayload,
        sound: 'default',
      },
      trigger: null, // Immediate
    });
  }, []);

  // ─── Effect: Setup listeners ──────────────────────────────────
  useEffect(() => {
    // Register on mount
    registerForPushNotifications();

    // Listen for incoming notifications (foreground)
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        setLastNotification(notification);
        console.log('📱 Notification received:', notification.request.content.title);
      }
    );

    // Listen for notification taps (background/killed)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as NotificationPayload;
        console.log('📱 Notification tapped:', data);

        // Could navigate to specific screen based on data
        if (data.coin) {
          // Navigation logic could go here
        }
      }
    );

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [registerForPushNotifications]);

  return {
    expoPushToken,
    hasPermission,
    requestPermission,
    sendTestNotification,
    lastNotification,
  };
}
