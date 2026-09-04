// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Billing Routes (Stripe Subscriptions)
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { StripeService } from '../modules/billing/stripe';
import { SubscriptionRepository, UserRepository } from '../database/repositories';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validateBody } from '../validation';

const router = Router();

// ─── Stripe Service Instance ────────────────────────────────────
let stripeService: StripeService | null = null;

function getStripeService(): StripeService {
  if (!stripeService) {
    stripeService = new StripeService();
  }
  return stripeService;
}

// ─── Validation Schemas ────────────────────────────────────────
const CheckoutSchema = z.object({
  planId: z.enum(['pro', 'enterprise']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

// ─── GET /api/billing/plans ─────────────────────────────────────
// Get all available plans
router.get('/billing/plans', (req: Request, res: Response) => {
  try {
    const stripe = getStripeService();
    const plans = stripe.getPlans();

    res.json({
      success: true,
      data: plans,
      stripeConfigured: stripe.isConfigured(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get plans',
    });
  }
});

// ─── GET /api/billing/subscription ──────────────────────────────
// Get current user's subscription
router.get('/billing/subscription', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const subscription = SubscriptionRepository.getByUserId(userId);
    const user = UserRepository.getById(userId);

    const plan = subscription?.plan || user?.plan || 'free';

    res.json({
      success: true,
      data: {
        plan,
        status: subscription?.status || 'active',
        currentPeriodStart: subscription?.currentPeriodStart,
        currentPeriodEnd: subscription?.currentPeriodEnd,
        cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
        stripeCustomerId: subscription?.stripeCustomerId || null,
        features: getStripeService().getPlan(plan)?.features || [],
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get subscription',
    });
  }
});

// ─── POST /api/billing/checkout ─────────────────────────────────
// Create Stripe checkout session
router.post('/billing/checkout', authenticate, validateBody(CheckoutSchema), async (req: AuthRequest, res: Response) => {
  try {
    const stripe = getStripeService();

    if (!stripe.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Stripe is not configured',
      });
    }

    const userId = req.user!.id;
    const { planId, successUrl, cancelUrl } = req.body;

    // Get user email
    const user = UserRepository.getById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const session = await stripe.createCheckoutSession({
      userId,
      email: user.email,
      planId,
      successUrl,
      cancelUrl,
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create checkout',
    });
  }
});

// ─── POST /api/billing/portal ───────────────────────────────────
// Create Stripe customer portal session
router.post('/billing/portal', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const stripe = getStripeService();

    if (!stripe.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Stripe is not configured',
      });
    }

    const userId = req.user!.id;
    const { returnUrl } = req.body || {};

    const session = await stripe.createPortalSession({
      userId,
      returnUrl,
    });

    res.json({
      success: true,
      data: {
        url: session.url,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create portal',
    });
  }
});

// ─── POST /api/billing/webhook ──────────────────────────────────
// Stripe webhook endpoint (no auth — verified by signature)
router.post('/billing/webhook', async (req: Request, res: Response) => {
  try {
    const stripe = getStripeService();

    if (!stripe.isConfigured()) {
      return res.status(503).json({ received: false });
    }

    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      return res.status(400).json({ received: false, error: 'Missing signature' });
    }

    const result = await stripe.handleWebhook(req.body, signature);

    res.json({ received: true, type: result.type, handled: result.handled });
  } catch (error: any) {
    logger.error('Stripe webhook error:', error);
    res.status(400).json({ received: false, error: error?.message || 'Unknown error' });
  }
});

// ─── GET /api/billing/invoices ──────────────────────────────────
// Get user's invoice history
router.get('/billing/invoices', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { getDrizzle } = require('../database/connection');
    const { invoices } = require('../database/schema');
    const { desc } = require('drizzle-orm');

    const db = getDrizzle();
    const userInvoices = db
      .select()
      .from(invoices)
      .where(invoices.userId, userId)
      .orderBy(desc(invoices.createdAt))
      .limit(20)
      .all();

    res.json({
      success: true,
      data: userInvoices,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get invoices',
    });
  }
});

import { logger } from '../utils/logger';

export default router;
