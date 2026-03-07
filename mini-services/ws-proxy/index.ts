// WebSocket Proxy Service for Caddy
// This service proxies WebSocket connections from Caddy to the k8s-service backend

const TARGET_PORT = 8080;
const PROXY_PORT = 8081;

console.log(`WebSocket Proxy starting on port ${PROXY_PORT}`);
console.log(`Proxying to backend on port ${TARGET_PORT}`);

// 使用 Bun 的原生 WebSocket 服务器
Bun.serve({
  port: PROXY_PORT,
  fetch(req, server) {
    const url = new URL(req.url);

    // 处理 CORS 预检请求
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // 只处理 WebSocket 升级请求
    if (url.pathname === "/api/ws/exec") {
      // 构建目标 URL
      const targetUrl = `ws://localhost:${TARGET_PORT}${url.pathname}${url.search}`;

      console.log(`[WS Proxy] Upgrading: ${url.search}`);

      // 升级到 WebSocket
      const success = server.upgrade(req, {
        data: { targetUrl, searchParams: url.searchParams },
      });

      if (success) {
        return undefined; // WebSocket 升级成功
      }

      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // 健康检查
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
  websocket: {
    open(ws) {
      const data = ws.data as { targetUrl: string };
      console.log(`[WS Proxy] Connecting to backend: ${data.targetUrl}`);

      // 使用原生 WebSocket 连接后端
      const backendWs = new WebSocket(data.targetUrl);

      backendWs.binaryType = "arraybuffer";

      backendWs.onopen = () => {
        console.log("[WS Proxy] Backend connected");
        (ws as any).backendWs = backendWs;
        (ws as any).ready = true;
      };

      backendWs.onmessage = (event) => {
        if ((ws as any).ready) {
          ws.send(event.data as string);
        }
      };

      backendWs.onclose = (event) => {
        console.log(`[WS Proxy] Backend closed: ${event.code} ${event.reason}`);
        (ws as any).ready = false;
        ws.close(event.code, event.reason);
      };

      backendWs.onerror = (error) => {
        console.error("[WS Proxy] Backend error:", error);
        (ws as any).ready = false;
      };

      (ws as any).backendWs = backendWs;
      (ws as any).ready = false;
    },

    message(ws, message) {
      const backendWs = (ws as any).backendWs;
      if (backendWs && backendWs.readyState === WebSocket.OPEN) {
        backendWs.send(message as string);
      }
    },

    close(ws, code, reason) {
      console.log(`[WS Proxy] Client closed: ${code}`);
      const backendWs = (ws as any).backendWs;
      if (backendWs) {
        backendWs.close(code, reason);
      }
    },

    error(ws, error) {
      console.error("[WS Proxy] Client error:", error);
    },
  },
});

console.log(`WebSocket Proxy running on port ${PROXY_PORT}`);
