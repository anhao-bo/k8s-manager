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
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Plus,
  MoreHorizontal,
  RefreshCw,
  Edit,
  Trash2,
  Database,
  Eye,
  Loader2,
} from "lucide-react";
import {
  useStatefulSets,
  useCreateStatefulSet,
  useDeleteStatefulSet,
  useNamespaces
} from "@/hooks/use-k8s";

interface StatefulSetsPageProps {
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

interface StatefulSetDetail {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  serviceName: string;
  strategy: string;
  createdAt: string;
  labels: Record<string, string>;
  containers: Array<{ name: string; image: string; ports: number[] }>;
}

export default function StatefulSetsPage({ namespace }: StatefulSetsPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedStatefulSet, setSelectedStatefulSet] = useState<StatefulSetDetail | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    image: "",
    namespace: "default",
    replicas: 1,
    serviceName: "",
    port: 80,
  });

  const { toast } = useToast();

  const { data: statefulSets, isLoading, refetch, isRefetching } = useStatefulSets();
  const { data: namespaces } = useNamespaces();
  const createStatefulSet = useCreateStatefulSet();
  const deleteStatefulSet = useDeleteStatefulSet();
  
  // Ensure data is array
  const statefulSetsList = Array.isArray(statefulSets) ? statefulSets : [];
  const namespacesList = Array.isArray(namespaces) ? namespaces : [];
  
  // Filter by namespace and search term
  const filteredStatefulSets = statefulSetsList.filter(
    (s) => {
      const matchesNamespace = namespace === "default" || s.namespace === namespace;
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesNamespace && matchesSearch;
    }
  );

  // Handle create StatefulSet
  const handleCreateStatefulSet = () => {
    if (!createForm.name || !createForm.image) {
      toast({
        title: "表单不完整",
        description: "请填写名称和镜像",
        variant: "destructive",
      });
      return;
    }

    createStatefulSet.mutate(
      {
        namespace: createForm.namespace,
        name: createForm.name,
        image: createForm.image,
        replicas: createForm.replicas,
        serviceName: createForm.serviceName || `${createForm.name}-headless`,
        containerPort: createForm.port,
      },
      {
        onSuccess: () => {
          toast({ title: "创建成功", description: `StatefulSet ${createForm.name} 已创建` });
          setIsCreateOpen(false);
          setCreateForm({ name: "", image: "", namespace: "default", replicas: 1, serviceName: "", port: 80 });
        },
        onError: (error) => {
          toast({
            title: "创建失败",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  // Handle delete StatefulSet
  const handleDelete = (stsNamespace: string, stsName: string) => {
    if (confirm(`确定要删除 StatefulSet "${stsName}" 吗？这将删除所有关联的 Pod。`)) {
      deleteStatefulSet.mutate(stsNamespace, stsName, {
        onSuccess: () => {
          toast({ title: "删除成功", description: `StatefulSet ${stsName} 已删除` });
        },
        onError: (error) => {
          toast({ title: "删除失败", description: error.message, variant: "destructive" });
        },
      });
    }
  };

  // Handle view StatefulSet detail
  const handleViewDetail = async (stsNamespace: string, stsName: string) => {
    try {
      const response = await fetch(`/api/statefulsets/detail?namespace=${stsNamespace}&name=${stsName}&XTransformPort=8080`);
      if (response.ok) {
        const data = await response.json();
        setSelectedStatefulSet(data);
        setIsDetailOpen(true);
      } else {
        toast({ title: "获取详情失败", variant: "destructive" });
      }
    } catch {
      toast({ title: "获取详情失败", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">StatefulSets</h2>
          <p className="text-slate-400 text-sm mt-1">管理有状态应用，如数据库和消息队列</p>
        </div>
        <div className="flex gap-4">
          <Button 
            variant="ghost" 
            className="glass-card px-4 py-2 text-sm text-slate-300"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            {isRefetching ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            刷新
          </Button>
          <Button 
            className="bg-sky-500 hover:bg-sky-600 px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-sky-500/20"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            创建 StatefulSet
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">StatefulSets</p>
          <p className="text-2xl font-bold text-white mt-2">{filteredStatefulSets.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">总副本数</p>
          <p className="text-2xl font-bold text-sky-400 mt-2">
            {filteredStatefulSets.reduce((acc, s) => acc + s.replicas, 0)}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">健康</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">
            {filteredStatefulSets.filter((s) => s.readyReplicas === s.replicas).length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card">
        <div className="p-4 border-b border-slate-800">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="搜索 StatefulSet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-700"
            />
          </div>
        </div>
        {filteredStatefulSets.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">名称</th>
                <th className="px-6 py-4 font-medium">命名空间</th>
                <th className="px-6 py-4 font-medium">副本</th>
                <th className="px-6 py-4 font-medium">Service</th>
                <th className="px-6 py-4 font-medium">存活时间</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredStatefulSets.map((sts) => (
                <tr key={`${sts.namespace}-${sts.name}`} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-purple-400" />
                      <span className="font-mono font-bold text-sky-400">{sts.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{sts.namespace}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={sts.readyReplicas === sts.replicas ? "text-emerald-400" : "text-amber-400"}>
                        {sts.readyReplicas}/{sts.replicas}
                      </span>
                      <Progress value={(sts.readyReplicas / Math.max(sts.replicas, 1)) * 100} className="w-12 h-1.5" />
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-400">{sts.serviceName || "-"}</td>
                  <td className="px-6 py-4 text-slate-500">{formatAge(sts.createdAt)}</td>
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
                        <DropdownMenuItem 
                          className="text-slate-300 hover:text-white focus:bg-slate-800"
                          onClick={() => handleViewDetail(sts.namespace, sts.name)}
                        >
                          <Eye className="h-4 w-4 mr-2" /> 查看详情
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800">
                          <Edit className="h-4 w-4 mr-2" /> 编辑
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-700" />
                        <DropdownMenuItem
                          className="text-rose-500 focus:bg-rose-500/10"
                          onClick={() => handleDelete(sts.namespace, sts.name)}
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
            <Database className="h-12 w-12 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 text-sm">当前命名空间没有 StatefulSet</p>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">创建 StatefulSet</DialogTitle>
            <DialogDescription className="text-slate-400">创建新的有状态应用工作负载</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-slate-300">命名空间</Label>
              <select
                value={createForm.namespace}
                onChange={(e) => setCreateForm({ ...createForm, namespace: e.target.value })}
                className="col-span-3 bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-slate-300"
              >
                <option value="default">default</option>
                {namespacesList.map((ns) => (
                  <option key={ns.name} value={ns.name}>{ns.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-slate-300">名称 *</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="my-statefulset"
                className="col-span-3 bg-slate-800 border-slate-600"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-slate-300">镜像 *</Label>
              <Input
                value={createForm.image}
                onChange={(e) => setCreateForm({ ...createForm, image: e.target.value })}
                placeholder="nginx:latest"
                className="col-span-3 bg-slate-800 border-slate-600"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-slate-300">副本数</Label>
              <Input
                type="number"
                value={createForm.replicas}
                onChange={(e) => setCreateForm({ ...createForm, replicas: parseInt(e.target.value) || 1 })}
                min={1}
                className="col-span-3 bg-slate-800 border-slate-600"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-slate-300">Service 名称</Label>
              <Input
                value={createForm.serviceName}
                onChange={(e) => setCreateForm({ ...createForm, serviceName: e.target.value })}
                placeholder="my-statefulset-headless"
                className="col-span-3 bg-slate-800 border-slate-600"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-slate-300">容器端口</Label>
              <Input
                type="number"
                value={createForm.port}
                onChange={(e) => setCreateForm({ ...createForm, port: parseInt(e.target.value) || 80 })}
                className="col-span-3 bg-slate-800 border-slate-600"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="text-slate-300">
              取消
            </Button>
            <Button
              onClick={handleCreateStatefulSet}
              className="bg-sky-500 hover:bg-sky-600"
              disabled={createStatefulSet.isPending}
            >
              {createStatefulSet.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[600px] bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Database className="h-5 w-5 text-purple-400" />
              StatefulSet 详情
            </DialogTitle>
          </DialogHeader>
          {selectedStatefulSet && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 text-xs">名称</p>
                  <p className="text-white font-mono">{selectedStatefulSet.name}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">命名空间</p>
                  <p className="text-white">{selectedStatefulSet.namespace}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">副本</p>
                  <p className="text-emerald-400">{selectedStatefulSet.readyReplicas}/{selectedStatefulSet.replicas}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Service</p>
                  <p className="text-white font-mono text-sm">{selectedStatefulSet.serviceName || "-"}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">策略</p>
                  <Badge variant="secondary" className="bg-slate-800">{selectedStatefulSet.strategy}</Badge>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">创建时间</p>
                  <p className="text-white text-sm">{selectedStatefulSet.createdAt}</p>
                </div>
              </div>
              {selectedStatefulSet.containers && selectedStatefulSet.containers.length > 0 && (
                <div>
                  <p className="text-slate-500 text-xs mb-2">容器</p>
                  <div className="space-y-2">
                    {selectedStatefulSet.containers.map((container, idx) => (
                      <div key={idx} className="bg-slate-800 rounded p-3">
                        <p className="text-sky-400 font-mono text-sm">{container.name}</p>
                        <p className="text-slate-400 text-xs">{container.image}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)} className="border-slate-700 text-slate-300">
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
