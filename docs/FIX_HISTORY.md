# KubeNext 历史修复记录

本文档记录了 KubeNext 平台开发过程中的所有重要修复和改进。

---

## 目录

1. [环境配置修复](#1-环境配置修复)
2. [前端功能修复](#2-前端功能修复)
3. [后端功能修复](#3-后端功能修复)
4. [架构优化](#4-架构优化)
5. [Bug 修复记录](#5-bug-修复记录)

---

## 1. 环境配置修复

### 1.1 Go 环境配置

**问题**: 项目初始使用 Go 1.26，但存在兼容性问题

**修复**:
- 安装 Go 1.23.0 到 `~/go-install/go`
- 使用 `go mod tidy` 更新依赖
- 更新 k8s.io/client-go 到 v0.35.2 (支持 K8s 1.35)

**验证命令**:
```bash
go version  # go1.23.0
go build -o k8s-service .
```

### 1.2 Kubeconfig 配置

**问题**: 后端无法连接 K8s 集群

**修复**:
- 将 kubeconfig 保存到 `mini-services/k8s-service/kubeconfig.yaml`
- 配置正确的 context 和 cluster URL
- 确保证书和密钥正确

**连接验证**:
```bash
curl http://localhost:8080/api/overview
# 返回: {"nodes":1,"readyNodes":1,"namespaces":5,"pods":19,...}
```

### 1.3 集群信息

- **K8s 版本**: v1.34.4+k3s1 (K3s 轻量级发行版)
- **节点数量**: 1 个 control-plane 节点
- **默认运行**: Prometheus, Alertmanager, Traefik, CoreDNS 等基础组件

---

## 2. 前端功能修复

### 2.1 "编辑 YAML" 按钮无响应

**问题**: 资源控制器 (Deployment/StatefulSet/DaemonSet) 页面的"编辑"按钮点击无反应

**根本原因**:
- 按钮缺少 onClick 处理函数
- 编辑功能未实现

**修复方案**:
1. 创建 `useResourceYaml` hook 获取资源 YAML
2. 创建 `useUpdateResourceYaml` hook 更新资源
3. 添加 YAML 编辑对话框组件

**修复文件**:
- `src/components/pages/DeploymentsPage.tsx`
- `src/components/pages/StatefulSetsPage.tsx`
- `src/components/pages/DaemonSetsPage.tsx`

**代码示例**:
```tsx
// 添加状态
const [isEditYamlOpen, setIsEditYamlOpen] = useState(false);
const [selectedResource, setSelectedResource] = useState<Deployment | null>(null);

// 处理函数
const handleEditYaml = (deployment: Deployment) => {
  setSelectedResource(deployment);
  setIsEditYamlOpen(true);
};

// 菜单项绑定
<DropdownMenuItem onClick={() => handleEditYaml(deployment)}>
  编辑 YAML
</DropdownMenuItem>
```

### 2.2 "查看详情" 按钮无响应

**问题**: 工作负载页面的"查看详情"菜单项点击无反应

**修复方案**:
1. 添加 `isDetailOpen` 和 `selectedResource` 状态
2. 实现 `handleViewDetail` 处理函数
3. 创建详情对话框组件

**详情对话框内容**:
- 名称、命名空间、创建时间
- 副本状态（期望/就绪/可用）
- 健康状态
- 标签和注解
- 快捷操作按钮

### 2.3 刷新状态按钮无反馈

**问题**: 集群管理页面刷新状态按钮点击后无加载反馈

**修复方案**:
```tsx
// 添加加载状态
const [isRefreshing, setIsRefreshing] = useState(false);

const handleRefresh = async () => {
  setIsRefreshing(true);
  try {
    await refetch();
    toast({ title: "刷新成功", description: "集群状态已更新" });
  } catch (error) {
    toast({ title: "刷新失败", variant: "destructive" });
  } finally {
    setIsRefreshing(false);
  }
};

// 按钮显示加载动画
<Button onClick={handleRefresh} disabled={isRefreshing}>
  {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw />}
  刷新状态
</Button>
```

### 2.4 页面文件丢失

**问题**: 开发新功能时，原有页面文件被意外删除

**丢失文件**:
- ReplicaSetsPage.tsx
- HPAPage.tsx
- AlertRulesPage.tsx
- ApplicationsPage.tsx
- APMInjectionPage.tsx
- CustomDashboardPage.tsx

**修复方案**:
- 重新创建所有丢失的页面
- 更新 page.tsx 恢复路由

**预防措施**:
- 使用 Edit 工具而非 Write 工具修改文件
- 修改前先读取文件内容
- 添加功能检查清单

---

## 3. 后端功能修复

### 3.1 RBAC API 支持

**问题**: 前端无法获取 RBAC 资源数据

**修复方案**:

1. **类型定义** (`internal/models/types.go`):
```go
type ServiceAccountInfo struct {
    Name        string   `json:"name"`
    Namespace   string   `json:"namespace"`
    Secrets     []string `json:"secrets"`
    CreatedAt   string   `json:"createdAt"`
}

type RoleInfo struct {
    Name        string          `json:"name"`
    Namespace   string          `json:"namespace"`
    Type        string          `json:"type"` // Role or ClusterRole
    Rules       []RuleInfo      `json:"rules"`
    CreatedAt   string          `json:"createdAt"`
}

type RoleBindingInfo struct {
    Name        string   `json:"name"`
    Namespace   string   `json:"namespace"`
    RoleName    string   `json:"roleName"`
    RoleKind    string   `json:"roleKind"`
    Subjects    []Subject `json:"subjects"`
    Type        string   `json:"type"`
    CreatedAt   string   `json:"createdAt"`
}
```

2. **客户端方法** (`internal/k8s/client.go`):
```go
func (c *Client) GetServiceAccounts(namespace string) ([]ServiceAccountInfo, error)
func (c *Client) GetRoles(namespace string) ([]RoleInfo, error)
func (c *Client) GetRoleBindings(namespace string) ([]RoleBindingInfo, error)
```

3. **API 路由** (`internal/router/router.go`):
```go
api.GET("/serviceaccounts", handlers.GetServiceAccounts)
api.GET("/roles", handlers.GetRoles)
api.GET("/rolebindings", handlers.GetRoleBindings)
```

### 3.2 HPA API 支持

**问题**: HPA 页面无数据

**修复方案**:

1. **类型定义**:
```go
type HPAInfo struct {
    Name              string          `json:"name"`
    Namespace         string          `json:"namespace"`
    ScaleTargetName   string          `json:"scaleTargetName"`
    ScaleTargetKind   string          `json:"scaleTargetKind"`
    MinReplicas       int32           `json:"minReplicas"`
    MaxReplicas       int32           `json:"maxReplicas"`
    CurrentReplicas   int32           `json:"currentReplicas"`
    DesiredReplicas   int32           `json:"desiredReplicas"`
    Metrics           []MetricStatus  `json:"metrics"`
    Conditions        []Condition     `json:"conditions"`
    Status            string          `json:"status"`
    CreatedAt         string          `json:"createdAt"`
}
```

2. **客户端方法**:
```go
func (c *Client) GetHPAs(namespace string) ([]HPAInfo, error)
func (c *Client) GetHPADetail(namespace, name string) (*HPADetail, error)
func (c *Client) DeleteHPA(namespace, name string) error
```

3. **导入 autoscalingv2**:
```go
autoscalingv2 "k8s.io/api/autoscaling/v2"
```

### 3.3 CronJob 状态字段问题

**问题**: CronJobStatus 使用了废弃字段

**修复**:
```go
// 修复前 (废弃字段)
status.ActiveJobs = len(cronJob.Status.Active)

// 修复后
status.Active = len(cronJob.Status.Active)
```

### 3.4 类型重复定义

**问题**: types.go 中存在类型重复定义导致编译错误

**修复**:
- 检查并合并重复的类型定义
- 确保每个类型只定义一次

---

## 4. 架构优化

### 4.1 后端目录重构

**原始结构**:
```
mini-services/k8s-service/
├── main.go
└── pkg/
```

**重构后结构**:
```
mini-services/k8s-service/
├── main.go
├── internal/
│   ├── config/          # 配置管理
│   ├── auth/            # 认证鉴权
│   ├── k8s/             # K8s 客户端封装
│   ├── handlers/        # HTTP 处理器
│   ├── router/          # API 路由
│   ├── helm/            # Helm 客户端
│   └── models/          # 数据模型
├── pkg/
│   ├── api/             # API handlers
│   ├── controller/      # CRD 控制器
│   ├── webhook/         # Admission Webhook
│   └── service/         # 业务逻辑
└── kubeconfig.yaml      # Kubeconfig 配置
```

### 4.2 简化 CRD 架构

**问题**: 过度设计，使用了不必要的 CRD

**优化方案**:
- 使用 client-go 直接调用 K8s API
- 无需额外 CRD 定义
- 删除不必要的目录: `deploy/crds/`, `pkg/controller/`

### 4.3 Helm 集成

**新增功能**: 一键部署中间件

**支持模板**:
- 数据库: MySQL, PostgreSQL, MongoDB
- 缓存: Redis
- 消息队列: Kafka, RabbitMQ
- 监控: Prometheus
- 存储: MinIO
- 网关: Nginx Ingress

**实现文件**:
- `internal/helm/client.go`: Helm SDK 封装
- `src/components/pages/HelmPage.tsx`: 前端部署界面

---

## 5. Bug 修复记录

### 5.1 功能丢失问题

**问题描述**: 开发新功能时，原有已实现的功能意外丢失

**根本原因**: 使用 Write 工具覆盖了整个文件，导致原有内容丢失

**预防措施**:
1. 修改文件前先用 Read 工具读取内容
2. 使用 Edit 工具进行增量修改
3. 修改后检查相关功能是否正常
4. 提交前运行 lint 检查

### 5.2 ESLint 错误

**常见问题**:
- 未使用的变量
- 未使用的导入
- TypeScript 类型错误

**修复**:
```bash
bun run lint  # 检查错误
```

**典型修复**:
```tsx
// 修复前
const [data, setData] = useState();  // data 未使用

// 修复后
const [data, setData] = useState();
// 使用 data 或删除未使用的变量
```

### 5.3 前后端端口配置

**配置说明**:
- 前端: 3000 端口
- 后端: 8080 端口
- API 代理: 通过 Caddyfile 配置

**注意事项**:
- 前端请求使用相对路径 `/api/...`
- 添加 `?XTransformPort=8080` 参数指定后端端口
- WebSocket 连接需要正确配置

---

## 6. 验证清单

每次修复后，请执行以下验证:

### 6.1 前端验证
```bash
cd /home/z/my-project
bun run lint  # 0 errors
```

### 6.2 后端验证
```bash
cd /home/z/my-project/mini-services/k8s-service
go build -o k8s-service .  # 编译成功
```

### 6.3 API 验证
```bash
# 集群概览
curl http://localhost:8080/api/overview

# 节点列表
curl http://localhost:8080/api/nodes

# Pods 列表
curl http://localhost:8080/api/pods

# Deployments 列表
curl http://localhost:8080/api/deployments
```

### 6.4 功能验证清单

- [ ] Dashboard 集群概览显示正常
- [ ] Nodes 页面节点列表显示正常
- [ ] Workloads 页面所有标签页显示正常
- [ ] Deployment 操作菜单（重启、扩缩容、删除）正常
- [ ] StatefulSet 操作菜单正常
- [ ] DaemonSet 操作菜单正常
- [ ] Job/CronJob 操作菜单正常
- [ ] Services 页面显示正常
- [ ] Ingress 页面显示正常
- [ ] ConfigMaps/Secrets 页面显示正常
- [ ] PV/PVC/StorageClass 页面显示正常
- [ ] HPA 页面显示正常
- [ ] RBAC 页面显示正常
- [ ] Helm 一键部署功能正常
- [ ] 监控大屏显示正常

---

## 7. 相关文档

- [架构设计文档](./ARCHITECTURE_V2.md)
- [监控体系文档](./MONITORING.md)
- [DevOps 架构文档](./DEVOPS_ARCHITECTURE.md)
- [项目 README](../README.md)

---

*最后更新: 2025-01-18*
