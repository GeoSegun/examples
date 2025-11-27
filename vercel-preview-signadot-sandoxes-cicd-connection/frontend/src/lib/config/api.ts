/**
 * Backend API base URL
 * Set by GitHub Actions workflow from Signadot sandbox URL in preview environments
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Checks if the API URL is a Signadot preview URL
 */
export function isSignadotUrl(url: string = API_URL): boolean {
  return url.includes('.preview.signadot.com') || url.includes('.sb.signadot.com');
}

/**
 * Creates a full API endpoint URL
 * Routes through Next.js API proxy for Signadot URLs to keep API key server-side
 * Direct requests for non-Signadot URLs (production/local)
 */
export function getApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  
  if (isSignadotUrl()) {
    // Proxy route adds Signadot API key header server-side
    return `/api/proxy/${cleanEndpoint}`;
  }
  
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  return `${baseUrl}/${cleanEndpoint}`;
}

/**
 * Gets the headers to include in API requests
 * Signadot API key is handled server-side by proxy
 */
export function getApiHeaders(additionalHeaders: Record<string, string> = {}): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...additionalHeaders,
  };
}
