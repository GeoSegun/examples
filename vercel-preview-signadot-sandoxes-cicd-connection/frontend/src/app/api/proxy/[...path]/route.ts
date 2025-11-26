// * API Proxy Route
// * Proxies requests to the backend API with Signadot authentication
// * * Keeps the Signadot API key server-side (never exposed to client)
// * * Handles CORS and authentication automatically

import { NextRequest, NextResponse } from 'next/server';

/**
 * Backend API base URL
 * * In preview environments: Set by GitHub Actions workflow from Signadot sandbox URL
 * * In production: Should be set to production backend URL
 * * In local development: Falls back to localhost
 */
const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Signadot API key for authenticating requests to Signadot preview URLs
 * * Server-side only (NOT exposed to client)
 * * Should be set as SIGNADOT_API_KEY in Vercel environment variables (without NEXT_PUBLIC_ prefix)
 */
const SIGNADOT_API_KEY = process.env.SIGNADOT_API_KEY || '';

/**
 * Checks if the API URL is a Signadot preview URL
 * @param url - URL to check (defaults to BACKEND_API_URL)
 * @returns true if the URL is a Signadot preview URL
 */
function isSignadotUrl(url: string = BACKEND_API_URL): boolean {
  return url.includes('.preview.signadot.com') || url.includes('.sb.signadot.com');
}

/**
 * GET handler - Proxies GET requests to the backend
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams, 'GET');
}

/**
 * POST handler - Proxies POST requests to the backend
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams, 'POST');
}

/**
 * PUT handler - Proxies PUT requests to the backend
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams, 'PUT');
}

/**
 * DELETE handler - Proxies DELETE requests to the backend
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams, 'DELETE');
}

/**
 * PATCH handler - Proxies PATCH requests to the backend
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams, 'PATCH');
}

/**
 * Handles proxy requests to the backend API
 * * Forwards the request with appropriate headers including Signadot API key
 * * Returns the backend response to the client
 */
async function handleProxyRequest(
  request: NextRequest,
  params: { path: string[] },
  method: string
) {
  try {
    // * Construct the backend URL path from the catch-all route
    const pathSegments = params.path || [];
    const backendPath = pathSegments.length > 0 
      ? `/${pathSegments.join('/')}` 
      : '/';
    
    // * Construct the full backend URL
    const backendUrl = `${BACKEND_API_URL}${backendPath}`;
    
    // * Get query parameters from the request
    const searchParams = request.nextUrl.searchParams.toString();
    const fullBackendUrl = searchParams 
      ? `${backendUrl}?${searchParams}` 
      : backendUrl;
    
    // * Prepare headers for the backend request
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // * Add Signadot API key header if using Signadot preview URL
    if (isSignadotUrl() && SIGNADOT_API_KEY) {
      headers['signadot-api-key'] = SIGNADOT_API_KEY;
    }
    
    // * Forward request body for POST, PUT, PATCH requests
    let body: string | undefined;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        body = await request.text();
      } catch (error) {
        // * If body parsing fails, continue without body
        console.error('Failed to parse request body:', error);
      }
    }
    
    // * Make the request to the backend
    const backendResponse = await fetch(fullBackendUrl, {
      method,
      headers,
      body,
    });
    
    // * Get the response data
    const responseData = await backendResponse.text();
    
    // * Try to parse as JSON, fallback to text
    let jsonData;
    try {
      jsonData = JSON.parse(responseData);
    } catch {
      jsonData = responseData;
    }
    
    // * Return the response with appropriate status and headers
    return NextResponse.json(jsonData, {
      status: backendResponse.status,
      headers: {
        'Content-Type': 'application/json',
        // * Forward CORS headers if present
        ...(backendResponse.headers.get('Access-Control-Allow-Origin') && {
          'Access-Control-Allow-Origin': backendResponse.headers.get('Access-Control-Allow-Origin')!,
        }),
      },
    });
  } catch (error) {
    console.error('Proxy request failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to proxy request to backend',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

