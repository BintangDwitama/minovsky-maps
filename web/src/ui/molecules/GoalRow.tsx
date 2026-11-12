import type { Goal } from '../../domain/scenario';
import { IconButton } from '../atoms/Button';
import { NumberInput, Select, TextArea } from '../atoms/inputs';

export const SCORING_OPTIONS = [
  { value: 'phase1', label: 'End of Phase 1' },
  { value: 'phase2', label: 'End of Phase 2' },
  { value: 'each-phase', label: 'End of each Phase' },
] as const;

export interface GoalRowProps {
  goal: Goal;
  index: number;
  count: number;
  onChange(patch: Partial<Omit<Goal, 'id'>>): void;
  /** Text editing is grouped into one undo step per focus session. */
  onBeginEdit(): void;
  onEndEdit(): void;
  onMove(delta: -1 | 1): void;
  onRemove(): void;
}

export function GoalRow({ goal, index, count, onChange, onBeginEdit, onEndEdit, onMove, onRemove }: GoalRowProps) {
  const textId = `goal-${goal.id}-text`;
  return (
    <div className="goal-row">
      <label className="field__label" htmlFor={textId}>
        Goal {index + 1}
      </label>
      <TextArea
        id={textId}
        rows={2}
        value={goal.text}
        invalid={!goal.text.trim()}
        placeholder="Describe what a player must do"
        onFocus={onBeginEdit}
        onBlur={onEndEdit}
        onChange={(e) => onChange({ text: e.target.value })}
      />
      <div className="goal-row__meta">
        <NumberInput
          aria-label="Victory points"
          title="Victory points"
          min={0}
          max={99}
          style={{ width: 64 }}
          value={goal.vp}
          onFocus={onBeginEdit}
          onBlur={onEndEdit}
          onValueChange={(v) => onChange({ vp: Math.max(0, Math.min(99, v ?? 0)) })}
        />
        <span className="field__hint">VP</span>
        <Select
          aria-label="Scoring"
          value={goal.scoring}
          options={SCORING_OPTIONS}
          onValueChange={(scoring) => onChange({ scoring })}
        />
        <span style={{ flex: 1 }} />
        <IconButton small icon="arrowUp" label="Move goal up" disabled={index === 0} onClick={() => onMove(-1)} />
        <IconButton small icon="arrowDown" label="Move goal down" disabled={index === count - 1} onClick={() => onMove(1)} />
        <IconButton small icon="trash" label="Remove goal" variant="danger" onClick={onRemove} />
      </div>
    </div>
  );
}
