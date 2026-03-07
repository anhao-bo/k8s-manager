import { NextRequest, NextResponse } from 'next/server';
import { getGoApiUrl } from '@/lib/api-config';

const GO_API_URL = getGoApiUrl();

// GET - 获取资源 YAML
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    const searchParams = request.nextUrl.searchParams;
    const namespace = searchParams.get('namespace');
    const name = searchParams.get('name');

    if (!namespace || !name) {
      return NextResponse.json(
        { success: false, error: 'namespace and name are required' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${GO_API_URL}/api/resources/${type}/yaml?namespace=${namespace}&name=${name}`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      }
    );

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: 'Invalid JSON response', raw: text };
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to get resource yaml', details: String(error) },
      { status: 500 }
    );
  }
}

// PUT - 更新资源 YAML
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    const body = await request.json();

    if (!body.namespace || !body.name || !body.yaml) {
      return NextResponse.json(
        { success: false, error: 'namespace, name and yaml are required' },
        { status: 400 }
      );
    }

    const response = await fetch(`${GO_API_URL}/api/resources/${type}/yaml`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: 'Invalid JSON response', raw: text };
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update resource yaml', details: String(error) },
      { status: 500 }
    );
  }
}
