import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// API 基础地址
const API_BASE = '/api';

// 后端服务端口 - 从环境变量读取，默认 8080
const K8S_SERVICE_PORT = process.env.NEXT_PUBLIC_K8S_SERVICE_PORT || '8080';

// 通用 fetch 函数
async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const urlObj = new URL(url, window.location.origin);
  urlObj.searchParams.set('XTransformPort', K8S_SERVICE_PORT);

  const response = await fetch(urlObj.toString(), options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || 'Request failed');
  }
  return response.json();
}

// ==================== Helm 仓库 ====================

export interface HelmRepo {
  name: string;
  url: string;
  status: string;
  charts: number;
  lastUpdate: string;
}

export function useHelmRepos() {
  return useQuery({
    queryKey: ['helm', 'repos'],
    queryFn: () => fetchApi<HelmRepo[]>(`${API_BASE}/helm/repos`),
  });
}

export function useAddHelmRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (repo: { name: string; url: string }) =>
      fetchApi<{ success: boolean }>(`${API_BASE}/helm/repos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(repo),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['helm'] }),
  });
}

export function useRemoveHelmRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      fetchApi<{ success: boolean }>(`${API_BASE}/helm/repos/${name}`, {
        method: 'DELETE',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['helm'] }),
  });
}

// ==================== Helm Charts ====================

export interface Chart {
  name: string;
  version: string;
  appVersion: string;
  description: string;
  repo: string;
  icon: string;
  keywords: string[];
  downloads?: string;
  stars?: number;
}

export function useCharts(keyword?: string) {
  return useQuery({
    queryKey: ['helm', 'charts', keyword],
    queryFn: () =>
      fetchApi<Chart[]>(`${API_BASE}/helm/charts${keyword ? `?keyword=${keyword}` : ''}`),
  });
}

export function useChartDetail(name: string) {
  return useQuery({
    queryKey: ['helm', 'chart', name],
    queryFn: () => fetchApi<Chart>(`${API_BASE}/helm/charts/${name}`),
    enabled: !!name,
  });
}

// ==================== Helm Releases ====================

export interface Release {
  name: string;
  namespace: string;
  chart: string;
  version: string;
  status: string;
  revision: number;
  updated: string;
}

export function useReleases(namespace?: string) {
  return useQuery({
    queryKey: ['helm', 'releases', namespace],
    queryFn: () =>
      fetchApi<Release[]>(`${API_BASE}/helm/releases${namespace ? `?namespace=${namespace}` : ''}`),
    refetchInterval: 10000,
  });
}

export function useReleaseStatus(name: string, namespace: string) {
  return useQuery({
    queryKey: ['helm', 'release', name, namespace],
    queryFn: () =>
      fetchApi<Release>(`${API_BASE}/helm/releases/${name}/status?namespace=${namespace}`),
    enabled: !!name && !!namespace,
    refetchInterval: 5000,
  });
}

// ==================== Helm 部署 ====================

export interface InstallOptions {
  name: string;
  namespace: string;
  chart: string;
  version?: string;
  values?: Record<string, unknown>;
  wait?: boolean;
  timeout?: number;
}

export interface InstallResult {
  name: string;
  status: string;
  message: string;
}

export function useHelmInstall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (opts: InstallOptions) =>
      fetchApi<InstallResult>(`${API_BASE}/helm/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helm'] });
      queryClient.invalidateQueries({ queryKey: ['k8s'] });
    },
  });
}

export function useHelmUpgrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (opts: { name: string; namespace: string; chart: string; values?: Record<string, unknown> }) =>
      fetchApi<InstallResult>(`${API_BASE}/helm/upgrade/${opts.name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['helm'] }),
  });
}

export function useHelmUninstall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, namespace }: { name: string; namespace: string }) =>
      fetchApi<{ success: boolean }>(`${API_BASE}/helm/uninstall/${name}?namespace=${namespace}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helm'] });
      queryClient.invalidateQueries({ queryKey: ['k8s'] });
    },
  });
}

export function useHelmRollback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, namespace, revision }: { name: string; namespace: string; revision: number }) =>
      fetchApi<{ success: boolean }>(`${API_BASE}/helm/rollback/${name}?namespace=${namespace}&revision=${revision}`, {
        method: 'POST',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['helm'] }),
  });
}

// ==================== 快速部署中间件 ====================

export interface MiddlewareTemplate {
  name: string;
  icon: string;
  description: string;
  chart: string;
  defaultValues: Record<string, unknown>;
  category: 'database' | 'cache' | 'queue' | 'monitoring' | 'ingress';
}

// 预定义的中间件模板
export const MIDDLEWARE_TEMPLATES: MiddlewareTemplate[] = [
  {
    name: 'MySQL',
    icon: '🗄️',
    description: '开源关系型数据库',
    chart: 'bitnami/mysql',
    category: 'database',
    defaultValues: {
      auth: { rootPassword: 'changeme' },
      primary: { persistence: { size: '8Gi' } },
    },
  },
  {
    name: 'Redis',
    icon: '🔴',
    description: '高性能内存数据库',
    chart: 'bitnami/redis',
    category: 'cache',
    defaultValues: {
      auth: { password: 'changeme' },
      master: { persistence: { enabled: true } },
    },
  },
  {
    name: 'PostgreSQL',
    icon: '🐘',
    description: '企业级关系型数据库',
    chart: 'bitnami/postgresql',
    category: 'database',
    defaultValues: {
      auth: { postgresPassword: 'changeme' },
      primary: { persistence: { size: '8Gi' } },
    },
  },
  {
    name: 'MongoDB',
    icon: '🍃',
    description: 'NoSQL 文档数据库',
    chart: 'bitnami/mongodb',
    category: 'database',
    defaultValues: {
      auth: { rootPassword: 'changeme' },
      persistence: { size: '8Gi' },
    },
  },
  {
    name: 'Kafka',
    icon: '📨',
    description: '分布式消息队列',
    chart: 'bitnami/kafka',
    category: 'queue',
    defaultValues: {
      listeners: { client: { protocol: 'PLAINTEXT' } },
      persistence: { size: '8Gi' },
    },
  },
  {
    name: 'RabbitMQ',
    icon: '🐰',
    description: '消息代理软件',
    chart: 'bitnami/rabbitmq',
    category: 'queue',
    defaultValues: {
      auth: { username: 'admin', password: 'changeme' },
      persistence: { size: '8Gi' },
    },
  },
  {
    name: 'Elasticsearch',
    icon: '🔍',
    description: '分布式搜索和分析引擎',
    chart: 'bitnami/elasticsearch',
    category: 'database',
    defaultValues: {
      master: { persistence: { size: '8Gi' } },
      data: { persistence: { size: '8Gi' } },
    },
  },
  {
    name: 'Prometheus',
    icon: '📊',
    description: '监控和告警系统',
    chart: 'prometheus-community/kube-prometheus-stack',
    category: 'monitoring',
    defaultValues: {
      prometheus: { service: { type: 'NodePort' } },
      grafana: { service: { type: 'NodePort' } },
    },
  },
  {
    name: 'Nginx Ingress',
    icon: '🚀',
    description: 'Kubernetes Ingress 控制器',
    chart: 'ingress-nginx/ingress-nginx',
    category: 'ingress',
    defaultValues: {
      controller: { service: { type: 'LoadBalancer' } },
    },
  },
  {
    name: 'MinIO',
    icon: '📦',
    description: '对象存储服务',
    chart: 'bitnami/minio',
    category: 'database',
    defaultValues: {
      auth: { rootUser: 'admin', rootPassword: 'changeme' },
      persistence: { size: '20Gi' },
    },
  },
];

// 快速部署 hook
export function useQuickDeploy() {
  const install = useHelmInstall();

  const quickDeploy = async (
    template: MiddlewareTemplate,
    options: { name?: string; namespace: string; values?: Record<string, unknown> }
  ) => {
    const installOpts: InstallOptions = {
      name: options.name || template.name.toLowerCase(),
      namespace: options.namespace,
      chart: template.chart,
      values: { ...template.defaultValues, ...options.values },
      wait: true,
      timeout: 600, // 10 分钟
    };

    return install.mutateAsync(installOpts);
  };

  return {
    quickDeploy,
    isPending: install.isPending,
    error: install.error,
    reset: install.reset,
  };
}
