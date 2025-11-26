// * API Configuration
// * Routes requests through Next.js API proxy when using Signadot preview URLs
// * * Keeps Signadot API key server-side (never exposed to client)
// * * Direct requests for non-Signadot URLs (production/local)

/**
 * Backend API base URL
 * - In preview environments: Set by GitHub Actions workflow from Signadot sandbox URL
 * - In production: Should be set to production backend URL
 * - In local development: Falls back to localhost or production URL
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Checks if the API URL is a Signadot preview URL
 * @param url - URL to check (defaults to API_URL)
 * @returns true if the URL is a Signadot preview URL
 */
export function isSignadotUrl(url: string = API_URL): boolean {
  return url.includes('.preview.signadot.com') || url.includes('.sb.signadot.com');
}

/**
 * Creates a full API endpoint URL
 * * Routes through Next.js API proxy for Signadot URLs (keeps API key server-side)
 * * Direct requests for non-Signadot URLs (production/local)
 * @param endpoint - API endpoint path (e.g., '/health' or 'health')
 * @returns Full URL to the API endpoint (via proxy for Signadot, direct otherwise)
 */
export function getApiUrl(endpoint: string): string {
  // * Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  
  // * If using Signadot preview URL, route through Next.js API proxy
  // * This keeps the API key server-side and never exposes it to the client
  if (isSignadotUrl()) {
    // * Use Next.js API proxy route: /api/proxy/[...path]
    // * The proxy will add the Signadot API key header server-side
    return `/api/proxy/${cleanEndpoint}`;
  }
  
  // * For non-Signadot URLs (production/local), make direct requests
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  return `${baseUrl}/${cleanEndpoint}`;
}

/**
 * Gets the headers to include in API requests
 * * No longer includes Signadot API key (handled server-side by proxy)
 * @param additionalHeaders - Optional additional headers to include
 * @returns Headers object for fetch requests
 */
export function getApiHeaders(additionalHeaders: Record<string, string> = {}): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...additionalHeaders,
  };
}

/**
 * Example usage in API calls:
 * 
 * ```typescript
 * import { getApiUrl, getApiHeaders } from '@/lib/config/api';
 * 
 * const response = await fetch(getApiUrl('/api/users'), {
 *   headers: getApiHeaders()
 * });
 * const data = await response.json();
 * ```
 */

