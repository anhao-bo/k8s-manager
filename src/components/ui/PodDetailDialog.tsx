"use client";

import { usePodDetail, type PodDetail, type ContainerInfo, type EventInfo } from "@/hooks/use-k8s";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle, Clock, XCircle, Info, Container, AlertTriangle } from "lucide-react";

interface PodDetailDialogProps {
  namespace: string;
  name: string;
}

// 获取容器状态图标和颜色
function getContainerStateDisplay(container: ContainerInfo) {
  const { state, stateReason, stateMessage, ready } = container;

  // 状态颜色映射
  const stateColors: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
    Running: { bg: "bg-emerald-500/20", text: "text-emerald-400", icon: CheckCircle },
    Waiting: { bg: "bg-amber-500/20", text: "text-amber-400", icon: Clock },
    Terminated: { bg: "bg-slate-500/20", text: "text-slate-400", icon: XCircle },
  };

  // 特殊错误状态
  const errorReasons = [
    "CrashLoopBackOff",
    "ImagePullBackOff",
    "ErrImagePull",
    "CreateContainerConfigError",
    "InvalidImageName",
    "OOMKilled",
    "Error",
  ];

  const isError = errorReasons.includes(stateReason) || (state === "Terminated" && container.exitCode !== 0);
  const colorConfig = isError
    ? { bg: "bg-rose-500/20", text: "text-rose-400", icon: AlertCircle }
    : stateColors[state] || stateColors.Waiting;

  const Icon = colorConfig.icon;

  return {
    icon: <Icon className={`h-4 w-4 ${colorConfig.text}`} />,
    bg: colorConfig.bg,
    text: colorConfig.text,
    state,
    reason: stateReason,
    message: stateMessage,
    isError,
    ready,
  };
}

// 获取事件类型样式
function getEventTypeStyle(type: string) {
  return type === "Warning"
    ? { bg: "bg-amber-500/20", text: "text-amber-400", icon: AlertTriangle }
    : type === "Normal"
    ? { bg: "bg-sky-500/20", text: "text-sky-400", icon: Info }
    : { bg: "bg-slate-500/20", text: "text-slate-400", icon: Info };
}

// 格式化时间
function formatTime(dateStr: string): string {
  if (!dateStr || dateStr === "0001-01-01T00:00:00Z") return "-";
  const date = new Date(dateStr);
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// 格式化年龄
function formatAge(dateStr: string): string {
  if (!dateStr || dateStr === "0001-01-01T00:00:00Z") return "-";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d${hours % 24}h`;
  if (hours > 0) return `${hours}h${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m${seconds % 60}s`;
  return `${seconds}s`;
}

// 容器状态卡片
function ContainerCard({ container, isInit = false }: { container: ContainerInfo; isInit?: boolean }) {
  const stateDisplay = getContainerStateDisplay(container);

  return (
    <div className={`p-3 rounded-lg border ${stateDisplay.isError ? "border-rose-500/30 bg-rose-500/5" : "border-slate-700 bg-slate-800/50"}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Container className="h-4 w-4 text-sky-400" />
          <span className="font-medium text-white">{container.name}</span>
          {isInit && <Badge className="bg-purple-500/20 text-purple-400 text-xs">Init</Badge>}
          {container.ready ? (
            <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">Ready</Badge>
          ) : (
            <Badge className="bg-amber-500/20 text-amber-400 text-xs">Not Ready</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {stateDisplay.icon}
          <span className={`text-sm font-medium ${stateDisplay.text}`}>{stateDisplay.reason || stateDisplay.state}</span>
        </div>
      </div>

      {/* 镜像信息 */}
      <div className="text-xs text-slate-400 mb-2">
        <span className="text-slate-500">镜像: </span>
        <span className="font-mono">{container.image}</span>
      </div>

      {/* 错误消息 */}
      {(stateDisplay.message || stateDisplay.isError) && (
        <div className={`text-xs p-2 rounded ${stateDisplay.bg} ${stateDisplay.text} mb-2`}>
          {stateDisplay.message || (container.lastExitMessage || `退出码: ${container.exitCode || container.lastExitCode}`)}
        </div>
      )}

      {/* 详细信息 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {container.restartCount > 0 && (
          <div>
            <span className="text-slate-500">重启次数: </span>
            <span className={container.restartCount > 5 ? "text-rose-400 font-bold" : "text-amber-400"}>
              {container.restartCount}
            </span>
          </div>
        )}
        {container.startedAt && (
          <div>
            <span className="text-slate-500">启动时间: </span>
            <span className="text-slate-300">{formatAge(container.startedAt)}</span>
          </div>
        )}
        {container.exitCode !== undefined && container.exitCode !== 0 && (
          <div>
            <span className="text-slate-500">退出码: </span>
            <span className="text-rose-400">{container.exitCode}</span>
          </div>
        )}
        {container.lastExitReason && (
          <div>
            <span className="text-slate-500">上次退出原因: </span>
            <span className="text-amber-400">{container.lastExitReason}</span>
          </div>
        )}
        {container.containerID && (
          <div className="col-span-2">
            <span className="text-slate-500">容器ID: </span>
            <span className="font-mono text-slate-400 text-[10px] break-all">
              {container.containerID.replace("containerd://", "").replace("docker://", "").substring(0, 12)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// 事件卡片
function EventCard({ event }: { event: EventInfo }) {
  const style = getEventTypeStyle(event.type);
  const Icon = style.icon;

  return (
    <div className={`p-2 rounded border border-slate-700/50 ${style.bg}`}>
      <div className="flex items-start gap-2">
        <Icon className={`h-4 w-4 mt-0.5 ${style.text}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium ${style.text}`}>{event.reason}</span>
            <span className="text-xs text-slate-500">×{event.count}</span>
          </div>
          <p className="text-xs text-slate-300 break-words">{event.message}</p>
          <div className="text-xs text-slate-500 mt-1">
            {formatTime(event.lastTimestamp)} · {event.source.component}
            {event.source.host && ` · ${event.source.host}`}
          </div>
        </div>
      </div>
    </div>
  );
}

// 状态徽章
function getStatusBadge(status: string, reason?: string) {
  const styles: Record<string, { dot: string; text: string }> = {
    Running: { dot: "bg-emerald-500", text: "text-emerald-400" },
    Pending: { dot: "bg-amber-500", text: "text-amber-400" },
    Succeeded: { dot: "bg-sky-500", text: "text-sky-400" },
    Failed: { dot: "bg-rose-500", text: "text-rose-400" },
    Unknown: { dot: "bg-slate-500", text: "text-slate-400" },
  };

  // 错误状态覆盖
  const errorStates = ["CrashLoopBackOff", "ImagePullBackOff", "ErrImagePull", "Error"];
  if (errorStates.includes(status) || errorStates.includes(reason || "")) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-rose-500 status-pulse" />
        <span className="text-rose-400 font-medium">{reason || status}</span>
      </div>
    );
  }

  const style = styles[status] || styles.Unknown;
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${style.dot} status-pulse`} />
      <span className={`${style.text} font-medium`}>{reason || status}</span>
    </div>
  );
}

export default function PodDetailDialog({ namespace, name }: PodDetailDialogProps) {
  const { data: pod, isLoading, error } = usePodDetail(namespace, name);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-rose-400">
        <AlertCircle className="h-5 w-5 mr-2" />
        加载 Pod 详情失败: {error instanceof Error ? error.message : "未知错误"}
      </div>
    );
  }

  if (!pod) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Pod 不存在
      </div>
    );
  }

  // 分离警告事件和普通事件
  const warningEvents = pod.events?.filter((e) => e.type === "Warning") || [];
  const normalEvents = pod.events?.filter((e) => e.type === "Normal") || [];

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
      {/* 基本信息卡片 */}
      <div className="glass-card p-4 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-white">{pod.name}</h3>
            {pod.isStaticPod && (
              <Badge className="bg-purple-500/20 text-purple-400">静态 Pod</Badge>
            )}
          </div>
          {getStatusBadge(pod.status, pod.statusReason)}
        </div>

        {/* 状态消息 */}
        {pod.statusMessage && (
          <div className={`p-2 rounded mb-3 text-sm ${pod.status === "Running" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
            {pod.statusMessage}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-slate-500 block">命名空间</span>
            <span className="text-slate-300">{pod.namespace}</span>
          </div>
          <div>
            <span className="text-slate-500 block">节点</span>
            <span className="text-slate-300">{pod.nodeName || "-"}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Pod IP</span>
            <span className="text-slate-300 font-mono text-xs">{pod.podIP || "-"}</span>
          </div>
          <div>
            <span className="text-slate-500 block">主机 IP</span>
            <span className="text-slate-300 font-mono text-xs">{pod.hostIP || "-"}</span>
          </div>
          <div>
            <span className="text-slate-500 block">重启策略</span>
            <span className="text-slate-300">{pod.restartPolicy}</span>
          </div>
          <div>
            <span className="text-slate-500 block">QoS 等级</span>
            <span className={`text-slate-300 ${pod.qosClass === "Guaranteed" ? "text-emerald-400" : pod.qosClass === "Burstable" ? "text-amber-400" : ""}`}>
              {pod.qosClass}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">创建时间</span>
            <span className="text-slate-300">{formatTime(pod.createdAt)}</span>
          </div>
          <div>
            <span className="text-slate-500 block">运行时长</span>
            <span className="text-slate-300">{pod.startTime ? formatAge(pod.startTime) : "-"}</span>
          </div>
        </div>
      </div>

      {/* 容器状态 */}
      <div className="glass-card p-4 rounded-lg">
        <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
          <Container className="h-4 w-4" />
          容器状态 ({pod.containers?.length || 0})
        </h4>
        <div className="space-y-2">
          {pod.initContainers?.map((c) => (
            <ContainerCard key={c.name} container={c} isInit />
          ))}
          {pod.containers?.map((c) => (
            <ContainerCard key={c.name} container={c} />
          ))}
        </div>
      </div>

      {/* Conditions */}
      {pod.conditions && pod.conditions.length > 0 && (
        <div className="glass-card p-4 rounded-lg">
          <h4 className="text-sm font-medium text-slate-400 mb-3">Pod 条件</h4>
          <div className="space-y-2">
            {pod.conditions.map((cond, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 bg-slate-800/50 rounded">
                <div className="flex items-center gap-2">
                  {cond.status === "True" ? (
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-400" />
                  )}
                  <span className="text-slate-300">{cond.type}</span>
                </div>
                <span className={cond.status === "True" ? "text-emerald-400" : "text-rose-400"}>
                  {cond.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 警告事件 */}
      {warningEvents.length > 0 && (
        <div className="glass-card p-4 rounded-lg">
          <h4 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            警告事件 ({warningEvents.length})
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {warningEvents.slice(0, 10).map((event, i) => (
              <EventCard key={i} event={event} />
            ))}
          </div>
        </div>
      )}

      {/* 普通事件 */}
      {normalEvents.length > 0 && (
        <div className="glass-card p-4 rounded-lg">
          <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <Info className="h-4 w-4" />
            事件 ({normalEvents.length})
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {normalEvents.slice(0, 5).map((event, i) => (
              <EventCard key={i} event={event} />
            ))}
          </div>
        </div>
      )}

      {/* Labels */}
      {pod.labels && Object.keys(pod.labels).length > 0 && (
        <div className="glass-card p-4 rounded-lg">
          <h4 className="text-sm font-medium text-slate-400 mb-3">标签</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(pod.labels).map(([key, value]) => (
              <Badge key={key} className="bg-slate-700 text-slate-300 text-xs">
                {key}={value}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
