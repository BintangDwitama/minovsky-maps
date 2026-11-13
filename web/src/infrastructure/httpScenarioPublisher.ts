import type { ApiFailure, ApiResult, CallOptions, ScenarioPublisher } from '../application/ports';
import type { Scenario } from '../domain/scenario';

export interface HttpPublisherOptions {
  /** API base on the app's own origin. */
  base?: string;
  /** Free hosting can take ~1 minute to wake; give up after this. */
  timeoutMs?: number;
  /** When to report "slow" (probably waking up). */
  slowAfterMs?: number;
  fetchImpl?: typeof fetch;
}

const failureFor = (status: number): ApiFailure => {
  if (status === 404) return 'not-found';
  if (status === 401 || status === 403) return 'forbidden';
  if (status === 429) return 'rate-limited';
  if (status === 400 || status === 413 || status === 422) return 'invalid';
  return 'unavailable';
};

/** Talks to the Go API at `/api` (same origin; Cloudflare forwards it). Never throws. */
export class HttpScenarioPublisher implements ScenarioPublisher {
  private readonly base: string;
  private readonly timeoutMs: number;
  private readonly slowAfterMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: HttpPublisherOptions = {}) {
    this.base = opts.base ?? '/api';
    this.timeoutMs = opts.timeoutMs ?? 90_000;
    this.slowAfterMs = opts.slowAfterMs ?? 3_000;
    this.fetchImpl = opts.fetchImpl ?? ((...args) => globalThis.fetch(...args));
  }

  publish(s: Scenario, opts?: CallOptions) {
    return this.call<{ id: string; editToken: string; updatedAt: string }>(
      'POST',
      '/scenarios',
      { scenario: s },
      undefined,
      opts,
    );
  }

  update(id: string, editToken: string, s: Scenario, opts?: CallOptions) {
    return this.call<{ updatedAt: string }>(
      'PUT',
      `/scenarios/${encodeURIComponent(id)}`,
      { scenario: s },
      editToken,
      opts,
    );
  }

  fetch(id: string, opts?: CallOptions) {
    return this.call<{ scenario: unknown; updatedAt: string }>(
      'GET',
      `/scenarios/${encodeURIComponent(id)}`,
      undefined,
      undefined,
      opts,
    );
  }

  wake(): void {
    void this.fetchImpl(`${this.base}/health`, { method: 'GET' }).catch(() => undefined);
  }

  private async call<T>(
    method: string,
    path: string,
    body: unknown,
    token: string | undefined,
    opts: CallOptions | undefined,
  ): Promise<ApiResult<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const slow = setTimeout(() => opts?.onSlow?.(), this.slowAfterMs);
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await this.fetchImpl(`${this.base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => null)) as (T & { errors?: string[] }) | null;
      if (res.ok && data) return { ok: true, value: data };
      return {
        ok: false,
        failure: failureFor(res.status),
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
