"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Cpu,
  Database,
  CheckCircle2,
  Zap,
  AlertTriangle,
  BarChart3,
  Grid3X3,
  List,
  Loader2,
  AlertCircle,
  Server,
  Container,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useClusterOverview, useClusterStatus, useEvents, usePods } from "@/hooks/use-k8s";

interface DashboardPageProps {
  onNavigate?: (page: string) => void;
}

// 时间范围选项
const TIME_RANGE_OPTIONS = [
  { value: "1m", label: "1分钟" },
  { value: "3m", label: "3分钟" },
  { value: "5m", label: "5分钟" },
  { value: "15m", label: "15分钟" },
  { value: "1h", label: "1小时" },
  { value: "3h", label: "3小时" },
  { value: "6h", label: "6小时" },
  { value: "12h", label: "12小时" },
  { value: "24h", label: "24小时" },
];

// 根据时间范围生成模拟数据
function generateTrendData(timeRange: string) {
  const now = new Date();
  const data: { time: string; cpu: number; memory: number }[] = [];
  
  const config: Record<string, { points: number; interval: number; format: (d: Date) => string }> = {
    "1m": { points: 12, interval: 5, format: (d) => d.toLocaleTimeString('zh-CN', { minute: '2-digit', second: '2-digit' }) },
    "3m": { points: 18, interval: 10, format: (d) => d.toLocaleTimeString('zh-CN', { minute: '2-digit', second: '2-digit' }) },
    "5m": { points: 25, interval: 12, format: (d) => d.toLocaleTimeString('zh-CN', { minute: '2-digit', second: '2-digit' }) },
    "15m": { points: 30, interval: 30, format: (d) => d.toLocaleTimeString('zh-CN', { minute: '2-digit', second: '2-digit' }) },
    "1h": { points: 24, interval: 150, format: (d) => d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) },
    "3h": { points: 36, interval: 300, format: (d) => d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) },
    "6h": { points: 36, interval: 600, format: (d) => d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) },
    "12h": { points: 48, interval: 900, format: (d) => d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) },
    "24h": { points: 24, interval: 3600, format: (d) => d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) },
  };
  
  const { points, interval, format } = config[timeRange] || config["24h"];
  
  for (let i = points - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * interval * 1000);
    data.push({
      time: format(time),
      cpu: Math.floor(30 + Math.random() * 35),
      memory: Math.floor(60 + Math.random() * 25),
    });
  }
  
  return data;
}

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-20 bg-slate-800 rounded-xl" />
      <div className="grid grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-slate-800 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 h-80 bg-slate-800 rounded-xl" />
        <div className="h-80 bg-slate-800 rounded-xl" />
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  progress,
  progressColor,
  iconColor,
  onClick,
}: {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ElementType;
  trend?: string;
  progress?: number;
  progressColor?: string;
  iconColor: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`glass-card p-6 space-y-4 ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-sky-500/50 transition-all hover:scale-[1.02]' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex justify-between items-start">
        <Icon className={`text-3xl ${iconColor}`} />
        {trend && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded text-sky-400 bg-sky-500/10">
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-slate-400 text-xs">{title}</p>
        <h3 className="text-3xl font-bold mt-1 text-white">
          {value}
          {unit && <span className="text-sm font-normal text-slate-500 ml-1">{unit}</span>}
        </h3>
      </div>
      {progress !== undefined && (
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColor}`}
            style={{ width: `${progress}%`, boxShadow: progress > 70 ? "0 0 8px currentColor" : "none" }}
          />
        </div>
      )}
    </div>
  );
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [timeRange, setTimeRange] = useState("24h");
  const [chartType, setChartType] = useState<"cpu" | "memory">("memory");
  
  const { data: status, isLoading: statusLoading } = useClusterStatus();
  const { data: overview, isLoading: overviewLoading } = useClusterOverview();
  const { data: events } = useEvents();
  const { data: pods } = usePods();

  const isLoading = statusLoading || overviewLoading;
  
  // 生成趋势数据
  const trendData = generateTrendData(timeRange);

  // Check connection status
  if (!isLoading && status && !status.connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle className="h-16 w-16 text-amber-500" />
        <div className="text-center">
          <h3 className="text-xl font-bold text-white mb-2">无法连接到 Kubernetes 集群</h3>
          <p className="text-slate-400 text-sm max-w-md">{status.message}</p>
          {status.hint && (
            <p className="text-sky-400 text-sm mt-2 max-w-md">{status.hint}</p>
          )}
        </div>
        <Button
          onClick={() => window.location.reload()}
          className="bg-sky-500 hover:bg-sky-600 mt-4"
        >
          重新连接
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Ensure data is arrays
  const podsList = Array.isArray(pods) ? pods : [];
  const eventsList = Array.isArray(events) ? events : [];

  // Calculate statistics from real data
  const totalPods = overview?.pods || 0;
  const runningPods = overview?.runningPods || 0;
  const totalNodes = overview?.nodes || 0;
  const readyNodes = overview?.readyNodes || 0;
  const totalDeployments = overview?.deployments || 0;
  const totalServices = overview?.services || 0;
  const totalNamespaces = overview?.namespaces || 0;

  // Calculate health score based on cluster state
  const healthScore = totalNodes > 0
    ? Math.round((readyNodes / totalNodes) * 50 + (runningPods / Math.max(totalPods, 1)) * 50)
    : 0;

  // Generate honeycomb data from actual pod status
  const honeycombData: string[] = podsList.map(pod => {
    if (pod.status === "Running") return "bg-emerald-500";
    if (pod.status === "Pending") return "bg-amber-500";
    return "bg-rose-500";
  });

  // Fill remaining slots for visualization
  while (honeycombData.length < 180) {
    honeycombData.push("bg-slate-700");
  }

  // Count pod statuses
  const runningCount = podsList.filter(p => p.status === "Running").length;
  const pendingCount = podsList.filter(p => p.status === "Pending").length;
  const failedCount = podsList.filter(p => !["Running", "Pending"].includes(p.status)).length;

  // Format events for display
  const recentEvents = eventsList.slice(0, 4).map((event, index) => ({
    id: index,
    level: event.type === "Warning" ? "Warning" : "Normal",
    resource: `${event.involvedObject.kind}/${event.involvedObject.name}`,
    reason: event.reason,
    message: event.message,
    time: new Date(event.lastTimestamp).toLocaleString('zh-CN'),
  }));

  return (
    <div className="space-y-6">
      {/* Status Banner - Show warning if there are issues */}
      {failedCount > 0 && (
        <div className="flex items-center justify-between bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-rose-500 h-6 w-6" />
            <div>
              <p className="text-sm font-semibold text-rose-200">检测到异常工作负载</p>
              <p className="text-xs text-rose-300/70">
                集群中有 {failedCount} 个 Pod 处于异常状态，建议检查相关日志。
              </p>
            </div>
          </div>
          <Button 
            className="px-4 py-1.5 bg-rose-500 text-white text-xs font-bold rounded-lg hover:bg-rose-600 transition-colors"
            onClick={() => onNavigate?.('workloads')}
          >
            立即处理
          </Button>
        </div>
      )}

      {/* Cluster Connected Banner */}
      {status?.connected && (
        <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-emerald-500 h-6 w-6" />
            <div>
              <p className="text-sm font-semibold text-emerald-200">已连接到 Kubernetes 集群</p>
              <p className="text-xs text-emerald-300/70">
                版本: {status.version} | {totalNodes} 节点 | {totalNamespaces} 命名空间
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Core Metrics - 可点击跳转 */}
      <div className="grid grid-cols-4 gap-6">
        <StatCard
          title="集群节点"
          value={totalNodes}
          icon={Server}
          trend={readyNodes === totalNodes ? "正常" : "异常"}
          progress={totalNodes > 0 ? (readyNodes / totalNodes) * 100 : 0}
          progressColor="bg-sky-500"
          iconColor="text-sky-400"
          onClick={() => onNavigate?.('nodes')}
        />
        <StatCard
          title="运行中 Pod"
          value={runningPods}
          unit={`/ ${totalPods}`}
          icon={Container}
          trend="稳定"
          progress={totalPods > 0 ? (runningPods / totalPods) * 100 : 0}
          progressColor="bg-purple-500"
          iconColor="text-purple-400"
          onClick={() => onNavigate?.('workloads')}
        />
        <StatCard
          title="健康评分"
          value={healthScore}
          unit="/100"
          icon={CheckCircle2}
          trend="稳定"
          progress={healthScore}
          progressColor="bg-emerald-500"
          iconColor="text-emerald-400"
        />
        <StatCard
          title="Deployments"
          value={totalDeployments}
          icon={Zap}
          trend={`${totalServices} Services`}
          progressColor="bg-amber-500"
          iconColor="text-amber-400"
          onClick={() => onNavigate?.('deployments')}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h4 className="font-bold flex items-center gap-2 text-white">
                <BarChart3 className="text-sky-400 h-5 w-5" />
                集群负载趋势
              </h4>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[100px] h-8 bg-slate-800 border-slate-700 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {TIME_RANGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setChartType("cpu")}
                className={`px-3 py-1 text-[10px] rounded-md ${chartType === "cpu" ? "bg-sky-500 text-white" : "bg-slate-800 hover:bg-slate-700"}`}
              >
                CPU
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setChartType("memory")}
                className={`px-3 py-1 text-[10px] rounded-md ${chartType === "memory" ? "bg-sky-500 text-white" : "bg-slate-800 hover:bg-slate-700"}`}
              >
                Memory
              </Button>
            </div>
          </div>
          <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#f8fafc",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="memory"
                  stroke="#a855f7"
                  strokeWidth={2}
                  fill="url(#memGradient)"
                  hide={chartType !== "memory"}
                />
                <Area
                  type="monotone"
                  dataKey="cpu"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  fill="url(#cpuGradient)"
                  hide={chartType !== "cpu"}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pod Distribution */}
        <div className="glass-card p-6">
          <h4 className="font-bold flex items-center gap-2 mb-6 text-white">
            <Grid3X3 className="text-emerald-400 h-5 w-5" />
            Pod 状态分布
          </h4>
          <div className="honeycomb-grid opacity-80">
            {honeycombData.slice(0, 180).map((color, index) => (
              <div key={index} className={`honeycomb-item ${color}`} />
            ))}
          </div>
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> 运行中 (Running)
              </span>
              <span className="font-bold text-white">{runningCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> 异常 (Failed/Error)
              </span>
              <span className="font-bold text-white">{failedCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> 等待中 (Pending)
              </span>
              <span className="font-bold text-white">{pendingCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <h4 className="font-bold flex items-center gap-2 text-white">
            <List className="text-purple-400 h-5 w-5" />
            关键系统事件
          </h4>
          <button 
            className="text-xs text-sky-400 hover:underline"
            onClick={() => onNavigate?.('events')}
          >
            查看日志中心
          </button>
        </div>
        {recentEvents.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">级别</th>
                <th className="px-6 py-4 font-medium">资源</th>
                <th className="px-6 py-4 font-medium">事件原因</th>
                <th className="px-6 py-4 font-medium">消息</th>
                <th className="px-6 py-4 font-medium">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {recentEvents.map((event) => (
                <tr key={event.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                        event.level === "Warning"
                          ? "bg-rose-500/10 text-rose-500"
                          : "bg-sky-500/10 text-sky-500"
                      }`}
                    >
                      {event.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-sky-400">{event.resource}</td>
                  <td className="px-6 py-4 text-white">{event.reason}</td>
                  <td className="px-6 py-4 text-slate-400 max-w-xs truncate">{event.message}</td>
                  <td className="px-6 py-4 text-slate-500 text-xs">{event.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-slate-500">
            暂无事件数据
          </div>
        )}
      </div>
    </div>
  );
}
