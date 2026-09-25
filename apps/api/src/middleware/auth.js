import jwt from 'jsonwebtoken';
import { env } from '@/config/env.js';
import { User } from '@/models/index.js';
import { forbidden, HttpError } from '@/utils/http.js';

export const signToken = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role, tv: user.tokenVersion ?? 0 }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });

const unauthorized = () => new HttpError(401, 'Please log in again.', { code: 'UNAUTHORIZED' });

export async function authenticate(req, _res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw unauthorized();
  }
  const user = await User.findById(payload.sub).lean();
  // A PIN reset / deactivation bumps tokenVersion, which logs the user out everywhere.
  if (!user || !user.active || (user.tokenVersion ?? 0) !== payload.tv) throw unauthorized();
  req.user = user;
  next();
}

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user?.role)) throw forbidden();
    next();
  };
