import { NextRequest, NextResponse } from 'next/server';

/**
 * Backend API base URL
 * Set by GitHub Actions workflow from Signadot sandbox URL in preview environments
 */
const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Signadot API key for authenticating requests to Signadot preview URLs
 * Server-side only - set as SIGNADOT_API_KEY in Vercel (without NEXT_PUBLIC_ prefix)
 */
const SIGNADOT_API_KEY = process.env.SIGNADOT_API_KEY || '';

function isSignadotUrl(url: string = BACKEND_API_URL): boolean {
  return url.includes('.preview.signadot.com') || url.includes('.sb.signadot.com');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams, 'DELETE');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams, 'PATCH');
}

async function handleProxyRequest(
  request: NextRequest,
  params: { path: string[] },
  method: string
) {
  try {
    const pathSegments = params.path || [];
    const backendPath = pathSegments.length > 0 
      ? `/${pathSegments.join('/')}` 
      : '/';
    
    const backendUrl = `${BACKEND_API_URL}${backendPath}`;
    const searchParams = request.nextUrl.searchParams.toString();
    const fullBackendUrl = searchParams 
      ? `${backendUrl}?${searchParams}` 
      : backendUrl;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (isSignadotUrl() && SIGNADOT_API_KEY) {
      headers['signadot-api-key'] = SIGNADOT_API_KEY;
    }
    
    let body: string | undefined;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        body = await request.text();
      } catch (error) {
        console.error('Failed to parse request body:', error);
      }
    }
    
    const backendResponse = await fetch(fullBackendUrl, {
      method,
      headers,
      body,
    });
    
    const responseData = await backendResponse.text();
    
    let jsonData;
    try {
      jsonData = JSON.parse(responseData);
    } catch {
      jsonData = responseData;
    }
    
    return NextResponse.json(jsonData, {
      status: backendResponse.status,
      headers: {
        'Content-Type': 'application/json',
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
