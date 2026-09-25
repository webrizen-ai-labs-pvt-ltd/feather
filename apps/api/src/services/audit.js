import { AuditLog } from '@/models/index.js';

/** Record who changed what, and why. Audit rows are never edited or deleted. */
export function audit(req, { action, entity, entityId, reason, before, after }) {
  return AuditLog.create({
    actor: req.user?._id,
    actorName: req.user?.name,
    actorRole: req.user?.role,
    action,
    entity,
    entityId,
    reason,
    before,
    after,
    ip: req.ip,
  });
}
