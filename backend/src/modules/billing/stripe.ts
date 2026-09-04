// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Stripe Service (Subscription Billing)
// ═══════════════════════════════════════════════════════════════════

import Stripe from 'stripe';
import { logger } from '../../utils/logger';
import { SubscriptionRepository } from '../../database/repositories';

// ─── Stripe Config ──────────────────────────────────────────────
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ─── Plan Config ────────────────────────────────────────────────
export interface PlanConfig {
  id: string;
  name: string;
  description: string;
  price: number;           // Price in cents
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  stripePriceId: string;
  coinLimit: number;
  apiCallsPerMinute: number;
}

export const PLANS: Record<string, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Get started with basic features',
    price: 0,
    currency: 'usd',
    interval: 'month',
    features: [
      '1 coin tracking',
      'Basic indicators',
      'Trade notifications',
      'Community support',
    ],
    stripePriceId: '',
    coinLimit: 1,
    apiCallsPerMinute: 10,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Advanced trading for serious traders',
    price: 2900, // $29/month
    currency: 'usd',
    interval: 'month',
    features: [
      '5 coins tracking',
      'All indicators (L1/L2/L3)',
      'Smart Money analysis',
      'Priority support',
      'Custom alerts',
      'Advanced analytics',
    ],
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || '',
    coinLimit: 5,
    apiCallsPerMinute: 60,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Full power for professional traders',
    price: 9900, // $99/month
    currency: 'usd',
    interval: 'month',
    features: [
      'All coins (10+)',
      'All indicators + custom',
      'Multi-timeframe SM analysis',
      'API access',
      'Dedicated support',
      'Custom configurations',
      'White-label options',
    ],
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
    coinLimit: 100,
    apiCallsPerMinute: 300,
  },
};

// ─── Stripe Service ─────────────────────────────────────────────
export class StripeService {
  private stripe: Stripe | null = null;

  constructor() {
    if (STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(STRIPE_SECRET_KEY, {
        apiVersion: '2024-06-20' as any,
      });
      logger.info('💳 Stripe service initialized');
    } else {
      logger.warn('⚠️ Stripe not configured. Set STRIPE_SECRET_KEY');
    }
  }

  /**
   * Check if Stripe is configured
   */
  isConfigured(): boolean {
    return this.stripe !== null;
  }

  /**
   * Get all available plans
   */
  getPlans(): PlanConfig[] {
    return Object.values(PLANS);
  }

  /**
   * Get plan by ID
   */
  getPlan(planId: string): PlanConfig | undefined {
    return PLANS[planId];
  }

  /**
   * Create Stripe customer for a user
   */
  async createCustomer(params: {
    userId: number;
    email: string;
    name?: string;
  }): Promise<Stripe.Customer> {
    if (!this.stripe) throw new Error('Stripe not configured');

    const customer = await this.stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: {
        userId: String(params.userId),
      },
    });

    logger.info(`💳 Created Stripe customer: ${customer.id} for user ${params.userId}`);
    return customer;
  }

  /**
   * Create checkout session for subscription
   */
  async createCheckoutSession(params: {
    userId: number;
    email: string;
    planId: string;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<Stripe.Checkout.Session> {
    if (!this.stripe) throw new Error('Stripe not configured');

    const plan = PLANS[params.planId];
    if (!plan || !plan.stripePriceId) {
      throw new Error(`Invalid plan: ${params.planId}`);
    }

    // Get or create Stripe customer
    const existingSub = SubscriptionRepository.getByUserId(params.userId);
    let customerId = existingSub?.stripeCustomerId || undefined;

    if (!customerId) {
      const customer = await this.createCustomer({
        userId: params.userId,
        email: params.email,
      });
      customerId = customer.id;

      // Store customer ID
      SubscriptionRepository.upsert(params.userId, {
        stripeCustomerId: customerId,
        plan: 'free',
        status: 'active',
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: params.successUrl || `${FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: params.cancelUrl || `${FRONTEND_URL}/subscription/cancel`,
      metadata: {
        userId: String(params.userId),
        planId: params.planId,
      },
      subscription_data: {
        metadata: {
          userId: String(params.userId),
          planId: params.planId,
        },
      },
    });

    logger.info(`💳 Created checkout session: ${session.id} for user ${params.userId}`);
    return session;
  }

  /**
   * Create customer portal session (for managing subscription)
   */
  async createPortalSession(params: {
    userId: number;
    returnUrl?: string;
  }): Promise<Stripe.BillingPortal.Session> {
    if (!this.stripe) throw new Error('Stripe not configured');

    const sub = SubscriptionRepository.getByUserId(params.userId);
    if (!sub?.stripeCustomerId) {
      throw new Error('No Stripe customer found');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: params.returnUrl || `${FRONTEND_URL}/settings`,
    });

    logger.info(`💳 Created portal session for user ${params.userId}`);
    return session;
  }

  /**
   * Handle webhook event
   */
  async handleWebhook(
    payload: string | Buffer,
    signature: string
  ): Promise<{ type: string; handled: boolean }> {
    if (!this.stripe) throw new Error('Stripe not configured');
    if (!STRIPE_WEBHOOK_SECRET) throw new Error('Stripe webhook secret not configured');

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      logger.error('💳 Webhook signature verification failed:', err);
      throw new Error('Invalid webhook signature');
    }

    logger.info(`💳 Webhook received: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        return { type: event.type, handled: true };

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        return { type: event.type, handled: true };

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        return { type: event.type, handled: true };

      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        return { type: event.type, handled: true };

      case 'invoice.payment_failed':
        await this.handleInvoiceFailed(event.data.object as Stripe.Invoice);
        return { type: event.type, handled: true };

      default:
        logger.debug(`💳 Unhandled webhook event: ${event.type}`);
        return { type: event.type, handled: false };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private noop(): void { /* keep compiler happy */ }

  // ─── Webhook Handlers ────────────────────────────────────────

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = Number(session.metadata?.userId);
    const planId = session.metadata?.planId;

    if (!userId || !planId) {
      logger.error('💳 Checkout completed without metadata');
      return;
    }

    // Get subscription from Stripe
    if (session.subscription && typeof session.subscription === 'string') {
      const subscription = await this.stripe!.subscriptions.retrieve(session.subscription);

      const subData = subscription as any;
      SubscriptionRepository.upsert(userId, {
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price.id,
        plan: planId,
        status: this.mapStripeStatus(subscription.status),
        currentPeriodStart: new Date((subData.current_period_start || Date.now() / 1000) * 1000).toISOString(),
        currentPeriodEnd: new Date((subData.current_period_end || Date.now() / 1000) * 1000).toISOString(),
      });

      logger.info(`💳 Subscription activated: ${planId} for user ${userId}`);
    }
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const userId = Number(subscription.metadata?.userId);
    const planId = subscription.metadata?.planId;

    SubscriptionRepository.updateStatus(
      subscription.id,
      this.mapStripeStatus(subscription.status),
      planId
    );

    // Update period dates
    const sub = SubscriptionRepository.getByStripeSubscriptionId(subscription.id);
    if (sub) {
      const { getDrizzle } = require('../../database/connection');
      const { subscriptions } = require('../../database/schema');
      const db = getDrizzle();

      const subData = subscription as any;
      db.update(subscriptions)
        .set({
          currentPeriodStart: new Date((subData.current_period_start || Date.now() / 1000) * 1000).toISOString(),
          currentPeriodEnd: new Date((subData.current_period_end || Date.now() / 1000) * 1000).toISOString(),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
        .run();
    }

    logger.info(`💳 Subscription updated: ${subscription.id} → ${subscription.status}`);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    SubscriptionRepository.updateStatus(subscription.id, 'canceled', 'free');

    // Also update user's plan
    const sub = SubscriptionRepository.getByStripeSubscriptionId(subscription.id);
    if (sub) {
      const { getDrizzle } = require('../../database/connection');
      const { users } = require('../../database/schema');
      const db = getDrizzle();

      db.update(users)
        .set({ plan: 'free', updatedAt: new Date().toISOString() })
        .where(eq(users.id, sub.userId))
        .run();
    }

    logger.info(`💳 Subscription canceled: ${subscription.id}`);
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const invoiceAny = invoice as any;
    const subscriptionId = invoiceAny.subscription as string;
    if (!subscriptionId) return;

    const sub = SubscriptionRepository.getByStripeSubscriptionId(subscriptionId);
    if (!sub) return;

    // Store invoice
    const { getDrizzle } = require('../../database/connection');
    const { invoices } = require('../../database/schema');
    const db = getDrizzle();

    db.insert(invoices)
      .values({
        userId: sub.userId,
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status || 'paid',
        invoiceUrl: invoice.hosted_invoice_url,
        invoicePdf: invoice.invoice_pdf,
        periodStart: new Date(invoice.period_start * 1000).toISOString(),
        periodEnd: new Date(invoice.period_end * 1000).toISOString(),
      })
      .run();

    logger.info(`💳 Invoice paid: ${invoice.id} ($${(invoice.amount_paid / 100).toFixed(2)})`);
  }

  private async handleInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
    const invoiceAny = invoice as any;
    const subscriptionId = invoiceAny.subscription as string;
    if (subscriptionId) {
      SubscriptionRepository.updateStatus(subscriptionId, 'past_due');
    }

    logger.warn(`💳 Invoice failed: ${invoice.id}`);
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private mapStripeStatus(stripeStatus: string): string {
    const statusMap: Record<string, string> = {
      active: 'active',
      canceled: 'canceled',
      past_due: 'past_due',
      unpaid: 'unpaid',
      trialing: 'active',
      incomplete: 'incomplete',
      incomplete_expired: 'incomplete_expired',
      paused: 'paused',
    };
    return statusMap[stripeStatus] || 'active';
  }
}

// Need to import eq for the update methods
import { eq } from 'drizzle-orm';
