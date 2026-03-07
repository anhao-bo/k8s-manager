"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  RefreshCw,
  Trash2,
  Eye,
  Loader2,
  Gauge,
  MoreHorizontal,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useHPAs, useDeleteHPA } from "@/hooks/use-k8s";
import { useToast } from "@/hooks/use-toast";

interface HPAPageProps {
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
        <div className="h-10 w-24 bg-slate-800 rounded" />
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

export default function HPAPage({ namespace }: HPAPageProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { toast } = useToast();
  
  const { data: hpas, isLoading, refetch, isRefetching } = useHPAs();
  
  // Mutations
  const deleteHPA = useDeleteHPA();
  
  // Ensure data is array
  const hpasList = Array.isArray(hpas) ? hpas : [];
  
  // Filter by namespace and search term
  const filteredHPAs = hpasList.filter(
    (hpa) => {
      const matchesNamespace = namespace === "default" || hpa.namespace === namespace;
      const matchesSearch = hpa.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesNamespace && matchesSearch;
    }
  );

  // Handle delete
  const handleDelete = (hpaNamespace: string, hpaName: string) => {
    if (confirm(`确定要删除 HPA "${hpaName}" 吗？`)) {
      deleteHPA.mutate(hpaNamespace, hpaName, {
        onSuccess: () => {
          toast({ title: "删除成功", description: `HPA ${hpaName} 已删除` });
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
  const scalingUp = filteredHPAs.filter((hpa) => hpa.desiredReplicas > hpa.currentReplicas).length;
  const scalingDown = filteredHPAs.filter((hpa) => hpa.desiredReplicas < hpa.currentReplicas).length;
  const stable = filteredHPAs.filter((hpa) => hpa.desiredReplicas === hpa.currentReplicas).length;
  const atMax = filteredHPAs.filter((hpa) => hpa.desiredReplicas === hpa.maxReplicas).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Horizontal Pod Autoscalers</h2>
          <p className="text-slate-400 text-sm mt-1">管理自动扩缩容策略，根据负载自动调整副本数</p>
        </div>
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
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">HPA 总数</p>
          <p className="text-2xl font-bold text-white mt-2">{filteredHPAs.length}</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-emerald-400" />
            <p className="text-slate-400 text-xs">扩容中</p>
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{scalingUp}</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4 text-amber-400" />
            <p className="text-slate-400 text-xs">缩容中</p>
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-2">{scalingDown}</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-rose-400" />
            <p className="text-slate-400 text-xs">已达最大</p>
          </div>
          <p className="text-2xl font-bold text-rose-400 mt-2">{atMax}</p>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card">
        <div className="p-4 border-b border-slate-800">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="搜索 HPA..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-700"
            />
          </div>
        </div>
        {filteredHPAs.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">名称</th>
                <th className="px-6 py-4 font-medium">命名空间</th>
                <th className="px-6 py-4 font-medium">目标引用</th>
                <th className="px-6 py-4 font-medium">副本范围</th>
                <th className="px-6 py-4 font-medium">当前/期望</th>
                <th className="px-6 py-4 font-medium">CPU 使用率</th>
                <th className="px-6 py-4 font-medium">存活时间</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredHPAs.map((hpa) => {
                // Find CPU metric
                const cpuMetric = hpa.currentMetrics.find((m) => m.name === "cpu" || m.type === "Resource");
                const cpuUtilization = cpuMetric?.currentUtilization || 0;
                const scalePercent = ((hpa.currentReplicas - hpa.minReplicas) / Math.max(hpa.maxReplicas - hpa.minReplicas, 1)) * 100;
                
                return (
                  <tr key={`${hpa.namespace}-${hpa.name}`} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-sky-400" />
                        <span className="font-mono font-bold text-sky-400">{hpa.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{hpa.namespace}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs">
                        <span className="text-slate-400">{hpa.scaleTargetRef.kind}/</span>
                        <span className="text-sky-300">{hpa.scaleTargetRef.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-300">{hpa.minReplicas} - {hpa.maxReplicas}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`${hpa.desiredReplicas > hpa.currentReplicas ? "text-emerald-400" : hpa.desiredReplicas < hpa.currentReplicas ? "text-amber-400" : "text-slate-300"}`}>
                          {hpa.currentReplicas} / {hpa.desiredReplicas}
                        </span>
                        {hpa.desiredReplicas > hpa.currentReplicas && (
                          <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                        )}
                        {hpa.desiredReplicas < hpa.currentReplicas && (
                          <ArrowDownRight className="h-3 w-3 text-amber-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16">
                          <Progress 
                            value={cpuUtilization ? Math.min(cpuUtilization, 100) : 0} 
                            className="h-1.5"
                          />
                        </div>
                        <span className="text-xs text-slate-400">
                          {cpuUtilization ? `${cpuUtilization}%` : "N/A"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{formatAge(hpa.createdAt)}</td>
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
                            onClick={() => handleDelete(hpa.namespace, hpa.name)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> 删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center">
            <Gauge className="h-12 w-12 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 text-sm">当前命名空间没有 HPA</p>
          </div>
        )}
      </div>
    </div>
  );
}
