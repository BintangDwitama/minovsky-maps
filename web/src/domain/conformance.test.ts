/**
 * Shared conformance suite: schema/conformance.json is also run by the Go server
 * (server/internal/scenario/validate_test.go), so editor and API accept and reject the same documents.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkIntegrity } from './integrity';
import type { Scenario } from './scenario';
import { validateSchema } from './schemaValidator';
import { loadScenario } from './serialization';
import { listFixtures, readFixture } from './testing/fixtures';

interface Conformance {
  valid: string[];
  invalid: Record<string, { rejectedBy: string }>;
}

const here = dirname(fileURLToPath(import.meta.url));
const conformance = JSON.parse(
  readFileSync(resolve(here, '../../../schema/conformance.json'), 'utf8'),
) as Conformance;

describe('shared conformance suite', () => {
  it('lists every example file', () => {
    expect(listFixtures().sort()).toEqual([...conformance.valid].sort());
    expect(listFixtures('invalid').sort()).toEqual(Object.keys(conformance.invalid).sort());
  });

  it.each(conformance.valid)('%s loads', (name) => {
    expect(loadScenario(readFixture(name)).ok).toBe(true);
  });

  it.each(Object.entries(conformance.invalid))('%s is rejected by %s', (name, { rejectedBy }) => {
    const doc = readFixture(`invalid/${name}`);
    expect(loadScenario(doc).ok).toBe(false);
    if (rejectedBy === 'schema') return;
    // integrity rule: the schema passes and the named rule fires
    const schema = validateSchema(doc);
    expect(schema.ok).toBe(true);
    const codes = checkIntegrity(doc as Scenario).map((e) => e.code);
    expect(codes).toContain(rejectedBy);
  });
});
