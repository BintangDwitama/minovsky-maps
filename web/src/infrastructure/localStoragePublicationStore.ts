import type { Publication, PublicationStore } from '../application/ports';

const isPublication = (v: unknown): v is Publication => {
  const p = v as Publication;
  return (
    !!p && typeof p.id === 'string' && typeof p.editToken === 'string' && typeof p.name === 'string'
  );
};

/**
 * Edit tokens of scenarios published from (or edit links opened in) this browser.
 * Storage can be missing or throw; every access is guarded.
 */
export class LocalStoragePublicationStore implements PublicationStore {
  constructor(
    private readonly key = 'minovsky-maps:publications:v1',
    private readonly storage: () => Storage | undefined = () => globalThis.localStorage,
  ) {}

  list(): Publication[] {
    try {
      const raw = this.storage()?.getItem(this.key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(isPublication) : [];
    } catch {
      return [];
    }
  }

  get(id: string): Publication | null {
    return this.list().find((p) => p.id === id) ?? null;
  }

  save(p: Publication): void {
    try {
      const rest = this.list().filter((x) => x.id !== p.id);
      this.storage()?.setItem(
        this.key,
        JSON.stringify([{ id: p.id, editToken: p.editToken, name: p.name }, ...rest]),
      );
    } catch {
      /* best effort */
    }
  }
}
