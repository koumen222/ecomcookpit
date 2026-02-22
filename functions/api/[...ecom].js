export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // Gérer les requêtes OPTIONS (preflight)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': url.origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Session-Id',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  // Backend Railway URL
  const BACKEND_URL = env.BACKEND_URL || 'https://ecomcookpit-production.up.railway.app';
  
  // Construire l'URL backend - préserver tout le path après /api
  const backendUrl = `${BACKEND_URL}${url.pathname}${url.search}`;
  
  // Copier les headers
  const headers = new Headers(request.headers);
  headers.set('X-Forwarded-Host', url.hostname);
  headers.set('X-Forwarded-Proto', url.protocol.slice(0, -1));
  
  // Lire le body pour POST/PUT/PATCH/DELETE
  let body = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.arrayBuffer();
  }
  
  try {
    const response = await fetch(backendUrl, {
      method: request.method,
      headers: headers,
      body: body,
    });
    
    const newResponse = new Response(response.body, response);
    
    // Headers CORS
    newResponse.headers.set('Access-Control-Allow-Origin', url.origin);
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Session-Id');
    newResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    
    return newResponse;
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Backend unreachable', 
      message: error.message 
    }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': url.origin,
        'Access-Control-Allow-Credentials': 'true',
      }
    });
  }
}
