import { Router } from 'express';
import * as tradeController from '../controllers/trade.controller';
import { validate } from '../middleware/validate';
import { tradeSchema } from '../validators/schemas';

const router = Router();

router.get('/', tradeController.list);
router.get('/:id', tradeController.getOne);
router.post('/', validate(tradeSchema), tradeController.create);
router.put('/:id', validate(tradeSchema.partial()), tradeController.update);
router.delete('/:id', tradeController.remove);

export default router;
