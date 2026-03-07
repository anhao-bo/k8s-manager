"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Shield,
  Users,
  Key,
  Eye,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useServiceAccounts, useRoles, useRoleBindings } from "@/hooks/use-k8s";

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
      <div className="flex items-center justify-between">
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

export default function RBACPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("roles");

  // Fetch real K8s data
  const { data: serviceAccounts, isLoading: saLoading, refetch: refetchSA, error: saError } = useServiceAccounts();
  const { data: roles, isLoading: rolesLoading, refetch: refetchRoles, error: rolesError } = useRoles();
  const { data: roleBindings, isLoading: bindingsLoading, refetch: refetchBindings, error: bindingsError } = useRoleBindings();

  const isLoading = saLoading || rolesLoading || bindingsLoading;
  const error = saError || rolesError || bindingsError;

  // Ensure data is arrays
  const serviceAccountsList = Array.isArray(serviceAccounts) ? serviceAccounts : [];
  const rolesList = Array.isArray(roles) ? roles : [];
  const roleBindingsList = Array.isArray(roleBindings) ? roleBindings : [];

  const filteredRoles = rolesList.filter((role) =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.namespace.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredBindings = roleBindingsList.filter((binding) =>
    binding.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    binding.namespace.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredServiceAccounts = serviceAccountsList.filter((sa) =>
    sa.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sa.namespace.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRefresh = () => {
    refetchSA();
    refetchRoles();
    refetchBindings();
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">RBAC 管理</h2>
          <p className="text-slate-400 text-sm mt-1">管理角色、角色绑定和服务账户</p>
        </div>
        <div className="flex gap-4">
          <Button 
            variant="ghost" 
            className="glass-card px-4 py-2 text-sm text-slate-300"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button className="bg-sky-500 hover:bg-sky-600 px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-sky-500/20">
            <Plus className="h-4 w-4 mr-2" />
            创建角色
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">角色</p>
          <p className="text-2xl font-bold text-white mt-2">{rolesList.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">角色绑定</p>
          <p className="text-2xl font-bold text-sky-400 mt-2">{roleBindingsList.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs">服务账户</p>
          <p className="text-2xl font-bold text-purple-400 mt-2">{serviceAccountsList.length}</p>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="glass-card p-4 border-rose-500/50 bg-rose-500/10">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">无法加载 RBAC 数据，请检查集群连接</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-900 border border-slate-700">
          <TabsTrigger value="roles" className="gap-2 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
            <Shield className="h-4 w-4" />
            角色
          </TabsTrigger>
          <TabsTrigger value="bindings" className="gap-2 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
            <Key className="h-4 w-4" />
            角色绑定
          </TabsTrigger>
          <TabsTrigger value="serviceaccounts" className="gap-2 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
            <Users className="h-4 w-4" />
            服务账户
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-4">
          <div className="glass-card">
            <div className="p-4 border-b border-slate-800">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="搜索角色..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-slate-900 border-slate-700"
                />
              </div>
            </div>
            {filteredRoles.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-medium">名称</th>
                    <th className="px-6 py-4 font-medium">命名空间</th>
                    <th className="px-6 py-4 font-medium">类型</th>
                    <th className="px-6 py-4 font-medium">规则数</th>
                    <th className="px-6 py-4 font-medium">存活时间</th>
                    <th className="px-6 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredRoles.map((role, index) => (
                    <tr key={`${role.namespace}-${role.name}-${index}`} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-amber-400" />
                          <span className="font-mono font-bold text-sky-400">{role.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{role.namespace || "cluster-wide"}</span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className="bg-slate-800 text-xs">{role.type}</Badge>
                      </td>
                      <td className="px-6 py-4 text-slate-300">{role.rules}</td>
                      <td className="px-6 py-4 text-slate-500">{formatAge(role.createdAt)}</td>
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
                <Shield className="h-12 w-12 mx-auto text-slate-600 mb-4" />
                <p className="text-slate-400 text-sm">
                  {error ? "无法加载角色数据" : "没有找到角色"}
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="bindings" className="space-y-4">
          <div className="glass-card">
            <div className="p-4 border-b border-slate-800">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="搜索角色绑定..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-slate-900 border-slate-700"
                />
              </div>
            </div>
            {filteredBindings.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-medium">名称</th>
                    <th className="px-6 py-4 font-medium">命名空间</th>
                    <th className="px-6 py-4 font-medium">角色</th>
                    <th className="px-6 py-4 font-medium">主体</th>
                    <th className="px-6 py-4 font-medium">类型</th>
                    <th className="px-6 py-4 font-medium">存活时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredBindings.map((binding, index) => (
                    <tr key={`${binding.namespace}-${binding.name}-${index}`} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4 text-emerald-400" />
                          <span className="font-mono font-bold text-sky-400">{binding.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{binding.namespace || "cluster-wide"}</span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">{binding.roleName}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">
                        {binding.subjects?.slice(0, 2).join(", ")}
                        {binding.subjects && binding.subjects.length > 2 && ` +${binding.subjects.length - 2}`}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className="bg-slate-800 text-xs">{binding.type}</Badge>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{formatAge(binding.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center">
                <Key className="h-12 w-12 mx-auto text-slate-600 mb-4" />
                <p className="text-slate-400 text-sm">
                  {error ? "无法加载角色绑定数据" : "没有找到角色绑定"}
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="serviceaccounts" className="space-y-4">
          <div className="glass-card">
            <div className="p-4 border-b border-slate-800">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="搜索服务账户..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-slate-900 border-slate-700"
                />
              </div>
            </div>
            {filteredServiceAccounts.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-medium">名称</th>
                    <th className="px-6 py-4 font-medium">命名空间</th>
                    <th className="px-6 py-4 font-medium">密钥</th>
                    <th className="px-6 py-4 font-medium">存活时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredServiceAccounts.map((sa, index) => (
                    <tr key={`${sa.namespace}-${sa.name}-${index}`} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-purple-400" />
                          <span className="font-mono font-bold text-sky-400">{sa.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{sa.namespace}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-300">{sa.secrets}</td>
                      <td className="px-6 py-4 text-slate-500">{formatAge(sa.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center">
                <Users className="h-12 w-12 mx-auto text-slate-600 mb-4" />
                <p className="text-slate-400 text-sm">
                  {error ? "无法加载服务账户数据" : "没有找到服务账户"}
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
