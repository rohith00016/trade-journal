import { Router } from 'express';
import * as accountController from '../controllers/account.controller';
import { validate } from '../middleware/validate';
import { accountSchema } from '../validators/schemas';

const router = Router();

router.get('/', accountController.list);
router.post('/', validate(accountSchema), accountController.create);
router.patch('/:id', validate(accountSchema.partial()), accountController.update);
router.delete('/:id', accountController.remove);

export default router;
