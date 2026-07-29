import { Router } from 'express';
import * as dayReviewController from '../controllers/dayReview.controller';
import { validate } from '../middleware/validate';
import { dayReviewSchema } from '../validators/schemas';

const router = Router();

router.get('/', dayReviewController.list);
router.get('/:date', dayReviewController.getByDate);
router.put('/', validate(dayReviewSchema), dayReviewController.upsert);
router.delete('/:date', dayReviewController.remove);

export default router;
