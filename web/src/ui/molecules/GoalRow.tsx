import type { Goal } from '../../domain/scenario';
import { IconButton } from '../atoms/Button';
import { NumberInput, Select, TextArea } from '../atoms/inputs';
import { Hint } from '../atoms/Text';

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

/**
 * One goal card: header (title + reorder/remove), text, then VP and scoring.
 * Every part may shrink (`min-w-0`) so the card never grows wider than its panel.
 */
export function GoalRow({
  goal,
  index,
  count,
  onChange,
  onBeginEdit,
  onEndEdit,
  onMove,
  onRemove,
}: GoalRowProps) {
  const textId = `goal-${goal.id}-text`;
  return (
    <div className="mb-2 flex min-w-0 flex-col gap-1.5 bg-panel-2 p-2 pl-2.5 shadow-[inset_0_-2px_0_var(--plate-edge)] chamfer">
      <div className="flex items-center gap-1">
        <label
          className="flex-1 text-ui font-semibold text-muted font-stretch-condensed"
          htmlFor={textId}
        >
          Goal {index + 1}
        </label>
        <IconButton
          small
          className="bg-panel"
          icon="arrowUp"
          label="Move goal up"
          disabled={index === 0}
          onClick={() => onMove(-1)}
        />
        <IconButton
          small
          className="bg-panel"
          icon="arrowDown"
          label="Move goal down"
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        />
        <IconButton
          small
          className="bg-panel"
          icon="trash"
          label="Remove goal"
          variant="danger"
          onClick={onRemove}
        />
      </div>
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
      <div className="flex min-w-0 items-center gap-1.5">
        <NumberInput
          aria-label="Victory points"
          title="Victory points"
          min={0}
          max={99}
          className="w-16 flex-none"
          value={goal.vp}
          onFocus={onBeginEdit}
          onBlur={onEndEdit}
          onValueChange={(v) => onChange({ vp: Math.max(0, Math.min(99, v ?? 0)) })}
        />
        <Hint>VP</Hint>
        <Select
          aria-label="Scoring"
          className="flex-1"
          value={goal.scoring}
          options={SCORING_OPTIONS}
          onValueChange={(scoring) => onChange({ scoring })}
        />
      </div>
    </div>
  );
}
