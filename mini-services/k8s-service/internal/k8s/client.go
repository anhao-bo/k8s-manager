package k8s

import (
        "context"
        "fmt"
        "io"
        "path/filepath"
        "strings"
        "time"

        "k8s-service/internal/models"

        corev1 "k8s.io/api/core/v1"
        networkingv1 "k8s.io/api/networking/v1"
        storagev1 "k8s.io/api/storage/v1"
        appsv1 "k8s.io/api/apps/v1"
        batchv1 "k8s.io/api/batch/v1"
        rbacv1 "k8s.io/api/rbac/v1"
        metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
        "k8s.io/apimachinery/pkg/api/resource"
        "k8s.io/apimachinery/pkg/api/errors"
        "k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
        "k8s.io/apimachinery/pkg/runtime"
        "k8s.io/apimachinery/pkg/runtime/schema"
        "k8s.io/apimachinery/pkg/util/intstr"
        "k8s.io/client-go/kubernetes"
        "k8s.io/client-go/dynamic"
        "k8s.io/client-go/rest"
        "k8s.io/client-go/tools/clientcmd"
        "k8s.io/client-go/util/homedir"
        "sigs.k8s.io/yaml"
)

// Client Kubernetes客户端
type Client struct {
        Clientset     *kubernetes.Clientset
        DynamicClient dynamic.Interface
        Config        *rest.Config
        Namespace     string
}

// NewClient 创建新的Kubernetes客户端
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
                        // 使用默认kubeconfig路径
                        if home := homedir.HomeDir(); home != "" {
                                kubeconfigPath = filepath.Join(home, ".kube", "config")
                        }
                }

                config, err = clientcmd.BuildConfigFromFlags("", kubeconfigPath)
                if err != nil {
                        return nil, fmt.Errorf("failed to build config from kubeconfig: %w", err)
                }
        }

        clientset, err := kubernetes.NewForConfig(config)
        if err != nil {
                return nil, fmt.Errorf("failed to create clientset: %w", err)
        }

        dynamicClient, err := dynamic.NewForConfig(config)
        if err != nil {
                return nil, fmt.Errorf("failed to create dynamic client: %w", err)
        }

        return &Client{
                Clientset:     clientset,
                DynamicClient: dynamicClient,
                Config:        config,
                Namespace:     "", // 默认所有命名空间
        }, nil
}

// TestConnection 测试连接
func (c *Client) TestConnection() (*models.ClusterInfo, error) {
        version, err := c.Clientset.Discovery().ServerVersion()
        if err != nil {
                return nil, err
        }

        return &models.ClusterInfo{
                Name:        "kubernetes",
                Version:     version.GitVersion,
                Platform:    version.Platform,
                Connected:   true,
                LastChecked: time.Now(),
        }, nil
}

// GetOverview 获取集群概览
func (c *Client) GetOverview() (*models.ClusterOverview, error) {
        ctx := context.Background()
        nodes, err := c.Clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
        if err != nil {
                return nil, err
        }

        namespaces, err := c.Clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
        if err != nil {
                return nil, err
        }

        pods, err := c.Clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
        if err != nil {
                return nil, err
        }

        deployments, err := c.Clientset.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
        if err != nil {
                return nil, err
        }

        services, err := c.Clientset.CoreV1().Services("").List(ctx, metav1.ListOptions{})
        if err != nil {
                return nil, err
        }

        // 统计
        readyNodes := 0
        for _, node := range nodes.Items {
                for _, condition := range node.Status.Conditions {
                        if condition.Type == corev1.NodeReady && condition.Status == corev1.ConditionTrue {
                                readyNodes++
                                break
                        }
                }
        }

        runningPods := 0
        for _, pod := range pods.Items {
                if pod.Status.Phase == corev1.PodRunning {
                        runningPods++
                }
        }

        return &models.ClusterOverview{
                Nodes:        len(nodes.Items),
                ReadyNodes:   readyNodes,
                Namespaces:   len(namespaces.Items),
                Pods:         len(pods.Items),
                RunningPods:  runningPods,
                Deployments:  len(deployments.Items),
                Services:     len(services.Items),
        }, nil
}

// ==================== 节点操作 ====================

// GetNodes 获取节点列表
func (c *Client) GetNodes() ([]models.NodeInfo, error) {
        ctx := context.Background()
        nodes, err := c.Clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
        if err != nil {
                return nil, err
        }

        result := make([]models.NodeInfo, 0, len(nodes.Items))
        for _, node := range nodes.Items {
                info := models.NodeInfo{
                        Name:           node.Name,
                        OS:             node.Status.NodeInfo.OperatingSystem,
                        Arch:           node.Status.NodeInfo.Architecture,
                        KernelVersion:  node.Status.NodeInfo.KernelVersion,
                        KubeletVersion: node.Status.NodeInfo.KubeletVersion,
                        Labels:         node.Labels,
                        CreatedAt:      node.CreationTimestamp.Time,
                        Unschedulable:  node.Spec.Unschedulable,
                        Capacity: models.ResourceCapacity{
                                CPU:    node.Status.Capacity.Cpu().String(),
                                Memory: node.Status.Capacity.Memory().String(),
                                Pods:   node.Status.Capacity.Pods().String(),
                        },
                        Allocatable: models.ResourceCapacity{
                                CPU:    node.Status.Allocatable.Cpu().String(),
                                Memory: node.Status.Allocatable.Memory().String(),
                                Pods:   node.Status.Allocatable.Pods().String(),
                        },
                }

                // 获取状态
                for _, condition := range node.Status.Conditions {
                        if condition.Type == corev1.NodeReady {
                                if condition.Status == corev1.ConditionTrue {
                                        info.Status = "Ready"
                                } else {
                                        info.Status = "NotReady"
                                }
                                break
                        }
                }

                // 获取角色
                info.Roles = getNodeRoles(&node)

                // 获取IP
                for _, addr := range node.Status.Addresses {
                        if addr.Type == corev1.NodeInternalIP {
                                info.IP = addr.Address
                                break
                        }
                }

                // 获取条件
                info.Conditions = make([]models.NodeCondition, 0)
                for _, cond := range node.Status.Conditions {
                        info.Conditions = append(info.Conditions, models.NodeCondition{
                                Type:    string(cond.Type),
                                Status:  string(cond.Status),
                                Message: cond.Message,
                        })
                }

                result = append(result, info)
        }

        return result, nil
}

func getNodeRoles(node *corev1.Node) []string {
        roles := make([]string, 0)
        labels := node.Labels

        if _, ok := labels["node-role.kubernetes.io/control-plane"]; ok {
                roles = append(roles, "control-plane")
        }
        if _, ok := labels["node-role.kubernetes.io/master"]; ok {
                roles = append(roles, "control-plane")
        }
        if _, ok := labels["node-role.kubernetes.io/worker"]; ok {
                roles = append(roles, "worker")
        }
        if _, ok := labels["node-role.kubernetes.io/etcd"]; ok {
                roles = append(roles, "etcd")
        }
        if len(roles) == 0 {
                roles = append(roles, "worker")
        }
        return roles
}

// CordonNode 隔离节点（标记为不可调度）
func (c *Client) CordonNode(nodeName string) error {
        ctx := context.Background()
        node, err := c.Clientset.CoreV1().Nodes().Get(ctx, nodeName, metav1.GetOptions{})
        if err != nil {
                return err
        }

        // 标记节点为不可调度
        node.Spec.Unschedulable = true
        _, err = c.Clientset.CoreV1().Nodes().Update(ctx, node, metav1.UpdateOptions{})
        return err
}

// UncordonNode 解除节点隔离（恢复可调度）
func (c *Client) UncordonNode(nodeName string) error {
        ctx := context.Background()
        node, err := c.Clientset.CoreV1().Nodes().Get(ctx, nodeName, metav1.GetOptions{})
        if err != nil {
                return err
        }

        // 恢复节点可调度
        node.Spec.Unschedulable = false
        _, err = c.Clientset.CoreV1().Nodes().Update(ctx, node, metav1.UpdateOptions{})
        return err
}

// DrainNode 排空节点（驱逐所有Pod）
func (c *Client) DrainNode(nodeName string) error {
        ctx := context.Background()

        // 首先隔离节点
        err := c.CordonNode(nodeName)
        if err != nil {
                return err
        }

        // 获取节点上的所有Pod（不包括DaemonSet管理的Pod）
        pods, err := c.Clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{
                FieldSelector: fmt.Sprintf("spec.nodeName=%s", nodeName),
        })
        if err != nil {
                return err
        }

        // 驱逐每个Pod
        for _, pod := range pods.Items {
                // 跳过DaemonSet管理的Pod
                if pod.ObjectMeta.OwnerReferences != nil {
                        for _, owner := range pod.ObjectMeta.OwnerReferences {
                                if owner.Kind == "DaemonSet" {
                                        continue
                                }
                        }
                }

                // 镜像Pod也需要跳过
                if pod.Annotations["kubernetes.io/config.mirror"] != "" {
                        continue
                }

                // 删除Pod
                err := c.Clientset.CoreV1().Pods(pod.Namespace).Delete(ctx, pod.Name, metav1.DeleteOptions{})
                if err != nil {
                        // 记录错误但继续处理其他Pod
                        fmt.Printf("Warning: failed to delete pod %s/%s: %v\n", pod.Namespace, pod.Name, err)
                }
        }

        return nil
}

// GetNodeDetail 获取节点详细信息
func (c *Client) GetNodeDetail(nodeName string) (*models.NodeInfo, error) {
        ctx := context.Background()
        node, err := c.Clientset.CoreV1().Nodes().Get(ctx, nodeName, metav1.GetOptions{})
        if err != nil {
                return nil, err
        }

        info := &models.NodeInfo{
                Name:           node.Name,
                OS:             node.Status.NodeInfo.OperatingSystem,
                Arch:           node.Status.NodeInfo.Architecture,
                KernelVersion:  node.Status.NodeInfo.KernelVersion,
                KubeletVersion: node.Status.NodeInfo.KubeletVersion,
                Labels:         node.Labels,
                CreatedAt:      node.CreationTimestamp.Time,
                Unschedulable:  node.Spec.Unschedulable,
                Capacity: models.ResourceCapacity{
                        CPU:    node.Status.Capacity.Cpu().String(),
                        Memory: node.Status.Capacity.Memory().String(),
                        Pods:   node.Status.Capacity.Pods().String(),
                },
                Allocatable: models.ResourceCapacity{
                        CPU:    node.Status.Allocatable.Cpu().String(),
                        Memory: node.Status.Allocatable.Memory().String(),
                        Pods:   node.Status.Allocatable.Pods().String(),
                },
        }

        // 获取状态
        for _, condition := range node.Status.Conditions {
                if condition.Type == corev1.NodeReady {
                        if condition.Status == corev1.ConditionTrue {
                                info.Status = "Ready"
                        } else {
                                info.Status = "NotReady"
                        }
                        break
                }
        }

        // 如果节点被隔离，状态附加信息
        if node.Spec.Unschedulable {
                info.Status = info.Status + " (Cordoned)"
        }

        // 获取角色
        info.Roles = getNodeRoles(node)

        // 获取IP
        for _, addr := range node.Status.Addresses {
                if addr.Type == corev1.NodeInternalIP {
                        info.IP = addr.Address
                        break
                }
        }

        // 获取条件
        info.Conditions = make([]models.NodeCondition, 0)
        for _, cond := range node.Status.Conditions {
                info.Conditions = append(info.Conditions, models.NodeCondition{
                        Type:    string(cond.Type),
                        Status:  string(cond.Status),
                        Message: cond.Message,
                })
        }

        return info, nil
}

// ==================== 命名空间操作 ====================

// GetNamespaces 获取命名空间列表
func (c *Client) GetNamespaces() ([]models.NamespaceInfo, error) {
        ctx := context.Background()
        nss, err := c.Clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
        if err != nil {
                return nil, err
        }

        result := make([]models.NamespaceInfo, 0, len(nss.Items))
        for _, ns := range nss.Items {
                result = append(result, models.NamespaceInfo{
                        Name:      ns.Name,
                        Status:    string(ns.Status.Phase),
                        Labels:    ns.Labels,
                        CreatedAt: ns.CreationTimestamp.Time,
                })
        }
        return result, nil
}

// CreateNamespace 创建命名空间
func (c *Client) CreateNamespace(name string, labels map[string]string) (*models.NamespaceInfo, error) {
        ctx := context.Background()
        ns, err := c.Clientset.CoreV1().Namespaces().Create(ctx, &corev1.Namespace{
                ObjectMeta: metav1.ObjectMeta{
                        Name:   name,
                        Labels: labels,
                },
        }, metav1.CreateOptions{})
        if err != nil {
                return nil, err
        }

        return &models.NamespaceInfo{
                Name:      ns.Name,
                Status:    string(ns.Status.Phase),
                Labels:    ns.Labels,
                CreatedAt: ns.CreationTimestamp.Time,
        }, nil
}

// DeleteNamespace 删除命名空间
func (c *Client) DeleteNamespace(name string) error {
        ctx := context.Background()
        return c.Clientset.CoreV1().Namespaces().Delete(ctx, name, metav1.DeleteOptions{})
}

// ==================== Pod操作 ====================

// isStaticPod 判断是否为静态 Pod
func isStaticPod(pod *corev1.Pod) bool {
        // 方法1: 通过 OwnerReference
        for _, owner := range pod.OwnerReferences {
                if owner.Kind == "Node" {
                        return true
                }
        }
        // 方法2: 通过 annotation
        if _, ok := pod.Annotations["kubernetes.io/config.source"]; ok {
                return true
        }
        if _, ok := pod.Annotations["kubernetes.io/config.mirror"]; ok {
                return true
        }
        return false
}

// getPodDisplayStatus 获取 Pod 的展示状态（优先显示问题状态）
func getPodDisplayStatus(pod *corev1.Pod) (status, reason, message string) {
        phase := string(pod.Status.Phase)
        
        // 检查容器状态，优先显示问题状态
        for _, cs := range pod.Status.ContainerStatuses {
                if cs.State.Waiting != nil {
                        waitingReason := cs.State.Waiting.Reason
                        // 这些是重要的错误状态，需要优先显示
                        switch waitingReason {
                        case "CrashLoopBackOff", "ImagePullBackOff", "ErrImagePull", 
                             "CreateContainerConfigError", "InvalidImageName", "ContainerCreating":
                                return waitingReason, waitingReason, cs.State.Waiting.Message
                        }
                }
                if cs.State.Terminated != nil {
                        if cs.State.Terminated.ExitCode != 0 {
                                return "Error", cs.State.Terminated.Reason, cs.State.Terminated.Message
                        }
                }
        }
        
        // 检查 Init 容器状态
        for _, cs := range pod.Status.InitContainerStatuses {
                if cs.State.Waiting != nil {
                        return "Init:" + cs.State.Waiting.Reason, cs.State.Waiting.Reason, cs.State.Waiting.Message
                }
                if cs.State.Terminated != nil && cs.State.Terminated.ExitCode != 0 {
                        return "Init:Error", cs.State.Terminated.Reason, cs.State.Terminated.Message
                }
        }
        
        // 检查 Conditions
        for _, cond := range pod.Status.Conditions {
                if cond.Type == corev1.PodReady && cond.Status == corev1.ConditionFalse {
                        if cond.Reason == "ContainersNotReady" && phase == "Running" {
                                return "NotReady", cond.Reason, cond.Message
                        }
                }
                if cond.Type == corev1.PodScheduled && cond.Status == corev1.ConditionFalse {
                        return "Pending", cond.Reason, cond.Message
                }
        }
        
        // 返回 Phase
        return phase, pod.Status.Reason, pod.Status.Message
}

// buildContainerStatusInfo 构建容器状态信息
func buildContainerStatusInfo(cs corev1.ContainerStatus) models.ContainerStatusInfo {
        info := models.ContainerStatusInfo{
                Name:         cs.Name,
                Image:        cs.Image,
                Ready:        cs.Ready,
                RestartCount: int(cs.RestartCount),
        }
        
        // 当前状态
        if cs.State.Waiting != nil {
                info.State = "Waiting"
                info.StateReason = cs.State.Waiting.Reason
                info.StateMessage = cs.State.Waiting.Message
        } else if cs.State.Running != nil {
                info.State = "Running"
                info.StartedAt = cs.State.Running.StartedAt.Format(time.RFC3339)
        } else if cs.State.Terminated != nil {
                info.State = "Terminated"
                info.ExitCode = cs.State.Terminated.ExitCode
                info.StateReason = cs.State.Terminated.Reason
                info.StateMessage = cs.State.Terminated.Message
                info.StartedAt = cs.State.Terminated.StartedAt.Format(time.RFC3339)
                info.FinishedAt = cs.State.Terminated.FinishedAt.Format(time.RFC3339)
        }
        
        // 上次终止状态
        if cs.LastTerminationState.Terminated != nil {
                info.LastExitCode = cs.LastTerminationState.Terminated.ExitCode
                info.LastExitReason = cs.LastTerminationState.Terminated.Reason
        }
        
        return info
}

// GetPods 获取Pod列表
func (c *Client) GetPods(namespace string) ([]models.PodInfo, error) {
        ctx := context.Background()
        var pods *corev1.PodList
        var err error

        if namespace != "" {
                pods, err = c.Clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
        } else {
                pods, err = c.Clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
        }
        if err != nil {
                return nil, err
        }

        result := make([]models.PodInfo, 0, len(pods.Items))
        for _, pod := range pods.Items {
                // 计算展示状态
                status, reason, message := getPodDisplayStatus(&pod)
                
                info := models.PodInfo{
                        Name:            pod.Name,
                        Namespace:       pod.Namespace,
                        Status:          status,
                        Phase:           string(pod.Status.Phase),
                        StatusReason:    reason,
                        StatusMessage:   message,
                        PodIP:           pod.Status.PodIP,
                        HostIP:          pod.Status.HostIP,
                        NodeName:        pod.Spec.NodeName,
                        Containers:      len(pod.Spec.Containers),
                        Labels:          pod.Labels,
                        CreatedAt:       pod.CreationTimestamp.Time,
                        ReadyContainers: 0,
                        Restarts:        0,
                        IsStaticPod:     isStaticPod(&pod),
                        RestartPolicy:   string(pod.Spec.RestartPolicy),
                        QOSClass:        string(pod.Status.QOSClass),
                        ContainerStatuses: make([]models.ContainerStatusInfo, 0, len(pod.Status.ContainerStatuses)),
                }

                // 统计就绪容器和重启次数，并收集容器状态
                for _, cs := range pod.Status.ContainerStatuses {
                        if cs.Ready {
                                info.ReadyContainers++
                        }
                        info.Restarts += int(cs.RestartCount)
                        info.ContainerStatuses = append(info.ContainerStatuses, buildContainerStatusInfo(cs))
                }

                result = append(result, info)
        }
        return result, nil
}

// GetPodLogs 获取Pod日志
func (c *Client) GetPodLogs(namespace, name, container string, tailLines int64) (string, error) {
        ctx := context.Background()
        opts := &corev1.PodLogOptions{
                Container: container,
        }
        if tailLines > 0 {
                opts.TailLines = &tailLines
        }

        req := c.Clientset.CoreV1().Pods(namespace).GetLogs(name, opts)
        stream, err := req.Stream(ctx)
        if err != nil {
                return "", err
        }
        defer stream.Close()

        buf := new(strings.Builder)
        _, err = io.Copy(buf, stream)
        if err != nil {
                return "", err
        }
        return buf.String(), nil
}

// DeletePod 删除Pod
func (c *Client) DeletePod(namespace, name string) error {
        ctx := context.Background()
        return c.Clientset.CoreV1().Pods(namespace).Delete(ctx, name, metav1.DeleteOptions{})
}

// GetPodDetail 获取Pod详细信息
func (c *Client) GetPodDetail(namespace, name string) (*models.PodDetail, error) {
        ctx := context.Background()
        pod, err := c.Clientset.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
        if err != nil {
                return nil, err
        }

        // 计算展示状态
        status, reason, message := getPodDisplayStatus(pod)

        detail := &models.PodDetail{
                Name:          pod.Name,
                Namespace:     pod.Namespace,
                Status:        status,
                Phase:         string(pod.Status.Phase),
                StatusReason:  reason,
                StatusMessage: message,
                PodIP:         pod.Status.PodIP,
                HostIP:        pod.Status.HostIP,
                NodeName:      pod.Spec.NodeName,
                Labels:        pod.Labels,
                Annotations:   pod.Annotations,
                CreatedAt:     pod.CreationTimestamp.Time,
                IsStaticPod:   isStaticPod(pod),
                RestartPolicy: string(pod.Spec.RestartPolicy),
                QOSClass:      string(pod.Status.QOSClass),
                Containers:    make([]models.ContainerInfo, 0, len(pod.Status.ContainerStatuses)),
                InitContainers: make([]models.ContainerInfo, 0, len(pod.Status.InitContainerStatuses)),
                Conditions:    make([]models.PodCondition, 0, len(pod.Status.Conditions)),
                Volumes:       make([]models.VolumeInfo, 0, len(pod.Spec.Volumes)),
                Events:        make([]models.EventInfo, 0),
        }

        // 启动时间
        if pod.Status.StartTime != nil {
                t := pod.Status.StartTime.Time
                detail.StartTime = &t
        }

        // 处理容器状态
        for _, cs := range pod.Status.ContainerStatuses {
                containerInfo := buildContainerInfo(cs)
                detail.Containers = append(detail.Containers, containerInfo)
        }

        // 处理 Init 容器状态
        for _, cs := range pod.Status.InitContainerStatuses {
                containerInfo := buildContainerInfo(cs)
                detail.InitContainers = append(detail.InitContainers, containerInfo)
        }

        // 处理 Conditions
        for _, cond := range pod.Status.Conditions {
                detail.Conditions = append(detail.Conditions, models.PodCondition{
                        Type:               string(cond.Type),
                        Status:             string(cond.Status),
                        LastTransitionTime: cond.LastTransitionTime.Time,
                        Reason:             cond.Reason,
                        Message:            cond.Message,
                })
        }

        // 处理 Volumes
        for _, vol := range pod.Spec.Volumes {
                volType := "Unknown"
                if vol.ConfigMap != nil {
                        volType = "ConfigMap"
                } else if vol.Secret != nil {
                        volType = "Secret"
                } else if vol.PersistentVolumeClaim != nil {
                        volType = "PVC"
                } else if vol.EmptyDir != nil {
                        volType = "EmptyDir"
                } else if vol.HostPath != nil {
                        volType = "HostPath"
                } else if vol.NFS != nil {
                        volType = "NFS"
                }
                detail.Volumes = append(detail.Volumes, models.VolumeInfo{
                        Name: vol.Name,
                        Type: volType,
                })
        }

        // 获取 Pod 相关事件
        events, _ := c.GetPodEvents(namespace, name)
        if events != nil {
                detail.Events = events
        }

        return detail, nil
}

// buildContainerInfo 构建容器详细信息
func buildContainerInfo(cs corev1.ContainerStatus) models.ContainerInfo {
        info := models.ContainerInfo{
                Name:         cs.Name,
                Image:        cs.Image,
                ImageID:      cs.ImageID,
                ContainerID:  cs.ContainerID,
                Ready:        cs.Ready,
                RestartCount: int(cs.RestartCount),
        }

        // 当前状态
        if cs.State.Waiting != nil {
                info.State = "Waiting"
                info.StateReason = cs.State.Waiting.Reason
                info.StateMessage = cs.State.Waiting.Message
        } else if cs.State.Running != nil {
                info.State = "Running"
                info.StartedAt = cs.State.Running.StartedAt.Format(time.RFC3339)
        } else if cs.State.Terminated != nil {
                info.State = "Terminated"
                info.ExitCode = cs.State.Terminated.ExitCode
                info.Signal = cs.State.Terminated.Signal
                info.StateReason = cs.State.Terminated.Reason
                info.StateMessage = cs.State.Terminated.Message
                info.StartedAt = cs.State.Terminated.StartedAt.Format(time.RFC3339)
                info.FinishedAt = cs.State.Terminated.FinishedAt.Format(time.RFC3339)
        }

        // 上次终止状态
        if cs.LastTerminationState.Terminated != nil {
                info.LastExitCode = cs.LastTerminationState.Terminated.ExitCode
                info.LastExitReason = cs.LastTerminationState.Terminated.Reason
                info.LastExitMessage = cs.LastTerminationState.Terminated.Message
        }

        return info
}

// GetPodEvents 获取 Pod 相关事件
func (c *Client) GetPodEvents(namespace, podName string) ([]models.EventInfo, error) {
        ctx := context.Background()

        // 获取与 Pod 相关的事件
        events, err := c.Clientset.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{
                FieldSelector: fmt.Sprintf("involvedObject.name=%s,involvedObject.kind=Pod", podName),
        })
        if err != nil {
                return nil, err
        }

        result := make([]models.EventInfo, 0, len(events.Items))
        for _, e := range events.Items {
                result = append(result, models.EventInfo{
                        Name:           e.Name,
                        Namespace:      e.Namespace,
                        Type:           e.Type,
                        Reason:         e.Reason,
                        Message:        e.Message,
                        Count:          e.Count,
                        FirstTimestamp: e.FirstTimestamp.Time,
                        LastTimestamp:  e.LastTimestamp.Time,
                        Source: models.EventSource{
                                Component: e.Source.Component,
                                Host:      e.Source.Host,
                        },
                })
        }

        return result, nil
}

// CreatePod 创建Pod
func (c *Client) CreatePod(req models.CreatePodRequest) (*models.PodInfo, error) {
        ctx := context.Background()
        ns := req.Namespace
        if ns == "" {
                ns = "default"
        }

        // 构建容器
        container := corev1.Container{
                Name:  req.ContainerName,
                Image: req.Image,
        }
        if container.Name == "" {
                container.Name = req.Name
        }

        // 添加命令
        if len(req.Command) > 0 {
                container.Command = req.Command
        }
        if len(req.Args) > 0 {
                container.Args = req.Args
        }

        // 添加环境变量
        if len(req.Env) > 0 {
                container.Env = make([]corev1.EnvVar, 0, len(req.Env))
                for k, v := range req.Env {
                        container.Env = append(container.Env, corev1.EnvVar{
                                Name:  k,
                                Value: v,
                        })
                }
        }

        // 添加端口
        if len(req.Ports) > 0 {
                container.Ports = make([]corev1.ContainerPort, 0, len(req.Ports))
                for _, port := range req.Ports {
                        container.Ports = append(container.Ports, corev1.ContainerPort{
                                ContainerPort: int32(port),
                        })
                }
        }

        pod := &corev1.Pod{
                ObjectMeta: metav1.ObjectMeta{
                        Name:      req.Name,
                        Namespace: ns,
                        Labels: map[string]string{
                                "app": req.Name,
                        },
                },
                Spec: corev1.PodSpec{
                        Containers: []corev1.Container{container},
                },
        }

        created, err := c.Clientset.CoreV1().Pods(ns).Create(ctx, pod, metav1.CreateOptions{})
        if err != nil {
                return nil, err
        }

        return &models.PodInfo{
                Name:            created.Name,
                Namespace:       created.Namespace,
                Status:          string(created.Status.Phase),
                Containers:      len(created.Spec.Containers),
                ReadyContainers: 0,
                Restarts:        0,
                Labels:          created.Labels,
                CreatedAt:       created.CreationTimestamp.Time,
        }, nil
}

// ==================== Deployment操作 ====================

// GetDeployments 获取Deployment列表
func (c *Client) GetDeployments(namespace string) ([]models.DeploymentInfo, error) {
        ctx := context.Background()
        var deploys *appsv1.DeploymentList
        var err error

        if namespace != "" {
                deploys, err = c.Clientset.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
        } else {
                deploys, err = c.Clientset.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
        }
        if err != nil {
                return nil, err
        }

        result := make([]models.DeploymentInfo, 0, len(deploys.Items))
        for _, d := range deploys.Items {
                info := models.DeploymentInfo{
                        Name:              d.Name,
                        Namespace:         d.Namespace,
                        Replicas:          *d.Spec.Replicas,
                        ReadyReplicas:     d.Status.ReadyReplicas,
                        AvailableReplicas: d.Status.AvailableReplicas,
                        UpdatedReplicas:   d.Status.UpdatedReplicas,
                        Strategy:          string(d.Spec.Strategy.Type),
                        Labels:            d.Labels,
                        CreatedAt:         d.CreationTimestamp.Time,
                }
                result = append(result, info)
        }
        return result, nil
}

// CreateDeployment 创建Deployment
func (c *Client) CreateDeployment(req models.CreateDeploymentRequest) (*models.DeploymentInfo, error) {
        ctx := context.Background()
        ns := req.Namespace
        if ns == "" {
                ns = "default"
        }

        replicas := int32(1)
        if req.Replicas > 0 {
                replicas = int32(req.Replicas)
        }

        containerName := req.ContainerName
        if containerName == "" {
                containerName = req.Name
        }

        labels := req.Labels
        if len(labels) == 0 {
                labels = map[string]string{
                        "app": req.Name,
                }
        }

        // 构建容器
        container := corev1.Container{
                Name:  containerName,
                Image: req.Image,
        }

        // 添加端口
        if req.ContainerPort > 0 {
                container.Ports = []corev1.ContainerPort{
                        {ContainerPort: int32(req.ContainerPort)},
                }
        }

        deploy := &appsv1.Deployment{
                ObjectMeta: metav1.ObjectMeta{
                        Name:      req.Name,
                        Namespace: ns,
                        Labels:    labels,
                },
                Spec: appsv1.DeploymentSpec{
                        Replicas: &replicas,
                        Selector: &metav1.LabelSelector{
                                MatchLabels: map[string]string{
                                        "app": req.Name,
                                },
                        },
                        Template: corev1.PodTemplateSpec{
                                ObjectMeta: metav1.ObjectMeta{
                                        Labels: map[string]string{
                                                "app": req.Name,
                                        },
                                },
                                Spec: corev1.PodSpec{
                                        Containers: []corev1.Container{container},
                                },
                        },
                },
        }

        created, err := c.Clientset.AppsV1().Deployments(ns).Create(ctx, deploy, metav1.CreateOptions{})
        if err != nil {
                return nil, err
        }

        return &models.DeploymentInfo{
                Name:              created.Name,
                Namespace:         created.Namespace,
                Replicas:          *created.Spec.Replicas,
                ReadyReplicas:     created.Status.ReadyReplicas,
                AvailableReplicas: created.Status.AvailableReplicas,
                UpdatedReplicas:   created.Status.UpdatedReplicas,
                Strategy:          string(created.Spec.Strategy.Type),
                Labels:            created.Labels,
                CreatedAt:         created.CreationTimestamp.Time,
        }, nil
}

// ScaleDeployment 扩缩容Deployment
func (c *Client) ScaleDeployment(namespace, name string, replicas int32) error {
        ctx := context.Background()
        deploy, err := c.Clientset.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
        if err != nil {
                return err
        }

        deploy.Spec.Replicas = &replicas
        _, err = c.Clientset.AppsV1().Deployments(namespace).Update(ctx, deploy, metav1.UpdateOptions{})
        return err
}

// RestartDeployment 重启Deployment
func (c *Client) RestartDeployment(namespace, name string) error {
        ctx := context.Background()
        deploy, err := c.Clientset.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
        if err != nil {
                return err
        }

        if deploy.Spec.Template.Annotations == nil {
                deploy.Spec.Template.Annotations = make(map[string]string)
        }
        deploy.Spec.Template.Annotations["kubectl.kubernetes.io/restartedAt"] = time.Now().Format(time.RFC3339)

        _, err = c.Clientset.AppsV1().Deployments(namespace).Update(ctx, deploy, metav1.UpdateOptions{})
        return err
}

// DeleteDeployment 删除Deployment
func (c *Client) DeleteDeployment(namespace, name string) error {
        ctx := context.Background()
        return c.Clientset.AppsV1().Deployments(namespace).Delete(ctx, name, metav1.DeleteOptions{})
}

// ==================== StatefulSet操作 ====================

// GetStatefulSets 获取StatefulSet列表
func (c *Client) GetStatefulSets(namespace string) ([]models.StatefulSetInfo, error) {
        ctx := context.Background()
        var sts *appsv1.StatefulSetList
        var err error

        if namespace != "" {
                sts, err = c.Clientset.AppsV1().StatefulSets(namespace).List(ctx, metav1.ListOptions{})
        } else {
                sts, err = c.Clientset.AppsV1().StatefulSets("").List(ctx, metav1.ListOptions{})
        }
        if err != nil {
                return nil, err
        }

        result := make([]models.StatefulSetInfo, 0, len(sts.Items))
        for _, s := range sts.Items {
                info := models.StatefulSetInfo{
                        Name:          s.Name,
                        Namespace:     s.Namespace,
                        Replicas:      *s.Spec.Replicas,
                        ReadyReplicas: s.Status.ReadyReplicas,
                        ServiceName:   s.Spec.ServiceName,
                        Labels:        s.Labels,
                        CreatedAt:     s.CreationTimestamp.Time,
                }
                result = append(result, info)
        }
        return result, nil
}

// CreateStatefulSet 创建StatefulSet
func (c *Client) CreateStatefulSet(req models.CreateStatefulSetRequest) (*models.StatefulSetInfo, error) {
        ctx := context.Background()
        ns := req.Namespace
        if ns == "" {
                ns = "default"
        }

        replicas := int32(1)
        if req.Replicas > 0 {
                replicas = int32(req.Replicas)
        }

        containerName := req.ContainerName
        if containerName == "" {
                containerName = req.Name
        }

        labels := req.Labels
        if len(labels) == 0 {
                labels = map[string]string{
                        "app": req.Name,
                }
        }

        // 构建容器
        container := corev1.Container{
                Name:  containerName,
                Image: req.Image,
        }

        // 添加端口
        if req.ContainerPort > 0 {
                container.Ports = []corev1.ContainerPort{
                        {ContainerPort: int32(req.ContainerPort)},
                }
        }

        sts := &appsv1.StatefulSet{
                ObjectMeta: metav1.ObjectMeta{
                        Name:      req.Name,
                        Namespace: ns,
                        Labels:    labels,
                },
                Spec: appsv1.StatefulSetSpec{
                        Replicas:    &replicas,
                        ServiceName: req.ServiceName,
                        Selector: &metav1.LabelSelector{
                                MatchLabels: map[string]string{
                                        "app": req.Name,
                                },
                        },
                        Template: corev1.PodTemplateSpec{
                                ObjectMeta: metav1.ObjectMeta{
                                        Labels: map[string]string{
                                                "app": req.Name,
                                        },
                                },
                                Spec: corev1.PodSpec{
                                        Containers: []corev1.Container{container},
                                },
                        },
                },
        }

        created, err := c.Clientset.AppsV1().StatefulSets(ns).Create(ctx, sts, metav1.CreateOptions{})
        if err != nil {
                return nil, err
        }

        return &models.StatefulSetInfo{
                Name:          created.Name,
                Namespace:     created.Namespace,
                Replicas:      *created.Spec.Replicas,
                ReadyReplicas: created.Status.ReadyReplicas,
                ServiceName:   created.Spec.ServiceName,
                Labels:        created.Labels,
                CreatedAt:     created.CreationTimestamp.Time,
        }, nil
}

// ==================== DaemonSet操作 ====================

// GetDaemonSets 获取DaemonSet列表
func (c *Client) GetDaemonSets(namespace string) ([]models.DaemonSetInfo, error) {
        ctx := context.Background()
        var dss *appsv1.DaemonSetList
        var err error

        if namespace != "" {
                dss, err = c.Clientset.AppsV1().DaemonSets(namespace).List(ctx, metav1.ListOptions{})
        } else {
                dss, err = c.Clientset.AppsV1().DaemonSets("").List(ctx, metav1.ListOptions{})
        }
        if err != nil {
                return nil, err
        }

        result := make([]models.DaemonSetInfo, 0, len(dss.Items))
        for _, ds := range dss.Items {
                info := models.DaemonSetInfo{
                        Name:          ds.Name,
                        Namespace:     ds.Namespace,
                        DesiredNodes:  ds.Status.DesiredNumberScheduled,
                        CurrentNodes:  ds.Status.CurrentNumberScheduled,
                        ReadyNodes:    ds.Status.NumberReady,
                        UpdatedNodes:  ds.Status.UpdatedNumberScheduled,
                        Labels:        ds.Labels,
                        CreatedAt:     ds.CreationTimestamp.Time,
                }
                result = append(result, info)
        }
        return result, nil
}

// CreateDaemonSet 创建DaemonSet
func (c *Client) CreateDaemonSet(req models.CreateDaemonSetRequest) (*models.DaemonSetInfo, error) {
        ctx := context.Background()
        ns := req.Namespace
        if ns == "" {
                ns = "default"
        }

        containerName := req.ContainerName
        if containerName == "" {
                containerName = req.Name
        }

        labels := req.Labels
        if len(labels) == 0 {
                labels = map[string]string{
                        "app": req.Name,
                }
        }

        // 构建容器
        container := corev1.Container{
                Name:  containerName,
                Image: req.Image,
        }

        // 添加端口
        if req.ContainerPort > 0 {
                container.Ports = []corev1.ContainerPort{
                        {ContainerPort: int32(req.ContainerPort)},
                }
        }

        ds := &appsv1.DaemonSet{
                ObjectMeta: metav1.ObjectMeta{
                        Name:      req.Name,
                        Namespace: ns,
                        Labels:    labels,
                },
                Spec: appsv1.DaemonSetSpec{
                        Selector: &metav1.LabelSelector{
                                MatchLabels: map[string]string{
                                        "app": req.Name,
                                },
                        },
                        Template: corev1.PodTemplateSpec{
                                ObjectMeta: metav1.ObjectMeta{
                                        Labels: map[string]string{
                                                "app": req.Name,
                                        },
                                },
                                Spec: corev1.PodSpec{
                                        Containers: []corev1.Container{container},
                                },
                        },
                },
        }

        created, err := c.Clientset.AppsV1().DaemonSets(ns).Create(ctx, ds, metav1.CreateOptions{})
        if err != nil {
                return nil, err
        }

        return &models.DaemonSetInfo{
                Name:          created.Name,
                Namespace:     created.Namespace,
                DesiredNodes:  created.Status.DesiredNumberScheduled,
                CurrentNodes:  created.Status.CurrentNumberScheduled,
                ReadyNodes:    created.Status.NumberReady,
                UpdatedNodes:  created.Status.UpdatedNumberScheduled,
                Labels:        created.Labels,
                CreatedAt:     created.CreationTimestamp.Time,
        }, nil
}

// ==================== Job操作 ====================

// GetJobs 获取Job列表
func (c *Client) GetJobs(namespace string) ([]models.JobInfo, error) {
        ctx := context.Background()
        var jobs *batchv1.JobList
        var err error

        if namespace != "" {
                jobs, err = c.Clientset.BatchV1().Jobs(namespace).List(ctx, metav1.ListOptions{})
        } else {
                jobs, err = c.Clientset.BatchV1().Jobs("").List(ctx, metav1.ListOptions{})
        }
        if err != nil {
                return nil, err
        }

        result := make([]models.JobInfo, 0, len(jobs.Items))
        for _, job := range jobs.Items {
                status := "Pending"
                if job.Spec.Completions != nil && job.Status.Succeeded >= *job.Spec.Completions {
                        status = "Completed"
                } else if job.Spec.BackoffLimit != nil && job.Status.Failed >= *job.Spec.BackoffLimit {
                        status = "Failed"
                } else if job.Status.Active > 0 {
                        status = "Running"
                }

                completions := int32(1)
                if job.Spec.Completions != nil {
                        completions = *job.Spec.Completions
                }
                parallelism := int32(1)
                if job.Spec.Parallelism != nil {
                        parallelism = *job.Spec.Parallelism
                }

                var startTime *time.Time
                if job.Status.StartTime != nil {
                        t := job.Status.StartTime.Time
                        startTime = &t
                }
                var completionTime *time.Time
                if job.Status.CompletionTime != nil {
                        t := job.Status.CompletionTime.Time
                        completionTime = &t
                }

                info := models.JobInfo{
                        Name:           job.Name,
                        Namespace:      job.Namespace,
                        Completions:    completions,
                        Succeeded:      job.Status.Succeeded,
                        Parallelism:    parallelism,
                        Status:         status,
                        StartTime:      startTime,
                        CompletionTime: completionTime,
                        Labels:         job.Labels,
                        CreatedAt:      job.CreationTimestamp.Time,
                }
                result = append(result, info)
        }
        return result, nil
}

// CreateJob 创建Job
func (c *Client) CreateJob(req models.CreateJobRequest) (*models.JobInfo, error) {
        ctx := context.Background()
        ns := req.Namespace
        if ns == "" {
                ns = "default"
        }

        containerName := req.ContainerName
        if containerName == "" {
                containerName = req.Name
        }

        labels := req.Labels
        if len(labels) == 0 {
                labels = map[string]string{
                        "app": req.Name,
                }
        }

        restartPolicy := corev1.RestartPolicyOnFailure
        if req.RestartPolicy == "Never" {
                restartPolicy = corev1.RestartPolicyNever
        }

        // 构建容器
        container := corev1.Container{
                Name:    containerName,
                Image:   req.Image,
                Command: req.Command,
                Args:    req.Args,
        }

        job := &batchv1.Job{
                ObjectMeta: metav1.ObjectMeta{
                        Name:      req.Name,
                        Namespace: ns,
                        Labels:    labels,
                },
                Spec: batchv1.JobSpec{
                        Template: corev1.PodTemplateSpec{
                                ObjectMeta: metav1.ObjectMeta{
                                        Labels: map[string]string{
                                                "app": req.Name,
                                        },
                                },
                                Spec: corev1.PodSpec{
                                        RestartPolicy: restartPolicy,
                                        Containers:    []corev1.Container{container},
                                },
                        },
                },
        }

        if req.Completions > 0 {
                completions := int32(req.Completions)
                job.Spec.Completions = &completions
        }
        if req.Parallelism > 0 {
                parallelism := int32(req.Parallelism)
                job.Spec.Parallelism = &parallelism
        }

        created, err := c.Clientset.BatchV1().Jobs(ns).Create(ctx, job, metav1.CreateOptions{})
        if err != nil {
                return nil, err
        }

        completions := int32(1)
        if created.Spec.Completions != nil {
                completions = *created.Spec.Completions
        }
        parallelism := int32(1)
        if created.Spec.Parallelism != nil {
                parallelism = *created.Spec.Parallelism
        }

        return &models.JobInfo{
                Name:        created.Name,
                Namespace:   created.Namespace,
                Completions: completions,
                Succeeded:   created.Status.Succeeded,
                Parallelism: parallelism,
                Status:      "Pending",
                Labels:      created.Labels,
                CreatedAt:   created.CreationTimestamp.Time,
        }, nil
}

// ==================== Service操作 ====================

// GetServices 获取Service列表
func (c *Client) GetServices(namespace string) ([]models.ServiceInfo, error) {
        ctx := context.Background()
        var svcs *corev1.ServiceList
        var err error

        if namespace != "" {
                svcs, err = c.Clientset.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
        } else {
                svcs, err = c.Clientset.CoreV1().Services("").List(ctx, metav1.ListOptions{})
        }
        if err != nil {
                return nil, err
        }

        result := make([]models.ServiceInfo, 0, len(svcs.Items))
        for _, svc := range svcs.Items {
                info := models.ServiceInfo{
                        Name:       svc.Name,
                        Namespace:  svc.Namespace,
                        Type:       string(svc.Spec.Type),
                        ClusterIP:  svc.Spec.ClusterIP,
                        Selector:   svc.Spec.Selector,
                        CreatedAt:  svc.CreationTimestamp.Time,
                        Ports:      make([]models.ServicePort, 0),
                }

                // 外部IP
                if len(svc.Status.LoadBalancer.Ingress) > 0 {
                        if svc.Status.LoadBalancer.Ingress[0].IP != "" {
                                info.ExternalIP = svc.Status.LoadBalancer.Ingress[0].IP
                        } else {
                                info.ExternalIP = svc.Status.LoadBalancer.Ingress[0].Hostname
                        }
                } else if len(svc.Spec.ExternalIPs) > 0 {
                        info.ExternalIP = svc.Spec.ExternalIPs[0]
                }

                // 端口
                for _, p := range svc.Spec.Ports {
                        info.Ports = append(info.Ports, models.ServicePort{
                                Name:       p.Name,
                                Port:       p.Port,
                                TargetPort: p.TargetPort.String(),
                                Protocol:   string(p.Protocol),
                        })
                }

                result = append(result, info)
        }
        return result, nil
}

// ==================== Ingress操作 ====================

// GetIngresses 获取Ingress列表
func (c *Client) GetIngresses(namespace string) ([]models.IngressInfo, error) {
        ctx := context.Background()
        var ingresses *networkingv1.IngressList
        var err error

        if namespace != "" {
                ingresses, err = c.Clientset.NetworkingV1().Ingresses(namespace).List(ctx, metav1.ListOptions{})
        } else {
                ingresses, err = c.Clientset.NetworkingV1().Ingresses("").List(ctx, metav1.ListOptions{})
        }
        if err != nil {
                return nil, err
        }

        result := make([]models.IngressInfo, 0, len(ingresses.Items))
        for _, ing := range ingresses.Items {
                info := models.IngressInfo{
                        Name:      ing.Name,
                        Namespace: ing.Namespace,
                        ClassName: "",
                        Hosts:     make([]string, 0),
                        Paths:     make([]models.IngressPath, 0),
                        TLS:       len(ing.Spec.TLS) > 0,
                        CreatedAt: ing.CreationTimestamp.Time,
                }

                if ing.Spec.IngressClassName != nil {
                        info.ClassName = *ing.Spec.IngressClassName
                }

                for _, rule := range ing.Spec.Rules {
                        if rule.Host != "" {
                                info.Hosts = append(info.Hosts, rule.Host)
                        }
                        if rule.HTTP != nil {
                                for _, p := range rule.HTTP.Paths {
                                        path := models.IngressPath{
                                                Host:     rule.Host,
                                                Path:     p.Path,
                                                PathType: "",
                                        }
                                        if p.PathType != nil {
                                                path.PathType = string(*p.PathType)
                                        }
                                        if p.Backend.Service != nil {
                                                path.Backend.Service = p.Backend.Service.Name
                                                path.Backend.Port = p.Backend.Service.Port.String()
                                        }
                                        info.Paths = append(info.Paths, path)
                                }
                        }
                }

                result = append(result, info)
        }
        return result, nil
}

// ==================== ConfigMap操作 ====================

// GetConfigMaps 获取ConfigMap列表
func (c *Client) GetConfigMaps(namespace string) ([]models.ConfigMapInfo, error) {
        ctx := context.Background()
        var cms *corev1.ConfigMapList
        var err error

        if namespace != "" {
                cms, err = c.Clientset.CoreV1().ConfigMaps(namespace).List(ctx, metav1.ListOptions{})
        } else {
                cms, err = c.Clientset.CoreV1().ConfigMaps("").List(ctx, metav1.ListOptions{})
        }
        if err != nil {
                return nil, err
        }

        result := make([]models.ConfigMapInfo, 0, len(cms.Items))
        for _, cm := range cms.Items {
                result = append(result, models.ConfigMapInfo{
                        Name:      cm.Name,
                        Namespace: cm.Namespace,
                        Data:      cm.Data,
                        CreatedAt: cm.CreationTimestamp.Time,
                })
        }
        return result, nil
}

// CreateConfigMap 创建ConfigMap
func (c *Client) CreateConfigMap(namespace, name string, data map[string]string) (*models.ConfigMapInfo, error) {
        ctx := context.Background()
        cm, err := c.Clientset.CoreV1().ConfigMaps(namespace).Create(ctx, &corev1.ConfigMap{
                ObjectMeta: metav1.ObjectMeta{
                        Name: name,
                },
                Data: data,
        }, metav1.CreateOptions{})
        if err != nil {
                return nil, err
        }

        return &models.ConfigMapInfo{
                Name:      cm.Name,
                Namespace: cm.Namespace,
                Data:      cm.Data,
                CreatedAt: cm.CreationTimestamp.Time,
        }, nil
}

// DeleteConfigMap 删除ConfigMap
func (c *Client) DeleteConfigMap(namespace, name string) error {
        ctx := context.Background()
        return c.Clientset.CoreV1().ConfigMaps(namespace).Delete(ctx, name, metav1.DeleteOptions{})
}

// ==================== Secret操作 ====================

// GetSecrets 获取Secret列表
func (c *Client) GetSecrets(namespace string) ([]models.SecretInfo, error) {
        ctx := context.Background()
        var secrets *corev1.SecretList
        var err error

        if namespace != "" {
                secrets, err = c.Clientset.CoreV1().Secrets(namespace).List(ctx, metav1.ListOptions{})
        } else {
                secrets, err = c.Clientset.CoreV1().Secrets("").List(ctx, metav1.ListOptions{})
        }
        if err != nil {
                return nil, err
        }

        result := make([]models.SecretInfo, 0, len(secrets.Items))
        for _, secret := range secrets.Items {
                keys := make([]string, 0, len(secret.Data))
                for k := range secret.Data {
                        keys = append(keys, k)
                }

                result = append(result, models.SecretInfo{
                        Name:      secret.Name,
                        Namespace: secret.Namespace,
                        Type:      string(secret.Type),
                        DataKeys:  keys,
                        CreatedAt: secret.CreationTimestamp.Time,
                })
        }
        return result, nil
}

// DeleteSecret 删除Secret
func (c *Client) DeleteSecret(namespace, name string) error {
        ctx := context.Background()
        return c.Clientset.CoreV1().Secrets(namespace).Delete(ctx, name, metav1.DeleteOptions{})
}

// ==================== PVC操作 ====================

// GetPVCs 获取PVC列表
func (c *Client) GetPVCs(namespace string) ([]models.PVCInfo, error) {
        ctx := context.Background()
        var pvcs *corev1.PersistentVolumeClaimList
        var err error

        if namespace != "" {
                pvcs, err = c.Clientset.CoreV1().PersistentVolumeClaims(namespace).List(ctx, metav1.ListOptions{})
        } else {
                pvcs, err = c.Clientset.CoreV1().PersistentVolumeClaims("").List(ctx, metav1.ListOptions{})
        }
        if err != nil {
                return nil, err
        }

        result := make([]models.PVCInfo, 0, len(pvcs.Items))
        for _, pvc := range pvcs.Items {
                capacity := ""
                if pvc.Status.Capacity != nil {
                        if v, ok := pvc.Status.Capacity[corev1.ResourceStorage]; ok {
                                capacity = v.String()
                        }
                }
                if capacity == "" && pvc.Spec.Resources.Requests != nil {
                        if v, ok := pvc.Spec.Resources.Requests[corev1.ResourceStorage]; ok {
                                capacity = v.String()
                        }
                }

                accessModes := make([]string, 0, len(pvc.Spec.AccessModes))
                for _, am := range pvc.Spec.AccessModes {
                        accessModes = append(accessModes, string(am))
                }

                info := models.PVCInfo{
                        Name:         pvc.Name,
                        Namespace:    pvc.Namespace,
                        Status:       string(pvc.Status.Phase),
                        Capacity:     capacity,
                        AccessModes:  accessModes,
                        StorageClass: "",
                        VolumeName:   pvc.Spec.VolumeName,
                        CreatedAt:    pvc.CreationTimestamp.Time,
                }
                if pvc.Spec.StorageClassName != nil {
                        info.StorageClass = *pvc.Spec.StorageClassName
                }

                result = append(result, info)
        }
        return result, nil
}

// ==================== PV操作 ====================

// GetPVs 获取PV列表
func (c *Client) GetPVs() ([]models.PVInfo, error) {
        ctx := context.Background()
        pvs, err := c.Clientset.CoreV1().PersistentVolumes().List(ctx, metav1.ListOptions{})
        if err != nil {
                return nil, err
        }

        result := make([]models.PVInfo, 0, len(pvs.Items))
        for _, pv := range pvs.Items {
                capacity := ""
                if pv.Spec.Capacity != nil {
                        if v, ok := pv.Spec.Capacity[corev1.ResourceStorage]; ok {
                                capacity = v.String()
                        }
                }

                accessModes := make([]string, 0, len(pv.Spec.AccessModes))
                for _, am := range pv.Spec.AccessModes {
                        accessModes = append(accessModes, string(am))
                }

                info := models.PVInfo{
                        Name:          pv.Name,
                        Status:        string(pv.Status.Phase),
                        Capacity:      capacity,
                        AccessModes:   accessModes,
                        ReclaimPolicy: string(pv.Spec.PersistentVolumeReclaimPolicy),
                        StorageClass:  pv.Spec.StorageClassName,
                        CreatedAt:     pv.CreationTimestamp.Time,
                }

                if pv.Spec.NFS != nil {
                        info.NFS = &models.NFSInfo{
                                Server: pv.Spec.NFS.Server,
                                Path:   pv.Spec.NFS.Path,
                        }
                }

                result = append(result, info)
        }
        return result, nil
}

// ==================== StorageClass操作 ====================

// GetStorageClasses 获取StorageClass列表
func (c *Client) GetStorageClasses() ([]models.StorageClassInfo, error) {
        ctx := context.Background()
        scs, err := c.Clientset.StorageV1().StorageClasses().List(ctx, metav1.ListOptions{})
        if err != nil {
                return nil, err
        }

        // 找到默认StorageClass
        defaultSC := ""
        for _, sc := range scs.Items {
                if sc.Annotations["storageclass.kubernetes.io/is-default-class"] == "true" {
                        defaultSC = sc.Name
                        break
                }
        }

        result := make([]models.StorageClassInfo, 0, len(scs.Items))
        for _, sc := range scs.Items {
                reclaimPolicy := "Delete"
                if sc.ReclaimPolicy != nil {
                        reclaimPolicy = string(*sc.ReclaimPolicy)
                }
                volumeBindingMode := "Immediate"
                if sc.VolumeBindingMode != nil {
                        volumeBindingMode = string(*sc.VolumeBindingMode)
                }
                allowExpansion := sc.AllowVolumeExpansion != nil && *sc.AllowVolumeExpansion

                info := models.StorageClassInfo{
                        Name:                 sc.Name,
                        Provisioner:          sc.Provisioner,
                        ReclaimPolicy:        reclaimPolicy,
                        VolumeBindingMode:    volumeBindingMode,
                        AllowVolumeExpansion: allowExpansion,
                        Default:              sc.Name == defaultSC,
                        Parameters:           sc.Parameters,
                }
                result = append(result, info)
        }
        return result, nil
}

// ==================== Event操作 ====================

// GetEvents 获取事件列表
func (c *Client) GetEvents(namespace string) ([]models.EventInfo, error) {
        ctx := context.Background()
        var events *corev1.EventList
        var err error

        if namespace != "" {
                events, err = c.Clientset.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{})
        } else {
                events, err = c.Clientset.CoreV1().Events("").List(ctx, metav1.ListOptions{})
        }
        if err != nil {
                return nil, err
        }

        result := make([]models.EventInfo, 0, len(events.Items))
        for _, event := range events.Items {
                info := models.EventInfo{
                        Name:      event.Name,
                        Namespace: event.Namespace,
                        Type:      event.Type,
                        Reason:    event.Reason,
                        Message:   event.Message,
                        InvolvedObject: models.ObjectRef{
                                Kind:      event.InvolvedObject.Kind,
                                Name:      event.InvolvedObject.Name,
                                Namespace: event.InvolvedObject.Namespace,
                        },
                        Count:          event.Count,
                        FirstTimestamp: event.FirstTimestamp.Time,
                        LastTimestamp:  event.LastTimestamp.Time,
                        Source: models.EventSource{
                                Component: event.Source.Component,
                                Host:      event.Source.Host,
                        },
                }
                result = append(result, info)
        }

        // 按时间倒序排序
        for i := 0; i < len(result)-1; i++ {
                for j := i + 1; j < len(result); j++ {
                        if result[i].LastTimestamp.Before(result[j].LastTimestamp) {
                                result[i], result[j] = result[j], result[i]
                        }
                }
        }

        return result, nil
}

// ==================== ServiceAccount操作 ====================

// GetServiceAccounts 获取ServiceAccount列表
func (c *Client) GetServiceAccounts(namespace string) ([]models.ServiceAccountInfo, error) {
        ctx := context.Background()
        var sas *corev1.ServiceAccountList
        var err error

        if namespace != "" {
                sas, err = c.Clientset.CoreV1().ServiceAccounts(namespace).List(ctx, metav1.ListOptions{})
        } else {
                sas, err = c.Clientset.CoreV1().ServiceAccounts("").List(ctx, metav1.ListOptions{})
        }
        if err != nil {
                return nil, err
        }

        result := make([]models.ServiceAccountInfo, 0, len(sas.Items))
        for _, sa := range sas.Items {
                result = append(result, models.ServiceAccountInfo{
                        Name:      sa.Name,
                        Namespace: sa.Namespace,
                        Secrets:   len(sa.Secrets),
                        CreatedAt: sa.CreationTimestamp.Time,
                })
        }
        return result, nil
}

// ==================== Role操作 ====================

// GetRoles 获取Role和ClusterRole列表
func (c *Client) GetRoles(namespace string) ([]models.RoleInfo, error) {
        ctx := context.Background()
        result := make([]models.RoleInfo, 0)

        // 获取命名空间级别的Role
        var roles *rbacv1.RoleList
        var err error
        if namespace != "" {
                roles, err = c.Clientset.RbacV1().Roles(namespace).List(ctx, metav1.ListOptions{})
        } else {
                roles, err = c.Clientset.RbacV1().Roles("").List(ctx, metav1.ListOptions{})
        }
        if err != nil {
                return nil, err
        }
        for _, role := range roles.Items {
                result = append(result, models.RoleInfo{
                        Name:      role.Name,
                        Namespace: role.Namespace,
                        Type:      "Role",
                        Rules:     len(role.Rules),
                        CreatedAt: role.CreationTimestamp.Time,
                })
        }

        // 获取集群级别的ClusterRole（只在没有指定命名空间时返回）
        if namespace == "" {
                clusterRoles, err := c.Clientset.RbacV1().ClusterRoles().List(ctx, metav1.ListOptions{})
                if err != nil {
                        return nil, err
                }
                for _, cr := range clusterRoles.Items {
                        result = append(result, models.RoleInfo{
                                Name:      cr.Name,
                                Namespace: "",
                                Type:      "ClusterRole",
                                Rules:     len(cr.Rules),
                                CreatedAt: cr.CreationTimestamp.Time,
                        })
                }
        }

        return result, nil
}

// ==================== RoleBinding操作 ====================

// GetRoleBindings 获取RoleBinding和ClusterRoleBinding列表
func (c *Client) GetRoleBindings(namespace string) ([]models.RoleBindingInfo, error) {
        ctx := context.Background()
        result := make([]models.RoleBindingInfo, 0)

        // 获取命名空间级别的RoleBinding
        var rbs *rbacv1.RoleBindingList
        var err error
        if namespace != "" {
                rbs, err = c.Clientset.RbacV1().RoleBindings(namespace).List(ctx, metav1.ListOptions{})
        } else {
                rbs, err = c.Clientset.RbacV1().RoleBindings("").List(ctx, metav1.ListOptions{})
        }
        if err != nil {
                return nil, err
        }
        for _, rb := range rbs.Items {
                subjects := make([]string, 0, len(rb.Subjects))
                for _, s := range rb.Subjects {
                        subjects = append(subjects, s.Name)
                }
                result = append(result, models.RoleBindingInfo{
                        Name:      rb.Name,
                        Namespace: rb.Namespace,
                        RoleName:  rb.RoleRef.Name,
                        RoleKind:  rb.RoleRef.Kind,
                        Subjects:  subjects,
                        Type:      "RoleBinding",
                        CreatedAt: rb.CreationTimestamp.Time,
                })
        }

        // 获取集群级别的ClusterRoleBinding（只在没有指定命名空间时返回）
        if namespace == "" {
                crbs, err := c.Clientset.RbacV1().ClusterRoleBindings().List(ctx, metav1.ListOptions{})
                if err != nil {
                        return nil, err
                }
                for _, crb := range crbs.Items {
                        subjects := make([]string, 0, len(crb.Subjects))
                        for _, s := range crb.Subjects {
                                subjects = append(subjects, s.Name)
                        }
                        result = append(result, models.RoleBindingInfo{
                                Name:      crb.Name,
                                Namespace: "",
                                RoleName:  crb.RoleRef.Name,
                                RoleKind:  crb.RoleRef.Kind,
                                Subjects:  subjects,
                                Type:      "ClusterRoleBinding",
                                CreatedAt: crb.CreationTimestamp.Time,
                        })
                }
        }

        return result, nil
}

// 辅助函数：解析CPU资源
func parseCPU(cpu string) float64 {
        if strings.HasSuffix(cpu, "m") {
                val, _ := resource.ParseQuantity(cpu)
                return float64(val.MilliValue()) / 1000
        }
        val, _ := resource.ParseQuantity(cpu)
        return float64(val.Value())
}

// 辅助函数：解析内存资源
func parseMemory(memory string) float64 {
        val, _ := resource.ParseQuantity(memory)
        return float64(val.Value())
}

// ==================== 中间件状态检测 ====================

// middlewareDefinitions 定义需要检测的中间件
var middlewareDefinitions = []struct {
        Name        string
        Category    string
        Namespace   string
        LabelSelector string
        PortHint    []string
}{
        {"Prometheus", "monitoring", "monitoring", "app.kubernetes.io/name=prometheus", []string{"9090"}},
        {"Grafana", "monitoring", "monitoring", "app.kubernetes.io/name=grafana", []string{"3000"}},
        {"Alertmanager", "monitoring", "monitoring", "app.kubernetes.io/name=alertmanager", []string{"9093"}},
        {"Node Exporter", "monitoring", "monitoring", "app.kubernetes.io/name=prometheus-node-exporter", []string{"9100"}},
        {"kube-state-metrics", "monitoring", "monitoring", "app.kubernetes.io/name=kube-state-metrics", []string{"8080"}},
        {"MySQL Exporter", "database", "monitoring", "app=mysql-exporter", []string{"9104"}},
        {"Redis Exporter", "database", "monitoring", "app=redis-exporter", []string{"9121"}},
        {"Nginx Exporter", "monitoring", "monitoring", "app=nginx-exporter", []string{"9113"}},
        {"Traefik Ingress", "ingress", "kube-system", "app.kubernetes.io/name=traefik", []string{"80", "443"}},
        {"CoreDNS", "dns", "kube-system", "k8s-app=kube-dns", []string{"53"}},
        {"Metrics Server", "monitoring", "kube-system", "k8s-app=metrics-server", []string{"443"}},
        {"Local Path Provisioner", "storage", "kube-system", "app=local-path-provisioner", []string{}},
}

// GetMiddlewareStatus 获取中间件状态
func (c *Client) GetMiddlewareStatus() (*models.MiddlewareOverview, error) {
        ctx := context.Background()
        overview := &models.MiddlewareOverview{
                Items: make([]models.MiddlewareStatus, 0),
        }

        for _, mw := range middlewareDefinitions {
                status := models.MiddlewareStatus{
                        Name:      mw.Name,
                        Category:  mw.Category,
                        Namespace: mw.Namespace,
                        Ports:     mw.PortHint,
                        Status:    "not_deployed",
                }

                // 查询 Pods
                pods, err := c.Clientset.CoreV1().Pods(mw.Namespace).List(ctx, metav1.ListOptions{
                        LabelSelector: mw.LabelSelector,
                })
                if err != nil {
                        return nil, err
                }

                if len(pods.Items) > 0 {
                        status.PodCount = len(pods.Items)
                        status.ReadyPods = 0
                        status.Status = "running"

                        for _, pod := range pods.Items {
                                if pod.Status.Phase == corev1.PodRunning {
                                        // 检查容器是否就绪
                                        ready := true
                                        for _, cs := range pod.Status.ContainerStatuses {
                                                if !cs.Ready {
                                                        ready = false
                                                        break
                                                }
                                        }
                                        if ready {
                                                status.ReadyPods++
                                        }
                                } else if pod.Status.Phase == corev1.PodPending {
                                        status.Status = "pending"
                                }

                                // 获取版本信息
                                if status.Version == "" && pod.Labels != nil {
                                        if v, ok := pod.Labels["app.kubernetes.io/version"]; ok {
                                                status.Version = v
                                        }
                                }
                                status.Labels = pod.Labels
                                status.CreatedAt = pod.CreationTimestamp.Time
                        }

                        // 如果有 Pod 但都不就绪，状态为 pending
                        if status.ReadyPods == 0 && status.Status == "running" {
                                status.Status = "pending"
                        }
                }

                overview.Items = append(overview.Items, status)
                overview.Total++
                switch status.Status {
                case "running":
                        overview.Running++
                case "pending":
                        overview.Pending++
                default:
                        overview.NotDeployed++
                }
        }

        return overview, nil
}

// 确保导入被使用
var _ = storagev1.SchemeGroupVersion
var _ = parseCPU
var _ = parseMemory

// ==================== YAML操作 ====================

// PodYamlInfo Pod YAML 信息（包含是否可更新的提示）
type PodYamlInfo struct {
        Yaml             string `json:"yaml"`
        HasController    bool   `json:"hasController"`
        ControllerKind   string `json:"controllerKind,omitempty"`
        ControllerName   string `json:"controllerName,omitempty"`
        UpdateStrategy   string `json:"updateStrategy"`
        Warning          string `json:"warning,omitempty"`
}

// GetPodYaml 获取Pod的YAML配置（使用client-go原生方法）
func (c *Client) GetPodYaml(namespace, name string) (*PodYamlInfo, error) {
        ctx := context.Background()
        
        // 使用 client-go 获取 Pod
        pod, err := c.Clientset.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
        if err != nil {
                return nil, fmt.Errorf("failed to get pod: %w", err)
        }
        
        // 检查是否有控制器管理
        info := &PodYamlInfo{
                HasController:  false,
                UpdateStrategy: "delete_recreate",
                Warning: "Pod 的大部分 spec 字段（如镜像、资源限制等）是不可变的。独立 Pod 需要删除重建才能生效。",
        }
        
        if len(pod.OwnerReferences) > 0 {
                for _, owner := range pod.OwnerReferences {
                        if owner.Controller != nil && *owner.Controller {
                                info.HasController = true
                                info.ControllerKind = owner.Kind
                                info.ControllerName = owner.Name
                                info.UpdateStrategy = "update_controller"
                                info.Warning = fmt.Sprintf("此 Pod 由 %s/%s 管理。要更新 Pod 配置，请编辑控制器的 YAML。", owner.Kind, owner.Name)
                                break
                        }
                }
        }
        
        // 清理只读字段，使 YAML 更干净
        pod.ManagedFields = nil
        pod.ResourceVersion = ""
        pod.UID = ""
        pod.SelfLink = ""
        pod.Generation = 0
        pod.CreationTimestamp = metav1.Time{}
        pod.DeletionTimestamp = nil
        pod.DeletionGracePeriodSeconds = nil
        pod.Status = corev1.PodStatus{} // 清除状态信息，只保留 spec
        
        // 使用 sigs.k8s.io/yaml 序列化为 YAML
        yamlBytes, err := yaml.Marshal(pod)
        if err != nil {
                return nil, fmt.Errorf("failed to marshal pod to yaml: %w", err)
        }
        
        info.Yaml = string(yamlBytes)
        return info, nil
}

// DeleteAndRecreatePod 删除并重建 Pod（用于独立 Pod 更新）
func (c *Client) DeleteAndRecreatePod(namespace, name, yamlContent string) error {
        ctx := context.Background()
        
        // 解析 YAML 为 Pod 对象
        var newPod corev1.Pod
        if err := yaml.Unmarshal([]byte(yamlContent), &newPod); err != nil {
                return fmt.Errorf("failed to unmarshal yaml: %w", err)
        }
        
        // 确保 namespace 和 name 正确
        newPod.Namespace = namespace
        newPod.Name = name
        
        // 清理创建时不能设置的字段
        newPod.ResourceVersion = ""
        newPod.UID = ""
        newPod.SelfLink = ""
        newPod.Generation = 0
        newPod.CreationTimestamp = metav1.Time{}
        newPod.DeletionTimestamp = nil
        newPod.DeletionGracePeriodSeconds = nil
        newPod.ManagedFields = nil
        newPod.Status = corev1.PodStatus{}
        
        // 获取当前 Pod 信息
        currentPod, err := c.Clientset.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
        if err != nil {
                return fmt.Errorf("failed to get current pod: %w", err)
        }
        
        // 检查是否有控制器管理
        if len(currentPod.OwnerReferences) > 0 {
                for _, owner := range currentPod.OwnerReferences {
                        if owner.Controller != nil && *owner.Controller {
                                return fmt.Errorf("此 Pod 由 %s/%s 管理，请直接编辑控制器的 YAML", owner.Kind, owner.Name)
                        }
                }
        }
        
        // 删除旧 Pod
        err = c.Clientset.CoreV1().Pods(namespace).Delete(ctx, name, metav1.DeleteOptions{})
        if err != nil {
                return fmt.Errorf("failed to delete pod: %w", err)
        }
        
        // 等待 Pod 删除完成
        for i := 0; i < 30; i++ {
                _, err := c.Clientset.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
                if err != nil {
                        // Pod 已删除
                        break
                }
                time.Sleep(500 * time.Millisecond)
        }
        
        // 创建新 Pod
        _, err = c.Clientset.CoreV1().Pods(namespace).Create(ctx, &newPod, metav1.CreateOptions{})
        if err != nil {
                return fmt.Errorf("failed to create pod: %w", err)
        }
        
        return nil
}

// UpdateControllerYaml 更新控制器（Deployment/StatefulSet/DaemonSet）的 YAML
func (c *Client) UpdateControllerYaml(kind, namespace, name, yamlContent string) error {
        ctx := context.Background()
        
        switch strings.ToLower(kind) {
        case "deployment", "deployments":
                var deploy appsv1.Deployment
                if err := yaml.Unmarshal([]byte(yamlContent), &deploy); err != nil {
                        return fmt.Errorf("failed to unmarshal yaml: %w", err)
                }
                
                // 获取当前 Deployment
                current, err := c.Clientset.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
                if err != nil {
                        return fmt.Errorf("failed to get current deployment: %w", err)
                }
                
                // 保留必要的元数据
                deploy.ResourceVersion = current.ResourceVersion
                deploy.UID = current.UID
                deploy.Namespace = namespace
                deploy.Name = name
                
                _, err = c.Clientset.AppsV1().Deployments(namespace).Update(ctx, &deploy, metav1.UpdateOptions{})
                return err
                
        case "statefulset", "statefulsets":
                var sts appsv1.StatefulSet
                if err := yaml.Unmarshal([]byte(yamlContent), &sts); err != nil {
                        return fmt.Errorf("failed to unmarshal yaml: %w", err)
                }
                
                current, err := c.Clientset.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
                if err != nil {
                        return fmt.Errorf("failed to get current statefulset: %w", err)
                }
                
                sts.ResourceVersion = current.ResourceVersion
                sts.UID = current.UID
                sts.Namespace = namespace
                sts.Name = name
                
                _, err = c.Clientset.AppsV1().StatefulSets(namespace).Update(ctx, &sts, metav1.UpdateOptions{})
                return err
                
        case "daemonset", "daemonsets":
                var ds appsv1.DaemonSet
                if err := yaml.Unmarshal([]byte(yamlContent), &ds); err != nil {
                        return fmt.Errorf("failed to unmarshal yaml: %w", err)
                }
                
                current, err := c.Clientset.AppsV1().DaemonSets(namespace).Get(ctx, name, metav1.GetOptions{})
                if err != nil {
                        return fmt.Errorf("failed to get current daemonset: %w", err)
                }
                
                ds.ResourceVersion = current.ResourceVersion
                ds.UID = current.UID
                ds.Namespace = namespace
                ds.Name = name
                
                _, err = c.Clientset.AppsV1().DaemonSets(namespace).Update(ctx, &ds, metav1.UpdateOptions{})
                return err
                
        default:
                return fmt.Errorf("unsupported controller kind: %s", kind)
        }
}

// UpdateResourceYaml 通用更新资源 YAML 方法
func (c *Client) UpdateResourceYaml(kind, namespace, name, yamlContent string) error {
        ctx := context.Background()
        
        switch strings.ToLower(kind) {
        case "pod", "pods":
                // Pod 使用删除重建策略
                return c.DeleteAndRecreatePod(namespace, name, yamlContent)
                
        case "deployment", "deployments", "statefulset", "statefulsets", "daemonset", "daemonsets":
                return c.UpdateControllerYaml(kind, namespace, name, yamlContent)
                
        case "service", "services":
                var svc corev1.Service
                if err := yaml.Unmarshal([]byte(yamlContent), &svc); err != nil {
                        return fmt.Errorf("failed to unmarshal yaml: %w", err)
                }
                
                current, err := c.Clientset.CoreV1().Services(namespace).Get(ctx, name, metav1.GetOptions{})
                if err != nil {
                        return fmt.Errorf("failed to get current service: %w", err)
                }
                
                // Service 的 ClusterIP 是不可变的
                svc.ResourceVersion = current.ResourceVersion
                svc.UID = current.UID
                svc.Namespace = namespace
                svc.Name = name
                svc.Spec.ClusterIP = current.Spec.ClusterIP // 保留原有 ClusterIP
                
                _, err = c.Clientset.CoreV1().Services(namespace).Update(ctx, &svc, metav1.UpdateOptions{})
                return err
                
        case "configmap", "configmaps":
                var cm corev1.ConfigMap
                if err := yaml.Unmarshal([]byte(yamlContent), &cm); err != nil {
                        return fmt.Errorf("failed to unmarshal yaml: %w", err)
                }
                
                cm.Namespace = namespace
                cm.Name = name
                
                _, err := c.Clientset.CoreV1().ConfigMaps(namespace).Update(ctx, &cm, metav1.UpdateOptions{})
                return err
                
        case "secret", "secrets":
                var secret corev1.Secret
                if err := yaml.Unmarshal([]byte(yamlContent), &secret); err != nil {
                        return fmt.Errorf("failed to unmarshal yaml: %w", err)
                }
                
                secret.Namespace = namespace
                secret.Name = name
                
                _, err := c.Clientset.CoreV1().Secrets(namespace).Update(ctx, &secret, metav1.UpdateOptions{})
                return err
                
        case "ingress", "ingresses":
                var ing networkingv1.Ingress
                if err := yaml.Unmarshal([]byte(yamlContent), &ing); err != nil {
                        return fmt.Errorf("failed to unmarshal yaml: %w", err)
                }
                
                current, err := c.Clientset.NetworkingV1().Ingresses(namespace).Get(ctx, name, metav1.GetOptions{})
                if err != nil {
                        return fmt.Errorf("failed to get current ingress: %w", err)
                }
                
                ing.ResourceVersion = current.ResourceVersion
                ing.UID = current.UID
                ing.Namespace = namespace
                ing.Name = name
                
                _, err = c.Clientset.NetworkingV1().Ingresses(namespace).Update(ctx, &ing, metav1.UpdateOptions{})
                return err
                
        default:
                return fmt.Errorf("unsupported resource kind for update: %s", kind)
        }
}

// GetResourceYaml 通用获取资源YAML方法
func (c *Client) GetResourceYaml(kind, namespace, name string) (string, error) {
        ctx := context.Background()
        
        var obj runtime.Object
        var apiVersion, kindStr string
        var err error
        
        switch strings.ToLower(kind) {
        case "pod", "pods":
                obj, err = c.Clientset.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
                apiVersion = "v1"
                kindStr = "Pod"
        case "deployment", "deployments":
                obj, err = c.Clientset.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
                apiVersion = "apps/v1"
                kindStr = "Deployment"
        case "service", "services":
                obj, err = c.Clientset.CoreV1().Services(namespace).Get(ctx, name, metav1.GetOptions{})
                apiVersion = "v1"
                kindStr = "Service"
        case "configmap", "configmaps":
                obj, err = c.Clientset.CoreV1().ConfigMaps(namespace).Get(ctx, name, metav1.GetOptions{})
                apiVersion = "v1"
                kindStr = "ConfigMap"
        case "secret", "secrets":
                obj, err = c.Clientset.CoreV1().Secrets(namespace).Get(ctx, name, metav1.GetOptions{})
                apiVersion = "v1"
                kindStr = "Secret"
        case "namespace", "namespaces":
                obj, err = c.Clientset.CoreV1().Namespaces().Get(ctx, name, metav1.GetOptions{})
                apiVersion = "v1"
                kindStr = "Namespace"
        case "node", "nodes":
                obj, err = c.Clientset.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
                apiVersion = "v1"
                kindStr = "Node"
        case "statefulset", "statefulsets":
                obj, err = c.Clientset.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
                apiVersion = "apps/v1"
                kindStr = "StatefulSet"
        case "daemonset", "daemonsets":
                obj, err = c.Clientset.AppsV1().DaemonSets(namespace).Get(ctx, name, metav1.GetOptions{})
                apiVersion = "apps/v1"
                kindStr = "DaemonSet"
        case "job", "jobs":
                obj, err = c.Clientset.BatchV1().Jobs(namespace).Get(ctx, name, metav1.GetOptions{})
                apiVersion = "batch/v1"
                kindStr = "Job"
        case "cronjob", "cronjobs":
                obj, err = c.Clientset.BatchV1().CronJobs(namespace).Get(ctx, name, metav1.GetOptions{})
                apiVersion = "batch/v1"
                kindStr = "CronJob"
        case "ingress", "ingresses":
                obj, err = c.Clientset.NetworkingV1().Ingresses(namespace).Get(ctx, name, metav1.GetOptions{})
                apiVersion = "networking.k8s.io/v1"
                kindStr = "Ingress"
        case "persistentvolumeclaim", "pvcs", "persistentvolumeclaims":
                obj, err = c.Clientset.CoreV1().PersistentVolumeClaims(namespace).Get(ctx, name, metav1.GetOptions{})
                apiVersion = "v1"
                kindStr = "PersistentVolumeClaim"
        default:
                return "", fmt.Errorf("unsupported resource kind: %s", kind)
        }
        
        if err != nil {
                return "", fmt.Errorf("failed to get %s %s: %w", kind, name, err)
        }
        
        // 清除 managedFields 字段（这些是 k8s 自动管理的字段管理元数据）
        clearManagedFields(obj)
        
        // 使用 sigs.k8s.io/yaml 序列化为 YAML
        yamlBytes, err := yaml.Marshal(obj)
        if err != nil {
                return "", fmt.Errorf("failed to marshal to yaml: %w", err)
        }
        
        // 添加 apiVersion 和 kind 到 YAML 开头
        result := fmt.Sprintf("apiVersion: %s\nkind: %s\n%s", apiVersion, kindStr, string(yamlBytes))
        
        return result, nil
}

// clearManagedFields 清除对象的 managedFields 字段
func clearManagedFields(obj runtime.Object) {
        switch o := obj.(type) {
        case *corev1.Pod:
                o.ObjectMeta.ManagedFields = nil
        case *appsv1.Deployment:
                o.ObjectMeta.ManagedFields = nil
        case *corev1.Service:
                o.ObjectMeta.ManagedFields = nil
        case *corev1.ConfigMap:
                o.ObjectMeta.ManagedFields = nil
        case *corev1.Secret:
                o.ObjectMeta.ManagedFields = nil
        case *corev1.Namespace:
                o.ObjectMeta.ManagedFields = nil
        case *corev1.Node:
                o.ObjectMeta.ManagedFields = nil
        case *appsv1.StatefulSet:
                o.ObjectMeta.ManagedFields = nil
        case *appsv1.DaemonSet:
                o.ObjectMeta.ManagedFields = nil
        case *batchv1.Job:
                o.ObjectMeta.ManagedFields = nil
        case *batchv1.CronJob:
                o.ObjectMeta.ManagedFields = nil
        case *networkingv1.Ingress:
                o.ObjectMeta.ManagedFields = nil
        case *corev1.PersistentVolumeClaim:
                o.ObjectMeta.ManagedFields = nil
        }
}

// ==================== CronJob操作 ====================

// GetCronJobs 获取CronJob列表
func (c *Client) GetCronJobs(namespace string) ([]models.CronJobInfo, error) {
        ctx := context.Background()
        var cjs *batchv1.CronJobList
        var err error

        if namespace != "" {
                cjs, err = c.Clientset.BatchV1().CronJobs(namespace).List(ctx, metav1.ListOptions{})
        } else {
                cjs, err = c.Clientset.BatchV1().CronJobs("").List(ctx, metav1.ListOptions{})
        }
        if err != nil {
                return nil, err
        }

        result := make([]models.CronJobInfo, 0, len(cjs.Items))
        for _, cj := range cjs.Items {
                info := models.CronJobInfo{
                        Name:          cj.Name,
                        Namespace:     cj.Namespace,
                        Schedule:      cj.Spec.Schedule,
                        Suspend:       *cj.Spec.Suspend,
                        Labels:        cj.Labels,
                        CreatedAt:     cj.CreationTimestamp.Time,
                        // SuccessfulJobs and FailedJobs are deprecated in batch/v1 CronJobStatus
                        // We count active jobs instead
                        SuccessfulJobs: 0,
                        FailedJobs:    0,
                }
                if cj.Status.LastScheduleTime != nil {
                        t := cj.Status.LastScheduleTime.Time
                        info.LastSchedule = &t
                }
                result = append(result, info)
        }
        return result, nil
}

// CreateCronJob 创建CronJob
func (c *Client) CreateCronJob(req models.CreateCronJobRequest) (*models.CronJobInfo, error) {
        ctx := context.Background()
        ns := req.Namespace
        if ns == "" {
                ns = "default"
        }

        containerName := req.ContainerName
        if containerName == "" {
                containerName = req.Name
        }

        labels := req.Labels
        if len(labels) == 0 {
                labels = map[string]string{
                        "app": req.Name,
                }
        }

        // 并发策略
        concurrencyPolicy := batchv1.AllowConcurrent
        switch req.ConcurrencyPolicy {
        case "Forbid":
                concurrencyPolicy = batchv1.ForbidConcurrent
        case "Replace":
                concurrencyPolicy = batchv1.ReplaceConcurrent
        }

        // 构建容器
        container := corev1.Container{
                Name:    containerName,
                Image:   req.Image,
                Command: req.Command,
                Args:    req.Args,
        }

        suspend := req.Suspend
        cj := &batchv1.CronJob{
                ObjectMeta: metav1.ObjectMeta{
                        Name:      req.Name,
                        Namespace: ns,
                        Labels:    labels,
                },
                Spec: batchv1.CronJobSpec{
                        Schedule:          req.Schedule,
                        Suspend:           &suspend,
                        ConcurrencyPolicy: concurrencyPolicy,
                        JobTemplate: batchv1.JobTemplateSpec{
                                Spec: batchv1.JobSpec{
                                        Template: corev1.PodTemplateSpec{
                                                ObjectMeta: metav1.ObjectMeta{
                                                        Labels: map[string]string{
                                                                "app": req.Name,
                                                        },
                                                },
                                                Spec: corev1.PodSpec{
                                                        RestartPolicy: corev1.RestartPolicyOnFailure,
                                                        Containers:    []corev1.Container{container},
                                                },
                                        },
                                },
                        },
                },
        }

        if req.SuccessfulHistory > 0 {
                successfulHistory := int32(req.SuccessfulHistory)
                cj.Spec.SuccessfulJobsHistoryLimit = &successfulHistory
        }
        if req.FailedHistory > 0 {
                failedHistory := int32(req.FailedHistory)
                cj.Spec.FailedJobsHistoryLimit = &failedHistory
        }

        created, err := c.Clientset.BatchV1().CronJobs(ns).Create(ctx, cj, metav1.CreateOptions{})
        if err != nil {
                return nil, err
        }

        return &models.CronJobInfo{
                Name:           created.Name,
                Namespace:      created.Namespace,
                Schedule:       created.Spec.Schedule,
                Suspend:        *created.Spec.Suspend,
                SuccessfulJobs: 0,
                FailedJobs:     0,
                Labels:         created.Labels,
                CreatedAt:      created.CreationTimestamp.Time,
        }, nil
}

// DeleteStatefulSet 删除StatefulSet
func (c *Client) DeleteStatefulSet(namespace, name string) error {
        ctx := context.Background()
        return c.Clientset.AppsV1().StatefulSets(namespace).Delete(ctx, name, metav1.DeleteOptions{})
}

// ScaleStatefulSet 扩缩容StatefulSet
func (c *Client) ScaleStatefulSet(namespace, name string, replicas int32) error {
        ctx := context.Background()
        sts, err := c.Clientset.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
        if err != nil {
                return err
        }

        sts.Spec.Replicas = &replicas
        _, err = c.Clientset.AppsV1().StatefulSets(namespace).Update(ctx, sts, metav1.UpdateOptions{})
        return err
}

// RestartStatefulSet 重启StatefulSet
func (c *Client) RestartStatefulSet(namespace, name string) error {
        ctx := context.Background()
        sts, err := c.Clientset.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
        if err != nil {
                return err
        }

        if sts.Spec.Template.Annotations == nil {
                sts.Spec.Template.Annotations = make(map[string]string)
        }
        sts.Spec.Template.Annotations["kubectl.kubernetes.io/restartedAt"] = time.Now().Format(time.RFC3339)

        _, err = c.Clientset.AppsV1().StatefulSets(namespace).Update(ctx, sts, metav1.UpdateOptions{})
        return err
}

// GetStatefulSetDetail 获取StatefulSet详情
func (c *Client) GetStatefulSetDetail(namespace, name string) (*models.StatefulSetDetail, error) {
        ctx := context.Background()
        sts, err := c.Clientset.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
        if err != nil {
                return nil, err
        }

        detail := &models.StatefulSetDetail{
                Name:            sts.Name,
                Namespace:       sts.Namespace,
                Replicas:        *sts.Spec.Replicas,
                ReadyReplicas:   sts.Status.ReadyReplicas,
                CurrentReplicas: sts.Status.CurrentReplicas,
                UpdatedReplicas: sts.Status.UpdatedReplicas,
                ServiceName:     sts.Spec.ServiceName,
                UpdateStrategy:  string(sts.Spec.UpdateStrategy.Type),
                Labels:          sts.Labels,
                Annotations:     sts.Annotations,
                Selector:        sts.Spec.Selector.MatchLabels,
                Containers:      make([]models.StatefulSetContainerInfo, 0),
                VolumeClaimTemplates: make([]models.VolumeClaimTemplateInfo, 0),
                Pods:            make([]models.StatefulSetPodInfo, 0),
                Events:          make([]models.EventInfo, 0),
                CreatedAt:       sts.CreationTimestamp.Time,
        }

        // Partition
        if sts.Spec.UpdateStrategy.RollingUpdate != nil && sts.Spec.UpdateStrategy.RollingUpdate.Partition != nil {
                detail.Partition = sts.Spec.UpdateStrategy.RollingUpdate.Partition
        }

        // 容器信息
        for _, container := range sts.Spec.Template.Spec.Containers {
                cInfo := models.StatefulSetContainerInfo{
                        Name:  container.Name,
                        Image: container.Image,
                        Ports: make([]int32, 0),
                }
                for _, port := range container.Ports {
                        cInfo.Ports = append(cInfo.Ports, port.ContainerPort)
                }
                detail.Containers = append(detail.Containers, cInfo)
        }

        // VolumeClaimTemplates
        for _, vct := range sts.Spec.VolumeClaimTemplates {
                vctInfo := models.VolumeClaimTemplateInfo{
                        Name:        vct.Name,
                        AccessModes: make([]string, 0),
                }
                if vct.Spec.StorageClassName != nil {
                        vctInfo.StorageClass = *vct.Spec.StorageClassName
                }
                for _, am := range vct.Spec.AccessModes {
                        vctInfo.AccessModes = append(vctInfo.AccessModes, string(am))
                }
                if vct.Spec.Resources.Requests != nil {
                        if q, ok := vct.Spec.Resources.Requests[corev1.ResourceStorage]; ok {
                                vctInfo.Storage = q.String()
                        }
                }
                detail.VolumeClaimTemplates = append(detail.VolumeClaimTemplates, vctInfo)
        }

        // 获取关联的 Pod
        pods, _ := c.Clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
                LabelSelector: metav1.FormatLabelSelector(sts.Spec.Selector),
        })
        for _, pod := range pods.Items {
                status, _, _ := getPodDisplayStatus(&pod)
                ready := fmt.Sprintf("%d/%d", countReadyContainers(&pod), len(pod.Spec.Containers))
                detail.Pods = append(detail.Pods, models.StatefulSetPodInfo{
                        Name:      pod.Name,
                        Status:    status,
                        Ready:     ready,
                        PodIP:     pod.Status.PodIP,
                        NodeName:  pod.Spec.NodeName,
                        CreatedAt: pod.CreationTimestamp.Time,
                })
        }

        return detail, nil
}

// DeleteDaemonSet 删除DaemonSet
func (c *Client) DeleteDaemonSet(namespace, name string) error {
        ctx := context.Background()
        return c.Clientset.AppsV1().DaemonSets(namespace).Delete(ctx, name, metav1.DeleteOptions{})
}

// RestartDaemonSet 重启DaemonSet
func (c *Client) RestartDaemonSet(namespace, name string) error {
        ctx := context.Background()
        ds, err := c.Clientset.AppsV1().DaemonSets(namespace).Get(ctx, name, metav1.GetOptions{})
        if err != nil {
                return err
        }

        if ds.Spec.Template.Annotations == nil {
                ds.Spec.Template.Annotations = make(map[string]string)
        }
        ds.Spec.Template.Annotations["kubectl.kubernetes.io/restartedAt"] = time.Now().Format(time.RFC3339)

        _, err = c.Clientset.AppsV1().DaemonSets(namespace).Update(ctx, ds, metav1.UpdateOptions{})
        return err
}

// GetDaemonSetDetail 获取DaemonSet详情
func (c *Client) GetDaemonSetDetail(namespace, name string) (*models.DaemonSetDetail, error) {
        ctx := context.Background()
        ds, err := c.Clientset.AppsV1().DaemonSets(namespace).Get(ctx, name, metav1.GetOptions{})
        if err != nil {
                return nil, err
        }

        detail := &models.DaemonSetDetail{
                Name:           ds.Name,
                Namespace:      ds.Namespace,
                DesiredNodes:   ds.Status.DesiredNumberScheduled,
                CurrentNodes:   ds.Status.CurrentNumberScheduled,
                ReadyNodes:     ds.Status.NumberReady,
                UpdatedNodes:   ds.Status.UpdatedNumberScheduled,
                AvailableNodes: ds.Status.NumberAvailable,
                UpdateStrategy: string(ds.Spec.UpdateStrategy.Type),
                Labels:         ds.Labels,
                Annotations:    ds.Annotations,
                Selector:       ds.Spec.Selector.MatchLabels,
                Containers:     make([]models.StatefulSetContainerInfo, 0),
                Pods:           make([]models.StatefulSetPodInfo, 0),
                Events:         make([]models.EventInfo, 0),
                CreatedAt:      ds.CreationTimestamp.Time,
        }

        // 容器信息
        for _, container := range ds.Spec.Template.Spec.Containers {
                cInfo := models.StatefulSetContainerInfo{
                        Name:  container.Name,
                        Image: container.Image,
                        Ports: make([]int32, 0),
                }
                for _, port := range container.Ports {
                        cInfo.Ports = append(cInfo.Ports, port.ContainerPort)
                }
                detail.Containers = append(detail.Containers, cInfo)
        }

        // 获取关联的 Pod
        pods, _ := c.Clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
                LabelSelector: metav1.FormatLabelSelector(ds.Spec.Selector),
        })
        for _, pod := range pods.Items {
                status, _, _ := getPodDisplayStatus(&pod)
                ready := fmt.Sprintf("%d/%d", countReadyContainers(&pod), len(pod.Spec.Containers))
                detail.Pods = append(detail.Pods, models.StatefulSetPodInfo{
                        Name:      pod.Name,
                        Status:    status,
                        Ready:     ready,
                        PodIP:     pod.Status.PodIP,
                        NodeName:  pod.Spec.NodeName,
                        CreatedAt: pod.CreationTimestamp.Time,
                })
        }

        return detail, nil
}

// DeleteJob 删除Job
func (c *Client) DeleteJob(namespace, name string) error {
        ctx := context.Background()
        return c.Clientset.BatchV1().Jobs(namespace).Delete(ctx, name, metav1.DeleteOptions{})
}

// GetJobDetail 获取Job详情
func (c *Client) GetJobDetail(namespace, name string) (*models.JobDetail, error) {
        ctx := context.Background()
        job, err := c.Clientset.BatchV1().Jobs(namespace).Get(ctx, name, metav1.GetOptions{})
        if err != nil {
                return nil, err
        }

        status := "Pending"
        if job.Spec.Completions != nil && job.Status.Succeeded >= *job.Spec.Completions {
                status = "Completed"
        } else if job.Spec.BackoffLimit != nil && job.Status.Failed >= *job.Spec.BackoffLimit {
                status = "Failed"
        } else if job.Status.Active > 0 {
                status = "Running"
        }

        completions := int32(1)
        if job.Spec.Completions != nil {
                completions = *job.Spec.Completions
        }
        parallelism := int32(1)
        if job.Spec.Parallelism != nil {
                parallelism = *job.Spec.Parallelism
        }

        detail := &models.JobDetail{
                Name:           job.Name,
                Namespace:      job.Namespace,
                Completions:    completions,
                Parallelism:    parallelism,
                Succeeded:      job.Status.Succeeded,
                Failed:         job.Status.Failed,
                Active:         job.Status.Active,
                Status:         status,
                Labels:         job.Labels,
                Annotations:    job.Annotations,
                Selector:       job.Spec.Selector.MatchLabels,
                Containers:     make([]models.JobContainerInfo, 0),
                Pods:           make([]models.JobPodInfo, 0),
                Events:         make([]models.EventInfo, 0),
                CreatedAt:      job.CreationTimestamp.Time,
        }

        if job.Status.StartTime != nil {
                t := job.Status.StartTime.Time
                detail.StartTime = &t
        }
        if job.Status.CompletionTime != nil {
                t := job.Status.CompletionTime.Time
                detail.CompletionTime = &t
                if detail.StartTime != nil {
                        detail.Duration = t.Sub(*detail.StartTime).Round(time.Second).String()
                }
        }

        // 容器信息
        for _, container := range job.Spec.Template.Spec.Containers {
                detail.Containers = append(detail.Containers, models.JobContainerInfo{
                        Name:    container.Name,
                        Image:   container.Image,
                        Command: container.Command,
                        Args:    container.Args,
                })
        }

        // 获取关联的 Pod
        if job.Spec.Selector != nil {
                pods, _ := c.Clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
                        LabelSelector: metav1.FormatLabelSelector(job.Spec.Selector),
                })
                for _, pod := range pods.Items {
                        pStatus, _, _ := getPodDisplayStatus(&pod)
                        ready := fmt.Sprintf("%d/%d", countReadyContainers(&pod), len(pod.Spec.Containers))
                        jpi := models.JobPodInfo{
                                Name:      pod.Name,
                                Status:    pStatus,
                                Ready:     ready,
                                PodIP:     pod.Status.PodIP,
                                CreatedAt: pod.CreationTimestamp.Time,
                        }
                        if pod.Status.StartTime != nil {
                                t := pod.Status.StartTime.Time
                                jpi.StartTime = &t
                        }
                        detail.Pods = append(detail.Pods, jpi)
                }
        }

        return detail, nil
}

// DeleteCronJob 删除CronJob
func (c *Client) DeleteCronJob(namespace, name string) error {
        ctx := context.Background()
        return c.Clientset.BatchV1().CronJobs(namespace).Delete(ctx, name, metav1.DeleteOptions{})
}

// SuspendCronJob 暂停/恢复CronJob
func (c *Client) SuspendCronJob(namespace, name string, suspend bool) error {
        ctx := context.Background()
        cj, err := c.Clientset.BatchV1().CronJobs(namespace).Get(ctx, name, metav1.GetOptions{})
        if err != nil {
                return err
        }

        cj.Spec.Suspend = &suspend
        _, err = c.Clientset.BatchV1().CronJobs(namespace).Update(ctx, cj, metav1.UpdateOptions{})
        return err
}

// TriggerCronJob 手动触发CronJob
func (c *Client) TriggerCronJob(namespace, name string) error {
        ctx := context.Background()
        cj, err := c.Clientset.BatchV1().CronJobs(namespace).Get(ctx, name, metav1.GetOptions{})
        if err != nil {
                return err
        }

        // 创建一个 Job 手动触发
        jobName := fmt.Sprintf("%s-manual-%d", name, time.Now().Unix())
        job := &batchv1.Job{
                ObjectMeta: metav1.ObjectMeta{
                        Name:        jobName,
                        Namespace:   namespace,
                        Labels:      map[string]string{"cronjob-name": name, "manual-trigger": "true"},
                        Annotations: map[string]string{"cronjob.kubernetes.io/trigger": "manual"},
                },
                Spec: cj.Spec.JobTemplate.Spec,
        }

        _, err = c.Clientset.BatchV1().Jobs(namespace).Create(ctx, job, metav1.CreateOptions{})
        return err
}

// GetCronJobDetail 获取CronJob详情
func (c *Client) GetCronJobDetail(namespace, name string) (*models.CronJobDetail, error) {
        ctx := context.Background()
        cj, err := c.Clientset.BatchV1().CronJobs(namespace).Get(ctx, name, metav1.GetOptions{})
        if err != nil {
                return nil, err
        }

        detail := &models.CronJobDetail{
                Name:                       cj.Name,
                Namespace:                  cj.Namespace,
                Schedule:                   cj.Spec.Schedule,
                Suspend:                    *cj.Spec.Suspend,
                ConcurrencyPolicy:          string(cj.Spec.ConcurrencyPolicy),
                SuccessfulJobsHistoryLimit: *cj.Spec.SuccessfulJobsHistoryLimit,
                FailedJobsHistoryLimit:     *cj.Spec.FailedJobsHistoryLimit,
                Labels:                     cj.Labels,
                Annotations:                cj.Annotations,
                Containers:                 make([]models.JobContainerInfo, 0),
                ActiveJobs:                 make([]models.CronJobJobInfo, 0),
                HistoryJobs:                make([]models.CronJobJobInfo, 0),
                Events:                     make([]models.EventInfo, 0),
                CreatedAt:                  cj.CreationTimestamp.Time,
        }

        if cj.Status.LastScheduleTime != nil {
                t := cj.Status.LastScheduleTime.Time
                detail.LastSchedule = &t
        }

        // 容器信息
        for _, container := range cj.Spec.JobTemplate.Spec.Template.Spec.Containers {
                detail.Containers = append(detail.Containers, models.JobContainerInfo{
                        Name:    container.Name,
                        Image:   container.Image,
                        Command: container.Command,
                        Args:    container.Args,
                })
        }

        // 获取活跃的 Job
        for _, activeJob := range cj.Status.Active {
                job, err := c.Clientset.BatchV1().Jobs(namespace).Get(ctx, activeJob.Name, metav1.GetOptions{})
                if err == nil {
                        jStatus := "Running"
                        if job.Status.Succeeded > 0 {
                                jStatus = "Completed"
                        }
                        jInfo := models.CronJobJobInfo{
                                Name:   job.Name,
                                Status: jStatus,
                        }
                        if job.Status.StartTime != nil {
                                t := job.Status.StartTime.Time
                                jInfo.StartTime = &t
                        }
                        if job.Status.CompletionTime != nil {
                                t := job.Status.CompletionTime.Time
                                jInfo.CompletionTime = &t
                        }
                        detail.ActiveJobs = append(detail.ActiveJobs, jInfo)
                }
        }

        // 获取历史 Job
        jobs, _ := c.Clientset.BatchV1().Jobs(namespace).List(ctx, metav1.ListOptions{
                LabelSelector: fmt.Sprintf("cronjob-name=%s", name),
        })
        for _, job := range jobs.Items {
                jStatus := "Running"
                if job.Status.Succeeded > 0 {
                        jStatus = "Completed"
                } else if job.Status.Failed > 0 {
                        jStatus = "Failed"
                }
                jInfo := models.CronJobJobInfo{
                        Name:   job.Name,
                        Status: jStatus,
                }
                if job.Status.StartTime != nil {
                        t := job.Status.StartTime.Time
                        jInfo.StartTime = &t
                }
                if job.Status.CompletionTime != nil {
                        t := job.Status.CompletionTime.Time
                        jInfo.CompletionTime = &t
                }
                // 跳过活跃的 Job
                isActive := false
                for _, aj := range detail.ActiveJobs {
                        if aj.Name == job.Name {
                                isActive = true
                                break
                        }
                }
                if !isActive {
                        detail.HistoryJobs = append(detail.HistoryJobs, jInfo)
                }
        }

        return detail, nil
}

// countReadyContainers 统计就绪容器数
func countReadyContainers(pod *corev1.Pod) int {
        count := 0
        for _, cs := range pod.Status.ContainerStatuses {
                if cs.Ready {
                        count++
                }
        }
        return count
}

// ==================== Traefik 相关方法 ====================

// GetTraefikStatus 获取 Traefik 安装状态
func (c *Client) GetTraefikStatus() (*models.TraefikStatus, error) {
        ctx := context.Background()

        status := &models.TraefikStatus{
                Installed: false,
        }

        // 检查 traefik 命名空间是否存在
        _, err := c.Clientset.CoreV1().Namespaces().Get(ctx, "traefik", metav1.GetOptions{})
        if err != nil {
                return status, nil // 命名空间不存在，未安装
        }

        // 检查 traefik deployment 是否存在
        deploy, err := c.Clientset.AppsV1().Deployments("traefik").Get(ctx, "traefik", metav1.GetOptions{})
        if err != nil {
                return status, nil // Deployment 不存在，未安装
        }

        status.Installed = true
        status.Namespace = "traefik"
        status.Replicas = *deploy.Spec.Replicas
        status.ReadyReplicas = deploy.Status.ReadyReplicas

        // 获取版本信息
        for _, container := range deploy.Spec.Template.Spec.Containers {
                if container.Name == "traefik" {
                        // 从镜像名解析版本
                        parts := strings.Split(container.Image, ":")
                        if len(parts) > 1 {
                                status.Version = parts[len(parts)-1]
                        }
                        break
                }
        }

        // 检查 dashboard 服务
        svc, err := c.Clientset.CoreV1().Services("traefik").Get(ctx, "traefik", metav1.GetOptions{})
        if err == nil {
                // 检查是否有 LoadBalancer IP
                if len(svc.Status.LoadBalancer.Ingress) > 0 {
                        lb := svc.Status.LoadBalancer.Ingress[0]
                        if lb.IP != "" {
                                status.Dashboard = fmt.Sprintf("http://%s:8080/dashboard/", lb.IP)
                        } else if lb.Hostname != "" {
                                status.Dashboard = fmt.Sprintf("http://%s:8080/dashboard/", lb.Hostname)
                        }
                }
                if status.Dashboard == "" {
                        status.Dashboard = "http://localhost:8080/dashboard/"
                }
        }

        return status, nil
}

// InstallTraefik 安装 Traefik
func (c *Client) InstallTraefik() error {
        ctx := context.Background()

        // 1. 创建命名空间
        _, err := c.Clientset.CoreV1().Namespaces().Create(ctx, &corev1.Namespace{
                ObjectMeta: metav1.ObjectMeta{
                        Name: "traefik",
                },
        }, metav1.CreateOptions{})
        if err != nil && !errors.IsAlreadyExists(err) {
                return fmt.Errorf("failed to create namespace: %v", err)
        }

        // 2. 创建 ServiceAccount
        _, err = c.Clientset.CoreV1().ServiceAccounts("traefik").Create(ctx, &corev1.ServiceAccount{
                ObjectMeta: metav1.ObjectMeta{
                        Name:      "traefik",
                        Namespace: "traefik",
                },
        }, metav1.CreateOptions{})
        if err != nil && !errors.IsAlreadyExists(err) {
                return fmt.Errorf("failed to create serviceaccount: %v", err)
        }

        // 3. 创建 ClusterRole
        _, err = c.Clientset.RbacV1().ClusterRoles().Create(ctx, &rbacv1.ClusterRole{
                ObjectMeta: metav1.ObjectMeta{
                        Name: "traefik",
                },
                Rules: []rbacv1.PolicyRule{
                        {
                                APIGroups: []string{""},
                                Resources: []string{"services", "endpoints", "secrets"},
                                Verbs:     []string{"get", "list", "watch"},
                        },
                        {
                                APIGroups: []string{"extensions", "networking.k8s.io"},
                                Resources: []string{"ingresses", "ingressclasses"},
                                Verbs:     []string{"get", "list", "watch"},
                        },
                        {
                                APIGroups: []string{"traefik.io"},
                                Resources: []string{"ingressroutes", "middlewares", "tlsoptions", "serverservices", "middlewaretcp", "ingressrouteudps", "tlsstores", "traefikservices", "ingressroutetcps"},
                                Verbs:     []string{"get", "list", "watch"},
                        },
                },
        }, metav1.CreateOptions{})
        if err != nil && !errors.IsAlreadyExists(err) {
                return fmt.Errorf("failed to create clusterrole: %v", err)
        }

        // 4. 创建 ClusterRoleBinding
        _, err = c.Clientset.RbacV1().ClusterRoleBindings().Create(ctx, &rbacv1.ClusterRoleBinding{
                ObjectMeta: metav1.ObjectMeta{
                        Name: "traefik",
                },
                RoleRef: rbacv1.RoleRef{
                        APIGroup: "rbac.authorization.k8s.io",
                        Kind:     "ClusterRole",
                        Name:     "traefik",
                },
                Subjects: []rbacv1.Subject{
                        {
                                Kind:      "ServiceAccount",
                                Name:      "traefik",
                                Namespace: "traefik",
                        },
                },
        }, metav1.CreateOptions{})
        if err != nil && !errors.IsAlreadyExists(err) {
                return fmt.Errorf("failed to create clusterrolebinding: %v", err)
        }

        // 5. 创建 Deployment
        replicas := int32(1)
        _, err = c.Clientset.AppsV1().Deployments("traefik").Create(ctx, &appsv1.Deployment{
                ObjectMeta: metav1.ObjectMeta{
                        Name:      "traefik",
                        Namespace: "traefik",
                        Labels: map[string]string{
                                "app": "traefik",
                        },
                },
                Spec: appsv1.DeploymentSpec{
                        Replicas: &replicas,
                        Selector: &metav1.LabelSelector{
                                MatchLabels: map[string]string{
                                        "app": "traefik",
                                },
                        },
                        Template: corev1.PodTemplateSpec{
                                ObjectMeta: metav1.ObjectMeta{
                                        Labels: map[string]string{
                                                "app": "traefik",
                                        },
                                },
                                Spec: corev1.PodSpec{
                                        ServiceAccountName: "traefik",
                                        Containers: []corev1.Container{
                                                {
                                                        Name:  "traefik",
                                                        Image: "traefik:v3.2",
                                                        Args: []string{
                                                                "--api.insecure=true",
                                                                "--providers.kubernetesingress=true",
                                                                "--providers.kubernetescrd=true",
                                                                "--entrypoints.web.address=:80",
                                                                "--entrypoints.websecure.address=:443",
                                                        },
                                                        Ports: []corev1.ContainerPort{
                                                                {Name: "web", ContainerPort: 80},
                                                                {Name: "websecure", ContainerPort: 443},
                                                                {Name: "dashboard", ContainerPort: 8080},
                                                        },
                                                },
                                        },
                                },
                        },
                },
        }, metav1.CreateOptions{})
        if err != nil && !errors.IsAlreadyExists(err) {
                return fmt.Errorf("failed to create deployment: %v", err)
        }

        // 6. 创建 Service (LoadBalancer)
        _, err = c.Clientset.CoreV1().Services("traefik").Create(ctx, &corev1.Service{
                ObjectMeta: metav1.ObjectMeta{
                        Name:      "traefik",
                        Namespace: "traefik",
                },
                Spec: corev1.ServiceSpec{
                        Type: corev1.ServiceTypeLoadBalancer,
                        Selector: map[string]string{
                                "app": "traefik",
                        },
                        Ports: []corev1.ServicePort{
                                {Name: "web", Port: 80, TargetPort: intstr.FromInt(80)},
                                {Name: "websecure", Port: 443, TargetPort: intstr.FromInt(443)},
                                {Name: "dashboard", Port: 8080, TargetPort: intstr.FromInt(8080)},
                        },
                },
        }, metav1.CreateOptions{})
        if err != nil && !errors.IsAlreadyExists(err) {
                return fmt.Errorf("failed to create service: %v", err)
        }

        return nil
}

// GetIngressRoutes 获取 IngressRoute 列表 (Traefik CRD)
func (c *Client) GetIngressRoutes(namespace string) ([]models.IngressRouteInfo, error) {
        ctx := context.Background()

        routes := make([]models.IngressRouteInfo, 0)

        // 使用动态客户端获取 IngressRoute
        gvr := schema.GroupVersionResource{
                Group:    "traefik.io",
                Version:  "v1alpha1",
                Resource: "ingressroutes",
        }

        var list *unstructured.UnstructuredList
        var err error

        if namespace != "" {
                list, err = c.DynamicClient.Resource(gvr).Namespace(namespace).List(ctx, metav1.ListOptions{})
        } else {
                list, err = c.DynamicClient.Resource(gvr).List(ctx, metav1.ListOptions{})
        }

        if err != nil {
                // CRD 可能不存在，返回空列表
                return routes, nil
        }

        for _, item := range list.Items {
                route := models.IngressRouteInfo{
                        Name:        item.GetName(),
                        Namespace:   item.GetNamespace(),
                        EntryPoints: make([]string, 0),
                        Routes:      make([]models.IngressRouteRoute, 0),
                        CreatedAt:   item.GetCreationTimestamp().Time,
                }

                // 提取 spec.entryPoints
                if spec, ok := item.Object["spec"].(map[string]interface{}); ok {
                        if eps, ok := spec["entryPoints"].([]interface{}); ok {
                                for _, ep := range eps {
                                        if s, ok := ep.(string); ok {
                                                route.EntryPoints = append(route.EntryPoints, s)
                                        }
                                }
                        }

                        // 提取 spec.routes
                        if routesSpec, ok := spec["routes"].([]interface{}); ok {
                                for _, r := range routesSpec {
                                        if rMap, ok := r.(map[string]interface{}); ok {
                                                routeInfo := models.IngressRouteRoute{
                                                        Services: make([]string, 0),
                                                }
                                                if match, ok := rMap["match"].(string); ok {
                                                        routeInfo.Match = match
                                                }
                                                if kind, ok := rMap["kind"].(string); ok {
                                                        routeInfo.Kind = kind
                                                }
                                                if services, ok := rMap["services"].([]interface{}); ok {
                                                        for _, svc := range services {
                                                                if svcMap, ok := svc.(map[string]interface{}); ok {
                                                                        if name, ok := svcMap["name"].(string); ok {
                                                                                port := ""
                                                                                if p, ok := svcMap["port"].(int64); ok {
                                                                                        port = fmt.Sprintf(":%d", p)
                                                                                }
                                                                                routeInfo.Services = append(routeInfo.Services, name+port)
                                                                        }
                                                                }
                                                        }
                                                }
                                                route.Routes = append(route.Routes, routeInfo)
                                        }
                                }
                        }

                        // 检查 TLS
                        if _, ok := spec["tls"]; ok {
                                route.TLS = true
                        }
                }

                routes = append(routes, route)
        }

        return routes, nil
}

// CreateIngressRoute 创建 IngressRoute
func (c *Client) CreateIngressRoute(req models.CreateIngressRouteRequest) (*models.IngressRouteInfo, error) {
        ctx := context.Background()

        namespace := req.Namespace
        if namespace == "" {
                namespace = "default"
        }

        // 构建路由
        routes := make([]interface{}, 0)
        for _, r := range req.Routes {
                services := make([]interface{}, 0)
                for _, s := range r.Services {
                        services = append(services, map[string]interface{}{
                                "name": s.Name,
                                "port": s.Port,
                        })
                }
                routes = append(routes, map[string]interface{}{
                        "match":    r.Match,
                        "kind":     r.Kind,
                        "services": services,
                })
        }

        ingressRoute := &unstructured.Unstructured{
                Object: map[string]interface{}{
                        "apiVersion": "traefik.io/v1alpha1",
                        "kind":       "IngressRoute",
                        "metadata": map[string]interface{}{
                                "name":      req.Name,
                                "namespace": namespace,
                        },
                        "spec": map[string]interface{}{
                                "entryPoints": req.EntryPoints,
                                "routes":       routes,
                        },
                },
        }

        // 添加 TLS 配置
        if req.TLS != nil && req.TLS.SecretName != "" {
                ingressRoute.Object["spec"].(map[string]interface{})["tls"] = map[string]interface{}{
                        "secretName": req.TLS.SecretName,
                }
        }

        gvr := schema.GroupVersionResource{
                Group:    "traefik.io",
                Version:  "v1alpha1",
                Resource: "ingressroutes",
        }

        _, err := c.DynamicClient.Resource(gvr).Namespace(namespace).Create(ctx, ingressRoute, metav1.CreateOptions{})
        if err != nil {
                return nil, fmt.Errorf("failed to create ingressroute: %v", err)
        }

        return &models.IngressRouteInfo{
                Name:        req.Name,
                Namespace:   namespace,
                EntryPoints: req.EntryPoints,
                CreatedAt:   time.Now(),
        }, nil
}

// DeleteIngressRoute 删除 IngressRoute
func (c *Client) DeleteIngressRoute(namespace, name string) error {
        ctx := context.Background()

        gvr := schema.GroupVersionResource{
                Group:    "traefik.io",
                Version:  "v1alpha1",
                Resource: "ingressroutes",
        }

        return c.DynamicClient.Resource(gvr).Namespace(namespace).Delete(ctx, name, metav1.DeleteOptions{})
}

// GetTraefikMiddlewares 获取 Traefik Middlewares 列表
func (c *Client) GetTraefikMiddlewares(namespace string) ([]models.TraefikMiddlewareInfo, error) {
        ctx := context.Background()

        middlewares := make([]models.TraefikMiddlewareInfo, 0)

        gvr := schema.GroupVersionResource{
                Group:    "traefik.io",
                Version:  "v1alpha1",
                Resource: "middlewares",
        }

        var list *unstructured.UnstructuredList
        var err error

        if namespace != "" {
                list, err = c.DynamicClient.Resource(gvr).Namespace(namespace).List(ctx, metav1.ListOptions{})
        } else {
                list, err = c.DynamicClient.Resource(gvr).List(ctx, metav1.ListOptions{})
        }

        if err != nil {
                return middlewares, nil
        }

        for _, item := range list.Items {
                mw := models.TraefikMiddlewareInfo{
                        Name:      item.GetName(),
                        Namespace: item.GetNamespace(),
                        CreatedAt: item.GetCreationTimestamp().Time,
                }

                // 检测 middleware 类型
                if spec, ok := item.Object["spec"].(map[string]interface{}); ok {
                        for k := range spec {
                                mw.Type = k
                                break
                        }
                }

                middlewares = append(middlewares, mw)
        }

        return middlewares, nil
}

// GetTLSOptions 获取 TLSOptions 列表
func (c *Client) GetTLSOptions(namespace string) ([]models.TLSOptionInfo, error) {
        ctx := context.Background()

        options := make([]models.TLSOptionInfo, 0)

        gvr := schema.GroupVersionResource{
                Group:    "traefik.io",
                Version:  "v1alpha1",
                Resource: "tlsoptions",
        }

        var list *unstructured.UnstructuredList
        var err error

        if namespace != "" {
                list, err = c.DynamicClient.Resource(gvr).Namespace(namespace).List(ctx, metav1.ListOptions{})
        } else {
                list, err = c.DynamicClient.Resource(gvr).List(ctx, metav1.ListOptions{})
        }

        if err != nil {
                return options, nil
        }

        for _, item := range list.Items {
                opt := models.TLSOptionInfo{
                        Name:        item.GetName(),
                        Namespace:   item.GetNamespace(),
                        CipherSuites: make([]string, 0),
                        CreatedAt:   item.GetCreationTimestamp().Time,
                }

                if spec, ok := item.Object["spec"].(map[string]interface{}); ok {
                        if minVer, ok := spec["minVersion"].(string); ok {
                                opt.MinVersion = minVer
                        }
                        if suites, ok := spec["cipherSuites"].([]interface{}); ok {
                                for _, s := range suites {
                                        if str, ok := s.(string); ok {
                                                opt.CipherSuites = append(opt.CipherSuites, str)
                                        }
                                }
                        }
                }

                options = append(options, opt)
        }

        return options, nil
}
