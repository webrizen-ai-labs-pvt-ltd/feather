/**
 * Form fields on top of Untitled UI inputs.
 * One API for every page: label, hint, error, value, onChange(value), required, size.
 * `big` = large touch targets for field phones.
 */
import { useState } from 'react';
import { Checkbox } from '@uui/components/base/checkbox/checkbox';
import { InputBase } from '@uui/components/base/input/input';
import { InputGroup, InputPrefix } from '@uui/components/base/input/input-group';
import { Input } from '@uui/components/base/input/input';
import { Select } from '@uui/components/base/select/select';
import { TextArea } from '@uui/components/base/textarea/textarea';
import { Toggle } from '@uui/components/base/toggle/toggle';
import { cx } from '@uui/utils/cx';

const toValue = (v) => (v?.target ? v.target.value : v);
const sizeOf = (big, size) => size ?? (big ? 'lg' : 'md');

/** Text input. Shows `error` in red instead of the hint. `suffix` = a unit box (T, ₹, kg…). */
export function TextField({ label, hint, error, value, onChange, required, big, size, suffix, prefix, icon, className, type = 'text', inputMode, ...rest }) {
  const common = {
    label,
    hint: error ?? hint,
    isInvalid: Boolean(error),
    isRequired: required,
    value: value ?? '',
    onChange: (v) => onChange?.(toValue(v)),
    size: sizeOf(big, size),
    className,
    ...rest,
  };
  if (suffix || prefix) {
    return (
      <InputGroup
        {...common}
        leadingAddon={prefix ? <InputPrefix position="leading">{prefix}</InputPrefix> : undefined}
        trailingAddon={suffix ? <InputPrefix position="trailing">{suffix}</InputPrefix> : undefined}
      >
        <InputBase type={type} inputMode={inputMode} placeholder={rest.placeholder} />
      </InputGroup>
    );
  }
  return <Input {...common} type={type} inputMode={inputMode} icon={icon} />;
}

export function NumberField(props) {
  return <TextField inputMode="decimal" autoComplete="off" {...props} />;
}

export function TextAreaField({ label, hint, error, value, onChange, rows = 3, className, ...rest }) {
  return (
    <TextArea
      label={label}
      hint={error ?? hint}
      isInvalid={Boolean(error)}
      value={value ?? ''}
      onChange={(v) => onChange?.(toValue(v))}
      rows={rows}
      className={className}
      {...rest}
    />
  );
}

/**
 * Dropdown select.
 * @param {{ options: {value:string, label:string, hint?:string, icon?:any}[] }} props
 */
export function SelectField({ label, hint, error, value, onChange, options = [], placeholder = 'Choose…', big, size, required, disabled, className }) {
  const items = options.map((o) => ({ id: o.value, label: o.label, supportingText: o.hint, icon: o.icon }));
  return (
    <Select
      label={label}
      hint={error ?? hint}
      isInvalid={Boolean(error)}
      isRequired={required}
      isDisabled={disabled}
      placeholder={items.length ? placeholder : 'Nothing to choose'}
      size={sizeOf(big, size)}
      items={items}
      selectedKey={value === '' || value === undefined ? null : value}
      onSelectionChange={(key) => onChange?.(key ?? '')}
      className={className}
    >
      {(item) => (
        <Select.Item id={item.id} supportingText={item.supportingText} icon={item.icon}>
          {item.label}
        </Select.Item>
      )}
    </Select>
  );
}

/** Searchable select for long lists (customers, trucks). */
export function ComboField({ label, hint, error, value, onChange, options = [], placeholder = 'Type to search…', big, size, required, className }) {
  const items = options.map((o) => ({ id: o.value, label: o.label, supportingText: o.hint }));
  return (
    <Select.ComboBox
      label={label}
      hint={error ?? hint}
      isInvalid={Boolean(error)}
      isRequired={required}
      placeholder={placeholder}
      size={sizeOf(big, size)}
      items={items}
      selectedKey={value || null}
      onSelectionChange={(key) => onChange?.(key ?? '')}
      className={className}
    >
      {(item) => (
        <Select.Item id={item.id} supportingText={item.supportingText}>
          {item.label}
        </Select.Item>
      )}
    </Select.ComboBox>
  );
}

export function SwitchField({ label, hint, checked, onChange, className }) {
  return <Toggle label={label} hint={hint} isSelected={Boolean(checked)} onChange={onChange} className={className} />;
}

export function CheckboxField({ label, hint, checked, onChange, className }) {
  return <Checkbox label={label} hint={hint} isSelected={Boolean(checked)} onChange={onChange} className={cx(className)} />;
}

/** Keep form state + server field errors together. f.set('name') works with values and events. */
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
