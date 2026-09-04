// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Subscription Screen
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { apiService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  coinLimit: number;
}

interface Subscription {
  plan: string;
  status: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
}

export function SubscriptionScreen({ navigation }: any) {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [stripeConfigured, setStripeConfigured] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [plansRes, subRes] = await Promise.allSettled([
        apiService.getPlans(),
        apiService.getSubscription(),
      ]);

      if (plansRes.status === 'fulfilled') {
        setPlans(plansRes.value.plans || []);
        setStripeConfigured(plansRes.value.stripeConfigured || false);
      }

      if (subRes.status === 'fulfilled') {
        setSubscription(subRes.value);
      }
    } catch (err) {
      console.error('Failed to load subscription data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (planId: string) => {
    if (!stripeConfigured) {
      Alert.alert('Stripe Not Configured', 'Payment processing is not available yet.');
      return;
    }

    setCheckoutLoading(planId);

    try {
      const result = await apiService.createCheckout({ planId });

      if (result.url) {
        // In a real app, this would open a WebView or deep link
        Alert.alert(
          'Redirecting to Stripe',
          'You will be redirected to complete your payment.',
          [{ text: 'OK' }]
        );
        // Linking.openURL(result.url);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to start checkout');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const result = await apiService.createPortal();
      if (result.url) {
        Alert.alert('Manage Subscription', 'Opening subscription management portal...');
        // Linking.openURL(result.url);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to open portal');
    }
  };

  if (loading) return <LoadingSpinner message="Loading plans..." fullScreen />;

  const currentPlan = subscription?.plan || 'free';

  const formatPrice = (price: number) => {
    if (price === 0) return 'Free';
    return `$${(price / 100).toFixed(0)}/mo`;
  };

  return (
    <ScrollView style={styles.container}>
      {/* Current Plan */}
      {subscription && (
        <View style={styles.currentPlanCard}>
          <Text style={styles.currentPlanLabel}>Current Plan</Text>
          <Text style={styles.currentPlanName}>{currentPlan.toUpperCase()}</Text>
          {subscription.currentPeriodEnd && (
            <Text style={styles.currentPlanEnd}>
              {subscription.cancelAtPeriodEnd
                ? `Cancels ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                : `Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
              }
            </Text>
          )}
          {currentPlan !== 'free' && (
            <TouchableOpacity style={styles.manageButton} onPress={handleManageSubscription}>
              <Text style={styles.manageButtonText}>Manage Subscription</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Plans */}
      <Text style={styles.sectionTitle}>Choose Your Plan</Text>

      {plans.map((plan) => {
        const isCurrent = plan.id === currentPlan;
        const isPaid = plan.price > 0;
        const isLoading = checkoutLoading === plan.id;

        return (
          <View
            key={plan.id}
            style={[styles.planCard, isCurrent && styles.planCardCurrent]}
          >
            {/* Plan Header */}
            <View style={styles.planHeader}>
              <View>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planDescription}>{plan.description}</Text>
              </View>
              <Text style={styles.planPrice}>{formatPrice(plan.price)}</Text>
            </View>

            {/* Features */}
            <View style={styles.featuresList}>
              {plan.features.map((feature, i) => (
                <View key={i} style={styles.featureRow}>
                  <Text style={styles.featureCheck}>✓</Text>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            {/* Coin Limit */}
            <View style={styles.limitRow}>
              <Text style={styles.limitText}>
                {plan.coinLimit >= 100 ? 'Unlimited' : plan.coinLimit} coins
              </Text>
            </View>

            {/* Action Button */}
            {isCurrent ? (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Current Plan</Text>
              </View>
            ) : isPaid ? (
              <TouchableOpacity
                style={[styles.selectButton, isLoading && styles.selectButtonDisabled]}
                onPress={() => handleCheckout(plan.id)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.selectButtonText}>Upgrade to {plan.name}</Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.freeBadge}>
                <Text style={styles.freeBadgeText}>Free Forever</Text>
              </View>
            )}
          </View>
        );
      })}

      {/* FAQ */}
      <View style={styles.faqSection}>
        <Text style={styles.sectionTitle}>FAQ</Text>

        <View style={styles.faqItem}>
          <Text style={styles.faqQuestion}>Can I cancel anytime?</Text>
          <Text style={styles.faqAnswer}>Yes! You can cancel your subscription at any time. Your access continues until the end of your billing period.</Text>
        </View>

        <View style={styles.faqItem}>
          <Text style={styles.faqQuestion}>What payment methods are accepted?</Text>
          <Text style={styles.faqAnswer}>We accept all major credit cards (Visa, Mastercard, American Express) through Stripe.</Text>
        </View>

        <View style={styles.faqItem}>
          <Text style={styles.faqQuestion}>Is there a free trial?</Text>
          <Text style={styles.faqAnswer}>No free trial, but the Free plan lets you try 1 coin with basic features.</Text>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },

  // Current plan
  currentPlanCard: {
    backgroundColor: '#1a1a2e',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9456040',
  },
  currentPlanLabel: { color: '#888', fontSize: 12, textTransform: 'uppercase' },
  currentPlanName: { color: '#e94560', fontSize: 24, fontWeight: 'bold', marginTop: 4 },
  currentPlanEnd: { color: '#666', fontSize: 12, marginTop: 4 },
  manageButton: {
    marginTop: 12,
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  manageButtonText: { color: '#e94560', fontSize: 13, fontWeight: '600' },

  // Section
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
  },

  // Plan cards
  planCard: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  planCardCurrent: {
    borderColor: '#e94560',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planName: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  planDescription: { color: '#888', fontSize: 13, marginTop: 4 },
  planPrice: { color: '#fff', fontSize: 22, fontWeight: 'bold', fontFamily: 'monospace' },

  // Features
  featuresList: {
    marginTop: 16,
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureCheck: { color: '#4ade80', fontSize: 14, fontWeight: 'bold' },
  featureText: { color: '#ccc', fontSize: 13 },

  // Limit
  limitRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4e',
  },
  limitText: { color: '#e94560', fontSize: 13, fontWeight: '600' },

  // Buttons
  selectButton: {
    backgroundColor: '#e94560',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  selectButtonDisabled: { opacity: 0.6 },
  selectButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  currentBadge: {
    backgroundColor: '#4ade8015',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  currentBadgeText: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
  freeBadge: {
    backgroundColor: '#88888815',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  freeBadgeText: { color: '#888', fontSize: 13, fontWeight: '600' },

  // FAQ
  faqSection: {
    marginTop: 8,
  },
  faqItem: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 10,
  },
  faqQuestion: { color: '#fff', fontSize: 14, fontWeight: '600' },
  faqAnswer: { color: '#888', fontSize: 13, marginTop: 8, lineHeight: 18 },
});
