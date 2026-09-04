// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Login Screen (with Biometric Support)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';

interface LoginScreenProps {
  onLogin: (email: string, password: string, saveForBiometric?: boolean) => Promise<boolean>;
  onGoToRegister: () => void;
  error: string | null;
  loading: boolean;
  clearError: () => void;
  biometricAvailable?: boolean;
  biometricType?: string | null;
  biometricEnabled?: boolean;
  onBiometricLogin?: () => Promise<boolean>;
}

export function LoginScreen({
  onLogin,
  onGoToRegister,
  error,
  loading,
  clearError,
  biometricAvailable = false,
  biometricType = null,
  biometricEnabled = false,
  onBiometricLogin,
}: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    clearError();
    // Save for biometric if available
    await onLogin(email.trim(), password, biometricAvailable);
  };

  const handleBiometricLogin = async () => {
    if (onBiometricLogin) {
      clearError();
      await onBiometricLogin();
    }
  };

  const biometricLabel = biometricType === 'facial-recognition'
    ? 'Face ID'
    : biometricType === 'fingerprint'
    ? 'Fingerprint'
    : biometricType === 'iris'
    ? 'Iris'
    : 'Biometric';

  const biometricIcon = biometricType === 'facial-recognition'
    ? '👤'
    : biometricType === 'fingerprint'
    ? '👆'
    : '🔐';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>🪙</Text>
          <Text style={styles.title}>El Oráculo</Text>
          <Text style={styles.subtitle}>Crypto Trading Bot</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Error */}
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor="#555"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!loading}
            />
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                placeholderTextColor="#555"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading || !email.trim() || !password.trim()}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Biometric Login */}
          {biometricAvailable && biometricEnabled && onBiometricLogin && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.biometricButton}
                onPress={handleBiometricLogin}
                disabled={loading}
              >
                <Text style={styles.biometricIcon}>{biometricIcon}</Text>
                <Text style={styles.biometricText}>Login with {biometricLabel}</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Divider + Register */}
          {!biometricAvailable && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>
            </>
          )}

          {/* Register Link */}
          <TouchableOpacity
            style={styles.registerButton}
            onPress={onGoToRegister}
            disabled={loading}
          >
            <Text style={styles.registerText}>
              Don't have an account? <Text style={styles.registerLink}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          🔒 Secured with JWT + Biometric authentication
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 64,
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  form: {
    gap: 16,
  },
  errorContainer: {
    backgroundColor: '#f8717115',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f8717130',
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a4e',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 15,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a4e',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 15,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 8,
  },
  eyeText: {
    fontSize: 18,
  },
  loginButton: {
    backgroundColor: '#e94560',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2a2a4e',
  },
  dividerText: {
    color: '#666',
    fontSize: 12,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4ade8040',
    gap: 10,
  },
  biometricIcon: {
    fontSize: 20,
  },
  biometricText: {
    color: '#4ade80',
    fontSize: 15,
    fontWeight: '600',
  },
  registerButton: {
    padding: 12,
    alignItems: 'center',
  },
  registerText: {
    color: '#888',
    fontSize: 14,
  },
  registerLink: {
    color: '#e94560',
    fontWeight: 'bold',
  },
  footer: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 40,
  },
});
