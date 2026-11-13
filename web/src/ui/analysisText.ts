import type { AnalysisSettings } from '../application/uiState';
import { traceSightLine } from '../domain/analysis/lineOfSight';
import { type Axial, hexEquals, hexKey } from '../domain/hex';
import { hexText } from '../domain/boardDescription';
import type { AnalysisResult } from './hooks/useAnalysis';

/**
 * What the Analyse tool says about `hex`: sight line and reach from the probe. Null when there is
 * nothing to say (no probe, or the hex is off the board). Shared by the status bar and the
 * screen-reader announcer.
 */
export function analysisText(
  result: AnalysisResult | null,
  a: AnalysisSettings,
  hex: Axial | null,
): string | null {
  if (!result || !a.probe || !hex || !result.index.onBoard(hex)) return null;
  if (hexEquals(hex, a.probe)) return 'The probe stands here.';
  const parts: string[] = [];
  if (result.visible) {
    const s = traceSightLine(result.index, a.probe, a.side, hex);
    parts.push(
      s.visible
        ? 'Line of sight clear'
        : s.blocker!.reason === 'terrain'
          ? `Blocked by terrain at level ${s.blocker!.elevation} on ${hexText(s.blocker!.hex)}`
          : `Blocked by an enemy piece on ${hexText(s.blocker!.hex)}`,
    );
  }
  if (result.reach) {
    const cost = result.reach.costs.get(hexKey(hex));
    parts.push(cost === undefined ? 'out of reach' : `reach: ${cost} movement`);
  }
  return parts.join(' · ');
}
