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
import {
  Search,
  Plus,
  MoreHorizontal,
  RefreshCw,
  Edit,
  Trash2,
  HardDrive,
  Eye,
  Loader2,
} from "lucide-react";
import { usePVs } from "@/hooks/use-k8s";

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

const getStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    Bound: "text-emerald-400",
    Available: "text-sky-400",
    Released: "text-slate-400",
    Pending: "text-amber-400",
    Failed: "text-rose-400",
  };
  const dotStyles: Record<string, string> = {
    Bound: "bg-emerald-500",
    Available: "bg-sky-500",
    Released: "bg-slate-500",
    Pending: "bg-amber-500",
    Failed: "bg-rose-500",
  };
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${dotStyles[status] || "bg-slate-500"}`} />
      <span className={`${styles[status] || "text-slate-400"} font-medium`}>{status}</span>
    </div>
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

export default function PVPage() {
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: pvs, isLoading, refetch } = usePVs();
  
  // Ensure data is array
  const pvsList = Array.isArray(pvs) ? pvs : [];
  
  // Filter by search term
  const filteredPVs = pvsList.filter((pv) => pv.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const boundCount = pvsList.filter(p => p.status === "Bound").length;
  const availableCount = pvsList.filter(p => p.status === "Available").length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">持久卷 (PV)</h2>
          <p className="text-slate-400 text-sm mt-1">管理集群级别的持久化存储资源</p>
        </div>
        <div className="flex gap-4">
          <Button 
            variant="ghost" 
            className="glass-card px-4 py-2 text-sm text-slate-300"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button className="bg-sky-500 hover:bg-sky-600 px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-sky-500/20">
            <Plus className="h-4 w-4 mr-2" />
            创建 PV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">PV 总数</p>
          <p className="text-2xl font-bold text-white mt-2">{pvsList.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">已绑定</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{boundCount}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">可用</p>
          <p className="text-2xl font-bold text-sky-400 mt-2">{availableCount}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">总容量</p>
          <p className="text-2xl font-bold text-purple-400 mt-2">-</p>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card">
        <div className="p-4 border-b border-slate-800">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="搜索 PV..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-700"
            />
          </div>
        </div>
        {filteredPVs.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">名称</th>
                <th className="px-6 py-4 font-medium">状态</th>
                <th className="px-6 py-4 font-medium">容量</th>
                <th className="px-6 py-4 font-medium">访问模式</th>
                <th className="px-6 py-4 font-medium">回收策略</th>
                <th className="px-6 py-4 font-medium">存储类</th>
                <th className="px-6 py-4 font-medium">存活时间</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredPVs.map((pv) => (
                <tr key={pv.name} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-purple-400" />
                      <span className="font-mono font-bold text-sky-400">{pv.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(pv.status)}</td>
                  <td className="px-6 py-4 text-slate-300">{pv.capacity || "-"}</td>
                  <td className="px-6 py-4">
                    <Badge variant="secondary" className="bg-slate-800 text-xs">
                      {pv.accessModes?.join(", ") || "-"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-slate-400">{pv.reclaimPolicy || "-"}</td>
                  <td className="px-6 py-4">
                    <Badge variant="secondary" className="bg-slate-800 text-xs">{pv.storageClass || "-"}</Badge>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{formatAge(pv.createdAt)}</td>
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
                        <DropdownMenuItem className="text-rose-500 focus:bg-rose-500/10">
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
            <HardDrive className="h-12 w-12 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 text-sm">没有找到 PersistentVolume</p>
          </div>
        )}
      </div>
    </div>
  );
}
