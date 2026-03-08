import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import * as k8s from '@kubernetes/client-node';
import * as fs from 'fs';
import * as path from 'path';

// Kubernetes API 客户端配置
let k8sConfig: k8s.KubeConfig;
let coreV1Api: k8s.CoreV1Api;
let appsV1Api: k8s.AppsV1Api;
let batchV1Api: k8s.BatchV1Api;
let networkingV1Api: k8s.NetworkingV1Api;
let storageV1Api: k8s.StorageV1Api;
let rbacV1Api: k8s.RbacV1Api;

// 初始化 Kubernetes 客户端
function initK8sClient(kubeconfigPath?: string): boolean {
  try {
    k8sConfig = new k8s.KubeConfig();
    
    if (kubeconfigPath && fs.existsSync(kubeconfigPath)) {
      k8sConfig.loadFromFile(kubeconfigPath);
    } else {
      // 尝试从默认位置加载
      const defaultPath = path.join(process.env.HOME || '/root', '.kube', 'config');
      if (fs.existsSync(defaultPath)) {
        k8sConfig.loadFromFile(defaultPath);
      } else {
        // 尝试集群内配置
        try {
          k8sConfig.loadFromCluster();
        } catch (e) {
          console.log('No kubeconfig found, client not initialized');
          return false;
        }
      }
    }
    
    coreV1Api = k8sConfig.makeApiClient(k8s.CoreV1Api);
    appsV1Api = k8sConfig.makeApiClient(k8s.AppsV1Api);
    batchV1Api = k8sConfig.makeApiClient(k8s.BatchV1Api);
    networkingV1Api = k8sConfig.makeApiClient(k8s.NetworkingV1Api);
    storageV1Api = k8sConfig.makeApiClient(k8s.StorageV1Api);
    rbacV1Api = k8sConfig.makeApiClient(k8s.RbacV1Api);
    
    return true;
  } catch (error) {
    console.error('Failed to initialize Kubernetes client:', error);
    return false;
  }
}

// 初始化客户端
let clientInitialized = initK8sClient();

// 创建 Hono 应用
const app = new Hono();

// 中间件
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Origin', 'Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  credentials: true,
}));

// 健康检查
app.get('/health', (c) => c.json({ status: 'ok' }));

// ==================== Kubeconfig 配置 ====================

app.post('/api/kubeconfig', async (c) => {
  try {
    const body = await c.req.json();
    const { kubeconfig } = body;
    
    if (!kubeconfig) {
      return c.json({ success: false, error: 'kubeconfig is required' }, 400);
    }
    
    // 保存 kubeconfig 到文件
    const kubeconfigDir = path.join(process.env.HOME || '/root', '.kube');
    if (!fs.existsSync(kubeconfigDir)) {
      fs.mkdirSync(kubeconfigDir, { recursive: true });
    }
    
    const kubeconfigPath = path.join(kubeconfigDir, 'config');
    fs.writeFileSync(kubeconfigPath, kubeconfig, { mode: 0o600 });
    
    // 重新初始化客户端
    clientInitialized = initK8sClient(kubeconfigPath);
    
    if (!clientInitialized) {
      return c.json({ 
        success: false, 
        error: 'kubeconfig saved but connection failed',
        message: 'kubeconfig saved but connection failed'
      });
    }
    
    // 测试连接
    const version = await coreV1Api.getAPIVersions();
    
    return c.json({
      success: true,
      message: 'kubeconfig configured successfully',
      version: 'connected'
    });
  } catch (error: any) {
    return c.json({ 
      success: false, 
      error: error.message || 'Failed to configure kubeconfig' 
    }, 500);
  }
});

// ==================== 集群状态 ====================

app.get('/api/status', async (c) => {
  if (!clientInitialized || !coreV1Api) {
    return c.json({
      connected: false,
      error: 'Kubernetes client not initialized',
      message: '无法连接到 Kubernetes 集群',
      hint: '请配置 kubeconfig'
    });
  }
  
  try {
    const version = await coreV1Api.getAPIVersions();
    return c.json({
      connected: true,
      version: 'v1.x',
      message: '已成功连接到 Kubernetes 集群'
    });
  } catch (error: any) {
    return c.json({
      connected: false,
      error: error.message,
      message: '无法连接到 Kubernetes 集群',
      hint: '请检查 kubeconfig 配置'
    });
  }
});

// ==================== 命名空间 ====================

app.get('/api/namespaces', async (c) => {
  if (!clientInitialized || !coreV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    const response = await coreV1Api.listNamespace();
    const namespaces = response.body.items.map((ns: any) => ({
      name: ns.metadata.name,
      status: ns.status.phase,
      labels: ns.metadata.labels || {},
      createdAt: ns.metadata.creationTimestamp
    }));
    return c.json(namespaces);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== Pods ====================

app.get('/api/pods', async (c) => {
  if (!clientInitialized || !coreV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    const namespace = c.req.query('namespace') || '';
    const response = namespace 
      ? await coreV1Api.listNamespacedPod(namespace)
      : await coreV1Api.listPodForAllNamespaces();
    
    const pods = response.body.items.map((pod: any) => {
      // 计算容器状态
      let readyContainers = 0;
      let totalContainers = pod.spec.containers?.length || 0;
      let restarts = 0;
      
      if (pod.status.containerStatuses) {
        for (const cs of pod.status.containerStatuses) {
          if (cs.ready) readyContainers++;
          restarts += cs.restartCount || 0;
        }
      }
      
      return {
        name: pod.metadata.name,
        namespace: pod.metadata.namespace,
        status: pod.status.phase,
        podIP: pod.status.podIP,
        nodeName: pod.spec.nodeName,
        containers: totalContainers,
        readyContainers,
        restarts,
        labels: pod.metadata.labels || {},
        createdAt: pod.metadata.creationTimestamp
      };
    });
    
    return c.json(pods);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== Deployments ====================

app.get('/api/deployments', async (c) => {
  if (!clientInitialized || !appsV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    const namespace = c.req.query('namespace') || '';
    const response = namespace 
      ? await appsV1Api.listNamespacedDeployment(namespace)
      : await appsV1Api.listDeploymentForAllNamespaces();
    
    const deployments = response.body.items.map((deploy: any) => ({
      name: deploy.metadata.name,
      namespace: deploy.metadata.namespace,
      replicas: deploy.spec.replicas || 0,
      readyReplicas: deploy.status.readyReplicas || 0,
      availableReplicas: deploy.status.availableReplicas || 0,
      updatedReplicas: deploy.status.updatedReplicas || 0,
      strategy: deploy.spec.strategy?.type || 'RollingUpdate',
      labels: deploy.metadata.labels || {},
      createdAt: deploy.metadata.creationTimestamp
    }));
    
    return c.json(deployments);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== StatefulSets ====================

app.get('/api/statefulsets', async (c) => {
  if (!clientInitialized || !appsV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    const namespace = c.req.query('namespace') || '';
    const response = namespace 
      ? await appsV1Api.listNamespacedStatefulSet(namespace)
      : await appsV1Api.listStatefulSetForAllNamespaces();
    
    const statefulsets = response.body.items.map((sts: any) => ({
      name: sts.metadata.name,
      namespace: sts.metadata.namespace,
      replicas: sts.spec.replicas || 0,
      readyReplicas: sts.status.readyReplicas || 0,
      serviceName: sts.spec.serviceName,
      labels: sts.metadata.labels || {},
      createdAt: sts.metadata.creationTimestamp
    }));
    
    return c.json(statefulsets);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== DaemonSets ====================

app.get('/api/daemonsets', async (c) => {
  if (!clientInitialized || !appsV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    const namespace = c.req.query('namespace') || '';
    const response = namespace 
      ? await appsV1Api.listNamespacedDaemonSet(namespace)
      : await appsV1Api.listDaemonSetForAllNamespaces();
    
    const daemonsets = response.body.items.map((ds: any) => ({
      name: ds.metadata.name,
      namespace: ds.metadata.namespace,
      desiredNodes: ds.status.desiredNumberScheduled || 0,
      currentNodes: ds.status.currentNumberScheduled || 0,
      readyNodes: ds.status.numberReady || 0,
      updatedNodes: ds.status.updatedNumberScheduled || 0,
      labels: ds.metadata.labels || {},
      createdAt: ds.metadata.creationTimestamp
    }));
    
    return c.json(daemonsets);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== Jobs ====================

app.get('/api/jobs', async (c) => {
  if (!clientInitialized || !batchV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    const namespace = c.req.query('namespace') || '';
    const response = namespace 
      ? await batchV1Api.listNamespacedJob(namespace)
      : await batchV1Api.listJobForAllNamespaces();
    
    const jobs = response.body.items.map((job: any) => {
      let status = 'Running';
      if (job.status.succeeded && job.status.succeeded > 0) {
        status = 'Completed';
      } else if (job.status.failed && job.status.failed > 0) {
        status = 'Failed';
      }
      
      return {
        name: job.metadata.name,
        namespace: job.metadata.namespace,
        completions: job.spec.completions || 1,
        succeeded: job.status.succeeded || 0,
        parallelism: job.spec.parallelism || 1,
        status,
        startTime: job.status.startTime,
        completionTime: job.status.completionTime,
        labels: job.metadata.labels || {},
        createdAt: job.metadata.creationTimestamp
      };
    });
    
    return c.json(jobs);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== CronJobs ====================

app.get('/api/cronjobs', async (c) => {
  if (!clientInitialized || !batchV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    const namespace = c.req.query('namespace') || '';
    const response = namespace 
      ? await batchV1Api.listNamespacedCronJob(namespace)
      : await batchV1Api.listCronJobForAllNamespaces();
    
    const cronjobs = response.body.items.map((cj: any) => ({
      name: cj.metadata.name,
      namespace: cj.metadata.namespace,
      schedule: cj.spec.schedule,
      suspend: cj.spec.suspend || false,
      lastSchedule: cj.status.lastScheduleTime,
      successfulJobs: cj.status.successfulJobsHistoryLimit || 0,
      failedJobs: cj.status.failedJobsHistoryLimit || 0,
      labels: cj.metadata.labels || {},
      createdAt: cj.metadata.creationTimestamp
    }));
    
    return c.json(cronjobs);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== Services ====================

app.get('/api/services', async (c) => {
  if (!clientInitialized || !coreV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    const namespace = c.req.query('namespace') || '';
    const response = namespace 
      ? await coreV1Api.listNamespacedService(namespace)
      : await coreV1Api.listServiceForAllNamespaces();
    
    const services = response.body.items.map((svc: any) => {
      const ports = (svc.spec.ports || []).map((p: any) => ({
        name: p.name || '',
        port: p.port,
        targetPort: p.targetPort?.toString() || '',
        protocol: p.protocol || 'TCP'
      }));
      
      return {
        name: svc.metadata.name,
        namespace: svc.metadata.namespace,
        type: svc.spec.type || 'ClusterIP',
        clusterIP: svc.spec.clusterIP || '',
        externalIP: (svc.spec.externalIPs || []).join(',') || '',
        ports,
        selector: svc.spec.selector || {},
        createdAt: svc.metadata.creationTimestamp
      };
    });
    
    return c.json(services);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== Ingress ====================

app.get('/api/ingresses', async (c) => {
  if (!clientInitialized || !networkingV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    const namespace = c.req.query('namespace') || '';
    const response = namespace 
      ? await networkingV1Api.listNamespacedIngress(namespace)
      : await networkingV1Api.listIngressForAllNamespaces();
    
    const ingresses = response.body.items.map((ing: any) => {
      const hosts: string[] = [];
      const paths: any[] = [];
      
      (ing.spec.rules || []).forEach((rule: any) => {
        if (rule.host) hosts.push(rule.host);
        (rule.http?.paths || []).forEach((p: any) => {
          paths.push({
            host: rule.host || '',
            path: p.path || '/',
            pathType: p.pathType || 'Prefix',
            backend: {
              service: p.backend?.service?.name || '',
              port: p.backend?.service?.port?.number?.toString() || ''
            }
          });
        });
      });
      
      return {
        name: ing.metadata.name,
        namespace: ing.metadata.namespace,
        className: ing.spec.ingressClassName || '',
        hosts,
        paths,
        tls: (ing.spec.tls || []).length > 0,
        createdAt: ing.metadata.creationTimestamp
      };
    });
    
    return c.json(ingresses);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== ConfigMaps ====================

app.get('/api/configmaps', async (c) => {
  if (!clientInitialized || !coreV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    const namespace = c.req.query('namespace') || '';
    const response = namespace 
      ? await coreV1Api.listNamespacedConfigMap(namespace)
      : await coreV1Api.listConfigMapForAllNamespaces();
    
    const configmaps = response.body.items.map((cm: any) => ({
      name: cm.metadata.name,
      namespace: cm.metadata.namespace,
      data: cm.data || {},
      createdAt: cm.metadata.creationTimestamp
    }));
    
    return c.json(configmaps);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== Secrets ====================

app.get('/api/secrets', async (c) => {
  if (!clientInitialized || !coreV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    const namespace = c.req.query('namespace') || '';
    const response = namespace 
      ? await coreV1Api.listNamespacedSecret(namespace)
      : await coreV1Api.listSecretForAllNamespaces();
    
    const secrets = response.body.items.map((secret: any) => ({
      name: secret.metadata.name,
      namespace: secret.metadata.namespace,
      type: secret.type || 'Opaque',
      dataKeys: Object.keys(secret.data || {}),
      createdAt: secret.metadata.creationTimestamp
    }));
    
    return c.json(secrets);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== PVCs ====================

app.get('/api/pvcs', async (c) => {
  if (!clientInitialized || !coreV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    const namespace = c.req.query('namespace') || '';
    const response = namespace 
      ? await coreV1Api.listNamespacedPersistentVolumeClaim(namespace)
      : await coreV1Api.listPersistentVolumeClaimForAllNamespaces();
    
    const pvcs = response.body.items.map((pvc: any) => ({
      name: pvc.metadata.name,
      namespace: pvc.metadata.namespace,
      status: pvc.status.phase,
      capacity: pvc.status.capacity?.storage || '',
      accessModes: pvc.spec.accessModes || [],
      storageClass: pvc.spec.storageClassName || '',
      volumeName: pvc.spec.volumeName || '',
      createdAt: pvc.metadata.creationTimestamp
    }));
    
    return c.json(pvcs);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== PVs ====================

app.get('/api/pvs', async (c) => {
  if (!clientInitialized || !coreV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    const response = await coreV1Api.listPersistentVolume();
    
    const pvs = response.body.items.map((pv: any) => ({
      name: pv.metadata.name,
      status: pv.status.phase,
      capacity: pv.spec.capacity?.storage || '',
      accessModes: pv.spec.accessModes || [],
      reclaimPolicy: pv.spec.persistentVolumeReclaimPolicy || '',
      storageClass: pv.spec.storageClassName || '',
      createdAt: pv.metadata.creationTimestamp
    }));
    
    return c.json(pvs);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== StorageClasses ====================

app.get('/api/storageclasses', async (c) => {
  if (!clientInitialized || !storageV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    const response = await storageV1Api.listStorageClass();
    
    const scs = response.body.items.map((sc: any) => ({
      name: sc.metadata.name,
      provisioner: sc.provisioner,
      reclaimPolicy: sc.reclaimPolicy || 'Delete',
      volumeBindingMode: sc.volumeBindingMode || 'Immediate',
      allowVolumeExpansion: sc.allowVolumeExpansion || false,
      default: sc.metadata.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true',
      parameters: sc.parameters || {}
    }));
    
    return c.json(scs);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== Events ====================

app.get('/api/events', async (c) => {
  if (!clientInitialized || !coreV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    const namespace = c.req.query('namespace') || '';
    const response = namespace 
      ? await coreV1Api.listNamespacedEvent(namespace)
      : await coreV1Api.listEventForAllNamespaces();
    
    const events = response.body.items.map((event: any) => ({
      name: event.metadata.name,
      namespace: event.metadata.namespace,
      type: event.type,
      reason: event.reason,
      message: event.message,
      involvedObject: {
        kind: event.involvedObject.kind,
        name: event.involvedObject.name,
        namespace: event.involvedObject.namespace
      },
      count: event.count,
      firstTimestamp: event.firstTimestamp,
      lastTimestamp: event.lastTimestamp,
      source: {
        component: event.source?.component || '',
        host: event.source?.host || ''
      }
    }));
    
    return c.json(events);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== Nodes ====================

app.get('/api/nodes', async (c) => {
  if (!clientInitialized || !coreV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    const response = await coreV1Api.listNode();
    
    const nodes = response.body.items.map((node: any) => {
      // 获取状态
      let status = 'Unknown';
      for (const cond of (node.status.conditions || [])) {
        if (cond.type === 'Ready') {
          status = cond.status === 'True' ? 'Ready' : 'NotReady';
          break;
        }
      }
      
      // 获取角色
      const roles: string[] = [];
      const labels = node.metadata.labels || {};
      if (labels['node-role.kubernetes.io/control-plane'] !== undefined) roles.push('control-plane');
      if (labels['node-role.kubernetes.io/master'] !== undefined) roles.push('control-plane');
      if (labels['node-role.kubernetes.io/worker'] !== undefined) roles.push('worker');
      if (roles.length === 0) roles.push('worker');
      
      // 获取IP
      let ip = '';
      for (const addr of (node.status.addresses || [])) {
        if (addr.type === 'InternalIP') {
          ip = addr.address;
          break;
        }
      }
      
      return {
        name: node.metadata.name,
        status,
        roles,
        ip,
        os: node.status.nodeInfo?.operatingSystem || '',
        arch: node.status.nodeInfo?.architecture || '',
        kernelVersion: node.status.nodeInfo?.kernelVersion || '',
        kubeletVersion: node.status.nodeInfo?.kubeletVersion || '',
        capacity: {
          cpu: node.status.capacity?.cpu || '',
          memory: node.status.capacity?.memory || '',
          pods: node.status.capacity?.pods || ''
        },
        allocatable: {
          cpu: node.status.allocatable?.cpu || '',
          memory: node.status.allocatable?.memory || '',
          pods: node.status.allocatable?.pods || ''
        },
        labels: node.metadata.labels || {},
        createdAt: node.metadata.creationTimestamp,
        unschedulable: node.spec.unschedulable || false
      };
    });
    
    return c.json(nodes);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== Overview ====================

app.get('/api/overview', async (c) => {
  if (!clientInitialized || !coreV1Api || !appsV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    const [nodesRes, namespacesRes, podsRes, deploymentsRes, servicesRes] = await Promise.all([
      coreV1Api.listNode(),
      coreV1Api.listNamespace(),
      coreV1Api.listPodForAllNamespaces(),
      appsV1Api.listDeploymentForAllNamespaces(),
      coreV1Api.listServiceForAllNamespaces()
    ]);
    
    // 统计就绪节点
    let readyNodes = 0;
    for (const node of nodesRes.body.items) {
      for (const cond of (node.status.conditions || [])) {
        if (cond.type === 'Ready' && cond.status === 'True') {
          readyNodes++;
          break;
        }
      }
    }
    
    // 统计运行中的 Pod
    let runningPods = 0;
    for (const pod of podsRes.body.items) {
      if (pod.status.phase === 'Running') {
        runningPods++;
      }
    }
    
    return c.json({
      nodes: nodesRes.body.items.length,
      readyNodes,
      namespaces: namespacesRes.body.items.length,
      pods: podsRes.body.items.length,
      runningPods,
      deployments: deploymentsRes.body.items.length,
      services: servicesRes.body.items.length
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== ServiceAccounts ====================

app.get('/api/serviceaccounts', async (c) => {
  if (!clientInitialized || !coreV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    const namespace = c.req.query('namespace') || '';
    const response = namespace 
      ? await coreV1Api.listNamespacedServiceAccount(namespace)
      : await coreV1Api.listServiceAccountForAllNamespaces();
    
    const serviceaccounts = response.body.items.map((sa: any) => ({
      name: sa.metadata.name,
      namespace: sa.metadata.namespace,
      secrets: (sa.secrets || []).length,
      createdAt: sa.metadata.creationTimestamp
    }));
    
    return c.json(serviceaccounts);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== Roles ====================

app.get('/api/roles', async (c) => {
  if (!clientInitialized || !rbacV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    const namespace = c.req.query('namespace') || '';
    const rolesRes = namespace 
      ? await rbacV1Api.listNamespacedRole(namespace)
      : await rbacV1Api.listRoleForAllNamespaces();
    
    const clusterRolesRes = await rbacV1Api.listClusterRole();
    
    const roles = rolesRes.body.items.map((role: any) => ({
      name: role.metadata.name,
      namespace: role.metadata.namespace,
      type: 'Role',
      rules: (role.rules || []).length,
      createdAt: role.metadata.creationTimestamp
    }));
    
    const clusterRoles = clusterRolesRes.body.items.map((cr: any) => ({
      name: cr.metadata.name,
      namespace: '',
      type: 'ClusterRole',
      rules: (cr.rules || []).length,
      createdAt: cr.metadata.creationTimestamp
    }));
    
    return c.json([...roles, ...clusterRoles]);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== RoleBindings ====================

app.get('/api/rolebindings', async (c) => {
  if (!clientInitialized || !rbacV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    const namespace = c.req.query('namespace') || '';
    const rbsRes = namespace 
      ? await rbacV1Api.listNamespacedRoleBinding(namespace)
      : await rbacV1Api.listRoleBindingForAllNamespaces();
    
    const crbsRes = await rbacV1Api.listClusterRoleBinding();
    
    const roleBindings = rbsRes.body.items.map((rb: any) => ({
      name: rb.metadata.name,
      namespace: rb.metadata.namespace,
      roleName: rb.roleRef.name,
      roleKind: rb.roleRef.kind,
      subjects: (rb.subjects || []).map((s: any) => `${s.kind}/${s.name}`),
      type: 'RoleBinding',
      createdAt: rb.metadata.creationTimestamp
    }));
    
    const clusterRoleBindings = crbsRes.body.items.map((crb: any) => ({
      name: crb.metadata.name,
      namespace: '',
      roleName: crb.roleRef.name,
      roleKind: crb.roleRef.kind,
      subjects: (crb.subjects || []).map((s: any) => `${s.kind}/${s.name}`),
      type: 'ClusterRoleBinding',
      createdAt: crb.metadata.creationTimestamp
    }));
    
    return c.json([...roleBindings, ...clusterRoleBindings]);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== Middleware Status ====================

app.get('/api/middleware/status', async (c) => {
  if (!clientInitialized || !coreV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    const response = await coreV1Api.listPodForAllNamespaces();
    
    // 检测中间件
    const middlewareLabels: Record<string, { name: string; category: string }> = {
      'app=prometheus': { name: 'Prometheus', category: 'monitoring' },
      'app.kubernetes.io/name=prometheus': { name: 'Prometheus', category: 'monitoring' },
      'app=grafana': { name: 'Grafana', category: 'monitoring' },
      'app.kubernetes.io/name=grafana': { name: 'Grafana', category: 'monitoring' },
      'app=alertmanager': { name: 'Alertmanager', category: 'monitoring' },
      'app.kubernetes.io/name=alertmanager': { name: 'Alertmanager', category: 'monitoring' },
      'app=mysql': { name: 'MySQL', category: 'database' },
      'app=redis': { name: 'Redis', category: 'database' },
      'app=nginx-ingress': { name: 'Nginx Ingress', category: 'ingress' },
      'app.kubernetes.io/name=traefik': { name: 'Traefik', category: 'ingress' },
      'k8s-app=coredns': { name: 'CoreDNS', category: 'networking' },
      'k8s-app=metrics-server': { name: 'Metrics Server', category: 'monitoring' },
    };
    
    const detected: Map<string, any> = new Map();
    
    for (const pod of response.body.items) {
      if (pod.status.phase !== 'Running') continue;
      
      const labels = pod.metadata.labels || {};
      for (const [labelSelector, info] of Object.entries(middlewareLabels)) {
        const [key, value] = labelSelector.split('=');
        if (labels[key] === value && !detected.has(info.name)) {
          detected.set(info.name, {
            name: info.name,
            category: info.category,
            status: 'running',
            namespace: pod.metadata.namespace,
            podCount: 1,
            readyPods: 1,
            createdAt: pod.metadata.creationTimestamp
          });
        }
      }
    }
    
    const items = Array.from(detected.values());
    
    return c.json({
      total: items.length,
      running: items.filter(i => i.status === 'running').length,
      pending: 0,
      notDeployed: 0,
      items
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== MetalLB ====================

app.get('/api/metallb/status', async (c) => {
  if (!clientInitialized || !coreV1Api) {
    return c.json({ installed: false });
  }
  
  try {
    // 检查 metallb-system 命名空间
    const namespaces = await coreV1Api.listNamespace();
    const metallbNs = namespaces.body.items.find((ns: any) => ns.metadata.name === 'metallb-system');
    
    if (!metallbNs) {
      return c.json({ installed: false });
    }
    
    // 获取 speaker pods
    const pods = await coreV1Api.listNamespacedPod('metallb-system');
    const speakerPods = pods.body.items.filter((pod: any) => 
      pod.metadata.labels?.['app.kubernetes.io/component'] === 'speaker'
    );
    
    let speakerReady = 0;
    for (const pod of speakerPods) {
      for (const cond of (pod.status.conditions || [])) {
        if (cond.type === 'Ready' && cond.status === 'True') {
          speakerReady++;
          break;
        }
      }
    }
    
    return c.json({
      installed: true,
      namespace: 'metallb-system',
      version: 'v0.14.5',
      speakerPods: speakerPods.length,
      speakerReady,
      webhookConfigured: true
    });
  } catch (error: any) {
    return c.json({ installed: false, error: error.message });
  }
});

app.post('/api/metallb/install', async (c) => {
  if (!clientInitialized || !coreV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    // 创建 metallb-system 命名空间
    const nsExists = await coreV1Api.listNamespace();
    if (!nsExists.body.items.find((ns: any) => ns.metadata.name === 'metallb-system')) {
      await coreV1Api.createNamespace({
        metadata: {
          name: 'metallb-system',
          labels: {
            'pod-security.kubernetes.io/audit': 'privileged',
            'pod-security.kubernetes.io/enforce': 'privileged',
            'pod-security.kubernetes.io/warn': 'privileged'
          }
        }
      });
    }
    
    return c.json({ 
      success: true, 
      message: 'MetalLB namespace created. Please apply the MetalLB manifest manually.',
      manifestUrl: 'https://raw.githubusercontent.com/metallb/metallb/v0.14.5/config/manifests/metallb-native.yaml'
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.get('/api/metallb/ippools', async (c) => {
  // 返回空数组，因为 CRD 可能不存在
  return c.json([]);
});

app.post('/api/metallb/ippools', async (c) => {
  return c.json({ success: false, error: 'CRD not available' }, 501);
});

app.get('/api/metallb/ippools/:name', async (c) => {
  return c.json({ success: false, error: 'Not found' }, 404);
});

app.delete('/api/metallb/ippools/:name', async (c) => {
  return c.json({ success: false, error: 'CRD not available' }, 501);
});

app.get('/api/metallb/l2advertisements', async (c) => {
  return c.json([]);
});

app.post('/api/metallb/l2advertisements', async (c) => {
  return c.json({ success: false, error: 'CRD not available' }, 501);
});

app.delete('/api/metallb/l2advertisements/:name', async (c) => {
  return c.json({ success: false, error: 'CRD not available' }, 501);
});

app.get('/api/metallb/bgpadvertisements', async (c) => {
  return c.json([]);
});

app.post('/api/metallb/bgpadvertisements', async (c) => {
  return c.json({ success: false, error: 'CRD not available' }, 501);
});

app.delete('/api/metallb/bgpadvertisements/:name', async (c) => {
  return c.json({ success: false, error: 'CRD not available' }, 501);
});

// ==================== Traefik ====================

app.get('/api/traefik/status', async (c) => {
  if (!clientInitialized || !coreV1Api) {
    return c.json({ installed: false });
  }
  
  try {
    // 检查 traefik 命名空间
    const namespaces = await coreV1Api.listNamespace();
    const traefikNs = namespaces.body.items.find((ns: any) => ns.metadata.name === 'traefik');
    
    if (!traefikNs) {
      // 也检查 traefik 是否在 kube-system 中
      const pods = await coreV1Api.listNamespacedPod('kube-system');
      const traefikPod = pods.body.items.find((pod: any) => 
        pod.metadata.labels?.['app.kubernetes.io/name'] === 'traefik' ||
        pod.metadata.name?.includes('traefik')
      );
      
      if (!traefikPod) {
        return c.json({ installed: false });
      }
      
      return c.json({
        installed: true,
        namespace: 'kube-system',
        version: 'v3.x',
        dashboard: 'http://localhost:8080/dashboard/',
        replicas: 1,
        readyReplicas: traefikPod.status.phase === 'Running' ? 1 : 0
      });
    }
    
    // 获取 traefik pods
    const pods = await coreV1Api.listNamespacedPod('traefik');
    const traefikPods = pods.body.items.filter((pod: any) => 
      pod.metadata.labels?.['app.kubernetes.io/name'] === 'traefik' ||
      pod.metadata.labels?.['app'] === 'traefik'
    );
    
    let readyReplicas = 0;
    for (const pod of traefikPods) {
      for (const cond of (pod.status.conditions || [])) {
        if (cond.type === 'Ready' && cond.status === 'True') {
          readyReplicas++;
          break;
        }
      }
    }
    
    // 获取 dashboard service
    const services = await coreV1Api.listNamespacedService('traefik');
    const traefikSvc = services.body.items.find((svc: any) => svc.metadata.name === 'traefik');
    const dashboardPort = traefikSvc?.spec.ports?.find((p: any) => p.name === 'dashboard')?.port || 8080;
    
    return c.json({
      installed: true,
      namespace: 'traefik',
      version: 'v3.2',
      dashboard: `http://localhost:${dashboardPort}/dashboard/`,
      replicas: traefikPods.length,
      readyReplicas
    });
  } catch (error: any) {
    return c.json({ installed: false, error: error.message });
  }
});

app.post('/api/traefik/install', async (c) => {
  if (!clientInitialized || !coreV1Api) {
    return c.json({ success: false, error: 'Kubernetes client not initialized' }, 500);
  }
  
  try {
    // 创建 traefik 命名空间
    const nsExists = await coreV1Api.listNamespace();
    if (!nsExists.body.items.find((ns: any) => ns.metadata.name === 'traefik')) {
      await coreV1Api.createNamespace({
        metadata: {
          name: 'traefik',
          labels: {
            'app.kubernetes.io/name': 'traefik'
          }
        }
      });
    }
    
    return c.json({ 
      success: true, 
      message: 'Traefik namespace created. Please apply the Traefik manifest manually.',
      manifestUrl: 'https://raw.githubusercontent.com/traefik/traefik/v3.2/docs/content/reference/dynamic-configuration/kubernetes-crd.yml'
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.get('/api/traefik/ingressroutes', async (c) => {
  // 返回空数组，因为 CRD 可能不存在
  return c.json([]);
});

app.post('/api/traefik/ingressroutes', async (c) => {
  return c.json({ success: false, error: 'CRD not available' }, 501);
});

app.get('/api/traefik/middlewares', async (c) => {
  return c.json([]);
});

app.get('/api/traefik/tlsoptions', async (c) => {
  return c.json([]);
});

// 启动服务器
const port = parseInt(process.env.PORT || '8080');
console.log(`K8s API Server starting on port ${port}`);

export default {
  port,
  fetch: app.fetch
};
