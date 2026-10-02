/** Dialogs and toasts built on Untitled UI modals. */
import { AlertTriangle, CheckCircle, InfoCircle, XClose } from '@untitledui/icons';
import { createContext, useCallback, useContext, useState } from 'react';
import { Dialog, Modal as UuiModal, ModalOverlay } from '@uui/components/application/modals/modal';
import { Button } from '@uui/components/base/buttons/button';
import { CloseButton } from '@uui/components/base/buttons/close-button';
import { FeaturedIcon } from '@uui/components/foundations/featured-icon/featured-icon';
import { cx } from '@uui/utils/cx';
import { TextAreaField } from './forms.jsx';

const WIDTH = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

/**
 * @param {{ open: boolean, onClose: () => void, title: any, description?: any, icon?: any,
 *   tone?: 'brand'|'gray'|'error'|'warning'|'success', footer?: any, size?: 'sm'|'md'|'lg'|'xl', children?: any }} props
 */
export function Modal({ open, onClose, title, description, icon, tone = 'gray', children, footer, size = 'md' }) {
  return (
    <ModalOverlay isDismissable isOpen={open} onOpenChange={(o) => !o && onClose()}>
      <UuiModal className={WIDTH[size]}>
        <Dialog aria-label={typeof title === 'string' ? title : 'Dialog'}>
          <div className="relative w-full">
            <CloseButton onPress={onClose} theme="light" size="lg" className="absolute top-3 right-3" />
            <div className="flex flex-col gap-4 px-4 pt-5 sm:px-6 sm:pt-6">
              {icon && <FeaturedIcon icon={icon} color={tone} theme="light" size="lg" />}
              <div className="pr-8">
                <h2 className="text-md font-semibold text-primary">{title}</h2>
                {description && <p className="mt-1 text-sm text-tertiary">{description}</p>}
              </div>
            </div>
            {children && <div className="px-4 py-5 sm:px-6">{children}</div>}
            {footer && <div className="flex flex-col-reverse gap-3 border-t border-secondary px-4 py-4 sm:flex-row sm:justify-end sm:px-6">{footer}</div>}
          </div>
        </Dialog>
      </UuiModal>
    </ModalOverlay>
  );
}

/** Confirm an action. With `needReason`, a written reason is required (saved to History). */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'primary', needReason = false, loading, icon }) {
  const [reason, setReason] = useState('');
  const short = needReason && reason.trim().length < 5;
  const danger = variant === 'danger';
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      description={message}
      icon={icon ?? (danger ? AlertTriangle : InfoCircle)}
      tone={danger ? 'error' : 'brand'}
      footer={
        <>
          <Button color="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button color={danger ? 'primary-destructive' : 'primary'} isLoading={loading} isDisabled={short} onPress={() => onConfirm(reason.trim())}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {needReason && <TextAreaField label="Reason" hint="At least 5 letters. This is saved in History." value={reason} onChange={setReason} />}
    </Modal>
  );
}

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = (id) => setToasts((t) => t.filter((x) => x.id !== id));
  const push = useCallback((message, tone = 'good') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => dismiss(id), tone === 'bad' ? 7000 : 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-3 px-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end">
        {toasts.map((t) => {
          const Icon = t.tone === 'good' ? CheckCircle : AlertTriangle;
          const color = t.tone === 'good' ? 'success' : t.tone === 'warn' ? 'warning' : 'error';
          return (
            <div
              key={t.id}
              className={cx('pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-primary p-4 shadow-lg ring-1 ring-secondary duration-300 animate-in fade-in slide-in-from-bottom-2')}
            >
              <FeaturedIcon icon={Icon} color={color} theme="outline" size="sm" className="shrink-0" />
              <p className="flex-1 pt-1 text-sm font-semibold text-primary">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="rounded-md p-1 text-fg-quaternary hover:bg-primary_hover">
                <XClose className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/** toast('Saved') · toast('Failed', 'bad') · toast('Check this', 'warn') */
export const useToast = () => useContext(ToastContext);
