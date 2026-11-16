import { browseSearch } from '../application/browse';
import type {
  ApiResult,
  BrowsePage,
  BrowseQuery,
  CallOptions,
  ScenarioBrowser,
} from '../application/ports';
import { ApiClient, type ApiClientOptions } from './apiClient';

/** Browse through the Go API (`GET /api/browse`). Never throws. */
export class HttpScenarioBrowser implements ScenarioBrowser {
  private readonly api: ApiClient;

  constructor(opts: ApiClientOptions = {}) {
    this.api = new ApiClient(opts);
  }

  async browse(
    q: BrowseQuery,
    cursor: string | null,
    opts?: CallOptions,
  ): Promise<ApiResult<BrowsePage>> {
    const params = new URLSearchParams(browseSearch(q).replace(/^\?/, ''));
    if (cursor) params.set('cursor', cursor);
    const qs = params.toString();
    const r = await this.api.call<{ items?: BrowsePage['items']; next?: string | null }>(
      'GET',
      `/browse${qs ? `?${qs}` : ''}`,
      undefined,
      { opts },
    );
    if (!r.ok) return r;
    return { ok: true, value: { items: r.value.items ?? [], next: r.value.next ?? null } };
  }
}
