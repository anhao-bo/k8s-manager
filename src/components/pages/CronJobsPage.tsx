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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  Plus,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Clock,
  Eye,
  Loader2,
  Pause,
  Play,
} from "lucide-react";
import { useCronJobs, useCreateCronJob, useDeleteCronJob, useNamespaces } from "@/hooks/use-k8s";
import { useToast } from "@/hooks/use-toast";

interface CronJobsPageProps {
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

// Format last schedule time
function formatLastSchedule(dateStr?: string): string {
  if (!dateStr) return "从未执行";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
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

export default function CronJobsPage({ namespace }: CronJobsPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    image: "",
    namespace: "default",
    schedule: "0 * * * *",
    command: "",
    suspend: false,
  });

  const { toast } = useToast();
  
  const { data: cronjobs, isLoading, refetch, isRefetching } = useCronJobs();
  const { data: namespaces } = useNamespaces();
  
  // Mutations
  const createCronJob = useCreateCronJob();
  const deleteCronJob = useDeleteCronJob();
  
  // Ensure data is array
  const cronjobsList = Array.isArray(cronjobs) ? cronjobs : [];
  const namespacesList = Array.isArray(namespaces) ? namespaces : [];
  
  // Filter by namespace and search term
  const filteredCronJobs = cronjobsList.filter(
    (cj) => {
      const matchesNamespace = namespace === "default" || cj.namespace === namespace;
      const matchesSearch = cj.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesNamespace && matchesSearch;
    }
  );

  // Handle create
  const handleCreate = () => {
    if (!form.name || !form.image || !form.schedule) {
      toast({ title: "表单不完整", description: "请填写名称、镜像和调度表达式", variant: "destructive" });
      return;
    }
    
    const command = form.command ? form.command.split(" ").filter(Boolean) : undefined;
    
    createCronJob.mutate({
      namespace: form.namespace,
      name: form.name,
      image: form.image,
      schedule: form.schedule,
      command,
      suspend: form.suspend,
    }, {
      onSuccess: () => {
        toast({ title: "创建成功", description: `CronJob ${form.name} 已创建` });
        setIsCreateOpen(false);
        setForm({ name: "", image: "", namespace: "default", schedule: "0 * * * *", command: "", suspend: false });
      },
      onError: (error) => {
        toast({ title: "创建失败", description: error.message, variant: "destructive" });
      },
    });
  };

  // Handle delete
  const handleDelete = (cjNamespace: string, cjName: string) => {
    if (confirm(`确定要删除 CronJob "${cjName}" 吗？这将删除所有关联的 Job。`)) {
      deleteCronJob.mutate(cjNamespace, cjName, {
        onSuccess: () => {
          toast({ title: "删除成功", description: `CronJob ${cjName} 已删除` });
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
  const activeCount = filteredCronJobs.filter((cj) => !cj.suspend).length;
  const suspendedCount = filteredCronJobs.filter((cj) => cj.suspend).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">CronJobs</h2>
          <p className="text-slate-400 text-sm mt-1">管理定时任务，按照 Cron 表达式周期性执行</p>
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
            创建 CronJob
          </Button>
          
          {/* Create Dialog */}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">创建 CronJob</DialogTitle>
                <DialogDescription className="text-slate-400">创建新的定时任务</DialogDescription>
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
                    placeholder="my-cronjob" 
                    className="col-span-3 bg-slate-800 border-slate-600" 
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-slate-300">镜像 *</Label>
                  <Input 
                    value={form.image}
                    onChange={(e) => setForm({ ...form, image: e.target.value })}
                    placeholder="busybox:latest" 
                    className="col-span-3 bg-slate-800 border-slate-600" 
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-slate-300">调度表达式 *</Label>
                  <Input 
                    value={form.schedule}
                    onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                    placeholder="0 * * * *" 
                    className="col-span-3 bg-slate-800 border-slate-600" 
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-slate-300">命令</Label>
                  <Input 
                    value={form.command}
                    onChange={(e) => setForm({ ...form, command: e.target.value })}
                    placeholder="echo hello (空格分隔)" 
                    className="col-span-3 bg-slate-800 border-slate-600" 
                  />
                </div>
                <div className="text-xs text-slate-500 col-span-4 text-center">
                  调度表达式格式：分 时 日 月 周 (例如: "0 * * * *" 每小时执行)
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="text-slate-300">取消</Button>
                <Button 
                  onClick={handleCreate} 
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
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">CronJobs</p>
          <p className="text-2xl font-bold text-white mt-2">{filteredCronJobs.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">活跃</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{activeCount}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">暂停</p>
          <p className="text-2xl font-bold text-amber-400 mt-2">{suspendedCount}</p>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card">
        <div className="p-4 border-b border-slate-800">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="搜索 CronJob..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-700"
            />
          </div>
        </div>
        {filteredCronJobs.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">名称</th>
                <th className="px-6 py-4 font-medium">命名空间</th>
                <th className="px-6 py-4 font-medium">调度</th>
                <th className="px-6 py-4 font-medium">状态</th>
                <th className="px-6 py-4 font-medium">活跃Job</th>
                <th className="px-6 py-4 font-medium">上次执行</th>
                <th className="px-6 py-4 font-medium">存活时间</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredCronJobs.map((cj) => (
                <tr key={`${cj.namespace}-${cj.name}`} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-purple-400" />
                      <span className="font-mono font-bold text-sky-400">{cj.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{cj.namespace}</span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-300">{cj.schedule}</td>
                  <td className="px-6 py-4">
                    {cj.suspend ? (
                      <Badge className="bg-amber-500/10 text-amber-400 border-0">
                        <Pause className="h-3 w-3 mr-1" />
                        暂停
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-0">
                        <Play className="h-3 w-3 mr-1" />
                        活跃
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-300">{cj.activeJobs}</td>
                  <td className="px-6 py-4 text-slate-400 text-xs">{formatLastSchedule(cj.lastScheduleTime)}</td>
                  <td className="px-6 py-4 text-slate-500">{formatAge(cj.createdAt)}</td>
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
                        <DropdownMenuSeparator className="bg-slate-700" />
                        <DropdownMenuItem 
                          className="text-rose-500 focus:bg-rose-500/10"
                          onClick={() => handleDelete(cj.namespace, cj.name)}
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
            <Clock className="h-12 w-12 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 text-sm">当前命名空间没有 CronJob</p>
          </div>
        )}
      </div>
    </div>
  );
}
