import { Router } from 'express';
import * as strategyController from '../controllers/strategy.controller';
import { validate } from '../middleware/validate';
import { createVersionSchema, strategySchema } from '../validators/schemas';

const router = Router();

router.get('/', strategyController.list);
router.get('/:id', strategyController.getOne);
router.post('/', validate(strategySchema), strategyController.create);
router.put('/:id', validate(strategySchema), strategyController.update);
router.post('/:id/archive', strategyController.archive);
router.post('/:id/duplicate', strategyController.duplicate);
router.post(
  '/:id/versions',
  validate(createVersionSchema),
  strategyController.createVersion
);
router.get('/:id/versions', strategyController.versions);

export default router;
