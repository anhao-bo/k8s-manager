package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"k8s.io/client-go/tools/remotecommand"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	Subprotocols: []string{"channel.k8s.io", "terminal.k8s.io"},
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

	// 使用通道进行数据传输，避免 io.Pipe 死锁
	stdinChan := make(chan []byte, 100)
	stdoutChan := make(chan []byte, 100)
	resizeChan := make(chan remotecommand.TerminalSize, 10)
	doneChan := make(chan struct{})

	// 创建终端会话
	session := NewTerminalSession(stdinChan, stdoutChan, resizeChan, doneChan)
	defer close(doneChan)

	// 构建命令
	cmd := []string{shell}
	if shell != "/bin/sh" {
		cmd = []string{"/bin/sh", "-c", "exec " + shell + " 2>/dev/null || exec /bin/sh"}
	}

	// 启动 goroutine 执行 shell
	execErrChan := make(chan error, 1)
	go func() {
		err := h.Client.ExecPodShell(namespace, podName, container, cmd, session)
		execErrChan <- err
	}()

	var wg sync.WaitGroup
	wg.Add(3)

	// 1. 读取 WebSocket 消息并写入 stdin
	go func() {
		defer wg.Done()
		defer close(stdinChan)

		for {
			select {
			case <-doneChan:
				return
			default:
				// 设置读取超时
				conn.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
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
					select {
					case stdinChan <- message:
					case <-doneChan:
						return
					}
					continue
				}

				switch msg.Type {
				case "stdin":
					select {
					case stdinChan <- []byte(msg.Data):
					case <-doneChan:
						return
					}
				case "resize":
					select {
					case resizeChan <- remotecommand.TerminalSize{Width: msg.Cols, Height: msg.Rows}:
					case <-doneChan:
						return
					}
				case "ping":
					conn.WriteJSON(WebSocketMessage{Type: "pong"})
				}
			}
		}
	}()

	// 2. 读取 stdout 并发送到 WebSocket
	go func() {
		defer wg.Done()

		for {
			select {
			case data, ok := <-stdoutChan:
				if !ok {
					return
				}
				msg := WebSocketMessage{
					Type: "stdout",
					Data: string(data),
				}
				if err := conn.WriteJSON(msg); err != nil {
					log.Printf("WebSocket write error: %v", err)
					return
				}
			case <-doneChan:
				return
			}
		}
	}()

	// 3. 监控执行状态
	go func() {
		defer wg.Done()

		select {
		case err := <-execErrChan:
			if err != nil {
				log.Printf("Exec error: %v", err)
				errMsg := err.Error()
				if strings.Contains(errMsg, "no such file") || strings.Contains(errMsg, "not found") {
					errMsg = "Shell not found: " + shell + ". Try /bin/sh instead."
				}
				conn.WriteJSON(WebSocketMessage{
					Type: "error",
					Data: errMsg,
				})
			}
		case <-doneChan:
		}
	}()

	wg.Wait()
	log.Printf("WebSocket disconnected: namespace=%s, pod=%s", namespace, podName)
}

// TerminalSession 终端会话
type TerminalSession struct {
	stdinChan  chan []byte
	stdoutChan chan []byte
	resizeChan chan remotecommand.TerminalSize
	doneChan   chan struct{}
}

// NewTerminalSession 创建终端会话
func NewTerminalSession(stdinChan, stdoutChan chan []byte, resizeChan chan remotecommand.TerminalSize, doneChan chan struct{}) *TerminalSession {
	return &TerminalSession{
		stdinChan:  stdinChan,
		stdoutChan: stdoutChan,
		resizeChan: resizeChan,
		doneChan:   doneChan,
	}
}

// Read 实现 io.Reader
func (s *TerminalSession) Read(p []byte) (int, error) {
	select {
	case data, ok := <-s.stdinChan:
		if !ok {
			return 0, io.EOF
		}
		return copy(p, data), nil
	case <-s.doneChan:
		return 0, io.EOF
	}
}

// Write 实现 io.Writer
func (s *TerminalSession) Write(p []byte) (int, error) {
	select {
	case s.stdoutChan <- p:
		return len(p), nil
	case <-s.doneChan:
		return 0, io.ErrClosedPipe
	}
}

// Next 实现 TerminalSizeQueue
func (s *TerminalSession) Next() *remotecommand.TerminalSize {
	select {
	case size := <-s.resizeChan:
		return &size
	case <-s.doneChan:
		return nil
	}
}
