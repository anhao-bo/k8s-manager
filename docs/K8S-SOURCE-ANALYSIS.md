# Kubernetes client-go 源码分析

## 目录

1. [概述](#1-概述)
2. [核心架构](#2-核心架构)
3. [Clientset 类型客户端](#3-clientset-类型客户端)
4. [DynamicClient 动态客户端](#4-dynamicclient-动态客户端)
5. [RESTClient 底层客户端](#5-restclient-底层客户端)
6. [Informer 机制](#6-informer-机制)
7. [项目中的应用](#7-项目中的应用)

---

## 1. 概述

### 1.1 什么是 client-go

`client-go` 是 Kubernetes 官方提供的 Go 语言客户端库，用于与 Kubernetes API Server 交互。它是构建 Kubernetes 控制器、operator 和管理工具的基础。

### 1.2 版本对应关系

| client-go 版本 | Kubernetes 版本 |
|---------------|-----------------|
| v0.35.x       | v1.35.x         |
| v0.34.x       | v1.34.x         |
| v0.33.x       | v1.33.x         |

### 1.3 源码位置

```
third-party/
├── client-go/         # Kubernetes Go 客户端库
├── api/               # Kubernetes API 类型定义
└── apimachinery/      # API 通用工具库
```

---

## 2. 核心架构

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户代码                                   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Clientset   │     │ DynamicClient │     │  RESTClient   │
│  (类型安全)    │     │  (动态/CRD)   │     │  (底层HTTP)   │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │    rest.Config    │
                    │   (连接配置)       │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   HTTP Transport  │
                    │  (TLS/Auth/Rate)  │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  Kubernetes API   │
                    │     Server        │
                    └───────────────────┘
```

### 2.2 核心包结构

```go
// client-go 目录结构
client-go/
├── kubernetes/           // Clientset - 类型安全客户端
│   ├── clientset.go      // Clientset 定义
│   ├── typed/            // 各 API 组的类型客户端
│   │   ├── corev1/       // Core API (Pod, Service, ConfigMap...)
│   │   ├── appsv1/       // Apps API (Deployment, StatefulSet...)
│   │   ├── batchv1/      // Batch API (Job, CronJob...)
│   │   └── ...
│   └── scheme/           // 序列化 Scheme
│
├── dynamic/              // DynamicClient - 动态客户端
│   ├── interface.go      // 接口定义
│   └── simple.go         // 实现
│
├── rest/                 // RESTClient - 底层客户端
│   ├── config.go         // 配置管理
│   ├── client.go         // RESTClient 实现
│   └── request.go        // 请求构建
│
├── tools/                // 工具包
│   ├── cache/            // Informer/Reflector/Store
│   ├── clientcmd/        // kubeconfig 加载
│   └── leaderelection/   // Leader 选举
│
├── informers/            // 生成的 Informer
├── listers/              // 生成的 Lister
└── util/                 // 工具函数
```

---

## 3. Clientset 类型客户端

### 3.1 接口定义

```go
// third-party/client-go/kubernetes/clientset.go

// Interface 定义了所有 API 组的访问接口
type Interface interface {
    Discovery() discovery.DiscoveryInterface
    
    // 核心 API
    CoreV1() corev1.CoreV1Interface
    
    // Apps API
    AppsV1() appsv1.AppsV1Interface
    AppsV1beta1() appsv1beta1.AppsV1beta1Interface
    AppsV1beta2() appsv1beta2.AppsV1beta2Interface
    
    // Batch API
    BatchV1() batchv1.BatchV1Interface
    BatchV1beta1() batchv1beta1.BatchV1beta1Interface
    
    // Networking API
    NetworkingV1() networkingv1.NetworkingV1Interface
    
    // RBAC API
    RbacV1() rbacv1.RbacV1Interface
    
    // ... 其他 API 组
}

// Clientset 实现了 Interface
type Clientset struct {
    *discovery.DiscoveryClient
    coreV1            *corev1.CoreV1Client
    appsV1            *appsv1.AppsV1Client
    batchV1           *batchv1.BatchV1Client
    networkingV1      *networkingv1.NetworkingV1Client
    // ... 其他客户端
}
```

### 3.2 创建 Clientset

```go
// 使用 rest.Config 创建 Clientset
func NewForConfig(c *rest.Config) (*Clientset, error) {
    configShallowCopy := *c
    
    // 设置默认 UserAgent
    if configShallowCopy.UserAgent == "" {
        configShallowCopy.UserAgent = rest.DefaultKubernetesUserAgent()
    }
    
    // 创建共享的 HTTP 客户端
    httpClient, err := rest.HTTPClientFor(&configShallowCopy)
    if err != nil {
        return nil, err
    }
    
    return NewForConfigAndClient(&configShallowCopy, httpClient)
}

// 创建每个 API 组的客户端
func NewForConfigAndClient(c *rest.Config, httpClient *http.Client) (*Clientset, error) {
    var cs Clientset
    
    // 创建各 API 组客户端（共享 HTTP 连接）
    cs.coreV1, err = corev1.NewForConfigAndClient(&configShallowCopy, httpClient)
    cs.appsV1, err = appsv1.NewForConfigAndClient(&configShallowCopy, httpClient)
    cs.batchV1, err = batchv1.NewForConfigAndClient(&configShallowCopy, httpClient)
    // ...
    
    return &cs, nil
}
```

### 3.3 CoreV1Interface 示例

```go
// CoreV1Interface 定义了核心资源的操作
type CoreV1Interface interface {
    RESTClient() rest.Interface
    
    // 资源接口
    PodsGetter
    ServicesGetter
    ConfigMapsGetter
    SecretsGetter
    PersistentVolumesGetter
    PersistentVolumeClaimsGetter
    NamespacesGetter
    NodesGetter
    EventsGetter
    // ...
}

// PodsGetter 提供 Pod 操作
type PodsGetter interface {
    Pods(namespace string) PodInterface
}

// PodInterface 定义 Pod 的 CRUD 操作
type PodInterface interface {
    Create(ctx context.Context, pod *v1.Pod, opts metav1.CreateOptions) (*v1.Pod, error)
    Update(ctx context.Context, pod *v1.Pod, opts metav1.UpdateOptions) (*v1.Pod, error)
    Delete(ctx context.Context, name string, opts metav1.DeleteOptions) error
    Get(ctx context.Context, name string, opts metav1.GetOptions) (*v1.Pod, error)
    List(ctx context.Context, opts metav1.ListOptions) (*v1.PodList, error)
    Watch(ctx context.Context, opts metav1.ListOptions) (watch.Interface, error)
    Patch(ctx context.Context, name string, pt types.PatchType, data []byte, opts metav1.PatchOptions, subresources ...string) (*v1.Pod, error)
    
    // 子资源
    GetLogs(name string, opts *v1.PodLogOptions) *rest.Request
    Exec(ctx context.Context, name string, opts *v1.PodExecOptions) (*remotecommand.Executor, error)
    // ...
}
```

### 3.4 使用示例

```go
// 项目中的使用方式
// mini-services/k8s-service/internal/k8s/client.go

func (c *Client) GetPods(namespace string) ([]models.PodInfo, error) {
    ctx := context.Background()
    var pods []models.PodInfo
    
    if namespace != "" {
        // 使用 Clientset.CoreV1().Pods(namespace).List()
        list, err := c.Clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
        // ...
    }
    
    return pods, nil
}

func (c *Client) GetPodLogs(namespace, name, container string, tailLines int64) (string, error) {
    ctx := context.Background()
    
    // 构建 Pod 日志请求
    req := c.Clientset.CoreV1().Pods(namespace).GetLogs(name, &corev1.PodLogOptions{
        Container: container,
        TailLines: &tailLines,
    })
    
    // 执行请求并读取流
    stream, err := req.Stream(ctx)
    // ...
}
```

---

## 4. DynamicClient 动态客户端

### 4.1 接口定义

```go
// third-party/client-go/dynamic/interface.go

// Interface 动态客户端接口
type Interface interface {
    Resource(resource schema.GroupVersionResource) NamespaceableResourceInterface
}

// ResourceInterface 定义资源操作（使用 Unstructured）
type ResourceInterface interface {
    Create(ctx context.Context, obj *unstructured.Unstructured, options metav1.CreateOptions, subresources ...string) (*unstructured.Unstructured, error)
    Update(ctx context.Context, obj *unstructured.Unstructured, options metav1.UpdateOptions, subresources ...string) (*unstructured.Unstructured, error)
    UpdateStatus(ctx context.Context, obj *unstructured.Unstructured, options metav1.UpdateOptions) (*unstructured.Unstructured, error)
    Delete(ctx context.Context, name string, options metav1.DeleteOptions, subresources ...string) error
    DeleteCollection(ctx context.Context, options metav1.DeleteOptions, listOptions metav1.ListOptions) error
    Get(ctx context.Context, name string, options metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error)
    List(ctx context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error)
    Watch(ctx context.Context, opts metav1.ListOptions) (watch.Interface, error)
    Patch(ctx context.Context, name string, pt types.PatchType, data []byte, options metav1.PatchOptions, subresources ...string) (*unstructured.Unstructured, error)
    Apply(ctx context.Context, name string, obj *unstructured.Unstructured, options metav1.ApplyOptions, subresources ...string) (*unstructured.Unstructured, error)
    ApplyStatus(ctx context.Context, name string, obj *unstructured.Unstructured, options metav1.ApplyOptions) (*unstructured.Unstructured, error)
}

// NamespaceableResourceInterface 支持命名空间切换
type NamespaceableResourceInterface interface {
    Namespace(string) ResourceInterface
    ResourceInterface
}
```

### 4.2 GroupVersionResource (GVR)

```go
// GVR 用于标识 CRD 资源
type GroupVersionResource struct {
    Group    string  // API 组，如 "metallb.io"
    Version  string  // API 版本，如 "v1beta1"
    Resource string  // 资源类型，如 "ipaddresspools"
}

// MetalLB GVR 示例
var IPAddressPoolGVR = schema.GroupVersionResource{
    Group:    "metallb.io",
    Version:  "v1beta1",
    Resource: "ipaddresspools",
}

// Traefik GVR 示例
var IngressRouteGVR = schema.GroupVersionResource{
    Group:    "traefik.io",
    Version:  "v1",
    Resource: "ingressroutes",
}
```

### 4.3 Unstructured 类型

```go
// Unstructured 是动态客户端使用的通用类型
type Unstructured struct {
    // Object 是一个 map[string]interface{}，可以表示任何 K8s 资源
    Object map[string]interface{}
}

// 获取元数据
func (u *Unstructured) GetName() string
func (u *Unstructured) GetNamespace() string
func (u *Unstructured) GetLabels() map[string]string
func (u *Unstructured) GetAnnotations() map[string]string

// 获取 spec
func (u *Unstructured) UnstructuredContent() map[string]interface{}
```

### 4.4 项目中使用动态客户端

```go
// mini-services/k8s-service/internal/k8s/metallb.go

func (c *Client) GetIPPools() ([]models.IPPoolInfo, error) {
    ctx := context.Background()
    
    // 定义 GVR
    gvr := schema.GroupVersionResource{
        Group:    "metallb.io",
        Version:  "v1beta1",
        Resource: "ipaddresspools",
    }
    
    // 使用动态客户端查询
    list, err := c.DynamicClient.Resource(gvr).Namespace("metallb-system").List(ctx, metav1.ListOptions{})
    if err != nil {
        return nil, err
    }
    
    // 解析 Unstructured 到模型
    var pools []models.IPPoolInfo
    for _, item := range list.Items {
        pools = append(pools, models.IPPoolInfo{
            Name:      item.GetName(),
            Namespace: item.GetNamespace(),
            // 从 Object 中提取 spec
            Addresses: extractAddresses(item.Object),
        })
    }
    
    return pools, nil
}

func (c *Client) CreateIPPool(req models.CreateIPPoolRequest) (*models.IPPoolInfo, error) {
    ctx := context.Background()
    
    // 构建 Unstructured 对象
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

---

## 5. RESTClient 底层客户端

### 5.1 Config 配置结构

```go
// third-party/client-go/rest/config.go

// Config 是 K8s 客户端的核心配置
type Config struct {
    // API Server 地址
    Host string
    
    // API 路径前缀
    APIPath string
    
    // 内容配置
    ContentConfig
    
    // 认证信息
    Username string
    Password string
    BearerToken string
    BearerTokenFile string
    
    // 模拟用户
    Impersonate ImpersonationConfig
    
    // TLS 配置
    TLSClientConfig
    
    // UserAgent
    UserAgent string
    
    // 限流配置
    QPS   float32  // 每秒请求数，默认 5
    Burst int      // 突发请求数，默认 10
    RateLimiter flowcontrol.RateLimiter
    
    // 超时
    Timeout time.Duration
    
    // 代理
    Proxy func(*http.Request) (*url.URL, error)
    
    // 自定义 Transport
    Transport http.RoundTripper
    WrapTransport transport.WrapperFunc
}

// TLSClientConfig TLS 配置
type TLSClientConfig struct {
    Insecure   bool     // 跳过证书验证
    ServerName string   // SNI 服务器名
    
    CertFile string     // 客户端证书文件
    KeyFile  string     // 客户端私钥文件
    CAFile   string     // CA 证书文件
    
    CertData []byte     // 客户端证书数据
    KeyData  []byte     // 客户端私钥数据
    CAData   []byte     // CA 证书数据
}
```

### 5.2 集群内配置

```go
// InClusterConfig 用于 Pod 内部访问 API Server
func InClusterConfig() (*Config, error) {
    const (
        tokenFile  = "/var/run/secrets/kubernetes.io/serviceaccount/token"
        rootCAFile = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
    )
    
    // 从环境变量获取 API Server 地址
    host, port := os.Getenv("KUBERNETES_SERVICE_HOST"), os.Getenv("KUBERNETES_SERVICE_PORT")
    if len(host) == 0 || len(port) == 0 {
        return nil, ErrNotInCluster
    }
    
    // 读取 ServiceAccount Token
    token, err := os.ReadFile(tokenFile)
    if err != nil {
        return nil, err
    }
    
    return &Config{
        Host:            "https://" + net.JoinHostPort(host, port),
        TLSClientConfig: TLSClientConfig{CAFile: rootCAFile},
        BearerToken:     string(token),
        BearerTokenFile: tokenFile,
    }, nil
}
```

### 5.3 项目中的配置加载

```go
// mini-services/k8s-service/internal/k8s/client.go

func NewClient(kubeconfigPath string, inCluster bool) (*Client, error) {
    var config *rest.Config
    var err error

    if inCluster {
        // 集群内模式
        config, err = rest.InClusterConfig()
        if err != nil {
            return nil, fmt.Errorf("failed to get in-cluster config: %w", err)
        }
    } else {
        // 集群外模式
        if kubeconfigPath == "" {
            // 使用默认 kubeconfig 路径
            if home := homedir.HomeDir(); home != "" {
                kubeconfigPath = filepath.Join(home, ".kube", "config")
            }
        }

        // 从 kubeconfig 文件构建配置
        config, err = clientcmd.BuildConfigFromFlags("", kubeconfigPath)
        if err != nil {
            return nil, fmt.Errorf("failed to build config from kubeconfig: %w", err)
        }
    }

    // 创建 Clientset
    clientset, err := kubernetes.NewForConfig(config)
    
    // 创建 DynamicClient
    dynamicClient, err := dynamic.NewForConfig(config)
    
    return &Client{
        Clientset:     clientset,
        DynamicClient: dynamicClient,
        Config:        config,
    }, nil
}
```

---

## 6. Informer 机制

### 6.1 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Kubernetes API Server                         │
└───────────────────────────────┬─────────────────────────────────┘
                                │ LIST/WATCH
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Reflector                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  1. LIST 获取初始数据快照                                 │   │
│  │  2. WATCH 监听后续变更                                    │   │
│  │  3. 使用 resourceVersion 保证数据一致性                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Push
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DeltaFIFO                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  存储变更事件: Added, Updated, Deleted, Sync             │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Pop
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Indexer (Store)                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  本地缓存: map[key]object                                │   │
│  │  索引: 支持多种查询方式                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Trigger
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Event Handlers                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  OnAdd(obj), OnUpdate(old, new), OnDelete(obj)           │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Add key
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        WorkQueue                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  限速队列，支持重试和指数退避                             │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Process
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Controller                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  业务逻辑处理                                            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 核心组件

```go
// tools/cache/controller.go

// Controller 控制器接口
type Controller interface {
    Run(stopCh <-chan struct{})
    HasSynced() bool
}

// Informer 接口
type SharedInformer interface {
    AddEventHandler(handler ResourceEventHandler)
    AddEventHandlerWithResyncPeriod(handler ResourceEventHandler, resyncPeriod time.Duration)
    GetStore() Store
    GetController() Controller
    Run(stopCh <-chan struct{})
    HasSynced() bool
    LastSyncResourceVersion() string
}

// ResourceEventHandler 事件处理接口
type ResourceEventHandler interface {
    OnAdd(obj interface{})
    OnUpdate(oldObj, newObj interface{})
    OnDelete(obj interface{})
}
```

### 6.3 使用 Informer

```go
// 创建 SharedInformerFactory
func main() {
    config, _ := clientcmd.BuildConfigFromFlags("", kubeconfig)
    clientset, _ := kubernetes.NewForConfig(config)
    
    // 创建 InformerFactory
    factory := informers.NewSharedInformerFactory(clientset, time.Minute*10)
    
    // 获取 Pod Informer
    podInformer := factory.Core().V1().Pods()
    
    // 注册事件处理器
    podInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
        AddFunc: func(obj interface{}) {
            pod := obj.(*v1.Pod)
            fmt.Printf("Pod Added: %s/%s\n", pod.Namespace, pod.Name)
        },
        UpdateFunc: func(oldObj, newObj interface{}) {
            oldPod := oldObj.(*v1.Pod)
            newPod := newObj.(*v1.Pod)
            fmt.Printf("Pod Updated: %s/%s\n", newPod.Namespace, newPod.Name)
        },
        DeleteFunc: func(obj interface{}) {
            pod := obj.(*v1.Pod)
            fmt.Printf("Pod Deleted: %s/%s\n", pod.Namespace, pod.Name)
        },
    })
    
    // 启动 Informer
    stopCh := make(chan struct{})
    defer close(stopCh)
    
    factory.Start(stopCh)
    
    // 等待缓存同步
    if !cache.WaitForCacheSync(stopCh, podInformer.Informer().HasSynced) {
        panic("failed to sync cache")
    }
    
    // 使用 Lister 读取缓存（不访问 API Server）
    pods, _ := podInformer.Lister().Pods("default").List(labels.Everything())
    for _, pod := range pods {
        fmt.Println(pod.Name)
    }
    
    <-stopCh
}
```

---

## 7. 项目中的应用

### 7.1 客户端封装

```go
// mini-services/k8s-service/internal/k8s/client.go

type Client struct {
    Clientset     *kubernetes.Clientset    // 类型安全客户端
    DynamicClient dynamic.Interface         // 动态客户端 (CRD)
    Config        *rest.Config              // REST 配置
    Namespace     string                    // 默认命名空间
}
```

### 7.2 类型客户端使用场景

| 资源 | 使用 Clientset | 原因 |
|------|---------------|------|
| Pod | `Clientset.CoreV1().Pods()` | 内置资源，类型安全 |
| Deployment | `Clientset.AppsV1().Deployments()` | 内置资源，类型安全 |
| Service | `Clientset.CoreV1().Services()` | 内置资源，类型安全 |
| ConfigMap | `Clientset.CoreV1().ConfigMaps()` | 内置资源，类型安全 |
| Job | `Clientset.BatchV1().Jobs()` | 内置资源，类型安全 |

### 7.3 动态客户端使用场景

| 资源 | 使用 DynamicClient | 原因 |
|------|-------------------|------|
| IPAddressPool | `DynamicClient.Resource(gvr)` | CRD，无类型定义 |
| L2Advertisement | `DynamicClient.Resource(gvr)` | CRD，无类型定义 |
| IngressRoute | `DynamicClient.Resource(gvr)` | Traefik CRD |
| Middleware | `DynamicClient.Resource(gvr)` | Traefik CRD |

### 7.4 完整示例：创建 Deployment

```go
func (c *Client) CreateDeployment(req models.CreateDeploymentRequest) (*models.DeploymentInfo, error) {
    ctx := context.Background()
    
    // 构建 Deployment 对象
    replicas := int32(req.Replicas)
    deployment := &appsv1.Deployment{
        ObjectMeta: metav1.ObjectMeta{
            Name:      req.Name,
            Namespace: req.Namespace,
            Labels:    req.Labels,
        },
        Spec: appsv1.DeploymentSpec{
            Replicas: &replicas,
            Selector: &metav1.LabelSelector{
                MatchLabels: req.Labels,
            },
            Template: corev1.PodTemplateSpec{
                ObjectMeta: metav1.ObjectMeta{
                    Labels: req.Labels,
                },
                Spec: corev1.PodSpec{
                    Containers: []corev1.Container{
                        {
                            Name:  req.Name,
                            Image: req.Image,
                            Ports: []corev1.ContainerPort{
                                {ContainerPort: int32(req.Port)},
                            },
                        },
                    },
                },
            },
        },
    }
    
    // 使用 Clientset 创建
    result, err := c.Clientset.AppsV1().Deployments(req.Namespace).Create(ctx, deployment, metav1.CreateOptions{})
    if err != nil {
        return nil, err
    }
    
    return &models.DeploymentInfo{
        Name:      result.Name,
        Namespace: result.Namespace,
        Replicas:  int(*result.Spec.Replicas),
        // ...
    }, nil
}
```

### 7.5 完整示例：操作 CRD

```go
// 创建 MetalLB IP 地址池
func (c *Client) CreateIPPool(req models.CreateIPPoolRequest) (*models.IPPoolInfo, error) {
    ctx := context.Background()
    
    gvr := schema.GroupVersionResource{
        Group:    "metallb.io",
        Version:  "v1beta1",
        Resource: "ipaddresspools",
    }
    
    // 使用 Unstructured 构建 CRD 对象
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
    
    // 使用 DynamicClient 创建
    result, err := c.DynamicClient.Resource(gvr).Namespace("metallb-system").Create(ctx, ipPool, metav1.CreateOptions{})
    if err != nil {
        return nil, err
    }
    
    return &models.IPPoolInfo{
        Name:      result.GetName(),
        Namespace: result.GetNamespace(),
        Addresses: extractStringSlice(result.Object, "spec.addresses"),
    }, nil
}

// 辅助函数：从 Unstructured 提取字符串数组
func extractStringSlice(obj map[string]interface{}, path string) []string {
    parts := strings.Split(path, ".")
    current := obj
    
    for i, part := range parts {
        if i == len(parts)-1 {
            if val, ok := current[part].([]interface{}); ok {
                var result []string
                for _, v := range val {
                    if s, ok := v.(string); ok {
                        result = append(result, s)
                    }
                }
                return result
            }
        }
        if next, ok := current[part].(map[string]interface{}); ok {
            current = next
        } else {
            break
        }
    }
    return nil
}
```

---

## 附录

### A. 常用 GVR 列表

| 资源 | Group | Version | Resource |
|------|-------|---------|----------|
| Pod | "" | v1 | pods |
| Service | "" | v1 | services |
| ConfigMap | "" | v1 | configmaps |
| Secret | "" | v1 | secrets |
| Deployment | apps | v1 | deployments |
| StatefulSet | apps | v1 | statefulsets |
| DaemonSet | apps | v1 | daemonsets |
| Job | batch | v1 | jobs |
| CronJob | batch | v1 | cronjobs |
| Ingress | networking.k8s.io | v1 | ingresses |
| IPAddressPool | metallb.io | v1beta1 | ipaddresspools |
| L2Advertisement | metallb.io | v1beta1 | l2advertisements |
| IngressRoute | traefik.io | v1 | ingressroutes |

### B. 参考链接

- [client-go 官方文档](https://github.com/kubernetes/client-go)
- [client-go ARCHITECTURE.md](../third-party/client-go/ARCHITECTURE.md)
- [Kubernetes API 参考](https://kubernetes.io/docs/reference/kubernetes-api/)

---

**文档版本**: 1.0
**最后更新**: 2026-03-08
**源码版本**: k8s.io/client-go v0.35.2
