"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  Plus,
  MoreHorizontal,
  RefreshCw,
  Play,
  Terminal,
  Trash2,
  Edit,
  Copy,
  Download,
  Container,
  Boxes,
  Funnel,
  FileText,
  Loader2,
  AlertCircle,
  X,
  Code,
} from "lucide-react";
import { 
  usePods, 
  useDeployments, 
  useDeletePod, 
  useDeleteDeployment,
  useScaleDeployment, 
  useRestartDeployment,
  useCreatePod,
  useCreateDeployment,
  useNamespaces,
  usePodLogs,
  usePodYaml,
  useUpdatePodYaml,
} from "@/hooks/use-k8s";
import { useToast } from "@/hooks/use-toast";
import dynamic from "next/dynamic";

// 动态导入 PodTerminal 以避免 xterm.js SSR 错误
const PodTerminal = dynamic(() => import("@/components/ui/PodTerminal"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-[#0a0a0f] rounded-lg">
      <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
    </div>
  ),
});

interface WorkloadsPageProps {
  namespace: string;
}

const getStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    Running: "text-emerald-400",
    Pending: "text-amber-400",
    CrashLoopBackOff: "text-rose-400",
    Error: "text-rose-400",
    Failed: "text-rose-400",
    Completed: "text-sky-400",
    Succeeded: "text-emerald-400",
  };
  const dotStyles: Record<string, string> = {
    Running: "bg-emerald-500",
    Pending: "bg-amber-500",
    CrashLoopBackOff: "bg-rose-500",
    Error: "bg-rose-500",
    Failed: "bg-rose-500",
    Completed: "bg-sky-500",
    Succeeded: "bg-emerald-500",
  };
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${dotStyles[status] || "bg-slate-500"} status-pulse`} />
      <span className={`${styles[status] || "text-slate-400"} font-medium`}>{status}</span>
    </div>
  );
};

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
          <div className="h-10 w-32 bg-slate-800 rounded" />
        </div>
      </div>
      <div className="h-12 bg-slate-800 rounded" />
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

export default function WorkloadsPage({ namespace }: WorkloadsPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pods");
  const [isCreatePodOpen, setIsCreatePodOpen] = useState(false);
  const [isCreateDeployOpen, setIsCreateDeployOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isYamlOpen, setIsYamlOpen] = useState(false);
  const [selectedPod, setSelectedPod] = useState<{ namespace: string; name: string } | null>(null);
  const [yamlContent, setYamlContent] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Form states
  const [podForm, setPodForm] = useState({
    name: "",
    image: "",
    namespace: "default",
  });
  const [deployForm, setDeployForm] = useState({
    name: "",
    image: "",
    namespace: "default",
    replicas: 1,
    port: 80,
  });
  
  const { toast } = useToast();

  // Fetch real K8s data
  const { data: pods, isLoading: podsLoading, error: podsError, refetch: refetchPods, isRefetching: isRefetchingPods } = usePods();
  const { data: deployments, isLoading: deploymentsLoading, refetch: refetchDeployments, isRefetching: isRefetchingDeployments } = useDeployments();
  const { data: namespaces } = useNamespaces();

  // Mutations
  const deletePod = useDeletePod();
  const deleteDeployment = useDeleteDeployment();
  const scaleDeployment = useScaleDeployment();
  const restartDeployment = useRestartDeployment();
  const createPod = useCreatePod();
  const createDeployment = useCreateDeployment();

  // Ensure data is arrays
  const podsList = Array.isArray(pods) ? pods : [];
  const deploymentsList = Array.isArray(deployments) ? deployments : [];
  const namespacesList = Array.isArray(namespaces) ? namespaces : [];

  // Filter pods by namespace and search term
  const filteredPods = podsList.filter(
    (p) => {
      const matchesNamespace = namespace === "default" || p.namespace === namespace;
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesNamespace && matchesSearch;
    }
  );

  // Filter deployments by namespace
  const filteredDeployments = deploymentsList.filter(
    (d) => namespace === "default" || d.namespace === namespace
  );

  const isLoading = podsLoading || deploymentsLoading;
  const isRefetching = isRefetchingPods || isRefetchingDeployments;

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchPods(), refetchDeployments()]);
      toast({
        title: "刷新成功",
        description: "工作负载数据已更新",
      });
    } catch (error) {
      toast({
        title: "刷新失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle pod delete
  const handleDeletePod = (podNamespace: string, podName: string) => {
    if (confirm(`确定要删除 Pod "${podName}" 吗？`)) {
      deletePod.mutate(podNamespace, podName, {
        onSuccess: () => {
          toast({ title: "删除成功", description: `Pod ${podName} 已删除` });
        },
        onError: (error) => {
          toast({ title: "删除失败", description: error.message, variant: "destructive" });
        },
      });
    }
  };

  // Handle deployment delete
  const handleDeleteDeployment = (deployNamespace: string, deployName: string) => {
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

  // Handle create pod
  const handleCreatePod = () => {
    if (!podForm.name || !podForm.image) {
      toast({ title: "表单不完整", description: "请填写名称和镜像", variant: "destructive" });
      return;
    }
    createPod.mutate({
      namespace: podForm.namespace,
      name: podForm.name,
      image: podForm.image,
    }, {
      onSuccess: () => {
        toast({ title: "创建成功", description: `Pod ${podForm.name} 已创建` });
        setIsCreatePodOpen(false);
        setPodForm({ name: "", image: "", namespace: "default" });
      },
      onError: (error) => {
        toast({ title: "创建失败", description: error.message, variant: "destructive" });
      },
    });
  };

  // Handle create deployment
  const handleCreateDeployment = () => {
    if (!deployForm.name || !deployForm.image) {
      toast({ title: "表单不完整", description: "请填写名称和镜像", variant: "destructive" });
      return;
    }
    createDeployment.mutate({
      namespace: deployForm.namespace,
      name: deployForm.name,
      image: deployForm.image,
      replicas: deployForm.replicas,
      containerPort: deployForm.port,
    }, {
      onSuccess: () => {
        toast({ title: "创建成功", description: `Deployment ${deployForm.name} 已创建` });
        setIsCreateDeployOpen(false);
        setDeployForm({ name: "", image: "", namespace: "default", replicas: 1, port: 80 });
      },
      onError: (error) => {
        toast({ title: "创建失败", description: error.message, variant: "destructive" });
      },
    });
  };

  // Handle view logs
  const handleViewLogs = (podNamespace: string, podName: string) => {
    setSelectedPod({ namespace: podNamespace, name: podName });
    setIsLogOpen(true);
  };

  // Handle open terminal
  const handleOpenTerminal = (podNamespace: string, podName: string) => {
    setSelectedPod({ namespace: podNamespace, name: podName });
    setIsTerminalOpen(true);
  };

  // Handle open YAML editor
  const handleOpenYaml = (podNamespace: string, podName: string) => {
    setSelectedPod({ namespace: podNamespace, name: podName });
    setIsYamlOpen(true);
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">工作负载</h2>
          <p className="text-slate-400 text-sm mt-1">管理集群内所有运行状态的容器实例</p>
        </div>
        <div className="flex gap-4">
          <Button 
            variant="ghost" 
            className="glass-card px-4 py-2 flex items-center gap-2 text-sm text-slate-300"
            onClick={handleRefresh}
            disabled={isRefreshing || isRefetching}
          >
            {isRefreshing || isRefetching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> 刷新中...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" /> 刷新
              </>
            )}
          </Button>
          
          {/* Create Pod Dialog - 只在 Pods 标签页显示 */}
          {activeTab === "pods" && (
            <Dialog open={isCreatePodOpen} onOpenChange={setIsCreatePodOpen}>
              <DialogTrigger asChild>
                <Button className="bg-sky-500 hover:bg-sky-600 px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-sky-500/20">
                  <Plus className="h-4 w-4" /> 创建 Pod
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">创建 Pod</DialogTitle>
                <DialogDescription className="text-slate-400">创建新的 Pod 工作负载</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-slate-300">命名空间</Label>
                  <Select value={podForm.namespace} onValueChange={(v) => setPodForm({ ...podForm, namespace: v })}>
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
                    value={podForm.name}
                    onChange={(e) => setPodForm({ ...podForm, name: e.target.value })}
                    placeholder="my-pod" 
                    className="col-span-3 bg-slate-800 border-slate-600" 
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-slate-300">镜像 *</Label>
                  <Input 
                    value={podForm.image}
                    onChange={(e) => setPodForm({ ...podForm, image: e.target.value })}
                    placeholder="nginx:latest" 
                    className="col-span-3 bg-slate-800 border-slate-600" 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsCreatePodOpen(false)} className="text-slate-300">
                  取消
                </Button>
                <Button 
                  onClick={handleCreatePod} 
                  className="bg-sky-500 hover:bg-sky-600"
                  disabled={createPod.isPending}
                >
                  {createPod.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  创建
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          )}

          {/* Create Deployment Dialog - 只在 Deployments 标签页显示 */}
          {activeTab === "deployments" && (
            <Dialog open={isCreateDeployOpen} onOpenChange={setIsCreateDeployOpen}>
              <DialogTrigger asChild>
                <Button className="bg-sky-500 hover:bg-sky-600 px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-sky-500/20">
                  <Plus className="h-4 w-4" /> 创建 Deployment
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">创建 Deployment</DialogTitle>
                <DialogDescription className="text-slate-400">创建新的 Deployment 工作负载</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-slate-300">命名空间</Label>
                  <Select value={deployForm.namespace} onValueChange={(v) => setDeployForm({ ...deployForm, namespace: v })}>
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
                    value={deployForm.name}
                    onChange={(e) => setDeployForm({ ...deployForm, name: e.target.value })}
                    placeholder="my-app" 
                    className="col-span-3 bg-slate-800 border-slate-600" 
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-slate-300">镜像 *</Label>
                  <Input 
                    value={deployForm.image}
                    onChange={(e) => setDeployForm({ ...deployForm, image: e.target.value })}
                    placeholder="nginx:latest" 
                    className="col-span-3 bg-slate-800 border-slate-600" 
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-slate-300">副本数</Label>
                  <Input 
                    type="number"
                    value={deployForm.replicas}
                    onChange={(e) => setDeployForm({ ...deployForm, replicas: parseInt(e.target.value) || 1 })}
                    min={1}
                    className="col-span-3 bg-slate-800 border-slate-600" 
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-slate-300">容器端口</Label>
                  <Input 
                    type="number"
                    value={deployForm.port}
                    onChange={(e) => setDeployForm({ ...deployForm, port: parseInt(e.target.value) || 80 })}
                    className="col-span-3 bg-slate-800 border-slate-600" 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsCreateDeployOpen(false)} className="text-slate-300">
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
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-900 border border-slate-700">
          <TabsTrigger value="pods" className="gap-2 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
            <Container className="h-4 w-4" />
            Pods ({filteredPods.length})
          </TabsTrigger>
          <TabsTrigger value="deployments" className="gap-2 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
            <Boxes className="h-4 w-4" />
            Deployments ({filteredDeployments.length})
          </TabsTrigger>
        </TabsList>

        {/* Pods Tab */}
        <TabsContent value="pods" className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="搜索 Pod..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-900 border-slate-700"
              />
            </div>
          </div>

          {/* Pods Table */}
          <div className="glass-card overflow-hidden">
            {filteredPods.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-medium">名称</th>
                    <th className="px-6 py-4 font-medium">命名空间</th>
                    <th className="px-6 py-4 font-medium">状态</th>
                    <th className="px-6 py-4 font-medium">就绪</th>
                    <th className="px-6 py-4 font-medium">重启</th>
                    <th className="px-6 py-4 font-medium">IP 地址</th>
                    <th className="px-6 py-4 font-medium">节点</th>
                    <th className="px-6 py-4 font-medium">运行时长</th>
                    <th className="px-6 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredPods.map((pod) => (
                    <tr key={`${pod.namespace}-${pod.name}`} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-sky-400">
                        {pod.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{pod.namespace}</span>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(pod.status)}</td>
                      <td className="px-6 py-4">
                        <span className={pod.readyContainers === pod.containers ? "text-emerald-400" : "text-amber-400"}>
                          {pod.readyContainers}/{pod.containers}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={pod.restarts > 10 ? "text-rose-400 font-bold" : ""}>{pod.restarts}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 font-mono text-xs">{pod.podIP || "-"}</td>
                      <td className="px-6 py-4 text-slate-400 text-xs">{pod.nodeName || "-"}</td>
                      <td className="px-6 py-4 text-slate-500">{formatAge(pod.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            title="编辑 YAML"
                            onClick={() => handleOpenYaml(pod.namespace, pod.name)}
                            className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
                          >
                            <Code className="h-4 w-4" />
                          </button>
                          <button
                            title="日志"
                            onClick={() => handleViewLogs(pod.namespace, pod.name)}
                            className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          <button
                            title="终端"
                            onClick={() => handleOpenTerminal(pod.namespace, pod.name)}
                            className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
                          >
                            <Terminal className="h-4 w-4" />
                          </button>
                          <button
                            title="删除"
                            onClick={() => handleDeletePod(pod.namespace, pod.name)}
                            className="p-1.5 hover:bg-rose-500/20 text-rose-500 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center">
                <Container className="h-12 w-12 mx-auto text-slate-600 mb-4" />
                <p className="text-slate-400 text-sm">
                  {podsError ? "无法加载 Pod 数据，请检查集群连接" : "当前命名空间没有 Pod"}
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Deployments Tab */}
        <TabsContent value="deployments" className="space-y-4">
          <div className="glass-card overflow-hidden">
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
                      <td className="px-6 py-4 font-mono font-bold text-sky-400">
                        {deploy.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">
                          {deploy.namespace}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={deploy.readyReplicas === deploy.replicas ? "text-emerald-400" : "text-amber-400"}>
                          {deploy.readyReplicas}/{deploy.replicas}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">{deploy.strategy}</td>
                      <td className="px-6 py-4 text-slate-500">{formatAge(deploy.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-slate-400">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                            <DropdownMenuLabel className="text-slate-400">操作</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-slate-700" />
                            <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800">
                              <Edit className="h-4 w-4 mr-2" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-slate-300 hover:text-white focus:bg-slate-800"
                              onClick={() => handleRestart(deploy.namespace, deploy.name)}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              重启
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-slate-300 hover:text-white focus:bg-slate-800"
                              onClick={() => handleScale(deploy.namespace, deploy.name, deploy.replicas)}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              扩缩容
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-700" />
                            <DropdownMenuItem 
                              className="text-rose-500 focus:bg-rose-500/10"
                              onClick={() => handleDeleteDeployment(deploy.namespace, deploy.name)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              删除
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
        </TabsContent>
      </Tabs>

      {/* Log Dialog */}
      <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}>
        <DialogContent className="max-w-4xl h-[600px] bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <FileText className="h-5 w-5 text-sky-400" />
              Pod 日志 - {selectedPod?.name}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              命名空间: {selectedPod?.namespace}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 bg-slate-950 rounded-lg p-4 font-mono text-sm text-green-400 overflow-auto h-[480px]">
            {selectedPod && (
              <PodLogContent namespace={selectedPod.namespace} name={selectedPod.name} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Terminal Dialog */}
      <Dialog open={isTerminalOpen} onOpenChange={setIsTerminalOpen}>
        <DialogContent className="max-w-5xl h-[700px] bg-slate-900 border-slate-700 p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Pod 终端 - {selectedPod?.name}</DialogTitle>
          </DialogHeader>
          {selectedPod && (
            <PodTerminal
              namespace={selectedPod.namespace}
              podName={selectedPod.name}
              onClose={() => setIsTerminalOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* YAML Edit Dialog */}
      <Dialog open={isYamlOpen} onOpenChange={setIsYamlOpen}>
        <DialogContent className="max-w-5xl h-[700px] bg-slate-900 border-slate-700 flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Code className="h-5 w-5 text-sky-400" />
              编辑 Pod YAML - {selectedPod?.name}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              命名空间: {selectedPod?.namespace}
            </DialogDescription>
          </DialogHeader>
          {selectedPod && (
            <PodYamlEditor 
              namespace={selectedPod.namespace} 
              name={selectedPod.name}
              onClose={() => setIsYamlOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Pod YAML Editor Component
function PodYamlEditor({ namespace, name, onClose }: { namespace: string; name: string; onClose: () => void }) {
  const { data, isLoading, error } = usePodYaml(namespace, name);
  const updatePodYaml = useUpdatePodYaml();
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
    updatePodYaml.mutate(
      { namespace, name, yaml: yamlContent },
      {
        onSuccess: (result: { status: string; message: string }) => {
          if (result.status === "no_change") {
            toast({ 
              title: "无变化", 
              description: result.message,
            });
          } else if (result.status === "updated") {
            toast({ 
              title: "更新成功", 
              description: result.message,
            });
          }
          onClose();
        },
        onError: (error: Error) => {
          // 检查是否是控制器管理的 Pod
          const errorMsg = error.message;
          if (errorMsg.includes("managed by")) {
            toast({ 
              title: "无法修改", 
              description: errorMsg,
              variant: "destructive",
            });
          } else {
            toast({ 
              title: "更新失败", 
              description: errorMsg, 
              variant: "destructive" 
            });
          }
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
        注意：修改 YAML 后保存将删除旧 Pod 并重新创建。由 Deployment/StatefulSet 等控制器管理的 Pod 无法直接修改。
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} className="text-slate-300">
          取消
        </Button>
        <Button
          onClick={handleSave}
          className="bg-sky-500 hover:bg-sky-600"
          disabled={updatePodYaml.isPending}
        >
          {updatePodYaml.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          保存
        </Button>
      </DialogFooter>
    </div>
  );
}

// Pod Log Content Component
function PodLogContent({ namespace, name }: { namespace: string; name: string }) {
  const { data, isLoading, error } = usePodLogs(namespace, name, "", 200);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-rose-400">
        <AlertCircle className="h-5 w-5 inline mr-2" />
        加载日志失败: {error instanceof Error ? error.message : "未知错误"}
      </div>
    );
  }
  
  const logs = data?.logs || "";
  
  if (!logs) {
    return <span className="text-slate-500">暂无日志</span>;
  }
  
  return (
    <pre className="whitespace-pre-wrap break-all">
      {logs.split('\n').map((line, i) => (
        <div key={i} className="hover:bg-slate-900/50 px-1">
          {line}
        </div>
      ))}
    </pre>
  );
}
