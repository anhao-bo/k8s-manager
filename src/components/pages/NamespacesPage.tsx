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
  DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Layers,
  Container,
  Network,
  Shield,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useNamespaces, useCreateNamespace, useDeleteNamespace, usePods, useServices, useDeployments } from "@/hooks/use-k8s";

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

const getStatusBadge = (status: string) => {
  if (status === "Active") {
    return (
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 status-pulse" />
        <span className="text-emerald-400 font-medium">Active</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-amber-500 status-pulse" />
      <span className="text-amber-400 font-medium">{status}</span>
    </div>
  );
};

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-slate-800 rounded" />
        <div className="flex gap-4">
          <div className="h-10 w-24 bg-slate-800 rounded" />
          <div className="h-10 w-40 bg-slate-800 rounded" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
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

export default function NamespacesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newNamespaceName, setNewNamespaceName] = useState("");
  const [newNamespaceLabels, setNewNamespaceLabels] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Fetch real K8s data
  const { data: namespaces, isLoading: nsLoading, refetch: refetchNS, error } = useNamespaces();
  const { data: pods } = usePods();
  const { data: services } = useServices();
  const { data: deployments } = useDeployments();

  // Mutations
  const createNamespace = useCreateNamespace();
  const deleteNamespace = useDeleteNamespace();

  const isLoading = nsLoading;

  // Ensure data is arrays
  const namespacesList = Array.isArray(namespaces) ? namespaces : [];
  const podsList = Array.isArray(pods) ? pods : [];
  const servicesList = Array.isArray(services) ? services : [];
  const deploymentsList = Array.isArray(deployments) ? deployments : [];

  // Count resources per namespace
  const getResourceCount = (namespace: string, resourceList: Array<{ namespace: string }>) => {
    return resourceList.filter(item => item.namespace === namespace).length;
  };

  const filteredNamespaces = namespacesList.filter((ns) => 
    ns.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPods = podsList.length;
  const totalServices = servicesList.length;
  const totalDeployments = deploymentsList.length;

  // Handle create namespace
  const handleCreate = () => {
    if (!newNamespaceName.trim()) return;
    
    let labels: Record<string, string> | undefined;
    if (newNamespaceLabels.trim()) {
      try {
        labels = JSON.parse(newNamespaceLabels);
      } catch {
        // If not JSON, try key=value format
        const pairs = newNamespaceLabels.split(',').map(p => p.trim());
        labels = {};
        pairs.forEach(pair => {
          const [key, value] = pair.split('=');
          if (key && value) {
            labels[key.trim()] = value.trim();
          }
        });
      }
    }

    createNamespace.mutate(newNamespaceName, labels, {
      onSuccess: () => {
        setIsCreateOpen(false);
        setNewNamespaceName("");
        setNewNamespaceLabels("");
      }
    });
  };

  // Handle delete namespace
  const handleDelete = (name: string) => {
    if (deleteConfirm === name) {
      deleteNamespace.mutate(name, {
        onSuccess: () => {
          setDeleteConfirm(null);
        }
      });
    } else {
      setDeleteConfirm(name);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">命名空间</h2>
          <p className="text-slate-400 text-sm mt-1">管理 Kubernetes 命名空间</p>
        </div>
        <div className="flex gap-4">
          <Button 
            variant="ghost" 
            className="glass-card px-4 py-2 text-sm text-slate-300"
            onClick={() => refetchNS()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-sky-500 hover:bg-sky-600 px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-sky-500/20">
                <Plus className="h-4 w-4 mr-2" />
                创建命名空间
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">创建命名空间</DialogTitle>
                <DialogDescription className="text-slate-400">创建新的命名空间来组织您的资源</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-slate-300">名称</Label>
                  <Input 
                    placeholder="my-namespace" 
                    className="col-span-3 bg-slate-800 border-slate-600"
                    value={newNamespaceName}
                    onChange={(e) => setNewNamespaceName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-slate-300">标签</Label>
                  <Input 
                    placeholder="env=prod,team=dev" 
                    className="col-span-3 bg-slate-800 border-slate-600"
                    value={newNamespaceLabels}
                    onChange={(e) => setNewNamespaceLabels(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="ghost" 
                  onClick={() => setIsCreateOpen(false)} 
                  className="text-slate-300"
                  disabled={createNamespace.isPending}
                >
                  取消
                </Button>
                <Button 
                  onClick={handleCreate} 
                  className="bg-sky-500 hover:bg-sky-600"
                  disabled={createNamespace.isPending || !newNamespaceName.trim()}
                >
                  {createNamespace.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  创建
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="glass-card p-6">
          <p className="text-slate-400 text-xs">命名空间</p>
          <div className="text-2xl font-bold text-white mt-2">
            {namespacesList.filter((n) => n.status === "Active").length}
          </div>
          <p className="text-xs text-slate-500 mt-1">活跃中</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-slate-400 text-xs">Pods</p>
          <div className="text-2xl font-bold text-sky-400 mt-2">{totalPods}</div>
          <p className="text-xs text-slate-500 mt-1">总数量</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-slate-400 text-xs">Services</p>
          <div className="text-2xl font-bold text-emerald-400 mt-2">{totalServices}</div>
          <p className="text-xs text-slate-500 mt-1">总数量</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-slate-400 text-xs">Deployments</p>
          <div className="text-2xl font-bold text-purple-400 mt-2">{totalDeployments}</div>
          <p className="text-xs text-slate-500 mt-1">总数量</p>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="glass-card p-4 border-rose-500/50 bg-rose-500/10">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">无法加载命名空间数据，请检查集群连接</span>
          </div>
        </div>
      )}

      {/* Namespaces Table */}
      <div className="glass-card">
        <div className="p-4 border-b border-slate-800">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="搜索命名空间..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-700"
            />
          </div>
        </div>
        {filteredNamespaces.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">名称</th>
                <th className="px-6 py-4 font-medium">状态</th>
                <th className="px-6 py-4 font-medium">Pods</th>
                <th className="px-6 py-4 font-medium">Services</th>
                <th className="px-6 py-4 font-medium">Deployments</th>
                <th className="px-6 py-4 font-medium">存活时间</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredNamespaces.map((ns) => (
                <tr key={ns.name} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                        <Layers className="h-4 w-4 text-sky-400" />
                      </div>
                      <span className="font-mono font-bold text-sky-400">{ns.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(ns.status)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-slate-300">
                      <Container className="h-4 w-4 text-slate-500" />
                      <span>{getResourceCount(ns.name, podsList)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-slate-300">
                      <Network className="h-4 w-4 text-slate-500" />
                      <span>{getResourceCount(ns.name, servicesList)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-slate-300">
                      <Shield className="h-4 w-4 text-slate-500" />
                      <span>{getResourceCount(ns.name, deploymentsList)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{formatAge(ns.createdAt)}</td>
                  <td className="px-6 py-4 text-right">
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
                          <Edit className="h-4 w-4 mr-2" />
                          编辑标签
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800">
                          <Layers className="h-4 w-4 mr-2" />
                          查看资源
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-700" />
                        <DropdownMenuItem 
                          className="text-rose-500 focus:bg-rose-500/10"
                          onClick={() => handleDelete(ns.name)}
                        >
                          {deleteNamespace.isPending && deleteConfirm === ns.name ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                          )}
                          {deleteConfirm === ns.name ? "再次确认删除" : "删除"}
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
            <Layers className="h-12 w-12 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 text-sm">
              {error ? "无法加载命名空间数据" : "没有找到命名空间"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
