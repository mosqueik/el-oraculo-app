// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — User Repository
// ═══════════════════════════════════════════════════════════════════

import { eq, sql } from 'drizzle-orm';
import { getDrizzle } from '../connection';
import { users, type User, type NewUser } from '../schema';

export class UserRepository {
  /**
   * Create a new user
   */
  static create(data: NewUser): User {
    const db = getDrizzle();
    const now = new Date().toISOString();

    const result = db
      .insert(users)
      .values({
        ...data,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return db
      .select()
      .from(users)
      .where(eq(users.id, Number(result.lastInsertRowid)))
      .get()!;
  }

  /**
   * Get user by ID
   */
  static getById(id: number): User | undefined {
    const db = getDrizzle();
    return db.select().from(users).where(eq(users.id, id)).get();
  }

  /**
   * Get user by email
   */
  static getByEmail(email: string): User | undefined {
    const db = getDrizzle();
    return db.select().from(users).where(eq(users.email, email)).get();
  }

  /**
   * Update user by ID
   */
  static update(id: number, data: Partial<NewUser>): User | undefined {
    const db = getDrizzle();
    const existing = this.getById(id);

    if (!existing) return undefined;

    db.update(users)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(users.id, id))
      .run();

    return this.getById(id);
  }

  /**
   * Delete user by ID
   */
  static delete(id: number): boolean {
    const db = getDrizzle();
    const result = db.delete(users).where(eq(users.id, id)).run();
    return result.changes > 0;
  }

  /**
   * Get all users
   */
  static getAll(): User[] {
    const db = getDrizzle();
    return db.select().from(users).all();
  }

  /**
   * Get user count
   */
  static getCount(): number {
    const db = getDrizzle();
    const result = db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .get();
    return result?.count || 0;
  }

  /**
   * Update user plan
   */
  static updatePlan(
    id: number,
    plan: 'free' | 'pro' | 'enterprise'
  ): User | undefined {
    return this.update(id, { plan });
  }
}
