import { useState } from 'react';
import { pillarCount } from '../../domain/warnings';
import { Badge } from '../atoms/Badge';
import { Hint } from '../atoms/Text';
import { PanelSection } from '../molecules/PanelSection';
import { WarningItem } from '../molecules/WarningItem';
import { useEditor, useServices, useWarnings } from '../hooks/editorContext';

export function WarningsPanel() {
  const { ui } = useServices();
  const warnings = useWarnings();
  const [active, setActive] = useState<string | null>(null);

  return (
    <PanelSection
      title={
        <>
          Warnings <Badge tone={warnings.length ? 'warning' : 'default'}>{warnings.length}</Badge>
        </>
      }
    >
      {warnings.length === 0 ? <Hint as="p">No warnings. Nice and tidy.</Hint> : null}
      {warnings.map((w, i) => {
        const key = `${w.code}:${w.componentIds.join(',')}:${i}`;
        return (
          <WarningItem
            key={key}
            code={w.code}
            message={w.message}
            active={active === key}
            locatable={w.hexes.length > 0}
            onSelect={() => {
              const on = active !== key;
              setActive(on ? key : null);
              ui.patch({
                highlight: on ? w.hexes : [],
                selectedId:
                  on && w.componentIds.length === 1 ? w.componentIds[0]! : ui.current.selectedId,
              });
            }}
          />
        );
      })}
      <Hint as="p">Warnings never block saving or exporting.</Hint>
    </PanelSection>
  );
}

export function PillarCount() {
  const { scenario } = useEditor();
  const { total, byLevel } = pillarCount(scenario);
  return (
    <PanelSection title="Pillars needed" className="text-ui">
      <div
        className="mb-1 text-stat font-bold font-stretch-condensed tabular-nums"
        data-testid="pillar-total"
      >
        {total}
      </div>
      {byLevel.length === 0 ? (
        <Hint>Flat board: no elevation.</Hint>
      ) : (
        <Hint>
          {byLevel
            .map((b) => `level ${b.level}: ${b.hexes} hex${b.hexes === 1 ? '' : 'es'}`)
            .join(' · ')}
        </Hint>
      )}
    </PanelSection>
  );
}
