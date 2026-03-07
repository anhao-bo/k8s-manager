package k8s

import (
        "context"
        "fmt"
        "io"
        "strings"
        "sync"

        corev1 "k8s.io/api/core/v1"
        metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
        "k8s.io/client-go/kubernetes/scheme"
        "k8s.io/client-go/tools/remotecommand"
)

// TerminalSize 表示终端大小 - 使用 remotecommand 包的类型
type TerminalSize = remotecommand.TerminalSize

// PtyHandler 处理 PTY 操作
type PtyHandler interface {
        io.Reader
        io.Writer
        remotecommand.TerminalSizeQueue
}

// ExecPodShell 在 Pod 中执行 shell
func (c *Client) ExecPodShell(namespace, podName, container string, cmd []string, pty PtyHandler) error {
        if c.Clientset == nil {
                return fmt.Errorf("kubernetes client not initialized")
        }

        if container == "" {
                // 获取 Pod 的第一个容器
                pod, err := c.Clientset.CoreV1().Pods(namespace).Get(context.Background(), podName, metav1.GetOptions{})
                if err != nil {
                        return fmt.Errorf("failed to get pod: %w", err)
                }
                if len(pod.Spec.Containers) == 0 {
                        return fmt.Errorf("pod has no containers")
                }
                container = pod.Spec.Containers[0].Name
        }

        if len(cmd) == 0 {
                cmd = []string{"/bin/sh", "-c", "if command -v bash >/dev/null 2>&1; then exec bash; else exec sh; fi"}
        }

        req := c.Clientset.CoreV1().RESTClient().Post().
                Resource("pods").
                Name(podName).
                Namespace(namespace).
                SubResource("exec").
                VersionedParams(&corev1.PodExecOptions{
                        Container: container,
                        Command:   cmd,
                        Stdin:     true,
                        Stdout:    true,
                        Stderr:    true,
                        TTY:       true,
                }, scheme.ParameterCodec)

        executor, err := remotecommand.NewSPDYExecutor(c.Config, "POST", req.URL())
        if err != nil {
                return fmt.Errorf("failed to create executor: %w", err)
        }

        streamOptions := remotecommand.StreamOptions{
                Stdin:             pty,
                Stdout:            pty,
                Stderr:            pty,
                Tty:               true,
                TerminalSizeQueue: pty,
        }

        err = executor.StreamWithContext(context.Background(), streamOptions)
        if err != nil {
                return fmt.Errorf("failed to execute: %w", err)
        }

        return nil
}

// TerminalSession 表示一个终端会话（用于向后兼容）
type TerminalSession struct {
        Stdin     io.Reader
        Stdout    io.Writer
        Stderr    io.Writer
        Tty       bool
        SizeChan  chan TerminalSize
        CloseChan chan struct{}
        mutex     sync.Mutex
}

// NewTerminalSession 创建新的终端会话
func NewTerminalSession(stdin io.Reader, stdout io.Writer, stderr io.Writer) *TerminalSession {
        return &TerminalSession{
                Stdin:     stdin,
                Stdout:    stdout,
                Stderr:    stderr,
                Tty:       true,
                SizeChan:  make(chan TerminalSize, 10),
                CloseChan: make(chan struct{}),
        }
}

// Read 实现 io.Reader
func (t *TerminalSession) Read(p []byte) (int, error) {
        return t.Stdin.Read(p)
}

// Write 实现 io.Writer
func (t *TerminalSession) Write(p []byte) (int, error) {
        return t.Stdout.Write(p)
}

// Next 实现 TerminalSizeQueue
func (t *TerminalSession) Next() *remotecommand.TerminalSize {
        select {
        case size := <-t.SizeChan:
                return &remotecommand.TerminalSize{
                        Width:  size.Width,
                        Height: size.Height,
                }
        case <-t.CloseChan:
                return nil
        }
}

// Resize 更新终端大小
func (t *TerminalSession) Resize(width, height uint16) {
        t.mutex.Lock()
        defer t.mutex.Unlock()
        select {
        case t.SizeChan <- TerminalSize{Width: width, Height: height}:
        default:
                // 非阻塞，如果满了就丢弃
        }
}

// Close 关闭会话
func (t *TerminalSession) Close() {
        close(t.CloseChan)
}

// ExecPodCommand 在 Pod 中执行命令（非交互式）
func (c *Client) ExecPodCommand(namespace, podName, container string, cmd []string) (string, string, error) {
        if c.Clientset == nil {
                return "", "", fmt.Errorf("kubernetes client not initialized")
        }

        if container == "" {
                pod, err := c.Clientset.CoreV1().Pods(namespace).Get(context.Background(), podName, metav1.GetOptions{})
                if err != nil {
                        return "", "", fmt.Errorf("failed to get pod: %w", err)
                }
                if len(pod.Spec.Containers) == 0 {
                        return "", "", fmt.Errorf("pod has no containers")
                }
                container = pod.Spec.Containers[0].Name
        }

        req := c.Clientset.CoreV1().RESTClient().Post().
                Resource("pods").
                Name(podName).
                Namespace(namespace).
                SubResource("exec").
                VersionedParams(&corev1.PodExecOptions{
                        Container: container,
                        Command:   cmd,
                        Stdin:     false,
                        Stdout:    true,
                        Stderr:    true,
                        TTY:       false,
                }, scheme.ParameterCodec)

        executor, err := remotecommand.NewSPDYExecutor(c.Config, "POST", req.URL())
        if err != nil {
                return "", "", fmt.Errorf("failed to create executor: %w", err)
        }

        var stdout, stderr strings.Builder
        streamOptions := remotecommand.StreamOptions{
                Stdout: &stdout,
                Stderr: &stderr,
        }

        err = executor.StreamWithContext(context.Background(), streamOptions)
        if err != nil {
                return stdout.String(), stderr.String(), fmt.Errorf("failed to execute: %w", err)
        }

        return stdout.String(), stderr.String(), nil
}
