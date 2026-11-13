import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards the editor-theme contrast rule: chrome text tokens keep at least 4.5:1 against their
 * backgrounds in both colour schemes. Reads tokens.css directly so any token edit is checked.
 */
const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');

const vars = (block: string): Record<string, string> =>
  Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)].map((m) => [m[1]!, m[2]!]),
  );

const light = vars(css.slice(0, css.indexOf('@media')));
const darkStart = css.indexOf('prefers-color-scheme: dark');
const dark = {
  ...light,
  ...vars(css.slice(darkStart, css.indexOf('}', css.indexOf(':root', darkStart)))),
};

const luminance = (hex: string): number => {
  const h = hex.length === 4 ? hex.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3') : hex;
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a: string, b: string): number => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
};

/** [text token, background token] pairs used for chrome text. */
const PAIRS: readonly [string, string][] = [
  ['text', 'panel'],
  ['text', 'panel-2'],
  ['text', 'bg'],
  ['text', 'field'],
  ['text-muted', 'panel'],
  ['text-muted', 'panel-2'],
  ['danger', 'panel'],
  ['frame-ink', 'frame'],
  ['frame-ink', 'frame-2'],
  ['frame-muted', 'frame'],
  ['frame-muted', 'frame-2'],
  ['accent-ink', 'accent'],
  ['warning-text', 'warning-bg'],
];

it('reads both schemes from tokens.css', () => {
  expect(light.panel).toMatch(/^#/);
  expect(dark.panel).toMatch(/^#/);
  expect(dark.panel).not.toBe(light.panel);
});

describe.each([
  ['light', light],
  ['dark', dark],
])('%s scheme contrast', (_name, t) => {
  it.each(PAIRS)('%s on %s is at least 4.5:1', (fg, bg) => {
    expect(t[fg], `missing --${fg}`).toBeDefined();
    expect(t[bg], `missing --${bg}`).toBeDefined();
    const r = ratio(t[fg]!, t[bg]!);
    expect(r, `--${fg} ${t[fg]} on --${bg} ${t[bg]} is ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});
