import { Response, NextFunction } from 'express';
import { AppError, AuthedRequest } from '../types';

type AsyncHandler = (
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

export const asyncHandler =
  (fn: AsyncHandler) => (req: AuthedRequest, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  message?: string
) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function notFound(resource = 'Resource'): AppError {
  return new AppError(`${resource} not found`, 404);
}

export function badRequest(message: string): AppError {
  return new AppError(message, 400);
}
