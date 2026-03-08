import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Go API 基础地址 (通过 Next.js API 代理转发)
const API_BASE = '/api';

// 通用 fetch 函数
async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  // 添加 XTransformPort 查询参数
  const urlObj = new URL(url, window.location.origin);
  urlObj.searchParams.set('XTransformPort', '8080');

  const response = await fetch(urlObj.toString(), options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || 'Request failed');
  }
  return response.json();
}

// ==================== 集群状态 ====================

export function useClusterStatus() {
  return useQuery({
    queryKey: ['k8s', 'status'],
    queryFn: () => fetchApi<{ connected: boolean; version?: string; error?: string; message: string; hint?: string }>(
      `${API_BASE}/status`
    ),
    refetchInterval: 30000, // 每 30 秒刷新
  });
}

export function useClusterOverview() {
  return useQuery({
    queryKey: ['k8s', 'overview'],
    queryFn: () => fetchApi<{
      nodes: number;
      readyNodes: number;
      namespaces: number;
      pods: number;
      runningPods: number;
      deployments: number;
      services: number;
    }>(`${API_BASE}/overview`),
    refetchInterval: 5000, // 每 5 秒刷新
  });
}

// ==================== 节点 ====================

export function useNodes() {
  return useQuery({
    queryKey: ['k8s', 'nodes'],
    queryFn: () => fetchApi<Array<{
      name: string;
      status: 'Ready' | 'NotReady' | 'Unknown';
      roles: string[];
      ip: string;
      os: string;
      arch: string;
      kernelVersion: string;
      kubeletVersion: string;
      capacity: { cpu: string; memory: string; pods: string };
      allocatable: { cpu: string; memory: string; pods: string };
      conditions: Array<{ type: string; status: string; message: string }>;
      labels: Record<string, string>;
      createdAt: string;
    }>>(`${API_BASE}/nodes`),
    refetchInterval: 30000,
  });
}

// ==================== 命名空间 ====================

export function useNamespaces() {
  return useQuery({
    queryKey: ['k8s', 'namespaces'],
    queryFn: () => fetchApi<Array<{
      name: string;
      status: string;
      labels: Record<string, string>;
      createdAt: string;
    }>>(`${API_BASE}/namespaces`),
  });
}

// ==================== Pods ====================

// 容器状态信息
export interface ContainerStatusInfo {
  name: string;
  image: string;
  state: 'Running' | 'Waiting' | 'Terminated';
  stateReason?: string;
  stateMessage?: string;
  ready: boolean;
  restartCount: number;
  exitCode?: number;
  startedAt?: string;
  finishedAt?: string;
  lastExitCode?: number;
  lastExitReason?: string;
}

// Pod 信息
export interface PodInfo {
  name: string;
  namespace: string;
  status: string;           // 计算后的展示状态（如 CrashLoopBackOff, Running 等）
  phase: string;            // K8s Phase (Pending, Running, Succeeded, Failed, Unknown)
  statusReason?: string;
  statusMessage?: string;
  podIP: string;
  hostIP?: string;
  nodeName: string;
  containers: number;
  readyContainers: number;
  restarts: number;
  labels: Record<string, string>;
  createdAt: string;
  isStaticPod?: boolean;
  restartPolicy?: string;
  qosClass?: string;
  containerStatuses?: ContainerStatusInfo[];
}

// 容器详细信息
export interface ContainerInfo {
  name: string;
  image: string;
  imageID?: string;
  containerID?: string;
  state: 'Running' | 'Waiting' | 'Terminated';
  stateReason?: string;
  stateMessage?: string;
  ready: boolean;
  restartCount: number;
  exitCode?: number;
  signal?: number;
  startedAt?: string;
  finishedAt?: string;
  lastExitCode?: number;
  lastExitReason?: string;
  lastExitMessage?: string;
}

// Pod 条件
export interface PodCondition {
  type: string;
  status: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

// 事件源
export interface EventSource {
  component: string;
  host: string;
}

// 事件信息
export interface EventInfo {
  name: string;
  namespace: string;
  type: string;
  reason: string;
  message: string;
  count: number;
  firstTimestamp: string;
  lastTimestamp: string;
  source: EventSource;
}

// 卷信息
export interface VolumeInfo {
  name: string;
  type: string;
}

// Pod 详细信息
export interface PodDetail {
  name: string;
  namespace: string;
  status: string;
  phase: string;
  statusReason?: string;
  statusMessage?: string;
  podIP: string;
  hostIP?: string;
  nodeName: string;
  containers: ContainerInfo[];
  initContainers?: ContainerInfo[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
  volumes?: VolumeInfo[];
  conditions?: PodCondition[];
  events?: EventInfo[];
  createdAt: string;
  isStaticPod?: boolean;
  restartPolicy?: string;
  qosClass?: string;
  startTime?: string;
}

export function usePods(namespace?: string) {
  return useQuery({
    queryKey: ['k8s', 'pods', namespace],
    queryFn: () => fetchApi<PodInfo[]>(`${API_BASE}/pods${namespace ? `?namespace=${namespace}` : ''}`),
    refetchInterval: 5000, // 缩短刷新间隔到 5 秒
  });
}

export function usePodLogs(namespace: string, name: string, container?: string, tailLines?: number) {
  const params = new URLSearchParams({ namespace, name });
  if (container) params.append('container', container);
  if (tailLines) params.append('tailLines', String(tailLines));
  
  return useQuery({
    queryKey: ['k8s', 'pod-logs', namespace, name, container, tailLines],
    queryFn: () => fetchApi<{ logs: string }>(`${API_BASE}/pods/logs?${params.toString()}`),
    enabled: !!namespace && !!name,
    refetchInterval: 5000,
  });
}

// ==================== Deployments ====================

export function useDeployments(namespace?: string) {
  return useQuery({
    queryKey: ['k8s', 'deployments', namespace],
    queryFn: () => fetchApi<Array<{
      name: string;
      namespace: string;
      replicas: number;
      readyReplicas: number;
      availableReplicas: number;
      updatedReplicas: number;
      strategy: string;
      labels: Record<string, string>;
      createdAt: string;
    }>>(`${API_BASE}/deployments${namespace ? `?namespace=${namespace}` : ''}`),
    refetchInterval: 15000,
  });
}

// ==================== StatefulSets ====================

export function useStatefulSets(namespace?: string) {
  return useQuery({
    queryKey: ['k8s', 'statefulsets', namespace],
    queryFn: () => fetchApi<Array<{
      name: string;
      namespace: string;
      replicas: number;
      readyReplicas: number;
      serviceName: string;
      labels: Record<string, string>;
      createdAt: string;
    }>>(`${API_BASE}/statefulsets${namespace ? `?namespace=${namespace}` : ''}`),
    refetchInterval: 15000,
  });
}

// ==================== DaemonSets ====================

export function useDaemonSets(namespace?: string) {
  return useQuery({
    queryKey: ['k8s', 'daemonsets', namespace],
    queryFn: () => fetchApi<Array<{
      name: string;
      namespace: string;
      desiredNodes: number;
      currentNodes: number;
      readyNodes: number;
      updatedNodes: number;
      labels: Record<string, string>;
      createdAt: string;
    }>>(`${API_BASE}/daemonsets${namespace ? `?namespace=${namespace}` : ''}`),
    refetchInterval: 15000,
  });
}

// ==================== Jobs ====================

export function useJobs(namespace?: string) {
  return useQuery({
    queryKey: ['k8s', 'jobs', namespace],
    queryFn: () => fetchApi<Array<{
      name: string;
      namespace: string;
      completions: number;
      succeeded: number;
      parallelism: number;
      status: string;
      startTime?: string;
      completionTime?: string;
      labels: Record<string, string>;
      createdAt: string;
    }>>(`${API_BASE}/jobs${namespace ? `?namespace=${namespace}` : ''}`),
    refetchInterval: 15000,
  });
}

// ==================== CronJobs ====================

export function useCronJobs(namespace?: string) {
  return useQuery({
    queryKey: ['k8s', 'cronjobs', namespace],
    queryFn: () => fetchApi<Array<{
      name: string;
      namespace: string;
      schedule: string;
      suspend: boolean;
      lastSchedule?: string;
      successfulJobs: number;
      failedJobs: number;
      labels: Record<string, string>;
      createdAt: string;
    }>>(`${API_BASE}/cronjobs${namespace ? `?namespace=${namespace}` : ''}`),
    refetchInterval: 15000,
  });
}

// ==================== Services ====================

export function useServices(namespace?: string) {
  return useQuery({
    queryKey: ['k8s', 'services', namespace],
    queryFn: () => fetchApi<Array<{
      name: string;
      namespace: string;
      type: string;
      clusterIP: string;
      externalIP: string;
      ports: Array<{ name: string; port: number; targetPort: string; protocol: string }>;
      selector: Record<string, string>;
      createdAt: string;
    }>>(`${API_BASE}/services${namespace ? `?namespace=${namespace}` : ''}`),
  });
}

// ==================== Ingress ====================

export function useIngresses(namespace?: string) {
  return useQuery({
    queryKey: ['k8s', 'ingresses', namespace],
    queryFn: () => fetchApi<Array<{
      name: string;
      namespace: string;
      className: string;
      hosts: string[];
      paths: Array<{ host: string; path: string; pathType: string; backend: { service: string; port: string } }>;
      tls: boolean;
      createdAt: string;
    }>>(`${API_BASE}/ingresses${namespace ? `?namespace=${namespace}` : ''}`),
  });
}

// ==================== ConfigMaps ====================

export function useConfigMaps(namespace?: string) {
  return useQuery({
    queryKey: ['k8s', 'configmaps', namespace],
    queryFn: () => fetchApi<Array<{
      name: string;
      namespace: string;
      data: Record<string, string>;
      createdAt: string;
    }>>(`${API_BASE}/configmaps${namespace ? `?namespace=${namespace}` : ''}`),
  });
}

// ==================== Secrets ====================

export function useSecrets(namespace?: string) {
  return useQuery({
    queryKey: ['k8s', 'secrets', namespace],
    queryFn: () => fetchApi<Array<{
      name: string;
      namespace: string;
      type: string;
      dataKeys: string[];
      createdAt: string;
    }>>(`${API_BASE}/secrets${namespace ? `?namespace=${namespace}` : ''}`),
  });
}

// ==================== PVC ====================

export function usePVCs(namespace?: string) {
  return useQuery({
    queryKey: ['k8s', 'pvcs', namespace],
    queryFn: () => fetchApi<Array<{
      name: string;
      namespace: string;
      status: string;
      capacity: string;
      accessModes: string[];
      storageClass: string;
      volumeName: string;
      createdAt: string;
    }>>(`${API_BASE}/pvcs${namespace ? `?namespace=${namespace}` : ''}`),
  });
}

// ==================== PV ====================

export function usePVs() {
  return useQuery({
    queryKey: ['k8s', 'pvs'],
    queryFn: () => fetchApi<Array<{
      name: string;
      status: string;
      capacity: string;
      accessModes: string[];
      reclaimPolicy: string;
      storageClass: string;
      nfs?: { server: string; path: string };
      createdAt: string;
    }>>(`${API_BASE}/pvs`),
  });
}

// ==================== StorageClass ====================

export function useStorageClasses() {
  return useQuery({
    queryKey: ['k8s', 'storageclasses'],
    queryFn: () => fetchApi<Array<{
      name: string;
      provisioner: string;
      reclaimPolicy: string;
      volumeBindingMode: string;
      allowVolumeExpansion: boolean;
      default: boolean;
      parameters: Record<string, string>;
    }>>(`${API_BASE}/storageclasses`),
  });
}

// ==================== Events ====================

export function useEvents(namespace?: string) {
  return useQuery({
    queryKey: ['k8s', 'events', namespace],
    queryFn: () => fetchApi<Array<{
      name: string;
      namespace: string;
      type: string;
      reason: string;
      message: string;
      involvedObject: { kind: string; name: string; namespace: string };
      count: number;
      firstTimestamp: string;
      lastTimestamp: string;
      source: { component: string; host: string };
    }>>(`${API_BASE}/events${namespace ? `?namespace=${namespace}` : ''}`),
    refetchInterval: 30000,
  });
}

// ==================== Mutations ====================

export function useK8sMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      endpoint: string;
      method?: 'POST' | 'DELETE';
      body?: Record<string, unknown>;
    }) => {
      return fetchApi(`${API_BASE}${params.endpoint}`, {
        method: params.method || 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: params.body ? JSON.stringify(params.body) : undefined,
      });
    },
    onSuccess: () => {
      // 刷新所有 k8s 查询
      queryClient.invalidateQueries({ queryKey: ['k8s'] });
    },
  });
}

// 便捷方法
export function useScaleDeployment() {
  const mutation = useK8sMutation();
  return {
    mutate: (namespace: string, name: string, replicas: number) => 
      mutation.mutate({ 
        endpoint: '/deployments/scale', 
        body: { namespace, name, replicas } 
      }),
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

export function useRestartDeployment() {
  const mutation = useK8sMutation();
  return {
    mutate: (namespace: string, name: string) => 
      mutation.mutate({ 
        endpoint: '/deployments/restart', 
        body: { namespace, name } 
      }),
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

export function useDeletePod() {
  const mutation = useK8sMutation();
  return {
    mutate: (namespace: string, name: string) => 
      mutation.mutate({ 
        endpoint: '/pods', 
        method: 'DELETE',
        body: { namespace, name } 
      }),
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

export function useDeleteDeployment() {
  const mutation = useK8sMutation();
  return {
    mutate: (namespace: string, name: string, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      if (options?.onSuccess || options?.onError) {
        return mutation.mutate(
          { endpoint: '/deployments', method: 'DELETE', body: { namespace, name } },
          { onSuccess: options.onSuccess, onError: options.onError }
        );
      }
      return mutation.mutate({ endpoint: '/deployments', method: 'DELETE', body: { namespace, name } });
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

// 删除 StatefulSet
export function useDeleteStatefulSet() {
  const mutation = useK8sMutation();
  return {
    mutate: (namespace: string, name: string, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      if (options?.onSuccess || options?.onError) {
        return mutation.mutate(
          { endpoint: '/statefulsets', method: 'DELETE', body: { namespace, name } },
          { onSuccess: options.onSuccess, onError: options.onError }
        );
      }
      return mutation.mutate({ endpoint: '/statefulsets', method: 'DELETE', body: { namespace, name } });
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

// 删除 DaemonSet
export function useDeleteDaemonSet() {
  const mutation = useK8sMutation();
  return {
    mutate: (namespace: string, name: string, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      if (options?.onSuccess || options?.onError) {
        return mutation.mutate(
          { endpoint: '/daemonsets', method: 'DELETE', body: { namespace, name } },
          { onSuccess: options.onSuccess, onError: options.onError }
        );
      }
      return mutation.mutate({ endpoint: '/daemonsets', method: 'DELETE', body: { namespace, name } });
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

// 删除 Job
export function useDeleteJob() {
  const mutation = useK8sMutation();
  return {
    mutate: (namespace: string, name: string, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      if (options?.onSuccess || options?.onError) {
        return mutation.mutate(
          { endpoint: '/jobs', method: 'DELETE', body: { namespace, name } },
          { onSuccess: options.onSuccess, onError: options.onError }
        );
      }
      return mutation.mutate({ endpoint: '/jobs', method: 'DELETE', body: { namespace, name } });
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

// 删除 CronJob
export function useDeleteCronJob() {
  const mutation = useK8sMutation();
  return {
    mutate: (namespace: string, name: string, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      if (options?.onSuccess || options?.onError) {
        return mutation.mutate(
          { endpoint: '/cronjobs', method: 'DELETE', body: { namespace, name } },
          { onSuccess: options.onSuccess, onError: options.onError }
        );
      }
      return mutation.mutate({ endpoint: '/cronjobs', method: 'DELETE', body: { namespace, name } });
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

// 扩缩容 StatefulSet
export function useScaleStatefulSet() {
  const mutation = useK8sMutation();
  return {
    mutate: (namespace: string, name: string, replicas: number, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      if (options?.onSuccess || options?.onError) {
        return mutation.mutate(
          { endpoint: '/statefulsets/scale', body: { namespace, name, replicas } },
          { onSuccess: options.onSuccess, onError: options.onError }
        );
      }
      return mutation.mutate({ endpoint: '/statefulsets/scale', body: { namespace, name, replicas } });
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

// 重启 StatefulSet
export function useRestartStatefulSet() {
  const mutation = useK8sMutation();
  return {
    mutate: (namespace: string, name: string, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      if (options?.onSuccess || options?.onError) {
        return mutation.mutate(
          { endpoint: '/statefulsets/restart', body: { namespace, name } },
          { onSuccess: options.onSuccess, onError: options.onError }
        );
      }
      return mutation.mutate({ endpoint: '/statefulsets/restart', body: { namespace, name } });
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

// 重启 DaemonSet
export function useRestartDaemonSet() {
  const mutation = useK8sMutation();
  return {
    mutate: (namespace: string, name: string, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      if (options?.onSuccess || options?.onError) {
        return mutation.mutate(
          { endpoint: '/daemonsets/restart', body: { namespace, name } },
          { onSuccess: options.onSuccess, onError: options.onError }
        );
      }
      return mutation.mutate({ endpoint: '/daemonsets/restart', body: { namespace, name } });
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

// 暂停/恢复 CronJob
export function useSuspendCronJob() {
  const mutation = useK8sMutation();
  return {
    mutate: (namespace: string, name: string, suspend: boolean, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      if (options?.onSuccess || options?.onError) {
        return mutation.mutate(
          { endpoint: '/cronjobs/suspend', body: { namespace, name, suspend } },
          { onSuccess: options.onSuccess, onError: options.onError }
        );
      }
      return mutation.mutate({ endpoint: '/cronjobs/suspend', body: { namespace, name, suspend } });
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

// 手动触发 CronJob
export function useTriggerCronJob() {
  const mutation = useK8sMutation();
  return {
    mutate: (namespace: string, name: string, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      if (options?.onSuccess || options?.onError) {
        return mutation.mutate(
          { endpoint: '/cronjobs/trigger', body: { namespace, name } },
          { onSuccess: options.onSuccess, onError: options.onError }
        );
      }
      return mutation.mutate({ endpoint: '/cronjobs/trigger', body: { namespace, name } });
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

export function useCreateNamespace() {
  const mutation = useK8sMutation();
  return {
    mutate: (name: string, labels?: Record<string, string>) =>
      mutation.mutate({
        endpoint: '/namespaces',
        body: { name, labels }
      }),
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

// 创建 Pod
export function useCreatePod() {
  const mutation = useK8sMutation();
  return {
    mutate: (params: {
      namespace: string;
      name: string;
      image: string;
      containerName?: string;
      command?: string[];
      args?: string[];
      env?: Record<string, string>;
      ports?: number[];
    }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      if (options?.onSuccess || options?.onError) {
        return mutation.mutate(
          { endpoint: '/pods', body: params },
          { onSuccess: options.onSuccess, onError: options.onError }
        );
      }
      return mutation.mutate({ endpoint: '/pods', body: params });
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

// 创建 Deployment
export function useCreateDeployment() {
  const mutation = useK8sMutation();
  return {
    mutate: (params: {
      namespace: string;
      name: string;
      image: string;
      replicas?: number;
      containerName?: string;
      containerPort?: number;
      labels?: Record<string, string>;
    }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      if (options?.onSuccess || options?.onError) {
        return mutation.mutate(
          { endpoint: '/deployments', body: params },
          { onSuccess: options.onSuccess, onError: options.onError }
        );
      }
      return mutation.mutate({ endpoint: '/deployments', body: params });
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

// 创建 StatefulSet
export function useCreateStatefulSet() {
  const mutation = useK8sMutation();
  return {
    mutate: (params: {
      namespace: string;
      name: string;
      image: string;
      replicas?: number;
      containerName?: string;
      containerPort?: number;
      serviceName?: string;
      labels?: Record<string, string>;
    }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      if (options?.onSuccess || options?.onError) {
        return mutation.mutate(
          { endpoint: '/statefulsets', body: params },
          { onSuccess: options.onSuccess, onError: options.onError }
        );
      }
      return mutation.mutate({ endpoint: '/statefulsets', body: params });
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

// 创建 DaemonSet
export function useCreateDaemonSet() {
  const mutation = useK8sMutation();
  return {
    mutate: (params: {
      namespace: string;
      name: string;
      image: string;
      containerName?: string;
      containerPort?: number;
      labels?: Record<string, string>;
    }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      if (options?.onSuccess || options?.onError) {
        return mutation.mutate(
          { endpoint: '/daemonsets', body: params },
          { onSuccess: options.onSuccess, onError: options.onError }
        );
      }
      return mutation.mutate({ endpoint: '/daemonsets', body: params });
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

// 创建 Job
export function useCreateJob() {
  const mutation = useK8sMutation();
  return {
    mutate: (params: {
      namespace: string;
      name: string;
      image: string;
      containerName?: string;
      command?: string[];
      args?: string[];
      completions?: number;
      parallelism?: number;
      restartPolicy?: string;
      labels?: Record<string, string>;
    }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      if (options?.onSuccess || options?.onError) {
        return mutation.mutate(
          { endpoint: '/jobs', body: params },
          { onSuccess: options.onSuccess, onError: options.onError }
        );
      }
      return mutation.mutate({ endpoint: '/jobs', body: params });
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

// 创建 CronJob
export function useCreateCronJob() {
  const mutation = useK8sMutation();
  return {
    mutate: (params: {
      namespace: string;
      name: string;
      image: string;
      schedule: string;
      containerName?: string;
      command?: string[];
      args?: string[];
      suspend?: boolean;
      concurrencyPolicy?: string;
      successfulHistory?: number;
      failedHistory?: number;
      labels?: Record<string, string>;
    }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      if (options?.onSuccess || options?.onError) {
        return mutation.mutate(
          { endpoint: '/cronjobs', body: params },
          { onSuccess: options.onSuccess, onError: options.onError }
        );
      }
      return mutation.mutate({ endpoint: '/cronjobs', body: params });
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

// 从 YAML 创建资源
export function useCreateFromYaml() {
  const mutation = useK8sMutation();
  return {
    mutate: (yaml: string, namespace?: string) =>
      mutation.mutate({
        endpoint: '/apply',
        body: { yaml, namespace }
      }),
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

export function useDeleteNamespace() {
  const mutation = useK8sMutation();
  return {
    mutate: (name: string) => 
      mutation.mutate({ 
        endpoint: `/namespaces/${name}`, 
        method: 'DELETE',
      }),
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

// ==================== RBAC ====================

export function useServiceAccounts(namespace?: string) {
  return useQuery({
    queryKey: ['k8s', 'serviceaccounts', namespace],
    queryFn: () => fetchApi<Array<{
      name: string;
      namespace: string;
      secrets: number;
      createdAt: string;
    }>>(`${API_BASE}/serviceaccounts${namespace ? `?namespace=${namespace}` : ''}`),
  });
}

export function useRoles(namespace?: string) {
  return useQuery({
    queryKey: ['k8s', 'roles', namespace],
    queryFn: () => fetchApi<Array<{
      name: string;
      namespace: string;
      type: string;
      rules: number;
      createdAt: string;
    }>>(`${API_BASE}/roles${namespace ? `?namespace=${namespace}` : ''}`),
  });
}

export function useRoleBindings(namespace?: string) {
  return useQuery({
    queryKey: ['k8s', 'rolebindings', namespace],
    queryFn: () => fetchApi<Array<{
      name: string;
      namespace: string;
      roleName: string;
      roleKind: string;
      subjects: string[];
      type: string;
      createdAt: string;
    }>>(`${API_BASE}/rolebindings${namespace ? `?namespace=${namespace}` : ''}`),
  });
}

// ==================== YAML 操作 ====================

// Pod YAML 信息类型
export interface PodYamlInfo {
  yaml: string;
  hasController: boolean;
  controllerKind?: string;
  controllerName?: string;
  updateStrategy: 'delete_recreate' | 'update_controller';
  warning?: string;
}

// 获取 Pod YAML
export function usePodYaml(namespace: string, name: string) {
  return useQuery({
    queryKey: ['k8s', 'pod-yaml', namespace, name],
    queryFn: () => fetchApi<PodYamlInfo>(`${API_BASE}/pods/yaml?namespace=${namespace}&name=${name}`),
    enabled: !!namespace && !!name,
  });
}

// 更新 Pod YAML（删除重建）
export function useUpdatePodYaml() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (params: { namespace: string; name: string; yaml: string }) =>
      fetchApi(`${API_BASE}/pods/yaml`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['k8s'] });
    },
  });
  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

// Pod 详情类型
export interface PodDetail {
  name: string;
  namespace: string;
  status: string;
  phase: string;
  statusReason: string;
  statusMessage: string;
  podIP: string;
  hostIP: string;
  nodeName: string;
  containers: ContainerInfo[];
  initContainers: ContainerInfo[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
  volumes: VolumeInfo[];
  conditions: PodCondition[];
  events: EventInfo[];
  createdAt: string;
  isStaticPod: boolean;
  restartPolicy: string;
  qosClass: string;
  startTime?: string;
}

export interface ContainerInfo {
  name: string;
  image: string;
  imageID: string;
  containerID: string;
  status: string;
  state: string;
  stateReason: string;
  stateMessage: string;
  ready: boolean;
  restartCount: number;
  exitCode?: number;
  signal?: number;
  startedAt?: string;
  finishedAt?: string;
  lastExitCode?: number;
  lastExitReason?: string;
  lastExitMessage?: string;
}

export interface VolumeInfo {
  name: string;
  type: string;
}

export interface PodCondition {
  type: string;
  status: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface EventInfo {
  name: string;
  namespace: string;
  type: string;
  reason: string;
  message: string;
  count: number;
  firstTimestamp: string;
  lastTimestamp: string;
  source: {
    component: string;
    host: string;
  };
}

// 获取 Pod 详情
export function usePodDetail(namespace: string, name: string) {
  return useQuery({
    queryKey: ['k8s', 'pod-detail', namespace, name],
    queryFn: () => fetchApi<PodDetail>(`${API_BASE}/pods/detail?namespace=${namespace}&name=${name}`),
    enabled: !!namespace && !!name,
    refetchInterval: 5000, // 每5秒刷新一次
  });
}

// 获取通用资源 YAML
export function useResourceYaml(kind: string, namespace: string, name: string) {
  return useQuery({
    queryKey: ['k8s', 'resource-yaml', kind, namespace, name],
    queryFn: () => {
      const params = new URLSearchParams({ kind, name });
      if (namespace) params.append('namespace', namespace);
      return fetchApi<{ yaml: string }>(`${API_BASE}/resources/yaml?${params.toString()}`);
    },
    enabled: !!kind && !!name,
  });
}

// 更新通用资源 YAML
export function useUpdateResourceYaml() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (params: { kind: string; namespace?: string; name: string; yaml: string }) =>
      fetchApi(`${API_BASE}/resources/yaml`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['k8s'] });
    },
  });
  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

// ==================== 节点操作 ====================

export function useNodeOperations() {
  const queryClient = useQueryClient();

  // 隔离节点 (Cordon)
  const cordonNode = useMutation({
    mutationFn: (nodeName: string) => 
      fetchApi(`${API_BASE}/nodes/${nodeName}/cordon`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['k8s', 'nodes'] });
    },
  });

  // 解除隔离 (Uncordon)
  const uncordonNode = useMutation({
    mutationFn: (nodeName: string) => 
      fetchApi(`${API_BASE}/nodes/${nodeName}/uncordon`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['k8s', 'nodes'] });
    },
  });

  // 排空节点 (Drain)
  const drainNode = useMutation({
    mutationFn: (nodeName: string) => 
      fetchApi(`${API_BASE}/nodes/${nodeName}/drain`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['k8s', 'nodes'] });
    },
  });

  return {
    cordonNode,
    uncordonNode,
    drainNode,
  };
}

// ==================== 资源详情类型 ====================

// StatefulSet 详情
export interface StatefulSetDetail {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  currentReplicas: number;
  updatedReplicas: number;
  serviceName: string;
  updateStrategy: string;
  partition?: number;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  selector: Record<string, string>;
  containers: Array<{
    name: string;
    image: string;
    ports: number[];
    resources?: Record<string, string>;
  }>;
  volumeClaimTemplates?: Array<{
    name: string;
    storageClass: string;
    accessModes: string[];
    storage: string;
  }>;
  pods: Array<{
    name: string;
    status: string;
    ready: string;
    podIP: string;
    nodeName: string;
    createdAt: string;
  }>;
  events?: EventInfo[];
  createdAt: string;
}

// DaemonSet 详情
export interface DaemonSetDetail {
  name: string;
  namespace: string;
  desiredNodes: number;
  currentNodes: number;
  readyNodes: number;
  updatedNodes: number;
  availableNodes: number;
  updateStrategy: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  selector: Record<string, string>;
  containers: Array<{
    name: string;
    image: string;
    ports: number[];
    resources?: Record<string, string>;
  }>;
  pods: Array<{
    name: string;
    status: string;
    ready: string;
    podIP: string;
    nodeName: string;
    createdAt: string;
  }>;
  events?: EventInfo[];
  createdAt: string;
}

// Job 详情
export interface JobDetail {
  name: string;
  namespace: string;
  completions: number;
  parallelism: number;
  succeeded: number;
  failed: number;
  active: number;
  status: string;
  startTime?: string;
  completionTime?: string;
  duration?: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  selector: Record<string, string>;
  containers: Array<{
    name: string;
    image: string;
    command?: string[];
    args?: string[];
  }>;
  pods: Array<{
    name: string;
    status: string;
    ready: string;
    podIP: string;
    startTime?: string;
    createdAt: string;
  }>;
  events?: EventInfo[];
  createdAt: string;
}

// CronJob 详情
export interface CronJobDetail {
  name: string;
  namespace: string;
  schedule: string;
  suspend: boolean;
  concurrencyPolicy: string;
  successfulJobsHistoryLimit: number;
  failedJobsHistoryLimit: number;
  lastSchedule?: string;
  nextSchedule?: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  containers: Array<{
    name: string;
    image: string;
    command?: string[];
    args?: string[];
  }>;
  activeJobs: Array<{
    name: string;
    status: string;
    startTime?: string;
  }>;
  historyJobs: Array<{
    name: string;
    status: string;
    startTime?: string;
    completionTime?: string;
  }>;
  events?: EventInfo[];
  createdAt: string;
}

// ==================== 资源详情查询 ====================

// 获取 StatefulSet 详情
export function useStatefulSetDetail(namespace: string, name: string) {
  return useQuery({
    queryKey: ['k8s', 'statefulset-detail', namespace, name],
    queryFn: () => fetchApi<StatefulSetDetail>(`${API_BASE}/statefulsets/detail?namespace=${namespace}&name=${name}`),
    enabled: !!namespace && !!name,
    refetchInterval: 10000,
  });
}

// 获取 DaemonSet 详情
export function useDaemonSetDetail(namespace: string, name: string) {
  return useQuery({
    queryKey: ['k8s', 'daemonset-detail', namespace, name],
    queryFn: () => fetchApi<DaemonSetDetail>(`${API_BASE}/daemonsets/detail?namespace=${namespace}&name=${name}`),
    enabled: !!namespace && !!name,
    refetchInterval: 10000,
  });
}

// 获取 Job 详情
export function useJobDetail(namespace: string, name: string) {
  return useQuery({
    queryKey: ['k8s', 'job-detail', namespace, name],
    queryFn: () => fetchApi<JobDetail>(`${API_BASE}/jobs/detail?namespace=${namespace}&name=${name}`),
    enabled: !!namespace && !!name,
    refetchInterval: 10000,
  });
}

// 获取 CronJob 详情
export function useCronJobDetail(namespace: string, name: string) {
  return useQuery({
    queryKey: ['k8s', 'cronjob-detail', namespace, name],
    queryFn: () => fetchApi<CronJobDetail>(`${API_BASE}/cronjobs/detail?namespace=${namespace}&name=${name}`),
    enabled: !!namespace && !!name,
    refetchInterval: 10000,
  });
}
