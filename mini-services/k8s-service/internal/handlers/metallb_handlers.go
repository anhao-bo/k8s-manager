package handlers

import (
        "net/http"

        "k8s-service/internal/k8s"
        "k8s-service/internal/models"

        "github.com/gin-gonic/gin"
)

// GetMetalLBStatus 获取 MetalLB 安装状态
func (h *Handler) GetMetalLBStatus(c *gin.Context) {
        if h.Client == nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   "Kubernetes client not initialized",
                })
                return
        }

        status, err := h.Client.GetMetalLBStatus()
        if err != nil {
                c.JSON(http.StatusOK, gin.H{
                        "installed": false,
                        "error":     err.Error(),
                })
                return
        }

        c.JSON(http.StatusOK, status)
}

// InstallMetalLB 安装 MetalLB
func (h *Handler) InstallMetalLB(c *gin.Context) {
        if h.Client == nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   "Kubernetes client not initialized",
                })
                return
        }

        err := h.Client.InstallMetalLB("")
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        c.JSON(http.StatusOK, gin.H{
                "success":  true,
                "message": "MetalLB installation initiated",
        })
}

// GetIPPools 获取 IP 地址池列表
func (h *Handler) GetIPPools(c *gin.Context) {
        if h.Client == nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   "Kubernetes client not initialized",
                })
                return
        }

        pools, err := h.Client.GetIPPools()
        if err != nil {
                // 如果 CRD 不存在，返回空数组
                c.JSON(http.StatusOK, []k8s.IPAddressPool{})
                return
        }

        c.JSON(http.StatusOK, pools)
}

// GetIPPool 获取单个 IP 地址池
func (h *Handler) GetIPPool(c *gin.Context) {
        if h.Client == nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   "Kubernetes client not initialized",
                })
                return
        }

        name := c.Param("name")
        if name == "" {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   "name is required",
                })
                return
        }

        pool, err := h.Client.GetIPPool(name)
        if err != nil {
                c.JSON(http.StatusNotFound, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        c.JSON(http.StatusOK, pool)
}

// CreateIPPool 创建 IP 地址池
func (h *Handler) CreateIPPool(c *gin.Context) {
        if h.Client == nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   "Kubernetes client not initialized",
                })
                return
        }

        var req struct {
                Name       string   `json:"name"`
                Addresses  []string `json:"addresses"`
                AutoAssign *bool    `json:"autoAssign,omitempty"`
        }

        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        pool, err := h.Client.CreateIPPool(req.Name, req.Addresses)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        c.JSON(http.StatusOK, pool)
}

// DeleteIPPool 删除 IP 地址池
func (h *Handler) DeleteIPPool(c *gin.Context) {
        if h.Client == nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   "Kubernetes client not initialized",
                })
                return
        }

        name := c.Param("name")
        if name == "" {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   "name is required",
                })
                return
        }

        err := h.Client.DeleteIPPool(name)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "IP pool deleted successfully",
        })
}

// GetL2Advertisements 获取 L2 广告列表
func (h *Handler) GetL2Advertisements(c *gin.Context) {
        if h.Client == nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   "Kubernetes client not initialized",
                })
                return
        }

        ads, err := h.Client.GetL2Advertisements()
        if err != nil {
                c.JSON(http.StatusOK, []k8s.L2Advertisement{})
                return
        }

        c.JSON(http.StatusOK, ads)
}

// CreateL2Advertisement 创建 L2 广告
func (h *Handler) CreateL2Advertisement(c *gin.Context) {
        if h.Client == nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   "Kubernetes client not initialized",
                })
                return
        }

        var req struct {
                Name           string   `json:"name"`
                IPAddressPools []string `json:"ipAddressPools,omitempty"`
                Interfaces     []string `json:"interfaces,omitempty"`
        }

        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        ad, err := h.Client.CreateL2Advertisement(req.Name, req.Interfaces, req.IPAddressPools)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        c.JSON(http.StatusOK, ad)
}

// DeleteL2Advertisement 删除 L2 广告
func (h *Handler) DeleteL2Advertisement(c *gin.Context) {
        if h.Client == nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   "Kubernetes client not initialized",
                })
                return
        }

        name := c.Param("name")
        if name == "" {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   "name is required",
                })
                return
        }

        err := h.Client.DeleteL2Advertisement(name)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "L2 advertisement deleted successfully",
        })
}

// GetBGPAdvertisements 获取 BGP 广告列表
func (h *Handler) GetBGPAdvertisements(c *gin.Context) {
        if h.Client == nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   "Kubernetes client not initialized",
                })
                return
        }

        ads, err := h.Client.GetBGPAdvertisements()
        if err != nil {
                c.JSON(http.StatusOK, []k8s.BGPAdvertisement{})
                return
        }

        c.JSON(http.StatusOK, ads)
}

// CreateBGPAdvertisement 创建 BGP 广告
func (h *Handler) CreateBGPAdvertisement(c *gin.Context) {
        if h.Client == nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   "Kubernetes client not initialized",
                })
                return
        }

        var req struct {
                Name           string   `json:"name"`
                IPAddressPools []string `json:"ipAddressPools,omitempty"`
                Peers          []string `json:"peers,omitempty"`
        }

        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        ad, err := h.Client.CreateBGPAdvertisement(req.Name, req.Peers, req.IPAddressPools)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        c.JSON(http.StatusOK, ad)
}

// DeleteBGPAdvertisement 删除 BGP 广告
func (h *Handler) DeleteBGPAdvertisement(c *gin.Context) {
        if h.Client == nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   "Kubernetes client not initialized",
                })
                return
        }

        name := c.Param("name")
        if name == "" {
                c.JSON(http.StatusBadRequest, models.ErrorResponse{
                        Success: false,
                        Error:   "name is required",
                })
                return
        }

        err := h.Client.DeleteBGPAdvertisement(name)
        if err != nil {
                c.JSON(http.StatusInternalServerError, models.ErrorResponse{
                        Success: false,
                        Error:   err.Error(),
                })
                return
        }

        c.JSON(http.StatusOK, models.APIResponse{
                Success: true,
                Message: "BGP advertisement deleted successfully",
        })
}
