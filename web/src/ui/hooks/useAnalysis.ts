import { useMemo } from 'react';
import type { AnalysisSettings } from '../../application/uiState';
import { buildAnalysisIndex, type AnalysisIndex } from '../../domain/analysis/analysisIndex';
import { lineOfSight } from '../../domain/analysis/lineOfSight';
import { isEngaged, reach, type Reach } from '../../domain/analysis/reach';
import type { HexKey } from '../../domain/hex';
import type { Scenario } from '../../domain/scenario';

export interface AnalysisResult {
  readonly index: AnalysisIndex;
  readonly visible: ReadonlyMap<HexKey, boolean> | null;
  readonly reach: Reach | null;
  /** Engaged by an adjacent enemy garrison (detected); manual Engaged is in the settings. */
  readonly autoEngaged: boolean;
}

/** Derived analysis for the current probe; recomputed only when the scenario or settings change. */
export const useAnalysis = (scenario: Scenario, a: AnalysisSettings): AnalysisResult | null =>
  useMemo(() => {
    if (!a.probe) return null;
    const index = buildAnalysisIndex(scenario);
    if (!index.onBoard(a.probe)) return null;
    const autoEngaged = isEngaged(index, a.probe, a.side);
    return {
      index,
      autoEngaged,
      visible:
        a.mode === 'reach' ? null : lineOfSight(index, scenario.board.hexes, a.probe, a.side),
      reach:
        a.mode === 'los'
          ? null
          : reach(index, a.probe, {
              side: a.side,
              move: a.move,
              speed: a.speed,
              engaged: autoEngaged || a.engaged,
              hover: a.hover,
            }),
    };
  }, [scenario, a]);
