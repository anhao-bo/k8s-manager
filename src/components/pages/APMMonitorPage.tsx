"use client";

import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Activity,
  Globe,
  Zap,
  Clock,
  TrendingUp,
  TrendingDown,
  Server,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Network,
  Timer,
  BarChart3,
  PieChart,
} from "lucide-react";

// 服务数据
const services = [
  { id: "gateway", name: "API Gateway", type: "gateway", x: 400, y: 80, status: "healthy", rps: 1250, latency: 12 },
  { id: "user", name: "User Service", type: "service", x: 200, y: 200, status: "healthy", rps: 320, latency: 45 },
  { id: "order", name: "Order Service", type: "service", x: 400, y: 200, status: "warning", rps: 580, latency: 89 },
  { id: "payment", name: "Payment Service", type: "service", x: 600, y: 200, status: "healthy", rps: 180, latency: 156 },
  { id: "notification", name: "Notification", type: "service", x: 200, y: 320, status: "healthy", rps: 95, latency: 23 },
  { id: "inventory", name: "Inventory", type: "service", x: 400, y: 320, status: "healthy", rps: 220, latency: 34 },
  { id: "mysql", name: "MySQL", type: "database", x: 200, y: 440, status: "healthy", rps: 1200, latency: 2 },
  { id: "redis", name: "Redis", type: "cache", x: 400, y: 440, status: "healthy", rps: 3500, latency: 0.5 },
  { id: "kafka", name: "Kafka", type: "mq", x: 600, y: 320, status: "healthy", rps: 890, latency: 3 },
];

// 服务调用关系
const connections = [
  { from: "gateway", to: "user", traffic: 320, latency: 45, errorRate: 0.1 },
  { from: "gateway", to: "order", traffic: 580, latency: 89, errorRate: 1.2 },
  { from: "gateway", to: "payment", traffic: 180, latency: 156, errorRate: 0.05 },
  { from: "user", to: "mysql", traffic: 640, latency: 2, errorRate: 0 },
  { from: "user", to: "redis", traffic: 960, latency: 0.5, errorRate: 0 },
  { from: "order", to: "mysql", traffic: 1160, latency: 2, errorRate: 0.1 },
  { from: "order", to: "inventory", traffic: 220, latency: 34, errorRate: 0.2 },
  { from: "order", to: "kafka", traffic: 580, latency: 3, errorRate: 0 },
  { from: "payment", to: "kafka", traffic: 180, latency: 3, errorRate: 0 },
  { from: "notification", to: "kafka", traffic: 95, latency: 3, errorRate: 0 },
  { from: "inventory", to: "mysql", traffic: 440, latency: 2, errorRate: 0 },
];

// 接口响应数据
const generateApiMetrics = () => {
  const apis = [
    { path: "/api/v1/users", method: "GET", service: "user" },
    { path: "/api/v1/users/:id", method: "GET", service: "user" },
    { path: "/api/v1/orders", method: "POST", service: "order" },
    { path: "/api/v1/orders/:id", method: "GET", service: "order" },
    { path: "/api/v1/payments", method: "POST", service: "payment" },
    { path: "/api/v1/payments/callback", method: "POST", service: "payment" },
    { path: "/api/v1/inventory/check", method: "GET", service: "inventory" },
    { path: "/api/v1/notifications/send", method: "POST", service: "notification" },
  ];

  return apis.map(api => ({
    ...api,
    latency: Math.floor(Math.random() * 200 + 10),
    p99: Math.floor(Math.random() * 300 + 50),
    p95: Math.floor(Math.random() * 200 + 30),
    qps: Math.floor(Math.random() * 500 + 50),
    errorRate: (Math.random() * 2).toFixed(2),
    status: Math.random() > 0.9 ? "error" : Math.random() > 0.8 ? "warning" : "ok",
  }));
};

// 实时请求流
const generateRequestStream = () => {
  const methods = ["GET", "POST", "PUT", "DELETE"];
  const paths = ["/api/v1/users", "/api/v1/orders", "/api/v1/payments", "/api/v1/inventory"];
  const statuses = [200, 200, 200, 200, 201, 400, 500];

  return Array.from({ length: 15 }, (_, i) => ({
    id: i,
    time: new Date(Date.now() - i * 500).toLocaleTimeString("zh-CN", { hour12: false }),
    method: methods[Math.floor(Math.random() * methods.length)],
    path: paths[Math.floor(Math.random() * paths.length)],
    status: statuses[Math.floor(Math.random() * statuses.length)],
    latency: Math.floor(Math.random() * 300 + 5),
    size: Math.floor(Math.random() * 5000 + 100),
  }));
};

// 服务拓扑图组件
function ServiceTopology({ selectedService, onSelectService }: {
  selectedService: string | null;
  onSelectService: (id: string) => void;
}) {
  const [animatingConnection, setAnimatingConnection] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const randomConn = connections[Math.floor(Math.random() * connections.length)];
      setAnimatingConnection(`${randomConn.from}-${randomConn.to}`);
      setTimeout(() => setAnimatingConnection(null), 500);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getServiceIcon = (type: string) => {
    switch (type) {
      case "gateway": return Globe;
      case "database": return Server;
      case "cache": return Zap;
      case "mq": return Activity;
      default: return CircleDot;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy": return "border-green-500 bg-green-500/10";
      case "warning": return "border-amber-500 bg-amber-500/10";
      case "error": return "border-rose-500 bg-rose-500/10";
      default: return "border-slate-500 bg-slate-500/10";
    }
  };

  return (
    <div className="relative w-full h-full min-h-[500px] bg-slate-900/30 rounded-xl overflow-hidden">
      {/* SVG 连接线 */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="1" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0.3" />
          </linearGradient>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#38bdf8" />
          </marker>
        </defs>

        {connections.map((conn, i) => {
          const from = services.find(s => s.id === conn.from)!;
          const to = services.find(s => s.id === conn.to)!;
          const isActive = animatingConnection === `${conn.from}-${conn.to}`;

          return (
            <g key={i}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="rgba(56, 189, 248, 0.15)"
                strokeWidth="2"
              />
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="url(#lineGradient)"
                strokeWidth={isActive ? "3" : "2"}
                strokeDasharray={isActive ? "0" : "5,5"}
                className={isActive ? "animate-pulse" : ""}
                opacity={isActive ? 1 : 0.4}
              />
              {/* 流量动画点 */}
              {isActive && (
                <circle r="4" fill="#38bdf8">
                  <animateMotion
                    dur="0.5s"
                    repeatCount="1"
                    path={`M${from.x},${from.y} L${to.x},${to.y}`}
                  />
                </circle>
              )}
              {/* 错误率指示 */}
              {conn.errorRate > 0.5 && (
                <circle
                  cx={(from.x + to.x) / 2}
                  cy={(from.y + to.y) / 2}
                  r="6"
                  fill="rgba(245, 158, 11, 0.8)"
                  className="animate-ping"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* 服务节点 */}
      {services.map((service) => {
        const Icon = getServiceIcon(service.type);
        const isSelected = selectedService === service.id;

        return (
          <button
            key={service.id}
            onClick={() => onSelectService(service.id)}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${
              isSelected ? "scale-110 z-10" : "hover:scale-105"
            }`}
            style={{ left: service.x, top: service.y }}
          >
            <div className={`relative p-3 rounded-xl border-2 ${getStatusColor(service.status)} ${
              isSelected ? "ring-2 ring-sky-500 ring-offset-2 ring-offset-slate-900" : ""
            }`}>
              {/* 状态指示灯 */}
              <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                service.status === "healthy" ? "bg-green-500" :
                service.status === "warning" ? "bg-amber-500" : "bg-rose-500"
              }`}>
                {service.status === "healthy" && (
                  <div className="w-full h-full rounded-full bg-green-500 animate-ping opacity-50" />
                )}
              </div>

              <Icon className={`h-6 w-6 ${
                service.status === "healthy" ? "text-green-400" :
                service.status === "warning" ? "text-amber-400" : "text-rose-400"
              }`} />

              {/* 服务名称 */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap">
                <p className="text-[10px] font-medium text-white">{service.name}</p>
                <p className="text-[8px] text-slate-500 text-center">
                  {service.rps} RPS · {service.latency}ms
                </p>
              </div>
            </div>
          </button>
        );
      })}

      {/* 图例 */}
      <div className="absolute bottom-4 left-4 flex items-center gap-4 bg-slate-900/80 rounded-lg px-3 py-2 text-[10px]">
        <div className="flex items-center gap-1.5">
          <Globe className="h-3 w-3 text-sky-400" />
          <span className="text-slate-400">Gateway</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CircleDot className="h-3 w-3 text-purple-400" />
          <span className="text-slate-400">Service</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Server className="h-3 w-3 text-emerald-400" />
          <span className="text-slate-400">Database</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-amber-400" />
          <span className="text-slate-400">Cache</span>
        </div>
      </div>
    </div>
  );
}

// 接口实时响应表格
function ApiResponseTable() {
  const [apiMetrics, setApiMetrics] = useState(generateApiMetrics);

  useEffect(() => {
    const interval = setInterval(() => {
      setApiMetrics(generateApiMetrics());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ok":
        return <Badge className="bg-green-500/10 text-green-400 border-0 text-[10px]">正常</Badge>;
      case "warning":
        return <Badge className="bg-amber-500/10 text-amber-400 border-0 text-[10px]">警告</Badge>;
      case "error":
        return <Badge className="bg-rose-500/10 text-rose-400 border-0 text-[10px]">异常</Badge>;
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET": return "text-green-400 bg-green-500/10";
      case "POST": return "text-sky-400 bg-sky-500/10";
      case "PUT": return "text-amber-400 bg-amber-500/10";
      case "DELETE": return "text-rose-400 bg-rose-500/10";
      default: return "text-slate-400 bg-slate-500/10";
    }
  };

  return (
    <div className="overflow-auto max-h-[300px]">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-slate-900/90 text-slate-500 text-[10px] uppercase">
          <tr>
            <th className="px-3 py-2 font-medium">接口</th>
            <th className="px-3 py-2 font-medium">延迟</th>
            <th className="px-3 py-2 font-medium">P99</th>
            <th className="px-3 py-2 font-medium">QPS</th>
            <th className="px-3 py-2 font-medium">错误率</th>
            <th className="px-3 py-2 font-medium">状态</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {apiMetrics.map((api, i) => (
            <tr key={i} className="hover:bg-slate-800/30 transition-colors">
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${getMethodColor(api.method)}`}>
                    {api.method}
                  </span>
                  <span className="font-mono text-sky-400 truncate max-w-[150px]">{api.path}</span>
                </div>
              </td>
              <td className="px-3 py-2">
                <span className={api.latency > 150 ? "text-amber-400" : "text-white"}>
                  {api.latency}ms
                </span>
              </td>
              <td className="px-3 py-2">
                <span className={api.p99 > 200 ? "text-rose-400" : "text-slate-400"}>
                  {api.p99}ms
                </span>
              </td>
              <td className="px-3 py-2 text-white">{api.qps}</td>
              <td className="px-3 py-2">
                <span className={parseFloat(api.errorRate) > 1 ? "text-rose-400" : "text-slate-400"}>
                  {api.errorRate}%
                </span>
              </td>
              <td className="px-3 py-2">{getStatusBadge(api.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 实时请求流
function RequestStream() {
  const [requests, setRequests] = useState(generateRequestStream);

  useEffect(() => {
    const interval = setInterval(() => {
      setRequests(prev => {
        const newReq = {
          id: Date.now(),
          time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
          method: ["GET", "POST", "PUT", "DELETE"][Math.floor(Math.random() * 4)],
          path: ["/api/v1/users", "/api/v1/orders", "/api/v1/payments", "/api/v1/inventory"][Math.floor(Math.random() * 4)],
          status: [200, 200, 200, 201, 400, 500][Math.floor(Math.random() * 6)],
          latency: Math.floor(Math.random() * 300 + 5),
          size: Math.floor(Math.random() * 5000 + 100),
        };
        return [newReq, ...prev.slice(0, 14)];
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "text-green-400";
    if (status >= 400 && status < 500) return "text-amber-400";
    return "text-rose-400";
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET": return "text-green-400";
      case "POST": return "text-sky-400";
      case "PUT": return "text-amber-400";
      case "DELETE": return "text-rose-400";
      default: return "text-slate-400";
    }
  };

  return (
    <div className="space-y-1 max-h-[200px] overflow-auto">
      {requests.map((req, i) => (
        <div
          key={req.id}
          className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] font-mono transition-all ${
            i === 0 ? "bg-sky-500/10 border border-sky-500/30" : ""
          }`}
        >
          <span className="text-slate-500 w-16">{req.time}</span>
          <span className={`${getMethodColor(req.method)} w-10`}>{req.method}</span>
          <span className="text-sky-400 flex-1 truncate">{req.path}</span>
          <span className={`${getStatusColor(req.status)} w-8`}>{req.status}</span>
          <span className={req.latency > 200 ? "text-amber-400" : "text-slate-400"}>{req.latency}ms</span>
        </div>
      ))}
    </div>
  );
}

// 流量图表
function TrafficChart() {
  const [data, setData] = useState<number[]>(Array(60).fill(0).map(() => Math.random() * 1000 + 200));

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => [...prev.slice(1), Math.random() * 1000 + 200]);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const max = Math.max(...data);

  return (
    <div className="h-32 flex items-end gap-0.5">
      {data.map((value, i) => (
        <div
          key={i}
          className="flex-1 rounded-t transition-all duration-300 relative group"
          style={{
            height: `${(value / max) * 100}%`,
            background: `linear-gradient(to top, 
              rgba(56, 189, 248, 0.8) 0%, 
              rgba(168, 85, 247, 0.4) 100%
            )`,
            boxShadow: value > max * 0.8 ? "0 0 10px rgba(56, 189, 248, 0.5)" : "none",
          }}
        >
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span className="text-[10px] text-white bg-slate-800 px-1 rounded">{Math.floor(value)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// 延迟分布图
function LatencyDistribution() {
  const buckets = [
    { range: "0-50ms", count: 4520, percent: 72 },
    { range: "50-100ms", count: 890, percent: 14 },
    { range: "100-200ms", count: 520, percent: 8 },
    { range: "200-500ms", count: 280, percent: 4 },
    { range: ">500ms", count: 150, percent: 2 },
  ];

  return (
    <div className="space-y-2">
      {buckets.map((bucket, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-400">{bucket.range}</span>
            <span className="text-white">{bucket.count.toLocaleString()}</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                i < 2 ? "bg-green-500" : i < 4 ? "bg-amber-500" : "bg-rose-500"
              }`}
              style={{ width: `${bucket.percent}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// 统计卡片
function StatCard({ title, value, unit, change, icon: Icon, color }: {
  title: string;
  value: string | number;
  unit?: string;
  change?: { value: number; up: boolean };
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-400">{title}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="flex items-end gap-1">
        <span className="text-xl font-bold text-white">{value}</span>
        {unit && <span className="text-xs text-slate-500 mb-0.5">{unit}</span>}
      </div>
      {change && (
        <div className={`flex items-center gap-1 mt-1 text-[10px] ${change.up ? "text-green-400" : "text-rose-400"}`}>
          {change.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>{change.value}%</span>
        </div>
      )}
    </div>
  );
}

export default function APMMonitorPage() {
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [showServiceDetail, setShowServiceDetail] = useState(false);

  const selectedServiceData = useMemo(() => 
    services.find(s => s.id === selectedService),
    [selectedService]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Activity className="text-sky-400 h-7 w-7" />
            APM 性能监控
          </h1>
          <p className="text-slate-400 text-sm mt-1">实时监控服务性能、流量和调用链路</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="border-slate-700 text-slate-300">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button className="bg-sky-500 hover:bg-sky-600 text-white">
            <Clock className="h-4 w-4 mr-2" />
            时间范围: 实时
          </Button>
        </div>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-6 gap-4">
        <StatCard title="总请求量" value="1.2M" unit="/分钟" change={{ value: 12, up: true }} icon={Globe} color="text-sky-400" />
        <StatCard title="平均延迟" value="45" unit="ms" change={{ value: 5, up: false }} icon={Timer} color="text-purple-400" />
        <StatCard title="P99 延迟" value="186" unit="ms" icon={Clock} color="text-amber-400" />
        <StatCard title="错误率" value="0.12" unit="%" change={{ value: 0.05, up: false }} icon={AlertTriangle} color="text-rose-400" />
        <StatCard title="活跃服务" value="9" unit="个" icon={Server} color="text-green-400" />
        <StatCard title="吞吐量" value="8.5" unit="GB/s" icon={BarChart3} color="text-cyan-400" />
      </div>

      {/* 主内容区 */}
      <div className="grid grid-cols-3 gap-6">
        {/* 服务拓扑图 */}
        <div className="col-span-2 glass-card overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Network className="h-4 w-4 text-sky-400" />
              服务拓扑图
            </h3>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500/10 text-green-400 text-[10px]">
                <CheckCircle2 className="h-3 w-3 mr-1" /> 实时更新
              </Badge>
            </div>
          </div>
          <ServiceTopology
            selectedService={selectedService}
            onSelectService={(id) => {
              setSelectedService(id);
              setShowServiceDetail(true);
            }}
          />
        </div>

        {/* 右侧面板 */}
        <div className="space-y-4">
          {/* 实时请求流 */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-purple-400" />
                实时请求流
              </h3>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
            <RequestStream />
          </div>

          {/* 延迟分布 */}
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <PieChart className="h-4 w-4 text-amber-400" />
              延迟分布
            </h3>
            <LatencyDistribution />
          </div>
        </div>
      </div>

      {/* 接口响应表和流量图 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 接口响应表 */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              接口响应监控
            </h3>
            <Badge className="bg-slate-700 text-slate-300 text-[10px]">Top 8</Badge>
          </div>
          <div className="p-4">
            <ApiResponseTable />
          </div>
        </div>

        {/* 流量趋势 */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              流量趋势 (实时)
            </h3>
            <div className="flex items-center gap-4 text-[10px]">
              <span className="text-slate-400">当前: <span className="text-white">1,245 QPS</span></span>
              <span className="text-slate-400">峰值: <span className="text-amber-400">2,890 QPS</span></span>
            </div>
          </div>
          <TrafficChart />
          <div className="mt-4 grid grid-cols-4 gap-2">
            <div className="text-center p-2 bg-slate-800/50 rounded">
              <p className="text-lg font-bold text-white">1.2M</p>
              <p className="text-[10px] text-slate-500">请求/分钟</p>
            </div>
            <div className="text-center p-2 bg-slate-800/50 rounded">
              <p className="text-lg font-bold text-white">99.88%</p>
              <p className="text-[10px] text-slate-500">成功率</p>
            </div>
            <div className="text-center p-2 bg-slate-800/50 rounded">
              <p className="text-lg font-bold text-white">45ms</p>
              <p className="text-[10px] text-slate-500">平均延迟</p>
            </div>
            <div className="text-center p-2 bg-slate-800/50 rounded">
              <p className="text-lg font-bold text-white">8.5GB</p>
              <p className="text-[10px] text-slate-500">流量/分钟</p>
            </div>
          </div>
        </div>
      </div>

      {/* 服务详情弹窗 */}
      <Dialog open={showServiceDetail} onOpenChange={setShowServiceDetail}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Server className="h-5 w-5 text-sky-400" />
              {selectedServiceData?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedServiceData && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-[10px] text-slate-500">RPS</p>
                  <p className="text-xl font-bold text-white">{selectedServiceData.rps}</p>
                </div>
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-[10px] text-slate-500">延迟</p>
                  <p className="text-xl font-bold text-white">{selectedServiceData.latency}ms</p>
                </div>
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-[10px] text-slate-500">状态</p>
                  <Badge className={`${
                    selectedServiceData.status === "healthy" ? "bg-green-500/10 text-green-400" :
                    selectedServiceData.status === "warning" ? "bg-amber-500/10 text-amber-400" :
                    "bg-rose-500/10 text-rose-400"
                  }`}>
                    {selectedServiceData.status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* 调用关系 */}
              <div className="space-y-2">
                <p className="text-xs text-slate-400">调用关系</p>
                <div className="space-y-1">
                  {connections
                    .filter(c => c.from === selectedServiceData.id || c.to === selectedServiceData.id)
                    .slice(0, 5)
                    .map((conn, i) => {
                      const isIncoming = conn.to === selectedServiceData.id;
                      const otherService = services.find(s => s.id === (isIncoming ? conn.from : conn.to));
                      return (
                        <div key={i} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded text-xs">
                          {isIncoming ? (
                            <>
                              <span className="text-sky-400">{otherService?.name}</span>
                              <ArrowRight className="h-3 w-3 text-slate-500" />
                              <span className="text-slate-300">本服务</span>
                            </>
                          ) : (
                            <>
                              <span className="text-slate-300">本服务</span>
                              <ArrowRight className="h-3 w-3 text-slate-500" />
                              <span className="text-purple-400">{otherService?.name}</span>
                            </>
                          )}
                          <span className="text-slate-500 ml-auto">{conn.latency}ms</span>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1 bg-sky-500 hover:bg-sky-600">
                  <Activity className="h-4 w-4 mr-2" /> 查看详情
                </Button>
                <Button variant="outline" className="flex-1 border-slate-700 text-slate-300">
                  <BarChart3 className="h-4 w-4 mr-2" /> 性能分析
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
