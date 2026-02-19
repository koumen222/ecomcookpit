export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // Forward to your backend
  const backendUrl = `https://plateforme-backend-production-2ec6.up.railway.app${url.pathname}${url.search}`;
  
  // Copy headers and add CORS
  const headers = new Headers(request.headers);
  headers.set('Origin', request.headers.get('Origin') || 'https://ecomcookpit.pages.dev');
  
  try {
    const response = await fetch(backendUrl, {
      method: request.method,
      headers: headers,
      body: request.body
    });
    
    // Add CORS headers to response
    const corsHeaders = new Headers(response.headers);
    corsHeaders.set('Access-Control-Allow-Origin', 'https://f905d6ba.ecomcookpit.pages.dev');
    corsHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    corsHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    corsHeaders.set('Access-Control-Allow-Credentials', 'true');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: corsHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Proxy error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
