import { cloudinary, configureCloudinary, isCloudinaryConfigured } from '../config/cloudinary';
import { AppError } from '../types';

export async function uploadScreenshotBuffer(
  buffer: Buffer,
  folder = 'tradingjournal-pro/trades'
) {
  if (!isCloudinaryConfigured() || !configureCloudinary()) {
    throw new AppError(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      503
    );
  }

  return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [
          { width: 1920, height: 1080, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error || !result) {
          reject(
            new AppError(
              error?.message || 'Failed to upload screenshot to Cloudinary',
              502
            )
          );
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );
    stream.end(buffer);
  });
}
