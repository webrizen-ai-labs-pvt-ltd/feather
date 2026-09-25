import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { ALERT_SEVERITY, ALERT_TYPES, pinSchema, ROLES, userSchema } from '@feather/shared';
import { requireRole } from '@/middleware/auth.js';
import { validate } from '@/middleware/validate.js';
import { User } from '@/models/index.js';
import { raiseAlert } from '@/services/alerts.js';
import { audit } from '@/services/audit.js';
import { badRequest, notFound } from '@/utils/http.js';

const router = Router();
router.use(requireRole(ROLES.OWNER));

const isField = (role) => role === ROLES.SIDING_SUPERVISOR || role === ROLES.GATE_INSPECTOR;

router.get('/', async (_req, res) => {
  const users = await User.find().populate('locations', 'name type').sort({ role: 1, name: 1 });
  res.json({ users });
});

router.post('/', validate(userSchema), async (req, res) => {
  const { pin, ...data } = req.valid;
  if (isField(data.role) && !pin) throw badRequest('Set a PIN for field staff.', { fields: { pin: 'Required' } });
  const user = new User(data);
  if (pin) user.pinHash = await bcrypt.hash(pin, 10);
  await user.save();
  await audit(req, { action: 'user.create', entity: 'User', entityId: user._id, after: { name: user.name, role: user.role } });
  res.status(201).json({ user });
});

router.patch('/:id', validate(userSchema), async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw notFound('User');
  if (String(user._id) === String(req.user._id) && (req.valid.role !== ROLES.OWNER || !req.valid.active)) {
    throw badRequest('You cannot remove your own owner access.');
  }
  const { pin, ...data } = req.valid;
  const before = { role: user.role, active: user.active, locations: user.locations.map(String) };
  const accessChanged = before.role !== data.role || before.active !== data.active;
  Object.assign(user, { ...data, email: data.email ?? undefined, phone: data.phone ?? undefined });
  if (pin) user.pinHash = await bcrypt.hash(pin, 10);
  if (accessChanged || pin) user.tokenVersion += 1; // log out on role / access change
  await user.save();
  await audit(req, { action: 'user.update', entity: 'User', entityId: user._id, before, after: { role: user.role, active: user.active, locations: data.locations } });
  res.json({ user });
});

router.post('/:id/reset-pin', validate(z.object({ pin: pinSchema })), async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw notFound('User');
  if (!isField(user.role)) throw badRequest('Only field staff use a PIN.');
  user.pinHash = await bcrypt.hash(req.valid.pin, 10);
  user.pinFailures = 0;
  user.pinLockedUntil = undefined;
  user.tokenVersion += 1;
  await user.save();
  await audit(req, { action: 'user.reset_pin', entity: 'User', entityId: user._id });
  await raiseAlert({
    type: ALERT_TYPES.PIN_RESET,
    severity: ALERT_SEVERITY.INFO,
    title: `PIN changed for ${user.name}`,
    lines: [`${req.user.name} changed the login PIN for ${user.name} (${user.phone}).`, 'If you did not do this, deactivate the user now.'],
  });
  res.json({ ok: true });
});

export default router;
