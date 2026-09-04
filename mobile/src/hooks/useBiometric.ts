// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — useBiometric Hook
// Face ID / Fingerprint authentication
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ──────────────────────────────────────────────────────
export type BiometricType = 'fingerprint' | 'facial-recognition' | 'iris' | null;

interface BiometricState {
  isAvailable: boolean;
  biometricType: BiometricType;
  isEnabled: boolean;
  hasCredentials: boolean;
  loading: boolean;
  error: string | null;
}

interface UseBiometricResult extends BiometricState {
  authenticate: (promptMessage?: string) => Promise<boolean>;
  enable: () => Promise<boolean>;
  disable: () => Promise<void>;
  saveCredentials: (email: string, password: string) => Promise<void>;
  getCredentials: () => Promise<{ email: string; password: string } | null>;
  clearCredentials: () => Promise<void>;
}

const STORAGE_KEY_BIOMETRIC_ENABLED = '@el_oraculo_biometric_enabled';
const STORAGE_KEY_BIOMETRIC_CREDENTIALS = '@el_oraculo_biometric_credentials';

/**
 * Hook for biometric authentication
 * Supports Face ID (iOS) and Fingerprint (Android)
 */
export function useBiometric(): UseBiometricResult {
  const [state, setState] = useState<BiometricState>({
    isAvailable: false,
    biometricType: null,
    isEnabled: false,
    hasCredentials: false,
    loading: true,
    error: null,
  });

  // ─── Check availability on mount ────────────────────────────
  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      // Check if hardware supports biometrics
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) {
        setState((prev) => ({
          ...prev,
          isAvailable: false,
          loading: false,
        }));
        return;
      }

      // Check if biometrics are enrolled
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) {
        setState((prev) => ({
          ...prev,
          isAvailable: false,
          loading: false,
        }));
        return;
      }

      // Get biometric type
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      let biometricType: BiometricType = null;

      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometricType = 'facial-recognition';
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometricType = 'fingerprint';
      } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        biometricType = 'iris';
      }

      // Check if enabled in settings
      const enabled = await AsyncStorage.getItem(STORAGE_KEY_BIOMETRIC_ENABLED);
      const hasCredentials = await AsyncStorage.getItem(STORAGE_KEY_BIOMETRIC_CREDENTIALS);

      setState({
        isAvailable: true,
        biometricType,
        isEnabled: enabled === 'true',
        hasCredentials: !!hasCredentials,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to check biometrics',
      }));
    }
  };

  // ─── Authenticate ───────────────────────────────────────────
  const authenticate = useCallback(async (promptMessage?: string): Promise<boolean> => {
    try {
      const defaultPrompt = {
        'fingerprint': 'Authenticate with your fingerprint',
        'facial-recognition': 'Authenticate with Face ID',
        'iris': 'Authenticate with your iris',
      };

      const message = promptMessage || defaultPrompt[state.biometricType || 'fingerprint']
        || 'Authenticate to continue';

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: message,
        cancelLabel: 'Cancel',
        disableDeviceFallback: false, // Allow passcode fallback
        fallbackLabel: 'Use Passcode',
      });

      return result.success;
    } catch (error) {
      console.warn('Biometric auth error:', error);
      return false;
    }
  }, [state.biometricType]);

  // ─── Enable biometric login ─────────────────────────────────
  const enable = useCallback(async (): Promise<boolean> => {
    try {
      // First, authenticate to confirm
      const authenticated = await authenticate('Enable biometric login');
      if (!authenticated) return false;

      // Check if we have credentials to save
      const credentials = await getCredentials();
      if (!credentials) {
        setState((prev) => ({
          ...prev,
          error: 'Please login first to enable biometrics',
        }));
        return false;
      }

      await AsyncStorage.setItem(STORAGE_KEY_BIOMETRIC_ENABLED, 'true');
      setState((prev) => ({
        ...prev,
        isEnabled: true,
        error: null,
      }));
      return true;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to enable biometrics',
      }));
      return false;
    }
  }, [authenticate]);

  // ─── Disable biometric login ────────────────────────────────
  const disable = useCallback(async (): Promise<void> => {
    await AsyncStorage.removeItem(STORAGE_KEY_BIOMETRIC_ENABLED);
    setState((prev) => ({
      ...prev,
      isEnabled: false,
    }));
  }, []);

  // ─── Save credentials ───────────────────────────────────────
  const saveCredentials = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      const credentials = JSON.stringify({ email, password });
      await AsyncStorage.setItem(STORAGE_KEY_BIOMETRIC_CREDENTIALS, credentials);
      setState((prev) => ({
        ...prev,
        hasCredentials: true,
      }));
    } catch (error) {
      console.warn('Failed to save credentials:', error);
    }
  }, []);

  // ─── Get credentials ────────────────────────────────────────
  const getCredentials = useCallback(async (): Promise<{ email: string; password: string } | null> => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_BIOMETRIC_CREDENTIALS);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  // ─── Clear credentials ──────────────────────────────────────
  const clearCredentials = useCallback(async (): Promise<void> => {
    await AsyncStorage.removeItem(STORAGE_KEY_BIOMETRIC_CREDENTIALS);
    setState((prev) => ({
      ...prev,
      hasCredentials: false,
    }));
  }, []);

  return {
    ...state,
    authenticate,
    enable,
    disable,
    saveCredentials,
    getCredentials,
    clearCredentials,
  };
}
