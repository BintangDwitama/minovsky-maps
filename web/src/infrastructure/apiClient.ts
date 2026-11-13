import type { ApiFailure, ApiResult, CallOptions } from '../application/ports';

export interface ApiClientOptions {
  /** API base on the app's own origin. */
  base?: string;
  /** Free hosting can take ~1 minute to wake; give up after this. */
  timeoutMs?: number;
  /** When to report "slow" (probably waking up). */
  slowAfterMs?: number;
  fetchImpl?: typeof fetch;
}

/** Sent with every change: the API refuses cookie-authenticated changes without it (CSRF guard). */
export const CLIENT_HEADER = 'X-Minovsky-Client';

const failureFor = (status: number, code: string | undefined): ApiFailure => {
  if (code === 'bot-check') return 'bot';
  if (code === 'signed-out') return 'signed-out';
  if (code === 'not-owner') return 'not-owner';
  if (status === 404) return 'not-found';
  if (status === 401 || status === 403) return 'forbidden';
  if (status === 429) return 'rate-limited';
  if (status === 400 || status === 413 || status === 422) return 'invalid';
  return 'unavailable';
};

/**
 * JSON calls to the Go API at `/api` (same origin, so the session cookie travels along).
 * Never throws: every outcome is an ApiResult.
 */
export class ApiClient {
  readonly base: string;
  private readonly timeoutMs: number;
  private readonly slowAfterMs: number;
  readonly fetchImpl: typeof fetch;

  constructor(opts: ApiClientOptions = {}) {
    this.base = opts.base ?? '/api';
    this.timeoutMs = opts.timeoutMs ?? 90_000;
    this.slowAfterMs = opts.slowAfterMs ?? 3_000;
    this.fetchImpl = opts.fetchImpl ?? ((...args) => globalThis.fetch(...args));
  }

  async call<T>(
    method: string,
    path: string,
    body?: unknown,
    extra: { editToken?: string | null; opts?: CallOptions } = {},
  ): Promise<ApiResult<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const slow = setTimeout(() => extra.opts?.onSlow?.(), this.slowAfterMs);
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (method !== 'GET') headers[CLIENT_HEADER] = 'web';
      if (extra.editToken) headers.Authorization = `Bearer ${extra.editToken}`;
      const res = await this.fetchImpl(`${this.base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const data = (await res.json().catch(() => null)) as
        (T & { errors?: string[]; code?: string }) | null;
      if (res.ok) return { ok: true, value: (data ?? {}) as T };
      return {
        ok: false,
        failure: failureFor(res.status, data?.code),
        errors: data?.errors?.length ? data.errors : [`The server answered ${res.status}.`],
      };
    } catch (e) {
      const timedOut = (e as Error).name === 'AbortError';
      return {
        ok: false,
        failure: 'unavailable',
        errors: [
          timedOut
            ? 'The server did not answer in time.'
            : 'Could not reach the server. Check your connection.',
        ],
      };
    } finally {
      clearTimeout(timeout);
      clearTimeout(slow);
    }
  }
}
