import bcrypt from 'bcryptjs';
import { User } from '../models';
import { AppError } from '../types';
import { signToken } from '../middleware/auth';

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) {
    throw new AppError('Email already registered', 409);
  }

  const password = await bcrypt.hash(input.password, 12);
  const user = await User.create({
    name: input.name,
    email: input.email.toLowerCase(),
    password,
  });

  const token = signToken({
    id: user.id,
    email: user.email,
    name: user.name,
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      preferences: user.preferences,
    },
  };
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await User.findOne({ email: input.email.toLowerCase() }).select(
    '+password'
  );
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  const ok = await bcrypt.compare(input.password, user.password);
  if (!ok) {
    throw new AppError('Invalid email or password', 401);
  }

  const token = signToken({
    id: user.id,
    email: user.email,
    name: user.name,
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      preferences: user.preferences,
    },
  };
}

export async function getMe(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    preferences: user.preferences,
    avatarUrl: user.avatarUrl,
  };
}
