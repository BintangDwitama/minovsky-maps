import { describe, expect, it } from 'vitest';
import { EditorSession } from '../../application/editorSession';
import { UiStore } from '../../application/uiState';
import { createScenario } from '../../domain/scenario';
import { createTools, type ToolContext } from './tools';

const setup = () => {
  const session = new EditorSession(createScenario());
  const ui = new UiStore();
  const ctx: ToolContext = { session, ui, ids: { next: () => 'x' }, requestLabel: () => null };
  return { session, ui, ctx, tool: createTools().analyse };
};

describe('Analyse tool', () => {
  it('places and moves the probe without touching the scenario or history', () => {
    const { session, ui, ctx, tool } = setup();
    ui.setTool('analyse');
    const before = session.scenario;
    tool.onDown({ q: 3, r: 2 }, ctx);
    tool.onUp(ctx);
    expect(ui.current.analysis.probe).toEqual({ q: 3, r: 2 });
    tool.onDown({ q: 4, r: 2 }, ctx);
    expect(ui.current.analysis.probe).toEqual({ q: 4, r: 2 });
    expect(session.scenario).toBe(before);
    expect(session.getSnapshot()).toMatchObject({ canUndo: false, dirty: false });
  });

  it('leaving the tool clears the probe but keeps the other settings', () => {
    const { ui, ctx, tool } = setup();
    ui.setTool('analyse');
    ui.setAnalysis({ side: 'B', speed: 2 });
    tool.onDown({ q: 1, r: 1 }, ctx);
    ui.setTool('select');
    expect(ui.current.analysis).toMatchObject({ probe: null, side: 'B', speed: 2 });
  });
});
