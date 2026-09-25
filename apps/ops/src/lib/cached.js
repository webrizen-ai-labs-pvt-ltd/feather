import { useEffect } from 'react';
import { useGet } from '@feather/ui';

const KEY = 'feather.ops.cache:';
const read = (k) => {
  try {
    return JSON.parse(localStorage.getItem(KEY + k) ?? 'null') ?? undefined;
  } catch {
    return undefined;
  }
};

/**
 * Like useGet, but remembers the last answer on the phone so lists (rakes,
 * transporters, arrivals) still show after the app is reopened with no signal.
 */
export function useCachedGet(path, query, options = {}) {
  const cacheKey = `${path}?${new URLSearchParams(query ?? {}).toString()}`;
  const result = useGet(path, query, { placeholderData: () => read(cacheKey), ...options });
  useEffect(() => {
    if (result.data && !result.isPlaceholderData) {
      try {
        localStorage.setItem(KEY + cacheKey, JSON.stringify(result.data));
      } catch {
        /* storage full or blocked — fine, just no offline copy */
      }
    }
  }, [result.data, result.isPlaceholderData, cacheKey]);
  return result;
}
