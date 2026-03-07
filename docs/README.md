# KubeNext - Kubernetes 管理平台

> 基于 Next.js 16 + Go 1.26 构建的现代化 Kubernetes 集群管理平台

---

## 目录

- [项目概述](#项目概述)
- [技术架构](#技术架构)
- [快速开始](#快速开始)
- [功能模块](#功能模块)
- [API 参考](#api-参考)
- [开发指南](#开发指南)
- [部署指南](#部署指南)

---

## 项目概述

KubeNext 是一个功能完整的 Kubernetes 管理平台，提供：

- **集群管理**：多集群接入、节点管理、命名空间管理
- **工作负载管理**：Deployment、StatefulSet、DaemonSet、Job、CronJob、ReplicaSet、HPA
- **容器管理**：Pod 查看、日志、终端、YAML 编辑
- **网络管理**：Service、Ingress、负载均衡器
- **存储管理**：PV、PVC、StorageClass
- **配置管理**：ConfigMap、Secret
- **应用商店**：Helm Chart 一键部署
- **监控告警**：Prometheus + Grafana 集成

---

## 技术架构

### 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| **前端框架** | Next.js | 16.x |
| **UI 库** | React | 19.x |
| **语言** | TypeScript | 5.x |
| **样式** | Tailwind CSS | 4.x |
| **组件库** | shadcn/ui | - |
| **状态管理** | TanStack Query | 5.x |
| **后端语言** | Go | 1.26.0 |
| **K8s 客户端** | client-go | v0.35.2 |
| **Web 框架** | Gin | 1.10.x |
| **数据库** | SQLite + Prisma | - |

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户浏览器                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js 前端 (3000)                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Dashboard│ │ Workloads│ │ Services│ │ Storage │ │  Helm   │   │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘   │
│       └──────────┴──────────┴──────────┴──────────┘             │
│                          │ API Proxy                            │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Go 后端服务 (8080)                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Gin Router                            │   │
│  │  /api/pods  /api/deployments  /api/services  /api/helm  │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│  ┌─────────────────────────┴───────────────────────────────┐   │
│  │                   K8s Client (client-go)                 │   │
│  └─────────────────────────┬───────────────────────────────┘   │
└────────────────────────────┼────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Kubernetes 集群 (k3s)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │Prometheus│ │ Grafana  │ │  MySQL   │ │  Redis   │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 快速开始

### 环境要求

- Go 1.26.0+
- Node.js 18+ / Bun
- kubectl (可选，用于调试)
- Kubernetes 集群 (k3s/minikube/kind)

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/anhao-bo/k8s-manager.git
cd k8s-manager

# 2. 安装前端依赖
bun install

# 3. 编译后端服务
cd mini-services/k8s-service
go mod tidy
go build -o k8s-service .
cd ../..

# 4. 配置 kubeconfig
# 将 kubeconfig 文件放到 mini-services/k8s-service/.kube/config

# 5. 启动后端服务
cd mini-services/k8s-service
./k8s-service &

# 6. 启动前端开发服务器
bun run dev
```

### 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端界面 | http://localhost:3000 | KubeNext 管理界面 |
| 后端 API | http://localhost:8080/api | RESTful API |
| 健康检查 | http://localhost:8080/health | 服务状态 |

---

## 功能模块

### 1. 集群管理

#### 支持的资源类型

| 资源 | 功能 |
|------|------|
| **Nodes** | 节点列表、详情、Cordon/Uncordon/Drain |
| **Namespaces** | 创建、删除、查看资源统计 |
| **Events** | 集群事件查看 |

### 2. 工作负载管理

#### 支持的控制器

| 控制器 | 创建 | 删除 | 扩缩容 | 重启 | YAML |
|--------|------|------|--------|------|------|
| Deployment | ✅ | ✅ | ✅ | ✅ | ✅ |
| StatefulSet | ✅ | ✅ | - | - | ✅ |
| DaemonSet | ✅ | ✅ | - | - | ✅ |
| Job | ✅ | ✅ | - | - | ✅ |
| CronJob | ✅ | ✅ | - | - | ✅ |
| ReplicaSet | - | ✅ | - | - | ✅ |
| HPA | - | ✅ | - | - | ✅ |

#### 控制器架构

```
┌──────────────────────────────────────────────────────────────┐
│                      Deployment 架构                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│    ┌────────────┐                                            │
│    │ Deployment │                                            │
│    └─────┬──────┘                                            │
│          │ 创建/管理                                          │
│          ▼                                                   │
│    ┌────────────┐                                            │
│    │ ReplicaSet │  (每个版本一个)                              │
│    └─────┬──────┘                                            │
│          │ 创建/管理                                          │
│          ▼                                                   │
│    ┌────────────┐                                            │
│    │    Pod     │  (实际运行的副本)                            │
│    └────────────┘                                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3. Pod 管理

- Pod 列表查看（支持命名空间筛选）
- Pod 详情（容器状态、事件）
- 实时日志查看
- Web 终端 (WebSocket)
- YAML 查看/编辑（使用 client-go 原生方法）

### 4. 网络管理

| 资源 | 功能 |
|------|------|
| **Service** | 列表查看、类型识别 |
| **Ingress** | 路由规则管理 |
| **LoadBalancer** | 负载均衡器管理 |

### 5. 存储管理

| 资源 | 功能 |
|------|------|
| **PV** | 持久卷列表、状态查看 |
| **PVC** | 持久卷声明管理 |
| **StorageClass** | 存储类管理 |

### 6. 配置管理

| 资源 | 功能 |
|------|------|
| **ConfigMap** | 创建、删除、编辑 |
| **Secret** | 查看、删除 |

---

## API 参考

### 核心 API

```
# 集群状态
GET  /api/status           # 集群连接状态
GET  /api/overview         # 集群概览

# 节点
GET  /api/nodes            # 节点列表
GET  /api/nodes/:name      # 节点详情
POST /api/nodes/:name/cordon   # 停止调度
POST /api/nodes/:name/uncordon # 恢复调度
POST /api/nodes/:name/drain    # 驱逐 Pod

# 命名空间
GET  /api/namespaces       # 命名空间列表
POST /api/namespaces       # 创建命名空间
DELETE /api/namespaces/:name  # 删除命名空间

# Pods
GET  /api/pods             # Pod 列表
POST /api/pods             # 创建 Pod
DELETE /api/pods           # 删除 Pod
GET  /api/pods/yaml        # 获取 Pod YAML
PUT  /api/pods/yaml        # 更新 Pod YAML
GET  /api/pods/logs        # 获取 Pod 日志

# Deployments
GET  /api/deployments      # Deployment 列表
POST /api/deployments      # 创建 Deployment
DELETE /api/deployments    # 删除 Deployment
POST /api/deployments/scale    # 扩缩容
POST /api/deployments/restart  # 重启

# StatefulSets
GET  /api/statefulsets     # StatefulSet 列表
POST /api/statefulsets     # 创建 StatefulSet
DELETE /api/statefulsets   # 删除 StatefulSet

# DaemonSets
GET  /api/daemonsets       # DaemonSet 列表
POST /api/daemonsets       # 创建 DaemonSet
DELETE /api/daemonsets     # 删除 DaemonSet

# Jobs
GET  /api/jobs             # Job 列表
POST /api/jobs             # 创建 Job
DELETE /api/jobs           # 删除 Job

# CronJobs
GET  /api/cronjobs         # CronJob 列表
POST /api/cronjobs         # 创建 CronJob
DELETE /api/cronjobs       # 删除 CronJob

# ReplicaSets
GET  /api/replicasets      # ReplicaSet 列表
DELETE /api/replicasets    # 删除 ReplicaSet

# HPAs
GET  /api/hpas             # HPA 列表
DELETE /api/hpas           # 删除 HPA

# Services
GET  /api/services         # Service 列表

# Ingress
GET  /api/ingresses        # Ingress 列表

# 存储
GET  /api/pvcs             # PVC 列表
GET  /api/pvs              # PV 列表
GET  /api/storageclasses   # StorageClass 列表

# 配置
GET  /api/configmaps       # ConfigMap 列表
POST /api/configmaps       # 创建 ConfigMap
DELETE /api/configmaps     # 删除 ConfigMap
GET  /api/secrets          # Secret 列表
DELETE /api/secrets        # 删除 Secret

# WebSocket
GET  /api/ws/exec          # Pod 终端
```

---

## 开发指南

### 项目结构

```
k8s-manager/
├── src/                          # Next.js 前端
│   ├── app/
│   │   ├── page.tsx              # 主页面
│   │   ├── layout.tsx            # 布局
│   │   └── api/                  # API 路由
│   ├── components/
│   │   ├── ui/                   # shadcn/ui 组件
│   │   └── pages/                # 页面组件
│   ├── hooks/
│   │   └── use-k8s.ts            # K8s 数据 Hooks
│   └── lib/
│       └── utils.ts              # 工具函数
│
├── mini-services/
│   └── k8s-service/              # Go 后端服务
│       ├── main.go               # 入口
│       ├── go.mod                # Go 模块定义
│       ├── internal/
│       │   ├── handlers/         # HTTP 处理器
│       │   ├── k8s/              # K8s 客户端封装
│       │   ├── helm/             # Helm 客户端
│       │   ├── models/           # 数据模型
│       │   └── router/           # 路由配置
│       └── .kube/                # kubeconfig 配置
│
├── prisma/                       # 数据库 Schema
├── docs/                         # 文档
└── db/                           # SQLite 数据库
```

### 代码规范

#### Go 命名规范

```go
// ✅ 正确：驼峰命名，导出函数首字母大写
func GetPods(namespace string) ([]PodInfo, error) { ... }

// ✅ 正确：私有函数首字母小写
func validateRequest(req *CreatePodRequest) error { ... }

// ✅ 正确：构造函数使用 New 前缀
func NewClient(config *Config) (*Client, error) { ... }
```

#### TypeScript 命名规范

```typescript
// ✅ 正确：组件使用 PascalCase
export function DeploymentList() { ... }

// ✅ 正确：自定义 Hook 使用 use 前缀
export function useDeployments(namespace: string) { ... }

// ✅ 正确：常量使用 UPPER_SNAKE_CASE
export const DEFAULT_TIMEOUT_MS = 30000;
```

### Git 提交规范

```
<type>(<scope>): <subject>

# 示例
feat(deployments): add deployment create API
fix(pods): correct yaml update logic
docs: update README
refactor(client): use client-go native methods
```

---

## 部署指南

### 监控系统部署

```bash
# 安装 kube-prometheus-stack
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.retention=15d \
  --set grafana.service.type=NodePort
```

### 资源需求

| 环境 | CPU | 内存 | 存储 |
|------|-----|------|------|
| 开发环境 | 2核 | 4GB | 20GB |
| 小型集群 (<10节点) | 4核 | 8GB | 100GB |
| 中型集群 (10-50节点) | 8核 | 16GB | 300GB |

---

## 监控指标

### 核心指标

| 指标 | Prometheus 表达式 |
|------|------------------|
| 节点 CPU | `100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)` |
| 节点内存 | `(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100` |
| Pod CPU | `sum(rate(container_cpu_usage_seconds_total{container!=""}[5m])) by (pod)` |
| Pod 内存 | `sum(container_memory_working_set_bytes{container!=""}) by (pod)` |

### 关键告警规则

```yaml
groups:
  - name: kubernetes
    rules:
      - alert: NodeHighCPU
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "节点 CPU 使用率过高"
          
      - alert: PodCrashLooping
        expr: increase(kube_pod_container_status_restarts_total[1h]) > 5
        for: 5m
        labels:
          severity: warning
```

---

## 更新日志

### v1.0.0 (2026-03-07)

- ✅ 完整的 K8s 资源管理功能
- ✅ 支持 Deployment、StatefulSet、DaemonSet、Job、CronJob、ReplicaSet、HPA
- ✅ Pod 终端、日志、YAML 编辑
- ✅ 使用 client-go 原生方法替代 kubectl 命令
- ✅ Go 1.26 + k8s.io/client-go v0.35.2
- ✅ Next.js 16 + React 19

---

## License

MIT License
