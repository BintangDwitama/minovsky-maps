import { axialToOffset } from '../../domain/hex';
import { Checkbox, NumberInput } from '../atoms/inputs';
import { Hint } from '../atoms/Text';
import { useEditor, useServices, useUi } from '../hooks/editorContext';
import { useAnalysis } from '../hooks/useAnalysis';
import { FieldRow, Segmented } from '../molecules/controls';
import { PanelSection } from '../molecules/PanelSection';

const PENALTY_TEXT = {
  water: 'starts in water',
  debris: 'starts in a debris field',
  engaged: 'Engaged',
} as const;

/** Settings and results of the Analyse tool (shown only while the tool is active). */
export function AnalysisPanel() {
  const { ui } = useServices();
  const { scenario } = useEditor();
  const { tool, analysis: a, lastPointer } = useUi();
  const touch = lastPointer === 'touch';
  const result = useAnalysis(scenario, a);
  if (tool !== 'analyse') return null;

  const probe = a.probe ? axialToOffset(a.probe) : null;
  const visibleCount = result?.visible ? [...result.visible.values()].filter(Boolean).length : null;
  const reachCount = result?.reach ? result.reach.costs.size : null;

  return (
    <PanelSection title="Test the map" className="bg-vent-soft" testId="analysis-panel">
      <p className="mb-3" data-testid="analysis-probe-text">
        {probe
          ? `Probe: Side ${a.side} unit on hex ${probe.col}, ${probe.row} (level ${result?.index.elevation(a.probe!) ?? 0}).`
          : `${touch ? 'Tap' : 'Click'} a hex to place a probe: a unit of the chosen side standing there.`}
      </p>

      <FieldRow label="Side">
        <Segmented
          ariaLabel="Probe side"
          value={a.side}
          options={[
            { value: 'A', label: 'Side A' },
            { value: 'B', label: 'Side B' },
          ]}
          onChange={(side) => ui.setAnalysis({ side })}
        />
      </FieldRow>

      <FieldRow label="Show">
        <Segmented
          ariaLabel="Analysis mode"
          value={a.mode}
          options={[
            { value: 'los', label: 'Line of sight' },
            { value: 'reach', label: 'Reach' },
            { value: 'both', label: 'Both' },
          ]}
          onChange={(mode) => ui.setAnalysis({ mode })}
        />
      </FieldRow>

      {a.mode !== 'los' ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <FieldRow label="Move" htmlFor="analysis-move" hint="Advance is 3">
              <NumberInput
                id="analysis-move"
                min={1}
                max={9}
                value={a.move}
                onValueChange={(v) => ui.setAnalysis({ move: Math.max(1, Math.min(9, v ?? 3)) })}
              />
            </FieldRow>
            <FieldRow label="Speed upgrades">
              <Segmented
                ariaLabel="Speed upgrades"
                value={String(a.speed) as '0' | '1' | '2' | '3'}
                options={(['0', '1', '2', '3'] as const).map((v) => ({ value: v, label: v }))}
                onChange={(v) => ui.setAnalysis({ speed: Number(v) })}
              />
            </FieldRow>
          </div>
          <Checkbox
            label="Engaged"
            checked={a.engaged || !!result?.autoEngaged}
            disabled={!!result?.autoEngaged}
            hint={
              result?.autoEngaged
                ? 'Next to an enemy Garrison at the same level.'
                : 'Tick to stand in for adjacent enemy units.'
            }
            onChange={(engaged) => ui.setAnalysis({ engaged })}
          />
          <Checkbox
            label="Hover"
            checked={a.hover}
            hint="May move through impassable terrain."
            onChange={(hover) => ui.setAnalysis({ hover })}
          />
        </>
      ) : null}

      {result ? (
        <div className="mt-2 grid gap-1 text-ui" data-testid="analysis-results">
          {visibleCount !== null ? (
            <span>
              <strong>{visibleCount}</strong> hexes in line of sight
            </span>
          ) : null}
          {result.reach ? (
            <span>
              <strong>{reachCount}</strong> hexes reachable with {result.reach.allowance} movement
              {result.reach.penalties.length
                ? ` (${result.reach.penalties.map((p) => PENALTY_TEXT[p]).join(', ')}: −${result.reach.penalties.length})`
                : ''}
            </span>
          ) : null}
        </div>
      ) : null}

      <Hint as="p" className="mb-0">
        {touch
          ? 'Tap a hex to see the sight line; drag the probe to move it.'
          : 'Hover a hex to see the sight line.'}{' '}
        Only enemy Bases, Garrisons, Carriers and structures block; neutral pieces follow each
        scenario’s own rules and are ignored here.
      </Hint>
    </PanelSection>
  );
}
