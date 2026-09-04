// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — JWT Authentication Middleware
// ═══════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../database/repositories';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    plan: string;
  };
}

/**
 * Generate JWT token for a user
 */
export function generateToken(user: { id: number; email: string; plan: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, plan: user.plan },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): any {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Authentication middleware
 * Extracts and verifies JWT token from Authorization header
 */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No token provided',
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    // Fetch user to verify they still exist
    const user = UserRepository.getById(decoded.id);

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      plan: user.plan,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token expired',
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: 'Invalid token',
    });
  }
}

/**
 * Authorization middleware for specific plans
 */
export function requirePlan(...plans: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
      return;
    }

    if (!plans.includes(req.user.plan)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: plans,
        current: req.user.plan,
      });
      return;
    }

    next();
  };
}
