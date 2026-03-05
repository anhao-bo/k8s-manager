package handlers

import (
        "encoding/json"
        "io"
        "log"
        "net/http"
        "strings"
        "sync"

        "github.com/gin-gonic/gin"
        "github.com/gorilla/websocket"
        "k8s-service/internal/k8s"
)

var upgrader = websocket.Upgrader{
        CheckOrigin: func(r *http.Request) bool {
                return true
        },
        Subprotocols: []string{"terminal.k8s.io"},
}

// WebSocketMessage WebSocket 消息
type WebSocketMessage struct {
        Type string `json:"type"`
        Data string `json:"data"`
        Rows uint16 `json:"rows"`
        Cols uint16 `json:"cols"`
}

// WebSocketExec 处理 WebSocket 连接
func (h *Handler) WebSocketExec(c *gin.Context) {
        namespace := c.Query("namespace")
        podName := c.Query("pod")
        container := c.Query("container")
        shell := c.Query("shell")

        if namespace == "" || podName == "" {
                c.JSON(http.StatusBadRequest, gin.H{"error": "namespace and pod are required"})
                return
        }

        if h.Client == nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "kubernetes client not initialized"})
                return
        }

        // 默认 shell
        if shell == "" {
                shell = "/bin/sh"
        }

        // 升级为 WebSocket
        conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
        if err != nil {
                log.Printf("Failed to upgrade websocket: %v", err)
                return
        }
        defer conn.Close()

        log.Printf("WebSocket connected: namespace=%s, pod=%s, container=%s, shell=%s", namespace, podName, container, shell)

        // 创建管道用于数据传输
        stdinReader, stdinWriter := io.Pipe()
        stdoutReader, stdoutWriter := io.Pipe()

        session := k8s.NewTerminalSession(stdinReader, stdoutWriter, nil)
        defer session.Close()

        // 构建命令：先尝试指定的 shell，失败则降级
        cmd := []string{shell}
        if shell != "/bin/sh" {
                // 如果不是 /bin/sh，尝试指定 shell，失败则降级
                cmd = []string{"/bin/sh", "-c", "exec " + shell + " 2>/dev/null || exec /bin/sh"}
        }

        // 启动 goroutine 执行 shell
        execErrChan := make(chan error, 1)
        go func() {
                err := h.Client.ExecPodShell(namespace, podName, container, cmd, session)
                execErrChan <- err
        }()

        // 处理 WebSocket 消息
        var wg sync.WaitGroup
        wg.Add(2)

        // 读取 WebSocket 消息并写入 stdin
        go func() {
                defer wg.Done()
                defer stdinWriter.Close()

                for {
                        _, message, err := conn.ReadMessage()
                        if err != nil {
                                if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
                                        log.Printf("WebSocket read error: %v", err)
                                }
                                return
                        }

                        var msg WebSocketMessage
                        if err := json.Unmarshal(message, &msg); err != nil {
                                // 如果不是 JSON，直接作为数据发送
                                stdinWriter.Write(message)
                                continue
                        }

                        switch msg.Type {
                        case "stdin":
                                stdinWriter.Write([]byte(msg.Data))
                        case "resize":
                                session.Resize(msg.Cols, msg.Rows)
                        case "ping":
                                conn.WriteJSON(WebSocketMessage{Type: "pong"})
                        }
                }
        }()

        // 读取 stdout 并发送到 WebSocket
        go func() {
                defer wg.Done()

                buf := make([]byte, 4096)
                for {
                        n, err := stdoutReader.Read(buf)
                        if err != nil {
                                return
                        }

                        msg := WebSocketMessage{
                                Type: "stdout",
                                Data: string(buf[:n]),
                        }
                        if err := conn.WriteJSON(msg); err != nil {
                                log.Printf("WebSocket write error: %v", err)
                                return
                        }
                }
        }()

        // 等待执行完成或连接关闭
        select {
        case err := <-execErrChan:
                if err != nil {
                        log.Printf("Exec error: %v", err)
                        errMsg := err.Error()
                        // 检查是否是 shell 不存在的错误
                        if strings.Contains(errMsg, "no such file") || strings.Contains(errMsg, "not found") {
                                errMsg = "Shell not found: " + shell + ". Try /bin/sh instead."
                        }
                        conn.WriteJSON(WebSocketMessage{
                                Type: "error",
                                Data: errMsg,
                        })
                }
        }

        wg.Wait()
        log.Printf("WebSocket disconnected: namespace=%s, pod=%s", namespace, podName)
}
