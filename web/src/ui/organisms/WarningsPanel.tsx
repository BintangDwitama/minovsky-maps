import { useState } from 'react';
import { pillarCount } from '../../domain/warnings';
import { Badge } from '../atoms/Badge';
import { WarningItem } from '../molecules/WarningItem';
import { useEditor, useServices, useWarnings } from '../hooks/editorContext';

export function WarningsPanel() {
  const { ui } = useServices();
  const warnings = useWarnings();
  const [active, setActive] = useState<string | null>(null);

  return (
    <section className="panel-section">
      <h2>
        Warnings <Badge tone={warnings.length ? 'warning' : 'default'}>{warnings.length}</Badge>
      </h2>
      {warnings.length === 0 ? <p className="field__hint">No warnings. Nice and tidy.</p> : null}
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
                selectedId: on && w.componentIds.length === 1 ? w.componentIds[0]! : ui.current.selectedId,
              });
            }}
          />
        );
      })}
      <p className="field__hint">Warnings never block saving or exporting.</p>
    </section>
  );
}

export function PillarCount() {
  const { scenario } = useEditor();
  const { total, byLevel } = pillarCount(scenario);
  return (
    <section className="panel-section pillars">
      <h2>Pillars needed</h2>
      <div className="pillars__total">{total}</div>
      {byLevel.length === 0 ? (
        <span className="field__hint">Flat board: no elevation.</span>
      ) : (
        <span className="field__hint">
          {byLevel.map((b) => `level ${b.level}: ${b.hexes} hex${b.hexes === 1 ? '' : 'es'}`).join(' · ')}
        </span>
      )}
    </section>
  );
}
