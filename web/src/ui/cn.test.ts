import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('lets a later (parent) class override an atom default', () => {
    expect(cn('bg-panel px-3', 'bg-panel-2 px-1')).toBe('bg-panel-2 px-1');
  });

  it('treats custom theme colours and font sizes as separate groups', () => {
    // text-muted is a colour, text-xs/text-ui are sizes: both must survive together
    expect(cn('text-xs text-muted', 'text-ui')).toBe('text-muted text-ui');
    expect(cn('text-text', 'text-danger')).toBe('text-danger');
    expect(cn('border-border', 'border-accent')).toBe('border-accent');
    expect(cn('rounded-ui', 'rounded-full')).toBe('rounded-full');
  });

  it('keeps an explicit line height when a text size is added later', () => {
    expect(cn('leading-[1.2]', 'text-xs')).toBe('leading-[1.2] text-xs');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });
});
