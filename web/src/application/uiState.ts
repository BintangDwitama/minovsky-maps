/** Ephemeral editor UI state. Never part of the document or its history. */
import type { Axial } from '../domain/hex';
import type { ComponentKind, Owner, TerrainTag } from '../domain/scenario';
import { Store } from './store';

export type ToolId =
  'select' | 'terrain' | 'erase' | 'raise' | 'lower' | 'setLevel' | 'place' | 'analyse';

/** Settings of the Analyse tool: a hypothetical unit ("probe") and what to show for it. */
export interface AnalysisSettings {
  readonly probe: Axial | null;
  readonly side: 'A' | 'B';
  readonly mode: 'los' | 'reach' | 'both';
  /** Movement of the action (3 = Advance). */
  readonly move: number;
  readonly speed: number;
  /** Set by hand, standing in for enemy units (scenarios contain none). */
  readonly engaged: boolean;
  readonly hover: boolean;
}

export const initialAnalysis: AnalysisSettings = {
  probe: null,
  side: 'A',
  mode: 'both',
  move: 3,
  speed: 0,
  engaged: false,
  hover: false,
};

export interface PaletteState {
  readonly kind: ComponentKind;
  readonly owner: Owner;
  readonly upgradeType: 'shield' | 'speed' | 'strength';
  readonly objectiveType: 'controllable' | 'carryable';
  readonly facing: number;
  readonly label: string;
}

export interface UiState {
  readonly tool: ToolId;
  readonly terrainTag: TerrainTag;
  readonly level: number;
  readonly palette: PaletteState;
  readonly selectedId: string | null;
  readonly hover: Axial | null;
  /** Hexes highlighted by a selected warning. */
  readonly highlight: readonly Axial[];
  /** Short transient message, e.g. why a placement was refused. */
  readonly message: string | null;
  readonly zoom: number;
  readonly pan: { readonly x: number; readonly y: number };
  readonly analysis: AnalysisSettings;
}

export const initialUiState: UiState = {
  tool: 'select',
  terrainTag: 'water',
  level: 1,
  palette: {
    kind: 'base',
    owner: 'A',
    upgradeType: 'shield',
    objectiveType: 'controllable',
    facing: 0,
    label: '',
  },
  selectedId: null,
  hover: null,
  highlight: [],
  message: null,
  zoom: 1,
  pan: { x: 0, y: 0 },
  analysis: initialAnalysis,
};

export class UiStore extends Store<UiState> {
  constructor(initial: UiState = initialUiState) {
    super(initial);
  }

  get current(): UiState {
    return this.getSnapshot();
  }

  setTool(tool: ToolId): void {
    // leaving the Analyse tool removes the probe (overlays only exist while analysing)
    const analysis =
      tool === 'analyse' ? this.current.analysis : { ...this.current.analysis, probe: null };
    this.patch({ tool, message: null, analysis });
  }

  setAnalysis(p: Partial<AnalysisSettings>): void {
    this.patch({ analysis: { ...this.current.analysis, ...p } });
  }

  setPalette(p: Partial<PaletteState>): void {
    this.patch({ palette: { ...this.current.palette, ...p } });
  }

  select(id: string | null): void {
    if (this.current.selectedId !== id) this.patch({ selectedId: id });
  }

  setHover(h: Axial | null): void {
    const cur = this.current.hover;
    if (cur === h || (cur && h && cur.q === h.q && cur.r === h.r)) return;
    this.patch({ hover: h });
  }

  flash(message: string | null): void {
    this.patch({ message });
  }
}
