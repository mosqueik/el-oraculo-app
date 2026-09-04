// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Notification Routes
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PushTokenRepository, NotificationLogRepository } from '../database/repositories';
import { validateQuery, validateBody } from '../validation';
import { notificationService } from '../modules/notifications/service';
import { authenticate } from '../middleware/auth';

const router = Router();

// ─── Validation Schemas ────────────────────────────────────────
const RegisterTokenSchema = z.object({
  token: z.string().min(10, 'Invalid push token'),
  platform: z.enum(['ios', 'android', 'web']),
  deviceName: z.string().optional(),
  userId: z.number().int().positive().optional(),
});

const DeactivateTokenSchema = z.object({
  token: z.string().min(10, 'Invalid push token'),
});

const NotificationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  hours: z.coerce.number().int().min(1).max(720).optional(),
  coin: z.string().optional(),
});

// ─── POST /api/notifications/register ──────────────────────────
// Register a device push token
router.post('/notifications/register', validateBody(RegisterTokenSchema), (req: Request, res: Response) => {
  try {
    const { token, platform, deviceName, userId } = req.body;

    const pushToken = PushTokenRepository.register({
      token,
      platform,
      deviceName: deviceName || null,
      userId: userId || null,
    });

    res.json({
      success: true,
      data: {
        id: pushToken.id,
        token: pushToken.token.substring(0, 20) + '...',
        platform: pushToken.platform,
        registeredAt: pushToken.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to register token',
    });
  }
});

// ─── POST /api/notifications/unregister ────────────────────────
// Deactivate a push token
router.post('/notifications/unregister', validateBody(DeactivateTokenSchema), (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    PushTokenRepository.deactivate(token);

    res.json({
      success: true,
      data: { message: 'Token deactivated' },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deactivate token',
    });
  }
});

// ─── GET /api/notifications/history ────────────────────────────
// Get notification history
router.get('/notifications/history', validateQuery(NotificationQuerySchema), (req: Request, res: Response) => {
  try {
    const { limit, offset, hours, coin } = req.query as any;

    let notifications;
    if (coin) {
      notifications = NotificationLogRepository.getByCoin(coin, limit);
    } else if (hours) {
      notifications = NotificationLogRepository.getRecent(hours);
    } else {
      notifications = NotificationLogRepository.getAll(limit, offset);
    }

    res.json({
      success: true,
      data: notifications,
      count: notifications.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get notifications',
    });
  }
});

// ─── GET /api/notifications/tokens ─────────────────────────────
// Get active token count (admin info)
router.get('/notifications/tokens', (req: Request, res: Response) => {
  try {
    const activeCount = PushTokenRepository.getActiveCount();

    res.json({
      success: true,
      data: {
        activeTokens: activeCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get token count',
    });
  }
});

// ─── POST /api/notifications/test ──────────────────────────────
// Send a test push notification (for debugging)
router.post('/notifications/test', (req: Request, res: Response) => {
  try {
    const { PushNotificationService } = require('../modules/notifications/push');
    const pushService = new PushNotificationService();

    pushService.sendPushNotification(
      '🪙 El Oráculo — Test',
      'Push notifications are working! You will receive alerts for trades and bot events.',
      { type: 'test' },
      'default'
    ).then((result: any) => {
      res.json({
        success: true,
        data: {
          message: 'Test notification sent',
          sent: result.sent,
          failed: result.failed,
        },
      });
    }).catch((error: any) => {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send test notification',
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send test notification',
    });
  }
});

// ─── GET /api/notifications/telegram/config ──────────────────
// Get Telegram configuration status
router.get('/notifications/telegram/config', authenticate, (req: Request, res: Response) => {
  try {
    const config = notificationService.getConfig();

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get Telegram config',
    });
  }
});

// ─── POST /api/notifications/telegram/test ─────────────────────
// Test Telegram connection
router.post('/notifications/telegram/test', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await notificationService.testConnection();

    if (result.success) {
      res.json({
        success: true,
        data: {
          message: 'Telegram test message sent successfully',
          ...result.chatInfo,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Telegram test failed',
    });
  }
});

// ─── POST /api/notifications/telegram/send ─────────────────────
// Send a custom message via Telegram
router.post('/notifications/telegram/send', authenticate, async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid message field',
      });
    }

    if (message.length > 4000) {
      return res.status(400).json({
        success: false,
        error: 'Message too long (max 4000 characters)',
      });
    }

    const sent = await notificationService.sendMessage(message);

    res.json({
      success: true,
      data: {
        sent,
        message: sent ? 'Message sent' : 'Failed to send (check Telegram config)',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
    });
  }
});

// ─── GET /api/notifications/telegram/recent ────────────────────
// Get recent in-memory Telegram notifications
router.get('/notifications/telegram/recent', authenticate, (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const notifications = notificationService.getRecent(limit);

    res.json({
      success: true,
      data: notifications,
      count: notifications.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get notifications',
    });
  }
});

// ─── DELETE /api/notifications/telegram/clear ───────────────────
// Clear in-memory notification log
router.delete('/notifications/telegram/clear', authenticate, (req: Request, res: Response) => {
  try {
    notificationService.clear();

    res.json({
      success: true,
      data: { message: 'Notifications cleared' },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear notifications',
    });
  }
});

export default router;
