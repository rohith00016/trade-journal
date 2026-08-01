import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as analyticsController from '../controllers/analytics.controller';
import { validate } from '../middleware/validate';
import { coachChatSchema } from '../validators/schemas';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many AI requests — try again later' },
});

router.get('/dashboard', analyticsController.dashboard);
router.get('/insights', analyticsController.insights);
router.get('/playbook', analyticsController.playbook);
router.post('/ai-insights', aiLimiter, analyticsController.aiInsights);
router.post(
  '/coach-chat',
  aiLimiter,
  validate(coachChatSchema),
  analyticsController.coachChatHandler
);

export default router;
