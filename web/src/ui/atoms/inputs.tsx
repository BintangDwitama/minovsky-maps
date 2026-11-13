import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../cn';

/** Inputs are square wells set into the plate (not chamfered: they read as screens). */
const FIELD =
  'w-full min-w-0 rounded-ui border border-border bg-field px-2 py-1.25 shadow-[inset_0_1px_2px_var(--plate-edge)] focus:border-accent';
const INVALID = 'border-danger';

const field = (invalid: boolean | undefined, extra?: string) =>
  cn(FIELD, invalid && INVALID, extra);

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function TextInput({ invalid, className, ...rest }: TextInputProps) {
  return (
    <input
      type="text"
      className={field(invalid, className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function TextArea({ invalid, className, ...rest }: TextAreaProps) {
  return (
    <textarea
      className={field(invalid, cn('min-h-15 resize-y wrap-break-word', className))}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export interface NumberInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> {
  value: number | null;
  onValueChange(value: number | null): void;
  invalid?: boolean;
  /** Allow clearing the field to "no value". */
  allowEmpty?: boolean;
}

export function NumberInput({
  value,
  onValueChange,
  invalid,
  allowEmpty,
  className,
  ...rest
}: NumberInputProps) {
  return (
    <input
      type="number"
      inputMode="numeric"
      className={field(invalid, className)}
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

export interface SelectProps<T extends string> extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'value' | 'onChange'
> {
  value: T;
  options: readonly SelectOption<T>[];
  onValueChange(value: T): void;
}

export function Select<T extends string>({
  value,
  options,
  onValueChange,
  className,
  ...rest
}: SelectProps<T>) {
  return (
    <select
      className={field(false, className)}
      value={value}
      onChange={(e) => onValueChange(e.target.value as T)}
      {...rest}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
