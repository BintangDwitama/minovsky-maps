import { useMemo, type ReactNode } from 'react';
import { describeBoard } from '../../domain/boardDescription';
import type { Scenario } from '../../domain/scenario';
import { cn } from '../cn';
import { useEditor } from '../hooks/editorContext';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      <h3 className="mb-0.5 text-ui font-semibold text-muted font-stretch-condensed">{title}</h3>
      {children}
    </div>
  );
}

const hexList = (hexes: readonly string[]) => hexes.join('; ');
const count = (n: number) => `${n} hex${n === 1 ? '' : 'es'}`;

/**
 * The board as text (elevation, terrain, components with positions), for screen readers and for
 * reading a map without seeing it. Collapsed by default; never printed.
 */
export function BoardInWords({ scenario, className }: { scenario: Scenario; className?: string }) {
  const d = useMemo(() => describeBoard(scenario), [scenario]);
  return (
    <details className={cn('group print:hidden', className)} data-testid="board-in-words">
      <summary className="cursor-pointer font-semibold font-stretch-condensed coarse:py-2.5">
        Board in words
      </summary>
      <div className="text-ui">
        <p className="mt-2">
          Board: {d.size}. Hexes are given as column, row, as in the hex readout.
        </p>

        <Group title="Elevation">
          {d.flat ? (
            <p>Flat board: no elevation.</p>
          ) : (
            <ul>
              {d.levels.map((l) => (
                <li key={l.level}>
                  Level {l.level} ({count(l.hexes.length)}): {hexList(l.hexes)}
                </li>
              ))}
            </ul>
          )}
        </Group>

        <Group title="Terrain">
          {d.terrain.length === 0 ? (
            <p>No terrain.</p>
          ) : (
            <ul>
              {d.terrain.map((t) => (
                <li key={t.tag}>
                  {t.label} ({count(t.hexes.length)}): {hexList(t.hexes)}
                </li>
              ))}
            </ul>
          )}
        </Group>

        {d.sides.length === 0 ? (
          <Group title="Components">
            <p>No components.</p>
          </Group>
        ) : (
          d.sides.map((g) => (
            <Group key={g.side} title={g.label}>
              <ul>
                {g.items.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </Group>
          ))
        )}
      </div>
    </details>
  );
}

/** Board in words for the editor's Scenario panels: follows the open scenario. */
export function EditorBoardInWords() {
  const { scenario } = useEditor();
  return <BoardInWords scenario={scenario} className="min-w-0 p-3 panel-line" />;
}
