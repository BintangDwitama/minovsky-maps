import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const cls = (error?: boolean, extra?: string) => ['input', error && 'input--error', extra].filter(Boolean).join(' ');

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function TextInput({ invalid, className, ...rest }: TextInputProps) {
  return <input type="text" className={cls(invalid, className)} aria-invalid={invalid || undefined} {...rest} />;
}

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function TextArea({ invalid, className, ...rest }: TextAreaProps) {
  return <textarea className={cls(invalid, className)} aria-invalid={invalid || undefined} {...rest} />;
}

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | null;
  onValueChange(value: number | null): void;
  invalid?: boolean;
  /** Allow clearing the field to "no value". */
  allowEmpty?: boolean;
}

export function NumberInput({ value, onValueChange, invalid, allowEmpty, className, ...rest }: NumberInputProps) {
  return (
    <input
      type="number"
      inputMode="numeric"
      className={cls(invalid, className)}
      aria-invalid={invalid || undefined}
      value={value ?? ''}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          if (allowEmpty) onValueChange(null);
          return;
        }
        const n = Number(raw);
        if (Number.isFinite(n)) onValueChange(Math.trunc(n));
      }}
      {...rest}
    />
  );
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string> extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> {
  value: T;
  options: readonly SelectOption<T>[];
  onValueChange(value: T): void;
}

export function Select<T extends string>({ value, options, onValueChange, className, ...rest }: SelectProps<T>) {
  return (
    <select className={cls(false, className)} value={value} onChange={(e) => onValueChange(e.target.value as T)} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
