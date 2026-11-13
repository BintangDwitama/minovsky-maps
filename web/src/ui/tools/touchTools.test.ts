import { describe, expect, it } from 'vitest';
import { EditorSession } from '../../application/editorSession';
import { UiStore } from '../../application/uiState';
import { hasTag } from '../../domain/operations';
import { createScenario } from '../../domain/scenario';
import { createTools, type ToolContext } from './tools';

const setup = (pointer: 'mouse' | 'touch') => {
  const session = new EditorSession(createScenario());
  const ui = new UiStore();
  let n = 0;
  const ctx: ToolContext = {
    session,
    ui,
    ids: { next: () => `c${++n}` },
    requestLabel: () => null,
    pointer,
  };
  return { session, ui, ctx, tools: createTools() };
};

describe('cancelled strokes', () => {
  it('a cancelled paint stroke leaves no change and no history', () => {
    const { session, ctx, tools } = setup('touch');
    const before = session.scenario;
    tools.terrain.onDown({ q: 1, r: 1 }, ctx);
    tools.terrain.onMove({ q: 2, r: 1 }, ctx);
    expect(hasTag(session.scenario, { q: 2, r: 1 }, 'water')).toBe(true);
    tools.terrain.onCancel(ctx);
    expect(session.scenario).toBe(before);
    expect(session.getSnapshot()).toMatchObject({ canUndo: false, dirty: false });
  });

  it('a cancelled move puts the component back without history', () => {
    const { session, ui, ctx, tools } = setup('touch');
    tools.place.onTap!({ q: 1, r: 1 }, ctx);
    const placed = session.scenario;
    const id = ui.current.selectedId!;
    tools.select.onDown({ q: 1, r: 1 }, ctx);
    tools.select.onMove({ q: 3, r: 1 }, ctx);
    tools.select.onCancel(ctx);
    expect(session.scenario).toBe(placed);
    expect(session.scenario.components.find((c) => c.id === id)?.hex).toEqual({ q: 1, r: 1 });
  });
});

describe('touch behaviour', () => {
  it('place: a tap places, a drag asks to pan', () => {
    const { session, ctx, tools } = setup('touch');
    expect(tools.place.onDown({ q: 1, r: 1 }, ctx)).toBe('pan');
    expect(session.scenario.components).toHaveLength(0);
    tools.place.onTap!({ q: 1, r: 1 }, ctx);
    expect(session.scenario.components).toHaveLength(1);
  });

  it('place with a mouse still places on down', () => {
    const { session, ctx, tools } = setup('mouse');
    expect(tools.place.onDown({ q: 1, r: 1 }, ctx)).toBeUndefined();
    expect(session.scenario.components).toHaveLength(1);
  });

  it('select: dragging empty space pans; a tap selects', () => {
    const { ui, ctx, tools } = setup('touch');
    tools.place.onTap!({ q: 2, r: 2 }, ctx);
    ui.select(null);
    expect(tools.select.onDown({ q: 5, r: 5 }, ctx)).toBe('pan');
    tools.select.onTap!({ q: 2, r: 2 }, ctx);
    expect(ui.current.selectedId).not.toBeNull();
    tools.select.onTap!({ q: 5, r: 5 }, ctx);
    expect(ui.current.selectedId).toBeNull();
  });

  it('analyse: first tap places the probe, later taps inspect, dragging the probe moves it', () => {
    const { session, ui, ctx, tools } = setup('touch');
    const a = tools.analyse;
    ui.setTool('analyse');
    a.onTap!({ q: 3, r: 2 }, ctx);
    expect(ui.current.analysis.probe).toEqual({ q: 3, r: 2 });

    a.onTap!({ q: 6, r: 4 }, ctx);
    expect(ui.current.analysis.probe).toEqual({ q: 3, r: 2 });
    expect(ui.current.hover).toEqual({ q: 6, r: 4 });

    expect(a.onDown({ q: 8, r: 8 }, ctx)).toBe('pan');
    expect(a.onDown({ q: 3, r: 2 }, ctx)).toBeUndefined();
    a.onMove({ q: 4, r: 3 }, ctx);
    a.onUp(ctx);
    expect(ui.current.analysis.probe).toEqual({ q: 4, r: 3 });
    expect(ui.current.hover).toBeNull();
    expect(session.getSnapshot().canUndo).toBe(false);
  });

  it('changing tool after a touch clears the touched hex', () => {
    const { ui } = setup('touch');
    ui.setPointer('touch');
    ui.setHover({ q: 1, r: 1 });
    ui.setTool('raise');
    expect(ui.current.hover).toBeNull();
  });
});
