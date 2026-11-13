import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';
import { Icon, type IconName } from './Icon';

/** `frame` is for buttons sitting on the navy toolbar frame. */
type Variant = 'default' | 'primary' | 'danger' | 'frame';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  active?: boolean;
  small?: boolean;
  icon?: IconName;
  children?: ReactNode;
}

/*
 * Buttons are small chamfered armour plates. The clip removes outlines at the corners, so
 * keyboard focus is drawn as an inset ring instead.
 */
const BASE =
  'chamfer-sm inline-flex items-center gap-1.5 whitespace-nowrap bg-panel-2 px-2.5 py-1.5 leading-[1.2] shadow-[inset_0_-2px_0_var(--plate-edge)] focus-visible:shadow-[inset_0_0_0_2px_var(--accent)] focus-visible:outline-none disabled:cursor-default disabled:opacity-45';

const VARIANT: Record<Variant, string> = {
  default: 'enabled:hover:bg-plate-hover',
  primary: 'bg-accent font-semibold text-accent-ink enabled:hover:brightness-110',
  danger: 'text-danger enabled:hover:bg-plate-hover',
  frame:
    'bg-transparent text-frame-ink shadow-none focus-visible:shadow-[inset_0_0_0_2px_var(--vent)] enabled:hover:bg-frame-2',
};

/** Active tool: yellow vent marker on the left edge. */
const ACTIVE =
  'bg-vent-soft shadow-[inset_4px_0_0_var(--vent),inset_0_-2px_0_var(--plate-edge)] enabled:hover:bg-vent-soft';
const SMALL = 'px-1.5 py-0.75 text-xs';

export function Button({
  variant = 'default',
  active,
  small,
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      data-variant={variant}
      className={cn(BASE, VARIANT[variant], active && ACTIVE, small && SMALL, className)}
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

export function IconButton({ icon, label, small, className, ...rest }: IconButtonProps) {
  return (
    <Button
      small={small}
      className={cn(!small && 'p-1.5', className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} />
    </Button>
  );
}
