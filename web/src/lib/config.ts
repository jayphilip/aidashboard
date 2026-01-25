// web/src/lib/config.ts
/**
 * Runtime configuration loader
 * Reads from import.meta.env with fallback to window variables
 */

export function getElectricUrl(): string {
  // Try import.meta.env first
  let url = import.meta.env.PUBLIC_ELECTRIC_URL;

  if (!url && typeof window !== 'undefined') {
    // Fallback to window.__ELECTRIC_URL__ if set by HTML
    url = (window as any).__ELECTRIC_URL__;
  }

  if (!url) {
    throw new Error(
      'PUBLIC_ELECTRIC_URL not configured. ' +
      'Set PUBLIC_ELECTRIC_URL in .env.local and restart dev server, or via window.__ELECTRIC_URL__'
    );
  }

  return url;
}

export function getElectricSecret(): string {
  let secret = import.meta.env.PUBLIC_ELECTRIC_API_SECRET;

  if (!secret && typeof window !== 'undefined') {
    secret = (window as any).__ELECTRIC_SECRET__;
  }

  return secret || '';
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
