/** Small building blocks for writing help pages in plain JSX. */
import { AlertTriangle, ArrowDown, ArrowRight, Lightbulb02 } from '@untitledui/icons';
import { cx as clsx } from '@uui/utils/cx';

export const H = ({ children }) => <h3 className="mt-6 mb-2 text-base font-bold text-primary first:mt-0">{children}</h3>;
export const P = ({ children }) => <p className="my-2 leading-relaxed text-secondary">{children}</p>;

export const Steps = ({ children }) => (
  <ol className="my-3 space-y-2">
    {[].concat(children).filter(Boolean).map((step, i) => (
      <li key={i} className="flex gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-brand-secondary">{i + 1}</span>
        <span className="pt-0.5 leading-relaxed text-secondary">{step}</span>
      </li>
    ))}
  </ol>
);

export const Bullets = ({ children }) => (
  <ul className="my-3 list-disc space-y-1.5 pl-5 leading-relaxed text-secondary marker:text-fg-brand-secondary">
    {[].concat(children).filter(Boolean).map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
);

/** head = ['Word', 'Meaning'], rows = [['Rake', '…'], …] */
export const Table = ({ head, rows }) => (
  <div className="my-3 overflow-x-auto rounded-lg ring-1 ring-secondary">
    <table className="min-w-full divide-y divide-secondary text-sm">
      <thead className="bg-secondary">
        <tr>
          {head.map((h) => (
            <th key={h} className="px-3 py-2 text-left font-semibold text-secondary">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-secondary bg-primary">
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((cell, j) => (
              <td key={j} className={clsx('px-3 py-2 align-top leading-relaxed text-secondary', j === 0 && 'font-medium text-primary')}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const Note = ({ tone = 'tip', children }) => {
  const warn = tone === 'warn';
  const Icon = warn ? AlertTriangle : Lightbulb02;
  return (
    <div className={clsx('my-3 flex gap-2 rounded-lg px-3 py-2.5 text-sm leading-relaxed', warn ? 'bg-error-primary text-error-primary ring-1 ring-error_subtle' : 'bg-brand-primary text-brand-secondary ring-1 ring-brand_alt')}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
};

/** A coloured word that looks like the badge on screen. */
export const Chip = ({ tone = 'neutral', children }) => {
  const c = { good: 'bg-utility-green-50 text-utility-green-700 ring-utility-green-200', warn: 'bg-utility-orange-50 text-utility-orange-700 ring-utility-orange-200', bad: 'bg-utility-red-50 text-utility-red-700 ring-utility-red-200', neutral: 'bg-utility-neutral-50 text-utility-neutral-700 ring-utility-neutral-200' }[tone];
  return <span className={clsx('inline-block rounded-md px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap', c)}>{children}</span>;
};

/** The truck's journey: who enters what at each step. */
export function JourneyFlow() {
  const steps = [
    ['Shipment arrives', 'Office adds Paper no.. Unloading point starts the clock.'],
    ['Truck loaded', 'Loading staff weighs and photos the slip.'],
    ['On the road', 'Dispatch watches delays and breakdowns.'],
    ['Truck received', 'Receiving staff weighs and counts bags.'],
  ];
  return (
    <div className="my-4 rounded-xl bg-secondary p-3 ring-1 ring-secondary sm:p-4">
      <p className="mb-3 text-sm font-semibold text-primary">Every truck is weighed at both ends before the truck company is paid</p>
      <div className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center">
        {steps.map(([name, text], i) => (
          <div key={name} className="contents">
            {i > 0 && (
              <span className="flex justify-center text-quaternary" aria-hidden>
                <ArrowDown className="size-4 sm:hidden" />
                <ArrowRight className="hidden size-4 sm:block" />
              </span>
            )}
            <div className="flex-1 rounded-lg bg-primary px-3 py-2 ring-1 ring-secondary">
              <p className="text-sm font-semibold text-primary">{name}</p>
              <p className="text-xs leading-snug text-tertiary">{text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg bg-primary px-3 py-2 ring-2 ring-brand">
        <p className="text-sm font-semibold text-primary">Feather compares both ends</p>
        <p className="text-xs text-tertiary">Loaded weight vs received weight · bags billed vs bags counted</p>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-primary px-3 py-2 ring-1 ring-error_subtle">
          <p className="text-sm font-semibold text-error-primary">Payment on hold</p>
          <p className="text-xs text-tertiary">Loss or damage found. The owner reviews it.</p>
        </div>
        <div className="rounded-lg bg-primary px-3 py-2 ring-1 ring-[var(--color-utility-green-300)]">
          <p className="text-sm font-semibold text-success-primary">Ready to pay</p>
          <p className="text-xs text-tertiary">Loss within the limit. Balance can be paid.</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-tertiary">Going to a delivery site? Credit is checked before the truck loads. A on hold customer gets no delivery note and no truck.</p>
    </div>
  );
}
