import { TIMEZONE } from './constants.js';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const num = (digits) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** ₹12,34,567 */
export const formatINR = (value) => (value === null || value === undefined ? '—' : inr.format(value));

/** ₹25.0 L / ₹1.2 Cr — compact Indian money for dashboards. */
export function formatLakh(value) {
  if (value === null || value === undefined) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1e7) return `${sign}₹${num(2).format(abs / 1e7)} Cr`;
  if (abs >= 1e5) return `${sign}₹${num(2).format(abs / 1e5)} L`;
  return `${sign}${inr.format(abs)}`;
}

export const formatNumber = (value, digits = 2) => (value === null || value === undefined ? '—' : num(digits).format(value));

export function formatQty(value, unit = 'MT') {
  if (value === null || value === undefined) return '—';
  if (unit === 'bag') return `${num(0).format(value)} bags`;
  return `${num(3).format(value)} ${unit}`;
}

export const formatPct = (value, digits = 2) => (value === null || value === undefined ? '—' : `${num(digits).format(value)}%`);

const dt = new Intl.DateTimeFormat('en-IN', {
  timeZone: TIMEZONE,
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});
const d = new Intl.DateTimeFormat('en-IN', { timeZone: TIMEZONE, day: '2-digit', month: 'short', year: 'numeric' });
const t = new Intl.DateTimeFormat('en-IN', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: true });

export const formatDateTime = (value) => (value ? dt.format(new Date(value)) : '—');
export const formatDate = (value) => (value ? d.format(new Date(value)) : '—');
export const formatTime = (value) => (value ? t.format(new Date(value)) : '—');

/** 2.5 → "2h 30m", -1.25 → "−1h 15m" */
export function formatHours(hours) {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return '—';
  const sign = hours < 0 ? '−' : '';
  const totalMin = Math.round(Math.abs(hours) * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${sign}${h}h ${String(m).padStart(2, '0')}m`;
}

/** "MH 12 AB 1234" style display from stored "MH12AB1234". */
export function formatVehicleNo(value = '') {
  const m = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{4})$/.exec(value);
  return m ? [m[1], m[2], m[3], m[4]].filter(Boolean).join(' ') : value;
}

export const normalizeVehicleNo = (value = '') => String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
