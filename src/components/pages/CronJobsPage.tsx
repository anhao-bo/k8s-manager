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
import { Label } from "@/components/ui/label";
import {
  Clock,
  Search,
  Plus,
  RefreshCw,
  Play,
  Pause,
  MoreHorizontal,
  Info,
  Trash2,
  Loader2,
  Calendar,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useCronJobs,
  useDeleteCronJob,
  useSuspendCronJob,
  useTriggerCronJob,
  useCronJobDetail,
  useCreateCronJob,
  useNamespaces,
} from "@/hooks/use-k8s";
import { useToast } from "@/hooks/use-toast";

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

const getStatusBadge = (suspend: boolean) => {
  if (suspend) {
    return <Badge variant="outline" className="text-amber-400 border-amber-400">已暂停</Badge>;
  }
  return <Badge variant="outline" className="text-emerald-400 border-emerald-400">运行中</Badge>;
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

// CronJob Detail Content Component
function CronJobDetailContent({ namespace, name }: { namespace: string; name: string }) {
  const { data, isLoading, error } = useCronJobDetail(namespace, name);
  
  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>;
  if (error) return <div className="text-rose-400 p-4">加载失败: {error instanceof Error ? error.message : "未知错误"}</div>;
  if (!data) return null;
  
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-slate-400 text-xs">名称</p>
          <p className="text-white font-mono">{data.name}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">命名空间</p>
          <p className="text-white">{data.namespace}</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div>
          <p className="text-slate-400 text-xs">调度</p>
          <p className="text-amber-400 font-mono">{data.schedule}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">状态</p>
          <p className="text-white">{data.suspend ? "已暂停" : "运行中"}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">并发策略</p>
          <p className="text-white">{data.concurrencyPolicy}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">活跃 Job</p>
          <p className="text-white">{data.activeJobs?.length || 0}</p>
        </div>
      </div>
      {data.containers && data.containers.length > 0 && (
        <div>
          <p className="text-slate-400 text-xs mb-2">容器</p>
          <div className="space-y-2">
            {data.containers.map((container, idx) => (
              <div key={idx} className="bg-slate-800 p-3 rounded-lg">
                <p className="font-mono text-sky-400">{container.name}</p>
                <p className="text-slate-400 text-xs">{container.image}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CronJobsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<{ namespace: string; name: string } | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    image: "",
    namespace: "default",
    schedule: "*/5 * * * *",
    suspend: false,
  });

  const { toast } = useToast();
  
  const { data: cronJobs, isLoading, refetch, isRefetching } = useCronJobs();
  const { data: namespaces } = useNamespaces();
  const deleteCronJob = useDeleteCronJob();
  const suspendCronJob = useSuspendCronJob();
  const triggerCronJob = useTriggerCronJob();
  const createCronJob = useCreateCronJob();

  const cronJobsList = Array.isArray(cronJobs) ? cronJobs : [];
  const namespacesList = Array.isArray(namespaces) ? namespaces : [];

  const filteredCronJobs = cronJobsList.filter(
    (cj) => cj.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            cj.namespace.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteCronJob = (ns: string, name: string) => {
    if (confirm(`确定要删除 CronJob "${name}" 吗？`)) {
      deleteCronJob.mutate(ns, name, {
        onSuccess: () => toast({ title: "删除成功", description: `CronJob ${name} 已删除` }),
        onError: (error) => toast({ title: "删除失败", description: error.message, variant: "destructive" }),
      });
    }
  };

  const handleSuspendCronJob = (ns: string, name: string, currentSuspend: boolean) => {
    const action = currentSuspend ? "恢复" : "暂停";
    if (confirm(`确定要${action} CronJob "${name}" 吗？`)) {
      suspendCronJob.mutate(ns, name, !currentSuspend, {
        onSuccess: () => toast({ title: `${action}成功`, description: `CronJob ${name} 已${action}` }),
        onError: (error) => toast({ title: `${action}失败`, description: error.message, variant: "destructive" }),
      });
    }
  };

  const handleTriggerCronJob = (ns: string, name: string) => {
    if (confirm(`确定要手动触发 CronJob "${name}" 吗？`)) {
      triggerCronJob.mutate(ns, name, {
        onSuccess: () => toast({ title: "触发成功", description: `CronJob ${name} 已手动触发` }),
        onError: (error) => toast({ title: "触发失败", description: error.message, variant: "destructive" }),
      });
    }
  };

  const handleViewDetail = (ns: string, name: string) => {
    setSelectedResource({ namespace: ns, name });
    setIsDetailOpen(true);
  };

  // Handle create CronJob
  const handleCreateCronJob = () => {
    if (!createForm.name || !createForm.image || !createForm.schedule) {
      toast({
        title: "表单不完整",
        description: "请填写名称、镜像和调度表达式",
        variant: "destructive",
      });
      return;
    }

    createCronJob.mutate(
      {
        namespace: createForm.namespace,
        name: createForm.name,
        image: createForm.image,
        schedule: createForm.schedule,
        suspend: createForm.suspend,
      },
      {
        onSuccess: () => {
          toast({ title: "创建成功", description: `CronJob ${createForm.name} 已创建` });
          setIsCreateOpen(false);
          setCreateForm({ name: "", image: "", namespace: "default", schedule: "*/5 * * * *", suspend: false });
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

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Clock className="text-sky-400 h-7 w-7" />
            CronJobs 定时任务
          </h1>
          <p className="text-slate-400 text-sm mt-1">管理定时执行的任务</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="border-slate-700 text-slate-300"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            {isRefetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />} 
            刷新
          </Button>
          <Button 
            className="bg-sky-500 hover:bg-sky-600 text-white"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" /> 创建 CronJob
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 rounded-lg">
              <Calendar className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{cronJobsList.length}</p>
              <p className="text-xs text-slate-400">总 CronJob 数</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Play className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{cronJobsList.filter(cj => !cj.suspend).length}</p>
              <p className="text-xs text-slate-400">运行中</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Pause className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{cronJobsList.filter(cj => cj.suspend).length}</p>
              <p className="text-xs text-slate-400">已暂停</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          placeholder="搜索 CronJob..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-slate-900 border-slate-700"
        />
      </div>

      {/* CronJobs Table */}
      <div className="glass-card overflow-hidden">
        {filteredCronJobs.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">名称</th>
                <th className="px-6 py-4 font-medium">命名空间</th>
                <th className="px-6 py-4 font-medium">调度</th>
                <th className="px-6 py-4 font-medium">状态</th>
                <th className="px-6 py-4 font-medium">上次调度</th>
                <th className="px-6 py-4 font-medium">存活时间</th>
                <th className="px-6 py-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredCronJobs.map((cj) => (
                <tr key={`${cj.namespace}-${cj.name}`} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-sky-400" />
                      <span className="font-mono text-sky-400">{cj.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge className="bg-slate-700 text-slate-300">{cj.namespace}</Badge>
                  </td>
                  <td className="px-6 py-4 font-mono text-amber-400">{cj.schedule}</td>
                  <td className="px-6 py-4">{getStatusBadge(cj.suspend)}</td>
                  <td className="px-6 py-4 text-slate-400 text-xs">{cj.lastSchedule || "-"}</td>
                  <td className="px-6 py-4 text-slate-500">{formatAge(cj.createdAt)}</td>
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
                        <DropdownMenuItem 
                          className="text-slate-300 hover:text-white focus:bg-slate-800"
                          onClick={() => handleViewDetail(cj.namespace, cj.name)}
                        >
                          <Info className="h-4 w-4 mr-2" />详情
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-slate-300 hover:text-white focus:bg-slate-800"
                          onClick={() => handleSuspendCronJob(cj.namespace, cj.name, cj.suspend)}
                        >
                          {cj.suspend ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                          {cj.suspend ? "恢复" : "暂停"}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-slate-300 hover:text-white focus:bg-slate-800"
                          onClick={() => handleTriggerCronJob(cj.namespace, cj.name)}
                        >
                          <Play className="h-4 w-4 mr-2" />手动触发
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-700" />
                        <DropdownMenuItem 
                          className="text-rose-500 focus:bg-rose-500/10"
                          onClick={() => handleDeleteCronJob(cj.namespace, cj.name)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />删除
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
            <Clock className="h-12 w-12 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 text-sm">没有找到 CronJob</p>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-sky-400" />
              CronJob 详情 - {selectedResource?.name}
            </DialogTitle>
            <DialogDescription className="text-slate-400">命名空间: {selectedResource?.namespace}</DialogDescription>
          </DialogHeader>
          {selectedResource && <CronJobDetailContent namespace={selectedResource.namespace} name={selectedResource.name} />}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">创建 CronJob</DialogTitle>
            <DialogDescription className="text-slate-400">创建定时执行的任务</DialogDescription>
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
                placeholder="my-cronjob"
                className="col-span-3 bg-slate-800 border-slate-600"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-slate-300">镜像 *</Label>
              <Input
                value={createForm.image}
                onChange={(e) => setCreateForm({ ...createForm, image: e.target.value })}
                placeholder="busybox:latest"
                className="col-span-3 bg-slate-800 border-slate-600"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-slate-300">调度 *</Label>
              <Input
                value={createForm.schedule}
                onChange={(e) => setCreateForm({ ...createForm, schedule: e.target.value })}
                placeholder="*/5 * * * *"
                className="col-span-3 bg-slate-800 border-slate-600 font-mono"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-slate-300">暂停</Label>
              <div className="col-span-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={createForm.suspend}
                  onChange={(e) => setCreateForm({ ...createForm, suspend: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800"
                />
                <span className="text-sm text-slate-400">创建后暂停执行</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="text-slate-300">
              取消
            </Button>
            <Button
              onClick={handleCreateCronJob}
              className="bg-sky-500 hover:bg-sky-600"
              disabled={createCronJob.isPending}
            >
              {createCronJob.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
