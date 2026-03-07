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
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  Plus,
  MoreHorizontal,
  RefreshCw,
  Edit,
  Trash2,
  Layers,
  Eye,
  Loader2,
} from "lucide-react";
import { useDaemonSets, useCreateDaemonSet, useDeleteDaemonSet, useNamespaces } from "@/hooks/use-k8s";
import { useToast } from "@/hooks/use-toast";

interface DaemonSetsPageProps {
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

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between">
        <div className="h-8 w-48 bg-slate-800 rounded" />
        <div className="flex gap-4">
          <div className="h-10 w-24 bg-slate-800 rounded" />
          <div className="h-10 w-40 bg-slate-800 rounded" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
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

export default function DaemonSetsPage({ namespace }: DaemonSetsPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    image: "",
    namespace: "default",
    port: 80,
  });

  const { toast } = useToast();
  
  const { data: daemonSets, isLoading, refetch, isRefetching } = useDaemonSets();
  const { data: namespaces } = useNamespaces();
  
  // Mutations
  const createDaemonSet = useCreateDaemonSet();
  const deleteDaemonSet = useDeleteDaemonSet();
  
  // Ensure data is array
  const daemonSetsList = Array.isArray(daemonSets) ? daemonSets : [];
  const namespacesList = Array.isArray(namespaces) ? namespaces : [];
  
  // Filter by namespace and search term
  const filteredDaemonSets = daemonSetsList.filter(
    (d) => {
      const matchesNamespace = namespace === "default" || d.namespace === namespace;
      const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesNamespace && matchesSearch;
    }
  );

  // Handle create
  const handleCreate = () => {
    if (!form.name || !form.image) {
      toast({ title: "表单不完整", description: "请填写名称和镜像", variant: "destructive" });
      return;
    }
    createDaemonSet.mutate({
      namespace: form.namespace,
      name: form.name,
      image: form.image,
      containerPort: form.port,
    }, {
      onSuccess: () => {
        toast({ title: "创建成功", description: `DaemonSet ${form.name} 已创建` });
        setIsCreateOpen(false);
        setForm({ name: "", image: "", namespace: "default", port: 80 });
      },
      onError: (error) => {
        toast({ title: "创建失败", description: error.message, variant: "destructive" });
      },
    });
  };

  // Handle delete
  const handleDelete = (dsNamespace: string, dsName: string) => {
    if (confirm(`确定要删除 DaemonSet "${dsName}" 吗？这将删除所有节点上的 Pod。`)) {
      deleteDaemonSet.mutate(dsNamespace, dsName, {
        onSuccess: () => {
          toast({ title: "删除成功", description: `DaemonSet ${dsName} 已删除` });
        },
        onError: (error) => {
          toast({ title: "删除失败", description: error.message, variant: "destructive" });
        },
      });
    }
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Calculate stats
  const healthyCount = filteredDaemonSets.filter((d) => d.readyNodes === d.desiredNodes).length;
  const warningCount = filteredDaemonSets.filter((d) => d.readyNodes < d.desiredNodes && d.readyNodes > 0).length;
  const errorCount = filteredDaemonSets.filter((d) => d.readyNodes === 0).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">DaemonSets</h2>
          <p className="text-slate-400 text-sm mt-1">管理每个节点上运行的守护进程</p>
        </div>
        <div className="flex gap-4">
          <Button 
            variant="ghost" 
            className="glass-card px-4 py-2 text-sm text-slate-300"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            {isRefetching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                刷新中...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </>
            )}
          </Button>
          
          <Button 
            className="bg-sky-500 hover:bg-sky-600 px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-sky-500/20"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            创建 DaemonSet
          </Button>
          
          {/* Create Dialog */}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">创建 DaemonSet</DialogTitle>
                <DialogDescription className="text-slate-400">创建新的 DaemonSet 工作负载</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-slate-300">命名空间</Label>
                  <Select value={form.namespace} onValueChange={(v) => setForm({ ...form, namespace: v })}>
                    <SelectTrigger className="col-span-3 bg-slate-800 border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      <SelectItem value="default">default</SelectItem>
                      {namespacesList.map((ns) => (
                        <SelectItem key={ns.name} value={ns.name}>{ns.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-slate-300">名称 *</Label>
                  <Input 
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="my-daemon" 
                    className="col-span-3 bg-slate-800 border-slate-600" 
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-slate-300">镜像 *</Label>
                  <Input 
                    value={form.image}
                    onChange={(e) => setForm({ ...form, image: e.target.value })}
                    placeholder="nginx:latest" 
                    className="col-span-3 bg-slate-800 border-slate-600" 
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-slate-300">容器端口</Label>
                  <Input 
                    type="number"
                    value={form.port}
                    onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 80 })}
                    className="col-span-3 bg-slate-800 border-slate-600" 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="text-slate-300">取消</Button>
                <Button 
                  onClick={handleCreate} 
                  className="bg-sky-500 hover:bg-sky-600"
                  disabled={createDaemonSet.isPending}
                >
                  {createDaemonSet.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  创建
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">DaemonSets</p>
          <p className="text-2xl font-bold text-white mt-2">{filteredDaemonSets.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">健康</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{healthyCount}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">异常</p>
          <p className="text-2xl font-bold text-rose-400 mt-2">{errorCount}</p>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card">
        <div className="p-4 border-b border-slate-800">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="搜索 DaemonSet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-700"
            />
          </div>
        </div>
        {filteredDaemonSets.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">名称</th>
                <th className="px-6 py-4 font-medium">命名空间</th>
                <th className="px-6 py-4 font-medium">期望</th>
                <th className="px-6 py-4 font-medium">当前</th>
                <th className="px-6 py-4 font-medium">就绪</th>
                <th className="px-6 py-4 font-medium">存活时间</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredDaemonSets.map((ds) => (
                <tr key={`${ds.namespace}-${ds.name}`} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-amber-400" />
                      <span className="font-mono font-bold text-sky-400">{ds.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{ds.namespace}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-300">{ds.desiredNodes}</td>
                  <td className="px-6 py-4 text-slate-300">{ds.currentNodes}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={ds.readyNodes === ds.desiredNodes ? "text-emerald-400" : "text-amber-400"}>
                        {ds.readyNodes}/{ds.desiredNodes}
                      </span>
                      <Progress value={(ds.readyNodes / Math.max(ds.desiredNodes, 1)) * 100} className="w-12 h-1.5" />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{formatAge(ds.createdAt)}</td>
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
                          <Eye className="h-4 w-4 mr-2" /> 查看详情
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800">
                          <Edit className="h-4 w-4 mr-2" /> 编辑
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-700" />
                        <DropdownMenuItem 
                          className="text-rose-500 focus:bg-rose-500/10"
                          onClick={() => handleDelete(ds.namespace, ds.name)}
                        >
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
            <Layers className="h-12 w-12 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 text-sm">当前命名空间没有 DaemonSet</p>
          </div>
        )}
      </div>
    </div>
  );
}
