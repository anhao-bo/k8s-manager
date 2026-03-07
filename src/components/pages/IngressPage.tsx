"use client";

import { useState } from "react";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Globe,
  Search,
  Plus,
  RefreshCw,
  ExternalLink,
  Shield,
  Clock,
  Server,
  Activity,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useIngresses } from "@/hooks/use-k8s";

// Format age from date
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

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-slate-800 rounded" />
        <div className="flex gap-4">
          <div className="h-10 w-24 bg-slate-800 rounded" />
          <div className="h-10 w-32 bg-slate-800 rounded" />
        </div>
      </div>
      <div className="grid gap-4 grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-slate-800 rounded-xl" />
        ))}
      </div>
      <div className="glass-card">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 border-b border-slate-800 flex items-center px-6">
            <div className="h-4 bg-slate-800 rounded w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function IngressPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Fetch real K8s data
  const { data: ingresses, isLoading, refetch, error } = useIngresses();

  // Ensure data is array
  const ingressList = Array.isArray(ingresses) ? ingresses : [];

  // Filter by search term
  const filteredIngress = ingressList.filter(
    (ing) => 
      ing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ing.namespace.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ing.hosts?.some(h => h.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const tlsCount = ingressList.filter(i => i.tls).length;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Globe className="text-sky-400 h-7 w-7" />
            Ingress 路由管理
          </h1>
          <p className="text-slate-400 text-sm mt-1">管理集群的 HTTP/HTTPS 路由规则</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="border-slate-700 text-slate-300"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-2" /> 刷新
          </Button>
          <Button className="bg-sky-500 hover:bg-sky-600 text-white" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" /> 创建 Ingress
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 rounded-lg">
              <Globe className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{ingressList.length}</p>
              <p className="text-xs text-slate-400">Ingress 规则</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Shield className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{tlsCount}</p>
              <p className="text-xs text-slate-400">TLS 启用</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Server className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {new Set(ingressList.flatMap(i => i.hosts || [])).size}
              </p>
              <p className="text-xs text-slate-400">域名数</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Activity className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {ingressList.reduce((acc, i) => acc + (i.paths?.length || 0), 0)}
              </p>
              <p className="text-xs text-slate-400">路由规则</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="glass-card p-4 border-rose-500/50 bg-rose-500/10">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">无法加载 Ingress 数据，请检查集群连接</span>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          placeholder="搜索 Ingress..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-slate-900 border-slate-700"
        />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {filteredIngress.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">名称</th>
                <th className="px-6 py-4 font-medium">命名空间</th>
                <th className="px-6 py-4 font-medium">域名</th>
                <th className="px-6 py-4 font-medium">路径</th>
                <th className="px-6 py-4 font-medium">Ingress Class</th>
                <th className="px-6 py-4 font-medium">TLS</th>
                <th className="px-6 py-4 font-medium">存活时间</th>
                <th className="px-6 py-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredIngress.map((ingress) => (
                <tr key={`${ingress.namespace}-${ingress.name}`} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-sky-400" />
                      <span className="font-mono text-sky-400">{ingress.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge className="bg-slate-700 text-slate-300">{ingress.namespace}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {ingress.hosts && ingress.hosts.length > 0 ? (
                        ingress.hosts.slice(0, 2).map((host, i) => (
                          <a
                            key={i}
                            href={`https://${host}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-400 hover:text-sky-300 flex items-center gap-1 text-xs"
                          >
                            {host}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ))
                      ) : (
                        <span className="text-slate-500 text-xs">-</span>
                      )}
                      {ingress.hosts && ingress.hosts.length > 2 && (
                        <span className="text-slate-500 text-xs">+{ingress.hosts.length - 2} 更多</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {ingress.paths && ingress.paths.length > 0 ? (
                        ingress.paths.slice(0, 3).map((path, i) => (
                          <Badge key={i} className="bg-slate-700 text-slate-300 text-[10px]">
                            {path.path || "/"}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-slate-500 text-xs">-</span>
                      )}
                      {ingress.paths && ingress.paths.length > 3 && (
                        <Badge className="bg-slate-600 text-slate-400 text-[10px]">
                          +{ingress.paths.length - 3}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-slate-400 text-xs">{ingress.className || "-"}</span>
                  </td>
                  <td className="px-6 py-4">
                    {ingress.tls ? (
                      <Badge className="bg-green-500/10 text-green-400 border-0">
                        <Shield className="h-3 w-3 mr-1" /> 启用
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-500/10 text-slate-400 border-0">未启用</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500">{formatAge(ingress.createdAt)}</td>
                  <td className="px-6 py-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                        <DropdownMenuLabel className="text-slate-400">操作</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-slate-700" />
                        <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800">
                          <Eye className="h-4 w-4 mr-2" /> 查看详情
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800">
                          <Edit className="h-4 w-4 mr-2" /> 编辑
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-700" />
                        <DropdownMenuItem className="text-rose-500 focus:bg-rose-500/10">
                          <Trash2 className="h-4 w-4 mr-2" /> 删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center">
            <Globe className="h-12 w-12 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 text-sm">
              {error ? "无法加载 Ingress 数据" : "没有找到 Ingress 规则"}
            </p>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">创建 Ingress</DialogTitle>
            <DialogDescription className="text-slate-400">
              配置新的 HTTP/HTTPS 路由规则
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">名称</Label>
                <Input placeholder="my-ingress" className="bg-slate-800 border-slate-700" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">命名空间</Label>
                <Input placeholder="default" className="bg-slate-800 border-slate-700" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">域名</Label>
              <Input placeholder="api.example.com" className="bg-slate-800 border-slate-700" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">后端服务</Label>
                <Input placeholder="my-service" className="bg-slate-800 border-slate-700" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">端口</Label>
                <Input placeholder="80" className="bg-slate-800 border-slate-700" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">路径</Label>
              <Input placeholder="/api" className="bg-slate-800 border-slate-700" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="tls" className="rounded border-slate-700 bg-slate-800" />
              <label htmlFor="tls" className="text-sm text-slate-400">
                启用 TLS
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-slate-700 text-slate-300">
              取消
            </Button>
            <Button className="bg-sky-500 hover:bg-sky-600" onClick={() => setShowCreate(false)}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
