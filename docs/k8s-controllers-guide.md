# Kubernetes 控制器机制深度解析

## 目录

1. [概述](#1-概述)
2. [控制器类型研究](#2-控制器类型研究)
3. [Service 创建规则](#3-service-创建规则)
4. [标签选择器机制](#4-标签选择器机制)
5. [控制器与 Pod 的关系](#5-控制器与-pod-的关系)
6. [API 结构研究](#6-api-结构研究)
7. [控制器最佳实践](#7-控制器最佳实践)
8. [代码示例](#8-代码示例)

---

## 1. 概述

Kubernetes 控制器是集群的核心组件，负责维护集群的期望状态。控制器通过**控制循环（Control Loop）**机制，持续监控集群的实际状态，并将其调整为期望状态。

### 1.1 控制器工作原理

```
┌─────────────────────────────────────────────────────────────────┐
│                        控制器工作流程                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    ┌──────────┐    Watch     ┌──────────────┐                  │
│    │  API     │ ──────────▶  │   控制器      │                  │
│    │  Server  │ ◀────────── │              │                  │
│    └──────────┘    Reconcile └──────────────┘                  │
│         │                              │                        │
│         │                              │                        │
│         ▼                              ▼                        │
│    ┌──────────────────────────────────────────┐                │
│    │              期望状态 (Spec)               │                │
│    │              实际状态 (Status)             │                │
│    └──────────────────────────────────────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 控制器核心概念

| 概念 | 说明 |
|------|------|
| **期望状态 (Desired State)** | 用户通过 YAML/JSON 定义的目标状态 |
| **实际状态 (Current State)** | 集群中资源的真实状态 |
| **调和 (Reconcile)** | 将实际状态调整为期望状态的过程 |
| **控制器管理器** | 运行多个控制器的后台进程 |

---

## 2. 控制器类型研究

### 2.1 Deployment

**用途**：管理无状态应用，支持滚动更新和回滚。

#### 架构图

```
┌──────────────────────────────────────────────────────────────┐
│                      Deployment 架构                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│    ┌────────────┐                                            │
│    │ Deployment │                                            │
│    │  (1 个)    │                                            │
│    └─────┬──────┘                                            │
│          │ 创建/管理                                          │
│          ▼                                                   │
│    ┌────────────┐                                            │
│    │ ReplicaSet │  (每个版本一个)                              │
│    │  (N 个)    │                                            │
│    └─────┬──────┘                                            │
│          │ 创建/管理                                          │
│          ▼                                                   │
│    ┌────────────┐                                            │
│    │    Pod     │  (实际运行的副本)                            │
│    │  (N 个)    │                                            │
│    └────────────┘                                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### 核心源码结构 (Go)

```go
// k8s.io/api/apps/v1/types.go

type Deployment struct {
    metav1.TypeMeta
    metav1.ObjectMeta
    
    Spec   DeploymentSpec
    Status DeploymentStatus
}

type DeploymentSpec struct {
    Replicas *int32                    // 期望副本数
    Selector *metav1.LabelSelector     // 标签选择器
    Template corev1.PodTemplateSpec    // Pod 模板
    Strategy DeploymentStrategy        // 更新策略
    
    // 滚动更新配置
    RollingUpdate *RollingUpdateDeployment
    MinReadySeconds int32
    RevisionHistoryLimit *int32
    Paused bool
    ProgressDeadlineSeconds *int32
}

type DeploymentStatus struct {
    ObservedGeneration  int64
    Replicas            int32
    UpdatedReplicas     int32
    ReadyReplicas       int32
    AvailableReplicas   int32
    UnavailableReplicas int32
    Conditions          []DeploymentCondition
    CollisionCount      *int32
}
```

#### 更新策略

```yaml
spec:
  strategy:
    type: RollingUpdate  # 或 Recreate
    rollingUpdate:
      maxSurge: 1        # 滚动更新时最多可以超出期望副本数的数量
      maxUnavailable: 0  # 滚动更新时最多不可用的副本数
```

| 策略 | 说明 |
|------|------|
| **RollingUpdate** | 渐进式更新，先创建新 Pod 再删除旧 Pod |
| **Recreate** | 先删除所有旧 Pod，再创建新 Pod |

---

### 2.2 StatefulSet

**用途**：管理有状态应用，提供稳定的网络标识和持久化存储。

#### 架构图

```
┌──────────────────────────────────────────────────────────────┐
│                    StatefulSet 架构                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│    ┌──────────────┐      ┌──────────────────┐               │
│    │ StatefulSet  │◀────▶│ Headless Service │               │
│    └──────┬───────┘      └────────┬─────────┘               │
│           │                       │                          │
│           │ 管理                   │ 提供网络标识              │
│           ▼                       ▼                          │
│    ┌──────────────┐      ┌──────────────────┐               │
│    │     Pod      │◀────▶│  stable-network  │               │
│    │ web-0, web-1 │      │   identity       │               │
│    └──────┬───────┘      └──────────────────┘               │
│           │                                                   │
│           │ 绑定                                               │
│           ▼                                                   │
│    ┌──────────────┐                                          │
│    │     PVC      │  (每个 Pod 独立的持久卷)                    │
│    │ web-0, web-1 │                                          │
│    └──────────────┘                                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### 核心源码结构

```go
type StatefulSet struct {
    metav1.TypeMeta
    metav1.ObjectMeta
    Spec   StatefulSetSpec
    Status StatefulSetStatus
}

type StatefulSetSpec struct {
    Replicas        *int32
    Selector        *metav1.LabelSelector
    Template        corev1.PodTemplateSpec
    VolumeClaimTemplates []corev1.PersistentVolumeClaim  // PVC 模板
    ServiceName     string                               // Headless Service 名称
    PodManagementPolicy PodManagementPolicyType          // Pod 管理策略
    UpdateStrategy StatefulSetUpdateStrategy             // 更新策略
    RevisionHistoryLimit *int32
    MinReadySeconds int32
    PersistentVolumeClaimRetentionPolicy *StatefulSetPersistentVolumeClaimRetentionPolicy
}

type StatefulSetStatus struct {
    ObservedGeneration int64
    Replicas           int32
    ReadyReplicas      int32
    CurrentReplicas    int32
    UpdatedReplicas    int32
    CurrentRevision    string
    UpdateRevision     string
    CollisionCount     *int32
    Conditions         []StatefulSetCondition
    AvailableReplicas  int32
}
```

#### Headless Service 机制

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-headless
spec:
  clusterIP: None  # 关键：无 ClusterIP，即为 Headless
  selector:
    app: web
  ports:
  - port: 80
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: web
spec:
  serviceName: web-headless  # 关联 Headless Service
  replicas: 3
  # ...
```

**Pod 网络标识格式**：`<pod-name>.<service-name>.<namespace>.svc.cluster.local`

例如：`web-0.web-headless.default.svc.cluster.local`

---

### 2.3 DaemonSet

**用途**：确保每个节点运行一个 Pod 副本，常用于日志收集、监控代理等。

#### 架构图

```
┌──────────────────────────────────────────────────────────────┐
│                    DaemonSet 架构                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│    ┌──────────────┐                                          │
│    │  DaemonSet   │                                          │
│    └──────┬───────┘                                          │
│           │                                                   │
│           │ 每个节点一个 Pod                                   │
│           ▼                                                   │
│    ┌──────────────────────────────────────┐                  │
│    │                                      │                  │
│    │  Node1     Node2     Node3           │                  │
│    │  ┌───┐    ┌───┐    ┌───┐           │                  │
│    │  │Pod│    │Pod│    │Pod│           │                  │
│    │  └───┘    └───┘    └───┘           │                  │
│    │                                      │                  │
│    └──────────────────────────────────────┘                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### 核心源码结构

```go
type DaemonSet struct {
    metav1.TypeMeta
    metav1.ObjectMeta
    Spec   DaemonSetSpec
    Status DaemonSetStatus
}

type DaemonSetSpec struct {
    Selector         *metav1.LabelSelector
    Template         corev1.PodTemplateSpec
    UpdateStrategy   DaemonSetUpdateStrategy
    MinReadySeconds  int32
    RevisionHistoryLimit *int32
}

type DaemonSetStatus struct {
    CurrentNumberScheduled int32
    NumberMisscheduled     int32
    DesiredNumberScheduled int32
    NumberReady            int32
    ObservedGeneration     int64
    UpdatedNumberScheduled int32
    NumberAvailable        int32
    NumberUnavailable      int32
    CollisionCount         *int32
    Conditions             []DaemonSetCondition
}
```

#### 典型使用场景

| 场景 | 示例 |
|------|------|
| 日志收集 | Fluentd, Filebeat |
| 监控代理 | Node Exporter, cAdvisor |
| 网络插件 | Calico, Flannel, Cilium |
| 存储插件 | CSI Node Driver |

---

### 2.4 Job

**用途**：执行一次性任务，任务完成后停止。

#### 架构图

```
┌──────────────────────────────────────────────────────────────┐
│                       Job 架构                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│    ┌──────────────────────────────────────┐                  │
│    │                Job                    │                  │
│    │  completions: 3, parallelism: 2      │                  │
│    └───────────────┬──────────────────────┘                  │
│                    │                                          │
│                    │ 创建                                      │
│                    ▼                                          │
│    ┌──────────────────────────────────────┐                  │
│    │    Pod 1    Pod 2    Pod 3           │                  │
│    │   (运行)    (运行)    (等待)          │                  │
│    └──────────────────────────────────────┘                  │
│                                                              │
│    Job 模式:                                                  │
│    ┌────────────────┬────────────────────────────────┐       │
│    │ 单次 Job       │ completions=1, parallelism=1   │       │
│    │ 固定完成数 Job  │ completions=N, parallelism=M   │       │
│    │ 工作队列 Job    │ completions未设置, parallelism=N│       │
│    └────────────────┴────────────────────────────────┘       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### 核心源码结构

```go
type Job struct {
    metav1.TypeMeta
    metav1.ObjectMeta
    Spec   JobSpec
    Status JobStatus
}

type JobSpec struct {
    Parallelism             *int32                // 并行度
    Completions             *int32                // 完成次数
    ActiveDeadlineSeconds   *int64                // 最大运行时间
    BackoffLimit            *int32                // 失败重试次数
    Selector                *metav1.LabelSelector
    ManualSelector          *bool
    Template                corev1.PodTemplateSpec
    TTLSecondsAfterFinished *int32                // 完成后保留时间
    CompletionMode          CompletionMode
    Suspend                 *bool
}

type JobStatus struct {
    Conditions         []JobCondition
    StartTime          *metav1.Time
    CompletionTime     *metav1.Time
    Active             int32
    Succeeded          int32
    Failed             int32
    CompletedIndexes   string
    UncountedTerminatedUgs *UncountedTerminatedUgs
    Ready              *int32
}
```

---

### 2.5 CronJob

**用途**：定时执行任务，类似 Linux 的 crontab。

#### 架构图

```
┌──────────────────────────────────────────────────────────────┐
│                     CronJob 架构                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│    ┌──────────────────┐                                      │
│    │    CronJob       │                                      │
│    │  schedule: "* *" │                                      │
│    └────────┬─────────┘                                      │
│             │                                                 │
│             │ 定时触发                                         │
│             ▼                                                 │
│    ┌──────────────────┐                                      │
│    │      Job 1       │  ──▶  Pod(s)                         │
│    ├──────────────────┤                                      │
│    │      Job 2       │  ──▶  Pod(s)                         │
│    ├──────────────────┤                                      │
│    │      Job 3       │  ──▶  Pod(s)                         │
│    └──────────────────┘                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### 核心源码结构

```go
type CronJob struct {
    metav1.TypeMeta
    metav1.ObjectMeta
    Spec   CronJobSpec
    Status CronJobStatus
}

type CronJobSpec struct {
    Schedule                   string            // Cron 表达式
    TimeZone                   *string           // 时区
    StartingDeadlineSeconds    *int64            // 启动截止时间
    ConcurrencyPolicy          ConcurrencyPolicy // 并发策略
    Suspend                    *bool             // 是否暂停
    SuccessfulJobsHistoryLimit *int32            // 成功 Job 保留数量
    FailedJobsHistoryLimit     *int32            // 失败 Job 保留数量
    JobTemplate                JobTemplateSpec   // Job 模板
}

type CronJobStatus struct {
    Active                   []corev1.ObjectReference
    LastScheduleTime         *metav1.Time
    LastSuccessfulTime       *metav1.Time
}
```

#### Cron 表达式格式

```
┌───────────── 分钟 (0 - 59)
│ ┌───────────── 小时 (0 - 23)
│ │ ┌───────────── 日 (1 - 31)
│ │ │ ┌───────────── 月 (1 - 12)
│ │ │ │ ┌───────────── 周几 (0 - 6，0 为周日)
│ │ │ │ │
* * * * *
```

#### 并发策略

| 策略 | 说明 |
|------|------|
| `Allow` | 允许并发执行 |
| `Forbid` | 禁止并发，跳过新任务 |
| `Replace` | 取消当前任务，执行新任务 |

---

### 2.6 ReplicaSet

**用途**：维护 Pod 副本数量，通常由 Deployment 管理。

#### 核心源码结构

```go
type ReplicaSet struct {
    metav1.TypeMeta
    metav1.ObjectMeta
    Spec   ReplicaSetSpec
    Status ReplicaSetStatus
}

type ReplicaSetSpec struct {
    Replicas        *int32
    MinReadySeconds int32
    Selector        *metav1.LabelSelector
    Template        corev1.PodTemplateSpec
}

type ReplicaSetStatus struct {
    Replicas        int32
    FullyLabeledReplicas int32
    ReadyReplicas   int32
    AvailableReplicas int32
    ObservedGeneration int64
    Conditions      []ReplicaSetCondition
}
```

#### Deployment 与 ReplicaSet 关系

```
┌────────────────────────────────────────────────────────────┐
│                 Deployment 更新过程                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. 创建 Deployment                                        │
│     └─▶ 创建 ReplicaSet-v1 (replicas: 3)                  │
│          └─▶ 创建 3 个 Pod                                 │
│                                                            │
│  2. 更新镜像版本                                           │
│     └─▶ 创建 ReplicaSet-v2 (replicas: 1)                  │
│          └─▶ 创建 1 个新 Pod (新版本)                      │
│     └─▶ 缩减 ReplicaSet-v1 (replicas: 2)                  │
│          └─▶ 删除 1 个旧 Pod                               │
│                                                            │
│  3. 继续滚动更新...                                        │
│                                                            │
│  4. 更新完成                                               │
│     └─▶ ReplicaSet-v2 (replicas: 3)                       │
│     └─▶ ReplicaSet-v1 (replicas: 0, 保留用于回滚)         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 3. Service 创建规则

### 3.1 Deployment 与 Service

**重要结论：Deployment 不会自动创建 Service！**

```
┌──────────────────────────────────────────────────────────────┐
│              Deployment 与 Service 关系                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│    Deployment 和 Service 是独立的资源                         │
│                                                              │
│    ┌──────────────┐              ┌──────────────┐           │
│    │  Deployment  │              │   Service    │           │
│    │              │              │              │           │
│    │  selector:   │    匹配      │  selector:   │           │
│    │    app: web  │◀────────────▶│    app: web  │           │
│    └──────┬───────┘              └──────┬───────┘           │
│           │                             │                    │
│           │ 创建                         │ 选择               │
│           ▼                             ▼                    │
│    ┌──────────────┐              ┌──────────────┐           │
│    │     Pod      │◀─────────────│   Endpoints  │           │
│    │  labels:     │              │              │           │
│    │    app: web  │              │  自动关联     │           │
│    └──────────────┘              └──────────────┘           │
│                                                              │
│    必须手动创建 Service 来暴露 Deployment                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### 手动创建 Service 示例

```yaml
# Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: nginx:latest
        ports:
        - containerPort: 80
---
# 需要单独创建 Service
apiVersion: v1
kind: Service
metadata:
  name: web-service
spec:
  selector:
    app: web          # 必须与 Pod 标签匹配
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
```

### 3.2 StatefulSet 与 Headless Service

**StatefulSet 需要 Headless Service 来提供稳定的网络标识。**

```
┌──────────────────────────────────────────────────────────────┐
│           StatefulSet Headless Service 机制                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Headless Service (clusterIP: None) 不分配 ClusterIP          │
│                                                              │
│  DNS 记录格式:                                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ <pod-name>.<service-name>.<namespace>.svc.cluster.local│  │
│  │                                                        │  │
│  │ 例如: web-0.web-headless.default.svc.cluster.local    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  普通 Service vs Headless Service:                           │
│                                                              │
│  普通 Service:                                               │
│  ┌─────────────┐                                             │
│  │ ClusterIP   │ ──▶ 负载均衡 ──▶ Pod (随机选择)            │
│  │ 10.96.0.1   │                                             │
│  └─────────────┘                                             │
│                                                              │
│  Headless Service:                                           │
│  ┌─────────────┐                                             │
│  │ clusterIP:  │ ──▶ DNS 解析 ──▶ Pod (指定)                │
│  │    None     │     web-0 ──▶ Pod web-0 IP                 │
│  └─────────────┘     web-1 ──▶ Pod web-1 IP                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### Headless Service 创建示例

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-headless
spec:
  clusterIP: None    # 关键：设置为 None
  selector:
    app: web
  ports:
  - port: 80
    name: web
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: web
spec:
  serviceName: web-headless  # 关联 Headless Service
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: nginx:latest
        ports:
        - containerPort: 80
```

### 3.3 DaemonSet 与 Service

**DaemonSet 通常不需要 Service，但可以创建。**

```
┌──────────────────────────────────────────────────────────────┐
│              DaemonSet 与 Service 关系                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  DaemonSet 的典型场景:                                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 场景                    │ 是否需要 Service             │   │
│  ├─────────────────────────┼────────────────────────────┤   │
│  │ 日志收集 (Fluentd)      │ ❌ 不需要                    │   │
│  │ 监控代理 (Node Exporter)│ ❌ 不需要 (本地采集)         │   │
│  │ 网络插件 (CNI)          │ ❌ 不需要                    │   │
│  │ 存储插件 (CSI)          │ ❌ 不需要                    │   │
│  │ 代理服务 (Nginx Proxy)  │ ✅ 可能需要                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  如果需要暴露 DaemonSet:                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ • 使用 NodePort Service (每个节点暴露相同端口)         │   │
│  │ • 使用 HostNetwork: true (直接使用主机网络)            │   │
│  │ • 使用 hostPort (容器端口映射到主机)                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.4 Job/CronJob 与 Service

**Job 和 CronJob 通常不需要 Service。**

```
┌──────────────────────────────────────────────────────────────┐
│              Job/CronJob 与 Service 关系                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Job/CronJob 的特点:                                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ • 执行一次性或定时任务                                  │   │
│  │ • 任务完成后 Pod 终止                                   │   │
│  │ • 不需要持续对外提供服务                                │   │
│  │ • 通常不需要 Service                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  特殊情况 (可能需要 Service):                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ • Job 需要访问其他服务 (创建 Service 访问目标)          │   │
│  │ • Job 需要被其他服务访问 (极少数情况)                   │   │
│  │ • 多 Job 协作场景                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. 标签选择器机制

### 4.1 matchLabels vs matchExpressions

```
┌──────────────────────────────────────────────────────────────┐
│                   标签选择器类型                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. matchLabels (精确匹配)                                    │
│     ┌────────────────────────────────────────────────────┐  │
│     │ selector:                                          │  │
│     │   matchLabels:                                     │  │
│     │     app: web                                       │  │
│     │     environment: production                        │  │
│     └────────────────────────────────────────────────────┘  │
│     等价于: app=web AND environment=production              │
│                                                              │
│  2. matchExpressions (表达式匹配)                             │
│     ┌────────────────────────────────────────────────────┐  │
│     │ selector:                                          │  │
│     │   matchExpressions:                                │  │
│     │   - key: environment                               │  │
│     │     operator: In                                   │  │
│     │     values:                                        │  │
│     │     - production                                   │  │
│     │     - staging                                      │  │
│     │   - key: version                                   │  │
│     │     operator: Exists                               │  │
│     └────────────────────────────────────────────────────┘  │
│     等价于: environment IN (production, staging)            │
│             AND version EXISTS                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 操作符类型

| 操作符 | 说明 | 示例 |
|--------|------|------|
| `In` | 值在列表中 | `environment In [prod, staging]` |
| `NotIn` | 值不在列表中 | `environment NotIn [dev]` |
| `Exists` | 键存在 | `version Exists` |
| `DoesNotExist` | 键不存在 | `canary DoesNotExist` |

### 4.3 选择器与 Pod 模板标签关联

```
┌──────────────────────────────────────────────────────────────┐
│              标签选择器关联规则                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  关键规则:                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. selector.matchLabels 必须是 template.labels 的子集 │   │
│  │ 2. selector.matchExpressions 的结果必须匹配 template  │   │
│  │ 3. 创建后 selector 不可变                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  正确示例:                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ spec:                                                │   │
│  │   selector:                                          │   │
│  │     matchLabels:                                     │   │
│  │       app: web          # 必须在 template.labels 中   │   │
│  │   template:                                          │   │
│  │     metadata:                                        │   │
│  │       labels:                                        │   │
│  │         app: web          # 包含 selector 所有标签    │   │
│  │         version: v1       # 额外标签 (可选)           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  错误示例 (selector 不匹配 template):                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ spec:                                                │   │
│  │   selector:                                          │   │
│  │     matchLabels:                                     │   │
│  │       app: web                                       │   │
│  │       env: prod         # ❌ 不在 template.labels 中  │   │
│  │   template:                                          │   │
│  │     metadata:                                        │   │
│  │       labels:                                        │   │
│  │         app: web          # 缺少 env: prod           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.4 源码实现

```go
// metav1.LabelSelector 定义
type LabelSelector struct {
    MatchLabels      map[string]string
    MatchExpressions []LabelSelectorRequirement
}

type LabelSelectorRequirement struct {
    Key      string
    Operator LabelSelectorOperator
    Values   []string
}

// 选择器匹配实现 (简化版)
func SelectorMatches(selector *metav1.LabelSelector, labels map[string]string) bool {
    // 检查 matchLabels
    for key, value := range selector.MatchLabels {
        if labels[key] != value {
            return false
        }
    }
    
    // 检查 matchExpressions
    for _, expr := range selector.MatchExpressions {
        labelValue, exists := labels[expr.Key]
        
        switch expr.Operator {
        case metav1.LabelSelectorOpIn:
            if !contains(expr.Values, labelValue) {
                return false
            }
        case metav1.LabelSelectorOpNotIn:
            if contains(expr.Values, labelValue) {
                return false
            }
        case metav1.LabelSelectorOpExists:
            if !exists {
                return false
            }
        case metav1.LabelSelectorOpDoesNotExist:
            if exists {
                return false
            }
        }
    }
    
    return true
}
```

---

## 5. 控制器与 Pod 的关系

### 5.1 OwnerReferences 机制

```
┌──────────────────────────────────────────────────────────────┐
│                  OwnerReferences 机制                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  OwnerReferences 记录资源的所有者关系:                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    Deployment                         │   │
│  │ metadata:                                             │   │
│  │   name: web-app                                       │   │
│  │   uid: 12345-abcde                                    │   │
│  └───────────────────────┬──────────────────────────────┘   │
│                          │                                   │
│                          │ 创建                              │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    ReplicaSet                         │   │
│  │ metadata:                                             │   │
│  │   name: web-app-abc123                                │   │
│  │   ownerReferences:                                    │   │
│  │   - apiVersion: apps/v1                               │   │
│  │     kind: Deployment                                  │   │
│  │     name: web-app                                     │   │
│  │     uid: 12345-abcde                                  │   │
│  │     controller: true    # 标识主控制器                 │   │
│  │     blockOwnerDeletion: true                          │   │
│  └───────────────────────┬──────────────────────────────┘   │
│                          │                                   │
│                          │ 创建                              │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                       Pod                             │   │
│  │ metadata:                                             │   │
│  │   name: web-app-abc123-xyz789                         │   │
│  │   ownerReferences:                                    │   │
│  │   - apiVersion: apps/v1                               │   │
│  │     kind: ReplicaSet                                  │   │
│  │     name: web-app-abc123                              │   │
│  │     uid: 67890-fghij                                  │   │
│  │     controller: true                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 源码实现

```go
// metav1.OwnerReference 定义
type OwnerReference struct {
    APIVersion         string // 所有者的 API 版本
    Kind               string // 所有者的资源类型
    Name               string // 所有者的名称
    UID                types.UID // 所有者的唯一标识
    Controller         *bool  // 是否是控制器
    BlockOwnerDeletion *bool  // 是否阻止删除所有者
}

// 设置 OwnerReference 示例 (控制器创建 Pod 时)
func SetPodOwnerReference(pod *corev1.Pod, rs *appsv1.ReplicaSet) {
    pod.OwnerReferences = []metav1.OwnerReference{
        {
            APIVersion:         "apps/v1",
            Kind:               "ReplicaSet",
            Name:               rs.Name,
            UID:                rs.UID,
            Controller:         pointer.Bool(true),
            BlockOwnerDeletion: pointer.Bool(true),
        },
    }
}

// 检查 Pod 是否由控制器管理
func IsPodControlled(pod *corev1.Pod) bool {
    for _, owner := range pod.OwnerReferences {
        if owner.Controller != nil && *owner.Controller {
            return true
        }
    }
    return false
}

// 获取控制器信息
func GetController(pod *corev1.Pod) *metav1.OwnerReference {
    for _, owner := range pod.OwnerReferences {
        if owner.Controller != nil && *owner.Controller {
            return &owner
        }
    }
    return nil
}
```

### 5.3 GC（垃圾回收）机制

```
┌──────────────────────────────────────────────────────────────┐
│                    垃圾回收机制                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  级联删除策略:                                                │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 策略          │ 说明                                  │   │
│  ├───────────────┼──────────────────────────────────────┤   │
│  │ Foreground    │ 前景删除: 先删除从属资源,再删除所有者   │   │
│  │ Background    │ 后台删除: 立即删除所有者,异步删除从属   │   │
│  │ Orphan        │ 孤儿删除: 删除所有者,保留从属资源      │   │
│  └───────────────┴──────────────────────────────────────┘   │
│                                                              │
│  删除流程 (Foreground):                                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  1. 删除请求 (Deployment)                             │   │
│  │        │                                             │   │
│  │        ▼                                             │   │
│  │  2. 标记 Deployment 为 "deletionTimestamp"           │   │
│  │        │                                             │   │
│  │        ▼                                             │   │
│  │  3. 删除 ReplicaSet (从属资源)                        │   │
│  │        │                                             │   │
│  │        ▼                                             │   │
│  │  4. 删除 Pod (从属资源)                               │   │
│  │        │                                             │   │
│  │        ▼                                             │   │
│  │  5. 最终删除 Deployment                              │   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 5.4 删除策略配置

```go
// 设置删除策略
type DeleteOptions struct {
    GracePeriodSeconds *int64
    Preconditions      *Preconditions
    OrphanDependents   *bool
    PropagationPolicy  *DeletionPropagation
}

type DeletionPropagation string

const (
    DeletePropagationForeground DeletionPropagation = "Foreground"
    DeletePropagationBackground DeletionPropagation = "Background"
    DeletePropagationOrphan     DeletionPropagation = "Orphan"
)

// 使用示例
func DeleteDeploymentWithPolicy(client kubernetes.Interface, name, namespace string) error {
    policy := metav1.DeletePropagationForeground
    return client.AppsV1().Deployments(namespace).Delete(
        context.Background(),
        name,
        metav1.DeleteOptions{
            PropagationPolicy: &policy,
        },
    )
}
```

### 5.5 控制器管理 Pod 生命周期

```
┌──────────────────────────────────────────────────────────────┐
│                控制器管理 Pod 生命周期                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Deployment 控制器生命周期:                                    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  │  1. 创建阶段                                         │    │
│  │     ┌─────────┐    ┌─────────┐    ┌─────────┐      │    │
│  │     │创建 RS  │───▶│创建 Pod │───▶│等待就绪 │      │    │
│  │     └─────────┘    └─────────┘    └─────────┘      │    │
│  │                                                     │    │
│  │  2. 运行阶段                                         │    │
│  │     ┌─────────┐    ┌─────────┐    ┌─────────┐      │    │
│  │     │监控状态│◀──▶│维护副本数│◀──▶│健康检查 │      │    │
│  │     └─────────┘    └─────────┘    └─────────┘      │    │
│  │                                                     │    │
│  │  3. 更新阶段                                         │    │
│  │     ┌─────────┐    ┌─────────┐    ┌─────────┐      │    │
│  │     │创建新 RS│───▶│滚动更新 │───▶│清理旧 RS│      │    │
│  │     └─────────┘    └─────────┘    └─────────┘      │    │
│  │                                                     │    │
│  │  4. 删除阶段                                         │    │
│  │     ┌─────────┐    ┌─────────┐    ┌─────────┐      │    │
│  │     │删除 RS  │───▶│删除 Pod │───▶│清理完成 │      │    │
│  │     └─────────┘    └─────────┘    └─────────┘      │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. API 结构研究

### 6.1 Deployment API 结构

```go
// k8s.io/api/apps/v1/types.go

// DeploymentSpec 定义 Deployment 的期望状态
type DeploymentSpec struct {
    // 期望副本数 (默认 1)
    Replicas *int32 `json:"replicas,omitempty"`
    
    // 标签选择器 (必须设置，且必须匹配 template.labels)
    Selector *metav1.LabelSelector `json:"selector"`
    
    // Pod 模板
    Template corev1.PodTemplateSpec `json:"template"`
    
    // 更新策略
    Strategy DeploymentStrategy `json:"strategy,omitempty"`
    
    // 最小就绪秒数
    MinReadySeconds int32 `json:"minReadySeconds,omitempty"`
    
    // 历史版本保留数量 (默认 10)
    RevisionHistoryLimit *int32 `json:"revisionHistoryLimit,omitempty"`
    
    // 是否暂停部署
    Paused bool `json:"paused,omitempty"`
    
    // 部署超时时间 (秒)
    ProgressDeadlineSeconds *int32 `json:"progressDeadlineSeconds,omitempty"`
}

// DeploymentStrategy 更新策略
type DeploymentStrategy struct {
    Type DeploymentStrategyType `json:"type,omitempty"`
    
    // 滚动更新配置
    RollingUpdate *RollingUpdateDeployment `json:"rollingUpdate,omitempty"`
}

type RollingUpdateDeployment struct {
    // 最大激增数量 (可以是数字或百分比)
    MaxSurge *intstr.IntOrString `json:"maxSurge,omitempty"`
    
    // 最大不可用数量 (可以是数字或百分比)
    MaxUnavailable *intstr.IntOrString `json:"maxUnavailable,omitempty"`
}

// DeploymentStatus 定义 Deployment 的实际状态
type DeploymentStatus struct {
    // 观察到的代数
    ObservedGeneration int64 `json:"observedGeneration,omitempty"`
    
    // 副本总数
    Replicas int32 `json:"replicas,omitempty"`
    
    // 已更新的副本数
    UpdatedReplicas int32 `json:"updatedReplicas,omitempty"`
    
    // 就绪副本数
    ReadyReplicas int32 `json:"readyReplicas,omitempty"`
    
    // 可用副本数
    AvailableReplicas int32 `json:"availableReplicas,omitempty"`
    
    // 不可用副本数
    UnavailableReplicas int32 `json:"unavailableReplicas,omitempty"`
    
    // 状态条件
    Conditions []DeploymentCondition `json:"conditions,omitempty"`
    
    // 碰撞计数
    CollisionCount *int32 `json:"collisionCount,omitempty"`
}
```

### 6.2 StatefulSet API 结构

```go
// StatefulSetSpec 定义
type StatefulSetSpec struct {
    Replicas *int32 `json:"replicas,omitempty"`
    Selector *metav1.LabelSelector `json:"selector"`
    Template corev1.PodTemplateSpec `json:"template"`
    
    // PVC 模板 (关键特性)
    VolumeClaimTemplates []corev1.PersistentVolumeClaim `json:"volumeClaimTemplates,omitempty"`
    
    // Headless Service 名称 (必须)
    ServiceName string `json:"serviceName"`
    
    // Pod 管理策略
    PodManagementPolicy PodManagementPolicyType `json:"podManagementPolicy,omitempty"`
    
    // 更新策略
    UpdateStrategy StatefulSetUpdateStrategy `json:"updateStrategy,omitempty"`
    
    RevisionHistoryLimit *int32 `json:"revisionHistoryLimit,omitempty"`
    MinReadySeconds int32 `json:"minReadySeconds,omitempty"`
    
    // PVC 保留策略
    PersistentVolumeClaimRetentionPolicy *StatefulSetPersistentVolumeClaimRetentionPolicy `json:"persistentVolumeClaimRetentionPolicy,omitempty"`
}

// Pod 管理策略
type PodManagementPolicyType string

const (
    // OrderedReady: 有序创建，前一个就绪后才创建下一个
    OrderedReadyPodManagement PodManagementPolicyType = "OrderedReady"
    
    // Parallel: 并行创建所有 Pod
    ParallelPodManagement PodManagementPolicyType = "Parallel"
)

// StatefulSetStatus 定义
type StatefulSetStatus struct {
    ObservedGeneration int64 `json:"observedGeneration,omitempty"`
    Replicas int32 `json:"replicas,omitempty"`
    ReadyReplicas int32 `json:"readyReplicas,omitempty"`
    CurrentReplicas int32 `json:"currentReplicas,omitempty"`
    UpdatedReplicas int32 `json:"updatedReplicas,omitempty"`
    CurrentRevision string `json:"currentRevision,omitempty"`
    UpdateRevision string `json:"updateRevision,omitempty"`
    CollisionCount *int32 `json:"collisionCount,omitempty"`
    Conditions []StatefulSetCondition `json:"conditions,omitempty"`
    AvailableReplicas int32 `json:"availableReplicas,omitempty"`
}
```

### 6.3 DaemonSet API 结构

```go
type DaemonSetSpec struct {
    Selector *metav1.LabelSelector `json:"selector"`
    Template corev1.PodTemplateSpec `json:"template"`
    
    // 更新策略
    UpdateStrategy DaemonSetUpdateStrategy `json:"updateStrategy,omitempty"`
    MinReadySeconds int32 `json:"minReadySeconds,omitempty"`
    
    // 历史版本保留数量
    RevisionHistoryLimit *int32 `json:"revisionHistoryLimit,omitempty"`
}

type DaemonSetUpdateStrategy struct {
    Type DaemonSetUpdateStrategyType `json:"type,omitempty"`
    RollingUpdate *RollingUpdateDaemonSet `json:"rollingUpdate,omitempty"`
}

type DaemonSetUpdateStrategyType string

const (
    RollingUpdateDaemonSetStrategyType DaemonSetUpdateStrategyType = "RollingUpdate"
    OnDeleteDaemonSetStrategyType      DaemonSetUpdateStrategyType = "OnDelete"
)

type RollingUpdateDaemonSet struct {
    MaxUnavailable *intstr.IntOrString `json:"maxUnavailable,omitempty"`
    MaxSurge *intstr.IntOrString `json:"maxSurge,omitempty"`
}

type DaemonSetStatus struct {
    CurrentNumberScheduled int32 `json:"currentNumberScheduled"`
    NumberMisscheduled int32 `json:"numberMisscheduled"`
    DesiredNumberScheduled int32 `json:"desiredNumberScheduled"`
    NumberReady int32 `json:"numberReady"`
    ObservedGeneration int64 `json:"observedGeneration,omitempty"`
    UpdatedNumberScheduled int32 `json:"updatedNumberScheduled,omitempty"`
    NumberAvailable int32 `json:"numberAvailable,omitempty"`
    NumberUnavailable int32 `json:"numberUnavailable,omitempty"`
    CollisionCount *int32 `json:"collisionCount,omitempty"`
    Conditions []DaemonSetCondition `json:"conditions,omitempty"`
}
```

### 6.4 Job API 结构

```go
type JobSpec struct {
    // 并行度 (同时运行的 Pod 数量)
    Parallelism *int32 `json:"parallelism,omitempty"`
    
    // 完成次数 (需要成功完成的 Pod 数量)
    Completions *int32 `json:"completions,omitempty"`
    
    // 最大运行时间 (秒)
    ActiveDeadlineSeconds *int64 `json:"activeDeadlineSeconds,omitempty"`
    
    // 失败重试次数 (默认 6)
    BackoffLimit *int32 `json:"backoffLimit,omitempty"`
    
    // 标签选择器
    Selector *metav1.LabelSelector `json:"selector,omitempty"`
    
    // 是否手动设置选择器
    ManualSelector *bool `json:"manualSelector,omitempty"`
    
    // Pod 模板
    Template corev1.PodTemplateSpec `json:"template"`
    
    // 完成后保留时间 (秒)
    TTLSecondsAfterFinished *int32 `json:"ttlSecondsAfterFinished,omitempty"`
    
    // 完成模式
    CompletionMode CompletionMode `json:"completionMode,omitempty"`
    
    // 是否暂停
    Suspend *bool `json:"suspend,omitempty"`
}

type CompletionMode string

const (
    NonIndexed CompletionMode = "NonIndexed"
    Indexed    CompletionMode = "Indexed"
)

type JobStatus struct {
    Conditions []JobCondition `json:"conditions,omitempty"`
    StartTime *metav1.Time `json:"startTime,omitempty"`
    CompletionTime *metav1.Time `json:"completionTime,omitempty"`
    Active int32 `json:"active,omitempty"`
    Succeeded int32 `json:"succeeded,omitempty"`
    Failed int32 `json:"failed,omitempty"`
    CompletedIndexes string `json:"completedIndexes,omitempty"`
    UncountedTerminatedUgs *UncountedTerminatedUgs `json:"uncountedTerminatedUgs,omitempty"`
    Ready *int32 `json:"ready,omitempty"`
}
```

### 6.5 CronJob API 结构

```go
type CronJobSpec struct {
    // Cron 调度表达式
    Schedule string `json:"schedule"`
    
    // 时区 (可选)
    TimeZone *string `json:"timeZone,omitempty"`
    
    // 启动截止时间 (秒)
    StartingDeadlineSeconds *int64 `json:"startingDeadlineSeconds,omitempty"`
    
    // 并发策略
    ConcurrencyPolicy ConcurrencyPolicy `json:"concurrencyPolicy,omitempty"`
    
    // 是否暂停
    Suspend *bool `json:"suspend,omitempty"`
    
    // 成功 Job 保留数量 (默认 3)
    SuccessfulJobsHistoryLimit *int32 `json:"successfulJobsHistoryLimit,omitempty"`
    
    // 失败 Job 保留数量 (默认 1)
    FailedJobsHistoryLimit *int32 `json:"failedJobsHistoryLimit,omitempty"`
    
    // Job 模板
    JobTemplate JobTemplateSpec `json:"jobTemplate"`
}

type ConcurrencyPolicy string

const (
    AllowConcurrent   ConcurrencyPolicy = "Allow"
    ForbidConcurrent  ConcurrencyPolicy = "Forbid"
    ReplaceConcurrent ConcurrencyPolicy = "Replace"
)

type CronJobStatus struct {
    Active []corev1.ObjectReference `json:"active,omitempty"`
    LastScheduleTime *metav1.Time `json:"lastScheduleTime,omitempty"`
    LastSuccessfulTime *metav1.Time `json:"lastSuccessfulTime,omitempty"`
}
```

---

## 7. 控制器最佳实践

### 7.1 资源限制配置

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: nginx:latest
        resources:
          # 资源请求 (调度依据)
          requests:
            cpu: "100m"      # 0.1 核
            memory: "128Mi"  # 128 MB
          # 资源限制 (运行时上限)
          limits:
            cpu: "500m"      # 0.5 核
            memory: "512Mi"  # 512 MB
```

#### 资源配置说明

| 配置项 | 说明 | 建议 |
|--------|------|------|
| `requests.cpu` | CPU 请求值 | 设置为平均使用量 |
| `requests.memory` | 内存请求值 | 设置为平均使用量 |
| `limits.cpu` | CPU 上限 | 设置为峰值使用量的 1.5-2 倍 |
| `limits.memory` | 内存上限 | 设置为峰值使用量的 1.2-1.5 倍 |

### 7.2 健康检查配置

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: nginx:latest
        ports:
        - containerPort: 80
        
        # 存活探针 (检测容器是否存活)
        livenessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 30  # 初始延迟
          periodSeconds: 10        # 检测间隔
          timeoutSeconds: 5        # 超时时间
          failureThreshold: 3      # 失败阈值
          successThreshold: 1      # 成功阈值
        
        # 就绪探针 (检测容器是否就绪)
        readinessProbe:
          httpGet:
            path: /ready
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
          successThreshold: 1
        
        # 启动探针 (检测容器是否启动完成)
        startupProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 0
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 30     # 最多等待 300 秒
          successThreshold: 1
```

#### 探针类型对比

| 探针类型 | 用途 | 失败后果 |
|----------|------|----------|
| `livenessProbe` | 检测容器是否存活 | 重启容器 |
| `readinessProbe` | 检测容器是否就绪 | 从 Service 移除 |
| `startupProbe` | 检测容器是否启动完成 | 禁用其他探针直到成功 |

#### 探针检测方式

| 方式 | 说明 | 示例 |
|------|------|------|
| `httpGet` | HTTP 请求检测 | `httpGet: { path: /health, port: 80 }` |
| `tcpSocket` | TCP 端口检测 | `tcpSocket: { port: 3306 }` |
| `exec` | 命令执行检测 | `exec: { command: ["/bin/health-check"] }` |
| `grpc` | gRPC 健康检测 | `grpc: { port: 50051 }` |

### 7.3 滚动更新策略

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 10
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1         # 最多超出 1 个副本
      maxUnavailable: 0   # 不允许不可用
  template:
    # ...
```

#### 更新策略参数

```
┌──────────────────────────────────────────────────────────────┐
│                    滚动更新过程                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  初始状态: replicas=10, version=v1                           │
│                                                              │
│  maxSurge=1, maxUnavailable=0 时:                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 步骤  │ v1 Pods │ v2 Pods │ 总计 │ 说明            │   │
│  ├───────┼─────────┼─────────┼──────┼─────────────────┤   │
│  │ 1     │ 10      │ 1       │ 11   │ 创建 1 个新 Pod │   │
│  │ 2     │ 9       │ 2       │ 11   │ 删除 1 个旧 Pod │   │
│  │ 3     │ 8       │ 3       │ 11   │ 继续...        │   │
│  │ ...   │ ...     │ ...     │ ...  │ ...            │   │
│  │ 最终  │ 0       │ 10      │ 10   │ 更新完成        │   │
│  └───────┴─────────┴─────────┴──────┴─────────────────┘   │
│                                                              │
│  maxSurge=25%, maxUnavailable=25% 时:                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 步骤  │ v1 Pods │ v2 Pods │ 总计 │ 说明            │   │
│  ├───────┼─────────┼─────────┼──────┼─────────────────┤   │
│  │ 1     │ 8       │ 3       │ 11   │ 同时创建/删除   │   │
│  │ 2     │ 6       │ 5       │ 11   │ 继续...        │   │
│  │ ...   │ ...     │ ...     │ ...  │ ...            │   │
│  └───────┴─────────┴─────────┴──────┴─────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 7.4 回滚机制

```bash
# 查看部署历史
kubectl rollout history deployment/web-app

# 查看特定版本详情
kubectl rollout history deployment/web-app --revision=2

# 回滚到上一个版本
kubectl rollout undo deployment/web-app

# 回滚到特定版本
kubectl rollout undo deployment/web-app --to-revision=2

# 暂停滚动更新
kubectl rollout pause deployment/web-app

# 恢复滚动更新
kubectl rollout resume deployment/web-app

# 查看滚动更新状态
kubectl rollout status deployment/web-app
```

### 7.5 PodDisruptionBudget 配置

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: web-app-pdb
spec:
  minAvailable: 2    # 或使用 maxUnavailable: 1
  selector:
    matchLabels:
      app: web
```

### 7.6 Pod 优先级和抢占

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: high-priority
value: 1000000
globalDefault: false
description: "高优先级应用"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: critical-app
spec:
  template:
    spec:
      priorityClassName: high-priority
      containers:
      - name: app
        image: nginx
```

---

## 8. 代码示例

### 8.1 使用 client-go 创建 Deployment

```go
package main

import (
    "context"
    "fmt"
    "log"

    appsv1 "k8s.io/api/apps/v1"
    corev1 "k8s.io/api/core/v1"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    "k8s.io/client-go/kubernetes"
    "k8s.io/client-go/rest"
    "k8s.io/utils/pointer"
)

func main() {
    // 创建集群内配置
    config, err := rest.InClusterConfig()
    if err != nil {
        log.Fatalf("Failed to get in-cluster config: %v", err)
    }

    // 创建客户端
    clientset, err := kubernetes.NewForConfig(config)
    if err != nil {
        log.Fatalf("Failed to create clientset: %v", err)
    }

    // 创建 Deployment
    deployment := &appsv1.Deployment{
        ObjectMeta: metav1.ObjectMeta{
            Name:      "example-deployment",
            Namespace: "default",
            Labels: map[string]string{
                "app": "example",
            },
        },
        Spec: appsv1.DeploymentSpec{
            Replicas: pointer.Int32Ptr(3),
            Selector: &metav1.LabelSelector{
                MatchLabels: map[string]string{
                    "app": "example",
                },
            },
            Template: corev1.PodTemplateSpec{
                ObjectMeta: metav1.ObjectMeta{
                    Labels: map[string]string{
                        "app": "example",
                    },
                },
                Spec: corev1.PodSpec{
                    Containers: []corev1.Container{
                        {
                            Name:  "nginx",
                            Image: "nginx:1.21",
                            Ports: []corev1.ContainerPort{
                                {
                                    ContainerPort: 80,
                                },
                            },
                            Resources: corev1.ResourceRequirements{
                                Requests: corev1.ResourceList{
                                    corev1.ResourceCPU:    resource.MustParse("100m"),
                                    corev1.ResourceMemory: resource.MustParse("128Mi"),
                                },
                                Limits: corev1.ResourceList{
                                    corev1.ResourceCPU:    resource.MustParse("500m"),
                                    corev1.ResourceMemory: resource.MustParse("512Mi"),
                                },
                            },
                            LivenessProbe: &corev1.Probe{
                                ProbeHandler: corev1.ProbeHandler{
                                    HTTPGet: &corev1.HTTPGetAction{
                                        Path: "/",
                                        Port: intstr.FromInt(80),
                                    },
                                },
                                InitialDelaySeconds: 30,
                                PeriodSeconds:       10,
                            },
                            ReadinessProbe: &corev1.Probe{
                                ProbeHandler: corev1.ProbeHandler{
                                    HTTPGet: &corev1.HTTPGetAction{
                                        Path: "/",
                                        Port: intstr.FromInt(80),
                                    },
                                },
                                InitialDelaySeconds: 5,
                                PeriodSeconds:       5,
                            },
                        },
                    },
                },
            },
            Strategy: appsv1.DeploymentStrategy{
                Type: appsv1.RollingUpdateDeploymentStrategyType,
                RollingUpdate: &appsv1.RollingUpdateDeployment{
                    MaxSurge:       pointer.Int32Ptr(1),
                    MaxUnavailable: pointer.Int32Ptr(0),
                },
            },
        },
    }

    // 调用 API 创建
    created, err := clientset.AppsV1().Deployments("default").Create(
        context.Background(),
        deployment,
        metav1.CreateOptions{},
    )
    if err != nil {
        log.Fatalf("Failed to create deployment: %v", err)
    }

    fmt.Printf("Created deployment %s\n", created.Name)
}
```

### 8.2 使用 client-go 创建 StatefulSet

```go
func CreateStatefulSet(clientset *kubernetes.Clientset) error {
    sts := &appsv1.StatefulSet{
        ObjectMeta: metav1.ObjectMeta{
            Name:      "web-statefulset",
            Namespace: "default",
        },
        Spec: appsv1.StatefulSetSpec{
            Replicas:    pointer.Int32Ptr(3),
            ServiceName: "web-headless",
            Selector: &metav1.LabelSelector{
                MatchLabels: map[string]string{
                    "app": "web",
                },
            },
            Template: corev1.PodTemplateSpec{
                ObjectMeta: metav1.ObjectMeta{
                    Labels: map[string]string{
                        "app": "web",
                    },
                },
                Spec: corev1.PodSpec{
                    Containers: []corev1.Container{
                        {
                            Name:  "web",
                            Image: "nginx:1.21",
                            Ports: []corev1.ContainerPort{
                                {ContainerPort: 80},
                            },
                            VolumeMounts: []corev1.VolumeMount{
                                {
                                    Name:      "data",
                                    MountPath: "/usr/share/nginx/html",
                                },
                            },
                        },
                    },
                },
            },
            VolumeClaimTemplates: []corev1.PersistentVolumeClaim{
                {
                    ObjectMeta: metav1.ObjectMeta{
                        Name: "data",
                    },
                    Spec: corev1.PersistentVolumeClaimSpec{
                        AccessModes: []corev1.PersistentVolumeAccessMode{
                            corev1.ReadWriteOnce,
                        },
                        Resources: corev1.ResourceRequirements{
                            Requests: corev1.ResourceList{
                                corev1.ResourceStorage: resource.MustParse("1Gi"),
                            },
                        },
                    },
                },
            },
        },
    }

    _, err := clientset.AppsV1().StatefulSets("default").Create(
        context.Background(),
        sts,
        metav1.CreateOptions{},
    )
    return err
}
```

### 8.3 使用 client-go 创建 Job

```go
func CreateJob(clientset *kubernetes.Clientset) error {
    job := &batchv1.Job{
        ObjectMeta: metav1.ObjectMeta{
            Name:      "batch-job",
            Namespace: "default",
        },
        Spec: batchv1.JobSpec{
            Parallelism:  pointer.Int32Ptr(2),
            Completions:  pointer.Int32Ptr(3),
            BackoffLimit: pointer.Int32Ptr(3),
            Template: corev1.PodTemplateSpec{
                Spec: corev1.PodSpec{
                    RestartPolicy: corev1.RestartPolicyOnFailure,
                    Containers: []corev1.Container{
                        {
                            Name:    "worker",
                            Image:   "busybox:latest",
                            Command: []string{"/bin/sh", "-c", "echo 'Job completed'"},
                        },
                    },
                },
            },
        },
    }

    _, err := clientset.BatchV1().Jobs("default").Create(
        context.Background(),
        job,
        metav1.CreateOptions{},
    )
    return err
}
```

### 8.4 使用 client-go 创建 CronJob

```go
func CreateCronJob(clientset *kubernetes.Clientset) error {
    cronJob := &batchv1.CronJob{
        ObjectMeta: metav1.ObjectMeta{
            Name:      "scheduled-job",
            Namespace: "default",
        },
        Spec: batchv1.CronJobSpec{
            Schedule:                   "0 * * * *", // 每小时执行
            ConcurrencyPolicy:          batchv1.ForbidConcurrent,
            SuccessfulJobsHistoryLimit: pointer.Int32Ptr(3),
            FailedJobsHistoryLimit:     pointer.Int32Ptr(1),
            JobTemplate: batchv1.JobTemplateSpec{
                Spec: batchv1.JobSpec{
                    Template: corev1.PodTemplateSpec{
                        Spec: corev1.PodSpec{
                            RestartPolicy: corev1.RestartPolicyOnFailure,
                            Containers: []corev1.Container{
                                {
                                    Name:    "worker",
                                    Image:   "busybox:latest",
                                    Command: []string{"/bin/sh", "-c", "date; echo 'Scheduled job ran'"},
                                },
                            },
                        },
                    },
                },
            },
        },
    }

    _, err := clientset.BatchV1().CronJobs("default").Create(
        context.Background(),
        cronJob,
        metav1.CreateOptions{},
    )
    return err
}
```

### 8.5 监控控制器状态

```go
func WatchDeploymentStatus(clientset *kubernetes.Clientset, name, namespace string) error {
    watcher, err := clientset.AppsV1().Deployments(namespace).Watch(
        context.Background(),
        metav1.SingleObject(metav1.ObjectMeta{Name: name}),
    )
    if err != nil {
        return err
    }
    defer watcher.Stop()

    for event := range watcher.ResultChan() {
        deploy := event.Object.(*appsv1.Deployment)
        
        fmt.Printf("Event: %s\n", event.Type)
        fmt.Printf("  Replicas: %d/%d\n", deploy.Status.ReadyReplicas, *deploy.Spec.Replicas)
        fmt.Printf("  Updated: %d\n", deploy.Status.UpdatedReplicas)
        fmt.Printf("  Available: %d\n", deploy.Status.AvailableReplicas)
        
        // 检查是否完成
        if deploy.Status.ReadyReplicas == *deploy.Spec.Replicas &&
            deploy.Status.UpdatedReplicas == *deploy.Spec.Replicas {
            fmt.Println("Deployment is ready!")
            break
        }
    }
    
    return nil
}
```

---

## 总结

本文档深入分析了 Kubernetes 控制器机制，涵盖以下核心内容：

1. **控制器类型**：详细介绍了 Deployment、StatefulSet、DaemonSet、Job、CronJob、ReplicaSet 的架构和使用场景。

2. **Service 创建规则**：
   - Deployment 不会自动创建 Service
   - StatefulSet 需要 Headless Service 提供网络标识
   - DaemonSet 通常不需要 Service
   - Job/CronJob 通常不需要 Service

3. **标签选择器**：详细说明了 matchLabels 和 matchExpressions 的使用方法和规则。

4. **OwnerReferences 机制**：解释了控制器如何通过 OwnerReferences 管理从属资源和实现垃圾回收。

5. **API 结构**：展示了各控制器的 Spec 和 Status 结构定义。

6. **最佳实践**：提供了资源配置、健康检查、滚动更新、回滚等实践指南。

7. **代码示例**：提供了使用 client-go 操作各控制器的完整示例代码。

---

## 参考资源

- [Kubernetes 官方文档](https://kubernetes.io/docs/concepts/workloads/controllers/)
- [client-go 文档](https://pkg.go.dev/k8s.io/client-go)
- [Kubernetes API 参考](https://kubernetes.io/docs/reference/kubernetes-api/)
