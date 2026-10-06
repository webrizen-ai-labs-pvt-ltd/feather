/**
 * Train wagons for loading staff: tap a wagon when it is fully empty (a single bag left
 * still costs a late fee). Works offline — taps wait on the phone and are sent later.
 */
import { Check, CloudBlank01 } from '@untitledui/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Card, ConfirmDialog, cx, Meter, newId, useToast } from '@feather/ui';
import { useOutbox } from '@/lib/outbox.jsx';

export const emptiedWagons = (c) => new Set((c.wagonsEmptied ?? []).map((w) => w.no));

export function WagonBoard({ consignment: c }) {
  const { submit, items: outbox } = useOutbox();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const [undo, setUndo] = useState(null);
  // The dialog fades out after closing — keep showing the last wagon number meanwhile.
  const lastUndo = useRef(null);
  if (undo !== null) lastUndo.current = undo;
  const path = `/consignments/${c._id}/wagons`;

  // Server marks, then taps still waiting on this phone (oldest first, so the last tap wins).
  const emptied = emptiedWagons(c);
  const waiting = new Set();
  for (const entry of outbox.filter((e) => e.path === path)) {
    waiting.add(entry.fields.no);
    if (entry.fields.emptied) emptied.add(entry.fields.no);
    else emptied.delete(entry.fields.no);
  }
  const total = c.wagonCount;
  const done = [...emptied].filter((n) => n <= total).length;
  const left = Array.from({ length: total }, (_, i) => i + 1).filter((n) => !emptied.has(n));
  const canMark = c.status === 'placed';

  async function mark(no, isEmptied) {
    setBusy(no);
    try {
      const res = await submit({ path, fields: { clientId: newId(), no, emptied: isEmptied, deviceTime: new Date().toISOString() }, label: `Wagon ${no} ${isEmptied ? 'empty' : 'not empty'} · ${c.referenceNo}` });
      if (res.queued) toast(`Wagon ${no} saved on phone — it will be sent when the network is back`, 'warn');
      else toast(isEmptied ? `Wagon ${no} marked empty` : `Wagon ${no} marked not empty`);
      await qc.invalidateQueries({ queryKey: ['/consignments'] });
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setBusy(null);
      setUndo(null);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-primary">
          Wagons emptied: {done} of {total}
        </p>
        <p className="text-sm text-tertiary">{left.length ? `${left.length} left` : 'All empty'}</p>
      </div>
      <Meter className="mt-2" value={done} max={total} tone={left.length ? 'brand' : 'good'} />
      <ul className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-8" aria-label={`Wagons of ${c.referenceNo}`}>
        {Array.from({ length: total }, (_, i) => i + 1).map((no) => {
          const isEmpty = emptied.has(no);
          const isWaiting = waiting.has(no);
          return (
            <li key={no}>
              <button
                type="button"
                disabled={!canMark || busy === no}
                aria-pressed={isEmpty}
                aria-label={`Wagon ${no}, ${isEmpty ? 'empty' : 'not empty'}${isWaiting ? ', waiting to send' : ''}`}
                onClick={() => (isEmpty ? setUndo(no) : mark(no, true))}
                className={cx(
                  'relative flex h-14 w-full flex-col items-center justify-center rounded-lg text-md font-semibold tabular-nums outline-focus-ring transition focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-60',
                  isEmpty ? 'bg-success-solid text-white' : 'bg-primary text-secondary ring-1 ring-primary ring-inset hover:bg-primary_hover',
                  isWaiting && 'ring-2 ring-fg-warning-secondary',
                )}
              >
                {no}
                {isEmpty && <Check className="size-4" aria-hidden />}
                {isWaiting && <CloudBlank01 className="absolute top-1 right-1 size-3.5 text-current" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-tertiary">
        {canMark
          ? left.length
            ? `Tap a wagon only when it is fully empty — even one bag left is charged. Still to empty: ${left.join(', ')}.`
            : 'Every wagon is empty. Tap "All unloaded — finish" below.'
          : 'Mark the train as arrived to start marking wagons.'}
      </p>
      <ConfirmDialog
        open={undo !== null}
        onClose={() => setUndo(null)}
        loading={busy === undo}
        title={`Wagon ${lastUndo.current} is not empty?`}
        message="Use this only if it was marked empty by mistake."
        confirmLabel="Mark not empty"
        onConfirm={() => mark(undo, false)}
      />
    </Card>
  );
}
