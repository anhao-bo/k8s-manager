package k8s

import (
        "context"
        "fmt"
        "io"
        "os/exec"
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
        "k8s.io/client-go/kubernetes"
        "k8s.io/client-go/rest"
        "k8s.io/client-go/tools/clientcmd"
        "k8s.io/client-go/util/homedir"
        "sigs.k8s.io/yaml"
)

// Client Kubernetes客户端
type Client struct {
        Clientset  *kubernetes.Clientset
        Config     *rest.Config
        Namespace  string
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

        return &Client{
                Clientset: clientset,
                Config:    config,
                Namespace: "", // 默认所有命名空间
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
                info := models.PodInfo{
                        Name:            pod.Name,
                        Namespace:       pod.Namespace,
                        Status:          string(pod.Status.Phase),
                        PodIP:           pod.Status.PodIP,
                        NodeName:        pod.Spec.NodeName,
                        Containers:      len(pod.Spec.Containers),
                        Labels:          pod.Labels,
                        CreatedAt:       pod.CreationTimestamp.Time,
                        ReadyContainers: 0,
                        Restarts:        0,
                }

                // 统计就绪容器和重启次数
                for _, cs := range pod.Status.ContainerStatuses {
                        if cs.Ready {
                                info.ReadyContainers++
                        }
                        info.Restarts += int(cs.RestartCount)
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

// GetPodYaml 获取 Pod 的 YAML 格式（直接使用 kubectl 命令，与命令行输出完全一致）
func (c *Client) GetPodYaml(namespace, name string) (string, error) {
        // 直接执行 kubectl get pod -o yaml 命令
        kubectlPath := "/home/z/my-project/mini-services/k8s-service/kubectl"
        cmd := exec.Command(kubectlPath, "get", "pod", name, "-n", namespace, "-o", "yaml")
        output, err := cmd.CombinedOutput()
        if err != nil {
                return "", fmt.Errorf("kubectl get pod failed: %w, output: %s", err, string(output))
        }
        return string(output), nil
}

// UpdatePodYamlResult 更新结果
type UpdatePodYamlResult struct {
        Status    string      // "no_change", "updated", "error"
        Message   string      // 描述信息
        Pod       *models.PodInfo
}

// UpdatePodYaml 通过 YAML 更新 Pod
// 注意：Pod 的很多字段是不可变的，需要删除后重建
func (c *Client) UpdatePodYaml(namespace, name, newYamlStr string) (*UpdatePodYamlResult, error) {
        ctx := context.Background()

        // 获取现有的 Pod（用于检查控制器管理和获取信息）
        existingPod, err := c.Clientset.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
        if err != nil {
                return nil, fmt.Errorf("failed to get existing pod: %w", err)
        }

        // 获取当前的 YAML（使用 kubectl 命令，与显示的一致）
        existingYamlStr, err := c.GetPodYaml(namespace, name)
        if err != nil {
                return nil, fmt.Errorf("failed to get existing pod yaml: %w", err)
        }

        // 比较 YAML 是否有变化（去除空白字符后比较）
        if strings.TrimSpace(newYamlStr) == strings.TrimSpace(existingYamlStr) {
                return &UpdatePodYamlResult{
                        Status:  "no_change",
                        Message: "YAML 内容未发生变化，保持不变",
                }, nil
        }

        // 解析新的 YAML
        var newPod corev1.Pod
        if err := yaml.Unmarshal([]byte(newYamlStr), &newPod); err != nil {
                return nil, fmt.Errorf("failed to unmarshal yaml: %w", err)
        }

        // 确保名称和命名空间正确
        if newPod.Name != name {
                return nil, fmt.Errorf("pod name in yaml (%s) does not match requested name (%s)", newPod.Name, name)
        }
        if newPod.Namespace != namespace {
                return nil, fmt.Errorf("pod namespace in yaml (%s) does not match requested namespace (%s)", newPod.Namespace, namespace)
        }

        // 检查 Pod 是否由控制器管理（Deployment, StatefulSet, DaemonSet 等）
        if len(existingPod.OwnerReferences) > 0 {
                owner := existingPod.OwnerReferences[0]
                return nil, fmt.Errorf("pod is managed by %s '%s', please edit the controller instead", owner.Kind, owner.Name)
        }

        // 删除旧 Pod（使用 kubectl 命令）
        kubectlPath := "/home/z/my-project/mini-services/k8s-service/kubectl"
        deleteCmd := exec.Command(kubectlPath, "delete", "pod", name, "-n", namespace, "--ignore-not-found=true")
        if deleteOutput, err := deleteCmd.CombinedOutput(); err != nil {
                return nil, fmt.Errorf("kubectl delete pod failed: %w, output: %s", err, string(deleteOutput))
        }

        // 等待 Pod 完全删除
        for i := 0; i < 300; i++ { // 最多等待 3 秒
                _, err := c.Clientset.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
                if err != nil {
                        // Pod 已经被删除
                        break
                }
                time.Sleep(10 * time.Millisecond)
        }

        // 使用 kubectl apply 创建新 Pod
        applyCmd := exec.Command(kubectlPath, "apply", "-f", "-")
        applyCmd.Stdin = strings.NewReader(newYamlStr)
        if applyOutput, err := applyCmd.CombinedOutput(); err != nil {
                return nil, fmt.Errorf("kubectl apply failed: %w, output: %s", err, string(applyOutput))
        }

        // 获取新创建的 Pod 信息
        created, err := c.Clientset.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
        if err != nil {
                return nil, fmt.Errorf("failed to get created pod: %w", err)
        }

        return &UpdatePodYamlResult{
                Status:  "updated",
                Message: "Pod 已删除并重新创建",
                Pod: &models.PodInfo{
                        Name:            created.Name,
                        Namespace:       created.Namespace,
                        Status:          string(created.Status.Phase),
                        PodIP:           created.Status.PodIP,
                        NodeName:        created.Spec.NodeName,
                        Containers:      len(created.Spec.Containers),
                        Labels:          created.Labels,
                        CreatedAt:       created.CreationTimestamp.Time,
                        ReadyContainers: 0,
                        Restarts:        0,
                },
        }, nil
}

// 确保导入被使用
var _ = storagev1.SchemeGroupVersion
var _ = parseCPU
var _ = parseMemory
