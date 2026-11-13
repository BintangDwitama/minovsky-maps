import type { ReactNode } from 'react';
import type { Owner, Scenario } from '../../domain/scenario';
import { setupSummary } from '../../domain/setupSummary';
import { ChecklistItem } from '../molecules/ChecklistItem';

const OWNER_NAME: Record<Owner, string> = { A: 'Side A', B: 'Side B', neutral: 'Neutral' };

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="break-inside-avoid">
      <h3 className="mt-3 mb-0.5 text-ui font-semibold text-muted font-stretch-condensed first:mt-0 print:mt-1.5">
        {title}
      </h3>
      <ul>{children}</ul>
    </div>
  );
}

/** What to put on the table, as tickable lines. */
export function SetupChecklist({ scenario }: { scenario: Scenario }) {
  const { pillars, sides, labelled } = setupSummary(scenario);
  return (
    <div data-testid="setup-checklist">
      <Group title="Pillars">
        {pillars.total === 0 ? (
          <ChecklistItem>No pillars needed: flat board</ChecklistItem>
        ) : (
          <ChecklistItem
            detail={pillars.byLevel
              .map((b) => `level ${b.level}: ${b.hexes} hex${b.hexes === 1 ? '' : 'es'}`)
              .join(', ')}
          >
            {pillars.total} pillar{pillars.total === 1 ? '' : 's'}
          </ChecklistItem>
        )}
      </Group>
      {sides.map((side) => (
        <Group key={side.owner} title={OWNER_NAME[side.owner]}>
          {side.kinds.map((k) => (
            <ChecklistItem key={k.kind}>{k.text}</ChecklistItem>
          ))}
        </Group>
      ))}
      {labelled.length > 0 ? (
        <Group title="Labelled pieces">
          {labelled.map((l, i) => (
            <ChecklistItem key={i} detail={`${l.kindLabel}, ${OWNER_NAME[l.owner]}`}>
              {l.label}
            </ChecklistItem>
          ))}
        </Group>
      ) : null}
    </div>
  );
}
