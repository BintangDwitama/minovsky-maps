import type {
  Account,
  AccountService,
  AccountStatus,
  ApiResult,
  CallOptions,
  OwnedScenario,
} from '../application/ports';
import { ApiClient, type ApiClientOptions } from './apiClient';

/** Sign-in with Google and account data, through the Go API at `/api`. Never throws. */
export class HttpAccountService implements AccountService {
  private readonly api: ApiClient;

  constructor(opts: ApiClientOptions = {}) {
    this.api = new ApiClient(opts);
  }

  async status(opts?: CallOptions): Promise<ApiResult<AccountStatus>> {
    const r = await this.api.call<{ available?: boolean; account?: Account }>(
      'GET',
      '/me',
      undefined,
      { opts },
    );
    if (!r.ok) return r;
    return {
      ok: true,
      value: { available: r.value.available === true, account: r.value.account ?? null },
    };
  }

  signInUrl(returnPath: string): string {
    return `${this.api.base}/auth/google/start?return=${encodeURIComponent(returnPath)}`;
  }

  signOut() {
    return this.api.call<object>('POST', '/auth/signout');
  }

  async rename(displayName: string): Promise<ApiResult<Account>> {
    const r = await this.api.call<{ account: Account }>('PATCH', '/me', { displayName });
    return r.ok ? { ok: true, value: r.value.account } : r;
  }

  deleteAccount() {
    return this.api.call<object>('DELETE', '/me');
  }

  async listOwned(opts?: CallOptions): Promise<ApiResult<OwnedScenario[]>> {
    const r = await this.api.call<{ scenarios: OwnedScenario[] }>(
      'GET',
      '/me/scenarios',
      undefined,
      { opts },
    );
    return r.ok ? { ok: true, value: r.value.scenarios ?? [] } : r;
  }

  async claim(items: readonly { id: string; token: string }[]): Promise<ApiResult<string[]>> {
    const r = await this.api.call<{ claimed: string[] }>('POST', '/me/claim', { items });
    return r.ok ? { ok: true, value: r.value.claimed ?? [] } : r;
  }
}
