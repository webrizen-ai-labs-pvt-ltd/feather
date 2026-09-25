/**
 * Offline outbox. Every field entry goes through here:
 *  - online  → sent straight away
 *  - offline → saved on the phone (IndexedDB, photo included) and sent
 *              automatically when the network comes back.
 * Each entry carries a clientId, so a retry can never create a duplicate on the server.
 */
import { createStore, del, entries, set } from 'idb-keyval';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApi, useToast } from '@feather/ui';

const store = createStore('feather-ops', 'outbox');
const OutboxContext = createContext(null);

function toForm(fields, photo) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null && v !== '') form.append(k, String(v));
  if (photo) {
    form.append('photo', photo.blob, 'photo.jpg');
    if (photo.geo) {
      form.append('lat', photo.geo.lat);
      form.append('lng', photo.geo.lng);
      form.append('accuracy', photo.geo.accuracy);
    }
  }
  return form;
}

export function OutboxProvider({ children }) {
  const api = useApi();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const flushing = useRef(false);

  const reload = useCallback(async () => {
    const all = await entries(store).catch(() => []);
    setItems(all.map(([, v]) => v).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  }, []);

  const send = useCallback(
    (entry) => (entry.photo ? api.upload(entry.path, toForm(entry.fields, entry.photo)) : api.post(entry.path, entry.fields)),
    [api],
  );

  const flush = useCallback(async () => {
    if (flushing.current || !navigator.onLine) return;
    flushing.current = true;
    let sent = 0;
    try {
      for (const [key, entry] of await entries(store)) {
        if (entry.status === 'failed') continue;
        try {
          await send({ ...entry, fields: { ...entry.fields, wasOffline: true } });
          await del(key, store);
          sent += 1;
        } catch (err) {
          if (err.isNetwork) break; // still offline — try later
          await set(key, { ...entry, status: 'failed', error: err.message }, store); // server said no — needs a person
        }
      }
    } finally {
      flushing.current = false;
      await reload();
      if (sent) toast(`${sent} saved entr${sent === 1 ? 'y' : 'ies'} sent to office`);
    }
  }, [send, reload, toast]);

  useEffect(() => {
    reload();
    flush();
    window.addEventListener('online', flush);
    const timer = setInterval(flush, 30_000);
    return () => {
      window.removeEventListener('online', flush);
      clearInterval(timer);
    };
  }, [flush, reload]);

  /**
   * Try to send now; if there is no network, keep it in the outbox.
   * Returns { queued: true } or { queued: false, data }. Throws on server validation errors.
   */
  const submit = useCallback(
    async ({ path, fields, photo, label }) => {
      const entry = { id: fields.clientId, path, fields, photo, label, createdAt: new Date().toISOString(), status: 'pending' };
      try {
        const data = await send(entry);
        return { queued: false, data };
      } catch (err) {
        if (!err.isNetwork) throw err;
        await set(entry.id, entry, store);
        await reload();
        return { queued: true };
      }
    },
    [send, reload],
  );

  const remove = useCallback(async (id) => {
    await del(id, store);
    await reload();
  }, [reload]);

  const retry = useCallback(
    async (id) => {
      const entry = items.find((i) => i.id === id);
      if (entry) await set(id, { ...entry, status: 'pending', error: undefined }, store);
      await flush();
    },
    [items, flush],
  );

  const value = useMemo(() => ({ items, submit, flush, remove, retry }), [items, submit, flush, remove, retry]);
  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>;
}

export const useOutbox = () => useContext(OutboxContext);
