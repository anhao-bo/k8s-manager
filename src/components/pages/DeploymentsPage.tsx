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
  Boxes,
  RotateCcw,
  Eye,
  Loader2,
} from "lucide-react";
import {
  useDeployments,
  useScaleDeployment,
  useRestartDeployment,
  useCreateDeployment,
  useDeleteDeployment,
  useNamespaces
} from "@/hooks/use-k8s";

interface DeploymentsPageProps {
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

export default function DeploymentsPage({ namespace }: DeploymentsPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    image: "",
    namespace: "default",
    replicas: 1,
    port: 80,
  });

  const { toast } = useToast();

  // Fetch real K8s data
  const { data: deployments, isLoading, refetch, isRefetching } = useDeployments();
  const { data: namespaces } = useNamespaces();

  // Mutations
  const scaleDeployment = useScaleDeployment();
  const restartDeployment = useRestartDeployment();
  const createDeployment = useCreateDeployment();
  const deleteDeployment = useDeleteDeployment();

  // Ensure data is array
  const deploymentsList = Array.isArray(deployments) ? deployments : [];
  const namespacesList = Array.isArray(namespaces) ? namespaces : [];

  // Filter deployments by namespace and search term
  const filteredDeployments = deploymentsList.filter((d) => {
    const matchesNamespace = namespace === "default" || d.namespace === namespace;
    const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesNamespace && matchesSearch;
  });

  // Handle create deployment
  const handleCreateDeployment = () => {
    if (!createForm.name || !createForm.image) {
      toast({
        title: "表单不完整",
        description: "请填写名称和镜像",
        variant: "destructive",
      });
      return;
    }

    createDeployment.mutate(
      {
        namespace: createForm.namespace,
        name: createForm.name,
        image: createForm.image,
        replicas: createForm.replicas,
        containerPort: createForm.port,
      },
      {
        onSuccess: () => {
          toast({ title: "创建成功", description: `Deployment ${createForm.name} 已创建` });
          setIsCreateOpen(false);
          setCreateForm({ name: "", image: "", namespace: "default", replicas: 1, port: 80 });
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

  // Handle deployment scale
  const handleScale = (deployNamespace: string, deployName: string, currentReplicas: number) => {
    const replicas = prompt(`当前副本数: ${currentReplicas}\n请输入新的副本数:`, String(currentReplicas));
    if (replicas) {
      scaleDeployment.mutate(deployNamespace, deployName, parseInt(replicas));
    }
  };

  // Handle deployment restart
  const handleRestart = (deployNamespace: string, deployName: string) => {
    if (confirm(`确定要重启 Deployment "${deployName}" 吗？`)) {
      restartDeployment.mutate(deployNamespace, deployName);
    }
  };

  // Handle deployment delete
  const handleDelete = (deployNamespace: string, deployName: string) => {
    if (confirm(`确定要删除 Deployment "${deployName}" 吗？这将删除所有关联的 Pod。`)) {
      deleteDeployment.mutate(deployNamespace, deployName, {
        onSuccess: () => {
          toast({ title: "删除成功", description: `Deployment ${deployName} 已删除` });
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
  const healthyCount = filteredDeployments.filter((d) => d.readyReplicas === d.replicas).length;
  const warningCount = filteredDeployments.filter((d) => d.readyReplicas < d.replicas && d.readyReplicas > 0).length;
  const errorCount = filteredDeployments.filter((d) => d.readyReplicas === 0).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Deployments</h2>
          <p className="text-slate-400 text-sm mt-1">管理无状态应用部署</p>
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
            创建 Deployment
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">Deployments</p>
          <p className="text-2xl font-bold text-white mt-2">{filteredDeployments.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">健康</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{healthyCount}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">警告</p>
          <p className="text-2xl font-bold text-amber-400 mt-2">{warningCount}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">异常</p>
          <p className="text-2xl font-bold text-rose-400 mt-2">{errorCount}</p>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="搜索 Deployment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-700"
            />
          </div>
        </div>
        {filteredDeployments.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">名称</th>
                <th className="px-6 py-4 font-medium">命名空间</th>
                <th className="px-6 py-4 font-medium">READY</th>
                <th className="px-6 py-4 font-medium">UP-TO-DATE</th>
                <th className="px-6 py-4 font-medium">AVAILABLE</th>
                <th className="px-6 py-4 font-medium">策略</th>
                <th className="px-6 py-4 font-medium">存活时间</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredDeployments.map((deploy) => (
                <tr key={`${deploy.namespace}-${deploy.name}`} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Boxes className="h-4 w-4 text-sky-400" />
                      <span className="font-mono font-bold text-sky-400">{deploy.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{deploy.namespace}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={deploy.readyReplicas === deploy.replicas ? "text-emerald-400" : "text-amber-400"}>
                        {deploy.readyReplicas}/{deploy.replicas}
                      </span>
                      <Progress value={(deploy.readyReplicas / Math.max(deploy.replicas, 1)) * 100} className="w-12 h-1.5" />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-300">{deploy.updatedReplicas}</td>
                  <td className="px-6 py-4">
                    <span className={deploy.availableReplicas === deploy.replicas ? "text-emerald-400" : "text-amber-400"}>
                      {deploy.availableReplicas}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="secondary" className="bg-slate-800 text-xs">{deploy.strategy}</Badge>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{formatAge(deploy.createdAt)}</td>
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
                        <DropdownMenuItem
                          className="text-slate-300 hover:text-white focus:bg-slate-800"
                          onClick={() => handleRestart(deploy.namespace, deploy.name)}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" /> 重启
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-slate-300 hover:text-white focus:bg-slate-800"
                          onClick={() => handleScale(deploy.namespace, deploy.name, deploy.replicas)}
                        >
                          <Edit className="h-4 w-4 mr-2" /> 扩缩容
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-700" />
                        <DropdownMenuItem
                          className="text-rose-500 focus:bg-rose-500/10"
                          onClick={() => handleDelete(deploy.namespace, deploy.name)}
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
            <Boxes className="h-12 w-12 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 text-sm">当前命名空间没有 Deployment</p>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">创建 Deployment</DialogTitle>
            <DialogDescription className="text-slate-400">创建新的 Deployment 工作负载</DialogDescription>
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
                placeholder="my-deployment"
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
              onClick={handleCreateDeployment}
              className="bg-sky-500 hover:bg-sky-600"
              disabled={createDeployment.isPending}
            >
              {createDeployment.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
