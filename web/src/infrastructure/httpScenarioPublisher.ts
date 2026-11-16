import type {
  ApiResult,
  CallOptions,
  HumanCheck,
  PublishedRead,
  ReportInput,
  ScenarioPublisher,
  Visibility,
} from '../application/ports';
import { isVisibility } from '../application/visibility';
import type { Scenario } from '../domain/scenario';
import { ApiClient, type ApiClientOptions } from './apiClient';

export interface HttpPublisherOptions extends ApiClientOptions {
  /** Bot check for publish, update and report; omitted = no token sent. */
  humanCheck?: HumanCheck;
}

const BOT_CHECK_FAILED =
  'The bot check could not run. If you use an ad or script blocker, allow challenges.cloudflare.com, then try again.';

/** Talks to the Go API at `/api` (same origin; Cloudflare forwards it). Never throws. */
export class HttpScenarioPublisher implements ScenarioPublisher {
  private readonly api: ApiClient;
  private readonly humanCheck: HumanCheck | undefined;

  constructor(opts: HttpPublisherOptions = {}) {
    this.api = new ApiClient(opts);
    this.humanCheck = opts.humanCheck;
  }

  publish(s: Scenario, visibility: Visibility, opts?: CallOptions) {
    return this.checked<{ id: string; updatedAt: string }>(
      'POST',
      '/scenarios',
      { scenario: s, visibility },
      null,
      opts,
    );
  }

  setVisibility(id: string, visibility: Visibility) {
    return this.api.call<object>('PATCH', `/scenarios/${encodeURIComponent(id)}`, { visibility });
  }

  update(id: string, editToken: string | null, s: Scenario, opts?: CallOptions) {
    return this.checked<{ updatedAt: string }>(
      'PUT',
      `/scenarios/${encodeURIComponent(id)}`,
      { scenario: s },
      editToken,
      opts,
    );
  }

  remove(id: string, opts?: CallOptions) {
    return this.api.call<object>('DELETE', `/scenarios/${encodeURIComponent(id)}`, undefined, {
      opts,
    });
  }

  report(input: ReportInput, opts?: CallOptions) {
    return this.checked<{ received: boolean }>('POST', '/reports', { ...input }, null, opts);
  }

  async fetch(id: string, opts?: CallOptions): Promise<ApiResult<PublishedRead>> {
    const r = await this.api.call<{
      scenario: unknown;
      updatedAt: string;
      owner?: { displayName: string } | null;
      isOwner?: boolean;
      visibility?: string;
    }>('GET', `/scenarios/${encodeURIComponent(id)}`, undefined, { opts });
    if (!r.ok) return r;
    const v = r.value;
    return {
      ok: true,
      value: {
        scenario: v.scenario,
        updatedAt: v.updatedAt,
        owner: v.owner?.displayName ? { displayName: v.owner.displayName } : null,
        isOwner: v.isOwner === true,
        visibility: isVisibility(v.visibility) ? v.visibility : null,
      },
    };
  }

  wake(): void {
    void this.api.fetchImpl(`${this.api.base}/health`, { method: 'GET' }).catch(() => undefined);
  }

  /** A write: get a fresh bot-check token first and send it in the body. */
  private async checked<T>(
    method: string,
    path: string,
    body: Record<string, unknown>,
    editToken: string | null,
    opts: CallOptions | undefined,
  ): Promise<ApiResult<T>> {
    let turnstileToken: string | null = null;
    try {
      turnstileToken = (await this.humanCheck?.token()) ?? null;
    } catch {
      return { ok: false, failure: 'bot', errors: [BOT_CHECK_FAILED] };
    }
    const withToken = turnstileToken ? { ...body, turnstileToken } : body;
    return this.api.call<T>(method, path, withToken, { editToken, opts });
  }
}
