import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { toBase64Url } from '../domain/base64url';
import { canonicalize } from '../domain/linkCodec';
import { createScenario, type Scenario } from '../domain/scenario';
import { loadScenario } from '../domain/serialization';
import { readFixture } from '../domain/testing/fixtures';
import { EditorSession } from './editorSession';
import type { Compressor } from './ports';
import {
  createShareLink,
  editSharedCopy,
  encodeScenarioLink,
  LONG_LINK_LENGTH,
  openScenarioLink,
  VIEW_ROUTE,
} from './shareLink';

/** Test double backed by Node's zlib (raw deflate, same format as the fflate adapter). */
const zlib: Compressor = {
  deflate: (d) => new Uint8Array(deflateRawSync(d, { level: 9 })),
  inflate: (d, max) => new Uint8Array(inflateRawSync(d, { maxOutputLength: max })),
};

const APP = 'https://minovsky-maps.pages.dev/';

const sample = (): Scenario => {
  const r = loadScenario(readFixture('sample-mesa.scenario.json'));
  if (!r.ok) throw new Error(r.errors.join());
  return r.scenario;
};

const partOf = (link: string) => link.slice(link.indexOf(VIEW_ROUTE) + VIEW_ROUTE.length);

describe('createShareLink', () => {
  it('builds a versioned fragment link that opens to the same scenario', () => {
    const r = createShareLink(sample(), APP, zlib);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.link.startsWith(`${APP}#/view/1.`)).toBe(true);
    const opened = openScenarioLink(partOf(r.link), zlib);
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(canonicalize(opened.scenario)).toEqual(canonicalize(sample()));
  });

  it('keeps the realistic sample under 1,500 characters', () => {
    const r = createShareLink(sample(), APP, zlib);
    expect(r.ok && r.link.length).toBeLessThan(1500);
    expect(r.ok && r.long).toBe(false);
  });

  it('flags long links', () => {
    const s = sample();
    const wordy = {
      ...s,
      meta: {
        ...s.meta,
        description: Array.from({ length: 400 }, (_, i) => `w${i * 7919}`).join(' '),
      },
    };
    const r = createShareLink(wordy, APP, zlib);
    expect(r.ok && r.link.length).toBeGreaterThan(LONG_LINK_LENGTH);
    expect(r.ok && r.long).toBe(true);
  });

  it('is refused with the save blockers', () => {
    const s = createScenario({ name: '' });
    const r = createShareLink(s, APP, zlib);
    expect(r).toEqual({ ok: false, errors: ['Give the scenario a name before saving.'] });
  });
});

describe('openScenarioLink', () => {
  const good = encodeScenarioLink(sample(), zlib);

  it('rejects links from a newer codec', () => {
    expect(openScenarioLink(`9.${good.split('.')[1]}`, zlib)).toMatchObject({
      ok: false,
      reason: 'newer',
    });
  });

  it.each([
    ['truncated', good.slice(0, Math.floor(good.length / 2))],
    ['no version', good.split('.')[1]!],
    ['garbage', '1.%%%not-base64'],
    ['empty payload', '1.'],
    ['not json', `1.${toBase64Url(zlib.deflate(new TextEncoder().encode('{nope')))}`],
  ])('reports a damaged link: %s', (_label, part) => {
    expect(openScenarioLink(part, zlib)).toMatchObject({ ok: false, reason: 'damaged' });
  });

  it('refuses a decompression bomb', () => {
    const bomb = toBase64Url(zlib.deflate(new Uint8Array(3_000_000).fill(32)));
    expect(openScenarioLink(`1.${bomb}`, zlib)).toMatchObject({ ok: false, reason: 'damaged' });
  });

  it('reports scenarios that fail validation as invalid', () => {
    const doc = {
      v: 1,
      m: { name: 'x' },
      b: [2, 2],
      r: { deployment: 'bases', squadSize: 99, terrainSetup: 'fixed' },
    };
    const part = `1.${toBase64Url(zlib.deflate(new TextEncoder().encode(JSON.stringify(doc))))}`;
    expect(openScenarioLink(part, zlib)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('accepts a percent-encoded payload (some chat apps re-encode links)', () => {
    expect(openScenarioLink(encodeURIComponent(good), zlib).ok).toBe(true);
  });
});

describe('editSharedCopy', () => {
  it('opens the scenario as unsaved with no history', () => {
    const session = new EditorSession(createScenario());
    editSharedCopy(session, sample());
    const snap = session.getSnapshot();
    expect(snap.scenario.meta.name).toBe('Sample: Desert Mesa');
    expect(snap.dirty).toBe(true);
    expect(snap.canUndo).toBe(false);
  });
});
