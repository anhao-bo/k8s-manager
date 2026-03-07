"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Plus,
  MoreHorizontal,
  RefreshCw,
  Edit,
  Trash2,
  Copy,
  Boxes,
  RotateCcw,
  Eye,
  Loader2,
  Code,
  Save,
  AlertCircle,
} from "lucide-react";
import { useDeployments, useScaleDeployment, useRestartDeployment, useCreateDeployment, useDeleteDeployment, useNamespaces, useResourceYaml, useUpdateResourceYaml } from "@/hooks/use-k8s";
import { useToast } from "@/hooks/use-toast";

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
  const [isYamlOpen, setIsYamlOpen] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<{namespace: string; name: string} | null>(null);
  const [yamlContent, setYamlContent] = useState("");
  const [form, setForm] = useState({
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
  const filteredDeployments = deploymentsList.filter(
    (d) => {
      const matchesNamespace = namespace === "default" || d.namespace === namespace;
      const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesNamespace && matchesSearch;
    }
  );

  // Handle deployment scale
  const handleScale = (deployNamespace: string, deployName: string, currentReplicas: number) => {
    const replicas = prompt(`当前副本数: ${currentReplicas}\n请输入新的副本数:`, String(currentReplicas));
    if (replicas) {
      const replicaNum = parseInt(replicas);
      if (isNaN(replicaNum) || replicaNum < 0) {
        toast({ title: "输入无效", description: "请输入有效的正整数", variant: "destructive" });
        return;
      }
      scaleDeployment.mutate(deployNamespace, deployName, replicaNum, {
        onSuccess: () => {
          toast({ title: "扩缩容成功", description: `Deployment ${deployName} 副本数已设置为 ${replicaNum}` });
        },
        onError: (error) => {
          toast({ title: "扩缩容失败", description: error.message, variant: "destructive" });
        },
      });
    }
  };

  // Handle deployment restart
  const handleRestart = (deployNamespace: string, deployName: string) => {
    if (confirm(`确定要重启 Deployment "${deployName}" 吗？`)) {
      restartDeployment.mutate(deployNamespace, deployName, {
        onSuccess: () => {
          toast({ title: "重启成功", description: `Deployment ${deployName} 正在重启` });
        },
        onError: (error) => {
          toast({ title: "重启失败", description: error.message, variant: "destructive" });
        },
      });
    }
  };

  // Handle create deployment
  const handleCreate = () => {
    if (!form.name || !form.image) {
      toast({ title: "表单不完整", description: "请填写名称和镜像", variant: "destructive" });
      return;
    }
    createDeployment.mutate({
      namespace: form.namespace,
      name: form.name,
      image: form.image,
      replicas: form.replicas,
      containerPort: form.port,
    }, {
      onSuccess: () => {
        toast({ title: "创建成功", description: `Deployment ${form.name} 已创建` });
        setIsCreateOpen(false);
        setForm({ name: "", image: "", namespace: "default", replicas: 1, port: 80 });
      },
      onError: (error) => {
        toast({ title: "创建失败", description: error.message, variant: "destructive" });
      },
    });
  };

  // Handle delete deployment
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

  // Handle open YAML editor
  const handleOpenYaml = async (deployNamespace: string, deployName: string) => {
    setSelectedDeployment({ namespace: deployNamespace, name: deployName });
    setIsYamlOpen(true);
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
          
          {/* 独立的创建按钮 */}
          <Button 
            className="bg-sky-500 hover:bg-sky-600 px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-sky-500/20"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            创建 Deployment
          </Button>
          
          {/* 创建对话框 */}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">创建 Deployment</DialogTitle>
                <DialogDescription className="text-slate-400">创建新的 Deployment 工作负载</DialogDescription>
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
                    placeholder="my-app" 
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
                  <Label className="text-right text-slate-300">副本数</Label>
                  <Input 
                    type="number"
                    value={form.replicas}
                    onChange={(e) => setForm({ ...form, replicas: parseInt(e.target.value) || 1 })}
                    min={1}
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
                  disabled={createDeployment.isPending}
                >
                  {createDeployment.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  创建
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
      <div className="glass-card">
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
                <th className="px-6 py-4 font-medium">副本</th>
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
                        <DropdownMenuItem 
                          className="text-slate-300 hover:text-white focus:bg-slate-800"
                          onClick={() => handleOpenYaml(deploy.namespace, deploy.name)}
                        >
                          <Eye className="h-4 w-4 mr-2" /> 查看详情
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-slate-300 hover:text-white focus:bg-slate-800"
                          onClick={() => handleOpenYaml(deploy.namespace, deploy.name)}
                        >
                          <Edit className="h-4 w-4 mr-2" /> 编辑 YAML
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
                          <Copy className="h-4 w-4 mr-2" /> 扩缩容
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

      {/* YAML 编辑对话框 */}
      <Dialog open={isYamlOpen} onOpenChange={setIsYamlOpen}>
        <DialogContent className="max-w-5xl h-[700px] bg-slate-900 border-slate-700 flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Code className="h-5 w-5 text-sky-400" />
              编辑 Deployment YAML - {selectedDeployment?.name}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              命名空间: {selectedDeployment?.namespace}
            </DialogDescription>
          </DialogHeader>
          {selectedDeployment && (
            <DeploymentYamlEditor 
              namespace={selectedDeployment.namespace} 
              name={selectedDeployment.name}
              onClose={() => setIsYamlOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Deployment YAML Editor Component
function DeploymentYamlEditor({ namespace, name, onClose }: { namespace: string; name: string; onClose: () => void }) {
  const { data, isLoading, error } = useResourceYaml("deployments", namespace, name);
  const updateYaml = useUpdateResourceYaml("deployments");
  const [yamlContent, setYamlContent] = useState("");
  const { toast } = useToast();

  // 当数据加载完成后设置 yaml 内容
  React.useEffect(() => {
    if (data?.yaml) {
      setYamlContent(data.yaml);
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full flex-1">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-rose-400 flex items-center justify-center h-full flex-1">
        <AlertCircle className="h-5 w-5 inline mr-2" />
        加载 YAML 失败: {error instanceof Error ? error.message : "未知错误"}
      </div>
    );
  }

  const handleSave = () => {
    updateYaml.mutate(
      { namespace, name, yaml: yamlContent },
      {
        onSuccess: () => {
          toast({ title: "保存成功", description: `Deployment ${name} 已更新` });
          onClose();
        },
        onError: (error) => {
          toast({ title: "保存失败", description: error.message, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-auto mb-4">
        <Textarea
          value={yamlContent}
          onChange={(e) => setYamlContent(e.target.value)}
          className="h-full min-h-[500px] bg-slate-950 border-slate-700 font-mono text-sm text-slate-300 resize-none"
          spellCheck={false}
        />
      </div>
      <div className="text-xs text-slate-500 mb-2">
        注意：修改 YAML 后保存将更新 Deployment 配置。
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} className="text-slate-300">
          取消
        </Button>
        <Button
          onClick={handleSave}
          className="bg-sky-500 hover:bg-sky-600"
          disabled={updateYaml.isPending}
        >
          {updateYaml.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          保存
        </Button>
      </DialogFooter>
    </div>
  );
}
