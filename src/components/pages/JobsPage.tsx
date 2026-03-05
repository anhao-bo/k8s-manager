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
  Play,
  Search,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Timer,
  RotateCcw,
  MoreHorizontal,
  Pause,
  Square,
  Eye,
  Trash2,
  Calendar,
  Loader2,
} from "lucide-react";
import { useJobs } from "@/hooks/use-k8s";

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

// Format duration
function formatDuration(startTime?: string, completionTime?: string): string {
  if (!startTime) return "-";
  
  const start = new Date(startTime);
  const end = completionTime ? new Date(completionTime) : new Date();
  const diff = Math.floor((end.getTime() - start.getTime()) / 1000);
  
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
  
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

const getStatusBadge = (status: string) => {
  const config: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
    Completed: { color: "text-green-400", bg: "bg-green-500/10", icon: CheckCircle2 },
    Running: { color: "text-sky-400", bg: "bg-sky-500/10", icon: Play },
    Pending: { color: "text-amber-400", bg: "bg-amber-500/10", icon: Timer },
    Failed: { color: "text-rose-400", bg: "bg-rose-500/10", icon: XCircle },
  };
  const c = config[status] || config.Pending;
  const Icon = c.icon;
  return (
    <Badge className={`${c.bg} ${c.color} border-0`}>
      <Icon className="h-3 w-3 mr-1" />
      {status === "Completed" ? "完成" : status === "Running" ? "运行中" : status === "Failed" ? "失败" : "等待中"}
    </Badge>
  );
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
      <div className="grid gap-4 grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
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

export default function JobsPage() {
  const [activeTab, setActiveTab] = useState("jobs");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: jobs, isLoading, refetch } = useJobs();
  
  // Ensure data is array
  const jobsList = Array.isArray(jobs) ? jobs : [];

  const filteredJobs = jobsList.filter(
    (j) => j.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            j.namespace.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const completedCount = filteredJobs.filter(j => j.status === "Completed").length;
  const runningCount = filteredJobs.filter(j => j.status === "Running").length;
  const failedCount = filteredJobs.filter(j => j.status === "Failed").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Play className="text-sky-400 h-7 w-7" />
            Jobs 任务管理
          </h1>
          <p className="text-slate-400 text-sm mt-1">管理一次性任务和定时任务</p>
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
            <Plus className="h-4 w-4 mr-2" /> 创建任务
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 rounded-lg">
              <Play className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{jobsList.length}</p>
              <p className="text-xs text-slate-400">总任务数</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{completedCount}</p>
              <p className="text-xs text-slate-400">已完成</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Timer className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{runningCount}</p>
              <p className="text-xs text-slate-400">运行中</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/10 rounded-lg">
              <XCircle className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{failedCount}</p>
              <p className="text-xs text-slate-400">失败</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          placeholder="搜索任务..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-slate-900 border-slate-700"
        />
      </div>

      {/* Jobs Table */}
      <div className="glass-card overflow-hidden">
        {filteredJobs.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">名称</th>
                <th className="px-6 py-4 font-medium">命名空间</th>
                <th className="px-6 py-4 font-medium">完成进度</th>
                <th className="px-6 py-4 font-medium">持续时间</th>
                <th className="px-6 py-4 font-medium">状态</th>
                <th className="px-6 py-4 font-medium">存活时间</th>
                <th className="px-6 py-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredJobs.map((job) => (
                <tr key={`${job.namespace}-${job.name}`} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Play className="h-4 w-4 text-sky-400" />
                      <span className="font-mono text-sky-400">{job.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge className="bg-slate-700 text-slate-300">{job.namespace}</Badge>
                  </td>
                  <td className="px-6 py-4 text-white">{job.succeeded}/{job.completions}</td>
                  <td className="px-6 py-4 text-slate-400">{formatDuration(job.startTime, job.completionTime)}</td>
                  <td className="px-6 py-4">{getStatusBadge(job.status)}</td>
                  <td className="px-6 py-4 text-slate-500">{formatAge(job.createdAt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {job.status === "Running" && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-400 hover:text-amber-300">
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      {(job.status === "Running" || job.status === "Pending") && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-400 hover:text-rose-300">
                          <Square className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center">
            <Play className="h-12 w-12 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 text-sm">没有找到 Job 任务</p>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">创建任务</DialogTitle>
            <DialogDescription className="text-slate-400">
              创建一次性任务
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-300">名称</label>
                <Input placeholder="my-job" className="bg-slate-800 border-slate-700" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-300">命名空间</label>
                <Input placeholder="default" className="bg-slate-800 border-slate-700" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-300">镜像</label>
              <Input placeholder="busybox:latest" className="bg-slate-800 border-slate-700" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-300">命令</label>
              <Input placeholder='["echo", "hello"]' className="bg-slate-800 border-slate-700 font-mono text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-300">重试次数</label>
                <Input placeholder="3" type="number" className="bg-slate-800 border-slate-700" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-300">并行数</label>
                <Input placeholder="1" type="number" className="bg-slate-800 border-slate-700" />
              </div>
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
