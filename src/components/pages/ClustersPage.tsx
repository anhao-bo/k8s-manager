"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Server,
  Cpu,
  Database,
  Globe,
  Plus,
  CheckCircle2,
  RefreshCw,
  Loader2,
  AlertCircle,
  Activity,
} from "lucide-react";
import { useClusterStatus, useClusterOverview, useNodes } from "@/hooks/use-k8s";
import { useToast } from "@/hooks/use-toast";

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-slate-800 rounded" />
        <div className="flex gap-4">
          <div className="h-10 w-32 bg-slate-800 rounded" />
          <div className="h-10 w-32 bg-slate-800 rounded" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-slate-800 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-64 bg-slate-800 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// Connection error display
function ConnectionError({ message, hint, onRetry, isRetrying }: { 
  message: string; 
  hint?: string;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">集群管理</h2>
          <p className="text-slate-400 text-sm mt-1">管理多集群环境和跨云部署</p>
        </div>
        <Button 
          className="bg-sky-500 hover:bg-sky-600 px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-sky-500/20"
          disabled
        >
          <Plus className="h-4 w-4 mr-2" />
          添加集群
        </Button>
      </div>
      <div className="glass-card p-12 text-center">
        <AlertCircle className="h-16 w-16 mx-auto text-amber-500 mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">无法连接到 Kubernetes 集群</h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto">{message}</p>
        {hint && (
          <p className="text-sky-400 text-sm mt-2 max-w-md mx-auto">{hint}</p>
        )}
        <Button
          onClick={onRetry}
          disabled={isRetrying}
          className="bg-sky-500 hover:bg-sky-600 mt-6"
        >
          {isRetrying ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              重新连接中...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              重新连接
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

const getStatusBadge = (connected: boolean) => {
  if (connected) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 status-pulse" />
        <span className="text-emerald-400 font-medium">Healthy</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-rose-500 status-pulse" />
      <span className="text-rose-400 font-medium">Disconnected</span>
    </div>
  );
};

export default function ClustersPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const { 
    data: status, 
    isLoading: statusLoading, 
    refetch: refetchStatus,
    isRefetching: isRefetchingStatus 
  } = useClusterStatus();
  
  const { 
    data: overview, 
    isLoading: overviewLoading, 
    refetch: refetchOverview,
    isRefetching: isRefetchingOverview 
  } = useClusterOverview();
  
  const { 
    data: nodesData, 
    refetch: refetchNodes,
    isRefetching: isRefetchingNodes 
  } = useNodes();

  const isLoading = statusLoading || overviewLoading;
  const isRefetching = isRefetchingStatus || isRefetchingOverview || isRefetchingNodes;

  // 刷新状态
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchStatus(),
        refetchOverview(),
        refetchNodes(),
      ]);
      toast({
        title: "刷新成功",
        description: "集群状态已更新",
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

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Show error if not connected
  if (status && !status.connected) {
    return (
      <ConnectionError 
        message={status.message} 
        hint={status.hint}
        onRetry={handleRefresh}
        isRetrying={isRefreshing || isRefetching}
      />
    );
  }

  // Ensure nodes is always an array
  const nodes = Array.isArray(nodesData) ? nodesData : [];

  // Calculate statistics
  const totalNodes = overview?.nodes || 0;
  const readyNodes = overview?.readyNodes || 0;
  const totalPods = overview?.pods || 0;
  const runningPods = overview?.runningPods || 0;
  const totalDeployments = overview?.deployments || 0;
  const totalServices = overview?.services || 0;
  const totalNamespaces = overview?.namespaces || 0;

  // Calculate node roles distribution
  const controlPlaneNodes = nodes.filter(n => n.roles.includes("control-plane") || n.roles.includes("master")).length;
  const workerNodes = nodes.filter(n => n.roles.includes("worker") || (!n.roles.includes("control-plane") && !n.roles.includes("master"))).length;

  // Health percentage
  const healthPercentage = totalNodes > 0 ? Math.round((readyNodes / totalNodes) * 100) : 0;
  const podHealthPercentage = totalPods > 0 ? Math.round((runningPods / totalPods) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">集群管理</h2>
          <p className="text-slate-400 text-sm mt-1">管理多集群环境和跨云部署</p>
        </div>
        <div className="flex gap-4">
          <Button 
            variant="ghost" 
            className="glass-card px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50"
            onClick={handleRefresh}
            disabled={isRefreshing || isRefetching}
          >
            {isRefreshing || isRefetching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                刷新中...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新状态
              </>
            )}
          </Button>
          <Button 
            className="bg-sky-500 hover:bg-sky-600 px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-sky-500/20"
            disabled
            title="单集群模式暂不支持添加集群"
          >
            <Plus className="h-4 w-4 mr-2" />
            添加集群
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="glass-card p-6">
          <p className="text-slate-400 text-xs">集群状态</p>
          <div className="flex items-center gap-2 mt-2">
            {getStatusBadge(status?.connected || false)}
          </div>
          <p className="text-xs text-slate-500 mt-1">{status?.version || "N/A"}</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-slate-400 text-xs">节点状态</p>
          <div className="text-2xl font-bold text-sky-400 mt-2">{readyNodes}/{totalNodes}</div>
          <p className="text-xs text-emerald-400 mt-1">节点就绪</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-slate-400 text-xs">运行中 Pod</p>
          <div className="text-2xl font-bold text-purple-400 mt-2">{runningPods}</div>
          <p className="text-xs text-slate-500 mt-1">共 {totalPods} 个 Pod</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-slate-400 text-xs">命名空间</p>
          <div className="text-2xl font-bold text-amber-400 mt-2">{totalNamespaces}</div>
          <p className="text-xs text-slate-500 mt-1">活跃命名空间</p>
        </div>
      </div>

      {/* Current Cluster Card */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-emerald-500/10">
              <Server className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">当前连接集群</h3>
              <p className="text-xs text-slate-400">Kubernetes {status?.version || "N/A"}</p>
            </div>
          </div>
          {getStatusBadge(status?.connected || false)}
        </div>

        {/* Health Metrics */}
        <div className="space-y-4 mb-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-400">节点健康度</span>
              <span className={healthPercentage >= 100 ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>
                {healthPercentage}%
              </span>
            </div>
            <Progress value={healthPercentage} className="h-2" />
          </div>
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-400">Pod 健康度</span>
              <span className={podHealthPercentage >= 90 ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>
                {podHealthPercentage}%
              </span>
            </div>
            <Progress value={podHealthPercentage} className="h-2" />
          </div>
        </div>

        {/* Resource Stats */}
        <div className="grid grid-cols-4 gap-4 pt-4 border-t border-slate-800">
          <div className="text-center">
            <Cpu className="h-5 w-5 text-sky-400 mx-auto mb-2" />
            <p className="text-lg font-bold text-white">{controlPlaneNodes}</p>
            <p className="text-xs text-slate-500">控制平面</p>
          </div>
          <div className="text-center">
            <Activity className="h-5 w-5 text-emerald-400 mx-auto mb-2" />
            <p className="text-lg font-bold text-white">{workerNodes}</p>
            <p className="text-xs text-slate-500">工作节点</p>
          </div>
          <div className="text-center">
            <Database className="h-5 w-5 text-purple-400 mx-auto mb-2" />
            <p className="text-lg font-bold text-white">{totalDeployments}</p>
            <p className="text-xs text-slate-500">Deployments</p>
          </div>
          <div className="text-center">
            <Globe className="h-5 w-5 text-amber-400 mx-auto mb-2" />
            <p className="text-lg font-bold text-white">{totalServices}</p>
            <p className="text-xs text-slate-500">Services</p>
          </div>
        </div>
      </div>

      {/* Node List */}
      {nodes && nodes.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="font-bold text-white mb-4">节点列表</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {nodes.map((node) => (
              <div
                key={node.name}
                className={`p-3 rounded-lg border ${
                  node.status === "Ready" 
                    ? "bg-slate-800/50 border-slate-700" 
                    : "bg-rose-500/10 border-rose-500/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${node.status === "Ready" ? "bg-emerald-500" : "bg-rose-500"}`} />
                  <span className="text-sm font-medium text-white truncate">{node.name}</span>
                </div>
                <div className="flex gap-1 mt-1">
                  {node.roles.slice(0, 1).map((role) => (
                    <span key={role} className="text-xs text-slate-500">{role}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cluster Info */}
      <div className="glass-card p-6">
        <h3 className="font-bold text-white mb-4">集群信息</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-400">API Server</p>
            <p className="text-sky-400 font-mono text-xs mt-1">Connected</p>
          </div>
          <div>
            <p className="text-slate-400">集群版本</p>
            <p className="text-white font-mono mt-1">{status?.version || "N/A"}</p>
          </div>
          <div>
            <p className="text-slate-400">平台</p>
            <p className="text-white mt-1">{status?.platform || "N/A"}</p>
          </div>
          <div>
            <p className="text-slate-400">连接状态</p>
            <p className="text-emerald-400 mt-1">已连接</p>
          </div>
        </div>
      </div>
    </div>
  );
}
