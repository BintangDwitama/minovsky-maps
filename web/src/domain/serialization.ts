import { checkIntegrity } from './integrity';
import { type Migration, MIGRATIONS, migrateToVersion } from './migrations';
import { CURRENT_SCHEMA_VERSION, type Scenario } from './scenario';
import { type SchemaCheck, validateSchema } from './schemaValidator';

export type LoadResult =
  | { ok: true; scenario: Scenario; migratedFrom: number | null }
  | { ok: false; errors: string[] };

export interface LoaderOptions {
  readonly targetVersion?: number;
  readonly migrations?: readonly Migration[];
  readonly validate?: (doc: unknown) => SchemaCheck;
}

/** version detection -> migrate -> schema validation -> integrity check. Never throws. */
export const loadScenario = (input: string | unknown, opts: LoaderOptions = {}): LoadResult => {
  let doc: unknown = input;
  if (typeof input === 'string') {
    try {
      doc = JSON.parse(input);
    } catch (e) {
      return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] };
    }
  }
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    return { ok: false, errors: ['A scenario file must contain a JSON object.'] };
  }

  const migrated = migrateToVersion(
    doc as Record<string, unknown>,
    opts.targetVersion ?? CURRENT_SCHEMA_VERSION,
    opts.migrations ?? MIGRATIONS,
  );
  if (!migrated.ok) return { ok: false, errors: [migrated.error] };

  const checked = (opts.validate ?? validateSchema)(migrated.doc);
  if (!checked.ok) return { ok: false, errors: checked.errors };

  const integrity = checkIntegrity(checked.scenario);
  if (integrity.length > 0) return { ok: false, errors: integrity.map((e) => e.message) };

  return { ok: true, scenario: checked.scenario, migratedFrom: migrated.migratedFrom };
};

export const serializeScenario = (s: Scenario): string => `${JSON.stringify(s, null, 2)}\n`;

export const slugify = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'scenario';

export const scenarioFileName = (s: Scenario): string => `${slugify(s.meta.name)}.scenario.json`;
export const imageFileName = (s: Scenario): string => `${slugify(s.meta.name)}.png`;
