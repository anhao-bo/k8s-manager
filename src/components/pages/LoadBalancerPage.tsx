"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Scale,
  Plus,
  Search,
  MoreVertical,
  RefreshCw,
  Trash2,
  Edit,
  Eye,
  Settings,
  Server,
  Globe,
  Activity,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Network,
  Shield,
  Zap,
  Clock,
  TrendingUp,
  Loader2,
  AlertTriangle,
  Download,
  Play,
  FileCode,
} from "lucide-react";
import { useServices } from "@/hooks/use-k8s";

// Format age from date string
function formatAge(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return "刚刚";
}

// MetalLB API types
interface MetalLBStatus {
  installed: boolean;
  namespace: string;
  version: string;
  speakerPods: number;
  speakerReady: number;
  webhookConfigured: boolean;
}

interface IPAddressPool {
  name: string;
  namespace: string;
  addresses: string[];
  autoAssign: boolean;
  createdAt: string;
}

interface L2Advertisement {
  name: string;
  namespace: string;
  ipAddressPools: string[];
  interfaces: string[];
  createdAt: string;
}

interface BGPAdvertisement {
  name: string;
  namespace: string;
  ipAddressPools: string[];
  peers: string[];
  createdAt: string;
}

// Loading skeleton component
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 bg-slate-800 rounded" />
          <div className="h-4 w-64 bg-slate-800 rounded mt-2" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-32 bg-slate-800 rounded" />
          <div className="h-10 w-28 bg-slate-800 rounded" />
        </div>
      </div>
      
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-4 w-4 bg-slate-700 rounded" />
              <div className="h-3 w-16 bg-slate-700 rounded" />
            </div>
            <div className="h-6 w-20 bg-slate-700 rounded" />
          </div>
        ))}
      </div>
      
      <div className="border-b border-slate-800">
        <div className="flex gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-28 bg-slate-800 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

// MetalLB Install YAML
const METALLB_INSTALL_YAML = `# MetalLB Installation
apiVersion: v1
kind: Namespace
metadata:
  labels:
    pod-security.kubernetes.io/audit: privileged
    pod-security.kubernetes.io/enforce: privileged
    pod-security.kubernetes.io/warn: privileged
  name: metallb-system
---
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  annotations:
    controller-gen.kubebuilder.io/version: v0.14.0
  name: bfdprofiles.metallb.io
spec:
  group: metallb.io
  names:
    kind: BFDProfile
    listKind: BFDProfileList
    plural: bfdprofiles
    singular: bfdprofile
  scope: Namespaced
  versions:
  - additionalPrinterColumns:
    - jsonPath: .spec.passiveMode
      name: Passive Mode
      type: boolean
    name: v1beta1
    schema:
      openAPIV3Schema:
        properties:
          apiVersion:
            type: string
          kind:
            type: string
          metadata:
            type: object
          spec:
            properties:
              detectMultiplier:
                type: integer
              echoInterval:
                type: integer
              echoMode:
                type: boolean
              minimumTtl:
                type: integer
              passiveMode:
                type: boolean
              receiveInterval:
                type: integer
              transmitInterval:
                type: integer
            type: object
          status:
            type: object
        required:
        - spec
        type: object
    served: true
    storage: true
    subresources:
      status: {}
`;

// K8s Service type
interface K8sService {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIP: string;
  ports: Array<{ name: string; port: number; targetPort: string; protocol: string }>;
  selector: Record<string, string>;
  createdAt: string;
}

export default function LoadBalancerPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showYamlDialog, setShowYamlDialog] = useState(false);
  const [selectedLB, setSelectedLB] = useState<K8sService | null>(null);
  const [createType, setCreateType] = useState<"ipPool" | "l2" | "bgp">("ipPool");

  // MetalLB state
  const [metallbStatus, setMetallbStatus] = useState<MetalLBStatus | null>(null);
  const [ipPools, setIpPools] = useState<IPAddressPool[]>([]);
  const [l2Ads, setL2Ads] = useState<L2Advertisement[]>([]);
  const [bgpAds, setBgpAds] = useState<BGPAdvertisement[]>([]);
  const [metallbLoading, setMetallbLoading] = useState(true);
  const [installing, setInstalling] = useState(false);

  // Create form state
  const [newPoolName, setNewPoolName] = useState("");
  const [newPoolAddresses, setNewPoolAddresses] = useState("");
  const [newL2Name, setNewL2Name] = useState("");
  const [newL2Interfaces, setNewL2Interfaces] = useState("");

  // Fetch real K8s Services data
  const { data: services, isLoading, error, refetch } = useServices();

  // Fetch all MetalLB data
  const fetchAllMetalLBData = async () => {
    setMetallbLoading(true);
    try {
      const [statusRes, poolsRes, l2Res, bgpRes] = await Promise.all([
        fetch('/api/metallb/status?XTransformPort=8081'),
        fetch('/api/metallb/ippools?XTransformPort=8081'),
        fetch('/api/metallb/l2advertisements?XTransformPort=8081'),
        fetch('/api/metallb/bgpadvertisements?XTransformPort=8081'),
      ]);
      
      if (statusRes.ok) {
        const data = await statusRes.json();
        setMetallbStatus(data);
      } else {
        setMetallbStatus(null);
      }
      
      if (poolsRes.ok) {
        const data = await poolsRes.json();
        setIpPools(data || []);
      }
      
      if (l2Res.ok) {
        const data = await l2Res.json();
        setL2Ads(data || []);
      }
      
      if (bgpRes.ok) {
        const data = await bgpRes.json();
        setBgpAds(data || []);
      }
    } catch {
      setMetallbStatus(null);
      setIpPools([]);
      setL2Ads([]);
      setBgpAds([]);
    }
    setMetallbLoading(false);
  };

  // Install MetalLB
  const installMetalLB = async () => {
    setInstalling(true);
    try {
      const response = await fetch('/api/metallb/install?XTransformPort=8081', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        fetchAllMetalLBData();
      }
    } catch (e) {
      console.error('Failed to install MetalLB:', e);
    }
    setInstalling(false);
  };

  // Create IP Pool
  const createIPPool = async () => {
    try {
      const response = await fetch('/api/metallb/ippools?XTransformPort=8081', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPoolName,
          addresses: newPoolAddresses.split(',').map(a => a.trim())
        })
      });
      if (response.ok) {
        fetchAllMetalLBData();
        setShowCreateDialog(false);
        setNewPoolName("");
        setNewPoolAddresses("");
      }
    } catch (e) {
      console.error('Failed to create IP pool:', e);
    }
  };

  // Create L2 Advertisement
  const createL2Ad = async () => {
    try {
      const response = await fetch('/api/metallb/l2advertisements?XTransformPort=8081', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newL2Name,
          interfaces: newL2Interfaces.split(',').map(i => i.trim()).filter(i => i)
        })
      });
      if (response.ok) {
        fetchAllMetalLBData();
        setShowCreateDialog(false);
        setNewL2Name("");
        setNewL2Interfaces("");
      }
    } catch (e) {
      console.error('Failed to create L2 advertisement:', e);
    }
  };

  // Delete IP Pool
  const deleteIPPool = async (name: string) => {
    try {
      const response = await fetch(`/api/metallb/ippools/${name}?XTransformPort=8081`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchAllMetalLBData();
      }
    } catch (e) {
      console.error('Failed to delete IP pool:', e);
    }
  };

  // Delete L2 Advertisement
  const deleteL2Ad = async (name: string) => {
    try {
      const response = await fetch(`/api/metallb/l2advertisements/${name}?XTransformPort=8081`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchAllMetalLBData();
      }
    } catch (e) {
      console.error('Failed to delete L2 advertisement:', e);
    }
  };

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setMetallbLoading(true);
      try {
        const [statusRes, poolsRes, l2Res, bgpRes] = await Promise.all([
          fetch('/api/metallb/status?XTransformPort=8081'),
          fetch('/api/metallb/ippools?XTransformPort=8081'),
          fetch('/api/metallb/l2advertisements?XTransformPort=8081'),
          fetch('/api/metallb/bgpadvertisements?XTransformPort=8081'),
        ]);
        
        if (statusRes.ok) {
          const data = await statusRes.json();
          setMetallbStatus(data);
        } else {
          setMetallbStatus(null);
        }
        
        if (poolsRes.ok) {
          const data = await poolsRes.json();
          setIpPools(data || []);
        }
        
        if (l2Res.ok) {
          const data = await l2Res.json();
          setL2Ads(data || []);
        }
        
        if (bgpRes.ok) {
          const data = await bgpRes.json();
          setBgpAds(data || []);
        }
      } catch {
        setMetallbStatus(null);
        setIpPools([]);
        setL2Ads([]);
        setBgpAds([]);
      }
      setMetallbLoading(false);
    };
    
    loadData();
  }, []);

  // Show loading skeleton
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Ensure services is an array
  const servicesList = Array.isArray(services) ? services : [];

  // Filter only LoadBalancer type services
  const loadBalancers = servicesList.filter((s) => s.type === "LoadBalancer");

  // Filter by search query
  const filteredLBs = loadBalancers.filter(
    (lb) =>
      lb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lb.namespace.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRefresh = () => {
    refetch();
    fetchAllMetalLBData();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Scale className="text-sky-400 h-7 w-7" />
            负载均衡器
          </h1>
          <p className="text-slate-400 text-sm mt-1">管理集群负载均衡器，基于 MetalLB 提供外部 IP 分配</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新状态
          </Button>
          {!metallbStatus?.installed ? (
            <Button className="bg-sky-500 hover:bg-sky-600 text-white" onClick={installMetalLB} disabled={installing}>
              {installing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  安装中...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  安装 MetalLB
                </>
              )}
            </Button>
          ) : (
            <Button className="bg-sky-500 hover:bg-sky-600 text-white" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              创建资源
            </Button>
          )}
        </div>
      </div>

      {/* MetalLB Status Card */}
      {metallbStatus?.installed && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">MetalLB 已安装</h3>
                <p className="text-sm text-slate-400">
                  版本: {metallbStatus.version || "v0.14.5"} | 
                  Speaker Pods: {metallbStatus.speakerReady}/{metallbStatus.speakerPods}
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{ipPools.length}</p>
                <p className="text-xs text-slate-400">IP 地址池</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{l2Ads.length}</p>
                <p className="text-xs text-slate-400">L2 广告</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{bgpAds.length}</p>
                <p className="text-xs text-slate-400">BGP 广告</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-400">{loadBalancers.length}</p>
                <p className="text-xs text-slate-400">LB 服务</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!metallbStatus?.installed && !metallbLoading && (
        <div className="glass-card p-8 text-center border-amber-500/30">
          <AlertTriangle className="h-12 w-12 mx-auto text-amber-400 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">MetalLB 未安装</h3>
          <p className="text-slate-400 text-sm mb-4">
            MetalLB 是 Kubernetes 的负载均衡器实现，使用标准路由协议 (Layer 2/BGP) 为服务分配外部 IP。
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" className="border-slate-700 text-slate-300" onClick={() => setShowYamlDialog(true)}>
              <FileCode className="h-4 w-4 mr-2" />
              查看 YAML
            </Button>
            <Button className="bg-sky-500 hover:bg-sky-600" onClick={installMetalLB} disabled={installing}>
              {installing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  安装中...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  一键安装
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex gap-6">
          {[
            { id: "overview", label: "负载均衡服务", icon: Scale, count: loadBalancers.length },
            { id: "ippools", label: "IP 地址池", icon: Network, count: ipPools.length },
            { id: "l2", label: "Layer 2 模式", icon: Zap, count: l2Ads.length },
            { id: "bgp", label: "BGP 模式", icon: Globe, count: bgpAds.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-1 py-3 border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-sky-500 text-sky-400"
                  : "border-transparent text-slate-400 hover:text-slate-300"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              <span className="text-xs text-slate-500">({tab.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content - LoadBalancer Services */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="搜索负载均衡器..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-900 border-slate-700"
            />
          </div>

          {filteredLBs.length > 0 ? (
            <div className="glass-card overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-medium">名称</th>
                    <th className="px-6 py-4 font-medium">命名空间</th>
                    <th className="px-6 py-4 font-medium">类型</th>
                    <th className="px-6 py-4 font-medium">ClusterIP</th>
                    <th className="px-6 py-4 font-medium">外部 IP</th>
                    <th className="px-6 py-4 font-medium">端口</th>
                    <th className="px-6 py-4 font-medium">存活时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredLBs.map((lb) => (
                    <tr key={`${lb.namespace}-${lb.name}`} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Scale className="h-4 w-4 text-amber-400" />
                          <span className="font-mono text-sky-400">{lb.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className="bg-slate-700 text-slate-300">{lb.namespace}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                          LoadBalancer
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">{lb.clusterIP}</td>
                      <td className="px-6 py-4 font-mono text-xs text-green-400">{lb.externalIP || "Pending"}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1 flex-wrap">
                          {lb.ports && lb.ports.length > 0 ? (
                            lb.ports.map((p, i) => (
                              <Badge key={i} className="bg-slate-700 text-slate-300 text-xs">
                                {p.port}/{p.protocol}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{formatAge(lb.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <Scale className="h-16 w-16 mx-auto text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">没有 LoadBalancer 类型的服务</h3>
              <p className="text-slate-400 mb-4">
                {searchQuery ? "尝试修改搜索条件" : "创建一个 LoadBalancer 类型的 Service 来使用负载均衡功能"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab Content - IP Pools */}
      {activeTab === "ippools" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-slate-400 text-sm">管理 MetalLB 的 IP 地址池，用于分配给 LoadBalancer 服务</p>
            {metallbStatus?.installed && (
              <Button className="bg-sky-500 hover:bg-sky-600" onClick={() => { setCreateType("ipPool"); setShowCreateDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                创建 IP 池
              </Button>
            )}
          </div>

          {ipPools.length > 0 ? (
            <div className="glass-card overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-medium">名称</th>
                    <th className="px-6 py-4 font-medium">地址范围</th>
                    <th className="px-6 py-4 font-medium">自动分配</th>
                    <th className="px-6 py-4 font-medium">存活时间</th>
                    <th className="px-6 py-4 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {ipPools.map((pool) => (
                    <tr key={pool.name} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Network className="h-4 w-4 text-sky-400" />
                          <span className="font-mono text-sky-400">{pool.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1 flex-wrap">
                          {pool.addresses.map((addr, i) => (
                            <Badge key={i} className="bg-sky-500/10 text-sky-400 text-xs font-mono">
                              {addr}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={pool.autoAssign ? "bg-green-500/10 text-green-400" : "bg-slate-500/10 text-slate-400"}>
                          {pool.autoAssign ? "启用" : "禁用"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{formatAge(pool.createdAt)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-rose-400"
                            onClick={() => deleteIPPool(pool.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <Network className="h-16 w-16 mx-auto text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">没有 IP 地址池</h3>
              <p className="text-slate-400">创建 IP 地址池来为 LoadBalancer 服务分配外部 IP</p>
            </div>
          )}
        </div>
      )}

      {/* Tab Content - L2 Advertisements */}
      {activeTab === "l2" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-slate-400 text-sm">配置 Layer 2 模式的 IP 广告（适用于小型网络）</p>
            {metallbStatus?.installed && (
              <Button className="bg-sky-500 hover:bg-sky-600" onClick={() => { setCreateType("l2"); setShowCreateDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                创建 L2 广告
              </Button>
            )}
          </div>

          {l2Ads.length > 0 ? (
            <div className="glass-card overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-medium">名称</th>
                    <th className="px-6 py-4 font-medium">关联 IP 池</th>
                    <th className="px-6 py-4 font-medium">网络接口</th>
                    <th className="px-6 py-4 font-medium">存活时间</th>
                    <th className="px-6 py-4 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {l2Ads.map((ad) => (
                    <tr key={ad.name} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-amber-400" />
                          <span className="font-mono text-sky-400">{ad.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1 flex-wrap">
                          {ad.ipAddressPools?.map((pool, i) => (
                            <Badge key={i} className="bg-sky-500/10 text-sky-400 text-xs">
                              {pool}
                            </Badge>
                          )) || <span className="text-slate-500 text-xs">全部</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1 flex-wrap">
                          {ad.interfaces?.length > 0 ? (
                            ad.interfaces.map((iface, i) => (
                              <Badge key={i} className="bg-purple-500/10 text-purple-400 text-xs font-mono">
                                {iface}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-slate-500 text-xs">全部接口</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{formatAge(ad.createdAt)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-rose-400"
                            onClick={() => deleteL2Ad(ad.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <Zap className="h-16 w-16 mx-auto text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">没有 Layer 2 广告</h3>
              <p className="text-slate-400">Layer 2 模式使用 ARP/NDP 协议广播 IP 地址</p>
            </div>
          )}
        </div>
      )}

      {/* Tab Content - BGP Advertisements */}
      {activeTab === "bgp" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-slate-400 text-sm">配置 BGP 模式的 IP 广告（适用于大型网络）</p>
            {metallbStatus?.installed && (
              <Button className="bg-sky-500 hover:bg-sky-600" onClick={() => { setCreateType("bgp"); setShowCreateDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                创建 BGP 广告
              </Button>
            )}
          </div>

          {bgpAds.length > 0 ? (
            <div className="glass-card overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-medium">名称</th>
                    <th className="px-6 py-4 font-medium">关联 IP 池</th>
                    <th className="px-6 py-4 font-medium">BGP Peers</th>
                    <th className="px-6 py-4 font-medium">存活时间</th>
                    <th className="px-6 py-4 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {bgpAds.map((ad) => (
                    <tr key={ad.name} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-purple-400" />
                          <span className="font-mono text-sky-400">{ad.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1 flex-wrap">
                          {ad.ipAddressPools?.map((pool, i) => (
                            <Badge key={i} className="bg-sky-500/10 text-sky-400 text-xs">
                              {pool}
                            </Badge>
                          )) || <span className="text-slate-500 text-xs">全部</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1 flex-wrap">
                          {ad.peers?.length > 0 ? (
                            ad.peers.map((peer, i) => (
                              <Badge key={i} className="bg-purple-500/10 text-purple-400 text-xs">
                                {peer}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-slate-500 text-xs">全部 Peers</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{formatAge(ad.createdAt)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-400">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <Globe className="h-16 w-16 mx-auto text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">没有 BGP 广告</h3>
              <p className="text-slate-400">BGP 模式适用于数据中心环境，需要配置 BGP Peers</p>
            </div>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-sky-400" />
              {createType === "ipPool" && "创建 IP 地址池"}
              {createType === "l2" && "创建 Layer 2 广告"}
              {createType === "bgp" && "创建 BGP 广告"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {createType === "ipPool" && "配置 MetalLB 的 IP 地址池，用于分配给 LoadBalancer 服务"}
              {createType === "l2" && "配置 Layer 2 模式的 IP 广告"}
              {createType === "bgp" && "配置 BGP 模式的 IP 广告"}
            </DialogDescription>
          </DialogHeader>

          {createType === "ipPool" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-slate-300">名称</Label>
                <Input
                  value={newPoolName}
                  onChange={(e) => setNewPoolName(e.target.value)}
                  placeholder="my-ip-pool"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">地址范围 (逗号分隔)</Label>
                <Input
                  value={newPoolAddresses}
                  onChange={(e) => setNewPoolAddresses(e.target.value)}
                  placeholder="192.168.1.100-192.168.1.200 或 192.168.1.0/24"
                  className="bg-slate-800 border-slate-700"
                />
                <p className="text-xs text-slate-500">
                  支持格式: IP范围 (如 192.168.1.100-192.168.1.200) 或 CIDR (如 192.168.1.0/24)
                </p>
              </div>
            </div>
          )}

          {createType === "l2" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-slate-300">名称</Label>
                <Input
                  value={newL2Name}
                  onChange={(e) => setNewL2Name(e.target.value)}
                  placeholder="my-l2-advertisement"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">网络接口 (逗号分隔，可选)</Label>
                <Input
                  value={newL2Interfaces}
                  onChange={(e) => setNewL2Interfaces(e.target.value)}
                  placeholder="eth0, eth1"
                  className="bg-slate-800 border-slate-700"
                />
                <p className="text-xs text-slate-500">
                  留空则使用所有接口
                </p>
              </div>
            </div>
          )}

          {createType === "bgp" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-slate-300">名称</Label>
                <Input
                  placeholder="my-bgp-advertisement"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5" />
                  <p className="text-xs text-amber-400">
                    BGP 模式需要先配置 BGP Peers。请使用 YAML 编辑器创建 BGPPeer 资源。
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="border-slate-700 text-slate-300">
              取消
            </Button>
            <Button
              className="bg-sky-500 hover:bg-sky-600"
              onClick={() => {
                if (createType === "ipPool") createIPPool();
                else if (createType === "l2") createL2Ad();
                else setShowCreateDialog(false);
              }}
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* YAML Dialog */}
      <Dialog open={showYamlDialog} onOpenChange={setShowYamlDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileCode className="h-5 w-5 text-sky-400" />
              MetalLB 安装 YAML
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              以下是 MetalLB 的安装清单（已简化显示）
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <pre className="text-xs text-slate-300 font-mono bg-slate-950 p-4 rounded-lg whitespace-pre-wrap">
              {METALLB_INSTALL_YAML}
            </pre>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(METALLB_INSTALL_YAML);
              }}
              className="border-slate-700 text-slate-300"
            >
              复制 YAML
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const blob = new Blob([METALLB_INSTALL_YAML], { type: 'text/yaml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'metallb-install.yaml';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="border-slate-700 text-slate-300"
            >
              <Download className="h-4 w-4 mr-2" />
              下载
            </Button>
            <Button className="bg-sky-500 hover:bg-sky-600" onClick={() => { setShowYamlDialog(false); installMetalLB(); }}>
              <Play className="h-4 w-4 mr-2" />
              一键安装
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
