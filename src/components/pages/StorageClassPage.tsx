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
  Check,
  Loader2,
} from "lucide-react";
import { useStorageClasses } from "@/hooks/use-k8s";

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

export default function StorageClassPage() {
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: storageClasses, isLoading, refetch } = useStorageClasses();
  
  // Ensure data is array
  const scList = Array.isArray(storageClasses) ? storageClasses : [];
  
  // Filter by search term
  const filteredStorageClasses = scList.filter((sc) => 
    sc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const defaultCount = scList.filter(s => s.default).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">存储类</h2>
          <p className="text-slate-400 text-sm mt-1">管理动态存储供应配置</p>
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
            创建存储类
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">存储类</p>
          <p className="text-2xl font-bold text-white mt-2">{scList.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">默认存储类</p>
          <p className="text-2xl font-bold text-sky-400 mt-2">{defaultCount}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">支持扩容</p>
          <p className="text-2xl font-bold text-purple-400 mt-2">
            {scList.filter(s => s.allowVolumeExpansion).length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card">
        <div className="p-4 border-b border-slate-800">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="搜索存储类..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-700"
            />
          </div>
        </div>
        {filteredStorageClasses.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">名称</th>
                <th className="px-6 py-4 font-medium">供应者</th>
                <th className="px-6 py-4 font-medium">回收策略</th>
                <th className="px-6 py-4 font-medium">绑定模式</th>
                <th className="px-6 py-4 font-medium">可扩容</th>
                <th className="px-6 py-4 font-medium">默认</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredStorageClasses.map((sc) => (
                <tr key={sc.name} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-purple-400" />
                      <span className="font-mono font-bold text-sky-400">{sc.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-400">{sc.provisioner}</td>
                  <td className="px-6 py-4 text-slate-300">{sc.reclaimPolicy}</td>
                  <td className="px-6 py-4 text-slate-400 text-xs">{sc.volumeBindingMode}</td>
                  <td className="px-6 py-4">
                    {sc.allowVolumeExpansion ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {sc.default ? (
                      <Badge className="bg-sky-500/20 text-sky-400 border-0">默认</Badge>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
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
                        {!sc.default && (
                          <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800">
                            <Check className="h-4 w-4 mr-2" /> 设为默认
                          </DropdownMenuItem>
                        )}
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
            <p className="text-slate-400 text-sm">没有找到 StorageClass</p>
          </div>
        )}
      </div>
    </div>
  );
}
