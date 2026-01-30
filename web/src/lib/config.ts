// web/src/lib/config.ts
/**
 * Configuration passed from server via page load
 */
export let serverConfig: {
  publicElectricUrl?: string;
  publicElectricSecret?: string;
} = {};

export function setServerConfig(config: typeof serverConfig) {
  serverConfig = config;
}

export function getElectricUrl(): string {
  console.log('getElectricUrl - serverConfig:', serverConfig);

  // Try server config first (passed from +layout.server.ts)
  let url = serverConfig.publicElectricUrl;
  if (url) {
    console.log('Using server config URL:', url);
    return url;
  }

  // Try import.meta.env
  url = import.meta.env.VITE_PUBLIC_ELECTRIC_URL;
  if (url) {
    console.log('Using import.meta.env URL:', url);
    return url;
  }

  // Fallback to window variable
  if (typeof window !== 'undefined') {
    url = (window as any).__ELECTRIC_URL__;
    if (url) {
      console.log('Using window.__ELECTRIC_URL__:', url);
      return url;
    }
  }

  console.error('No Electric URL found in any source');
  throw new Error(
    'VITE_PUBLIC_ELECTRIC_URL not configured. ' +
    'Set VITE_PUBLIC_ELECTRIC_URL in .env.local and restart dev server.'
  );
}

export function getElectricSecret(): string {
  // Do NOT read or return a secret on the client. The proxy on the server
  // will use a server-only env var. Expose only a presence indicator in
  // `serverConfig.publicElectricSecret` if needed.
  return '';
}

// Lazy-load to catch errors at runtime
let electricUrl: string | null = null;
let electricSecret: string | null = null;

export function initConfig(): void {
  try {
    electricUrl = getElectricUrl();
    electricSecret = getElectricSecret();
    console.log('Electric configuration loaded');
  } catch (err) {
    console.error('Failed to load Electric configuration:', err);
    throw err;
  }
}

export function getCachedElectricUrl(): string {
  if (!electricUrl) {
    electricUrl = getElectricUrl();
  }
  return electricUrl;
}

export function getCachedElectricSecret(): string {
  if (electricSecret === null) {
    electricSecret = getElectricSecret();
  }
  return electricSecret;
}
