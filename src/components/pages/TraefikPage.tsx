"use client";

import { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Globe,
  Search,
  Plus,
  RefreshCw,
  ExternalLink,
  Shield,
  Server,
  Activity,
  Zap,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Download,
  Play,
  Settings,
  Route,
  Layers,
} from "lucide-react";
import { useIngresses } from "@/hooks/use-k8s";
import { useToast } from "@/hooks/use-toast";

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

// Traefik API types
interface TraefikStatus {
  installed: boolean;
  namespace: string;
  version: string;
  dashboard: string;
  replicas: number;
  readyReplicas: number;
}

interface IngressRoute {
  name: string;
  namespace: string;
  entryPoints: string[];
  routes: Array<{
    match: string;
    kind: string;
    services: string[];
  }>;
  tls?: boolean;
  createdAt: string;
}

// Loading skeleton component
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-slate-800 rounded" />
        <div className="flex gap-3">
          <div className="h-10 w-28 bg-slate-800 rounded" />
          <div className="h-10 w-32 bg-slate-800 rounded" />
        </div>
      </div>
      <div className="glass-card p-8 h-48 bg-slate-800/50" />
    </div>
  );
}

// Traefik installation YAML
const TRAEFIK_INSTALL_YAML = `# Traefik v3.x Installation
apiVersion: v1
kind: Namespace
metadata:
  name: traefik
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: traefik
  namespace: traefik
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: traefik
rules:
  - apiGroups:
      - ""
    resources:
      - services
      - endpoints
      - secrets
    verbs:
      - get
      - list
      - watch
  - apiGroups:
      - extensions
      - networking.k8s.io
    resources:
      - ingresses
      - ingressclasses
    verbs:
      - get
      - list
      - watch
  - apiGroups:
      - traefik.io
    resources:
      - ingressroutes
      - middlewares
      - tlsoptions
    verbs:
      - get
      - list
      - watch
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: traefik
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: traefik
subjects:
  - kind: ServiceAccount
    name: traefik
    namespace: traefik
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: traefik
  namespace: traefik
  labels:
    app: traefik
spec:
  replicas: 1
  selector:
    matchLabels:
      app: traefik
  template:
    metadata:
      labels:
        app: traefik
    spec:
      serviceAccountName: traefik
      containers:
        - name: traefik
          image: traefik:v3.2
          args:
            - --api.insecure=true
            - --providers.kubernetesingress=true
            - --providers.kubernetescrd=true
            - --entrypoints.web.address=:80
            - --entrypoints.websecure.address=:443
          ports:
            - name: web
              containerPort: 80
            - name: websecure
              containerPort: 443
            - name: dashboard
              containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: traefik
  namespace: traefik
spec:
  type: LoadBalancer
  selector:
    app: traefik
  ports:
    - name: web
      port: 80
      targetPort: 80
    - name: websecure
      port: 443
      targetPort: 443
    - name: dashboard
      port: 8080
      targetPort: 8080
`;

export default function TraefikPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showYamlDialog, setShowYamlDialog] = useState(false);
  const [createType, setCreateType] = useState<"ingressRoute" | "middleware">("ingressRoute");

  // Traefik state
  const [traefikStatus, setTraefikStatus] = useState<TraefikStatus | null>(null);
  const [ingressRoutes, setIngressRoutes] = useState<IngressRoute[]>([]);
  const [traefikLoading, setTraefikLoading] = useState(true);
  const [installing, setInstalling] = useState(false);

  // Create form state
  const [newRouteName, setNewRouteName] = useState("");
  const [newRouteMatch, setNewRouteMatch] = useState("");
  const [newRouteService, setNewRouteService] = useState("");

  // Fetch real K8s Services data for reference
  const { isLoading: ingressesLoading, refetch } = useIngresses();

  // Fetch Traefik status
  const fetchTraefikStatus = async () => {
    setTraefikLoading(true);
    try {
      const response = await fetch('/api/traefik/status?XTransformPort=8080');
      if (response.ok) {
        const data = await response.json();
        setTraefikStatus(data);
      } else {
        setTraefikStatus(null);
      }
    } catch {
      setTraefikStatus(null);
    }
    setTraefikLoading(false);
  };

  // Fetch IngressRoutes
  const fetchIngressRoutes = async () => {
    try {
      const response = await fetch('/api/traefik/ingressroutes?XTransformPort=8080');
      if (response.ok) {
        const data = await response.json();
        setIngressRoutes(data || []);
      }
    } catch {
      setIngressRoutes([]);
    }
  };

  // Install Traefik
  const installTraefik = async () => {
    setInstalling(true);
    try {
      const response = await fetch('/api/traefik/install?XTransformPort=8080', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (response.ok) {
        toast({
          title: "安装成功",
          description: "Traefik 已成功安装到集群",
        });
        fetchTraefikStatus();
      } else {
        toast({
          variant: "destructive",
          title: "安装失败",
          description: data.error || "无法安装 Traefik，请检查集群连接",
        });
      }
    } catch (e) {
      console.error('Failed to install Traefik:', e);
      toast({
        variant: "destructive",
        title: "安装失败",
        description: "网络错误，无法连接到后端服务",
      });
    }
    setInstalling(false);
  };

  useEffect(() => {
    const loadData = async () => {
      setTraefikLoading(true);
      try {
        const [statusRes, routesRes] = await Promise.all([
          fetch('/api/traefik/status?XTransformPort=8080'),
          fetch('/api/traefik/ingressroutes?XTransformPort=8080'),
        ]);
        
        if (statusRes.ok) {
          const data = await statusRes.json();
          setTraefikStatus(data);
        } else {
          setTraefikStatus(null);
        }
        
        if (routesRes.ok) {
          const data = await routesRes.json();
          setIngressRoutes(data || []);
        }
      } catch {
        setTraefikStatus(null);
        setIngressRoutes([]);
      }
      setTraefikLoading(false);
    };
    
    loadData();
  }, []);

  const handleRefresh = () => {
    refetch();
    fetchTraefikStatus();
    fetchIngressRoutes();
  };

  if (traefikLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Globe className="text-cyan-400 h-7 w-7" />
            Traefik Ingress Controller
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            现代的 HTTP 反向代理和负载均衡器
          </p>
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
          {!traefikStatus?.installed ? (
            <Button className="bg-cyan-500 hover:bg-cyan-600 text-white" onClick={installTraefik} disabled={installing}>
              {installing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  安装中...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  安装 Traefik
                </>
              )}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => window.open(traefikStatus.dashboard || 'http://localhost:8080/dashboard/', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                打开 Dashboard
              </Button>
              <Button className="bg-cyan-500 hover:bg-cyan-600 text-white" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                创建路由
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Traefik Status Card */}
      {traefikStatus?.installed && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-cyan-500/10 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Traefik 已安装</h3>
                <p className="text-sm text-slate-400">
                  版本: {traefikStatus.version || "v3.2"} | 
                  命名空间: {traefikStatus.namespace || "traefik"}
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{ingressRoutes.length}</p>
                <p className="text-xs text-slate-400">IngressRoutes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-cyan-400">
                  {traefikStatus.readyReplicas}/{traefikStatus.replicas}
                </p>
                <p className="text-xs text-slate-400">Pods</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!traefikStatus?.installed && !traefikLoading && (
        <div className="glass-card p-8 text-center border-amber-500/30">
          <AlertTriangle className="h-12 w-12 mx-auto text-amber-400 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Traefik 未安装</h3>
          <p className="text-slate-400 text-sm mb-4">
            Traefik 是一个开源的现代 HTTP 反向代理和负载均衡器，可以自动发现服务并动态配置路由。
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" className="border-slate-700 text-slate-300" onClick={() => setShowYamlDialog(true)}>
              <FileCode className="h-4 w-4 mr-2" />
              查看 YAML
            </Button>
            <Button className="bg-cyan-500 hover:bg-cyan-600" onClick={installTraefik} disabled={installing}>
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
            { id: "overview", label: "Ingress 路由", icon: Route, count: ingressRoutes.length },
            { id: "middlewares", label: "Middlewares", icon: Layers, count: 0 },
            { id: "tls", label: "TLS 配置", icon: Shield, count: 0 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-1 py-3 border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-cyan-500 text-cyan-400"
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

      {/* Tab Content - IngressRoutes */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="搜索路由..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-900 border-slate-700"
            />
          </div>

          {ingressRoutes.length > 0 ? (
            <div className="glass-card overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-medium">名称</th>
                    <th className="px-6 py-4 font-medium">命名空间</th>
                    <th className="px-6 py-4 font-medium">EntryPoints</th>
                    <th className="px-6 py-4 font-medium">路由规则</th>
                    <th className="px-6 py-4 font-medium">TLS</th>
                    <th className="px-6 py-4 font-medium">存活时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {ingressRoutes.map((route) => (
                    <tr key={`${route.namespace}-${route.name}`} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Route className="h-4 w-4 text-cyan-400" />
                          <span className="font-mono text-sky-400">{route.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className="bg-slate-700 text-slate-300">{route.namespace}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1 flex-wrap">
                          {route.entryPoints?.map((ep, i) => (
                            <Badge key={i} className="bg-cyan-500/10 text-cyan-400 text-xs">
                              {ep}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {route.routes?.slice(0, 2).map((r, i) => (
                            <div key={i} className="text-xs">
                              <code className="text-amber-400">{r.match}</code>
                              <span className="text-slate-500"> → </span>
                              <span className="text-green-400">{r.services?.join(", ")}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {route.tls ? (
                          <Badge className="bg-green-500/10 text-green-400 border-0">
                            <Shield className="h-3 w-3 mr-1" /> 启用
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-500/10 text-slate-400 border-0">未启用</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500">{formatAge(route.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <Route className="h-16 w-16 mx-auto text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">没有 IngressRoute</h3>
              <p className="text-slate-400">
                {traefikStatus?.installed 
                  ? "创建 IngressRoute 来配置高级路由规则"
                  : "请先安装 Traefik"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab Content - Middlewares */}
      {activeTab === "middlewares" && (
        <div className="glass-card p-12 text-center">
          <Layers className="h-16 w-16 mx-auto text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Middlewares 管理</h3>
          <p className="text-slate-400 text-sm">
            配置认证、限流、重定向等中间件
          </p>
        </div>
      )}

      {/* Tab Content - TLS */}
      {activeTab === "tls" && (
        <div className="glass-card p-12 text-center">
          <Shield className="h-16 w-16 mx-auto text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">TLS 配置</h3>
          <p className="text-slate-400 text-sm">
            管理 TLS 证书和选项
          </p>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-cyan-400" />
              {createType === "ingressRoute" && "创建 IngressRoute"}
              {createType === "middleware" && "创建 Middleware"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {createType === "ingressRoute" && "配置 Traefik IngressRoute 自定义路由"}
              {createType === "middleware" && "配置中间件处理请求"}
            </DialogDescription>
          </DialogHeader>

          {createType === "ingressRoute" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-slate-300">名称</Label>
                <Input
                  value={newRouteName}
                  onChange={(e) => setNewRouteName(e.target.value)}
                  placeholder="my-route"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">路由匹配规则</Label>
                <Input
                  value={newRouteMatch}
                  onChange={(e) => setNewRouteMatch(e.target.value)}
                  placeholder="Host(`example.com`) && PathPrefix(`/api`)"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">后端服务</Label>
                <Input
                  value={newRouteService}
                  onChange={(e) => setNewRouteService(e.target.value)}
                  placeholder="my-service@namespace:80"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="border-slate-700 text-slate-300">
              取消
            </Button>
            <Button className="bg-cyan-500 hover:bg-cyan-600" onClick={() => setShowCreateDialog(false)}>
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
              <FileCode className="h-5 w-5 text-cyan-400" />
              Traefik 安装 YAML
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              使用此清单安装 Traefik v3.x
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <pre className="text-xs text-slate-300 font-mono bg-slate-950 p-4 rounded-lg whitespace-pre-wrap">
              {TRAEFIK_INSTALL_YAML}
            </pre>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(TRAEFIK_INSTALL_YAML);
              }}
              className="border-slate-700 text-slate-300"
            >
              复制 YAML
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const blob = new Blob([TRAEFIK_INSTALL_YAML], { type: 'text/yaml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'traefik-install.yaml';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="border-slate-700 text-slate-300"
            >
              <Download className="h-4 w-4 mr-2" />
              下载
            </Button>
            <Button className="bg-cyan-500 hover:bg-cyan-600" onClick={() => { setShowYamlDialog(false); installTraefik(); }}>
              <Play className="h-4 w-4 mr-2" />
              一键安装
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
