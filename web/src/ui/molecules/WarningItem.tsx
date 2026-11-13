import { cn } from '../cn';

export interface WarningItemProps {
  code: string;
  message: string;
  active: boolean;
  locatable: boolean;
  onSelect(): void;
}

/** A warning plate: hazard stripe on the left edge (the only hazard stripe in the UI). */
export function WarningItem({ code, message, active, locatable, onSelect }: WarningItemProps) {
  return (
    <button
      type="button"
      className={cn(
        'relative mb-1.5 block w-full bg-warning-bg py-1.5 pr-2 pl-4 text-left text-ui text-warning-text chamfer-sm focus-visible:shadow-[inset_0_0_0_2px_var(--accent)] focus-visible:outline-none enabled:hover:brightness-[0.97]',
        active && 'shadow-[inset_0_0_0_2px_var(--warning-text)]',
      )}
      aria-pressed={active}
      title={locatable ? 'Show on board' : undefined}
      onClick={onSelect}
    >
      <span className="absolute inset-y-0 left-0 w-1.5 hazard" aria-hidden />
      <span
        className="block text-tiny font-semibold font-stretch-condensed opacity-80"
        data-testid="warning-code"
      >
        {code}
      </span>
      {message}
    </button>
  );
}
