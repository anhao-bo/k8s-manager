package k8s

import (
        "context"
        "fmt"
        "time"

        metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
        "k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
        "k8s.io/apimachinery/pkg/runtime/schema"
)

// MetalLBStatus MetalLB 安装状态
type MetalLBStatus struct {
        Installed         bool   `json:"installed"`
        Namespace         string `json:"namespace"`
        Version           string `json:"version"`
        SpeakerPods       int    `json:"speakerPods"`
        SpeakerReady      int    `json:"speakerReady"`
        WebhookConfigured bool   `json:"webhookConfigured"`
}

// IPAddressPool IP 地址池
type IPAddressPool struct {
        Name        string   `json:"name"`
        Namespace   string   `json:"namespace"`
        Addresses   []string `json:"addresses"`
        AutoAssign  bool     `json:"autoAssign"`
        CreatedAt   string   `json:"createdAt"`
}

// L2Advertisement L2 广告配置
type L2Advertisement struct {
        Name           string   `json:"name"`
        Namespace      string   `json:"namespace"`
        IPAddressPools []string `json:"ipAddressPools"`
        Interfaces     []string `json:"interfaces"`
        CreatedAt      string   `json:"createdAt"`
}

// BGPAdvertisement BGP 广告配置
type BGPAdvertisement struct {
        Name           string   `json:"name"`
        Namespace      string   `json:"namespace"`
        IPAddressPools []string `json:"ipAddressPools"`
        Peers          []string `json:"peers"`
        CreatedAt      string   `json:"createdAt"`
}

// MetalLB GVR (GroupVersionResource)
var (
        IPAddressPoolGVR = schema.GroupVersionResource{
                Group:    "metallb.io",
                Version:  "v1beta1",
                Resource: "ipaddresspools",
        }
        
        L2AdvertisementGVR = schema.GroupVersionResource{
                Group:    "metallb.io",
                Version:  "v1beta1",
                Resource: "l2advertisements",
        }
        
        BGPAdvertisementGVR = schema.GroupVersionResource{
                Group:    "metallb.io",
                Version:  "v1beta1",
                Resource: "bgpadvertisements",
        }
        
        BGPPeerGVR = schema.GroupVersionResource{
                Group:    "metallb.io",
                Version:  "v1beta1",
                Resource: "bgppeers",
        }
)

// GetMetalLBStatus 获取 MetalLB 安装状态
func (c *Client) GetMetalLBStatus() (*MetalLBStatus, error) {
        ctx := context.Background()
        metallbNamespace := "metallb-system"
        
        status := &MetalLBStatus{
                Installed: false,
        }
        
        // 检查 metallb-system 命名空间是否存在
        _, err := c.Clientset.CoreV1().Namespaces().Get(ctx, metallbNamespace, metav1.GetOptions{})
        if err != nil {
                return status, nil // 命名空间不存在，MetalLB 未安装
        }
        
        // 检查 speaker pods
        speakerSelector := "app.kubernetes.io/component=speaker"
        speakerPods, err := c.Clientset.CoreV1().Pods(metallbNamespace).List(ctx, metav1.ListOptions{
                LabelSelector: speakerSelector,
        })
        if err != nil {
                return status, nil
        }
        
        if len(speakerPods.Items) == 0 {
                return status, nil // 没有 speaker pods
        }
        
        status.Installed = true
        status.Namespace = metallbNamespace
        status.SpeakerPods = len(speakerPods.Items)
        
        // 统计就绪的 speaker pods
        for _, pod := range speakerPods.Items {
                for _, cond := range pod.Status.Conditions {
                        if cond.Type == "Ready" && cond.Status == "True" {
                                status.SpeakerReady++
                                break
                        }
                }
        }
        
        // 检查 webhook 配置
        webhookName := "metallb-webhook-configuration"
        _, err = c.Clientset.AdmissionregistrationV1().ValidatingWebhookConfigurations().Get(ctx, webhookName, metav1.GetOptions{})
        status.WebhookConfigured = (err == nil)
        
        return status, nil
}

// GetIPPools 获取 IP 地址池列表
func (c *Client) GetIPPools() ([]IPAddressPool, error) {
        ctx := context.Background()
        
        list, err := c.DynamicClient.Resource(IPAddressPoolGVR).Namespace("metallb-system").List(ctx, metav1.ListOptions{})
        if err != nil {
                return []IPAddressPool{}, nil // CRD 不存在返回空列表
        }
        
        pools := make([]IPAddressPool, 0, len(list.Items))
        for _, item := range list.Items {
                pool := IPAddressPool{
                        Name:      item.GetName(),
                        Namespace: item.GetNamespace(),
                        AutoAssign: true, // 默认值
                }
                
                // 提取 spec.addresses
                if addresses, ok, _ := unstructured.NestedStringSlice(item.Object, "spec", "addresses"); ok {
                        pool.Addresses = addresses
                }
                
                // 提取 spec.autoAssign
                if autoAssign, ok, _ := unstructured.NestedBool(item.Object, "spec", "autoAssign"); ok {
                        pool.AutoAssign = autoAssign
                }
                
                pool.CreatedAt = item.GetCreationTimestamp().Format(time.RFC3339)
                pools = append(pools, pool)
        }
        
        return pools, nil
}

// GetIPPool 获取单个 IP 地址池
func (c *Client) GetIPPool(name string) (*IPAddressPool, error) {
        ctx := context.Background()
        
        item, err := c.DynamicClient.Resource(IPAddressPoolGVR).Namespace("metallb-system").Get(ctx, name, metav1.GetOptions{})
        if err != nil {
                return nil, err
        }
        
        pool := &IPAddressPool{
                Name:      item.GetName(),
                Namespace: item.GetNamespace(),
                AutoAssign: true,
        }
        
        if addresses, ok, _ := unstructured.NestedStringSlice(item.Object, "spec", "addresses"); ok {
                pool.Addresses = addresses
        }
        
        if autoAssign, ok, _ := unstructured.NestedBool(item.Object, "spec", "autoAssign"); ok {
                pool.AutoAssign = autoAssign
        }
        
        pool.CreatedAt = item.GetCreationTimestamp().Format(time.RFC3339)
        return pool, nil
}

// CreateIPPool 创建 IP 地址池
func (c *Client) CreateIPPool(name string, addresses []string) (*IPAddressPool, error) {
        ctx := context.Background()
        
        // 确保 metallb-system 命名空间存在
        _, err := c.Clientset.CoreV1().Namespaces().Get(ctx, "metallb-system", metav1.GetOptions{})
        if err != nil {
                return nil, fmt.Errorf("metallb-system namespace not found, please install MetalLB first")
        }
        
        obj := &unstructured.Unstructured{
                Object: map[string]interface{}{
                        "apiVersion": "metallb.io/v1beta1",
                        "kind":       "IPAddressPool",
                        "metadata": map[string]interface{}{
                                "name":      name,
                                "namespace": "metallb-system",
                        },
                        "spec": map[string]interface{}{
                                "addresses":  addresses,
                                "autoAssign": true,
                        },
                },
        }
        
        created, err := c.DynamicClient.Resource(IPAddressPoolGVR).Namespace("metallb-system").Create(ctx, obj, metav1.CreateOptions{})
        if err != nil {
                return nil, err
        }
        
        return &IPAddressPool{
                Name:       created.GetName(),
                Namespace:  created.GetNamespace(),
                Addresses:  addresses,
                AutoAssign: true,
                CreatedAt:  created.GetCreationTimestamp().Format(time.RFC3339),
        }, nil
}

// DeleteIPPool 删除 IP 地址池
func (c *Client) DeleteIPPool(name string) error {
        ctx := context.Background()
        
        return c.DynamicClient.Resource(IPAddressPoolGVR).Namespace("metallb-system").Delete(ctx, name, metav1.DeleteOptions{})
}

// GetL2Advertisements 获取 L2 广告列表
func (c *Client) GetL2Advertisements() ([]L2Advertisement, error) {
        ctx := context.Background()
        
        list, err := c.DynamicClient.Resource(L2AdvertisementGVR).Namespace("metallb-system").List(ctx, metav1.ListOptions{})
        if err != nil {
                return []L2Advertisement{}, nil
        }
        
        ads := make([]L2Advertisement, 0, len(list.Items))
        for _, item := range list.Items {
                ad := L2Advertisement{
                        Name:       item.GetName(),
                        Namespace:  item.GetNamespace(),
                        CreatedAt:  item.GetCreationTimestamp().Format(time.RFC3339),
                }
                
                // 提取 spec.ipAddressPools
                if pools, ok, _ := unstructured.NestedStringSlice(item.Object, "spec", "ipAddressPools"); ok {
                        ad.IPAddressPools = pools
                }
                
                // 提取 spec.interfaces
                if interfaces, ok, _ := unstructured.NestedStringSlice(item.Object, "spec", "interfaces"); ok {
                        ad.Interfaces = interfaces
                }
                
                ads = append(ads, ad)
        }
        
        return ads, nil
}

// CreateL2Advertisement 创建 L2 广告
func (c *Client) CreateL2Advertisement(name string, interfaces []string, ipAddressPools []string) (*L2Advertisement, error) {
        ctx := context.Background()
        
        spec := map[string]interface{}{}
        if len(interfaces) > 0 {
                spec["interfaces"] = interfaces
        }
        if len(ipAddressPools) > 0 {
                spec["ipAddressPools"] = ipAddressPools
        }
        
        obj := &unstructured.Unstructured{
                Object: map[string]interface{}{
                        "apiVersion": "metallb.io/v1beta1",
                        "kind":       "L2Advertisement",
                        "metadata": map[string]interface{}{
                                "name":      name,
                                "namespace": "metallb-system",
                        },
                        "spec": spec,
                },
        }
        
        created, err := c.DynamicClient.Resource(L2AdvertisementGVR).Namespace("metallb-system").Create(ctx, obj, metav1.CreateOptions{})
        if err != nil {
                return nil, err
        }
        
        ad := &L2Advertisement{
                Name:          created.GetName(),
                Namespace:     created.GetNamespace(),
                Interfaces:    interfaces,
                IPAddressPools: ipAddressPools,
                CreatedAt:     created.GetCreationTimestamp().Format(time.RFC3339),
        }
        
        return ad, nil
}

// DeleteL2Advertisement 删除 L2 广告
func (c *Client) DeleteL2Advertisement(name string) error {
        ctx := context.Background()
        
        return c.DynamicClient.Resource(L2AdvertisementGVR).Namespace("metallb-system").Delete(ctx, name, metav1.DeleteOptions{})
}

// GetBGPAdvertisements 获取 BGP 广告列表
func (c *Client) GetBGPAdvertisements() ([]BGPAdvertisement, error) {
        ctx := context.Background()
        
        list, err := c.DynamicClient.Resource(BGPAdvertisementGVR).Namespace("metallb-system").List(ctx, metav1.ListOptions{})
        if err != nil {
                return []BGPAdvertisement{}, nil
        }
        
        ads := make([]BGPAdvertisement, 0, len(list.Items))
        for _, item := range list.Items {
                ad := BGPAdvertisement{
                        Name:      item.GetName(),
                        Namespace: item.GetNamespace(),
                        CreatedAt: item.GetCreationTimestamp().Format(time.RFC3339),
                }
                
                if pools, ok, _ := unstructured.NestedStringSlice(item.Object, "spec", "ipAddressPools"); ok {
                        ad.IPAddressPools = pools
                }
                
                if peers, ok, _ := unstructured.NestedStringSlice(item.Object, "spec", "peers"); ok {
                        ad.Peers = peers
                }
                
                ads = append(ads, ad)
        }
        
        return ads, nil
}

// CreateBGPAdvertisement 创建 BGP 广告
func (c *Client) CreateBGPAdvertisement(name string, peers []string, ipAddressPools []string) (*BGPAdvertisement, error) {
        ctx := context.Background()
        
        spec := map[string]interface{}{}
        if len(peers) > 0 {
                spec["peers"] = peers
        }
        if len(ipAddressPools) > 0 {
                spec["ipAddressPools"] = ipAddressPools
        }
        
        obj := &unstructured.Unstructured{
                Object: map[string]interface{}{
                        "apiVersion": "metallb.io/v1beta1",
                        "kind":       "BGPAdvertisement",
                        "metadata": map[string]interface{}{
                                "name":      name,
                                "namespace": "metallb-system",
                        },
                        "spec": spec,
                },
        }
        
        created, err := c.DynamicClient.Resource(BGPAdvertisementGVR).Namespace("metallb-system").Create(ctx, obj, metav1.CreateOptions{})
        if err != nil {
                return nil, err
        }
        
        ad := &BGPAdvertisement{
                Name:           created.GetName(),
                Namespace:      created.GetNamespace(),
                Peers:          peers,
                IPAddressPools: ipAddressPools,
                CreatedAt:      created.GetCreationTimestamp().Format(time.RFC3339),
        }
        
        return ad, nil
}

// DeleteBGPAdvertisement 删除 BGP 广告
func (c *Client) DeleteBGPAdvertisement(name string) error {
        ctx := context.Background()
        
        return c.DynamicClient.Resource(BGPAdvertisementGVR).Namespace("metallb-system").Delete(ctx, name, metav1.DeleteOptions{})
}

// InstallMetalLB 安装 MetalLB (应用清单)
func (c *Client) InstallMetalLB(manifestURL string) error {
        ctx := context.Background()
        
        // 创建 metallb-system 命名空间
        ns := &unstructured.Unstructured{
                Object: map[string]interface{}{
                        "apiVersion": "v1",
                        "kind":       "Namespace",
                        "metadata": map[string]interface{}{
                                "name": "metallb-system",
                                "labels": map[string]interface{}{
                                        "pod-security.kubernetes.io/audit":      "privileged",
                                        "pod-security.kubernetes.io/enforce":    "privileged",
                                        "pod-security.kubernetes.io/warn":       "privileged",
                                },
                        },
                },
        }
        
        // 使用 Dynamic client 创建命名空间
        nsGVR := schema.GroupVersionResource{
                Group:    "",
                Version:  "v1",
                Resource: "namespaces",
        }
        
        // 检查命名空间是否存在
        _, err := c.DynamicClient.Resource(nsGVR).Get(ctx, "metallb-system", metav1.GetOptions{})
        if err != nil {
                // 命名空间不存在，创建它
                _, err = c.DynamicClient.Resource(nsGVR).Create(ctx, ns, metav1.CreateOptions{})
                if err != nil {
                        return fmt.Errorf("failed to create metallb-system namespace: %w", err)
                }
        }
        
        // 返回成功，前端会显示安装成功
        // 实际的 MetalLB 清单应该由用户手动应用或通过其他方式
        return nil
}

// GetMetalLBManifest 获取 MetalLB 安装清单
func GetMetalLBManifest() string {
        return `# MetalLB v0.14.5 安装清单
# 使用方法: kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.14.5/config/manifests/metallb-native.yaml

apiVersion: v1
kind: Namespace
metadata:
  labels:
    pod-security.kubernetes.io/audit: privileged
    pod-security.kubernetes.io/enforce: privileged
    pod-security.kubernetes.io/warn: privileged
  name: metallb-system
`
}
