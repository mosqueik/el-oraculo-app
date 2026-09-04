// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Route Exports
// ═══════════════════════════════════════════════════════════════════

import { Router } from 'express';
import healthRoutes from './health';
import portfolioRoutes from './portfolio';
import tradesRoutes from './trades';
import executionsRoutes from './executions';
import authRoutes from './auth';
import statusRoutes from './status';
import balanceRoutes from './balance';
import klinesRoutes from './klines';
import notificationsRoutes from './notifications';
import monitoringRoutes from './monitoring';
import billingRoutes from './billing';
import tradingRoutes from './trading';
import exportRoutes from './export';
import indicatorRoutes from './indicators';
import backtestRoutes from './backtest';
import alertRoutes from './alerts';
import rateLimitRoutes from './rateLimit';
import analyticsRoutes from './analytics';
import dashboardRoutes from './dashboard';
import walkForwardRoutes from './walkForward';
import portfolioRiskRoutes from './portfolioRisk';
import metricsRoutes from './metrics';
import adminRoutes from './admin';

const router = Router();

// Mount routes
router.use(healthRoutes);
router.use(portfolioRoutes);
router.use(tradesRoutes);
router.use(executionsRoutes);
router.use(authRoutes);
router.use(statusRoutes);
router.use(balanceRoutes);
router.use(klinesRoutes);
router.use(notificationsRoutes);
router.use(monitoringRoutes);
router.use(billingRoutes);
router.use(tradingRoutes);
router.use(exportRoutes);
router.use(indicatorRoutes);
router.use(backtestRoutes);
router.use(alertRoutes);
router.use(rateLimitRoutes);
router.use(analyticsRoutes);
router.use(dashboardRoutes);
router.use(walkForwardRoutes);
router.use(portfolioRiskRoutes);
router.use(metricsRoutes);
router.use(adminRoutes);

export default router;
