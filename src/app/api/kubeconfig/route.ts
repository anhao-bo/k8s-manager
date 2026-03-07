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

    // 读取文件内容为 Buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    // 使用 Node.js 原生方式发送 multipart/form-data
    // 创建 boundary
    const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
    
    // 构建 multipart/form-data body
    const bodyParts = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="kubeconfig"; filename="${file.name}"`,
      `Content-Type: application/octet-stream`,
      '',
      fileBuffer.toString('binary'),
      `--${boundary}--`,
    ];
    
    const requestBody = bodyParts.join('\r\n');

    const response = await fetch(`${GO_API_URL}/api/kubeconfig/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: requestBody,
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
