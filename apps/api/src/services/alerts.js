import { ALERT_SEVERITY, ROLES } from '@feather/shared';
import { Alert, User } from '@/models/index.js';
import { sendMail } from '@/services/mailer.js';
import { getSettings } from '@/services/settings.js';

async function ownerEmails() {
  const [owners, settings] = await Promise.all([
    User.find({ role: ROLES.OWNER, active: true, email: { $type: 'string' } }, 'email').lean(),
    getSettings(),
  ]);
  return [...new Set([...owners.map((o) => o.email), ...(settings.alertEmails ?? [])])];
}

/**
 * Save an alert for the owner dashboard and email it.
 * Email failures never break the request that raised the alert.
 */
export async function raiseAlert({ type, severity = ALERT_SEVERITY.WARNING, title, lines = [], trip, consignment, customer, email = true }) {
  const alert = await Alert.create({ type, severity, title, message: lines.join('\n'), trip, consignment, customer });
  if (email) {
    ownerEmails()
      .then((to) => sendMail({ to, subject: title, lines }))
      .then(() => Alert.updateOne({ _id: alert._id }, { emailedAt: new Date() }))
      .catch((err) => console.error('[alerts] email failed:', err.message));
  }
  return alert;
}
