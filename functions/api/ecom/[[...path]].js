export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // Gérer les requêtes OPTIONS (preflight) avant tout appel backend
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
  const BACKEND_URL = 'https://ecomcookpit-production.up.railway.app';
  
  // Construire l'URL backend en préservant le path après /api/ecom
  const path = url.pathname.replace('/api/ecom', '/api/ecom');
  const backendUrl = `${BACKEND_URL}${path}${url.search}`;
  
  // Copier les headers de la requête originale
  const headers = new Headers(request.headers);
  headers.set('X-Forwarded-Host', url.hostname);
  headers.set('X-Forwarded-Proto', url.protocol.slice(0, -1));
  
  // Lire le body pour les requêtes POST/PUT/PATCH/DELETE
  let body = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.arrayBuffer();
  }
  
  // Créer la requête vers le backend
  const backendRequest = new Request(backendUrl, {
    method: request.method,
    headers: headers,
    body: body,
  });
  
  try {
    // Faire la requête vers le backend
    const response = await fetch(backendRequest);
    
    // Créer une nouvelle réponse avec les headers CORS appropriés
    const newResponse = new Response(response.body, response);
    
    // Ajouter les headers CORS
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
