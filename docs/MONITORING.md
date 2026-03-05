# Kubernetes 监控体系架构

## 一、监控中间件部署清单

### 核心组件 (必选)

| 组件 | 版本 | 用途 | 资源需求 |
|-----|-----|-----|---------|
| **Prometheus** | v3.x | 指标采集与存储 | 2CPU/4GB/50GB |
| **Grafana** | v11.x | 可视化大屏 | 1CPU/2GB/10GB |
| **Alertmanager** | v0.28+ | 告警路由 | 0.5CPU/1GB/10GB |

### 数据采集层 (必选)

| 组件 | 用途 | 部署方式 |
|-----|-----|---------|
| **node-exporter** | 节点指标采集 | DaemonSet |
| **kube-state-metrics** | K8s 对象状态 | Deployment |
| **cAdvisor** (内置) | 容器指标 | kubelet 内置 |

### 日志系统 (可选)

| 组件 | 版本 | 用途 | 资源需求 |
|-----|-----|-----|---------|
| **Loki** | v3.x | 日志聚合 | 2CPU/4GB/100GB |
| **Promtail** | v3.x | 日志采集 | DaemonSet |

### 链路追踪 (可选)

| 组件 | 版本 | 用途 | 资源需求 |
|-----|-----|-----|---------|
| **Jaeger** | v2.x | 分布式追踪 | 2CPU/4GB/50GB |
| **OpenTelemetry Collector** | v0.100+ | 遥测数据采集 | 1CPU/2GB |

---

## 二、快速部署方案 (推荐)

### 方案一：kube-prometheus-stack (一键部署)

```bash
# 添加 Helm 仓库
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# 安装完整监控栈
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.retention=15d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi \
  --set alertmanager.alertmanagerSpec.storage.volumeClaimTemplate.spec.resources.requests.storage=10Gi \
  --set grafana.persistence.size=10Gi
```

包含组件：
- ✅ Prometheus
- ✅ Alertmanager  
- ✅ Grafana
- ✅ node-exporter
- ✅ kube-state-metrics
- ✅ 预置 Dashboard

### 方案二：Loki 日志栈

```bash
helm repo add grafana https://grafana.github.io/helm-charts

helm install loki grafana/loki-stack \
  --namespace logging \
  --create-namespace \
  --set promtail.enabled=true
```

---

## 三、监控指标体系

### 1. 节点监控

| 指标 | Prometheus 表达式 | 说明 |
|-----|------------------|-----|
| CPU 使用率 | `100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)` | 节点 CPU |
| 内存使用率 | `(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100` | 节点内存 |
| 磁盘使用率 | `(1 - node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"} / node_filesystem_size_bytes{fstype!~"tmpfs|overlay"}) * 100` | 磁盘容量 |
| 网络流量 | `irate(node_network_receive_bytes_total[5m])` | 网络接收 |

### 2. 容器监控

| 指标 | Prometheus 表达式 | 说明 |
|-----|------------------|-----|
| 容器 CPU | `sum(rate(container_cpu_usage_seconds_total{container!=""}[5m])) by (pod, namespace)` | Pod CPU |
| 容器内存 | `sum(container_memory_working_set_bytes{container!=""}) by (pod, namespace)` | Pod 内存 |
| 容器重启 | `increase(kube_pod_container_status_restarts_total[1h])` | 重启次数 |

### 3. K8s 对象监控

| 指标 | Prometheus 表达式 | 说明 |
|-----|------------------|-----|
| Pod 状态 | `kube_pod_status_phase` | Pod 运行状态 |
| Deployment 副本 | `kube_deployment_status_replicas_available / kube_deployment_spec_replicas` | 副本可用率 |
| PVC 使用 | `kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes` | 存储使用率 |

---

## 四、告警规则配置

### 关键告警规则

```yaml
# alerting-rules.yaml
groups:
  - name: kubernetes
    rules:
      # 节点告警
      - alert: NodeHighCPU
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "节点 CPU 使用率过高"
          
      - alert: NodeHighMemory
        expr: (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100 > 85
        for: 5m
        labels:
          severity: warning
          
      - alert: NodeDiskPressure
        expr: (1 - node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"} / node_filesystem_size_bytes{fstype!~"tmpfs|overlay"}) * 100 > 85
        for: 5m
        labels:
          severity: critical

      # Pod 告警
      - alert: PodCrashLooping
        expr: increase(kube_pod_container_status_restarts_total[1h]) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Pod 频繁重启"
          
      - alert: PodNotReady
        expr: kube_pod_status_phase{phase=~"Pending|Unknown"} > 0
        for: 10m
        labels:
          severity: warning

      # 存储告警
      - alert: PVCAlmostFull
        expr: kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes * 100 > 85
        for: 5m
        labels:
          severity: critical
```

---

## 五、推荐部署架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        KubeNext 管理平台                          │
│                     (Next.js 前端 + Go 后端)                       │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  Prometheus   │     │   Grafana     │     │    Loki       │
│   :9090       │     │    :3000      │     │    :3100      │
│  指标存储      │────▶│  可视化大屏   │     │   日志存储     │
└───────┬───────┘     └───────────────┘     └───────┬───────┘
        │                                           │
        │         ┌─────────────────┐               │
        └────────▶│  Alertmanager   │◀──────────────┘
                  │     :9093       │
                  │    告警路由      │
                  └────────┬────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   ┌──────────┐     ┌──────────┐     ┌──────────┐
   │  钉钉    │     │  邮件    │     │  企业微信 │
   │ Webhook  │     │  SMTP    │     │ Webhook  │
   └──────────┘     └──────────┘     └──────────┘
```

---

## 六、快速启动命令汇总

```bash
# 1. 创建命名空间
kubectl create namespace monitoring

# 2. 安装 kube-prometheus-stack (推荐)
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set grafana.service.type=NodePort \
  --set prometheus.service.type=NodePort \
  --set alertmanager.service.type=NodePort

# 3. 查看服务
kubectl get pods -n monitoring
kubectl get svc -n monitoring

# 4. 访问 Grafana (默认用户: admin/prom-operator)
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80

# 5. 访问 Prometheus
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
```

---

## 七、资源需求汇总

| 环境 | CPU | 内存 | 存储 |
|-----|-----|------|------|
| **小型集群** (< 10节点) | 4核 | 8GB | 100GB |
| **中型集群** (10-50节点) | 8核 | 16GB | 300GB |
| **大型集群** (50+节点) | 16核 | 32GB | 500GB+ |

---

## 八、与 KubeNext 集成

KubeNext 平台可以通过以下方式集成监控：

1. **嵌入 Grafana Dashboard** - iframe 嵌入预置 Dashboard
2. **Prometheus API 查询** - 直接查询指标数据展示
3. **Alertmanager Webhook** - 接收告警推送
4. **自定义 Dashboard** - 使用前端图表库展示关键指标
