import nodemailer from 'nodemailer';
import { APP_NAME, COMPANY_NAME } from '@feather/shared';
import { env } from '@/config/env.js';

let transporter;

function getTransport() {
  if (transporter) return transporter;
  transporter = env.smtp.host
    ? nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.secure,
        auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
      })
    : // Development: print the email instead of sending it.
      nodemailer.createTransport({ jsonTransport: true });
  return transporter;
}

const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Simple, email-client-safe layout. Uses text wordmark (SVG logos do not render in Gmail/Outlook). */
function layout(title, lines, action) {
  const body = lines.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#1f2937">${escapeHtml(l)}</p>`).join('');
  const button = action
    ? `<p style="margin:20px 0"><a href="${escapeHtml(action.url)}" style="background:#d97706;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">${escapeHtml(action.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Segoe UI,Roboto,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:10px;overflow:hidden">
<tr><td style="background:#1f2937;padding:16px 24px;color:#fbbf24;font-size:18px;font-weight:700;letter-spacing:.5px">${APP_NAME}</td></tr>
<tr><td style="padding:24px"><h1 style="margin:0 0 16px;font-size:18px;color:#111827">${escapeHtml(title)}</h1>${body}${button}</td></tr>
<tr><td style="padding:14px 24px;background:#f9fafb;color:#6b7280;font-size:12px">${COMPANY_NAME}</td></tr>
</table></td></tr></table></body></html>`;
}

/**
 * @param {{ to: string|string[], subject: string, title?: string, lines: string[], action?: {label:string,url:string} }} msg
 */
export async function sendMail({ to, subject, title, lines, action }) {
  const recipients = [].concat(to).filter(Boolean);
  if (!recipients.length) return null;
  const info = await getTransport().sendMail({
    from: env.smtp.from,
    to: recipients.join(', '),
    subject: `${APP_NAME}: ${subject}`,
    text: [title ?? subject, '', ...lines, action ? `\n${action.label}: ${action.url}` : ''].join('\n'),
    html: layout(title ?? subject, lines, action),
  });
  if (!env.smtp.host) console.log(`[mail:dev] to=${recipients.join(',')} subject="${subject}"\n  ${lines.join('\n  ')}`);
  return info;
}
