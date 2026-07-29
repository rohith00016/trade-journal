import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import authRoutes from './auth.routes';
import accountRoutes from './account.routes';
import strategyRoutes from './strategy.routes';
import tradeRoutes from './trade.routes';
import dayReviewRoutes from './dayReview.routes';
import journalRoutes from './journal.routes';
import analyticsRoutes from './analytics.routes';
import uploadRoutes from './upload.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'TradingJournal-Pro API' });
});

router.use('/auth', authRoutes);
router.use('/accounts', authenticate, accountRoutes);
router.use('/strategies', authenticate, strategyRoutes);
router.use('/journal', authenticate, journalRoutes);
// Legacy mounts kept read-only for old clients; prefer /journal
router.use('/trades', authenticate, tradeRoutes);
router.use('/day-reviews', authenticate, dayReviewRoutes);
router.use('/analytics', authenticate, analyticsRoutes);
router.use('/uploads', authenticate, uploadRoutes);

export default router;
