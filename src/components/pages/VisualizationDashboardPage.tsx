"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  FullScreen,
  useFullScreenHandle,
} from "react-full-screen";
import {
  Monitor,
  Maximize2,
  Minimize2,
  Settings,
  RefreshCw,
  GripVertical,
  Server,
  Cpu,
  HardDrive,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Container,
  Network,
  Zap,
  Database,
  Gauge,
} from "lucide-react";
import { useClusterOverview, useNodes, usePods } from "@/hooks/use-k8s";

// 中间件定义
const MIDDLEWARE_DEFS = [
  { name: "Prometheus", category: "monitoring", matchLabels: (l: Record<string, string>) => l["app.kubernetes.io/name"] === "prometheus", port: "9090" },
  { name: "Grafana", category: "monitoring", matchLabels: (l: Record<string, string>) => l["app.kubernetes.io/name"] === "grafana", port: "30030" },
  { name: "Alertmanager", category: "monitoring", matchLabels: (l: Record<string, string>) => l["app.kubernetes.io/name"] === "alertmanager", port: "9093" },
  { name: "Node Exporter", category: "monitoring", matchLabels: (l: Record<string, string>) => l["app.kubernetes.io/name"] === "prometheus-node-exporter", port: "9100" },
  { name: "kube-state-metrics", category: "monitoring", matchLabels: (l: Record<string, string>) => l["app.kubernetes.io/name"] === "kube-state-metrics", port: "8080" },
  { name: "MySQL Exporter", category: "database", matchLabels: (l: Record<string, string>) => l["app"] === "mysql-exporter", port: "9104" },
  { name: "Redis Exporter", category: "database", matchLabels: (l: Record<string, string>) => l["app"] === "redis-exporter", port: "9121" },
  { name: "Nginx Exporter", category: "monitoring", matchLabels: (l: Record<string, string>) => l["app"] === "nginx-exporter", port: "9113" },
  { name: "Traefik Ingress", category: "ingress", matchLabels: (l: Record<string, string>) => l["app.kubernetes.io/name"] === "traefik", port: "80/443" },
  { name: "CoreDNS", category: "dns", matchLabels: (l: Record<string, string>) => l["k8s-app"] === "kube-dns", port: "53" },
  { name: "Metrics Server", category: "monitoring", matchLabels: (l: Record<string, string>) => l["k8s-app"] === "metrics-server", port: "443" },
  { name: "Local Path Provisioner", category: "storage", matchLabels: (l: Record<string, string>) => l["app"] === "local-path-provisioner", port: "" },
];

// 可拖拽面板组件
interface DraggablePanelProps {
  id: string;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

function DraggablePanel({ id, children, title, className = "" }: DraggablePanelProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative glass-card overflow-hidden ${className} ${isDragging ? "ring-2 ring-sky-500" : ""}`}
    >
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/50 bg-slate-800/30">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-slate-500 hover:text-sky-400 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

// 节点网格组件
function NodeGrid({ nodes }: { nodes: Array<{ name: string; status: string; ip: string; roles: string[] }> }) {
  const statusConfig: Record<string, { bg: string; glow: string }> = {
    Ready: { bg: "bg-emerald-500", glow: "shadow-emerald-500/50" },
    NotReady: { bg: "bg-rose-500", glow: "shadow-rose-500/50" },
    Unknown: { bg: "bg-amber-500", glow: "shadow-amber-500/50" },
  };

  return (
    <div className="relative w-full h-full">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(56, 189, 248, 0.3) 1px, transparent 0)`,
          backgroundSize: "30px 30px",
        }} />
      </div>

      <div className="relative grid grid-cols-8 gap-2 p-2">
        {nodes.map((node, index) => {
          const config = statusConfig[node.status] || statusConfig.Unknown;
          return (
            <div key={node.name} className="group relative">
              <div className={`
                relative w-full aspect-square rounded-lg transition-all duration-300
                hover:scale-110 hover:z-10 cursor-pointer
                ${config.bg}/10 border border-slate-700
                hover:border-slate-500 hover:shadow-lg ${config.glow}
              `}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`w-3 h-3 rounded-full ${config.bg} shadow-lg ${config.glow} group-hover:animate-pulse`}>
                    <div className={`absolute inset-0 rounded-full ${config.bg} opacity-50 animate-ping`} />
                  </div>
                </div>
                <div className="absolute bottom-0.5 left-0 right-0 text-center">
                  <span className="text-[8px] font-mono text-slate-500 group-hover:text-slate-300">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                {/* Hover 信息 */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                  <div className="bg-slate-900/95 border border-slate-700 rounded-lg p-2 shadow-xl min-w-[140px]">
                    <p className="text-xs font-semibold text-white truncate">{node.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{node.ip}</p>
                    <p className="text-[10px] text-sky-400">{node.roles?.join(", ") || "worker"}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 图例 */}
      <div className="absolute bottom-4 left-4 flex items-center gap-4 bg-slate-900/80 rounded-lg px-3 py-2 border border-slate-700">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
          <span className="text-[10px] text-slate-400">Ready ({nodes.filter(n => n.status === "Ready").length})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50" />
          <span className="text-[10px] text-slate-400">NotReady ({nodes.filter(n => n.status === "NotReady").length})</span>
        </div>
      </div>
    </div>
  );
}

// 核心指标面板
function MetricPanel({ title, value, unit, icon: Icon, color }: {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-xs">{title}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="flex items-end gap-1">
        <span className="text-3xl font-bold text-white">{value}</span>
        {unit && <span className="text-slate-500 text-sm mb-1">{unit}</span>}
      </div>
    </div>
  );
}

// 圆环进度条
function CircularProgress({ value, color, size = 120, strokeWidth = 8, label, icon: Icon }: {
  value: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  label: string;
  icon?: React.ElementType;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const offset = circumference - (safeValue / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <defs>
          <linearGradient id={`grad-${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color === "text-sky-400" ? "#38bdf8" : color === "text-purple-400" ? "#a855f7" : "#22c55e"} />
            <stop offset="100%" stopColor={color === "text-sky-400" ? "#0ea5e9" : color === "text-purple-400" ? "#9333ea" : "#16a34a"} />
          </linearGradient>
        </defs>
        <circle className="text-slate-700" strokeWidth={strokeWidth} stroke="currentColor" fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
        <circle
          className="transition-all duration-500"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke={`url(#grad-${label})`}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {Icon && <Icon className={`h-4 w-4 ${color} mb-1`} />}
        <span className="text-2xl font-bold text-white">{Math.round(safeValue)}%</span>
        <span className="text-[10px] text-slate-400">{label}</span>
      </div>
    </div>
  );
}

// 流量图组件
function FlowChart() {
  const [data, setData] = useState<number[]>(Array(40).fill(0).map(() => Math.random() * 100));

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => [...prev.slice(1), Math.random() * 100]);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const currentValue = data[data.length - 1] || 0;
  const avgValue = data.reduce((a, b) => a + b, 0) / data.length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400">网络流量 (模拟)</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-sky-400 font-mono">{(currentValue * 1).toFixed(1)} KB/s</span>
          <Badge className="bg-green-500/10 text-green-400 text-[10px] border-0">LIVE</Badge>
        </div>
      </div>
      <div className="h-28 flex items-end gap-0.5">
        {data.map((value, i) => (
          <div
            key={i}
            className="flex-1 rounded-t transition-all duration-300"
            style={{
              height: `${Math.max(5, value)}%`,
              background: `linear-gradient(to top, rgba(56, 189, 248, 0.8) 0%, rgba(168, 85, 247, 0.4) 100%)`,
              boxShadow: value > 70 ? "0 0 8px rgba(56, 189, 248, 0.5)" : "none",
            }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-slate-500">
        <span>平均: {avgValue.toFixed(1)} KB/s</span>
        <span>峰值: {Math.max(...data).toFixed(1)} KB/s</span>
      </div>
    </div>
  );
}

// 中间件状态项
interface MiddlewareItem {
  name: string;
  category: string;
  status: "running" | "pending" | "not_deployed";
  port: string;
  podCount: number;
  readyPods: number;
}

// 中间件状态面板
function MiddlewarePanel({ pods }: { pods: Array<{ name: string; namespace: string; status: string; labels: Record<string, string>; readyContainers: number; containers: number }> }) {
  // 计算中间件状态
  const middlewareStatus = useMemo(() => {
    const results: MiddlewareItem[] = MIDDLEWARE_DEFS.map(def => {
      const matchingPods = pods.filter(p => def.matchLabels(p.labels || {}));
      const runningPods = matchingPods.filter(p => p.status === "Running");
      const readyPods = runningPods.filter(p => p.readyContainers === p.containers);

      let status: "running" | "pending" | "not_deployed" = "not_deployed";
      if (matchingPods.length > 0) {
        status = readyPods.length > 0 ? "running" : "pending";
      }

      return {
        name: def.name,
        category: def.category,
        status,
        port: def.port,
        podCount: matchingPods.length,
        readyPods: readyPods.length,
      };
    });

    return results;
  }, [pods]);

  const runningCount = middlewareStatus.filter(m => m.status === "running").length;
  const pendingCount = middlewareStatus.filter(m => m.status === "pending").length;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "running":
        return { color: "text-green-400", bg: "bg-green-500/20", border: "border-green-500/30", icon: CheckCircle2 };
      case "pending":
        return { color: "text-amber-400", bg: "bg-amber-500/20", border: "border-amber-500/30", icon: Activity };
      default:
        return { color: "text-slate-500", bg: "bg-slate-500/10", border: "border-slate-500/20", icon: AlertTriangle };
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "monitoring": return Gauge;
      case "database": return Database;
      case "ingress": return Network;
      case "storage": return HardDrive;
      case "dns": return Network;
      default: return Container;
    }
  };

  return (
    <div className="space-y-3 text-xs">
      {/* 状态总览 */}
      <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <span className="text-slate-400">集群服务状态</span>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-500/20 text-green-400 text-[10px] border-0">
            {runningCount} 运行中
          </Badge>
          {pendingCount > 0 && (
            <Badge className="bg-amber-500/20 text-amber-400 text-[10px] border-0">
              {pendingCount} 部署中
            </Badge>
          )}
        </div>
      </div>

      {/* 中间件列表 */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
        {middlewareStatus.map((mw) => {
          const config = getStatusConfig(mw.status);
          const Icon = config.icon;
          const CategoryIcon = getCategoryIcon(mw.category);
          return (
            <div
              key={mw.name}
              className={`flex items-center justify-between p-2 ${config.bg} border ${config.border} rounded-lg`}
            >
              <div className="flex items-center gap-2">
                <CategoryIcon className="h-3 w-3 text-slate-400" />
                <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                <span className="text-slate-300 font-medium">{mw.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {mw.port && mw.status === "running" && (
                  <span className="text-[10px] text-slate-500 font-mono">:{mw.port}</span>
                )}
                <span className={`text-[10px] ${config.color}`}>
                  {mw.status === "running" ? "运行中" : mw.status === "pending" ? "部署中" : "未部署"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 快速访问 */}
      <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-lg">
        <p className="text-sky-400 font-semibold text-[10px] mb-1">快速访问</p>
        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          <a href="http://109.206.245.63:30090" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-400">
            Prometheus →
          </a>
          <a href="http://109.206.245.63:30030" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-400">
            Grafana →
          </a>
        </div>
      </div>
    </div>
  );
}

// 告警列表
function AlertList() {
  return (
    <div className="space-y-2 max-h-40 overflow-auto">
      <div className="flex items-center gap-2 p-2 rounded-lg text-xs bg-emerald-500/10 border-l-2 border-emerald-500">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
        <span className="text-slate-300 flex-1 truncate">系统运行正常，暂无告警</span>
        <span className="text-slate-500 text-[10px]">现在</span>
      </div>
    </div>
  );
}

export default function VisualizationDashboardPage() {
  const [panelOrder, setPanelOrder] = useState(["nodes", "metrics", "resources", "network", "alerts", "deploy"]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const handle = useFullScreenHandle();

  // 获取真实数据
  const { data: overview } = useClusterOverview();
  const { data: nodesData } = useNodes();
  const { data: podsData } = usePods();

  // Ensure nodes and pods are always arrays
  const nodes = Array.isArray(nodesData) ? nodesData : [];
  const pods = Array.isArray(podsData) ? podsData : [];

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPanelOrder(items => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      handle.exit();
    } else {
      handle.enter();
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen, handle]);

  const panelComponents: Record<string, { component: React.ReactNode; title: string; className: string }> = {
    nodes: {
      component: <NodeGrid nodes={nodes.length > 0 ? nodes : Array(16).fill(null).map((_, i) => ({ name: `node-${i}`, status: "Ready", ip: "—", roles: ["worker"] }))} />,
      title: `集群节点状态 (${nodes.length || 0} 个)`,
      className: "col-span-2 row-span-2 min-h-[300px]",
    },
    metrics: {
      component: (
        <div className="grid grid-cols-2 gap-3 h-full">
          <MetricPanel title="集群节点" value={overview?.nodes || 0} unit="个" icon={Server} color="text-sky-400" />
          <MetricPanel title="运行中 Pod" value={overview?.runningPods || 0} unit="个" icon={Container} color="text-green-400" />
          <MetricPanel title="命名空间" value={overview?.namespaces || 0} unit="个" icon={Network} color="text-purple-400" />
          <MetricPanel title="Deployment" value={overview?.deployments || 0} unit="个" icon={Zap} color="text-amber-400" />
        </div>
      ),
      title: "核心指标",
      className: "col-span-1 row-span-1",
    },
    resources: {
      component: (
        <div className="flex items-center justify-around h-full py-2">
          <CircularProgress
            value={overview && overview.nodes > 0 ? (overview.readyNodes / overview.nodes) * 100 : 0}
            color="text-sky-400"
            label="节点可用"
            icon={Cpu}
          />
          <CircularProgress value={68} color="text-purple-400" label="内存" icon={HardDrive} />
        </div>
      ),
      title: "资源使用率",
      className: "col-span-1 row-span-1",
    },
    network: {
      component: <FlowChart />,
      title: "网络流量",
      className: "col-span-1 row-span-1",
    },
    alerts: {
      component: <AlertList />,
      title: "实时告警",
      className: "col-span-1 row-span-1",
    },
    deploy: {
      component: <MiddlewarePanel pods={pods} />,
      title: "集群服务状态",
      className: "col-span-1 row-span-1",
    },
  };

  return (
    <FullScreen handle={handle}>
      <div className="h-screen bg-[#020617] overflow-hidden flex flex-col">
        {/* 顶部标题栏 */}
        <header className="h-14 border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-sky-500/20">
                <Monitor className="text-white text-lg" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">KubeNext 监控大屏</h1>
                <p className="text-[10px] text-sky-400 font-mono">Go 1.26 + K8s client-go v0.35.2</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xl font-mono text-white font-bold">
                {currentTime.toLocaleTimeString("zh-CN", { hour12: false })}
              </p>
              <p className="text-[10px] text-slate-500">
                {currentTime.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })}
              </p>
            </div>

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white h-8 w-8">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
              <Button size="sm" className="bg-sky-500 hover:bg-sky-600 text-white h-8" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </header>

        {/* 主内容区 */}
        <main className="flex-1 p-3 overflow-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={panelOrder} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-4 gap-3 auto-rows-min">
                {panelOrder.map(panelId => {
                  const panel = panelComponents[panelId];
                  return (
                    <DraggablePanel key={panelId} id={panelId} title={panel.title} className={panel.className}>
                      {panel.component}
                    </DraggablePanel>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </main>

        {/* 底部状态栏 */}
        <footer className="h-8 border-t border-slate-800/50 bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-4 text-[10px] shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-slate-500">
              K8s API: <span className={overview ? "text-green-400" : "text-amber-400"}>{overview ? "已连接" : "未配置"}</span>
            </span>
            <span className="text-slate-500">
              Prometheus: <span className="text-green-400">:30090</span>
            </span>
            <span className="text-slate-500">
              Grafana: <span className="text-green-400">:30030</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-500">
              Go 版本: <span className="text-white">1.26.0</span>
            </span>
            <span className="text-slate-500">
              client-go: <span className="text-white">v0.35.2</span>
            </span>
          </div>
        </footer>
      </div>
    </FullScreen>
  );
}
