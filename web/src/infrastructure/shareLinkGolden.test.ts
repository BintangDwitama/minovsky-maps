import { describe, expect, it } from 'vitest';
import { openScenarioLink } from '../application/shareLink';
import { canonicalize } from '../domain/linkCodec';
import { loadScenario } from '../domain/serialization';
import { readFixture } from '../domain/testing/fixtures';
import { FflateCompressor } from './fflateCompressor';

/**
 * A real v1 link for schema/examples/sample-mesa.scenario.json, generated when codec v1 shipped.
 * Shared links are permanent: this must keep decoding to the same scenario forever.
 * Never regenerate it to make a failing test pass — fix the decoder instead.
 */
const GOLDEN_V1 =
  '1.dVPLbtswEPwVYs-bIJT8kHxrmx4DFDDQHgIfaGkjMZVElaSCuEb-vUO1cRq7BUzbnB0Od3eWR3qijWbqaXOkwfRCG9qafuxko24liI_qToIhJjPF1nmE7-zgnsL3g7ozY0CgllB5O0brhtNhFSoZjLdO9a6WrpNauUEZ9WCGq97UoqLZJ5bEadwAD1HGESScit50qsedDBETo3jgo-064wOrxnhvgxtC0mtt06rGu2molUlLVQgfZunaRGydl0SMLe6a-t7Ga3ph2tPmXi9ZL3dMqOiIEsbOHXpcjgr2JkiqK_yYTL21P9GSnAl5eGOHbcoYpAf7LHXSQvRIGoL5ihcFL5e8ynmtucAn4yLnMuNyxWXJWt9gLVhnKyzs84z1QmOl35z1Cv_XSKtYIa8MkuWaywJngGtwNDjZGgvYqtjh8gqk-zlh4ixj-kA7Pu1vAHycgdemUcrwD-kNQ8oXWHFzieHOS8GU9CW4WLyCbv8oVbRPSAi9oMrBXwcvYRFa_E1CVF46czgnp6acsz-b_7LRHjp5D-rtq_uXTBRxprt1GG2Fr9GFOB-YxsZjSolz9Ca0Vrr6Pa6L8t8BuE1hFMzGez68phC9DE1s55AM4psD8Tr_e6eXegfzm9nX7Ty-mfr6RT04r8RU7e_y1akgdXAT6pzLuYbnmEewrsY2jUAS_pSaMs__24OwQ3R4K608K1M_mvTmFBBIeZVmB0Lwb9bIaLd7-QU';

describe('golden share link (codec v1)', () => {
  it('still decodes to the sample scenario', () => {
    const fixture = loadScenario(readFixture('sample-mesa.scenario.json'));
    if (!fixture.ok) throw new Error(fixture.errors.join());
    const opened = openScenarioLink(GOLDEN_V1, new FflateCompressor());
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(canonicalize(opened.scenario)).toEqual(canonicalize(fixture.scenario));
  });
});
