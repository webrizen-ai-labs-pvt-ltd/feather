import { DEFAULT_SETTINGS } from '@feather/shared';
import { Setting } from '@/models/index.js';

let cache = null;
let cachedAt = 0;
const TTL_MS = 30_000;

export async function getSettings() {
  if (cache && Date.now() - cachedAt < TTL_MS) return cache;
  const doc = await Setting.findById('global').lean();
  cache = { ...DEFAULT_SETTINGS, ...(doc ?? {}) };
  delete cache._id;
  delete cache.__v;
  cachedAt = Date.now();
  return cache;
}

export async function saveSettings(values) {
  await Setting.findByIdAndUpdate('global', { $set: values }, { upsert: true, setDefaultsOnInsert: true });
  cache = null;
  return getSettings();
}
