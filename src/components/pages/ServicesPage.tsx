"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Search,
  Plus,
  MoreHorizontal,
  RefreshCw,
  Edit,
  Trash2,
  Network,
  Globe,
  ArrowRightLeft,
  Shield,
  Loader2,
} from "lucide-react";
import { useServices, useIngresses } from "@/hooks/use-k8s";

interface ServicesPageProps {
  namespace: string;
}

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

const getTypeBadge = (type: string) => {
  const colors: Record<string, string> = {
    ClusterIP: "text-sky-400",
    NodePort: "text-emerald-400",
    LoadBalancer: "text-amber-400",
    ExternalName: "text-purple-400",
  };
  return <span className={`font-medium ${colors[type] || "text-slate-400"}`}>{type}</span>;
};

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between">
        <div className="h-8 w-48 bg-slate-800 rounded" />
        <div className="flex gap-4">
          <div className="h-10 w-24 bg-slate-800 rounded" />
          <div className="h-10 w-32 bg-slate-800 rounded" />
        </div>
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

export default function ServicesPage({ namespace }: ServicesPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("services");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Fetch real K8s data
  const { data: services, isLoading: servicesLoading, refetch: refetchServices } = useServices();
  const { data: ingresses, isLoading: ingressesLoading, refetch: refetchIngresses } = useIngresses();

  const isLoading = servicesLoading || ingressesLoading;

  // Ensure data is array
  const servicesList = Array.isArray(services) ? services : [];
  const ingressesList = Array.isArray(ingresses) ? ingresses : [];

  // Filter by namespace and search term
  const filteredServices = servicesList.filter(
    (s) => {
      const matchesNamespace = namespace === "default" || s.namespace === namespace;
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesNamespace && matchesSearch;
    }
  );

  const filteredIngresses = ingressesList.filter(
    (i) => {
      const matchesNamespace = namespace === "default" || i.namespace === namespace;
      const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesNamespace && matchesSearch;
    }
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">服务与路由</h2>
          <p className="text-slate-400 text-sm mt-1">管理 Services、Ingress 和 Endpoints</p>
        </div>
        <div className="flex gap-4">
          <Button 
            variant="ghost" 
            className="glass-card px-4 py-2 text-sm text-slate-300"
            onClick={() => { refetchServices(); refetchIngresses(); }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-sky-500 hover:bg-sky-600 px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-sky-500/20">
                <Plus className="h-4 w-4 mr-2" />
                创建服务
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">创建服务</DialogTitle>
                <DialogDescription className="text-slate-400">创建新的 Service 或 Ingress</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-slate-300">名称</Label>
                  <Input placeholder="my-service" className="col-span-3 bg-slate-800 border-slate-600" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-slate-300">类型</Label>
                  <Input placeholder="ClusterIP" className="col-span-3 bg-slate-800 border-slate-600" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-slate-300">端口</Label>
                  <Input placeholder="80:8080" className="col-span-3 bg-slate-800 border-slate-600" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="text-slate-300">取消</Button>
                <Button onClick={() => setIsCreateOpen(false)} className="bg-sky-500 hover:bg-sky-600">创建</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-900 border border-slate-700">
          <TabsTrigger value="services" className="gap-2 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
            <Network className="h-4 w-4" />
            Services ({filteredServices.length})
          </TabsTrigger>
          <TabsTrigger value="ingress" className="gap-2 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
            <Globe className="h-4 w-4" />
            Ingress ({filteredIngresses.length})
          </TabsTrigger>
          <TabsTrigger value="endpoints" className="gap-2 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
            <ArrowRightLeft className="h-4 w-4" />
            Endpoints
          </TabsTrigger>
        </TabsList>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="搜索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-700"
            />
          </div>

          {filteredServices.length > 0 ? (
            <div className="glass-card">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-medium">名称</th>
                    <th className="px-6 py-4 font-medium">命名空间</th>
                    <th className="px-6 py-4 font-medium">类型</th>
                    <th className="px-6 py-4 font-medium">ClusterIP</th>
                    <th className="px-6 py-4 font-medium">外部IP</th>
                    <th className="px-6 py-4 font-medium">端口</th>
                    <th className="px-6 py-4 font-medium">存活时间</th>
                    <th className="px-6 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredServices.map((service) => (
                    <tr key={`${service.namespace}-${service.name}`} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Network className="h-4 w-4 text-sky-400" />
                          <span className="font-mono font-bold text-sky-400">{service.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{service.namespace}</span>
                      </td>
                      <td className="px-6 py-4">{getTypeBadge(service.type)}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">{service.clusterIP || "None"}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">{service.externalIP || "-"}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1 flex-wrap">
                          {service.ports && service.ports.length > 0 ? (
                            service.ports.map((p, i) => (
                              <Badge key={i} variant="secondary" className="text-xs bg-slate-800">
                                {p.port}/{p.protocol}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{formatAge(service.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <Network className="h-12 w-12 mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400 text-sm">当前命名空间没有 Service</p>
            </div>
          )}
        </TabsContent>

        {/* Ingress Tab */}
        <TabsContent value="ingress" className="space-y-4">
          {filteredIngresses.length > 0 ? (
            <div className="glass-card">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-medium">名称</th>
                    <th className="px-6 py-4 font-medium">命名空间</th>
                    <th className="px-6 py-4 font-medium">主机</th>
                    <th className="px-6 py-4 font-medium">路径</th>
                    <th className="px-6 py-4 font-medium">Class</th>
                    <th className="px-6 py-4 font-medium">TLS</th>
                    <th className="px-6 py-4 font-medium">存活时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredIngresses.map((ingress) => (
                    <tr key={`${ingress.namespace}-${ingress.name}`} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-emerald-400" />
                          <span className="font-mono font-bold text-sky-400">{ingress.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{ingress.namespace}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1 flex-wrap">
                          {ingress.hosts && ingress.hosts.length > 0 ? (
                            ingress.hosts.map((host, i) => (
                              <span key={i} className="font-mono text-xs text-slate-400">{host}</span>
                            ))
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1 flex-wrap">
                          {ingress.paths && ingress.paths.length > 0 ? (
                            ingress.paths.map((p, i) => (
                              <Badge key={i} variant="secondary" className="text-xs bg-slate-800">
                                {p.path || "/"}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">{ingress.className || "-"}</td>
                      <td className="px-6 py-4">
                        {ingress.tls ? (
                          <div className="flex items-center gap-1 text-emerald-400">
                            <Shield className="h-3 w-3" />
                            <span className="text-xs">启用</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs">禁用</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500">{formatAge(ingress.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <Globe className="h-12 w-12 mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400 text-sm">当前命名空间没有 Ingress</p>
            </div>
          )}
        </TabsContent>

        {/* Endpoints Tab */}
        <TabsContent value="endpoints">
          <div className="glass-card p-8 text-center">
            <ArrowRightLeft className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Endpoints 功能开发中...</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
