import { Router } from 'express';
import { CONSIGNMENT_STATUS, ROLES, settingsSchema, TRIP_STATUS } from '@feather/shared';
import { requireRole } from '@/middleware/auth.js';
import { validate } from '@/middleware/validate.js';
import { Alert, AuditLog, Consignment, Trip } from '@/models/index.js';
import { audit } from '@/services/audit.js';
import { creditOverview, freightSummary, pipeline, transporterScorecard } from '@/services/reports.js';
import { getSettings, saveSettings } from '@/services/settings.js';
import { pageParams } from '@/utils/http.js';
import { withClock } from '@/routes/consignments.js';

const router = Router();
router.use(requireRole(ROLES.OWNER));

router.get('/dashboard', async (_req, res) => {
  const settings = await getSettings();
  const [flow, scorecard, credit, freight, liveRakes, unreadAlerts, recentAlerts, inTransit] = await Promise.all([
    pipeline(),
    transporterScorecard(30),
    creditOverview(),
    freightSummary(),
    Consignment.find({ status: CONSIGNMENT_STATUS.PLACED }).populate('material', 'name unit').populate('location', 'name').lean(),
    Alert.countDocuments({ readAt: null }),
    Alert.find().sort({ createdAt: -1 }).limit(8).lean(),
    Trip.find({ status: TRIP_STATUS.IN_TRANSIT }, 'loading.at expectedTransitHours breakdown').lean(),
  ]);
  const now = Date.now();
  const delayed = inTransit.filter(
    (t) => t.breakdown?.active || now - new Date(t.loading.at) > (t.expectedTransitHours ?? settings.defaultExpectedTransitHours) * 3_600_000,
  ).length;
  res.json({
    pipeline: flow,
    scorecard,
    credit: {
      blocked: credit.filter((c) => c.credit.blocked).length,
      totalOutstanding: credit.reduce((s, c) => s + c.credit.outstanding, 0),
      totalOverdue: credit.reduce((s, c) => s + c.credit.overdueAmount, 0),
      top: credit.slice(0, 10),
    },
    freight,
    liveRakes: liveRakes.map((c) => withClock(c, settings)),
    delayedTrips: delayed,
    unreadAlerts,
    recentAlerts,
  });
});

router.get('/scorecard', async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  res.json({ days, items: await transporterScorecard(days) });
});

router.get('/alerts', async (req, res) => {
  const { limit, skip, page } = pageParams(req.query);
  const filter = req.query.unread === 'true' ? { readAt: null } : {};
  const [items, total] = await Promise.all([
    Alert.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('trip', 'tripNo').populate('customer', 'name').lean(),
    Alert.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit });
});

router.post('/alerts/read', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
  await Alert.updateMany(ids ? { _id: { $in: ids }, readAt: null } : { readAt: null }, { readAt: new Date() });
  res.json({ ok: true });
});

router.get('/audit', async (req, res) => {
  const { limit, skip, page } = pageParams(req.query);
  const filter = {};
  if (req.query.entity) filter.entity = req.query.entity;
  if (req.query.entityId) filter.entityId = req.query.entityId;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit });
});

router.get('/settings', async (_req, res) => res.json({ settings: await getSettings() }));

router.put('/settings', validate(settingsSchema), async (req, res) => {
  const before = await getSettings();
  const settings = await saveSettings(req.valid);
  await audit(req, { action: 'settings.update', entity: 'Setting', before, after: req.valid });
  res.json({ settings });
});

export default router;
