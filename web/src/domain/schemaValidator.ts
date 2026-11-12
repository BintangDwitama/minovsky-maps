import Ajv2020, { type ErrorObject } from 'ajv/dist/2020';
import schema from '../../../schema/scenario.v1.schema.json';
import type { Scenario } from './scenario';

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateFn = ajv.compile<Scenario>(schema);

const KIND_DEF: Record<string, string> = {
  base: 'BaseComponent',
  carrier: 'CarrierComponent',
  garrison: 'GarrisonComponent',
  upgrade: 'UpgradeComponent',
  energy: 'EnergyComponent',
  objective: 'ObjectiveComponent',
  token: 'TokenComponent',
  structure: 'StructureComponent',
};

const describe = (e: ErrorObject): string => {
  const where = e.instancePath || '(document)';
  switch (e.keyword) {
    case 'enum':
      return `${where}: must be one of ${(e.params as { allowedValues: unknown[] }).allowedValues.map((v) => JSON.stringify(v)).join(', ')}`;
    case 'const':
      return `${where}: must be ${JSON.stringify((e.params as { allowedValue: unknown }).allowedValue)}`;
    case 'additionalProperties':
      return `${where}: unknown field "${(e.params as { additionalProperty: string }).additionalProperty}"`;
    case 'required':
      return `${where}: missing field "${(e.params as { missingProperty: string }).missingProperty}"`;
    default:
      return `${where}: ${e.message ?? e.keyword}`;
  }
};

/**
 * Component entries are a oneOf union, which makes Ajv report errors for every branch.
 * Replace them with errors from re-validating each bad component against the branch its
 * `kind` names (or a single "unknown component kind" message).
 */
const componentMessages = (doc: unknown, errors: ErrorObject[]): string[] => {
  const components = (doc as { components?: unknown[] })?.components ?? [];
  const bad = new Set<number>();
  for (const e of errors) {
    const m = /^\/components\/(\d+)/.exec(e.instancePath);
    if (m) bad.add(Number(m[1]));
  }
  return [...bad].flatMap((i) => {
    const c = components[i] as { kind?: unknown } | undefined;
    const def = typeof c?.kind === 'string' ? KIND_DEF[c.kind] : undefined;
    if (!def) return [`/components/${i}: unknown component kind ${JSON.stringify(c?.kind)}`];
    const branch = ajv.getSchema(`${schema.$id}#/$defs/${def}`)!;
    branch(c);
    return (branch.errors ?? []).map((e) =>
      describe({ ...e, instancePath: `/components/${i}${e.instancePath}` }),
    );
  });
};

export type SchemaCheck = { ok: true; scenario: Scenario } | { ok: false; errors: string[] };

export const validateSchema = (doc: unknown): SchemaCheck => {
  if (validateFn(doc)) return { ok: true, scenario: doc };
  const all = validateFn.errors ?? [];
  const errors = [
    ...all.filter((e) => !/^\/components\/\d+/.test(e.instancePath)).map(describe),
    ...componentMessages(doc, all),
  ];
  return { ok: false, errors: [...new Set(errors)] };
};
