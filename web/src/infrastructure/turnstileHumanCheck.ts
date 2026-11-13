import type { HumanCheck } from '../application/ports';

/** The subset of Cloudflare's Turnstile browser API we use. */
interface TurnstileApi {
  render(
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback(token: string): void;
      'error-callback'?(): void;
      'expired-callback'?(): void;
      'timeout-callback'?(): void;
      appearance?: 'always' | 'execute' | 'interaction-only';
      theme?: 'auto' | 'light' | 'dark';
    },
  ): string;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/**
 * Cloudflare Turnstile in the browser. The script loads on first use; each call renders a fresh
 * widget (tokens are single-use) that stays invisible unless Cloudflare needs the person to
 * interact, in which case it appears in the bottom-right corner above everything else.
 */
export class TurnstileHumanCheck implements HumanCheck {
  private loading: Promise<TurnstileApi> | null = null;

  constructor(
    private readonly siteKey: string | undefined,
    private readonly timeoutMs = 60_000,
  ) {}

  async token(): Promise<string | null> {
    if (!this.siteKey) return null;
    const api = await this.load();
    return new Promise<string>((resolve, reject) => {
      const host = document.createElement('div');
      host.setAttribute('role', 'region');
      host.setAttribute('aria-label', 'Bot check');
      host.style.cssText = 'position:fixed;right:16px;bottom:48px;z-index:50';
      document.body.appendChild(host);
      let id: string | null = null;
      const done = (fn: () => void) => {
        clearTimeout(timer);
        if (id) api.remove(id);
        host.remove();
        fn();
      };
      const fail = () => done(() => reject(new Error('The bot check did not complete.')));
      const timer = setTimeout(fail, this.timeoutMs);
      id = api.render(host, {
        sitekey: this.siteKey!,
        appearance: 'interaction-only',
        theme: 'auto',
        callback: (token) => done(() => resolve(token)),
        'error-callback': fail,
        'expired-callback': fail,
        'timeout-callback': fail,
      });
    });
  }

  private load(): Promise<TurnstileApi> {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    this.loading ??= new Promise<TurnstileApi>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () =>
        window.turnstile
          ? resolve(window.turnstile)
          : reject(new Error('The bot check failed to start.'));
      script.onerror = () => {
        this.loading = null; // allow a retry later
        reject(new Error('The bot check could not load.'));
      };
      document.head.appendChild(script);
    });
    return this.loading;
  }
}
