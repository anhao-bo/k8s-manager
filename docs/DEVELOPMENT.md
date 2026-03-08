# KubeNext 开发规范与指南

## 目录

1. [项目架构概览](#1-项目架构概览)
2. [技术栈与依赖](#2-技术栈与依赖)
3. [后端开发规范](#3-后端开发规范)
4. [前端开发规范](#4-前端开发规范)
5. [功能实现指南](#5-功能实现指南)
6. [扩展新功能步骤](#6-扩展新功能步骤)
7. [常见问题与解决方案](#7-常见问题与解决方案)

---

## 1. 项目架构概览

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           用户浏览器                                  │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    前端 (Next.js 16) - 端口 3000                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   Pages      │  │   Hooks      │  │   API Proxy              │  │
│  │ (页面组件)    │──│ (数据获取)   │──│ /api/[...path]/route.ts  │  │
│  └──────────────┘  └──────────────┘  └─────────────┬────────────┘  │
└─────────────────────────────────────────────────────┼───────────────┘
                                                      │
                                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    后端 (Go + Gin) - 端口 8080                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   Router     │  │   Handlers   │  │   K8s Client             │  │
│  │ (路由注册)    │──│ (业务处理)   │──│ (集群操作)               │  │
│  └──────────────┘  └──────────────┘  └─────────────┬────────────┘  │
└─────────────────────────────────────────────────────┼───────────────┘
                                                      │
                                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Kubernetes 集群 (K3s)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   Nodes      │  │   Pods       │  │   CRDs (MetalLB/Traefik) │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 目录结构

```
/home/z/my-project/
├── src/                              # 前端 Next.js 应用
│   ├── app/
│   │   ├── page.tsx                  # 主页面（路由入口）
│   │   ├── layout.tsx                # 根布局
│   │   ├── globals.css               # 全局样式
│   │   └── api/
│   │       └── [...path]/route.ts    # API 代理层
│   ├── components/
│   │   ├── ui/                       # shadcn/ui 基础组件
│   │   ├── pages/                    # 页面组件
│   │   └── layout/                   # 布局组件
│   ├── hooks/
│   │   └── use-k8s.ts                # K8s 数据获取 Hooks
│   └── lib/
│       └── utils.ts                  # 工具函数
│
├── mini-services/
│   └── k8s-service/                  # Go 后端服务
│       ├── main.go                   # 入口文件
│       ├── go.mod                    # Go 模块定义
│       └── internal/
│           ├── config/config.go      # 配置管理
│           ├── k8s/
│           │   ├── client.go         # K8s 客户端封装
│           │   ├── exec.go           # Pod Exec 实现
│           │   └── metallb.go        # MetalLB CRD 操作
│           ├── models/types.go       # 数据模型定义
│           ├── handlers/
│           │   ├── handlers.go       # 核心 API 处理器
│           │   ├── websocket.go      # WebSocket 处理
│           │   └── metallb_handlers.go
│           └── router/router.go      # 路由注册
│
├── prisma/                           # Prisma ORM
├── public/                           # 静态资源
└── docs/                             # 文档目录
```

---

## 2. 技术栈与依赖

### 2.1 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16.x | React 框架，App Router |
| React | 19.x | UI 库 |
| TypeScript | 5.x | 类型安全 |
| Tailwind CSS | 4.x | 样式框架 |
| shadcn/ui | New York | UI 组件库 |
| TanStack Query | 5.x | 服务端状态管理 |
| Zustand | 5.x | 客户端状态管理 |
| Recharts | 2.x | 图表库 |
| xterm.js | 5.x | 终端模拟器 |
| Lucide Icons | - | 图标库 |

### 2.2 后端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Go | 1.23+ | 后端语言 |
| Gin | 1.10.x | Web 框架 |
| k8s.io/client-go | 0.35.x | K8s 官方 Go 客户端 |
| gorilla/websocket | 1.5.x | WebSocket 支持 |

### 2.3 基础设施

| 组件 | 版本 | 用途 |
|------|------|------|
| K3s | v1.34.x | 轻量级 Kubernetes |
| SQLite | - | 本地数据库 |
| Caddy | - | 反向代理/Gateway |

---

## 3. 后端开发规范

### 3.1 代码组织结构

```
mini-services/k8s-service/internal/
├── config/           # 配置层 - 环境变量、启动参数
├── k8s/              # K8s 客户端层 - 集群操作封装
├── models/           # 模型层 - 数据传输对象 (DTO)
├── handlers/         # 处理器层 - HTTP 请求处理
└── router/           # 路由层 - URL 映射
```

### 3.2 K8s 客户端封装规范

#### 客户端结构

```go
// internal/k8s/client.go
type Client struct {
    Clientset     *kubernetes.Clientset    // 标准 K8s 客户端
    DynamicClient dynamic.Interface         // 动态客户端 (用于 CRD)
    Config        *rest.Config              // REST 配置
    Namespace     string                    // 默认命名空间
}
```

#### 连接模式

```go
// 支持两种连接模式
func NewClient(kubeconfigPath string, inCluster bool) (*Client, error) {
    if inCluster {
        // 集群内模式 - 使用 ServiceAccount
        config, err = rest.InClusterConfig()
    } else {
        // 集群外模式 - 使用 kubeconfig 文件
        config, err = clientcmd.BuildConfigFromFlags("", kubeconfigPath)
    }
    // ...
}
```

#### 资源操作方法命名规范

```go
// 标准 CRUD 命名
func (c *Client) GetPods(namespace string) ([]models.PodInfo, error)
func (c *Client) CreatePod(req models.CreatePodRequest) (*models.PodInfo, error)
func (c *Client) DeletePod(namespace, name string) error
func (c *Client) UpdatePod(req models.UpdatePodRequest) (*models.PodInfo, error)

// 特殊操作命名
func (c *Client) ScaleDeployment(namespace, name string, replicas int32) error
func (c *Client) RestartDeployment(namespace, name string) error
func (c *Client) GetPodLogs(namespace, name, container string, tailLines int64) (string, error)
```

#### CRD 资源操作（使用动态客户端）

```go
// MetalLB IPAddressPool 示例
func (c *Client) GetIPPools() ([]models.IPPoolInfo, error) {
    gvr := schema.GroupVersionResource{
        Group:    "metallb.io",
        Version:  "v1beta1",
        Resource: "ipaddresspools",
    }

    list, err := c.DynamicClient.Resource(gvr).List(ctx, metav1.ListOptions{})
    // 解析 Unstructured 到模型...
}
```

### 3.3 数据模型定义规范

#### 模型文件位置

所有数据模型定义在 `internal/models/types.go`

#### 命名规范

```go
// 信息模型 - 用于列表展示
type PodInfo struct {
    Name            string            `json:"name"`
    Namespace       string            `json:"namespace"`
    Status          string            `json:"status"`
    // ...
}

// 详情模型 - 用于详细信息
type PodDetail struct {
    PodInfo                           // 嵌入基础信息
    Containers     []ContainerInfo    `json:"containers"`
    Events         []EventInfo        `json:"events"`
    // ...
}

// 创建请求模型
type CreatePodRequest struct {
    Name           string            `json:"name" binding:"required"`
    Namespace      string            `json:"namespace" binding:"required"`
    Image          string            `json:"image" binding:"required"`
    // ...
}

// API 响应模型
type APIResponse struct {
    Success bool   `json:"success"`
    Message string `json:"message,omitempty"`
    Data    any    `json:"data,omitempty"`
}

type ErrorResponse struct {
    Success bool   `json:"success"`
    Error   string `json:"error"`
}
```

### 3.4 Handler 处理器规范

#### 标准处理器结构

```go
// internal/handlers/handlers.go

// Handler 处理器结构体
type Handler struct {
    Client      *k8s.Client
    clientMutex sync.RWMutex
}

// 标准 GET 列表处理器
func (h *Handler) GetPods(c *gin.Context) {
    // 1. 检查客户端
    if h.Client == nil {
        c.JSON(http.StatusInternalServerError, models.ErrorResponse{
            Success: false,
            Error:   "Kubernetes client not initialized",
        })
        return
    }

    // 2. 获取查询参数
    namespace := c.Query("namespace")

    // 3. 调用 K8s 客户端
    pods, err := h.Client.GetPods(namespace)
    if err != nil {
        c.JSON(http.StatusInternalServerError, models.ErrorResponse{
            Success: false,
            Error:   err.Error(),
        })
        return
    }

    // 4. 返回成功响应
    c.JSON(http.StatusOK, pods)
}

// 标准 POST 创建处理器
func (h *Handler) CreatePod(c *gin.Context) {
    // 1. 检查客户端
    if h.Client == nil {
        c.JSON(http.StatusInternalServerError, models.ErrorResponse{
            Success: false,
            Error:   "Kubernetes client not initialized",
        })
        return
    }

    // 2. 绑定请求体
    var req models.CreatePodRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, models.ErrorResponse{
            Success: false,
            Error:   err.Error(),
        })
        return
    }

    // 3. 调用 K8s 客户端
    pod, err := h.Client.CreatePod(req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, models.ErrorResponse{
            Success: false,
            Error:   err.Error(),
        })
        return
    }

    // 4. 返回成功响应
    c.JSON(http.StatusOK, pod)
}
```

### 3.5 路由注册规范

```go
// internal/router/router.go

func SetupRouter(h *handlers.Handler) *gin.Engine {
    r := gin.Default()

    // CORS 配置
    r.Use(cors.New(cors.Config{
        AllowOrigins:     []string{"*"},
        AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
        AllowCredentials: true,
    }))

    // API 路由组
    api := r.Group("/api")
    {
        // 按资源类型分组，保持一致性

        // 集群状态
        api.GET("/status", h.GetStatus)
        api.GET("/overview", h.GetOverview)

        // 节点管理
        api.GET("/nodes", h.GetNodes)
        api.GET("/nodes/:name", h.GetNodeDetail)
        api.POST("/nodes/:name/cordon", h.CordonNode)
        api.POST("/nodes/:name/uncordon", h.UncordonNode)
        api.POST("/nodes/:name/drain", h.DrainNode)

        // Pod 管理
        api.GET("/pods", h.GetPods)
        api.POST("/pods", h.CreatePod)
        api.DELETE("/pods", h.DeletePod)
        api.GET("/pods/logs", h.GetPodLogs)
        api.GET("/pods/yaml", h.GetPodYaml)
        api.PUT("/pods/yaml", h.UpdatePodYaml)

        // ... 其他资源
    }

    // 健康检查
    r.GET("/health", func(c *gin.Context) {
        c.JSON(200, gin.H{"status": "ok"})
    })

    return r
}
```

---

## 4. 前端开发规范

### 4.1 页面组件结构

```typescript
// src/components/pages/ExamplePage.tsx

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useK8sResource } from "@/hooks/use-k8s";  // 自定义 Hook

// 类型定义
interface ResourceInfo {
  name: string;
  namespace: string;
  // ...
}

// 加载骨架屏组件
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 骨架屏内容 */}
    </div>
  );
}

// 主组件
export default function ExamplePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ResourceInfo[]>([]);

  // 数据获取
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/resource?XTransformPort=8080');
        if (response.ok) {
          const data = await response.json();
          setData(data);
        }
      } catch (error) {
        console.error('Failed to fetch:', error);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  // 事件处理
  const handleAction = async () => {
    try {
      const response = await fetch('/api/resource/action?XTransformPort=8080', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        toast({ title: "操作成功" });
      } else {
        toast({ variant: "destructive", title: "操作失败" });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "网络错误" });
    }
  };

  // 加载状态
  if (loading) {
    return <LoadingSkeleton />;
  }

  // 渲染页面
  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">页面标题</h1>
        <Button onClick={handleAction}>操作按钮</Button>
      </div>

      {/* 内容区域 */}
      <div className="glass-card">
        {/* 表格或卡片内容 */}
      </div>
    </div>
  );
}
```

### 4.2 API 请求规范

#### API 代理机制

前端所有 API 请求通过 Next.js API Routes 代理到 Go 后端：

```typescript
// src/app/api/[...path]/route.ts

// 请求: /api/pods?XTransformPort=8080
// 转发: http://localhost:8080/api/pods

// 重要: 必须使用 XTransformPort 参数指定后端端口
```

#### 标准请求模式

```typescript
// GET 请求
const response = await fetch('/api/pods?XTransformPort=8080');

// GET 请求带查询参数
const response = await fetch('/api/pods?namespace=default&XTransformPort=8080');

// POST 请求
const response = await fetch('/api/pods?XTransformPort=8080', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'my-pod', namespace: 'default' }),
});

// DELETE 请求
const response = await fetch(`/api/pods?name=my-pod&namespace=default&XTransformPort=8080`, {
  method: 'DELETE',
});
```

### 4.3 自定义 Hooks

```typescript
// src/hooks/use-k8s.ts

import { useQuery } from "@tanstack/react-query";

// 获取 Pod 列表
export function usePods(namespace?: string) {
  return useQuery({
    queryKey: ["pods", namespace],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (namespace) params.append("namespace", namespace);
      params.append("XTransformPort", "8080");

      const response = await fetch(`/api/pods?${params}`);
      if (!response.ok) throw new Error("Failed to fetch pods");
      return response.json();
    },
    refetchInterval: 5000,  // 5秒自动刷新
  });
}

// 获取 Deployment 列表
export function useDeployments(namespace?: string) {
  return useQuery({
    queryKey: ["deployments", namespace],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (namespace) params.append("namespace", namespace);
      params.append("XTransformPort", "8080");

      const response = await fetch(`/api/deployments?${params}`);
      if (!response.ok) throw new Error("Failed to fetch deployments");
      return response.json();
    },
    refetchInterval: 5000,
  });
}
```

### 4.4 UI 组件使用规范

#### 使用 shadcn/ui 组件

```typescript
// 按钮
import { Button } from "@/components/ui/button";
<Button variant="default">主要按钮</Button>
<Button variant="outline">边框按钮</Button>
<Button variant="destructive">危险按钮</Button>

// 输入框
import { Input } from "@/components/ui/input";
<Input placeholder="请输入" className="bg-slate-900 border-slate-700" />

// 对话框
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
<Dialog open={show} onOpenChange={setShow}>
  <DialogContent>
    <DialogHeader><DialogTitle>标题</DialogTitle></DialogHeader>
    {/* 内容 */}
  </DialogContent>
</Dialog>

// 标签
import { Badge } from "@/components/ui/badge";
<Badge className="bg-green-500/10 text-green-400">运行中</Badge>

// 表格
import { Table } from "@/components/ui/table";
```

#### 样式规范

```typescript
// 使用 Tailwind CSS 类名

// 卡片样式
<div className="glass-card p-4">内容</div>

// 深色主题配色
// - 背景: bg-slate-900, bg-slate-950
// - 边框: border-slate-700, border-slate-800
// - 文字: text-white, text-slate-300, text-slate-400
// - 强调色: text-cyan-400, text-green-400, text-amber-400

// 响应式布局
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* 内容 */}
</div>
```

---

## 5. 功能实现指南

### 5.1 Pod 管理

#### 功能列表

| 功能 | API 端点 | 前端页面 | 实现位置 |
|------|----------|----------|----------|
| Pod 列表 | GET /api/pods | WorkloadsPage | handlers.go:330 |
| 创建 Pod | POST /api/pods | WorkloadsPage | handlers.go:343 |
| 删除 Pod | DELETE /api/pods | WorkloadsPage | handlers.go:418 |
| Pod 日志 | GET /api/pods/logs | PodDetailDialog | handlers.go:389 |
| Pod YAML | GET /api/pods/yaml | PodYamlEditor | handlers.go:405 |
| Pod 终端 | GET /api/ws/exec | PodTerminal | websocket.go |

#### 实现逻辑

```
用户点击 "查看日志"
       │
       ▼
前端发起 GET /api/pods/logs?name=xxx&namespace=xxx
       │
       ▼
Handler 调用 Client.GetPodLogs()
       │
       ▼
Client 使用 Clientset.CoreV1().Pods().GetLogs()
       │
       ▼
返回日志文本给前端显示
```

### 5.2 Deployment 管理

#### 功能列表

| 功能 | API 端点 | 实现逻辑 |
|------|----------|----------|
| 列表 | GET /api/deployments | 遍历所有命名空间获取 |
| 创建 | POST /api/deployments | 创建 Deployment 资源 |
| 删除 | DELETE /api/deployments | 删除指定 Deployment |
| 扩缩容 | POST /api/deployments/scale | 修改 spec.replicas |
| 重启 | POST /api/deployments/restart | 添加重启注解 |

#### 重启实现原理

```go
// 通过添加/更新注解触发滚动更新
func (c *Client) RestartDeployment(namespace, name string) error {
    deployment, err := c.Clientset.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})

    // 添加重启时间戳注解
    if deployment.Spec.Template.Annotations == nil {
        deployment.Spec.Template.Annotations = make(map[string]string)
    }
    deployment.Spec.Template.Annotations["kubectl.kubernetes.io/restartedAt"] = time.Now().Format(time.RFC3339)

    // 更新 Deployment
    _, err = c.Clientset.AppsV1().Deployments(namespace).Update(ctx, deployment, metav1.UpdateOptions{})
    return err
}
```

### 5.3 Pod 终端 (WebSocket)

#### 架构图

```
┌──────────────────┐    WebSocket     ┌──────────────────┐
│   浏览器          │ ◄──────────────► │   Go 后端        │
│   xterm.js       │                  │   Gin WebSocket  │
└──────────────────┘                  └────────┬─────────┘
                                               │
                                               │ SPDY/WebSocket
                                               ▼
                                      ┌──────────────────┐
                                      │   K8s API Server │
                                      │   Pod Exec API   │
                                      └────────┬─────────┘
                                               │
                                               ▼
                                      ┌──────────────────┐
                                      │   目标 Pod       │
                                      │   /bin/sh 或 bash│
                                      └──────────────────┘
```

#### 前端实现

```typescript
// src/components/ui/PodTerminal.tsx
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";

// 创建 WebSocket 连接
const ws = new WebSocket(`/api/ws/exec?XTransformPort=8080&namespace=${ns}&pod=${pod}&container=${container}`);

// xterm.js 终端
const term = new Terminal({ theme: { background: '#0f172a' } });
const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
term.open(terminalRef.current);

// 双向数据传输
ws.onmessage = (event) => term.write(event.data);
term.onData((data) => ws.send(data));
```

#### 后端实现

```go
// internal/k8s/exec.go
func (c *Client) ExecPodShell(namespace, podName, container string, session TerminalSession) error {
    // 构建 Exec 请求
    req := c.Clientset.CoreV1().RESTClient().Post().
        Resource("pods").
        Name(podName).
        Namespace(namespace).
        SubResource("exec").
        VersionedParams(&corev1.PodExecOptions{
            Container: container,
            Command:   []string{"/bin/sh", "-c", "TERM=xterm-256color; export TERM; exec /bin/sh"},
            Stdin:     true,
            Stdout:    true,
            Stderr:    true,
            TTY:       true,
        }, scheme.ParameterCodec)

    // 建立 SPDY 连接
    executor, err := remotecommand.NewSPDYExecutor(c.Config, "POST", req.URL())
    if err != nil {
        return err
    }

    // 执行并流式传输
    return executor.Stream(remotecommand.StreamOptions{
        Stdin:  session,
        Stdout: session,
        Stderr: session,
        Tty:    true,
    })
}
```

### 5.4 MetalLB 负载均衡器

#### CRD 资源结构

```
MetalLB CRDs
├── IPAddressPool        # IP 地址池定义
│   ├── name
│   ├── addresses[]      # IP 范围 (如 192.168.1.100-192.168.1.200)
│   └── autoAssign
│
├── L2Advertisement      # L2 层广播配置
│   ├── name
│   ├── ipAddressPools[] # 关联的 IP 池
│   └── interfaces[]     # 网络接口
│
└── BGPAdvertisement     # BGP 广播配置
    ├── name
    ├── ipAddressPools[]
    ├── peers[]
    └── communities[]
```

#### GVR 定义

```go
var (
    IPAddressPoolGVR = schema.GroupVersionResource{
        Group:    "metallb.io",
        Version:  "v1beta1",
        Resource: "ipaddresspools",
    }

    L2AdvertisementGVR = schema.GroupVersionResource{
        Group:    "metallb.io",
        Version:  "v1beta1",
        Resource: "l2advertisements",
    }

    BGPAdvertisementGVR = schema.GroupVersionResource{
        Group:    "metallb.io",
        Version:  "v1beta1",
        Resource: "bgpadvertisements",
    }
)
```

#### 实现 IP 池创建

```go
func (c *Client) CreateIPPool(req models.CreateIPPoolRequest) (*models.IPPoolInfo, error) {
    gvr := schema.GroupVersionResource{
        Group:    "metallb.io",
        Version:  "v1beta1",
        Resource: "ipaddresspools",
    }

    // 构建动态资源
    ipPool := &unstructured.Unstructured{
        Object: map[string]interface{}{
            "apiVersion": "metallb.io/v1beta1",
            "kind":       "IPAddressPool",
            "metadata": map[string]interface{}{
                "name":      req.Name,
                "namespace": "metallb-system",
            },
            "spec": map[string]interface{}{
                "addresses":  req.Addresses,
                "autoAssign": req.AutoAssign,
            },
        },
    }

    // 创建资源
    result, err := c.DynamicClient.Resource(gvr).Namespace("metallb-system").Create(ctx, ipPool, metav1.CreateOptions{})
    // ...
}
```

### 5.5 Traefik Ingress Controller

#### 功能列表

| 功能 | API 端点 | 实现方式 |
|------|----------|----------|
| 状态检查 | GET /api/traefik/status | 检查 traefik 命名空间的 Deployment |
| 一键安装 | POST /api/traefik/install | 创建 NS、SA、RBAC、Deployment、Service |
| IngressRoute 列表 | GET /api/traefik/ingressroutes | 动态客户端查询 CRD |
| 创建 IngressRoute | POST /api/traefik/ingressroutes | 动态客户端创建 CRD |

#### 安装实现

```go
func (c *Client) InstallTraefik() error {
    ctx := context.Background()

    // 1. 创建命名空间
    c.Clientset.CoreV1().Namespaces().Create(ctx, &corev1.Namespace{
        ObjectMeta: metav1.ObjectMeta{Name: "traefik"},
    }, metav1.CreateOptions{})

    // 2. 创建 ServiceAccount
    c.Clientset.CoreV1().ServiceAccounts("traefik").Create(ctx, &corev1.ServiceAccount{
        ObjectMeta: metav1.ObjectMeta{Name: "traefik", Namespace: "traefik"},
    }, metav1.CreateOptions{})

    // 3. 创建 ClusterRole (RBAC 权限)
    // 4. 创建 ClusterRoleBinding
    // 5. 创建 Deployment (Traefik Pod)
    // 6. 创建 Service (LoadBalancer 类型)

    return nil
}
```

---

## 6. 扩展新功能步骤

### 6.1 添加新的 K8s 资源管理功能

以添加 "ConfigMap 管理" 为例：

#### Step 1: 定义数据模型

```go
// internal/models/types.go

// ConfigMap 信息
type ConfigMapInfo struct {
    Name       string            `json:"name"`
    Namespace  string            `json:"namespace"`
    Data       map[string]string `json:"data"`
    CreatedAt  string            `json:"createdAt"`
}

// 创建请求
type CreateConfigMapRequest struct {
    Name       string            `json:"name" binding:"required"`
    Namespace  string            `json:"namespace" binding:"required"`
    Data       map[string]string `json:"data"`
}
```

#### Step 2: 实现 K8s 客户端方法

```go
// internal/k8s/client.go

// 获取 ConfigMap 列表
func (c *Client) GetConfigMaps(namespace string) ([]models.ConfigMapInfo, error) {
    ctx := context.Background()
    var configMaps []models.ConfigMapInfo

    if namespace != "" {
        list, err := c.Clientset.CoreV1().ConfigMaps(namespace).List(ctx, metav1.ListOptions{})
        if err != nil {
            return nil, err
        }
        for _, cm := range list.Items {
            configMaps = append(configMaps, models.ConfigMapInfo{
                Name:      cm.Name,
                Namespace: cm.Namespace,
                Data:      cm.Data,
                CreatedAt: cm.CreationTimestamp.Format(time.RFC3339),
            })
        }
    } else {
        // 获取所有命名空间
        namespaces, _ := c.Clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
        for _, ns := range namespaces.Items {
            list, _ := c.Clientset.CoreV1().ConfigMaps(ns.Name).List(ctx, metav1.ListOptions{})
            for _, cm := range list.Items {
                configMaps = append(configMaps, models.ConfigMapInfo{
                    Name:      cm.Name,
                    Namespace: cm.Namespace,
                    Data:      cm.Data,
                    CreatedAt: cm.CreationTimestamp.Format(time.RFC3339),
                })
            }
        }
    }

    return configMaps, nil
}

// 创建 ConfigMap
func (c *Client) CreateConfigMap(req models.CreateConfigMapRequest) (*models.ConfigMapInfo, error) {
    ctx := context.Background()

    cm := &corev1.ConfigMap{
        ObjectMeta: metav1.ObjectMeta{
            Name:      req.Name,
            Namespace: req.Namespace,
        },
        Data: req.Data,
    }

    result, err := c.Clientset.CoreV1().ConfigMaps(req.Namespace).Create(ctx, cm, metav1.CreateOptions{})
    if err != nil {
        return nil, err
    }

    return &models.ConfigMapInfo{
        Name:      result.Name,
        Namespace: result.Namespace,
        Data:      result.Data,
        CreatedAt: result.CreationTimestamp.Format(time.RFC3339),
    }, nil
}
```

#### Step 3: 实现 Handler

```go
// internal/handlers/handlers.go

// 获取 ConfigMap 列表
func (h *Handler) GetConfigMaps(c *gin.Context) {
    if h.Client == nil {
        c.JSON(http.StatusInternalServerError, models.ErrorResponse{
            Success: false,
            Error:   "Kubernetes client not initialized",
        })
        return
    }

    namespace := c.Query("namespace")
    configMaps, err := h.Client.GetConfigMaps(namespace)
    if err != nil {
        c.JSON(http.StatusInternalServerError, models.ErrorResponse{
            Success: false,
            Error:   err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, configMaps)
}

// 创建 ConfigMap
func (h *Handler) CreateConfigMap(c *gin.Context) {
    if h.Client == nil {
        c.JSON(http.StatusInternalServerError, models.ErrorResponse{
            Success: false,
            Error:   "Kubernetes client not initialized",
        })
        return
    }

    var req models.CreateConfigMapRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, models.ErrorResponse{
            Success: false,
            Error:   err.Error(),
        })
        return
    }

    configMap, err := h.Client.CreateConfigMap(req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, models.ErrorResponse{
            Success: false,
            Error:   err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, configMap)
}
```

#### Step 4: 注册路由

```go
// internal/router/router.go

func SetupRouter(h *handlers.Handler) *gin.Engine {
    // ...

    api := r.Group("/api")
    {
        // ... 其他路由

        // ConfigMaps
        api.GET("/configmaps", h.GetConfigMaps)
        api.POST("/configmaps", h.CreateConfigMap)
        api.DELETE("/configmaps", h.DeleteConfigMap)
    }

    // ...
}
```

#### Step 5: 创建前端页面

```typescript
// src/components/pages/ConfigMapsPage.tsx

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
// ... 其他导入

interface ConfigMapInfo {
  name: string;
  namespace: string;
  data: Record<string, string>;
  createdAt: string;
}

export default function ConfigMapsPage() {
  const { toast } = useToast();
  const [configMaps, setConfigMaps] = useState<ConfigMapInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfigMaps();
  }, []);

  const fetchConfigMaps = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/configmaps?XTransformPort=8080');
      if (response.ok) {
        setConfigMaps(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* 页面内容 */}
    </div>
  );
}
```

### 6.2 添加新的 CRD 资源管理

以添加 "Prometheus Rule" 为例：

#### Step 1: 定义 GVR

```go
// internal/k8s/prometheus.go

var PrometheusRuleGVR = schema.GroupVersionResource{
    Group:    "monitoring.coreos.com",
    Version:  "v1",
    Resource: "prometheusrules",
}
```

#### Step 2: 使用动态客户端

```go
func (c *Client) GetPrometheusRules(namespace string) ([]models.PrometheusRuleInfo, error) {
    ctx := context.Background()

    list, err := c.DynamicClient.Resource(PrometheusRuleGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
    if err != nil {
        return nil, err
    }

    var rules []models.PrometheusRuleInfo
    for _, item := range list.Items {
        rules = append(rules, models.PrometheusRuleInfo{
            Name:      item.GetName(),
            Namespace: item.GetNamespace(),
            // 从 Unstructured 中提取数据
            Groups:    extractRuleGroups(item.Object),
        })
    }

    return rules, nil
}
```

---

## 7. 常见问题与解决方案

### 7.0 功能丢失问题（重要！）

**问题**: 已开发的功能在开发新功能时丢失

**根本原因**:
1. 使用 `Write` 工具完全重写文件，覆盖了原有功能
2. 没有先读取现有文件内容就进行修改
3. 开发完成后没有验证所有功能是否正常

**开发规范（必须遵守）**:

```
🚫 禁止：使用 Write 工具修改现有文件
✅ 必须：先使用 Read 工具读取文件内容
✅ 必须：使用 Edit/MultiEdit 工具进行增量修改
✅ 必须：修改后运行 bun run lint 检查代码
✅ 必须：验证相关功能是否正常工作
✅ 必须：每次修复后推送到远程仓库
```

**工作流程**:

```
1. 开发前：git pull 拉取最新代码
2. 开发中：
   - Read 读取目标文件
   - Edit/MultiEdit 增量修改
   - bun run lint 检查语法
3. 开发后：
   - 验证功能是否正常
   - git add & commit
   - git push 推送到远程
4. 更新 worklog.md 记录修改内容
```

**验证清单**:

每次开发完成后，检查以下内容：
- [ ] 新功能是否正常工作
- [ ] 相关页面的其他按钮是否正常
- [ ] 代码是否通过 lint 检查
- [ ] 是否已推送到远程仓库
- [ ] worklog.md 是否已更新

### 7.1 Kubernetes 客户端未初始化

**问题**: API 返回 `Kubernetes client not initialized`

**原因**: kubeconfig 文件不存在或路径错误

**解决方案**:
```bash
# 检查 kubeconfig 文件
ls -la ~/.kube/config

# 如果不存在，从 K3s 复制
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $USER:$USER ~/.kube/config
chmod 600 ~/.kube/config

# 重启后端服务
cd mini-services/k8s-service && ./k8s-service
```

### 7.2 CRD 资源不存在

**问题**: 动态客户端返回 404 错误

**原因**: CRD 未安装

**解决方案**:
```bash
# 检查 CRD 是否存在
kubectl get crd | grep metallb

# 安装 CRD
kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/main/config/crd/metallb.io_ipaddresspools.yaml
```

### 7.3 WebSocket 连接失败

**问题**: Pod 终端无法连接

**检查清单**:
1. WebSocket 路由是否正确: `/api/ws/exec?XTransformPort=8080`
2. Pod 是否运行
3. 容器是否有 shell (`/bin/sh` 或 `/bin/bash`)
4. K8s API Server 是否可达

### 7.4 CORS 错误

**解决方案**: 确保后端配置了正确的 CORS

```go
r.Use(cors.New(cors.Config{
    AllowOrigins:     []string{"*"},
    AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
    AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
    AllowCredentials: true,
}))
```

### 7.5 大文件推送警告

**问题**: GitHub 警告文件超过 50MB

**解决方案**: 将二进制文件添加到 .gitignore

```gitignore
# Binaries
mini-services/k8s-service/k8s-service
*.exe
```

---

## 附录

### A. API 端点完整列表

| 资源 | 方法 | 端点 | 功能 |
|------|------|------|------|
| Status | GET | /api/status | 集群连接状态 |
| Overview | GET | /api/overview | 集群概览 |
| Nodes | GET | /api/nodes | 节点列表 |
| Nodes | GET | /api/nodes/:name | 节点详情 |
| Nodes | POST | /api/nodes/:name/cordon | 停止调度 |
| Nodes | POST | /api/nodes/:name/uncordon | 恢复调度 |
| Nodes | POST | /api/nodes/:name/drain | 驱逐 Pod |
| Namespaces | GET | /api/namespaces | 命名空间列表 |
| Namespaces | POST | /api/namespaces | 创建命名空间 |
| Namespaces | DELETE | /api/namespaces/:name | 删除命名空间 |
| Pods | GET | /api/pods | Pod 列表 |
| Pods | POST | /api/pods | 创建 Pod |
| Pods | DELETE | /api/pods | 删除 Pod |
| Pods | GET | /api/pods/logs | Pod 日志 |
| Pods | GET | /api/pods/yaml | Pod YAML |
| Pods | PUT | /api/pods/yaml | 更新 Pod YAML |
| Deployments | GET | /api/deployments | Deployment 列表 |
| Deployments | POST | /api/deployments | 创建 Deployment |
| Deployments | DELETE | /api/deployments | 删除 Deployment |
| Deployments | POST | /api/deployments/scale | 扩缩容 |
| Deployments | POST | /api/deployments/restart | 重启 |
| StatefulSets | GET | /api/statefulsets | 列表 |
| StatefulSets | POST | /api/statefulsets | 创建 |
| StatefulSets | DELETE | /api/statefulsets | 删除 |
| StatefulSets | POST | /api/statefulsets/scale | 扩缩容 |
| StatefulSets | POST | /api/statefulsets/restart | 重启 |
| DaemonSets | GET | /api/daemonsets | 列表 |
| DaemonSets | POST | /api/daemonsets | 创建 |
| DaemonSets | DELETE | /api/daemonsets | 删除 |
| DaemonSets | POST | /api/daemonsets/restart | 重启 |
| Jobs | GET | /api/jobs | 列表 |
| Jobs | POST | /api/jobs | 创建 |
| Jobs | DELETE | /api/jobs | 删除 |
| CronJobs | GET | /api/cronjobs | 列表 |
| CronJobs | POST | /api/cronjobs | 创建 |
| CronJobs | DELETE | /api/cronjobs | 删除 |
| CronJobs | POST | /api/cronjobs/suspend | 暂停/恢复 |
| CronJobs | POST | /api/cronjobs/trigger | 手动触发 |
| Services | GET | /api/services | 列表 |
| Ingresses | GET | /api/ingresses | 列表 |
| ConfigMaps | GET | /api/configmaps | 列表 |
| ConfigMaps | POST | /api/configmaps | 创建 |
| ConfigMaps | DELETE | /api/configmaps | 删除 |
| Secrets | GET | /api/secrets | 列表 |
| Secrets | DELETE | /api/secrets | 删除 |
| PVCs | GET | /api/pvcs | 列表 |
| PVs | GET | /api/pvs | 列表 |
| StorageClasses | GET | /api/storageclasses | 列表 |
| Events | GET | /api/events | 列表 |
| ServiceAccounts | GET | /api/serviceaccounts | 列表 |
| Roles | GET | /api/roles | 列表 |
| RoleBindings | GET | /api/rolebindings | 列表 |
| WebSocket | GET | /api/ws/exec | Pod 终端 |
| MetalLB | GET | /api/metallb/status | 状态 |
| MetalLB | POST | /api/metallb/install | 安装 |
| MetalLB | GET | /api/metallb/ippools | IP 池列表 |
| MetalLB | POST | /api/metallb/ippools | 创建 IP 池 |
| MetalLB | DELETE | /api/metallb/ippools/:name | 删除 IP 池 |
| MetalLB | GET | /api/metallb/l2advertisements | L2 广告列表 |
| MetalLB | POST | /api/metallb/l2advertisements | 创建 L2 广告 |
| MetalLB | DELETE | /api/metallb/l2advertisements/:name | 删除 L2 广告 |
| Traefik | GET | /api/traefik/status | 状态 |
| Traefik | POST | /api/traefik/install | 安装 |
| Traefik | GET | /api/traefik/ingressroutes | IngressRoute 列表 |
| Traefik | POST | /api/traefik/ingressroutes | 创建 IngressRoute |
| Traefik | DELETE | /api/traefik/ingressroutes | 删除 IngressRoute |
| Traefik | GET | /api/traefik/middlewares | Middleware 列表 |
| Traefik | GET | /api/traefik/tlsoptions | TLS 选项 |

### B. 前端页面组件列表

| 文件名 | 页面功能 | 对应菜单 |
|--------|----------|----------|
| DashboardPage.tsx | 仪表板 | 概览 |
| WorkloadsPage.tsx | Pod 管理 | 工作负载 > Pod |
| DeploymentsPage.tsx | Deployment 管理 | 工作负载 > Deployment |
| StatefulSetsPage.tsx | StatefulSet 管理 | 工作负载 > StatefulSet |
| DaemonSetsPage.tsx | DaemonSet 管理 | 工作负载 > DaemonSet |
| JobsPage.tsx | Job 管理 | 工作负载 > Job |
| CronJobsPage.tsx | CronJob 管理 | 工作负载 > CronJob |
| ServicesPage.tsx | Service 管理 | 网络 > Service |
| IngressPage.tsx | Ingress 管理 | 网络 > Ingress |
| TraefikPage.tsx | Traefik 网关 | 网络 > Traefik |
| LoadBalancerPage.tsx | MetalLB 负载均衡 | 网络 > 负载均衡 |
| StoragePage.tsx | ConfigMap/Secret/PVC | 存储 |
| PVPage.tsx | PV 管理 | 存储 > PV |
| StorageClassPage.tsx | StorageClass 管理 | 存储 > StorageClass |
| NodesPage.tsx | 节点管理 | 集群 > 节点 |
| NamespacesPage.tsx | 命名空间管理 | 集群 > 命名空间 |
| EventsPage.tsx | 事件日志 | 集群 > 事件 |
| RBACPage.tsx | RBAC 管理 | 集群 > RBAC |
| HelmPage.tsx | Helm 应用商店 | 应用 |
| ImageRegistryPage.tsx | 镜像仓库 | 应用 > 镜像仓库 |
| MonitorAlertPage.tsx | 监控告警 | 监控 |
| APMMonitorPage.tsx | APM 监控 | 监控 > APM |
| VisualizationDashboardPage.tsx | 可视化大屏 | 可视化 |
| NodeAutoJoinPage.tsx | 节点自动接入 | 集群 |
| ClustersPage.tsx | 集群管理 | 集群 |
| SettingsPage.tsx | 系统设置 | 设置 |

### C. 环境变量配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| PORT | 8080 | 后端服务端口 |
| HOST | 0.0.0.0 | 后端服务地址 |
| KUBECONFIG | ~/.kube/config | kubeconfig 文件路径 |
| IN_CLUSTER | false | 是否集群内模式 |
| READ_TIMEOUT | 30 | 读取超时（秒） |
| WRITE_TIMEOUT | 30 | 写入超时（秒） |

---

**文档版本**: 1.0
**最后更新**: 2026-03-08
**维护者**: KubeNext Team
