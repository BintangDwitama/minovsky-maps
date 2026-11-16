import { useId } from 'react';
import type { Visibility } from '../../application/ports';
import { VISIBILITIES, VISIBILITY_HINT, VISIBILITY_LABEL } from '../../application/visibility';
import { cn } from '../cn';
import { Icon, type IconName } from '../atoms/Icon';

export const VISIBILITY_ICON: Record<Visibility, IconName> = {
  private: 'lock',
  link: 'link',
  public: 'globe',
};

export interface VisibilityPickerProps {
  value: Visibility;
  onChange(v: Visibility): void;
  disabled?: boolean;
  /** Visible group label (default "Who can see it?"). */
  legend?: string;
  compact?: boolean;
}

/** Who can see a scenario: three radio options, each with an icon, a label and one line of hint. */
export function VisibilityPicker({
  value,
  onChange,
  disabled,
  legend = 'Who can see it?',
  compact,
}: VisibilityPickerProps) {
  const name = useId();
  return (
    <fieldset className="min-w-0" disabled={disabled} data-testid="visibility-picker">
      <legend className="mb-1.5 text-xs text-muted">{legend}</legend>
      <div className={cn('grid', compact ? 'gap-1' : 'gap-1.5')}>
        {VISIBILITIES.map((v) => (
          <label
            key={v}
            className={cn(
              'flex cursor-pointer items-start gap-2.5 bg-panel-2 px-2.5 py-2 chamfer-sm has-checked:bg-vent-soft has-checked:shadow-[inset_4px_0_0_var(--vent)] has-focus-visible:shadow-[inset_0_0_0_2px_var(--accent)] has-disabled:cursor-default has-disabled:opacity-60 coarse:min-h-11',
            )}
          >
            <input
              type="radio"
              name={name}
              value={v}
              checked={value === v}
              onChange={() => onChange(v)}
              className="sr-only"
            />
            <span className="mt-0.5 text-accent">
              <Icon name={VISIBILITY_ICON[v]} />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{VISIBILITY_LABEL[v]}</span>
              {compact ? null : (
                <span className="block text-xs text-muted">{VISIBILITY_HINT[v]}</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
