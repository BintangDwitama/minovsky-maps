/**
 * Ordered document migrations. Migration n -> n+1 receives a document at version n and returns one
 * at version n+1. v1 is the first version, so the production list is empty; the pipeline is built
 * and tested now so that the first real format change is a one-entry addition.
 */
export interface Migration {
  readonly from: number;
  readonly to: number;
  migrate(doc: Record<string, unknown>): Record<string, unknown>;
}

export const MIGRATIONS: readonly Migration[] = [];

export type MigrationResult =
  | { ok: true; doc: Record<string, unknown>; migratedFrom: number | null }
  | { ok: false; error: string };

export const migrateToVersion = (
  doc: Record<string, unknown>,
  target: number,
  migrations: readonly Migration[] = MIGRATIONS,
): MigrationResult => {
  const raw = doc.schemaVersion;
  if (typeof raw !== 'number' || !Number.isInteger(raw)) {
    return { ok: false, error: 'This file has no valid "schemaVersion", so it is not a Minovsky Maps scenario.' };
  }
  if (raw > target) {
    return {
      ok: false,
      error: `This scenario uses format version ${raw}, but this editor only understands up to version ${target}. Please use a newer version of Minovsky Maps.`,
    };
  }
  let current = doc;
  let version = raw;
  while (version < target) {
    const step = migrations.find((m) => m.from === version);
    if (!step) {
      return { ok: false, error: `No upgrade path from format version ${version} to ${target}.` };
    }
    current = { ...step.migrate(current), schemaVersion: step.to };
    version = step.to;
  }
  return { ok: true, doc: current, migratedFrom: raw === target ? null : raw };
};
