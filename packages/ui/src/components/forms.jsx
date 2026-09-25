import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Description,
  Field,
  Input,
  Label,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Switch,
  Textarea,
} from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import { useState } from 'react';

const control = (error, big) =>
  clsx(
    'block w-full rounded-lg bg-white text-ink-900 ring-1 ring-inset placeholder:text-ink-400 focus:outline-none data-focus:ring-2 data-focus:ring-brand-500 data-disabled:bg-ink-100 data-disabled:text-ink-500',
    big ? 'px-3.5 py-3 text-lg' : 'px-3 py-2 text-sm',
    error ? 'ring-red-400' : 'ring-ink-300',
  );

function FieldShell({ label, hint, error, className, children, required }) {
  return (
    <Field className={clsx('space-y-1.5', className)}>
      {label && (
        <Label className="block text-sm font-semibold text-ink-800">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </Label>
      )}
      {children}
      {hint && !error && <Description className="text-xs text-ink-500">{hint}</Description>}
      {error && <p className="text-sm font-medium text-red-700">{error}</p>}
    </Field>
  );
}

/** Text / number input. `big` makes it thumb-friendly for field phones. */
export function TextField({ label, hint, error, className, big, suffix, required, ...props }) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={className} required={required}>
      <div className="relative">
        <Input invalid={Boolean(error)} className={clsx(control(error, big), suffix && 'pr-14')} {...props} />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-ink-500">{suffix}</span>}
      </div>
    </FieldShell>
  );
}

export function NumberField(props) {
  return <TextField type="text" inputMode="decimal" autoComplete="off" {...props} />;
}

export function TextAreaField({ label, hint, error, className, rows = 3, ...props }) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={className}>
      <Textarea rows={rows} className={control(error)} {...props} />
    </FieldShell>
  );
}

/**
 * @param {{ options: {value:string,label:string,hint?:string}[] }} props
 */
export function SelectField({ label, hint, error, className, value, onChange, options, placeholder = 'Choose…', big, disabled, required }) {
  const selected = options.find((o) => o.value === value);
  return (
    <FieldShell label={label} hint={hint} error={error} className={className} required={required}>
      <Listbox value={value ?? ''} onChange={onChange} disabled={disabled}>
        <div className="relative">
          <ListboxButton className={clsx(control(error, big), 'relative pr-10 text-left')}>
            <span className={clsx('block truncate', !selected && 'text-ink-400')}>{selected?.label ?? placeholder}</span>
            <ChevronUpDownIcon className="pointer-events-none absolute inset-y-0 right-2 my-auto size-5 text-ink-400" aria-hidden />
          </ListboxButton>
          <ListboxOptions
            anchor="bottom start"
            transition
            className="z-50 max-h-72 w-(--button-width) overflow-auto rounded-lg bg-white py-1 shadow-lg ring-1 ring-ink-200 [--anchor-gap:4px] focus:outline-none data-closed:opacity-0 transition duration-100"
          >
            {options.length === 0 && <div className="px-3 py-2 text-sm text-ink-500">Nothing to choose</div>}
            {options.map((o) => (
              <ListboxOption
                key={o.value}
                value={o.value}
                className={clsx('group relative cursor-default select-none py-2.5 pl-9 pr-3 data-focus:bg-brand-50', big ? 'text-base' : 'text-sm')}
              >
                <CheckIcon className="invisible absolute left-2.5 top-3 size-4 text-brand-600 group-data-selected:visible" aria-hidden />
                <span className="block truncate font-medium text-ink-900">{o.label}</span>
                {o.hint && <span className="block truncate text-xs text-ink-500">{o.hint}</span>}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </div>
      </Listbox>
    </FieldShell>
  );
}

/** Searchable select for long lists (customers, trucks). */
export function ComboField({ label, hint, error, className, value, onChange, options, placeholder = 'Type to search…', big, required }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q)) : options;
  return (
    <FieldShell label={label} hint={hint} error={error} className={className} required={required}>
      <Combobox value={value ?? null} onChange={(v) => onChange(v ?? '')} onClose={() => setQuery('')}>
        <div className="relative">
          <ComboboxInput
            className={clsx(control(error, big), 'pr-10')}
            displayValue={(v) => options.find((o) => o.value === v)?.label ?? ''}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
          />
          <ComboboxButton className="absolute inset-y-0 right-0 flex items-center px-2">
            <ChevronUpDownIcon className="size-5 text-ink-400" aria-hidden />
          </ComboboxButton>
        </div>
        <ComboboxOptions
          anchor="bottom start"
          className="z-50 max-h-72 w-(--input-width) overflow-auto rounded-lg bg-white py-1 shadow-lg ring-1 ring-ink-200 [--anchor-gap:4px] empty:invisible"
        >
          {filtered.slice(0, 100).map((o) => (
            <ComboboxOption key={o.value} value={o.value} className="group relative cursor-default select-none py-2.5 pl-9 pr-3 text-sm data-focus:bg-brand-50">
              <CheckIcon className="invisible absolute left-2.5 top-3 size-4 text-brand-600 group-data-selected:visible" aria-hidden />
              <span className="block truncate font-medium">{o.label}</span>
              {o.hint && <span className="block truncate text-xs text-ink-500">{o.hint}</span>}
            </ComboboxOption>
          ))}
        </ComboboxOptions>
      </Combobox>
    </FieldShell>
  );
}

export function SwitchField({ label, hint, checked, onChange, className }) {
  return (
    <Field className={clsx('flex items-center justify-between gap-4', className)}>
      <span>
        <Label className="text-sm font-semibold text-ink-800">{label}</Label>
        {hint && <Description className="text-xs text-ink-500">{hint}</Description>}
      </span>
      <Switch
        checked={checked}
        onChange={onChange}
        className="group relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full bg-ink-300 p-0.5 transition data-checked:bg-brand-600 focus:outline-none data-focus:ring-2 data-focus:ring-brand-500 data-focus:ring-offset-2"
      >
        <span className="size-5 rounded-full bg-white shadow transition group-data-checked:translate-x-5" />
      </Switch>
    </Field>
  );
}

/** Keep form state + server field errors together. */
export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (key) => (eOrValue) => {
    const v = eOrValue?.target ? (eOrValue.target.type === 'checkbox' ? eOrValue.target.checked : eOrValue.target.value) : eOrValue;
    setValues((s) => ({ ...s, [key]: v }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };
  return { values, setValues, errors, setErrors, set, reset: () => (setValues(initial), setErrors({})) };
}
