// Generates TypeScript types from the shared scenario JSON Schema.
// The schema in ../schema is the single source of truth; never edit the output by hand.
import { compileFromFile } from 'json-schema-to-typescript';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, '../../schema/scenario.v1.schema.json');
const outPath = resolve(here, '../src/domain/generated/scenario.v1.ts');

const ts = await compileFromFile(schemaPath, {
  bannerComment:
    '/* eslint-disable */\n/**\n * GENERATED from schema/scenario.v1.schema.json by `npm run gen:types`.\n * Do not edit by hand.\n */',
  additionalProperties: false,
  unreachableDefinitions: true,
  style: { singleQuote: true, printWidth: 100 },
  cwd: dirname(schemaPath),
});

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, ts.replace(/\r\n/g, '\n'));
console.log(`wrote ${outPath}`);
