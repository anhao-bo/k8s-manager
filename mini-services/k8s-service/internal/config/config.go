package config

import (
        "os"
        "strconv"
)

// Config 应用配置
type Config struct {
        // Server
        Port         string
        Host         string
        ReadTimeout  int
        WriteTimeout int

        // Kubernetes
        KubeconfigPath string
        InCluster      bool

        // CORS
        AllowedOrigins []string
}

// Load 加载配置
func Load() *Config {
        return &Config{
                Port:           getEnv("PORT", "8080"),
                Host:           getEnv("HOST", "0.0.0.0"),
                ReadTimeout:    getEnvInt("READ_TIMEOUT", 30),
                WriteTimeout:   getEnvInt("WRITE_TIMEOUT", 30),
                KubeconfigPath: getEnv("KUBECONFIG", ""),
                InCluster:      getEnvBool("IN_CLUSTER", false),
                AllowedOrigins: getEnvSlice("ALLOWED_ORIGINS", []string{"*"}),
        }
}

func getEnv(key, defaultValue string) string {
        if value := os.Getenv(key); value != "" {
                return value
        }
        return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
        if value := os.Getenv(key); value != "" {
                if intVal, err := strconv.Atoi(value); err == nil {
                        return intVal
                }
        }
        return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
        if value := os.Getenv(key); value != "" {
                if boolVal, err := strconv.ParseBool(value); err == nil {
                        return boolVal
                }
        }
        return defaultValue
}

func getEnvSlice(key string, defaultValue []string) []string {
        if value := os.Getenv(key); value != "" {
                // 简单实现，用逗号分隔
                if value == "*" {
                        return []string{"*"}
                }
                // TODO: 解析逗号分隔的列表
                return []string{value}
        }
        return defaultValue
}
