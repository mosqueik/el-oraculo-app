// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — useAuth Hook (JWT Authentication)
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService, setAuthToken } from '../services/api';

// ─── Types ──────────────────────────────────────────────────────
export interface User {
  id: number;
  email: string;
  name?: string;
  plan: string;
  createdAt?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

interface UseAuthResult extends AuthState {
  login: (email: string, password: string, saveForBiometric?: boolean) => Promise<boolean>;
  register: (email: string, password: string, name?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const STORAGE_KEY_TOKEN = '@el_oraculo_token';
const STORAGE_KEY_USER = '@el_oraculo_user';

/**
 * Hook for JWT authentication with persistent storage
 */
export function useAuth(): UseAuthResult {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
    error: null,
    isAuthenticated: false,
  });

  // ─── Load stored auth on mount ────────────────────────────────
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [token, userJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_TOKEN),
        AsyncStorage.getItem(STORAGE_KEY_USER),
      ]);

      if (token && userJson) {
        const user = JSON.parse(userJson) as User;

        // Set token in API service
        setAuthToken(token);

        // Verify token is still valid
        try {
          const me = await apiService.getMe();
          setState({
            user: me || user,
            token,
            loading: false,
            error: null,
            isAuthenticated: true,
          });
        } catch {
          // Token expired or invalid — clear stored auth
          await clearStoredAuth();
          setState({
            user: null,
            token: null,
            loading: false,
            error: null,
            isAuthenticated: false,
          });
        }
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  // ─── Login ────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string, saveForBiometric: boolean = false): Promise<boolean> => {
    setState((prev) => ({ ...prev, error: null, loading: true }));

    try {
      const result = await apiService.login(email, password);

      const user: User = result.user;
      const token: string = result.token;

      if (!token) {
        throw new Error('No token received');
      }

      // Persist to storage
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEY_TOKEN, token),
        AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user)),
      ]);

      // Set token in API service
      setAuthToken(token);

      setState({
        user,
        token,
        loading: false,
        error: null,
        isAuthenticated: true,
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setState((prev) => ({
        ...prev,
        loading: false,
        error: message,
        isAuthenticated: false,
      }));
      return false;
    }
  }, []);

  // ─── Register ─────────────────────────────────────────────────
  const register = useCallback(async (email: string, password: string, name?: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, error: null, loading: true }));

    try {
      const result = await apiService.register(email, password, name);

      const user: User = result.user;
      const token: string = result.token;

      if (!token) {
        throw new Error('No token received');
      }

      // Persist to storage
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEY_TOKEN, token),
        AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user)),
      ]);

      // Set token in API service
      setAuthToken(token);

      setState({
        user,
        token,
        loading: false,
        error: null,
        isAuthenticated: true,
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setState((prev) => ({
        ...prev,
        loading: false,
        error: message,
        isAuthenticated: false,
      }));
      return false;
    }
  }, []);

  // ─── Logout ───────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await clearStoredAuth();
    setAuthToken(null);

    setState({
      user: null,
      token: null,
      loading: false,
      error: null,
      isAuthenticated: false,
    });
  }, []);

  // ─── Clear Error ──────────────────────────────────────────────
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // ─── Helpers ──────────────────────────────────────────────────
  const clearStoredAuth = async () => {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEY_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEY_USER),
    ]);
  };

  return {
    ...state,
    login,
    register,
    logout,
    clearError,
  };
}
