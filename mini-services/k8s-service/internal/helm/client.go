package helm

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

// Client Helm 客户端
type Client struct {
	kubeconfig string
}

// NewClient 创建 Helm 客户端
func NewClient(kubeconfig string) *Client {
	return &Client{kubeconfig: kubeconfig}
}

// Repo Helm 仓库
type Repo struct {
	Name    string `json:"name"`
	URL     string `json:"url"`
	Status  string `json:"status"`
	Charts  int    `json:"charts"`
	LastUpdate string `json:"lastUpdate"`
}

// Chart Chart 信息
type Chart struct {
	Name        string   `json:"name"`
	Version     string   `json:"version"`
	AppVersion  string   `json:"appVersion"`
	Description string   `json:"description"`
	Repo        string   `json:"repo"`
	Icon        string   `json:"icon"`
	Keywords    []string `json:"keywords"`
}

// Release 已安装的 Release
type Release struct {
	Name       string    `json:"name"`
	Namespace  string    `json:"namespace"`
	Chart      string    `json:"chart"`
	Version    string    `json:"version"`
	Status     string    `json:"status"`
	Revision   int       `json:"revision"`
	Updated    time.Time `json:"updated"`
}

// InstallOptions 安装选项
type InstallOptions struct {
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Chart     string            `json:"chart"`
	Version   string            `json:"version"`
	Values    map[string]interface{} `json:"values"`
	Wait      bool              `json:"wait"`
	Timeout   time.Duration     `json:"timeout"`
}

// InstallResult 安装结果
type InstallResult struct {
	Name    string `json:"name"`
	Status  string `json:"status"`
	Message string `json:"message"`
}

// helmCmd 执行 helm 命令
func (c *Client) helmCmd(args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, "helm", args...)
	if c.kubeconfig != "" {
		cmd.Env = append(os.Environ(), fmt.Sprintf("KUBECONFIG=%s", c.kubeconfig))
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("helm command failed: %s, error: %w", string(output), err)
	}
	return string(output), nil
}

// AddRepo 添加仓库
func (c *Client) AddRepo(name, url string) error {
	_, err := c.helmCmd("repo", "add", name, url)
	if err != nil {
		return err
	}
	_, err = c.helmCmd("repo", "update")
	return err
}

// RemoveRepo 删除仓库
func (c *Client) RemoveRepo(name string) error {
	_, err := c.helmCmd("repo", "remove", name)
	return err
}

// UpdateRepo 更新仓库索引
func (c *Client) UpdateRepo(name string) error {
	_, err := c.helmCmd("repo", "update")
	return err
}

// ListRepos 列出仓库
func (c *Client) ListRepos() ([]Repo, error) {
	output, err := c.helmCmd("repo", "list", "-o", "json")
	if err != nil {
		return nil, err
	}

	// 解析 JSON 输出
	var repos []Repo
	// TODO: 解析实际输出
	_ = output
	return repos, nil
}

// SearchCharts 搜索 Charts
func (c *Client) SearchCharts(keyword string) ([]Chart, error) {
	output, err := c.helmCmd("search", "repo", keyword, "-o", "json")
	if err != nil {
		return nil, err
	}

	var charts []Chart
	_ = output
	// TODO: 解析实际输出
	return charts, nil
}

// Install 安装 Chart
func (c *Client) Install(opts InstallOptions) (*InstallResult, error) {
	args := []string{
		"install", opts.Name, opts.Chart,
		"--namespace", opts.Namespace,
		"--create-namespace",
	}

	if opts.Version != "" {
		args = append(args, "--version", opts.Version)
	}

	if opts.Wait {
		args = append(args, "--wait")
	}

	if opts.Timeout > 0 {
		args = append(args, "--timeout", opts.Timeout.String())
	}

	// 如果有自定义 values，写入临时文件
	if len(opts.Values) > 0 {
		// TODO: 将 values 写入临时文件并使用 -f 参数
	}

	output, err := c.helmCmd(args...)
	if err != nil {
		return &InstallResult{
			Name:    opts.Name,
			Status:  "failed",
			Message: err.Error(),
		}, err
	}

	return &InstallResult{
		Name:    opts.Name,
		Status:  "deployed",
		Message: output,
	}, nil
}

// Upgrade 升级 Release
func (c *Client) Upgrade(name, namespace, chart string, values map[string]interface{}) (*InstallResult, error) {
	args := []string{
		"upgrade", name, chart,
		"--namespace", namespace,
	}

	output, err := c.helmCmd(args...)
	if err != nil {
		return nil, err
	}

	return &InstallResult{
		Name:    name,
		Status:  "deployed",
		Message: output,
	}, nil
}

// Uninstall 卸载 Release
func (c *Client) Uninstall(name, namespace string) error {
	_, err := c.helmCmd("uninstall", name, "--namespace", namespace)
	return err
}

// Rollback 回滚 Release
func (c *Client) Rollback(name, namespace string, revision int) error {
	args := []string{"rollback", name, fmt.Sprintf("%d", revision), "--namespace", namespace}
	_, err := c.helmCmd(args...)
	return err
}

// ListReleases 列出已安装的 Releases
func (c *Client) ListReleases(namespace string) ([]Release, error) {
	args := []string{"list", "-o", "json"}
	if namespace != "" {
		args = append(args, "--namespace", namespace)
	} else {
		args = append(args, "--all-namespaces")
	}

	output, err := c.helmCmd(args...)
	if err != nil {
		return nil, err
	}

	var releases []Release
	_ = output
	// TODO: 解析实际输出
	return releases, nil
}

// GetReleaseStatus 获取 Release 状态
func (c *Client) GetReleaseStatus(name, namespace string) (*Release, error) {
	args := []string{"status", name, "--namespace", namespace, "-o", "json"}
	output, err := c.helmCmd(args...)
	if err != nil {
		return nil, err
	}

	var release Release
	_ = output
	// TODO: 解析实际输出
	return &release, nil
}

// GetValues 获取 Release 的 Values
func (c *Client) GetValues(name, namespace string) (map[string]interface{}, error) {
	args := []string{"get", "values", name, "--namespace", namespace, "-o", "json"}
	output, err := c.helmCmd(args...)
	if err != nil {
		return nil, err
	}

	var values map[string]interface{}
	_ = output
	// TODO: 解析实际输出
	return values, nil
}

// ParseChartName 解析 Chart 名称 (repo/name 格式)
func ParseChartName(chart string) (repo, name string) {
	parts := strings.SplitN(chart, "/", 2)
	if len(parts) == 2 {
		return parts[0], parts[1]
	}
	return "", parts[0]
}
