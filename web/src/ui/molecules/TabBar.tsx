import { cn } from '../cn';

export interface TabBarTab<T extends string> {
  id: T;
  label: string;
  /** Second line, e.g. the current tool. */
  detail?: string;
}

export interface TabBarProps<T extends string> {
  tabs: readonly TabBarTab<T>[];
  /** The tab whose drawer is open, if any. */
  open: T | null;
  onToggle(id: T): void;
  controls: string;
}

/** Bottom tab bar of the compact editor: each tab opens or closes its drawer. */
export function TabBar<T extends string>({ tabs, open, onToggle, controls }: TabBarProps<T>) {
  return (
    <nav
      aria-label="Editor panels"
      className="flex border-t border-frame-2 bg-frame text-frame-ink"
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-expanded={open === t.id}
          aria-controls={controls}
          className={cn(
            'flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center border-t-3 border-transparent px-2 py-1 focus-visible:shadow-[inset_0_0_0_2px_var(--vent)] focus-visible:outline-none',
            open === t.id && 'border-vent bg-frame-2',
          )}
          onClick={() => onToggle(t.id)}
        >
          <span className="font-semibold font-stretch-condensed">{t.label}</span>
          {t.detail ? (
            <span className="max-w-full truncate text-xs text-frame-muted">{t.detail}</span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}
