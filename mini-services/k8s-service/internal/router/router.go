package router

import (
        "k8s-service/internal/handlers"

        "github.com/gin-contrib/cors"
        "github.com/gin-gonic/gin"
)

// SetupRouter 设置路由
func SetupRouter(h *handlers.Handler) *gin.Engine {
        r := gin.Default()

        // CORS配置
        r.Use(cors.New(cors.Config{
                AllowOrigins:     []string{"*"},
                AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
                AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
                ExposeHeaders:    []string{"Content-Length"},
                AllowCredentials: true,
        }))

        // API路由组
        api := r.Group("/api")
        {
                // Kubeconfig 配置
                api.POST("/kubeconfig", h.ConfigureKubeconfig)

                // 集群状态
                api.GET("/status", h.GetStatus)
                api.GET("/overview", h.GetOverview)

                // 节点
                api.GET("/nodes", h.GetNodes)
                api.GET("/nodes/:name", h.GetNodeDetail)
                api.POST("/nodes/:name/cordon", h.CordonNode)
                api.POST("/nodes/:name/uncordon", h.UncordonNode)
                api.POST("/nodes/:name/drain", h.DrainNode)

                // 命名空间
                api.GET("/namespaces", h.GetNamespaces)
                api.POST("/namespaces", h.CreateNamespace)
                api.DELETE("/namespaces/:name", h.DeleteNamespace)

                // Pods
                api.GET("/pods", h.GetPods)
                api.POST("/pods", h.CreatePod)
                api.GET("/pods/detail", h.GetPodDetail)
                api.GET("/pods/logs", h.GetPodLogs)
                api.GET("/pods/yaml", h.GetPodYaml)
                api.PUT("/pods/yaml", h.UpdatePodYaml)
                api.DELETE("/pods", h.DeletePod)

                // Deployments
                api.GET("/deployments", h.GetDeployments)
                api.POST("/deployments", h.CreateDeployment)
                api.POST("/deployments/scale", h.ScaleDeployment)
                api.POST("/deployments/restart", h.RestartDeployment)
                api.DELETE("/deployments", h.DeleteDeployment)

                // Resource YAML operations (通用资源YAML操作)
                api.GET("/resources/yaml", h.GetResourceYaml)
                api.PUT("/resources/yaml", h.UpdateResourceYaml)

                // Apply YAML (TODO: implement ApplyYaml handler)
                // api.POST("/apply", h.ApplyYaml)

                // StatefulSets
                api.GET("/statefulsets", h.GetStatefulSets)
                api.POST("/statefulsets", h.CreateStatefulSet)
                api.GET("/statefulsets/detail", h.GetStatefulSetDetail)
                api.POST("/statefulsets/scale", h.ScaleStatefulSet)
                api.POST("/statefulsets/restart", h.RestartStatefulSet)
                api.DELETE("/statefulsets", h.DeleteStatefulSet)

                // DaemonSets
                api.GET("/daemonsets", h.GetDaemonSets)
                api.POST("/daemonsets", h.CreateDaemonSet)
                api.GET("/daemonsets/detail", h.GetDaemonSetDetail)
                api.POST("/daemonsets/restart", h.RestartDaemonSet)
                api.DELETE("/daemonsets", h.DeleteDaemonSet)

                // Jobs
                api.GET("/jobs", h.GetJobs)
                api.POST("/jobs", h.CreateJob)
                api.GET("/jobs/detail", h.GetJobDetail)
                api.DELETE("/jobs", h.DeleteJob)

                // CronJobs
                api.GET("/cronjobs", h.GetCronJobs)
                api.POST("/cronjobs", h.CreateCronJob)
                api.GET("/cronjobs/detail", h.GetCronJobDetail)
                api.POST("/cronjobs/suspend", h.SuspendCronJob)
                api.POST("/cronjobs/trigger", h.TriggerCronJob)
                api.DELETE("/cronjobs", h.DeleteCronJob)

                // Services
                api.GET("/services", h.GetServices)

                // Ingress
                api.GET("/ingresses", h.GetIngresses)

                // ConfigMaps
                api.GET("/configmaps", h.GetConfigMaps)
                api.POST("/configmaps", h.CreateConfigMap)
                api.DELETE("/configmaps", h.DeleteConfigMap)

                // Secrets
                api.GET("/secrets", h.GetSecrets)
                api.DELETE("/secrets", h.DeleteSecret)

                // PVCs
                api.GET("/pvcs", h.GetPVCs)

                // PVs
                api.GET("/pvs", h.GetPVs)

                // StorageClasses
                api.GET("/storageclasses", h.GetStorageClasses)

                // Events
                api.GET("/events", h.GetEvents)

                // WebSocket Terminal
                api.GET("/ws/exec", h.WebSocketExec)

                // ServiceAccounts
                api.GET("/serviceaccounts", h.GetServiceAccounts)

                // Roles
                api.GET("/roles", h.GetRoles)

                // RoleBindings
                api.GET("/rolebindings", h.GetRoleBindings)

                // 中间件状态
                api.GET("/middleware/status", h.GetMiddlewareStatus)
        }

        // 健康检查
        r.GET("/health", func(c *gin.Context) {
                c.JSON(200, gin.H{"status": "ok"})
        })

        return r
}
