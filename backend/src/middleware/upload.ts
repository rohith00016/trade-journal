import multer from 'multer';
import { AppError } from '../types';

const allowedMime = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMime.has(file.mimetype)) {
      cb(new AppError('Only JPG, PNG, WEBP, or GIF images are allowed', 400));
      return;
    }
    cb(null, true);
  },
});
