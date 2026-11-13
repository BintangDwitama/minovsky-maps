import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  claimedMessage,
  claimLegacyScenarios,
  parseSignInResult,
  type SignInResult,
  withoutSignInParam,
} from '../../application/accounts';
import type { Account, AccountService, ApiResult, PublicationStore } from '../../application/ports';

export interface AccountContextValue {
  /** Still asking the server who is signed in. */
  readonly loading: boolean;
  /** Sign-in is configured on this server. */
  readonly available: boolean;
  readonly account: Account | null;
  /** How a sign-in that just returned to the app ended (read once from `?signin=`). */
  readonly signInResult: SignInResult | null;
  /** A short message for the user (signed in, scenarios claimed, sign-in failed). */
  readonly notice: string | null;
  dismissNotice(): void;
  /** Go to Google; afterwards the browser returns to `returnPath` (default: here). */
  signIn(returnPath?: string): void;
  signOut(): Promise<boolean>;
  rename(name: string): Promise<ApiResult<Account>>;
  deleteAccount(): Promise<ApiResult<object>>;
  readonly service: AccountService;
}

const AccountContext = createContext<AccountContextValue | null>(null);

const FAILURE_NOTICE: Record<Exclude<SignInResult, 'ok'>, string> = {
  failed: 'Sign-in did not complete. Please try again.',
  unverified:
    'Google has not verified the email address of that account, so it cannot be used to sign in.',
  unavailable: 'Sign-in is not available on this server right now.',
};

const here = () => `${location.pathname}${location.search}${location.hash}`;

/**
 * Reads (and removes from the address bar) the result of a sign-in that just came back. Done once
 * per page load and cached: React may run state initializers twice (StrictMode), and the second
 * run would no longer see the parameter.
 */
let signInResultOnce: SignInResult | null | undefined;
const takeSignInResult = (): SignInResult | null => {
  if (signInResultOnce !== undefined) return signInResultOnce;
  const r = parseSignInResult(location.search);
  if (r) {
    history.replaceState(
      history.state,
      '',
      withoutSignInParam(location.pathname, location.search, location.hash),
    );
  }
  signInResultOnce = r;
  return r;
};
/**
 * Who is signed in, for the whole app. After sign-in it claims the legacy scenarios this browser
 * holds edit tokens for, and tells the user what happened.
 */
export function AccountProvider({
  service,
  publications,
  children,
}: {
  service: AccountService;
  publications: PublicationStore;
  children: ReactNode;
}) {
  const [signInResult] = useState(takeSignInResult);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [notice, setNotice] = useState<string | null>(
    signInResult && signInResult !== 'ok' ? FAILURE_NOTICE[signInResult] : null,
  );

  useEffect(() => {
    let active = true;
    void service.status().then(async (r) => {
      if (!active) return;
      setLoading(false);
      if (!r.ok) return;
      setAvailable(r.value.available);
      setAccount(r.value.account);
      if (!r.value.account) return;
      const { claimed } = await claimLegacyScenarios(service, publications);
      if (!active) return;
      const parts: string[] = [];
      if (signInResult === 'ok') parts.push(`Signed in as ${r.value.account.displayName}.`);
      if (claimed > 0) parts.push(claimedMessage(claimed));
      if (parts.length) setNotice(parts.join(' '));
    });
    return () => {
      active = false;
    };
  }, [service, publications, signInResult]);

  const signIn = useCallback(
    (returnPath?: string) => location.assign(service.signInUrl(returnPath ?? here())),
    [service],
  );

  const signOut = useCallback(async () => {
    const r = await service.signOut();
    if (r.ok) {
      setAccount(null);
      setNotice('Signed out.');
    }
    return r.ok;
  }, [service]);

  const rename = useCallback(
    async (name: string) => {
      const r = await service.rename(name);
      if (r.ok) setAccount(r.value);
      return r;
    },
    [service],
  );

  const deleteAccount = useCallback(async () => {
    const r = await service.deleteAccount();
    if (r.ok) {
      setAccount(null);
      setNotice('Your account was deleted.');
    }
    return r;
  }, [service]);

  const value = useMemo<AccountContextValue>(
    () => ({
      loading,
      available,
      account,
      signInResult,
      notice,
      dismissNotice: () => setNotice(null),
      signIn,
      signOut,
      rename,
      deleteAccount,
      service,
    }),
    [
      loading,
      available,
      account,
      signInResult,
      notice,
      signIn,
      signOut,
      rename,
      deleteAccount,
      service,
    ],
  );
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const v = useContext(AccountContext);
  if (!v) throw new Error('useAccount outside AccountProvider');
  return v;
}
