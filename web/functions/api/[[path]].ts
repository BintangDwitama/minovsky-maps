/**
 * Cloudflare Pages Function: forwards /api/* to the Go API so the browser only ever talks to
 * its own origin (no CORS; works on preview deployments). Configure the API's address with the
 * Pages environment variable API_ORIGIN, e.g. https://minovsky-maps-api.onrender.com
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

export const onRequest = async ({ request, env }: Context): Promise<Response> => {
  if (!env.API_ORIGIN) return json(503, ['Publishing is not configured on this deployment.']);

  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, env.API_ORIGIN);

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('cookie'); // the API uses no cookies; don't forward any
  headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') ?? '');
  headers.set('X-Forwarded-Host', incoming.host);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  try {
    const res = await fetch(target.toString(), {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
    });
    return new Response(res.body, { status: res.status, headers: res.headers });
  } catch {
    return json(502, ['The publishing server could not be reached.']);
  }
};
