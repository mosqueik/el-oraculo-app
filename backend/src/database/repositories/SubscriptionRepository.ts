// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Subscription Repository
// ═══════════════════════════════════════════════════════════════════

import { eq, desc } from 'drizzle-orm';
import { getDrizzle } from '../connection';
import { subscriptions, type Subscription, type NewSubscription } from '../schema';

export class SubscriptionRepository {
  /**
   * Get subscription by user ID
   */
  static getByUserId(userId: number): Subscription | undefined {
    const db = getDrizzle();
    return db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt))
      .get();
  }

  /**
   * Get subscription by Stripe subscription ID
   */
  static getByStripeSubscriptionId(stripeSubscriptionId: string): Subscription | undefined {
    const db = getDrizzle();
    return db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
      .get();
  }

  /**
   * Get subscription by Stripe customer ID
   */
  static getByStripeCustomerId(stripeCustomerId: string): Subscription | undefined {
    const db = getDrizzle();
    return db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, stripeCustomerId))
      .get();
  }

  /**
   * Create or update subscription
   */
  static upsert(userId: number, data: Partial<NewSubscription>): Subscription {
    const db = getDrizzle();
    const existing = this.getByUserId(userId);

    if (existing) {
      db.update(subscriptions)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(subscriptions.id, existing.id))
        .run();

      return this.getByUserId(userId)!;
    }

    db.insert(subscriptions)
      .values({ userId, ...data } as NewSubscription)
      .run();

    return this.getByUserId(userId)!;
  }

  /**
   * Update subscription status
   */
  static updateStatus(
    stripeSubscriptionId: string,
    status: string,
    plan?: string
  ): Subscription | undefined {
    const db = getDrizzle();
    const existing = this.getByStripeSubscriptionId(stripeSubscriptionId);

    if (!existing) return undefined;

    const updateData: Record<string, any> = {
      status,
      updatedAt: new Date().toISOString(),
    };

    if (plan) updateData.plan = plan;

    db.update(subscriptions)
      .set(updateData)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
      .run();

    return this.getByStripeSubscriptionId(stripeSubscriptionId);
  }

  /**
   * Cancel subscription (at period end)
   */
  static markCancelAtPeriodEnd(stripeSubscriptionId: string): void {
    const db = getDrizzle();
    db.update(subscriptions)
      .set({
        cancelAtPeriodEnd: true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
      .run();
  }

  /**
   * Get user's current plan
   */
  static getUserPlan(userId: number): string {
    const sub = this.getByUserId(userId);
    return sub?.plan || 'free';
  }

  /**
   * Check if user has active paid subscription
   */
  static hasActivePaidSubscription(userId: number): boolean {
    const sub = this.getByUserId(userId);
    return sub !== undefined && sub.plan !== 'free' && sub.status === 'active';
  }
}
