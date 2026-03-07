import { NextRequest, NextResponse } from 'next/server';
import { getGoApiUrl } from '@/lib/api-config';

const GO_API_URL = getGoApiUrl();

// GET - 获取 kubeconfig 状态
export async function GET() {
  try {
    const response = await fetch(`${GO_API_URL}/api/kubeconfig/status`, {
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

// POST - 上传 kubeconfig 文件
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('kubeconfig');
    
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'No kubeconfig file provided' },
        { status: 400 }
      );
    }

    // 读取文件内容
    const content = await file.text();
    
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'kubeconfig 文件内容为空' },
        { status: 400 }
      );
    }

    // 直接发送文件内容到后端
    const response = await fetch(`${GO_API_URL}/api/kubeconfig/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: file.name,
        content: content,
      }),
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
    console.error('[Kubeconfig Upload] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload kubeconfig', details: String(error) },
      { status: 500 }
    );
  }
}
