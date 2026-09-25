import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { EMAIL_LOGIN_ROLES, otpRequestSchema, otpVerifySchema, PIN_LOGIN_ROLES, pinLoginSchema } from '@feather/shared';
import { env } from '@/config/env.js';
import { authenticate, signToken } from '@/middleware/auth.js';
import { validate } from '@/middleware/validate.js';
import { Otp, User } from '@/models/index.js';
import { sendMail } from '@/services/mailer.js';
import { HttpError } from '@/utils/http.js';

const router = Router();

const OTP_TTL_MIN = 10;
const OTP_MAX_ATTEMPTS = 5;
const PIN_MAX_FAILURES = 5;
const PIN_LOCK_MIN = 15;

const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
const hashCode = (email, code) => crypto.createHmac('sha256', env.jwtSecret).update(`${email}:${code}`).digest('hex');
const sameHash = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

const session = (user) => ({ token: signToken(user), user: user.toJSON ? user.toJSON() : user });

router.post('/otp/request', limiter, validate(otpRequestSchema), async (req, res) => {
  const email = req.valid.email.toLowerCase();
  const user = await User.findOne({ email, active: true, role: { $in: EMAIL_LOGIN_ROLES } });
  // Same reply either way, so nobody can find out which emails have accounts.
  const reply = { ok: true, message: 'If this email is registered, a login code has been sent.' };
  if (!user) return res.json(reply);

  const recent = await Otp.findOne({ email, createdAt: { $gt: new Date(Date.now() - 60_000) } });
  if (recent) throw new HttpError(429, 'Please wait one minute before asking for a new code.');

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await Otp.deleteMany({ email });
  await Otp.create({ email, codeHash: hashCode(email, code), expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000) });
  await sendMail({
    to: email,
    subject: `Your login code is ${code}`,
    title: 'Your login code',
    lines: [`Hello ${user.name},`, `Your login code is: ${code}`, `It is valid for ${OTP_TTL_MIN} minutes. Do not share it with anyone.`],
  });
  res.json(reply);
});

router.post('/otp/verify', limiter, validate(otpVerifySchema), async (req, res) => {
  const email = req.valid.email.toLowerCase();
  const otp = await Otp.findOne({ email, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
  const wrong = new HttpError(400, 'Wrong or expired code. Please try again.', { code: 'BAD_OTP' });
  if (!otp) throw wrong;
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    await otp.deleteOne();
    throw new HttpError(429, 'Too many wrong tries. Ask for a new code.');
  }
  if (!sameHash(otp.codeHash, hashCode(email, req.valid.code))) {
    otp.attempts += 1;
    await otp.save();
    throw wrong;
  }
  await otp.deleteOne();
  const user = await User.findOne({ email, active: true, role: { $in: EMAIL_LOGIN_ROLES } });
  if (!user) throw wrong;
  user.lastLoginAt = new Date();
  await user.save();
  res.json(session(user));
});

router.post('/pin/login', limiter, validate(pinLoginSchema), async (req, res) => {
  const { phone, pin } = req.valid;
  const user = await User.findOne({ phone, active: true, role: { $in: PIN_LOGIN_ROLES } }).select('+pinHash');
  const wrong = new HttpError(400, 'Wrong phone number or PIN.', { code: 'BAD_PIN' });
  if (!user || !user.pinHash) throw wrong;
  if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
    throw new HttpError(423, `Too many wrong PINs. Try again after ${PIN_LOCK_MIN} minutes or ask the owner.`, { code: 'PIN_LOCKED' });
  }
  if (!(await bcrypt.compare(pin, user.pinHash))) {
    user.pinFailures += 1;
    if (user.pinFailures >= PIN_MAX_FAILURES) {
      user.pinFailures = 0;
      user.pinLockedUntil = new Date(Date.now() + PIN_LOCK_MIN * 60_000);
    }
    await user.save();
    throw wrong;
  }
  user.pinFailures = 0;
  user.pinLockedUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();
  res.json(session(user));
});

router.get('/me', authenticate, async (req, res) => {
  const user = await User.findById(req.user._id).populate('locations', 'name type');
  res.json({ user });
});

export default router;
