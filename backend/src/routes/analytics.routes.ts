import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller';

const router = Router();

router.get('/dashboard', analyticsController.dashboard);
router.get('/insights', analyticsController.insights);

export default router;
