// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Validation Middleware
// ═══════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

// ─── Validation Target ──────────────────────────────────────────

type ValidationTarget = 'body' | 'params' | 'query';

// ─── Middleware Factory ─────────────────────────────────────────

/**
 * Create a validation middleware for a specific target
 */
function validate(target: ValidationTarget) {
  return (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const data = schema.parse(req[target]);
        // Replace with parsed (coerced/defaulted) values
        (req as any)[target] = data;
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          const details = error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          }));

          res.status(400).json({
            success: false,
            error: 'Validation failed',
            details,
          });
          return;
        }

        // Re-throw unexpected errors
        next(error);
      }
    };
  };
}

// ─── Exported Middleware ─────────────────────────────────────────

/**
 * Validate request body
 */
export const validateBody = validate('body');

/**
 * Validate request params
 */
export const validateParams = validate('params');

/**
 * Validate request query
 */
export const validateQuery = validate('query');

/**
 * Validate multiple targets at once
 */
export function validateRequest(schemas: {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: Array<{ target: string; field: string; message: string }> = [];

    // Validate body
    if (schemas.body) {
      try {
        const data = schemas.body.parse(req.body);
        req.body = data;
      } catch (error) {
        if (error instanceof ZodError) {
          for (const e of error.errors) {
            errors.push({
              target: 'body',
              field: e.path.join('.'),
              message: e.message,
            });
          }
        }
      }
    }

    // Validate params
    if (schemas.params) {
      try {
        const data = schemas.params.parse(req.params);
        (req as any).params = data;
      } catch (error) {
        if (error instanceof ZodError) {
          for (const e of error.errors) {
            errors.push({
              target: 'params',
              field: e.path.join('.'),
              message: e.message,
            });
          }
        }
      }
    }

    // Validate query
    if (schemas.query) {
      try {
        const data = schemas.query.parse(req.query);
        (req as any).query = data;
      } catch (error) {
        if (error instanceof ZodError) {
          for (const e of error.errors) {
            errors.push({
              target: 'query',
              field: e.path.join('.'),
              message: e.message,
            });
          }
        }
      }
    }

    // Return errors if any
    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    next();
  };
}
