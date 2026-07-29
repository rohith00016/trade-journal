import { Response } from 'express';
import { AuthedRequest } from '../types';
import { asyncHandler, sendSuccess } from '../utils/api';
import * as authService from '../services/auth.service';

export const register = asyncHandler(async (req, res) => {
  const result = await authService.registerUser(req.body);
  sendSuccess(res, result, 201, 'Registered successfully');
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.loginUser(req.body);
  sendSuccess(res, result, 200, 'Logged in successfully');
});

export const me = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const user = await authService.getMe(req.user!.id);
  sendSuccess(res, user);
});
