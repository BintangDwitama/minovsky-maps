/** Ports: what the application needs from the outside world. Infrastructure implements them. */
import type { Scenario } from '../domain/scenario';

export interface ScenarioFileReader {
  /** Ask the user for a file. Resolves null if cancelled. */
  pick(): Promise<string | null>;
  /** Read a file the user dropped. */
  read(source: Blob): Promise<string>;
}

export interface FileWriter {
  /** Hand a file to the user (download). */
  write(fileName: string, data: Blob): Promise<void>;
}

/** Best-effort autosave. Implementations must never throw. */
export interface DraftStore {
  load(): string | null;
  save(json: string): void;
  clear(): void;
}

export interface ImageExporter {
  /** Render the board (no UI overlays) to a PNG at least `minLongSide` px on its longest side. */
  renderPng(s: Scenario, minLongSide: number): Promise<Blob>;
}

export interface IdGenerator {
  next(): string;
}
