/**
 * Account use cases. Signing in itself is a browser redirect (AccountService.signInUrl); these are
 * the steps around it.
 */
import type { AccountService, PublicationStore } from './ports';

/** Outcome of returning from Google, as reported by the API in `?signin=…`. */
export type SignInResult = 'ok' | 'failed' | 'unverified' | 'unavailable';

export const parseSignInResult = (search: string): SignInResult | null => {
  const v = new URLSearchParams(search).get('signin');
  return v === 'ok' || v === 'failed' || v === 'unverified' || v === 'unavailable' ? v : null;
};

/** The address without the `signin` parameter (to tidy the address bar after reading it). */
export const withoutSignInParam = (pathname: string, search: string, hash: string): string => {
  const params = new URLSearchParams(search);
  params.delete('signin');
  const q = params.toString();
  return `${pathname}${q ? `?${q}` : ''}${hash}`;
};

/**
 * Give the signed-in account every legacy scenario this browser holds an edit token for.
 * Claimed tokens are forgotten (the account owns those scenarios now); tokens the server did not
 * accept stay, e.g. for a scenario someone else claimed. Never throws.
 */
export const claimLegacyScenarios = async (
  accounts: AccountService,
  store: PublicationStore,
): Promise<{ claimed: number }> => {
  const held = store.list();
  if (held.length === 0) return { claimed: 0 };
  const r = await accounts.claim(held.slice(0, 100).map((p) => ({ id: p.id, token: p.editToken })));
  if (!r.ok) return { claimed: 0 };
  for (const id of r.value) store.remove(id);
  return { claimed: r.value.length };
};

export const claimedMessage = (n: number): string =>
  n === 1 ? '1 scenario added to your account.' : `${n} scenarios added to your account.`;
