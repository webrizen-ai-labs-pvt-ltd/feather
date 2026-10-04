/** Small building blocks for the field-phone forms (numbered steps, success screen). */
import { CheckCircle, CloudBlank01 } from '@untitledui/icons';
import { formatINR } from '@feather/shared';
import { Alert, Card, FeaturedIcon, NumberField, SwitchField, TextAreaField } from '@feather/ui';

/**
 * An owner rate (price per truck, labour cost) with a switch to ask for a different amount.
 * The new amount is only a request — the owner approves it.
 */
export function RateRequest({ label, quoted, details, asking, onAskingChange, value, onChange, error, reason, onReasonChange, reasonError, askLabel, askHint, reasonPlaceholder }) {
  return (
    <>
      <Readout label={`${label} (set by owner)`} value={quoted != null ? formatINR(quoted) : 'Not set'} />
      {details && <p className="-mt-2 text-center text-sm text-tertiary">{details}</p>}
      <SwitchField label={askLabel} hint={askHint} checked={asking} onChange={onAskingChange} />
      {asking && (
        <>
          <NumberField big required label={`New ${label.toLowerCase()}`} prefix="₹" value={value} onChange={onChange} error={error} />
          <TextAreaField label="Why is it different?" placeholder={reasonPlaceholder} value={reason} onChange={onReasonChange} error={reasonError} isRequired />
          <Alert tone="gray" title="The owner must approve this.">
            The owner gets a notification. Until they approve it, the owner&apos;s amount is used.
          </Alert>
        </>
      )}
    </>
  );
}

/** A numbered step of a form: "1  Where is it going?" */
export function FormStep({ n, title, description, children }) {
  return (
    <Card>
      <div className="flex items-start gap-3 border-b border-secondary px-4 py-4 sm:px-6">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-solid text-sm font-bold text-white">{n}</span>
        <div>
          <h2 className="text-md font-semibold text-primary">{title}</h2>
          {description && <p className="text-sm text-tertiary">{description}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-5 p-4 sm:p-6">{children}</div>
    </Card>
  );
}

/** Big read-out of a worked-out number (e.g. material weight). */
export function Readout({ label, value }) {
  return (
    <div className="rounded-xl bg-secondary px-4 py-4 text-center ring-1 ring-secondary">
      <p className="text-sm text-tertiary">{label}</p>
      <p className="mt-1 text-display-sm font-semibold text-primary tabular-nums">{value}</p>
    </div>
  );
}

/** Shown after a save: sent to office, or saved on the phone. */
export function SavedScreen({ queued, title, lines = [], action }) {
  return (
    <Card className="flex flex-col items-center px-6 py-10 text-center">
      <FeaturedIcon icon={queued ? CloudBlank01 : CheckCircle} color={queued ? 'warning' : 'success'} theme="light" size="xl" />
      <h2 className="mt-5 text-display-xs font-semibold text-primary">{queued ? 'Saved on phone' : title}</h2>
      {lines.map((l, i) => (
        <p key={i} className="mt-1 text-md text-tertiary">
          {l}
        </p>
      ))}
      {queued && <p className="mt-3 max-w-sm text-sm text-tertiary">No network now. It will be sent by itself when the signal comes back.</p>}
      <div className="mt-8 w-full max-w-sm">{action}</div>
    </Card>
  );
}
