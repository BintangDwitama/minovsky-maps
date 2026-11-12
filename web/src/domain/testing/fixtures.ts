import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Scenario } from '../scenario';

const here = dirname(fileURLToPath(import.meta.url));
const examples = resolve(here, '../../../../schema/examples');

export const readFixture = (name: string): unknown =>
  JSON.parse(readFileSync(resolve(examples, name), 'utf8'));

export const readScenarioFixture = (name: string): Scenario => readFixture(name) as Scenario;

export const listFixtures = (dir = ''): string[] =>
  readdirSync(resolve(examples, dir)).filter((f) => f.endsWith('.json'));
