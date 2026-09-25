import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { createContext, useCallback, useContext, useState } from 'react';
import { Button } from './basics.jsx';
import { TextAreaField } from './forms.jsx';

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }[size];
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop transition className="fixed inset-0 bg-ink-950/50 transition-opacity data-closed:opacity-0" />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-end justify-center sm:items-center sm:p-4">
          <DialogPanel
            transition
            className={clsx(
              'w-full rounded-t-2xl bg-white shadow-xl transition data-closed:translate-y-4 data-closed:opacity-0 sm:rounded-2xl',
              width,
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
              <div>
                <DialogTitle className="text-lg font-semibold text-ink-900">{title}</DialogTitle>
                {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
              </div>
              <button type="button" onClick={onClose} className="-m-1 rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Close">
                <XMarkIcon className="size-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-ink-100 px-5 py-3">{footer}</div>}
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

/** Confirm an action. With `needReason`, a written reason is required (goes to the audit log). */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'primary', needReason = false, loading }) {
  const [reason, setReason] = useState('');
  const short = needReason && reason.trim().length < 5;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={variant} loading={loading} disabled={short} onClick={() => onConfirm(reason.trim())}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message && <div className="text-sm text-ink-700">{message}</div>}
      {needReason && (
        <TextAreaField
          className="mt-4"
          label="Reason"
          hint="At least 5 letters. This is saved in the audit log."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      )}
    </Modal>
  );
}

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, tone = 'good') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'bad' ? 7000 : 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg',
              t.tone === 'bad' ? 'bg-red-700' : t.tone === 'warn' ? 'bg-amber-600' : 'bg-ink-900',
            )}
          >
            {t.tone === 'good' ? <CheckCircleIcon className="size-5 shrink-0 text-emerald-400" /> : <ExclamationTriangleIcon className="size-5 shrink-0" />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** toast('Saved') · toast('Failed', 'bad') · toast('Check this', 'warn') */
export const useToast = () => useContext(ToastContext);
