import { NextRequest, NextResponse } from "next/server";

// API 代理处理器 - 将请求转发到 Go 后端服务
export async function GET(request: NextRequest) {
  return handleProxy(request);
}

export async function POST(request: NextRequest) {
  return handleProxy(request);
}

export async function PUT(request: NextRequest) {
  return handleProxy(request);
}

export async function DELETE(request: NextRequest) {
  return handleProxy(request);
}

async function handleProxy(request: NextRequest) {
  try {
    // 获取查询参数
    const { searchParams, pathname } = new URL(request.url);

    // 检查是否有 XTransformPort 参数（用于开发环境代理）
    const targetPort = searchParams.get('XTransformPort');

    if (targetPort) {
      // 移除 XTransformPort 参数
      searchParams.delete('XTransformPort');

      // 构建目标 URL
      const queryString = searchParams.toString();
      const pathWithoutApi = pathname.replace(/^\/api/, ''); // 移除 /api 前缀
      const targetUrl = `http://localhost:${targetPort}/api${pathWithoutApi}${queryString ? `?${queryString}` : ''}`;

      console.log(`[API Proxy] Forwarding ${request.method} request to: ${targetUrl}`);

      // 转发请求
      const proxyResponse = await fetch(targetUrl, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          // 转发其他必要的头
          'Authorization': request.headers.get('Authorization') || '',
        },
        body: request.method !== 'GET' ? await request.text() : undefined,
      });

      // 返回响应
      const data = await proxyResponse.json();
      return NextResponse.json(data, { status: proxyResponse.status });
    }

    // 如果没有 XTransformPort 参数，返回默认响应
    return NextResponse.json({
      success: false,
      message: "API endpoint without proxy target",
      hint: "Use XTransformPort query parameter to specify backend port"
    }, { status: 400 });

  } catch (error) {
    console.error('[API Proxy] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: "Failed to proxy request to backend service"
    }, { status: 500 });
  }
}