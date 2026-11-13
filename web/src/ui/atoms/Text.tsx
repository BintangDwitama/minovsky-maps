import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface HintProps {
  /** `p` renders as a paragraph with vertical spacing; `span` (default) is inline. */
  as?: 'span' | 'p';
  className?: string;
  children: ReactNode;
}

/** Small muted helper text (field hints, empty states, captions). */
export function Hint({ as = 'span', className, children }: HintProps) {
  const Tag = as;
  return (
    <Tag className={cn('text-xs text-muted', as === 'p' && 'my-3', className)}>{children}</Tag>
  );
}
