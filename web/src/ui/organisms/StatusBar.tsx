import { useEffect } from 'react';
import { traceSightLine } from '../../domain/analysis/lineOfSight';
import { type Axial, axialToOffset, hexEquals, hexKey } from '../../domain/hex';
import { buildIndex, elevationAt, tagsAt } from '../../domain/scenarioIndex';
import { useEditor, useServices, useUi } from '../hooks/editorContext';
import { useAnalysis } from '../hooks/useAnalysis';
import { TERRAIN_LABELS } from '../theme';

const TOOL_HINT: Record<string, string> = {
  select: 'Click a component to select, drag to move. Space+drag or middle-drag pans; wheel zooms.',
  terrain: 'Click or drag to paint. Starting on a painted hex removes instead.',
  erase: 'Click or drag to clear all terrain from hexes.',
  raise: 'Click or drag to add one pillar per hex.',
  lower: 'Click or drag to remove one pillar per hex.',
  setLevel: 'Click or drag to set hexes to the chosen level.',
  place: 'Click a hex to place the selected component.',
  analyse: 'Click a hex to place a probe, then hover other hexes to check line of sight and reach.',
};

const TOUCH_HINT: Record<string, string> = {
  select: 'Tap a component to select, drag it to move. Two fingers pan and pinch to zoom.',
  terrain: 'Tap or drag to paint. Starting on a painted hex removes instead.',
  erase: 'Tap or drag to clear all terrain from hexes.',
  raise: 'Tap or drag to add one pillar per hex.',
  lower: 'Tap or drag to remove one pillar per hex.',
  setLevel: 'Tap or drag to set hexes to the chosen level.',
  place: 'Tap a hex to place the selected component.',
  analyse:
    'Tap a hex to place a probe, then tap other hexes to check them. Drag the probe to move it.',
};

const at = (h: Axial) => {
  const { col, row } = axialToOffset(h);
  return `${col}, ${row}`;
};

export function StatusBar() {
  const { ui } = useServices();
  const { scenario } = useEditor();
  const { hover, message, tool, zoom, analysis, lastPointer } = useUi();
  const hints = lastPointer === 'touch' ? TOUCH_HINT : TOOL_HINT;
  const result = useAnalysis(scenario, analysis);

  // Analyse tool: explain the hovered hex (sight line and reach)
  let analysisText: string | null = null;
  if (tool === 'analyse' && result && analysis.probe && hover && result.index.onBoard(hover)) {
    if (hexEquals(hover, analysis.probe)) {
      analysisText = 'The probe stands here.';
    } else {
      const parts: string[] = [];
      if (result.visible) {
        const s = traceSightLine(result.index, analysis.probe, analysis.side, hover);
        parts.push(
          s.visible
            ? 'Line of sight clear'
            : s.blocker!.reason === 'terrain'
              ? `Blocked by terrain at level ${s.blocker!.elevation} on ${at(s.blocker!.hex)}`
              : `Blocked by an enemy piece on ${at(s.blocker!.hex)}`,
        );
      }
      if (result.reach) {
        const cost = result.reach.costs.get(hexKey(hover));
        parts.push(cost === undefined ? 'out of reach' : `reach: ${cost} movement`);
      }
      analysisText = parts.join(' · ');
    }
  }

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => ui.flash(null), 5000);
    return () => clearTimeout(t);
  }, [message, ui]);

  let hoverText = '';
  if (hover) {
    const idx = buildIndex(scenario);
    const { col, row } = axialToOffset(hover);
    const level = elevationAt(idx, hover);
    const tags = tagsAt(idx, hover).map((t) => TERRAIN_LABELS[t]);
    hoverText = [
      `${col}, ${row}`,
      level ? `level ${level}` : null,
      tags.length ? tags.join(' + ') : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  return (
    <footer
      className="flex min-h-6.5 items-center gap-4 bg-frame px-2.5 py-1 text-xs text-frame-muted max-[900px]:h-11 max-[900px]:gap-3 max-[900px]:overflow-hidden"
      aria-live="polite"
      data-testid="statusbar"
    >
      <span className="min-w-40 font-semibold text-frame-ink tabular-nums max-[900px]:min-w-0 max-[900px]:flex-none">
        {hoverText || '—'}
      </span>
      {message ? (
        <span
          className="font-semibold text-vent max-[900px]:line-clamp-2"
          data-testid="status-message"
        >
          {message}
        </span>
      ) : analysisText ? (
        <span
          className="font-semibold text-frame-ink max-[900px]:line-clamp-2"
          data-testid="analysis-status"
        >
          {analysisText}
        </span>
      ) : (
        <span className="max-[900px]:line-clamp-2">{hints[tool]}</span>
      )}
      <span className="flex-1 max-[900px]:hidden" />
      <span className="max-[900px]:hidden">{Math.round(zoom * 100)}%</span>
    </footer>
  );
}
