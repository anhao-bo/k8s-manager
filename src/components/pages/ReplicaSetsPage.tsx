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
  Copy,
  MoreHorizontal,
} from "lucide-react";
import { useReplicaSets, useDeleteReplicaSet } from "@/hooks/use-k8s";
import { useToast } from "@/hooks/use-toast";

interface ReplicaSetsPageProps {
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

export default function ReplicaSetsPage({ namespace }: ReplicaSetsPageProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { toast } = useToast();
  
  const { data: replicasets, isLoading, refetch, isRefetching } = useReplicaSets();
  
  // Mutations
  const deleteReplicaSet = useDeleteReplicaSet();
  
  // Ensure data is array
  const replicasetsList = Array.isArray(replicasets) ? replicasets : [];
  
  // Filter by namespace and search term
  const filteredReplicaSets = replicasetsList.filter(
    (rs) => {
      const matchesNamespace = namespace === "default" || rs.namespace === namespace;
      const matchesSearch = rs.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesNamespace && matchesSearch;
    }
  );

  // Handle delete
  const handleDelete = (rsNamespace: string, rsName: string, hasOwner: boolean) => {
    if (hasOwner) {
      toast({ 
        title: "无法删除", 
        description: "此 ReplicaSet 由 Deployment 管理，请删除对应的 Deployment", 
        variant: "destructive" 
      });
      return;
    }
    
    if (confirm(`确定要删除 ReplicaSet "${rsName}" 吗？这将删除所有关联的 Pod。`)) {
      deleteReplicaSet.mutate(rsNamespace, rsName, {
        onSuccess: () => {
          toast({ title: "删除成功", description: `ReplicaSet ${rsName} 已删除` });
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
  const healthyCount = filteredReplicaSets.filter((rs) => rs.readyReplicas === rs.replicas).length;
  const unmanagedCount = filteredReplicaSets.filter((rs) => !rs.ownerRef).length;
  const managedCount = filteredReplicaSets.filter((rs) => rs.ownerRef).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">ReplicaSets</h2>
          <p className="text-slate-400 text-sm mt-1">管理 Pod 副本控制器，维护期望的 Pod 副本数量</p>
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
      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">ReplicaSets</p>
          <p className="text-2xl font-bold text-white mt-2">{filteredReplicaSets.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">健康</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{healthyCount}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">受管理 / 独立</p>
          <p className="text-2xl font-bold text-white mt-2">
            <span className="text-sky-400">{managedCount}</span>
            <span className="text-slate-500"> / </span>
            <span className="text-amber-400">{unmanagedCount}</span>
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card">
        <div className="p-4 border-b border-slate-800">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="搜索 ReplicaSet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-700"
            />
          </div>
        </div>
        {filteredReplicaSets.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">名称</th>
                <th className="px-6 py-4 font-medium">命名空间</th>
                <th className="px-6 py-4 font-medium">副本</th>
                <th className="px-6 py-4 font-medium">管理方</th>
                <th className="px-6 py-4 font-medium">存活时间</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredReplicaSets.map((rs) => (
                <tr key={`${rs.namespace}-${rs.name}`} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Copy className="h-4 w-4 text-purple-400" />
                      <span className="font-mono font-bold text-sky-400">{rs.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{rs.namespace}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={rs.readyReplicas === rs.replicas ? "text-emerald-400" : "text-amber-400"}>
                        {rs.readyReplicas}/{rs.replicas}
                      </span>
                      <Progress 
                        value={(rs.readyReplicas / Math.max(rs.replicas, 1)) * 100} 
                        className="w-12 h-1.5" 
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {rs.ownerRef ? (
                      <Badge className="bg-sky-500/10 text-sky-400 border-0">
                        {rs.ownerRef.kind}: {rs.ownerRef.name}
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/10 text-amber-400 border-0">
                        独立
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500">{formatAge(rs.createdAt)}</td>
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
                          className={`${rs.ownerRef ? "text-slate-500 cursor-not-allowed" : "text-rose-500 focus:bg-rose-500/10"}`}
                          onClick={() => handleDelete(rs.namespace, rs.name, !!rs.ownerRef)}
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
            <Copy className="h-12 w-12 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 text-sm">当前命名空间没有 ReplicaSet</p>
          </div>
        )}
      </div>
    </div>
  );
}
