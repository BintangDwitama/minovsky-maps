import type { ReactNode } from 'react';

export function Badge({ tone = 'default', children }: { tone?: 'default' | 'warning'; children: ReactNode }) {
  return <span className={tone === 'warning' ? 'badge badge--warning' : 'badge'}>{children}</span>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function Swatch({ color, pattern }: { color: string; pattern?: string }) {
  return (
    <svg className="swatch" viewBox="0 0 14 14" aria-hidden>
      <rect width="14" height="14" fill={pattern ? `url(#${pattern})` : color} />
    </svg>
  );
}
