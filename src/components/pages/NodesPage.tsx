"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Server,
  Cpu,
  Container,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  MoreVertical,
  Loader2,
  RefreshCw,
  Terminal,
  Play,
  Square,
  Unlock,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNodes, useNodeOperations } from "@/hooks/use-k8s";
import { useToast } from "@/hooks/use-toast";

interface NodeDetail {
  name: string;
  status: string;
  roles: string[];
  ip: string;
  os: string;
  arch: string;
  kernelVersion: string;
  kubeletVersion: string;
  capacity: { cpu: string; memory: string; pods: string };
  allocatable: { cpu: string; memory: string; pods: string };
  conditions: Array<{ type: string; status: string; message: string }>;
  labels: Record<string, string>;
  createdAt: string;
  unschedulable?: boolean;
}

const getStatusBadge = (status: string) => {
  if (status === "Ready") {
    return (
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 status-pulse" />
        <span className="text-emerald-400 font-medium">Ready</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-rose-500 status-pulse" />
      <span className="text-rose-400 font-medium">{status}</span>
    </div>
  );
};

const getRoleBadge = (role: string) => {
  if (role === "control-plane" || role === "master") {
    return (
      <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
        {role}
      </span>
    );
  }
  if (role === "etcd") {
    return (
      <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
        {role}
      </span>
    );
  }
  return (
    <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
      {role}
    </span>
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
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-slate-800 rounded" />
        <div className="h-10 w-32 bg-slate-800 rounded" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-slate-800 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-48 bg-slate-800 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// Extract numeric value from K8s resource string (e.g., "4" -> 4, "8Gi" -> 8)
function parseResourceValue(value: string): number {
  const match = value.match(/^(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

// Parse memory string and convert to Gi (Gibibytes)
// K8s uses: Ki (Kibibytes), Mi (Mebibytes), Gi (Gibibytes), Ti (Tebibytes)
function parseMemoryToGi(value: string): number {
  const match = value.match(/^(\d+)(Ki|Mi|Gi|Ti)?/i);
  if (!match) return 0;
  
  const num = parseInt(match[1]);
  const unit = (match[2] || '').toLowerCase();
  
  switch (unit) {
    case 'ki':  // Kibibytes -> Gi
      return num / (1024 * 1024);
    case 'mi':  // Mebibytes -> Gi
      return num / 1024;
    case 'gi':  // Gibibytes
      return num;
    case 'ti':  // Tebibytes -> Gi
      return num * 1024;
    default:    // 无单位，假设为 bytes
      return num / (1024 * 1024 * 1024);
  }
}

export default function NodesPage() {
  const { data: nodes, isLoading, refetch, isRefetching } = useNodes();
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [shellNode, setShellNode] = useState<NodeDetail | null>(null);
  const { toast } = useToast();
  const { cordonNode, uncordonNode, drainNode } = useNodeOperations();

  // 刷新状态
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: "刷新成功",
        description: "节点状态已更新",
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

  // 隔离节点
  const handleCordon = (node: NodeDetail) => {
    cordonNode.mutate(node.name, {
      onSuccess: () => {
        toast({ title: "隔离成功", description: `节点 ${node.name} 已隔离` });
        refetch();
      },
      onError: (error) => {
        toast({ title: "隔离失败", description: error.message, variant: "destructive" });
      },
    });
  };

  // 解除隔离
  const handleUncordon = (node: NodeDetail) => {
    uncordonNode.mutate(node.name, {
      onSuccess: () => {
        toast({ title: "解除隔离成功", description: `节点 ${node.name} 已解除隔离` });
        refetch();
      },
      onError: (error) => {
        toast({ title: "解除隔离失败", description: error.message, variant: "destructive" });
      },
    });
  };

  // 排空节点
  const handleDrain = (node: NodeDetail) => {
    drainNode.mutate(node.name, {
      onSuccess: () => {
        toast({ title: "排空成功", description: `节点 ${node.name} 已排空` });
        refetch();
      },
      onError: (error) => {
        toast({ title: "排空失败", description: error.message, variant: "destructive" });
      },
    });
  };

  // 检查节点是否被隔离
  const isNodeCordoned = (node: NodeDetail) => {
    return node.unschedulable === true;
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Ensure nodes is an array
  const nodesList = Array.isArray(nodes) ? nodes : [];

  // Calculate statistics
  const readyNodes = nodesList.filter((n) => n.status === "Ready").length;
  const totalNodes = nodesList.length;
  const totalPodsCapacity = nodesList.reduce((acc, n) => acc + parseResourceValue(n.capacity.pods), 0);
  const totalCpuCapacity = nodesList.reduce((acc, n) => acc + parseResourceValue(n.capacity.cpu), 0);
  const totalMemoryCapacity = nodesList.reduce((acc, n) => {
    return acc + parseMemoryToGi(n.capacity.memory);
  }, 0);

  // Check for conditions
  const hasWarningConditions = (conditions: Array<{ type: string; status: string; message: string }>) => {
    return conditions.some((c) => c.status === "True" && c.type !== "Ready");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">节点管理</h2>
          <p className="text-slate-400 text-sm mt-1">查看和管理 Kubernetes 集群节点</p>
        </div>
        <Button 
          variant="ghost" 
          className="glass-card px-4 py-2 text-sm text-slate-300"
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
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="glass-card p-6">
          <p className="text-slate-400 text-xs">节点总数</p>
          <div className="text-2xl font-bold text-white mt-2">
            {readyNodes}/{totalNodes}
          </div>
          <p className="text-xs text-slate-500 mt-1">节点就绪</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-slate-400 text-xs">CPU 总量</p>
          <div className="text-2xl font-bold text-sky-400 mt-2">{totalCpuCapacity}</div>
          <p className="text-xs text-slate-500 mt-1">核心数</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-slate-400 text-xs">内存总量</p>
          <div className="text-2xl font-bold text-purple-400 mt-2">{totalMemoryCapacity.toFixed(1)} Gi</div>
          <p className="text-xs text-slate-500 mt-1">总内存</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-slate-400 text-xs">Pod 容量</p>
          <div className="text-2xl font-bold text-emerald-400 mt-2">{totalPodsCapacity}</div>
          <p className="text-xs text-slate-500 mt-1">最大 Pod 数</p>
        </div>
      </div>

      {/* Nodes Grid */}
      {nodesList.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {nodesList.map((node) => (
            <div
              key={node.name}
              className={`glass-card p-6 cursor-pointer transition-all hover:shadow-lg ${
                node.status === "NotReady" ? "border-rose-500/50" : ""
              }`}
              onClick={() => setSelectedNode(node)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      node.status === "Ready" ? "bg-emerald-500/10" : "bg-rose-500/10"
                    }`}
                  >
                    <Server
                      className={`h-5 w-5 ${node.status === "Ready" ? "text-emerald-500" : "text-rose-500"}`}
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{node.name}</h3>
                    <p className="text-xs text-slate-400 font-mono">{node.ip}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                    <DropdownMenuLabel className="text-slate-400">操作</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-slate-700" />
                    <DropdownMenuItem 
                      className="text-slate-300 hover:text-white focus:bg-slate-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCordon(node);
                      }}
                      disabled={cordonNode.isPending}
                    >
                      <Square className="h-4 w-4 mr-2" />
                      隔离节点
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-slate-300 hover:text-white focus:bg-slate-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUncordon(node);
                      }}
                      disabled={uncordonNode.isPending}
                    >
                      <Unlock className="h-4 w-4 mr-2" />
                      解除隔离
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-slate-300 hover:text-white focus:bg-slate-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDrain(node);
                      }}
                      disabled={drainNode.isPending}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      排空节点
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-slate-700" />
                    <DropdownMenuItem 
                      className="text-slate-300 hover:text-white focus:bg-slate-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShellNode(node);
                      }}
                    >
                      <Terminal className="h-4 w-4 mr-2" />
                      进入终端
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-1 flex-wrap">
                  {node.roles.map((role) => (
                    <span key={role}>{getRoleBadge(role)}</span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {isNodeCordoned(node) && (
                    <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                      <Square className="h-3 w-3" />
                      已隔离
                    </span>
                  )}
                  {getStatusBadge(node.status)}
                </div>
              </div>

              {/* Resource Capacity */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400">CPU</span>
                    <span className="text-slate-300">{node.capacity.cpu} 核</span>
                  </div>
                  <Progress 
                    value={Math.min(parseResourceValue(node.capacity.cpu) / 64 * 100, 100)} 
                    className="h-1.5" 
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400">内存</span>
                    <span className="text-slate-300">{parseMemoryToGi(node.capacity.memory).toFixed(1)} Gi</span>
                  </div>
                  <Progress 
                    value={Math.min(parseMemoryToGi(node.capacity.memory) / 128 * 100, 100)} 
                    className="h-1.5" 
                  />
                </div>
              </div>

              {/* Info */}
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 pt-4 mt-4 border-t border-slate-800">
                <div className="flex items-center gap-1">
                  <Container className="h-3 w-3" />
                  <span>最大 {node.capacity.pods} Pods</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatAge(node.createdAt)}</span>
                </div>
              </div>

              {/* Conditions Warning */}
              {hasWarningConditions(node.conditions) && (
                <div className="flex items-center gap-1 text-xs text-amber-400 mt-2">
                  <AlertTriangle className="h-3 w-3" />
                  <span>存在压力条件</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <Server className="h-12 w-12 mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 text-sm">没有找到节点数据</p>
          <p className="text-slate-500 text-xs mt-2">请检查 Kubernetes 集群连接</p>
        </div>
      )}

      {/* Node Detail Dialog */}
      <Dialog open={!!selectedNode} onOpenChange={() => setSelectedNode(null)}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-700">
          {selectedNode && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-white">
                  <Server className="h-5 w-5 text-sky-400" />
                  {selectedNode.name}
                  {isNodeCordoned(selectedNode) && (
                    <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded ml-2">
                      已隔离
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription className="text-slate-400">节点详细信息</DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-white">基本信息</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">状态</span>
                        {getStatusBadge(selectedNode.status)}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">调度状态</span>
                        <span className={selectedNode.unschedulable ? "text-amber-400" : "text-emerald-400"}>
                          {selectedNode.unschedulable ? "不可调度" : "可调度"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">IP 地址</span>
                        <span className="font-mono text-slate-300">{selectedNode.ip}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">操作系统</span>
                        <span className="text-slate-300">{selectedNode.os}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">架构</span>
                        <span className="text-slate-300">{selectedNode.arch}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">内核版本</span>
                        <span className="text-slate-300 text-xs">{selectedNode.kernelVersion}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Kubelet 版本</span>
                        <span className="font-mono text-xs text-sky-400">{selectedNode.kubeletVersion}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-white">资源容量</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-400">CPU</span>
                          <span className="text-slate-300">{selectedNode.capacity.cpu} 核</span>
                        </div>
                        <Progress 
                          value={Math.min(parseResourceValue(selectedNode.capacity.cpu) / 64 * 100, 100)} 
                          className="h-2" 
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-400">内存</span>
                          <span className="text-slate-300">{parseMemoryToGi(selectedNode.capacity.memory).toFixed(1)} Gi</span>
                        </div>
                        <Progress 
                          value={Math.min(parseMemoryToGi(selectedNode.capacity.memory) / 128 * 100, 100)} 
                          className="h-2" 
                        />
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Pods</span>
                        <span className="text-slate-300">{selectedNode.capacity.pods}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Conditions */}
                {selectedNode.conditions.length > 0 && (
                  <div className="pt-4 border-t border-slate-800">
                    <h4 className="text-sm font-medium text-white mb-3">节点条件</h4>
                    <div className="space-y-2">
                      {selectedNode.conditions.map((condition) => (
                        <div key={condition.type} className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">{condition.type}</span>
                          <span className={condition.status === "True" && condition.type !== "Ready" ? "text-amber-400" : condition.status === "True" ? "text-emerald-400" : "text-slate-500"}>
                            {condition.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Node Shell Dialog */}
      <Dialog open={!!shellNode} onOpenChange={() => setShellNode(null)}>
        <DialogContent className="max-w-4xl h-[600px] bg-slate-900 border-slate-700">
          {shellNode && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-white">
                  <Terminal className="h-5 w-5 text-sky-400" />
                  节点终端 - {shellNode.name}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  通过 WebSocket 连接到节点执行 Shell 命令
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 bg-slate-950 rounded-lg p-4 font-mono text-sm text-green-400 overflow-auto h-[480px]">
                <div className="text-slate-500 mb-4">
                  <p>节点终端功能需要 WebSocket 支持。</p>
                  <p className="mt-2">目标节点: {shellNode.name}</p>
                  <p>节点 IP: {shellNode.ip}</p>
                  <p className="mt-2 text-amber-400">正在开发中...</p>
                </div>
                <div className="text-slate-600">
                  <p>$ ssh root@{shellNode.ip}</p>
                  <p className="animate-pulse">_</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
