import { Counter } from '@/models/index.js';

const yymm = (d = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', year: '2-digit', month: '2-digit' }).formatToParts(d);
  return parts.find((p) => p.type === 'year').value + parts.find((p) => p.type === 'month').value;
};

/** Next running number, reset monthly per prefix. e.g. TRP-2609-00042 */
export async function nextNumber(prefix) {
  const period = yymm();
  const { seq } = await Counter.findOneAndUpdate(
    { _id: `${prefix}-${period}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  ).lean();
  return `${prefix}-${period}-${String(seq).padStart(5, '0')}`;
}
