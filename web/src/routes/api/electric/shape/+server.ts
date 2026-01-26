import { PUBLIC_ELECTRIC_URL } from '$env/static/public';
import { ELECTRIC_API_SECRET, ELECTRIC_SECRET } from '$env/static/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  // 1. Build the upstream URL
  const electricUrl = new URL(`${PUBLIC_ELECTRIC_URL}/v1/shape`);
  url.searchParams.forEach((value, key) => {
    electricUrl.searchParams.set(key, value);
  });

  try {
    const headers: Record<string, string> = {};

    // 2. Resolve the Secret
    // Priority: ELECTRIC_API_SECRET -> ELECTRIC_SECRET
    const secret = ELECTRIC_API_SECRET ?? ELECTRIC_SECRET;

    // Debug Log: Check if secret is loaded (don't log the actual secret)
    console.log('[Electric Proxy] Secret loaded?', !!secret);
    console.log('[Electric Proxy] Request URL:', electricUrl.pathname);
    console.log('[Electric Proxy] Query params:', Object.fromEntries(url.searchParams));

    if (secret) {
      // 3. Add ELECTRIC_SECRET as query parameter (ElectricSQL v1.0+ auth method)
      // The secret is added server-side in the proxy to keep it secure
      electricUrl.searchParams.set('secret', secret);
    } else {
      console.warn('[Electric Proxy] WARNING: No ELECTRIC_SECRET found. Request will likely fail 401.');
    }

    // 4. Forward the request
    console.log('[Electric Proxy] Fetching from:', electricUrl.href.replace(/secret=[^&]+/, 'secret=***'));
    const electricResponse = await fetch(electricUrl.href, {
      method: 'GET',
      headers,
    });
    console.log('[Electric Proxy] Response status:', electricResponse.status);

    // 5. Process Response Headers
    const electricHeaders = new Headers();
    electricResponse.headers.forEach((value, key) => {
      electricHeaders.set(key, value);
    });

    // CRITICAL FIX: Remove gzip encoding headers or the browser crashes
    electricHeaders.delete('content-encoding');
    electricHeaders.delete('content-length');

    const exposeHeaders = [
      'electric-handle', 'electric-schema', 'electric-offset',
      'electric-shape-id', 'electric-chunk-last-offset',
      'content-type', 'cache-control', 'electric-cursor', 'electric-up-to-date'
    ];

    electricHeaders.set('Access-Control-Allow-Origin', '*');
    electricHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    electricHeaders.set('Access-Control-Expose-Headers', exposeHeaders.join(', '));

    return new Response(electricResponse.body, {
      status: electricResponse.status,
      statusText: electricResponse.statusText,
      headers: electricHeaders,
    });

  } catch (error) {
    // 6. Log the REAL crash error to your terminal
    console.error('[Electric Proxy] CRITICAL ERROR:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Proxy Internal Error',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500 }
    );
  }
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};