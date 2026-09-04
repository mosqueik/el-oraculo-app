// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — useNetworkStatus Hook
// Online/offline detection with connection quality
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// ─── Types ──────────────────────────────────────────────────────
export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;          // wifi, cellular, ethernet, unknown
  isWifi: boolean;
  isCellular: boolean;
  lastChecked: Date;
}

interface UseNetworkStatusResult extends NetworkStatus {
  refresh: () => Promise<void>;
}

// ─── Default State ──────────────────────────────────────────────
const DEFAULT_STATUS: NetworkStatus = {
  isConnected: true,      // Optimistic: assume connected
  isInternetReachable: null,
  type: 'unknown',
  isWifi: false,
  isCellular: false,
  lastChecked: new Date(),
};

/**
 * Hook for detecting network connectivity
 * Uses a simple fetch-based check as fallback
 */
export function useNetworkStatus(checkInterval: number = 30000): UseNetworkStatusResult {
  const [status, setStatus] = useState<NetworkStatus>(DEFAULT_STATUS);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // ─── Check connectivity ─────────────────────────────────────
  const checkConnectivity = async (): Promise<void> => {
    try {
      // Try to fetch a small resource
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://httpbin.org/get', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache',
      });

      clearTimeout(timeout);

      if (mountedRef.current) {
        setStatus({
          isConnected: true,
          isInternetReachable: response.ok,
          type: 'unknown',
          isWifi: false,
          isCellular: false,
          lastChecked: new Date(),
        });
      }
    } catch {
      if (mountedRef.current) {
        setStatus({
          isConnected: false,
          isInternetReachable: false,
          type: 'unknown',
          isWifi: false,
          isCellular: false,
          lastChecked: new Date(),
        });
      }
    }
  };

  // ─── Refresh ────────────────────────────────────────────────
  const refresh = async (): Promise<void> => {
    await checkConnectivity();
  };

  // ─── Effect: Periodic check ─────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    // Initial check
    checkConnectivity();

    // Periodic check
    intervalRef.current = setInterval(checkConnectivity, checkInterval);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkInterval]);

  return {
    ...status,
    refresh,
  };
}
