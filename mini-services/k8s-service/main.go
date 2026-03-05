package main

import (
	"fmt"
	"log"
	"os"

	"k8s-service/internal/config"
	"k8s-service/internal/handlers"
	"k8s-service/internal/k8s"
	"k8s-service/internal/router"
)

func main() {
	// 加载配置
	cfg := config.Load()

	// 创建Kubernetes客户端
	client, err := k8s.NewClient(cfg.KubeconfigPath, cfg.InCluster)
	if err != nil {
		log.Printf("Warning: Failed to create Kubernetes client: %v", err)
		log.Println("The server will start but K8s operations will fail until a valid kubeconfig is provided")
	}

	// 创建处理器
	h := handlers.NewHandler(client)

	// 设置路由
	r := router.SetupRouter(h)

	// 启动服务器
	addr := fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)
	log.Printf("K8s API Server starting on %s", addr)
	
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
		os.Exit(1)
	}
}
