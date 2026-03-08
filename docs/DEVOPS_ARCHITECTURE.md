# KubeNext DevOps 平台架构

## 一、功能模块总览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        KubeNext DevOps 平台                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ 镜像仓库管理 │  │ Helm 应用商店│  │ 节点命令执行 │  │ 可视化大屏   │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
│         │                │                │                │           │
│         └────────────────┼────────────────┼────────────────┘           │
│                          │                │                            │
│                          ▼                ▼                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Kubernetes 集群 (k3s)                        │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │   │
│  │  │Prometheus│ │ Grafana  │ │  MySQL   │ │  Redis   │  ...      │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 二、核心功能模块

### 1. 镜像仓库管理

**功能**：
- 镜像仓库连接管理（Docker Hub、阿里云 ACR、Harbor、腾讯云 TCR）
- 镜像同步与缓存
- 安全漏洞扫描（集成 Trivy）
- 镜像版本管理

**与 Helm 联动**：
```
镜像仓库 → 选择镜像 → Helm Chart 配置 → 一键部署
```

**API 设计**：
```go
// 仓库管理
GET    /api/registries           // 获取仓库列表
POST   /api/registries           // 添加仓库
DELETE /api/registries/:id       // 删除仓库
POST   /api/registries/:id/sync  // 同步镜像

// 镜像管理
GET    /api/registries/:id/images        // 获取镜像列表
GET    /api/images/:id/tags              // 获取镜像标签
POST   /api/images/sync                  // 镜像同步任务
POST   /api/images/scan                  // 安全扫描
```

---

### 2. Helm 应用商店

**功能**：
- Helm 仓库管理（添加、更新、删除）
- Chart 浏览与搜索
- 一键部署中间件（MySQL、Redis、Prometheus、Grafana 等）
- 应用版本管理与升级
- 部署状态监控

**一键部署流程**：
```
用户点击部署 → 选择 Chart → 配置参数 → 选择镜像仓库
    → Helm Install → 监控部署状态 → 更新可视化大屏
```

**API 设计**：
```go
// Helm 仓库
GET    /api/helm/repos           // 获取仓库列表
POST   /api/helm/repos           // 添加仓库
DELETE /api/helm/repos/:name     // 删除仓库
POST   /api/helm/repos/:name/update  // 更新索引

// Chart 市场
GET    /api/helm/charts          // 获取 Chart 列表
GET    /api/helm/charts/:name    // 获取 Chart 详情
GET    /api/helm/charts/:name/values  // 获取默认 Values

// Release 管理
GET    /api/helm/releases        // 获取已安装应用
POST   /api/helm/install         // 安装应用
POST   /api/helm/upgrade/:name   // 升级应用
POST   /api/helm/rollback/:name  // 回滚应用
DELETE /api/helm/uninstall/:name // 卸载应用
GET    /api/helm/releases/:name/status  // 获取部署状态
GET    /api/helm/releases/:name/logs    // 获取日志
```

---

### 3. 节点命令执行

**功能**：
- Web 终端（WebSocket）
- 批量命令执行
- 命令历史记录
- 脚本模板管理

**实现方式**：
- WebSocket 实时终端
- 支持 kubectl、helm、docker 等命令
- 支持自定义脚本

**API 设计**：
```go
// WebSocket 终端
WS     /api/nodes/:name/shell    // 节点 Shell 终端
WS     /api/cluster/shell        // 集群终端

// 命令执行
POST   /api/nodes/:name/exec     // 执行命令
GET    /api/commands/history     // 命令历史
POST   /api/scripts              // 保存脚本模板
GET    /api/scripts              // 获取脚本模板
```

---

### 4. 可视化大屏

**功能**：
- 集群概览（节点、Pod、资源使用率）
- 中间件状态实时展示
- 部署进度跟踪
- 告警与事件

**数据来源**：
- K8s API → 节点、Pod、资源状态
- Prometheus → 指标数据
- Helm API → 部署状态

---

## 三、功能联动流程

### 场景一：一键部署 MySQL 集群

```
1. 用户进入 Helm 应用商店
2. 搜索 "mysql" Chart
3. 点击"安装"，填写配置：
   - 副本数：3
   - 存储类：local-path
   - 镜像仓库：选择阿里云 ACR
   - root 密码：******
4. 点击"开始部署"
   → 后端调用 Helm Install API
   → 创建 StatefulSet、Service、ConfigMap
   → 等待 Pod 就绪
5. 部署完成后：
   → 可视化大屏自动更新显示 MySQL 运行状态
   → 监控系统开始采集 MySQL 指标
```

### 场景二：镜像同步与更新

```
1. 用户发现新版本镜像可用
2. 在镜像仓库页面点击"同步"
3. 选择目标仓库（如 Harbor）
4. 同步完成后：
   → Helm 应用商店显示新版本可用
   → 用户点击"升级"
   → Pod 滚动更新
   → 监控显示更新进度
```

### 场景三：运维故障排查

```
1. 可视化大屏显示告警
2. 用户点击告警进入详情
3. 打开节点终端执行诊断命令
4. 查看日志定位问题
5. 通过 Helm 回滚到上一版本
```

---

## 四、后端服务架构

```
mini-services/
├── k8s-service/           # K8s 核心服务 (8080)
│   ├── internal/
│   │   ├── handlers/
│   │   │   ├── handlers.go      # K8s 资源 API
│   │   │   ├── helm.go          # Helm 操作 API
│   │   │   ├── registry.go      # 镜像仓库 API
│   │   │   └── shell.go         # WebSocket Shell
│   │   ├── k8s/
│   │   │   └── client.go        # K8s 客户端
│   │   ├── helm/
│   │   │   └── client.go        # Helm 客户端
│   │   └── registry/
│   │       └── client.go        # 镜像仓库客户端
│   └── main.go
│
└── prometheus-service/    # Prometheus 代理服务 (可选)
```

---

## 五、数据库设计

```prisma
// Helm 仓库
model HelmRepo {
  id        String   @id @default(cuid())
  name      String   @unique
  url       String
  username  String?
  password  String?
  status    String   @default("active")
  lastSync  DateTime?
  charts    Chart[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Chart 模板
model Chart {
  id          String    @id @default(cuid())
  name        String
  version     String
  appVersion  String
  description String?
  repoId      String
  repo        HelmRepo  @relation(fields: [repoId], references: [id])
  installs    Install[]
  createdAt   DateTime  @default(now())
}

// 安装记录
model Install {
  id         String   @id @default(cuid())
  name       String
  namespace  String
  chartId    String
  chart      Chart    @relation(fields: [chartId], references: [id])
  status     String   @default("pending")
  values     String?  // YAML 配置
  revision   Int      @default(1)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

// 镜像仓库
model ImageRegistry {
  id        String   @id @default(cuid())
  name      String   @unique
  url       String
  type      String   // public, private
  authType  String   // username, token
  username  String?
  password  String?
  token     String?
  status    String   @default("active")
  images    Image[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// 镜像
model Image {
  id          String        @id @default(cuid())
  name        String
  tag         String
  size        String?
  registryId  String
  registry    ImageRegistry @relation(fields: [registryId], references: [id])
  scanStatus  String?       // pending, scanning, completed
  vulnerabilities Int?
  createdAt   DateTime      @default(now())
}

// 命令历史
model CommandHistory {
  id        String   @id @default(cuid())
  node      String
  command   String
  output    String?
  status    String   // success, failed
  duration  Int?     // ms
  createdAt DateTime @default(now())
}
```

---

## 六、实现优先级

### P0 - 核心功能
1. ✅ K8s 集群连接与资源管理
2. ✅ 可视化大屏基础展示
3. 🔄 Helm API 集成（一键部署）
4. 🔄 WebSocket Shell 终端

### P1 - 增强功能
1. 镜像仓库连接与同步
2. 部署进度实时跟踪
3. 告警与事件通知

### P2 - 高级功能
1. 安全漏洞扫描
2. 脚本模板管理
3. 批量操作

---

## 七、快速开始

### 部署监控栈
```bash
# 添加 Helm 仓库
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# 安装 kube-prometheus-stack
helm install prometheus prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace \
  --set prometheus.service.type=NodePort \
  --set grafana.service.type=NodePort
```

### 部署 MySQL
```bash
helm install mysql bitnami/mysql \
  -n database --create-namespace \
  --set auth.rootPassword=yourpassword \
  --set primary.persistence.storageClass=local-path
```

### 部署 Redis
```bash
helm install redis bitnami/redis \
  -n cache --create-namespace \
  --set auth.password=yourpassword \
  --set master.persistence.storageClass=local-path
```

---

## 八、访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| KubeNext UI | http://localhost:3000 | 前端界面 |
| K8s API | http://localhost:8080/api | 后端 API |
| Prometheus | http://109.206.245.63:30090 | 监控系统 |
| Grafana | http://109.206.245.63:30030 | 可视化面板 |
