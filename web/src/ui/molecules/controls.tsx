import type { ReactNode } from 'react';
import { Kbd, Swatch } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import type { IconName } from '../atoms/Icon';
import { Hint } from '../atoms/Text';
import { terrainPatternId } from '../atoms/TerrainPattern';
import type { Owner, TerrainTag } from '../../domain/scenario';
import { cn } from '../cn';
import { TERRAIN_COLORS, TERRAIN_LABELS } from '../theme';

/* ---------------- ToolButton ---------------- */

export interface ToolButtonProps {
  icon: IconName;
  label: string;
  active: boolean;
  shortcut?: string;
  onSelect(): void;
}

export function ToolButton({ icon, label, active, shortcut, onSelect }: ToolButtonProps) {
  return (
    <Button
      icon={icon}
      active={active}
      onClick={onSelect}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      <span className="flex-1 text-left">{label}</span>
      {shortcut ? <Kbd>{shortcut}</Kbd> : null}
    </Button>
  );
}

/* ---------------- Segmented ---------------- */

export interface SegmentedProps<T extends string> {
  value: T;
  options: readonly { value: T; label: ReactNode; disabled?: boolean; title?: string }[];
  onChange(value: T): void;
  ariaLabel: string;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div
      className="inline-flex bg-panel-2 shadow-[inset_0_-2px_0_var(--plate-edge)] chamfer-sm"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={cn(
            'border-l border-border px-2.5 py-1 first:border-l-0 focus-visible:shadow-[inset_0_0_0_2px_var(--accent)] focus-visible:outline-none enabled:hover:bg-plate-hover disabled:cursor-default disabled:opacity-40',
            o.value === value &&
              'border-accent bg-accent font-semibold text-accent-ink enabled:hover:bg-accent',
          )}
          aria-pressed={o.value === value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- OwnerToggle ---------------- */

const OWNER_LABEL: Record<Owner, string> = { A: 'Side A', B: 'Side B', neutral: 'Neutral' };

export interface OwnerToggleProps {
  value: Owner;
  allowed: readonly Owner[];
  onChange(owner: Owner): void;
}

export function OwnerToggle({ value, allowed, onChange }: OwnerToggleProps) {
  return (
    <Segmented
      ariaLabel="Owner"
      value={value}
      onChange={onChange}
      options={allowed.map((o) => ({
        value: o,
        label: o === 'neutral' ? 'Neutral' : o,
        title: OWNER_LABEL[o],
      }))}
    />
  );
}

/* ---------------- TerrainTagPicker ---------------- */

export interface TerrainTagPickerProps {
  value: TerrainTag;
  tags: readonly TerrainTag[];
  onChange(tag: TerrainTag): void;
}

export function TerrainTagPicker({ value, tags, onChange }: TerrainTagPickerProps) {
  return (
    <div className="grid gap-1" role="radiogroup" aria-label="Terrain type">
      {tags.map((t) => (
        <Button
          key={t}
          small
          active={t === value}
          onClick={() => onChange(t)}
          role="radio"
          aria-checked={t === value}
        >
          <Swatch color={TERRAIN_COLORS[t]} pattern={terrainPatternId(t)} />
          {TERRAIN_LABELS[t]}
        </Button>
      ))}
    </div>
  );
}

/* ---------------- ElevationTool ---------------- */

export interface ElevationToolProps {
  level: number;
  max: number;
  onLevelChange(level: number): void;
}

export function ElevationLevelPicker({ level, max, onLevelChange }: ElevationToolProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        small
        icon="down"
        aria-label="Lower target level"
        onClick={() => onLevelChange(Math.max(0, level - 1))}
      />
      <span className="min-w-15 text-center">Level {level}</span>
      <Button
        small
        icon="up"
        aria-label="Raise target level"
        onClick={() => onLevelChange(Math.min(max, level + 1))}
      />
    </div>
  );
}

/* ---------------- FieldRow ---------------- */

export interface FieldRowProps {
  label: string;
  htmlFor?: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}

export function FieldRow({ label, htmlFor, error, hint, children }: FieldRowProps) {
  return (
    <div className="mb-2.5 grid min-w-0 gap-1">
      <label className="text-xs text-muted" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <span className="text-xs text-danger" role="alert">
          {error}
        </span>
      ) : hint ? (
        <Hint>{hint}</Hint>
      ) : null}
    </div>
  );
}

/* ---------------- ToolGroup ---------------- */

/** Titled group of tools in the left palette. */
export function ToolGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="mb-1.5 text-ui font-semibold text-muted font-stretch-condensed">{title}</h3>
      {children}
    </div>
  );
}

/** Vertical stack of full-width tool buttons. */
export function ToolStack({ children }: { children: ReactNode }) {
  return <div className="grid gap-1">{children}</div>;
}
