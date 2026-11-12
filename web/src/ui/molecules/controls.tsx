import type { ReactNode } from 'react';
import { Kbd, Swatch } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import type { IconName } from '../atoms/Icon';
import { terrainPatternId } from '../atoms/TerrainPattern';
import type { Owner, TerrainTag } from '../../domain/scenario';
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
    <Button icon={icon} active={active} onClick={onSelect} title={shortcut ? `${label} (${shortcut})` : label}>
      <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
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

export function Segmented<T extends string>({ value, options, onChange, ariaLabel }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
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
      options={allowed.map((o) => ({ value: o, label: o === 'neutral' ? 'Neutral' : o, title: OWNER_LABEL[o] }))}
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
    <div className="tool-group__stack" role="radiogroup" aria-label="Terrain type">
      {tags.map((t) => (
        <Button key={t} small active={t === value} onClick={() => onChange(t)} role="radio" aria-checked={t === value}>
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
    <div className="row">
      <Button small icon="down" aria-label="Lower target level" onClick={() => onLevelChange(Math.max(0, level - 1))} />
      <span style={{ minWidth: 60, textAlign: 'center' }}>Level {level}</span>
      <Button small icon="up" aria-label="Raise target level" onClick={() => onLevelChange(Math.min(max, level + 1))} />
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
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field__hint">{hint}</span>
      ) : null}
    </div>
  );
}
