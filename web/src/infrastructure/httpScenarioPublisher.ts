import type {
  ApiFailure,
  ApiResult,
  CallOptions,
  HumanCheck,
  ReportInput,
  ScenarioPublisher,
} from '../application/ports';
import type { Scenario } from '../domain/scenario';

export interface HttpPublisherOptions {
  /** API base on the app's own origin. */
  base?: string;
  /** Free hosting can take ~1 minute to wake; give up after this. */
  timeoutMs?: number;
  /** When to report "slow" (probably waking up). */
  slowAfterMs?: number;
  fetchImpl?: typeof fetch;
  /** Bot check for publish, update and report; omitted = no token sent. */
  humanCheck?: HumanCheck;
}

const failureFor = (status: number, code: string | undefined): ApiFailure => {
  if (code === 'bot-check') return 'bot';
  if (status === 404) return 'not-found';
  if (status === 401 || status === 403) return 'forbidden';
  if (status === 429) return 'rate-limited';
  if (status === 400 || status === 413 || status === 422) return 'invalid';
  return 'unavailable';
};

const BOT_CHECK_FAILED =
  'The bot check could not run. If you use an ad or script blocker, allow challenges.cloudflare.com, then try again.';

/** Talks to the Go API at `/api` (same origin; Cloudflare forwards it). Never throws. */
export class HttpScenarioPublisher implements ScenarioPublisher {
  private readonly base: string;
  private readonly timeoutMs: number;
  private readonly slowAfterMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly humanCheck: HumanCheck | undefined;

  constructor(opts: HttpPublisherOptions = {}) {
    this.base = opts.base ?? '/api';
    this.timeoutMs = opts.timeoutMs ?? 90_000;
    this.slowAfterMs = opts.slowAfterMs ?? 3_000;
    this.fetchImpl = opts.fetchImpl ?? ((...args) => globalThis.fetch(...args));
    this.humanCheck = opts.humanCheck;
  }

  publish(s: Scenario, opts?: CallOptions) {
    return this.checked<{ id: string; editToken: string; updatedAt: string }>(
      'POST',
      '/scenarios',
      { scenario: s },
      undefined,
      opts,
    );
  }

  update(id: string, editToken: string, s: Scenario, opts?: CallOptions) {
    return this.checked<{ updatedAt: string }>(
      'PUT',
      `/scenarios/${encodeURIComponent(id)}`,
      { scenario: s },
      editToken,
      opts,
    );
  }

  report(input: ReportInput, opts?: CallOptions) {
    return this.checked<{ received: boolean }>('POST', '/reports', { ...input }, undefined, opts);
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

  /** A write: get a fresh bot-check token first and send it in the body. */
  private async checked<T>(
    method: string,
    path: string,
    body: Record<string, unknown>,
    editToken: string | undefined,
    opts: CallOptions | undefined,
  ): Promise<ApiResult<T>> {
    let turnstileToken: string | null = null;
    try {
      turnstileToken = (await this.humanCheck?.token()) ?? null;
    } catch {
      return { ok: false, failure: 'bot', errors: [BOT_CHECK_FAILED] };
    }
    const withToken = turnstileToken ? { ...body, turnstileToken } : body;
    return this.call<T>(method, path, withToken, editToken, opts);
  }

  private async call<T>(
    method: string,
    path: string,
    body: unknown,
    editToken: string | undefined,
    opts: CallOptions | undefined,
  ): Promise<ApiResult<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const slow = setTimeout(() => opts?.onSlow?.(), this.slowAfterMs);
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (editToken) headers.Authorization = `Bearer ${editToken}`;
      const res = await this.fetchImpl(`${this.base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => null)) as
        (T & { errors?: string[]; code?: string }) | null;
      if (res.ok && data) return { ok: true, value: data };
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
