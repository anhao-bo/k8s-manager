import { NextRequest, NextResponse } from 'next/server';

const GO_API_URL = 'http://localhost:8080';

async function proxyRequest(
  method: string,
  path: string,
  searchParams: URLSearchParams,
  body?: unknown
): Promise<Response> {
  searchParams.delete('XTransformPort');
  
  const url = `${GO_API_URL}/api/${path}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
  
  console.log(`[API Proxy] ${method} ${url}`);
  
  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };
    
    if (body && (method === 'POST' || method === 'DELETE' || method === 'PUT')) {
      fetchOptions.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, fetchOptions);
    
    // Get response text first
    const text = await response.text();
    console.log(`[API Proxy] Response status: ${response.status}, body: ${text.substring(0, 200)}`);
    
    // Try to parse as JSON
    let data;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: 'Invalid JSON response from backend', raw: text };
      }
    } else {
      data = { error: 'Empty response from backend' };
    }
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[API Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend service', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const pathSegments = await params;
  const path = pathSegments.path ? pathSegments.path.join('/') : '';
  const searchParams = request.nextUrl.searchParams;
  return proxyRequest('GET', path, searchParams);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const pathSegments = await params;
  const path = pathSegments.path ? pathSegments.path.join('/') : '';
  const searchParams = request.nextUrl.searchParams;
  
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  
  return proxyRequest('POST', path, searchParams, body);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const pathSegments = await params;
  const path = pathSegments.path ? pathSegments.path.join('/') : '';
  const searchParams = request.nextUrl.searchParams;
  
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  
  return proxyRequest('DELETE', path, searchParams, body);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const pathSegments = await params;
  const path = pathSegments.path ? pathSegments.path.join('/') : '';
  const searchParams = request.nextUrl.searchParams;
  
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  
  return proxyRequest('PUT', path, searchParams, body);
}
