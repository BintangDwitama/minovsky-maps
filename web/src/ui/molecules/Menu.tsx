import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../atoms/Button';
import { Icon, type IconName } from '../atoms/Icon';

export interface MenuItem {
  label: string;
  icon: IconName;
  onSelect(): void;
}

export interface MenuProps {
  label: string;
  items: readonly MenuItem[];
  /** Variant of the trigger button. */
  variant?: 'frame' | 'default';
  /** A short note under the actions. */
  footer?: string;
}

/**
 * A button that opens a list of actions. Closes on pick, Escape, or a press outside it.
 * The list opens below the trigger, aligned to its right edge.
 */
export function Menu({ label, items, variant = 'frame', footer }: MenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      root.current?.querySelector<HTMLButtonElement>('[aria-haspopup]')?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    // move focus into the list so keyboard users land on the first action
    root.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <Button
        variant={variant}
        icon="menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </Button>
      {open ? (
        <div
          id={listId}
          role="menu"
          aria-label={label}
          className="absolute top-full right-0 z-30 mt-1 grid min-w-52 gap-px bg-border p-px text-text shadow-lg chamfer-sm"
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              className="flex items-center gap-2.5 bg-panel px-3 py-2 text-left focus-visible:shadow-[inset_0_0_0_2px_var(--accent)] focus-visible:outline-none enabled:hover:bg-plate-hover coarse:min-h-11"
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
            >
              <Icon name={it.icon} />
              {it.label}
            </button>
          ))}
          {footer ? <div className="bg-panel px-3 py-1.5 text-xs text-muted">{footer}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
