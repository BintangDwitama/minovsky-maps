import { useEffect } from 'react';
import { axialToOffset } from '../../domain/hex';
import { buildIndex, elevationAt, tagsAt } from '../../domain/scenarioIndex';
import { useEditor, useServices, useUi } from '../hooks/editorContext';
import { TERRAIN_LABELS } from '../theme';

const TOOL_HINT: Record<string, string> = {
  select: 'Click a component to select, drag to move. Space+drag or middle-drag pans; wheel zooms.',
  terrain: 'Click or drag to paint. Starting on a painted hex removes instead.',
  erase: 'Click or drag to clear all terrain from hexes.',
  raise: 'Click or drag to add one pillar per hex.',
  lower: 'Click or drag to remove one pillar per hex.',
  setLevel: 'Click or drag to set hexes to the chosen level.',
  place: 'Click a hex to place the selected component.',
};

export function StatusBar() {
  const { ui } = useServices();
  const { scenario } = useEditor();
  const { hover, message, tool, zoom } = useUi();

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
      className="flex min-h-6.5 items-center gap-4 bg-frame px-2.5 py-1 text-xs text-frame-muted"
      aria-live="polite"
      data-testid="statusbar"
    >
      <span className="min-w-40 font-semibold text-frame-ink tabular-nums">{hoverText || '—'}</span>
      {message ? (
        <span className="font-semibold text-vent" data-testid="status-message">
          {message}
        </span>
      ) : (
        <span>{TOOL_HINT[tool]}</span>
      )}
      <span className="flex-1" />
      <span>{Math.round(zoom * 100)}%</span>
    </footer>
  );
}
