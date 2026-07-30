import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as analyticsController from '../controllers/analytics.controller';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many AI requests — try again later' },
});

router.get('/dashboard', analyticsController.dashboard);
router.get('/insights', analyticsController.insights);
router.get('/playbook', analyticsController.playbook);
router.post('/ai-insights', aiLimiter, analyticsController.aiInsights);

export default router;
