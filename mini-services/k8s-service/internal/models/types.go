package models

import "time"

// ==================== 集群信息 ====================

// ClusterInfo 集群信息
type ClusterInfo struct {
        Name        string    `json:"name"`
        Version     string    `json:"version"`
        Platform    string    `json:"platform"`
        Connected   bool      `json:"connected"`
        LastChecked time.Time `json:"lastChecked"`
}

// ClusterOverview 集群概览
type ClusterOverview struct {
        Nodes        int `json:"nodes"`
        ReadyNodes   int `json:"readyNodes"`
        Namespaces   int `json:"namespaces"`
        Pods         int `json:"pods"`
        RunningPods  int `json:"runningPods"`
        Deployments  int `json:"deployments"`
        Services     int `json:"services"`
}

// ==================== 节点信息 ====================

// NodeInfo 节点信息
type NodeInfo struct {
        Name           string            `json:"name"`
        Status         string            `json:"status"`
        Roles          []string          `json:"roles"`
        IP             string            `json:"ip"`
        OS             string            `json:"os"`
        Arch           string            `json:"arch"`
        KernelVersion  string            `json:"kernelVersion"`
        KubeletVersion string            `json:"kubeletVersion"`
        Capacity       ResourceCapacity  `json:"capacity"`
        Allocatable    ResourceCapacity  `json:"allocatable"`
        Conditions     []NodeCondition   `json:"conditions"`
        Labels         map[string]string `json:"labels"`
        CreatedAt      time.Time         `json:"createdAt"`
        Unschedulable  bool              `json:"unschedulable"` // 是否被隔离
}

// ResourceCapacity 资源容量
type ResourceCapacity struct {
        CPU    string `json:"cpu"`
        Memory string `json:"memory"`
        Pods   string `json:"pods"`
}

// NodeCondition 节点条件
type NodeCondition struct {
        Type    string `json:"type"`
        Status  string `json:"status"`
        Message string `json:"message"`
}

// NodeMetrics 节点资源使用
type NodeMetrics struct {
        Name           string  `json:"name"`
        CPUUsage       float64 `json:"cpuUsage"`
        MemoryUsage    float64 `json:"memoryUsage"`
        CPUCapacity    float64 `json:"cpuCapacity"`
        MemoryCapacity float64 `json:"memoryCapacity"`
}

// ==================== 命名空间 ====================

// NamespaceInfo 命名空间信息
type NamespaceInfo struct {
        Name      string            `json:"name"`
        Status    string            `json:"status"`
        Labels    map[string]string `json:"labels"`
        CreatedAt time.Time         `json:"createdAt"`
}

// ==================== Pod ====================

// CreatePodRequest 创建Pod请求
type CreatePodRequest struct {
        Namespace     string            `json:"namespace"`
        Name          string            `json:"name" binding:"required"`
        Image         string            `json:"image" binding:"required"`
        ContainerName string            `json:"containerName"`
        Command       []string          `json:"command"`
        Args          []string          `json:"args"`
        Env           map[string]string `json:"env"`
        Ports         []int             `json:"ports"`
}

// PodInfo Pod信息
type PodInfo struct {
        Name            string            `json:"name"`
        Namespace       string            `json:"namespace"`
        Status          string            `json:"status"`           // 计算后的展示状态（如 CrashLoopBackOff, Running 等）
        Phase           string            `json:"phase"`            // K8s Phase (Pending, Running, Succeeded, Failed, Unknown)
        StatusReason    string            `json:"statusReason"`     // 状态原因
        StatusMessage   string            `json:"statusMessage"`    // 状态消息
        PodIP           string            `json:"podIP"`
        HostIP          string            `json:"hostIP"`
        NodeName        string            `json:"nodeName"`
        Containers      int               `json:"containers"`
        ReadyContainers int               `json:"readyContainers"`
        Restarts        int               `json:"restarts"`
        Labels          map[string]string `json:"labels"`
        CreatedAt       time.Time         `json:"createdAt"`
        IsStaticPod     bool              `json:"isStaticPod"`      // 是否为静态 Pod
        RestartPolicy   string            `json:"restartPolicy"`    // 重启策略
        QOSClass        string            `json:"qosClass"`         // QoS 等级
        // 容器状态摘要（用于列表显示）
        ContainerStatuses []ContainerStatusInfo `json:"containerStatuses,omitempty"`
}

// PodDetail Pod详情
type PodDetail struct {
        Name            string                       `json:"name"`
        Namespace       string                       `json:"namespace"`
        Status          string                       `json:"status"`           // 计算后的展示状态
        Phase           string                       `json:"phase"`            // K8s Phase
        StatusReason    string                       `json:"statusReason"`     // 状态原因
        StatusMessage   string                       `json:"statusMessage"`    // 状态消息
        PodIP           string                       `json:"podIP"`
        HostIP          string                       `json:"hostIP"`
        NodeName        string                       `json:"nodeName"`
        Containers      []ContainerInfo              `json:"containers"`
        InitContainers  []ContainerInfo              `json:"initContainers"`
        Labels          map[string]string            `json:"labels"`
        Annotations     map[string]string            `json:"annotations"`
        Volumes         []VolumeInfo                 `json:"volumes"`
        Conditions      []PodCondition               `json:"conditions"`
        Events          []EventInfo                  `json:"events,omitempty"` // Pod 相关事件
        CreatedAt       time.Time                    `json:"createdAt"`
        IsStaticPod     bool                         `json:"isStaticPod"`
        RestartPolicy   string                       `json:"restartPolicy"`
        QOSClass        string                       `json:"qosClass"`
        StartTime       *time.Time                   `json:"startTime,omitempty"`
}

// ContainerStatusInfo 容器状态摘要（用于列表显示）
type ContainerStatusInfo struct {
        Name           string `json:"name"`
        Image          string `json:"image"`
        State          string `json:"state"`           // Running, Waiting, Terminated
        StateReason    string `json:"stateReason"`     // 如 CrashLoopBackOff, ImagePullBackOff, OOMKilled
        StateMessage   string `json:"stateMessage"`    // 详细消息
        Ready          bool   `json:"ready"`
        RestartCount   int    `json:"restartCount"`
        ExitCode       int32  `json:"exitCode,omitempty"`
        StartedAt      string `json:"startedAt,omitempty"`
        FinishedAt     string `json:"finishedAt,omitempty"`
        LastExitCode   int32  `json:"lastExitCode,omitempty"`
        LastExitReason string `json:"lastExitReason,omitempty"`
}

// ContainerInfo 容器信息
type ContainerInfo struct {
        Name         string `json:"name"`
        Image        string `json:"image"`
        ImageID      string `json:"imageID"`
        ContainerID  string `json:"containerID"`
        Status       string `json:"status"`
        State        string `json:"state"`           // Running, Waiting, Terminated
        StateReason  string `json:"stateReason"`     // CrashLoopBackOff, ImagePullBackOff, OOMKilled 等
        StateMessage string `json:"stateMessage"`    // 详细消息
        Ready        bool   `json:"ready"`
        RestartCount int    `json:"restartCount"`
        ExitCode     int32  `json:"exitCode,omitempty"`
        Signal       int32  `json:"signal,omitempty"`
        StartedAt    string `json:"startedAt,omitempty"`
        FinishedAt   string `json:"finishedAt,omitempty"`
        // 上次终止信息（用于诊断重启原因）
        LastExitCode    int32  `json:"lastExitCode,omitempty"`
        LastExitReason  string `json:"lastExitReason,omitempty"`
        LastExitMessage string `json:"lastExitMessage,omitempty"`
}

// VolumeInfo 卷信息
type VolumeInfo struct {
        Name string `json:"name"`
        Type string `json:"type"`
}

// PodCondition Pod条件
type PodCondition struct {
        Type               string    `json:"type"`
        Status             string    `json:"status"`
        LastTransitionTime time.Time `json:"lastTransitionTime,omitempty"`
        Reason             string    `json:"reason,omitempty"`
        Message            string    `json:"message,omitempty"`
}

// ==================== Deployment ====================

// CreateDeploymentRequest 创建Deployment请求
type CreateDeploymentRequest struct {
        Namespace     string            `json:"namespace"`
        Name          string            `json:"name" binding:"required"`
        Image         string            `json:"image" binding:"required"`
        Replicas      int               `json:"replicas"`
        ContainerName string            `json:"containerName"`
        ContainerPort int               `json:"containerPort"`
        Labels        map[string]string `json:"labels"`
}

// DeploymentInfo Deployment信息
type DeploymentInfo struct {
        Name              string            `json:"name"`
        Namespace         string            `json:"namespace"`
        Replicas          int32             `json:"replicas"`
        ReadyReplicas     int32             `json:"readyReplicas"`
        AvailableReplicas int32             `json:"availableReplicas"`
        UpdatedReplicas   int32             `json:"updatedReplicas"`
        Strategy          string            `json:"strategy"`
        Labels            map[string]string `json:"labels"`
        CreatedAt         time.Time         `json:"createdAt"`
}

// ==================== StatefulSet ====================

// CreateStatefulSetRequest 创建StatefulSet请求
type CreateStatefulSetRequest struct {
        Namespace     string            `json:"namespace"`
        Name          string            `json:"name" binding:"required"`
        Image         string            `json:"image" binding:"required"`
        Replicas      int               `json:"replicas"`
        ContainerName string            `json:"containerName"`
        ContainerPort int               `json:"containerPort"`
        ServiceName   string            `json:"serviceName"`
        Labels        map[string]string `json:"labels"`
}

// StatefulSetInfo StatefulSet信息
type StatefulSetInfo struct {
        Name          string            `json:"name"`
        Namespace     string            `json:"namespace"`
        Replicas      int32             `json:"replicas"`
        ReadyReplicas int32             `json:"readyReplicas"`
        ServiceName   string            `json:"serviceName"`
        Labels        map[string]string `json:"labels"`
        CreatedAt     time.Time         `json:"createdAt"`
}

// ==================== DaemonSet ====================

// CreateDaemonSetRequest 创建DaemonSet请求
type CreateDaemonSetRequest struct {
        Namespace     string            `json:"namespace"`
        Name          string            `json:"name" binding:"required"`
        Image         string            `json:"image" binding:"required"`
        ContainerName string            `json:"containerName"`
        ContainerPort int               `json:"containerPort"`
        Labels        map[string]string `json:"labels"`
}

// DaemonSetInfo DaemonSet信息
type DaemonSetInfo struct {
        Name          string            `json:"name"`
        Namespace     string            `json:"namespace"`
        DesiredNodes  int32             `json:"desiredNodes"`
        CurrentNodes  int32             `json:"currentNodes"`
        ReadyNodes    int32             `json:"readyNodes"`
        UpdatedNodes  int32             `json:"updatedNodes"`
        Labels        map[string]string `json:"labels"`
        CreatedAt     time.Time         `json:"createdAt"`
}

// ==================== Job ====================

// CreateJobRequest 创建Job请求
type CreateJobRequest struct {
        Namespace     string            `json:"namespace"`
        Name          string            `json:"name" binding:"required"`
        Image         string            `json:"image" binding:"required"`
        ContainerName string            `json:"containerName"`
        Command       []string          `json:"command"`
        Args          []string          `json:"args"`
        Completions   int               `json:"completions"`
        Parallelism   int               `json:"parallelism"`
        RestartPolicy string            `json:"restartPolicy"` // Never, OnFailure
        Labels        map[string]string `json:"labels"`
}

// JobInfo Job信息
type JobInfo struct {
        Name          string            `json:"name"`
        Namespace     string            `json:"namespace"`
        Completions   int32             `json:"completions"`
        Succeeded     int32             `json:"succeeded"`
        Parallelism   int32             `json:"parallelism"`
        Status        string            `json:"status"`
        StartTime     *time.Time        `json:"startTime,omitempty"`
        CompletionTime *time.Time       `json:"completionTime,omitempty"`
        Labels        map[string]string `json:"labels"`
        CreatedAt     time.Time         `json:"createdAt"`
}

// JobDetail Job详情
type JobDetail struct {
        Name           string                  `json:"name"`
        Namespace      string                  `json:"namespace"`
        Completions    int32                   `json:"completions"`
        Parallelism    int32                   `json:"parallelism"`
        Succeeded      int32                   `json:"succeeded"`
        Failed         int32                   `json:"failed"`
        Active         int32                   `json:"active"`
        Status         string                  `json:"status"`
        StartTime      *time.Time              `json:"startTime,omitempty"`
        CompletionTime *time.Time              `json:"completionTime,omitempty"`
        Duration       string                  `json:"duration,omitempty"`
        Labels         map[string]string       `json:"labels"`
        Annotations    map[string]string       `json:"annotations"`
        Selector       map[string]string       `json:"selector"`
        Containers     []JobContainerInfo      `json:"containers"`
        Pods           []JobPodInfo            `json:"pods"`
        Events         []EventInfo             `json:"events,omitempty"`
        CreatedAt      time.Time               `json:"createdAt"`
}

// JobContainerInfo Job容器信息
type JobContainerInfo struct {
        Name    string   `json:"name"`
        Image   string   `json:"image"`
        Command []string `json:"command,omitempty"`
        Args    []string `json:"args,omitempty"`
}

// JobPodInfo Job Pod信息
type JobPodInfo struct {
        Name      string     `json:"name"`
        Status    string     `json:"status"`
        Ready     string     `json:"ready"`
        PodIP     string     `json:"podIP"`
        StartTime *time.Time `json:"startTime,omitempty"`
        CreatedAt time.Time  `json:"createdAt"`
}

// ==================== CronJob ====================

// CreateCronJobRequest 创建CronJob请求
type CreateCronJobRequest struct {
        Namespace          string            `json:"namespace"`
        Name               string            `json:"name" binding:"required"`
        Image              string            `json:"image" binding:"required"`
        Schedule           string            `json:"schedule" binding:"required"`
        ContainerName      string            `json:"containerName"`
        Command            []string          `json:"command"`
        Args               []string          `json:"args"`
        Suspend            bool              `json:"suspend"`
        ConcurrencyPolicy  string            `json:"concurrencyPolicy"` // Allow, Forbid, Replace
        SuccessfulHistory  int               `json:"successfulHistory"`
        FailedHistory      int               `json:"failedHistory"`
        Labels             map[string]string `json:"labels"`
}

// CronJobInfo CronJob信息
type CronJobInfo struct {
        Name           string            `json:"name"`
        Namespace      string            `json:"namespace"`
        Schedule       string            `json:"schedule"`
        Suspend        bool              `json:"suspend"`
        LastSchedule   *time.Time        `json:"lastSchedule,omitempty"`
        SuccessfulJobs int32             `json:"successfulJobs"`
        FailedJobs     int32             `json:"failedJobs"`
        Labels         map[string]string `json:"labels"`
        CreatedAt      time.Time         `json:"createdAt"`
}

// CronJobDetail CronJob详情
type CronJobDetail struct {
        Name                      string                  `json:"name"`
        Namespace                 string                  `json:"namespace"`
        Schedule                  string                  `json:"schedule"`
        Suspend                   bool                    `json:"suspend"`
        ConcurrencyPolicy         string                  `json:"concurrencyPolicy"`
        SuccessfulJobsHistoryLimit int32                  `json:"successfulJobsHistoryLimit"`
        FailedJobsHistoryLimit    int32                   `json:"failedJobsHistoryLimit"`
        LastSchedule              *time.Time              `json:"lastSchedule,omitempty"`
        NextSchedule              *time.Time              `json:"nextSchedule,omitempty"`
        Labels                    map[string]string       `json:"labels"`
        Annotations               map[string]string       `json:"annotations"`
        Containers                []JobContainerInfo      `json:"containers"`
        ActiveJobs                []CronJobJobInfo        `json:"activeJobs"`
        HistoryJobs               []CronJobJobInfo        `json:"historyJobs"`
        Events                    []EventInfo             `json:"events,omitempty"`
        CreatedAt                 time.Time               `json:"createdAt"`
}

// CronJobJobInfo CronJob关联的Job信息
type CronJobJobInfo struct {
        Name           string     `json:"name"`
        Status         string     `json:"status"`
        StartTime      *time.Time `json:"startTime,omitempty"`
        CompletionTime *time.Time `json:"completionTime,omitempty"`
}

// ==================== StatefulSet Detail ====================

// StatefulSetDetail StatefulSet详情
type StatefulSetDetail struct {
        Name                 string                     `json:"name"`
        Namespace            string                     `json:"namespace"`
        Replicas             int32                      `json:"replicas"`
        ReadyReplicas        int32                      `json:"readyReplicas"`
        CurrentReplicas      int32                      `json:"currentReplicas"`
        UpdatedReplicas      int32                      `json:"updatedReplicas"`
        ServiceName          string                     `json:"serviceName"`
        UpdateStrategy       string                     `json:"updateStrategy"`
        Partition            *int32                     `json:"partition,omitempty"`
        Labels               map[string]string          `json:"labels"`
        Annotations          map[string]string          `json:"annotations"`
        Selector             map[string]string          `json:"selector"`
        Containers           []StatefulSetContainerInfo `json:"containers"`
        VolumeClaimTemplates []VolumeClaimTemplateInfo  `json:"volumeClaimTemplates,omitempty"`
        Pods                 []StatefulSetPodInfo       `json:"pods"`
        Events               []EventInfo                `json:"events,omitempty"`
        CreatedAt            time.Time                  `json:"createdAt"`
}

// StatefulSetContainerInfo StatefulSet容器信息
type StatefulSetContainerInfo struct {
        Name      string            `json:"name"`
        Image     string            `json:"image"`
        Ports     []int32           `json:"ports"`
        Resources map[string]string `json:"resources,omitempty"`
}

// VolumeClaimTemplateInfo 存储卷声明模板信息
type VolumeClaimTemplateInfo struct {
        Name         string   `json:"name"`
        StorageClass string   `json:"storageClass"`
        AccessModes  []string `json:"accessModes"`
        Storage      string   `json:"storage"`
}

// StatefulSetPodInfo StatefulSet Pod信息
type StatefulSetPodInfo struct {
        Name      string    `json:"name"`
        Status    string    `json:"status"`
        Ready     string    `json:"ready"`
        PodIP     string    `json:"podIP"`
        NodeName  string    `json:"nodeName"`
        CreatedAt time.Time `json:"createdAt"`
}

// ==================== DaemonSet Detail ====================

// DaemonSetDetail DaemonSet详情
type DaemonSetDetail struct {
        Name           string                  `json:"name"`
        Namespace      string                  `json:"namespace"`
        DesiredNodes   int32                   `json:"desiredNodes"`
        CurrentNodes   int32                   `json:"currentNodes"`
        ReadyNodes     int32                   `json:"readyNodes"`
        UpdatedNodes   int32                   `json:"updatedNodes"`
        AvailableNodes int32                   `json:"availableNodes"`
        UpdateStrategy string                  `json:"updateStrategy"`
        Labels         map[string]string       `json:"labels"`
        Annotations    map[string]string       `json:"annotations"`
        Selector       map[string]string       `json:"selector"`
        Containers     []StatefulSetContainerInfo `json:"containers"`
        Pods           []StatefulSetPodInfo    `json:"pods"`
        Events         []EventInfo             `json:"events,omitempty"`
        CreatedAt      time.Time               `json:"createdAt"`
}

// ==================== Service ====================

// ServiceInfo Service信息
type ServiceInfo struct {
        Name        string            `json:"name"`
        Namespace   string            `json:"namespace"`
        Type        string            `json:"type"`
        ClusterIP   string            `json:"clusterIP"`
        ExternalIP  string            `json:"externalIP"`
        Ports       []ServicePort     `json:"ports"`
        Selector    map[string]string `json:"selector"`
        CreatedAt   time.Time         `json:"createdAt"`
}

// ServicePort Service端口
type ServicePort struct {
        Name       string `json:"name"`
        Port       int32  `json:"port"`
        TargetPort string `json:"targetPort"`
        Protocol   string `json:"protocol"`
}

// ==================== Ingress ====================

// IngressInfo Ingress信息
type IngressInfo struct {
        Name       string        `json:"name"`
        Namespace  string        `json:"namespace"`
        ClassName  string        `json:"className"`
        Hosts      []string      `json:"hosts"`
        Paths      []IngressPath `json:"paths"`
        TLS        bool          `json:"tls"`
        CreatedAt  time.Time     `json:"createdAt"`
}

// IngressPath Ingress路径
type IngressPath struct {
        Host     string `json:"host"`
        Path     string `json:"path"`
        PathType string `json:"pathType"`
        Backend  struct {
                Service string `json:"service"`
                Port    string `json:"port"`
        } `json:"backend"`
}

// ==================== ConfigMap ====================

// ConfigMapInfo ConfigMap信息
type ConfigMapInfo struct {
        Name       string            `json:"name"`
        Namespace  string            `json:"namespace"`
        Data       map[string]string `json:"data"`
        CreatedAt  time.Time         `json:"createdAt"`
}

// ==================== Secret ====================

// SecretInfo Secret信息
type SecretInfo struct {
        Name      string    `json:"name"`
        Namespace string    `json:"namespace"`
        Type      string    `json:"type"`
        DataKeys  []string  `json:"dataKeys"`
        CreatedAt time.Time `json:"createdAt"`
}

// ==================== PVC ====================

// PVCInfo PVC信息
type PVCInfo struct {
        Name         string    `json:"name"`
        Namespace    string    `json:"namespace"`
        Status       string    `json:"status"`
        Capacity     string    `json:"capacity"`
        AccessModes  []string  `json:"accessModes"`
        StorageClass string    `json:"storageClass"`
        VolumeName   string    `json:"volumeName"`
        CreatedAt    time.Time `json:"createdAt"`
}

// ==================== PV ====================

// PVInfo PV信息
type PVInfo struct {
        Name          string    `json:"name"`
        Status        string    `json:"status"`
        Capacity      string    `json:"capacity"`
        AccessModes   []string  `json:"accessModes"`
        ReclaimPolicy string    `json:"reclaimPolicy"`
        StorageClass  string    `json:"storageClass"`
        NFS           *NFSInfo  `json:"nfs,omitempty"`
        CreatedAt     time.Time `json:"createdAt"`
}

// NFSInfo NFS信息
type NFSInfo struct {
        Server string `json:"server"`
        Path   string `json:"path"`
}

// ==================== StorageClass ====================

// StorageClassInfo StorageClass信息
type StorageClassInfo struct {
        Name                 string            `json:"name"`
        Provisioner          string            `json:"provisioner"`
        ReclaimPolicy        string            `json:"reclaimPolicy"`
        VolumeBindingMode    string            `json:"volumeBindingMode"`
        AllowVolumeExpansion bool              `json:"allowVolumeExpansion"`
        Default              bool              `json:"default"`
        Parameters           map[string]string `json:"parameters"`
}

// ==================== RBAC ====================

// ServiceAccountInfo ServiceAccount信息
type ServiceAccountInfo struct {
        Name      string    `json:"name"`
        Namespace string    `json:"namespace"`
        Secrets   int       `json:"secrets"`
        CreatedAt time.Time `json:"createdAt"`
}

// RoleInfo Role信息
type RoleInfo struct {
        Name      string    `json:"name"`
        Namespace string    `json:"namespace"`
        Type      string    `json:"type"` // "Role" or "ClusterRole"
        Rules     int       `json:"rules"`
        CreatedAt time.Time `json:"createdAt"`
}

// RoleBindingInfo RoleBinding信息
type RoleBindingInfo struct {
        Name       string    `json:"name"`
        Namespace  string    `json:"namespace"`
        RoleName   string    `json:"roleName"`
        RoleKind   string    `json:"roleKind"` // "Role" or "ClusterRole"
        Subjects   []string  `json:"subjects"`
        Type       string    `json:"type"` // "RoleBinding" or "ClusterRoleBinding"
        CreatedAt  time.Time `json:"createdAt"`
}

// ==================== Event ====================

// EventInfo Event信息
type EventInfo struct {
        Name            string    `json:"name"`
        Namespace       string    `json:"namespace"`
        Type            string    `json:"type"`
        Reason          string    `json:"reason"`
        Message         string    `json:"message"`
        InvolvedObject  ObjectRef `json:"involvedObject"`
        Count           int32     `json:"count"`
        FirstTimestamp  time.Time `json:"firstTimestamp"`
        LastTimestamp   time.Time `json:"lastTimestamp"`
        Source          EventSource `json:"source"`
}

// ObjectRef 对象引用
type ObjectRef struct {
        Kind      string `json:"kind"`
        Name      string `json:"name"`
        Namespace string `json:"namespace"`
}

// EventSource 事件来源
type EventSource struct {
        Component string `json:"component"`
        Host      string `json:"host"`
}

// ==================== 中间件状态 ====================

// MiddlewareStatus 中间件状态
type MiddlewareStatus struct {
        Name        string            `json:"name"`
        Category    string            `json:"category"`    // monitoring, database, ingress, storage
        Status      string            `json:"status"`      // running, pending, not_deployed
        Namespace   string            `json:"namespace"`
        PodCount    int               `json:"podCount"`
        ReadyPods   int               `json:"readyPods"`
        Ports       []string          `json:"ports"`
        Version     string            `json:"version,omitempty"`
        Labels      map[string]string `json:"labels,omitempty"`
        CreatedAt   time.Time         `json:"createdAt,omitempty"`
}

// MiddlewareOverview 中间件概览
type MiddlewareOverview struct {
        Total       int                     `json:"total"`
        Running     int                     `json:"running"`
        Pending     int                     `json:"pending"`
        NotDeployed int                     `json:"notDeployed"`
        Items       []MiddlewareStatus      `json:"items"`
}

// ==================== 通用响应 ====================

// APIResponse 通用API响应
type APIResponse struct {
        Success bool        `json:"success"`
        Message string      `json:"message,omitempty"`
        Data    interface{} `json:"data,omitempty"`
        Error   string      `json:"error,omitempty"`
}

// ErrorResponse 错误响应
type ErrorResponse struct {
        Success bool   `json:"success"`
        Error   string `json:"error"`
        Hint    string `json:"hint,omitempty"`
}
