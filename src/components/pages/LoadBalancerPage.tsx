"use client";

import { useState } from "react";
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
  ArrowUpDown,
  Network,
  Shield,
  Zap,
  Clock,
  TrendingUp,
  Loader2,
  AlertTriangle,
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

// Loading skeleton component
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page Header Skeleton */}
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
      
      {/* Metrics Cards Skeleton */}
      <div className="grid grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-4 w-4 bg-slate-700 rounded" />
              <div className="h-3 w-16 bg-slate-700 rounded" />
            </div>
            <div className="h-6 w-20 bg-slate-700 rounded" />
          </div>
        ))}
      </div>
      
      {/* Tabs Skeleton */}
      <div className="border-b border-slate-800">
        <div className="flex gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-28 bg-slate-800 rounded" />
          ))}
        </div>
      </div>
      
      {/* Content Skeleton */}
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-slate-700 rounded-lg" />
                <div>
                  <div className="h-5 w-32 bg-slate-700 rounded mb-1" />
                  <div className="h-3 w-24 bg-slate-700 rounded" />
                </div>
              </div>
              <div className="h-6 w-16 bg-slate-700 rounded" />
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[1, 2, 3].map((j) => (
                <div key={j}>
                  <div className="h-3 w-12 bg-slate-700 rounded mb-1" />
                  <div className="h-4 w-20 bg-slate-700 rounded" />
                </div>
              ))}
            </div>
            <div className="h-px bg-slate-800 my-4" />
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <div className="h-5 w-16 bg-slate-700 rounded" />
                <div className="h-5 w-20 bg-slate-700 rounded" />
              </div>
              <div className="h-8 w-24 bg-slate-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Error state component
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Scale className="text-sky-400 h-7 w-7" />
            负载均衡器
          </h1>
          <p className="text-slate-400 text-sm mt-1">管理集群负载均衡器，配置流量分发和健康检查</p>
        </div>
        <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          重试
        </Button>
      </div>
      
      {/* Error Card */}
      <div className="glass-card p-12 text-center">
        <AlertTriangle className="h-16 w-16 mx-auto text-amber-500 mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">无法加载负载均衡器数据</h3>
        <p className="text-slate-400 mb-4">{error}</p>
        <Button className="bg-sky-500 hover:bg-sky-600" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          重新加载
        </Button>
      </div>
    </div>
  );
}

// Backend servers mock data (would come from endpoints in real scenario)
const backendServers = [
  { id: 1, name: "web-01", ip: "10.0.1.101", port: 8080, status: "healthy", weight: 100, connections: 245, latency: "12ms" },
  { id: 2, name: "web-02", ip: "10.0.1.102", port: 8080, status: "healthy", weight: 100, connections: 198, latency: "15ms" },
  { id: 3, name: "web-03", ip: "10.0.1.103", port: 8080, status: "healthy", weight: 100, connections: 256, latency: "11ms" },
  { id: 4, name: "web-04", ip: "10.0.1.104", port: 8080, status: "unhealthy", weight: 0, connections: 0, latency: "-" },
  { id: 5, name: "web-05", ip: "10.0.1.105", port: 8080, status: "healthy", weight: 100, connections: 178, latency: "14ms" },
  { id: 6, name: "web-06", ip: "10.0.1.106", port: 8080, status: "healthy", weight: 100, connections: 201, latency: "13ms" },
];

// Mock metrics data
const lbMetrics = {
  totalRequests: "12.5M",
  activeConnections: 1078,
  bandwidth: "2.4 Gbps",
  avgLatency: "13ms",
  sslHandshakes: "892K",
  errorRate: "0.02%",
};

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
  const [selectedLB, setSelectedLB] = useState<K8sService | null>(null);

  // Fetch real K8s Services data
  const { data: services, isLoading, error, refetch } = useServices();

  // Show loading skeleton
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Show error state
  if (error) {
    return <ErrorState error={error.message || "未知错误"} onRetry={() => refetch()} />;
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Scale className="text-sky-400 h-7 w-7" />
            负载均衡器
          </h1>
          <p className="text-slate-400 text-sm mt-1">管理集群负载均衡器，配置流量分发和健康检查</p>
        </div>
        <div className="flex gap-3">
          <Button className="bg-sky-500 hover:bg-sky-600 text-white" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            创建负载均衡
          </Button>
          <Button 
            variant="outline" 
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新状态
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-6 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-sky-400" />
            <p className="text-xs text-slate-400">总请求数</p>
          </div>
          <p className="text-xl font-bold text-white">{lbMetrics.totalRequests}</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Network className="h-4 w-4 text-purple-400" />
            <p className="text-xs text-slate-400">活跃连接</p>
          </div>
          <p className="text-xl font-bold text-white">{lbMetrics.activeConnections}</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-amber-400" />
            <p className="text-xs text-slate-400">带宽</p>
          </div>
          <p className="text-xl font-bold text-white">{lbMetrics.bandwidth}</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-green-400" />
            <p className="text-xs text-slate-400">平均延迟</p>
          </div>
          <p className="text-xl font-bold text-white">{lbMetrics.avgLatency}</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-cyan-400" />
            <p className="text-xs text-slate-400">SSL 握手</p>
          </div>
          <p className="text-xl font-bold text-white">{lbMetrics.sslHandshakes}</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-rose-400" />
            <p className="text-xs text-slate-400">错误率</p>
          </div>
          <p className="text-xl font-bold text-white">{lbMetrics.errorRate}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex gap-6">
          {[
            { id: "overview", label: "负载均衡器", icon: Scale },
            { id: "backends", label: "后端服务器", icon: Server },
            { id: "monitoring", label: "监控面板", icon: Activity },
            { id: "ssl", label: "SSL 证书", icon: Shield },
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
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
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
            <div className="grid grid-cols-2 gap-4">
              {filteredLBs.map((lb) => (
                <div key={`${lb.namespace}-${lb.name}`} className="glass-card p-5 hover:border-sky-500/50 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/10">
                        <Scale className="h-5 w-5 text-amber-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white">{lb.name}</h3>
                          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                            LoadBalancer
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 font-mono">{lb.clusterIP}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                        健康
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                          <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800">
                            <Eye className="h-4 w-4 mr-2" /> 查看详情
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800">
                            <Edit className="h-4 w-4 mr-2" /> 编辑配置
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800">
                            <Settings className="h-4 w-4 mr-2" /> 健康检查
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-rose-400 focus:bg-slate-800">
                            <Trash2 className="h-4 w-4 mr-2" /> 删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-slate-500 text-xs">外部 IP</p>
                      <p className="text-white font-mono text-xs">{lb.externalIP || "Pending"}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">命名空间</p>
                      <p className="text-white">{lb.namespace}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">创建时间</p>
                      <p className="text-white">{formatAge(lb.createdAt)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <div className="flex items-center gap-2 flex-wrap">
                      {lb.ports && lb.ports.length > 0 ? (
                        lb.ports.map((port, idx) => (
                          <Badge key={idx} className="bg-slate-700 text-slate-300">
                            {port.port}/{port.protocol}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-slate-500 text-xs">无端口</span>
                      )}
                      {lb.selector && Object.keys(lb.selector).length > 0 && (
                        <Badge className="bg-sky-500/10 text-sky-400 border-sky-500/20">
                          <Globe className="h-3 w-3 mr-1" /> Selector
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-sky-400 hover:text-sky-300"
                      onClick={() => setSelectedLB(lb)}
                    >
                      查看后端 <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <Scale className="h-16 w-16 mx-auto text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">没有找到 LoadBalancer 类型的服务</h3>
              <p className="text-slate-400 mb-4">
                {searchQuery ? "尝试修改搜索条件" : "创建一个 LoadBalancer 类型的 Service 来使用负载均衡功能"}
              </p>
              <Button className="bg-sky-500 hover:bg-sky-600" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                创建负载均衡
              </Button>
            </div>
          )}
        </div>
      )}

      {activeTab === "backends" && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">后端服务器池</h3>
            <Button size="sm" className="bg-sky-500 hover:bg-sky-600">
              <Plus className="h-4 w-4 mr-2" /> 添加后端
            </Button>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">服务器</th>
                <th className="px-6 py-4 font-medium">IP:端口</th>
                <th className="px-6 py-4 font-medium">状态</th>
                <th className="px-6 py-4 font-medium">权重</th>
                <th className="px-6 py-4 font-medium">连接数</th>
                <th className="px-6 py-4 font-medium">延迟</th>
                <th className="px-6 py-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {backendServers.map((server) => (
                <tr key={server.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-sky-400" />
                      <span className="font-semibold text-white">{server.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-400 text-xs">
                    {server.ip}:{server.port}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          server.status === "healthy" ? "bg-green-500 status-pulse" : "bg-rose-500"
                        }`}
                      />
                      <Badge
                        className={`${
                          server.status === "healthy"
                            ? "bg-green-500/10 text-green-400 border-green-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {server.status === "healthy" ? "健康" : "故障"}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-white">{server.weight}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-400">{server.connections}</td>
                  <td className="px-6 py-4 text-slate-400">{server.latency}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                        <ArrowUpDown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "monitoring" && (
        <div className="grid grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">流量趋势</h3>
            <div className="h-64 flex items-center justify-center text-slate-500">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>流量监控图表</p>
                <p className="text-xs">(需要集成 Prometheus)</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">响应时间分布</h3>
            <div className="h-64 flex items-center justify-center text-slate-500">
              <div className="text-center">
                <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>延迟分布图表</p>
                <p className="text-xs">(需要集成 Grafana)</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">健康检查日志</h3>
            <div className="space-y-2 max-h-48 overflow-auto">
              {[
                { time: "14:30:05", target: "web-01:8080", result: "PASS", latency: "12ms" },
                { time: "14:30:05", target: "web-02:8080", result: "PASS", latency: "15ms" },
                { time: "14:30:05", target: "web-04:8080", result: "FAIL", latency: "timeout" },
                { time: "14:30:00", target: "web-03:8080", result: "PASS", latency: "11ms" },
              ].map((log, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs p-2 bg-slate-800/50 rounded">
                  <span className="text-slate-500">{log.time}</span>
                  <span className="font-mono text-slate-400">{log.target}</span>
                  <span className={log.result === "PASS" ? "text-green-400" : "text-rose-400"}>
                    {log.result}
                  </span>
                  <span className="text-slate-400">{log.latency}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">调度算法分布</h3>
            <div className="space-y-3">
              {[
                { name: "Round Robin", count: 2, percentage: 50 },
                { name: "Least Connections", count: 1, percentage: 25 },
                { name: "Source IP Hash", count: 1, percentage: 25 },
              ].map((algo, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-white">{algo.name}</span>
                    <span className="text-slate-400">{algo.count} 个</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500"
                      style={{ width: `${algo.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "ssl" && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">SSL/TLS 证书管理</h3>
            <Button size="sm" className="bg-sky-500 hover:bg-sky-600">
              <Plus className="h-4 w-4 mr-2" /> 上传证书
            </Button>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">域名</th>
                <th className="px-6 py-4 font-medium">颁发机构</th>
                <th className="px-6 py-4 font-medium">有效期</th>
                <th className="px-6 py-4 font-medium">状态</th>
                <th className="px-6 py-4 font-medium">关联 LB</th>
                <th className="px-6 py-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {[
                { domain: "*.example.com", issuer: "Let's Encrypt", expires: "2024-03-15", status: "valid", lb: "web-lb-prod" },
                { domain: "api.example.com", issuer: "DigiCert", expires: "2024-06-20", status: "valid", lb: "api-lb-prod" },
                { domain: "*.internal.com", issuer: "Self-signed", expires: "2025-01-01", status: "valid", lb: "-" },
              ].map((cert, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 font-mono text-sky-400">{cert.domain}</td>
                  <td className="px-6 py-4 text-slate-400">{cert.issuer}</td>
                  <td className="px-6 py-4 text-slate-400">{cert.expires}</td>
                  <td className="px-6 py-4">
                    <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                      有效
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-slate-400">{cert.lb}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create LB Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Scale className="h-5 w-5 text-sky-400" />
              创建负载均衡器
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              配置新的负载均衡器实例
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">名称</label>
                <Input placeholder="my-lb" className="bg-slate-800 border-slate-700" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">命名空间</label>
                <Input placeholder="default" className="bg-slate-800 border-slate-700" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">类型</label>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="border-sky-500 text-sky-400 bg-sky-500/10">
                  Layer 7 (HTTP/HTTPS)
                </Button>
                <Button variant="outline" className="border-slate-700 text-slate-400">
                  Layer 4 (TCP/UDP)
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">调度算法</label>
                <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                  <option>Round Robin</option>
                  <option>Least Connections</option>
                  <option>Source IP Hash</option>
                  <option>Weighted Round Robin</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">监听端口</label>
                <Input placeholder="80, 443" className="bg-slate-800 border-slate-700" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">后端服务选择器</label>
              <Input placeholder="app=web" className="bg-slate-800 border-slate-700" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="ssl-enabled" className="rounded border-slate-700" />
              <label htmlFor="ssl-enabled" className="text-sm text-slate-400">
                启用 SSL/TLS 终止
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="border-slate-700 text-slate-300">
              取消
            </Button>
            <Button className="bg-sky-500 hover:bg-sky-600" onClick={() => setShowCreateDialog(false)}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
