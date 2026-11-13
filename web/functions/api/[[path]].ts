/**
 * Cloudflare Pages Function: forwards /api/* to the Go API so the browser only ever talks to
 * its own origin (no CORS; works on preview deployments). Configure the API's address with the
 * Pages environment variable API_ORIGIN, e.g. https://minovsky-maps-api.vercel.app
 *
 * Never let this function throw: an uncaught exception shows Cloudflare's error 1101 page
 * instead of a JSON error the app can explain.
 */
interface Env {
  API_ORIGIN?: string;
}

interface Context {
  request: Request;
  env: Env;
}

const json = (status: number, errors: string[]) =>
  new Response(JSON.stringify({ errors }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

/**
 * Forgiving parse of API_ORIGIN: trims spaces and quotes, assumes https:// when no scheme is
 * given, and keeps only the origin (any path or trailing slash is ignored). Null if unusable.
 */
export const apiOrigin = (raw: string | undefined): string | null => {
  const value = raw
    ?.trim()
    .replace(/^["']|["']$/g, '')
    .trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.origin;
  } catch {
    return null;
  }
};

/** Cookies the API sets (session and pending sign-in); no other cookie is forwarded. */
const API_COOKIES = new Set(['mm_session', 'mm_login']);

/** The Cookie header reduced to the API's own cookies, or null if none are present. */
export const apiCookies = (raw: string | null): string | null => {
  if (!raw) return null;
  const kept = raw
    .split(';')
    .map((p) => p.trim())
    .filter((p) => API_COOKIES.has(p.slice(0, p.indexOf('=')).trim()));
  return kept.length ? kept.join('; ') : null;
};

/*
 * Responses pass through unchanged, including several Set-Cookie headers and redirects
 * (fetch uses redirect: 'manual', so a sign-in 302 reaches the browser, not this function).
 */
export const onRequest = async ({ request, env }: Context): Promise<Response> => {
  try {
    if (!env.API_ORIGIN?.trim()) {
      return json(503, [
        'Publishing is not configured on this deployment (API_ORIGIN is not set).',
      ]);
    }
    const origin = apiOrigin(env.API_ORIGIN);
    if (!origin) {
      return json(503, [
        'Publishing is misconfigured on this deployment (API_ORIGIN is not a valid URL).',
      ]);
    }

    const incoming = new URL(request.url);
    const target = `${origin}${incoming.pathname}${incoming.search}`;

    const headers = new Headers(request.headers);
    headers.delete('host');
    // only the API's own cookies (session, pending sign-in) go through; anything else stays here
    const cookie = apiCookies(request.headers.get('cookie'));
    if (cookie) headers.set('cookie', cookie);
    else headers.delete('cookie');
    headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') ?? '');
    headers.set('X-Forwarded-Host', incoming.host);

    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    let res: Response;
    try {
      res = await fetch(target, {
        method: request.method,
        headers,
        body: hasBody ? await request.arrayBuffer() : undefined,
        redirect: 'manual',
      });
    } catch {
      return json(502, ['The publishing server could not be reached.']);
    }
    return new Response(res.body, { status: res.status, headers: res.headers });
  } catch {
    return json(500, ['The /api proxy failed unexpectedly.']);
  }
};
