import { NextRequest, NextResponse } from 'next/server';
import { getGoApiUrl } from '@/lib/api-config';

const GO_API_URL = getGoApiUrl();

// GET - 获取 Pod YAML
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const namespace = searchParams.get('namespace');
  const name = searchParams.get('name');

  if (!namespace || !name) {
    return NextResponse.json(
      { success: false, error: 'namespace and name are required' },
      { status: 400 }
    );
  }

  const url = `${GO_API_URL}/api/pods/yaml?namespace=${namespace}&name=${name}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
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
      { success: false, error: 'Failed to connect to backend', details: String(error) },
      { status: 500 }
    );
  }
}

// PUT - 更新 Pod YAML
export async function PUT(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { namespace, name, yaml } = body;

  if (!namespace || !name || !yaml) {
    return NextResponse.json(
      { success: false, error: 'namespace, name, and yaml are required' },
      { status: 400 }
    );
  }

  try {
    const updateUrl = `${GO_API_URL}/api/pods/yaml`;
    const updateResponse = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const updateText = await updateResponse.text();
    let updateData;
    try {
      updateData = JSON.parse(updateText);
    } catch {
      updateData = { error: 'Invalid JSON response', raw: updateText };
    }

    return NextResponse.json(updateData, { status: updateResponse.status });
  } catch (error) {
    console.error('[Pod YAML Update] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update pod', details: String(error) },
      { status: 500 }
    );
  }
}
