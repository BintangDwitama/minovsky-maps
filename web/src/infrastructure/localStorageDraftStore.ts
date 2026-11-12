import type { DraftStore } from '../application/ports';

/**
 * Autosave drafts in localStorage. Storage can be missing or throw (private mode, quota,
 * blocked site data); every access is guarded and failures degrade to "no draft".
 */
export class LocalStorageDraftStore implements DraftStore {
  constructor(
    private readonly key = 'minovsky-maps:draft:v1',
    private readonly storage: () => Storage | undefined = () => globalThis.localStorage,
  ) {}

  load(): string | null {
    try {
      return this.storage()?.getItem(this.key) ?? null;
    } catch {
      return null;
    }
  }

  save(json: string): void {
    try {
      this.storage()?.setItem(this.key, json);
    } catch {
      /* best effort */
    }
  }

  clear(): void {
    try {
      this.storage()?.removeItem(this.key);
    } catch {
      /* best effort */
    }
  }
}
