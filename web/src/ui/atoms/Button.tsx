import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Variant = 'default' | 'primary' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  active?: boolean;
  small?: boolean;
  icon?: IconName;
  children?: ReactNode;
}

const cls = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

export function Button({ variant = 'default', active, small, icon, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cls(
        'btn',
        variant !== 'default' && `btn--${variant}`,
        active && 'btn--active',
        small && 'btn--small',
        className,
      )}
      aria-pressed={active === undefined ? undefined : active}
      {...rest}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'icon'> {
  icon: IconName;
  /** Accessible name; also shown as tooltip. */
  label: string;
}

export function IconButton({ icon, label, className, ...rest }: IconButtonProps) {
  return (
    <Button className={cls('btn--icon', className)} aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
    </Button>
  );
}
