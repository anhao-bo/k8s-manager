package handlers

import (
        "net/http"
        "os"
        "path/filepath"
        "strconv"
        "sync"

        "k8s-service/internal/k8s"
        "k8s-service/internal/models"

        "github.com/gin-gonic/gin"
)

// Handler 处理器
type Handler struct {
        Client      *k8s.Client
        clientMutex sync.RWMutex
}

// NewHandler 创建处理器
func NewHandler(client *k8s.Client) *Handler {
        return &Handler{Client: client}
}

// SetClient 设置客户端
func (h *Handler) SetClient(client *k8s.Client) {
        h.clientMutex.Lock()
        defer h.clientMutex.Unlock()
        h.Client = client
}

// GetClient 获取客户端
func (h *Handler) GetClient() *k8s.Client {
        h.clientMutex.RLock()
        defer h.clientMutex.RUnlock()
        return h.Client
}

// ==================== Kubeconfig 配置 ====================

// ConfigureKubeconfig 配置 kubeconfig
func (h *Handler) ConfigureKubeconfig(c *gin.Context) {
        var req struct {
                Kubeconfig string `json:"kubeconfig" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        // 保存 kubeconfig 到文件
        kubeconfigDir := filepath.Join(os.Getenv("HOME"), ".kube")
        if err := os.MkdirAll(kubeconfigDir, 0755); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   "failed to create kubeconfig directory: " + err.Error(),
                })
                return
        }

        kubeconfigPath := filepath.Join(kubeconfigDir, "config")
        if err := os.WriteFile(kubeconfigPath, []byte(req.Kubeconfig), 0600); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   "failed to write kubeconfig: " + err.Error(),
                })
                return
        }

        // 创建新的 Kubernetes 客户端
        client, err := k8s.NewClient(kubeconfigPath, false)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   "failed to create Kubernetes client: " + err.Error(),
                })
                return
        }

        // 测试连接
        info, err := client.TestConnection()
        if err != nil {
                c.JSON(http.StatusOK, gin.H{
                        "success": false,
                        "error":   err.Error(),
                        "message": "kubeconfig saved but connection failed",
                })
                return
        }

        // 更新客户端
        h.SetClient(client)

        c.JSON(http.StatusOK, gin.H{
                "success":  true,
                "message":  "kubeconfig configured successfully",
                "version":  info.Version,
                "platform": info.Platform,
        })
}

// ==================== 集群信息 ====================

// GetStatus 获取集群连接状态
func (h *Handler) GetStatus(c *gin.Context) {
        if h.Client == nil {
                c.JSON(http.StatusOK, gin.H{
                        "connected": false,
                        "error":     "Kubernetes client not initialized",
                        "message":   "无法连接到 Kubernetes 集群",
                        "hint":      "请配置 kubeconfig 文件 (~/.kube/config) 或设置 KUBECONFIG 环境变量",
                })
                return
        }

        info, err := h.Client.TestConnection()
        if err != nil {
                c.JSON(http.StatusOK, gin.H{
                        "connected": false,
                        "error":     err.Error(),
                        "message":   "无法连接到 Kubernetes 集群",
                        "hint":      "请检查 kubeconfig 配置或确保应用运行在 Kubernetes 集群内",
                })
                return
        }

        c.JSON(http.StatusOK, gin.H{
                "connected": true,
                "version":   info.Version,
                "platform":  info.Platform,
                "message":   "已成功连接到 Kubernetes 集群",
        })
}

// GetOverview 获取集群概览
func (h *Handler) GetOverview(c *gin.Context) {
        if h.Client == nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   "Kubernetes client not initialized",
                })
                return
        }
        overview, err := h.Client.GetOverview()
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, overview)
}

// ==================== 节点 ====================

// GetNodes 获取节点列表
func (h *Handler) GetNodes(c *gin.Context) {
        nodes, err := h.Client.GetNodes()
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, nodes)
}

// GetNodeDetail 获取节点详情
func (h *Handler) GetNodeDetail(c *gin.Context) {
        name := c.Param("name")
        if name == "" {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   "node name is required",
                })
                return
        }

        node, err := h.Client.GetNodeDetail(name)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, node)
}

// CordonNode 隔离节点
func (h *Handler) CordonNode(c *gin.Context) {
        name := c.Param("name")
        if name == "" {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   "node name is required",
                })
                return
        }

        if err := h.Client.CordonNode(name); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "node cordoned successfully",
        })
}

// UncordonNode 解除隔离节点
func (h *Handler) UncordonNode(c *gin.Context) {
        name := c.Param("name")
        if name == "" {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   "node name is required",
                })
                return
        }

        if err := h.Client.UncordonNode(name); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "node uncordoned successfully",
        })
}

// DrainNode 排空节点
func (h *Handler) DrainNode(c *gin.Context) {
        name := c.Param("name")
        if name == "" {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   "node name is required",
                })
                return
        }

        if err := h.Client.DrainNode(name); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "node drained successfully",
        })
}

// ==================== 命名空间 ====================

// GetNamespaces 获取命名空间列表
func (h *Handler) GetNamespaces(c *gin.Context) {
        nss, err := h.Client.GetNamespaces()
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, nss)
}

// CreateNamespace 创建命名空间
func (h *Handler) CreateNamespace(c *gin.Context) {
        var req struct {
                Name   string            `json:"name" binding:"required"`
                Labels map[string]string `json:"labels"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        ns, err := h.Client.CreateNamespace(req.Name, req.Labels)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, ns)
}

// DeleteNamespace 删除命名空间
func (h *Handler) DeleteNamespace(c *gin.Context) {
        name := c.Param("name")
        if name == "" {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   "namespace name is required",
                })
                return
        }

        if err := h.Client.DeleteNamespace(name); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "namespace deleted successfully",
        })
}

// ==================== Pods ====================

// GetPods 获取Pod列表
func (h *Handler) GetPods(c *gin.Context) {
        namespace := c.Query("namespace")
        pods, err := h.Client.GetPods(namespace)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, pods)
}

// CreatePod 创建Pod
func (h *Handler) CreatePod(c *gin.Context) {
        var req models.CreatePodRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        pod, err := h.Client.CreatePod(req)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, pod)
}

// GetPodLogs 获取Pod日志
func (h *Handler) GetPodLogs(c *gin.Context) {
        namespace := c.Query("namespace")
        name := c.Query("name")
        container := c.Query("container")
        tailLinesStr := c.DefaultQuery("tailLines", "100")

        if namespace == "" || name == "" {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   "namespace and name are required",
                })
                return
        }

        tailLines, _ := strconv.ParseInt(tailLinesStr, 10, 64)
        logs, err := h.Client.GetPodLogs(namespace, name, container, tailLines)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, gin.H{"logs": logs})
}

// DeletePod 删除Pod
func (h *Handler) DeletePod(c *gin.Context) {
        var req struct {
                Namespace string `json:"namespace" binding:"required"`
                Name      string `json:"name" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        if err := h.Client.DeletePod(req.Namespace, req.Name); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "pod deleted successfully",
        })
}

// GetPodDetail 获取Pod详细信息
func (h *Handler) GetPodDetail(c *gin.Context) {
        namespace := c.Query("namespace")
        name := c.Query("name")

        if namespace == "" || name == "" {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   "namespace and name are required",
                })
                return
        }

        detail, err := h.Client.GetPodDetail(namespace, name)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, detail)
}

// ==================== Deployments ====================

// GetDeployments 获取Deployment列表
func (h *Handler) GetDeployments(c *gin.Context) {
        namespace := c.Query("namespace")
        deploys, err := h.Client.GetDeployments(namespace)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, deploys)
}

// CreateDeployment 创建Deployment
func (h *Handler) CreateDeployment(c *gin.Context) {
        var req models.CreateDeploymentRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        deploy, err := h.Client.CreateDeployment(req)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, deploy)
}

// ScaleDeployment 扩缩容Deployment
func (h *Handler) ScaleDeployment(c *gin.Context) {
        var req struct {
                Namespace string `json:"namespace" binding:"required"`
                Name      string `json:"name" binding:"required"`
                Replicas  int32  `json:"replicas" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        if err := h.Client.ScaleDeployment(req.Namespace, req.Name, req.Replicas); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "deployment scaled successfully",
        })
}

// RestartDeployment 重启Deployment
func (h *Handler) RestartDeployment(c *gin.Context) {
        var req struct {
                Namespace string `json:"namespace" binding:"required"`
                Name      string `json:"name" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        if err := h.Client.RestartDeployment(req.Namespace, req.Name); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "deployment restarted successfully",
        })
}

// DeleteDeployment 删除Deployment
func (h *Handler) DeleteDeployment(c *gin.Context) {
        var req struct {
                Namespace string `json:"namespace" binding:"required"`
                Name      string `json:"name" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        if err := h.Client.DeleteDeployment(req.Namespace, req.Name); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "deployment deleted successfully",
        })
}

// ==================== StatefulSets ====================

// GetStatefulSets 获取StatefulSet列表
func (h *Handler) GetStatefulSets(c *gin.Context) {
        namespace := c.Query("namespace")
        sts, err := h.Client.GetStatefulSets(namespace)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, sts)
}

// ==================== DaemonSets ====================

// GetDaemonSets 获取DaemonSet列表
func (h *Handler) GetDaemonSets(c *gin.Context) {
        namespace := c.Query("namespace")
        dss, err := h.Client.GetDaemonSets(namespace)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, dss)
}

// ==================== Jobs ====================

// GetJobs 获取Job列表
func (h *Handler) GetJobs(c *gin.Context) {
        namespace := c.Query("namespace")
        jobs, err := h.Client.GetJobs(namespace)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, jobs)
}

// ==================== Services ====================

// GetServices 获取Service列表
func (h *Handler) GetServices(c *gin.Context) {
        namespace := c.Query("namespace")
        svcs, err := h.Client.GetServices(namespace)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, svcs)
}

// ==================== Ingress ====================

// GetIngresses 获取Ingress列表
func (h *Handler) GetIngresses(c *gin.Context) {
        namespace := c.Query("namespace")
        ingresses, err := h.Client.GetIngresses(namespace)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, ingresses)
}

// ==================== ConfigMaps ====================

// GetConfigMaps 获取ConfigMap列表
func (h *Handler) GetConfigMaps(c *gin.Context) {
        namespace := c.Query("namespace")
        cms, err := h.Client.GetConfigMaps(namespace)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, cms)
}

// CreateConfigMap 创建ConfigMap
func (h *Handler) CreateConfigMap(c *gin.Context) {
        var req struct {
                Namespace string            `json:"namespace" binding:"required"`
                Name      string            `json:"name" binding:"required"`
                Data      map[string]string `json:"data"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        cm, err := h.Client.CreateConfigMap(req.Namespace, req.Name, req.Data)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, cm)
}

// DeleteConfigMap 删除ConfigMap
func (h *Handler) DeleteConfigMap(c *gin.Context) {
        var req struct {
                Namespace string `json:"namespace" binding:"required"`
                Name      string `json:"name" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        if err := h.Client.DeleteConfigMap(req.Namespace, req.Name); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "configmap deleted successfully",
        })
}

// ==================== Secrets ====================

// GetSecrets 获取Secret列表
func (h *Handler) GetSecrets(c *gin.Context) {
        namespace := c.Query("namespace")
        secrets, err := h.Client.GetSecrets(namespace)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, secrets)
}

// DeleteSecret 删除Secret
func (h *Handler) DeleteSecret(c *gin.Context) {
        var req struct {
                Namespace string `json:"namespace" binding:"required"`
                Name      string `json:"name" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        if err := h.Client.DeleteSecret(req.Namespace, req.Name); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "secret deleted successfully",
        })
}

// ==================== PVCs ====================

// GetPVCs 获取PVC列表
func (h *Handler) GetPVCs(c *gin.Context) {
        namespace := c.Query("namespace")
        pvcs, err := h.Client.GetPVCs(namespace)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, pvcs)
}

// ==================== PVs ====================

// GetPVs 获取PV列表
func (h *Handler) GetPVs(c *gin.Context) {
        pvs, err := h.Client.GetPVs()
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, pvs)
}

// ==================== StorageClasses ====================

// GetStorageClasses 获取StorageClass列表
func (h *Handler) GetStorageClasses(c *gin.Context) {
        scs, err := h.Client.GetStorageClasses()
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, scs)
}

// ==================== Events ====================

// GetEvents 获取事件列表
func (h *Handler) GetEvents(c *gin.Context) {
        if h.Client == nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   "Kubernetes client not initialized",
                })
                return
        }
        namespace := c.Query("namespace")
        events, err := h.Client.GetEvents(namespace)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, events)
}

// ==================== ServiceAccounts ====================

// GetServiceAccounts 获取ServiceAccount列表
func (h *Handler) GetServiceAccounts(c *gin.Context) {
        if h.Client == nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   "Kubernetes client not initialized",
                })
                return
        }
        namespace := c.Query("namespace")
        sas, err := h.Client.GetServiceAccounts(namespace)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, sas)
}

// ==================== Roles ====================

// GetRoles 获取Role和ClusterRole列表
func (h *Handler) GetRoles(c *gin.Context) {
        if h.Client == nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   "Kubernetes client not initialized",
                })
                return
        }
        namespace := c.Query("namespace")
        roles, err := h.Client.GetRoles(namespace)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, roles)
}

// ==================== RoleBindings ====================

// GetRoleBindings 获取RoleBinding和ClusterRoleBinding列表
func (h *Handler) GetRoleBindings(c *gin.Context) {
        if h.Client == nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   "Kubernetes client not initialized",
                })
                return
        }
        namespace := c.Query("namespace")
        rbs, err := h.Client.GetRoleBindings(namespace)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, rbs)
}

// ==================== 中间件状态 ====================

// GetMiddlewareStatus 获取中间件状态
func (h *Handler) GetMiddlewareStatus(c *gin.Context) {
        if h.Client == nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   "Kubernetes client not initialized",
                })
                return
        }
        
        overview, err := h.Client.GetMiddlewareStatus()
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, overview)
}

// ==================== YAML操作 ====================

// GetPodYaml 获取Pod的YAML配置
func (h *Handler) GetPodYaml(c *gin.Context) {
        namespace := c.Query("namespace")
        name := c.Query("name")

        if namespace == "" || name == "" {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   "namespace and name are required",
                })
                return
        }

        info, err := h.Client.GetPodYaml(namespace, name)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, info)
}

// UpdatePodYaml 更新Pod的YAML配置（删除重建）
func (h *Handler) UpdatePodYaml(c *gin.Context) {
        var req struct {
                Namespace string `json:"namespace" binding:"required"`
                Name      string `json:"name" binding:"required"`
                Yaml      string `json:"yaml" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        if err := h.Client.DeleteAndRecreatePod(req.Namespace, req.Name, req.Yaml); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "pod deleted and recreated successfully",
        })
}

// GetResourceYaml 获取资源的YAML配置
func (h *Handler) GetResourceYaml(c *gin.Context) {
        kind := c.Query("kind")
        namespace := c.Query("namespace")
        name := c.Query("name")

        if kind == "" || name == "" {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   "kind and name are required",
                })
                return
        }

        yaml, err := h.Client.GetResourceYaml(kind, namespace, name)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, gin.H{"yaml": yaml})
}

// UpdateResourceYaml 更新资源的YAML配置
func (h *Handler) UpdateResourceYaml(c *gin.Context) {
        var req struct {
                Kind      string `json:"kind" binding:"required"`
                Namespace string `json:"namespace"`
                Name      string `json:"name" binding:"required"`
                Yaml      string `json:"yaml" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        if err := h.Client.UpdateResourceYaml(req.Kind, req.Namespace, req.Name, req.Yaml); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "resource yaml updated successfully",
        })
}

// ==================== StatefulSet 详情和操作 ====================

// GetStatefulSetDetail 获取StatefulSet详情
func (h *Handler) GetStatefulSetDetail(c *gin.Context) {
        namespace := c.Query("namespace")
        name := c.Query("name")
        if namespace == "" || name == "" {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   "namespace and name are required",
                })
                return
        }

        detail, err := h.Client.GetStatefulSetDetail(namespace, name)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, detail)
}

// ScaleStatefulSet 扩缩容StatefulSet
func (h *Handler) ScaleStatefulSet(c *gin.Context) {
        var req struct {
                Namespace string `json:"namespace" binding:"required"`
                Name      string `json:"name" binding:"required"`
                Replicas  int32  `json:"replicas" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        if err := h.Client.ScaleStatefulSet(req.Namespace, req.Name, req.Replicas); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "statefulset scaled successfully",
        })
}

// RestartStatefulSet 重启StatefulSet
func (h *Handler) RestartStatefulSet(c *gin.Context) {
        var req struct {
                Namespace string `json:"namespace" binding:"required"`
                Name      string `json:"name" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        if err := h.Client.RestartStatefulSet(req.Namespace, req.Name); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "statefulset restarted successfully",
        })
}

// DeleteStatefulSet 删除StatefulSet
func (h *Handler) DeleteStatefulSet(c *gin.Context) {
        var req struct {
                Namespace string `json:"namespace" binding:"required"`
                Name      string `json:"name" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        if err := h.Client.DeleteStatefulSet(req.Namespace, req.Name); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "statefulset deleted successfully",
        })
}

// CreateStatefulSet 创建StatefulSet
func (h *Handler) CreateStatefulSet(c *gin.Context) {
        var req models.CreateStatefulSetRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        sts, err := h.Client.CreateStatefulSet(req)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, sts)
}

// ==================== DaemonSet 详情和操作 ====================

// GetDaemonSetDetail 获取DaemonSet详情
func (h *Handler) GetDaemonSetDetail(c *gin.Context) {
        namespace := c.Query("namespace")
        name := c.Query("name")
        if namespace == "" || name == "" {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   "namespace and name are required",
                })
                return
        }

        detail, err := h.Client.GetDaemonSetDetail(namespace, name)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, detail)
}

// RestartDaemonSet 重启DaemonSet
func (h *Handler) RestartDaemonSet(c *gin.Context) {
        var req struct {
                Namespace string `json:"namespace" binding:"required"`
                Name      string `json:"name" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        if err := h.Client.RestartDaemonSet(req.Namespace, req.Name); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "daemonset restarted successfully",
        })
}

// DeleteDaemonSet 删除DaemonSet
func (h *Handler) DeleteDaemonSet(c *gin.Context) {
        var req struct {
                Namespace string `json:"namespace" binding:"required"`
                Name      string `json:"name" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        if err := h.Client.DeleteDaemonSet(req.Namespace, req.Name); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "daemonset deleted successfully",
        })
}

// CreateDaemonSet 创建DaemonSet
func (h *Handler) CreateDaemonSet(c *gin.Context) {
        var req models.CreateDaemonSetRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        ds, err := h.Client.CreateDaemonSet(req)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, ds)
}

// ==================== Job 详情和操作 ====================

// GetJobDetail 获取Job详情
func (h *Handler) GetJobDetail(c *gin.Context) {
        namespace := c.Query("namespace")
        name := c.Query("name")
        if namespace == "" || name == "" {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   "namespace and name are required",
                })
                return
        }

        detail, err := h.Client.GetJobDetail(namespace, name)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, detail)
}

// DeleteJob 删除Job
func (h *Handler) DeleteJob(c *gin.Context) {
        var req struct {
                Namespace string `json:"namespace" binding:"required"`
                Name      string `json:"name" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        if err := h.Client.DeleteJob(req.Namespace, req.Name); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "job deleted successfully",
        })
}

// CreateJob 创建Job
func (h *Handler) CreateJob(c *gin.Context) {
        var req models.CreateJobRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        job, err := h.Client.CreateJob(req)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, job)
}

// ==================== CronJob ====================

// GetCronJobs 获取CronJob列表
func (h *Handler) GetCronJobs(c *gin.Context) {
        namespace := c.Query("namespace")
        cronjobs, err := h.Client.GetCronJobs(namespace)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, cronjobs)
}

// GetCronJobDetail 获取CronJob详情
func (h *Handler) GetCronJobDetail(c *gin.Context) {
        namespace := c.Query("namespace")
        name := c.Query("name")
        if namespace == "" || name == "" {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   "namespace and name are required",
                })
                return
        }

        detail, err := h.Client.GetCronJobDetail(namespace, name)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, detail)
}

// SuspendCronJob 暂停/恢复CronJob
func (h *Handler) SuspendCronJob(c *gin.Context) {
        var req struct {
                Namespace string `json:"namespace" binding:"required"`
                Name      string `json:"name" binding:"required"`
                Suspend   bool   `json:"suspend"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        if err := h.Client.SuspendCronJob(req.Namespace, req.Name, req.Suspend); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        action := "suspended"
        if !req.Suspend {
                action = "resumed"
        }
        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "cronjob " + action + " successfully",
        })
}

// TriggerCronJob 手动触发CronJob
func (h *Handler) TriggerCronJob(c *gin.Context) {
        var req struct {
                Namespace string `json:"namespace" binding:"required"`
                Name      string `json:"name" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        if err := h.Client.TriggerCronJob(req.Namespace, req.Name); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "cronjob triggered successfully",
        })
}

// DeleteCronJob 删除CronJob
func (h *Handler) DeleteCronJob(c *gin.Context) {
        var req struct {
                Namespace string `json:"namespace" binding:"required"`
                Name      string `json:"name" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        if err := h.Client.DeleteCronJob(req.Namespace, req.Name); err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "cronjob deleted successfully",
        })
}

// CreateCronJob 创建CronJob
func (h *Handler) CreateCronJob(c *gin.Context) {
        var req models.CreateCronJobRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        cj, err := h.Client.CreateCronJob(req)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }
        c.JSON(http.StatusOK, cj)
}
