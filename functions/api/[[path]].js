const BACKEND = 'https://plateforme-backend-production-2ec6.up.railway.app';

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Credentials': 'true',
};

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...CORS_HEADERS, 'Access-Control-Allow-Origin': origin },
    });
  }

  const backendUrl = `${BACKEND}${url.pathname}${url.search}`;

  // Rebuild headers explicitly — Cloudflare may strip Authorization from request.headers
  const headers = new Headers();
  const contentType = request.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);
  // Only forward Origin if it's a real browser origin (not empty)
  if (origin) headers.set('Origin', origin);

  const authorization = request.headers.get('Authorization');
  if (authorization) {
    headers.set('Authorization', authorization);
  }

  const hasBody = !['GET', 'HEAD'].includes(request.method);

  try {
    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: 'follow',
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', origin || '*');
    Object.entries(CORS_HEADERS).forEach(([k, v]) => responseHeaders.set(k, v));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Proxy error', detail: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin || '*' },
    });
  }
}
