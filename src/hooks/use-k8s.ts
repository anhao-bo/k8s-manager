import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Go API 基础地址 (通过 Next.js API 代理转发)
const API_BASE = '/api';

// 后端服务端口 - 从环境变量读取，默认 8080
const K8S_SERVICE_PORT = process.env.NEXT_PUBLIC_K8S_SERVICE_PORT || '8080';

// 通用 fetch 函数
async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  // 添加 XTransformPort 查询参数
  const urlObj = new URL(url, window.location.origin);
  urlObj.searchParams.set('XTransformPort', K8S_SERVICE_PORT);

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
    refetchInterval: 10000, // 每 10 秒刷新
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

export function usePods(namespace?: string) {
  return useQuery({
    queryKey: ['k8s', 'pods', namespace],
    queryFn: () => fetchApi<Array<{
      name: string;
      namespace: string;
      status: string;
      podIP: string;
      nodeName: string;
      containers: number;
      readyContainers: number;
      restarts: number;
      labels: Record<string, string>;
      createdAt: string;
    }>>(`${API_BASE}/pods${namespace ? `?namespace=${namespace}` : ''}`),
    refetchInterval: 10000,
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

// 重建 Pod（先删除后创建）
export function useRecreatePod() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: { namespace: string; name: string; yaml: string }) => {
      const { namespace, name, yaml } = params;
      
      // 等待函数
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      
      // 步骤 1: 删除旧 Pod
      const deleteRes = await fetch(`/api/pods?XTransformPort=${K8S_SERVICE_PORT}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namespace, name }),
      });
      
      if (!deleteRes.ok) {
        const error = await deleteRes.json().catch(() => ({ error: 'Failed to delete pod' }));
        throw new Error(error.error || 'Failed to delete pod');
      }
      
      // 步骤 2: 等待 Pod 被删除
      for (let i = 0; i < 30; i++) {
        try {
          const checkRes = await fetch(`/api/pods/yaml?namespace=${namespace}&name=${name}`);
          if (!checkRes.ok) {
            // Pod 已经不存在了，可以创建新的
            break;
          }
        } catch {
          break;
        }
        await sleep(1000);
      }
      
      // 步骤 3: 创建新 Pod（使用 apply API）
      const applyResponse = await fetch(`/api/apply?XTransformPort=${K8S_SERVICE_PORT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml, namespace }),
      });
      
      if (!applyResponse.ok) {
        const error = await applyResponse.json().catch(() => ({ error: 'Failed to create pod' }));
        throw new Error(error.error || 'Failed to create pod');
      }
      
      return applyResponse.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['k8s', 'pods'] });
    },
  });
}

export function useDeleteDeployment() {
  const mutation = useK8sMutation();
  return {
    mutate: (namespace: string, name: string) => 
      mutation.mutate({ 
        endpoint: '/deployments', 
        method: 'DELETE',
        body: { namespace, name } 
      }),
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
    }, callbacks?: { onSuccess?: (result: unknown) => void; onError?: (error: Error) => void }) => {
      mutation.mutate(
        {
          endpoint: '/pods',
          body: params
        },
        {
          onSuccess: (result) => {
            callbacks?.onSuccess?.(result);
          },
          onError: (error) => {
            callbacks?.onError?.(error);
          },
        }
      );
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
    }, callbacks?: { onSuccess?: (result: unknown) => void; onError?: (error: Error) => void }) => {
      mutation.mutate(
        {
          endpoint: '/deployments',
          body: params
        },
        {
          onSuccess: (result) => {
            callbacks?.onSuccess?.(result);
          },
          onError: (error) => {
            callbacks?.onError?.(error);
          },
        }
      );
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
      storageClass?: string;
      storageSize?: string;
      labels?: Record<string, string>;
    }, callbacks?: { onSuccess?: (result: unknown) => void; onError?: (error: Error) => void }) => {
      mutation.mutate(
        {
          endpoint: '/statefulsets',
          body: params
        },
        {
          onSuccess: (result) => {
            callbacks?.onSuccess?.(result);
          },
          onError: (error) => {
            callbacks?.onError?.(error);
          },
        }
      );
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
    }, callbacks?: { onSuccess?: (result: unknown) => void; onError?: (error: Error) => void }) => {
      mutation.mutate(
        {
          endpoint: '/daemonsets',
          body: params
        },
        {
          onSuccess: (result) => {
            callbacks?.onSuccess?.(result);
          },
          onError: (error) => {
            callbacks?.onError?.(error);
          },
        }
      );
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
      backoffLimit?: number;
      labels?: Record<string, string>;
    }, callbacks?: { onSuccess?: (result: unknown) => void; onError?: (error: Error) => void }) => {
      mutation.mutate(
        {
          endpoint: '/jobs',
          body: params
        },
        {
          onSuccess: (result) => {
            callbacks?.onSuccess?.(result);
          },
          onError: (error) => {
            callbacks?.onError?.(error);
          },
        }
      );
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
    mutate: (namespace: string, name: string, callbacks?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      mutation.mutate(
        {
          endpoint: '/statefulsets',
          method: 'DELETE',
          body: { namespace, name }
        },
        {
          onSuccess: () => callbacks?.onSuccess?.(),
          onError: (error) => callbacks?.onError?.(error),
        }
      );
    },
    isPending: mutation.isPending,
  };
}

// 删除 DaemonSet
export function useDeleteDaemonSet() {
  const mutation = useK8sMutation();
  return {
    mutate: (namespace: string, name: string, callbacks?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      mutation.mutate(
        {
          endpoint: '/daemonsets',
          method: 'DELETE',
          body: { namespace, name }
        },
        {
          onSuccess: () => callbacks?.onSuccess?.(),
          onError: (error) => callbacks?.onError?.(error),
        }
      );
    },
    isPending: mutation.isPending,
  };
}

// 删除 Job
export function useDeleteJob() {
  const mutation = useK8sMutation();
  return {
    mutate: (namespace: string, name: string, callbacks?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      mutation.mutate(
        {
          endpoint: '/jobs',
          method: 'DELETE',
          body: { namespace, name }
        },
        {
          onSuccess: () => callbacks?.onSuccess?.(),
          onError: (error) => callbacks?.onError?.(error),
        }
      );
    },
    isPending: mutation.isPending,
  };
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
      lastScheduleTime?: string;
      activeJobs: number;
      lastSuccessfulJob?: string;
      labels: Record<string, string>;
      createdAt: string;
    }>>(`${API_BASE}/cronjobs${namespace ? `?namespace=${namespace}` : ''}`),
    refetchInterval: 15000,
  });
}

export function useCreateCronJob() {
  const mutation = useK8sMutation();
  return {
    mutate: (params: {
      namespace: string;
      name: string;
      image: string;
      containerName?: string;
      command?: string[];
      args?: string[];
      schedule: string;
      suspend?: boolean;
      successfulJobsHistoryLimit?: number;
      failedJobsHistoryLimit?: number;
      labels?: Record<string, string>;
    }, callbacks?: { onSuccess?: (result: unknown) => void; onError?: (error: Error) => void }) => {
      mutation.mutate(
        {
          endpoint: '/cronjobs',
          body: params
        },
        {
          onSuccess: (result) => {
            callbacks?.onSuccess?.(result);
          },
          onError: (error) => {
            callbacks?.onError?.(error);
          },
        }
      );
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

export function useDeleteCronJob() {
  const mutation = useK8sMutation();
  return {
    mutate: (namespace: string, name: string, callbacks?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      mutation.mutate(
        {
          endpoint: '/cronjobs',
          method: 'DELETE',
          body: { namespace, name }
        },
        {
          onSuccess: () => callbacks?.onSuccess?.(),
          onError: (error) => callbacks?.onError?.(error),
        }
      );
    },
    isPending: mutation.isPending,
  };
}

// ==================== ReplicaSets ====================

export function useReplicaSets(namespace?: string) {
  return useQuery({
    queryKey: ['k8s', 'replicasets', namespace],
    queryFn: () => fetchApi<Array<{
      name: string;
      namespace: string;
      replicas: number;
      readyReplicas: number;
      ownerRef?: { kind: string; name: string };
      labels: Record<string, string>;
      createdAt: string;
    }>>(`${API_BASE}/replicasets${namespace ? `?namespace=${namespace}` : ''}`),
    refetchInterval: 15000,
  });
}

export function useDeleteReplicaSet() {
  const mutation = useK8sMutation();
  return {
    mutate: (namespace: string, name: string, callbacks?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      mutation.mutate(
        {
          endpoint: '/replicasets',
          method: 'DELETE',
          body: { namespace, name }
        },
        {
          onSuccess: () => callbacks?.onSuccess?.(),
          onError: (error) => callbacks?.onError?.(error),
        }
      );
    },
    isPending: mutation.isPending,
  };
}

// ==================== HPAs ====================

export function useHPAs(namespace?: string) {
  return useQuery({
    queryKey: ['k8s', 'hpas', namespace],
    queryFn: () => fetchApi<Array<{
      name: string;
      namespace: string;
      scaleTargetRef: { kind: string; name: string };
      minReplicas: number;
      maxReplicas: number;
      currentReplicas: number;
      desiredReplicas: number;
      currentMetrics: Array<{
        type: string;
        name?: string;
        currentValue: number;
        currentUtilization?: number;
      }>;
      labels: Record<string, string>;
      createdAt: string;
    }>>(`${API_BASE}/hpas${namespace ? `?namespace=${namespace}` : ''}`),
    refetchInterval: 15000,
  });
}

export function useDeleteHPA() {
  const mutation = useK8sMutation();
  return {
    mutate: (namespace: string, name: string, callbacks?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      mutation.mutate(
        {
          endpoint: '/hpas',
          method: 'DELETE',
          body: { namespace, name }
        },
        {
          onSuccess: () => callbacks?.onSuccess?.(),
          onError: (error) => callbacks?.onError?.(error),
        }
      );
    },
    isPending: mutation.isPending,
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

// 获取 Pod YAML
export function usePodYaml(namespace: string, name: string) {
  return useQuery({
    queryKey: ['k8s', 'pod-yaml', namespace, name],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/pods/yaml?namespace=${namespace}&name=${name}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || error.message || 'Request failed');
      }
      return response.json();
    },
    enabled: !!namespace && !!name,
  });
}

// 更新 Pod YAML
export function useUpdatePodYaml() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: { namespace: string; name: string; yaml: string }) => {
      const response = await fetch(`${API_BASE}/pods/yaml`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || error.message || 'Request failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['k8s', 'pods'] });
    },
  });
}

// 通用资源 YAML 获取 hook
export function useResourceYaml(resourceType: string, namespace: string, name: string) {
  return useQuery({
    queryKey: ['k8s', 'resource-yaml', resourceType, namespace, name],
    queryFn: async () => {
      const params = new URLSearchParams({ namespace, name });
      const response = await fetch(`${API_BASE}/resources/${resourceType}/yaml?${params.toString()}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || error.message || 'Request failed');
      }
      return response.json();
    },
    enabled: !!namespace && !!name,
  });
}

// 通用资源 YAML 更新 hook
export function useUpdateResourceYaml(resourceType: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: { namespace: string; name: string; yaml: string }) => {
      const response = await fetch(`${API_BASE}/resources/${resourceType}/yaml`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || error.message || 'Request failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['k8s', resourceType] });
    },
  });
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
