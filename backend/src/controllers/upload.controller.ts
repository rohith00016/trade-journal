import { asyncHandler, sendSuccess } from '../utils/api';
import { AppError } from '../types';
import { uploadScreenshotBuffer } from '../services/upload.service';

export const uploadScreenshot = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) {
    throw new AppError('Screenshot file is required', 400);
  }

  const uploaded = await uploadScreenshotBuffer(file.buffer);
  sendSuccess(res, uploaded, 201, 'Screenshot uploaded');
});
