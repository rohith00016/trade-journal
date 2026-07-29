import { Router } from 'express';
import { upload } from '../middleware/upload';
import * as uploadController from '../controllers/upload.controller';

const router = Router();

router.post(
  '/screenshot',
  upload.single('screenshot'),
  uploadController.uploadScreenshot
);

export default router;
