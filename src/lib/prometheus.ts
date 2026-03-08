// Prometheus API 客户端
// 用于从 Prometheus 查询监控指标

const PROMETHEUS_URL = '/api?XTransformPort=9090';

export interface PrometheusResponse<T = unknown> {
  status: 'success' | 'error';
  data: {
    resultType: 'vector' | 'matrix' | 'scalar' | 'string';
    result: T[];
  };
  error?: string;
}

export interface InstantVector {
  metric: Record<string, string>;
  value: [number, string];
}

export interface RangeVector {
  metric: Record<string, string>;
  values: [number, string][];
}

/**
 * 执行即时查询
 */
export async function queryInstant(query: string): Promise<PrometheusResponse<InstantVector>> {
  const url = `${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  return response.json();
}

/**
 * 执行范围查询
 */
export async function queryRange(
  query: string,
  start: number,
  end: number,
  step: string = '15s'
): Promise<PrometheusResponse<RangeVector>> {
  const url = `${PROMETHEUS_URL}/api/v1/query_range?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${step}`;
  const response = await fetch(url);
  return response.json();
}

/**
 * 获取所有指标名称
 */
export async function getMetricNames(): Promise<string[]> {
  const url = `${PROMETHEUS_URL}/api/v1/label/__name__/values`;
  const response = await fetch(url);
  const data = await response.json();
  return data.data || [];
}

/**
 * 预定义的查询模板
 */
export const PrometheusQueries = {
  // 集群概览
  clusterNodeCount: 'count(kube_node_info)',
  clusterPodCount: 'count(kube_pod_info)',
  clusterNamespaceCount: 'count(kube_namespace_created)',
  
  // 节点指标
  nodeCPU: '100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
  nodeMemory: '(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100',
  nodeDisk: '(1 - node_filesystem_avail_bytes{fstype!~"tmpfs|overlay",mountpoint="/"} / node_filesystem_size_bytes{fstype!~"tmpfs|overlay",mountpoint="/"}) * 100',
  nodeNetworkIn: 'sum(irate(node_network_receive_bytes_total[5m])) by (instance)',
  nodeNetworkOut: 'sum(irate(node_network_transmit_bytes_total[5m])) by (instance)',
  
  // Pod 指标
  podCPU: 'sum(rate(container_cpu_usage_seconds_total{container!=""}[5m])) by (pod, namespace)',
  podMemory: 'sum(container_memory_working_set_bytes{container!=""}) by (pod, namespace)',
  podRestarts: 'increase(kube_pod_container_status_restarts_total[1h])',
  podStatus: 'kube_pod_status_phase',
  
  // Deployment 指标
  deploymentReplicas: 'kube_deployment_status_replicas_available / kube_deployment_spec_replicas',
  
  // 存储指标
  pvcUsage: 'kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes * 100',
  
  // API Server 指标
  apiServerLatency: 'histogram_quantile(0.99, sum(rate(apiserver_request_duration_seconds_bucket[5m])) by (le))',
  apiServerRequests: 'sum(rate(apiserver_request_total[5m])) by (verb)',
};

/**
 * 时间范围工具
 */
export const TimeRange = {
  last5m: () => {
    const end = Math.floor(Date.now() / 1000);
    return { start: end - 300, end };
  },
  last15m: () => {
    const end = Math.floor(Date.now() / 1000);
    return { start: end - 900, end };
  },
  last1h: () => {
    const end = Math.floor(Date.now() / 1000);
    return { start: end - 3600, end };
  },
  last6h: () => {
    const end = Math.floor(Date.now() / 1000);
    return { start: end - 21600, end };
  },
  last24h: () => {
    const end = Math.floor(Date.now() / 1000);
    return { start: end - 86400, end };
  },
  last7d: () => {
    const end = Math.floor(Date.now() / 1000);
    return { start: end - 604800, end };
  },
};
