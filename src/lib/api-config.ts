/**
 * 后端 API 配置
 * 
 * 支持通过环境变量配置后端服务端口
 */

// 从环境变量获取后端服务端口，默认 8080
const K8S_SERVICE_PORT = process.env.NEXT_PUBLIC_K8S_SERVICE_PORT || '8080';

/**
 * 获取后端 API 基础 URL (用于服务端)
 */
export function getGoApiUrl(): string {
  return `http://localhost:${K8S_SERVICE_PORT}`;
}

/**
 * 获取后端服务端口
 */
export function getK8sServicePort(): string {
  return K8S_SERVICE_PORT;
}

/**
 * 获取 WebSocket 基础 URL (用于服务端)
 */
export function getWsBaseUrl(): string {
  return `ws://localhost:${K8S_SERVICE_PORT}`;
}

/**
 * 获取 Pod 终端 WebSocket URL
 */
export function getWsExecUrl(namespace: string, pod: string, shell: string = '/bin/sh'): string {
  return `ws://localhost:${K8S_SERVICE_PORT}/api/ws/exec?namespace=${namespace}&pod=${pod}&shell=${shell}`;
}
