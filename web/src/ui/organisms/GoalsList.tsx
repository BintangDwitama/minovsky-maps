import type { Goal } from '../../domain/scenario';
import { Hint } from '../atoms/Text';
import { SCORING_OPTIONS } from '../molecules/GoalRow';

const scoringLabel = (s: Goal['scoring']) => SCORING_OPTIONS.find((o) => o.value === s)?.label ?? s;

export function GoalsList({ goals }: { goals: readonly Goal[] }) {
  if (goals.length === 0) {
    return (
      <Hint as="p" className="my-0">
        No scenario goals. Victory points for defeating units and Garrisons are scored as usual.
      </Hint>
    );
  }
  return (
    <ol className="grid gap-2">
      {goals.map((g) => (
        <li
          key={g.id}
          className="flex gap-3 bg-panel-2 p-2.5 chamfer-sm print:border print:border-border print:bg-transparent print:[clip-path:none]"
        >
          <span className="flex w-12 flex-none flex-col items-center justify-center bg-frame py-1 text-frame-ink">
            <span className="text-title leading-none font-bold font-stretch-condensed tabular-nums">
              {g.vp}
            </span>
            <span className="text-micro">VP</span>
          </span>
          <span className="min-w-0">
            <span className="block break-words">{g.text}</span>
            <span className="text-xs text-muted">{scoringLabel(g.scoring)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
