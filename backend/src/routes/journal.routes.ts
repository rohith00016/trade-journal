import { Router } from 'express';
import * as journalController from '../controllers/journal.controller';
import { validate } from '../middleware/validate';
import { journalEntrySchema, journalEntryUpdateSchema } from '../validators/schemas';

const router = Router();

router.get('/', journalController.list);
router.get('/export', journalController.exportJson);
router.get('/:id', journalController.getOne);
router.post('/', validate(journalEntrySchema), journalController.create);
router.put('/:id', validate(journalEntryUpdateSchema), journalController.update);
router.delete('/:id', journalController.remove);

export default router;
