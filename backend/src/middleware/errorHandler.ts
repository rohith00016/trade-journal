import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError } from '../types';
import { env } from '../config/env';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  let statusCode = err instanceof AppError ? err.statusCode : 500;
  let message =
    err instanceof AppError
      ? err.message
      : env.nodeEnv === 'production'
        ? 'Internal server error'
        : err.message;

  if (err instanceof multer.MulterError) {
    statusCode = 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Screenshot must be 8MB or smaller'
        : err.message;
  }

  if (env.nodeEnv !== 'production' && !(err instanceof AppError)) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
}
