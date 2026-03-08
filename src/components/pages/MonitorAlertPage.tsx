"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Gauge,
  AlertTriangle,
  Bell,
  BellOff,
  Plus,
  Search,
  MoreVertical,
  RefreshCw,
  Trash2,
  Edit,
  Eye,
  Settings,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  Server,
  Cpu,
  HardDrive,
  Wifi,
  Zap,
  Shield,
  Globe,
  Mail,
  MessageSquare,
  Webhook,
} from "lucide-react";

// Mock data for active alerts
const activeAlerts = [
  {
    id: 1,
    name: "HighCPUUsage",
    severity: "critical",
    message: "节点 worker-node-03 CPU 使用率超过 90%",
    labels: { node: "worker-node-03", namespace: "default" },
    startsAt: "2024-01-15 14:25:30",
    duration: "15 分钟",
    status: "firing",
  },
  {
    id: 2,
    name: "MemoryPressure",
    severity: "warning",
    message: "命名空间 production 内存使用率达到 85%",
    labels: { namespace: "production" },
    startsAt: "2024-01-15 14:10:00",
    duration: "30 分钟",
    status: "firing",
  },
  {
    id: 3,
    name: "PodCrashLooping",
    severity: "critical",
    message: "Pod payment-api-74fd 持续重启 (重启次数: 15)",
    labels: { pod: "payment-api-74fd", namespace: "default" },
    startsAt: "2024-01-15 13:45:00",
    duration: "55 分钟",
    status: "firing",
  },
  {
    id: 4,
    name: "DiskPressure",
    severity: "warning",
    message: "节点 worker-node-05 磁盘使用率达到 80%",
    labels: { node: "worker-node-05" },
    startsAt: "2024-01-15 12:00:00",
    duration: "2 小时 40 分钟",
    status: "firing",
  },
  {
    id: 5,
    name: "ServiceUnavailable",
    severity: "info",
    message: "服务 redis-sentinel 健康检查失败",
    labels: { service: "redis-sentinel", namespace: "cache" },
    startsAt: "2024-01-15 14:20:00",
    duration: "20 分钟",
    status: "firing",
  },
];

// Mock data for alert rules
const alertRules = [
  {
    id: 1,
    name: "HighCPUUsage",
    expr: "node_cpu_usage > 0.9",
    duration: "5m",
    severity: "critical",
    for: "5 分钟",
    status: "enabled",
    alertCount: 1,
  },
  {
    id: 2,
    name: "HighMemoryUsage",
    expr: "node_memory_usage > 0.85",
    duration: "10m",
    severity: "warning",
    for: "10 分钟",
    status: "enabled",
    alertCount: 1,
  },
  {
    id: 3,
    name: "PodCrashLooping",
    expr: "rate(kube_pod_container_status_restarts_total[1h]) > 0.1",
    duration: "5m",
    severity: "critical",
    for: "5 分钟",
    status: "enabled",
    alertCount: 1,
  },
  {
    id: 4,
    name: "DiskPressure",
    expr: "node_filesystem_usage > 0.8",
    duration: "15m",
    severity: "warning",
    for: "15 分钟",
    status: "enabled",
    alertCount: 1,
  },
  {
    id: 5,
    name: "NodeNotReady",
    expr: "kube_node_status_condition{condition=\"Ready\",status!=\"true\"}",
    duration: "1m",
    severity: "critical",
    for: "1 分钟",
    status: "enabled",
    alertCount: 0,
  },
  {
    id: 6,
    name: "ServiceLatency",
    expr: "http_request_duration_seconds{quantile=\"0.99\"} > 2",
    duration: "5m",
    severity: "warning",
    for: "5 分钟",
    status: "disabled",
    alertCount: 0,
  },
];

// Mock data for notification channels
const notificationChannels = [
  {
    id: 1,
    name: "运维邮件组",
    type: "email",
    config: "ops-team@company.com",
    status: "enabled",
    lastSent: "5 分钟前",
    sentCount: 156,
  },
  {
    id: 2,
    name: "企业微信告警",
    type: "wechat",
    config: "webhook: qyapi.weixin.qq.com/xxx",
    status: "enabled",
    lastSent: "15 分钟前",
    sentCount: 342,
  },
  {
    id: 3,
    name: "钉钉机器人",
    type: "dingtalk",
    config: "webhook: oapi.dingtalk.com/xxx",
    status: "enabled",
    lastSent: "30 分钟前",
    sentCount: 89,
  },
  {
    id: 4,
    name: "PagerDuty",
    type: "pagerduty",
    config: "service_key: xxxxxx",
    status: "disabled",
    lastSent: "1 天前",
    sentCount: 12,
  },
  {
    id: 5,
    name: "Slack 通知",
    type: "slack",
    config: "webhook: hooks.slack.com/xxx",
    status: "enabled",
    lastSent: "2 小时前",
    sentCount: 45,
  },
];

// Mock metrics
const metricsOverview = {
  totalAlerts: 5,
  critical: 2,
  warning: 2,
  info: 1,
  silenced: 3,
  avgResolution: "12 分钟",
};

export default function MonitorAlertPage() {
  const [activeTab, setActiveTab] = useState("alerts");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);

  const filteredAlerts = activeAlerts.filter(
    (alert) =>
      alert.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Gauge className="text-sky-400 h-7 w-7" />
            监控告警中心
          </h1>
          <p className="text-slate-400 text-sm mt-1">集群监控指标、告警规则和通知渠道管理</p>
        </div>
        <div className="flex gap-3">
          <Button className="bg-sky-500 hover:bg-sky-600 text-white" onClick={() => setShowCreateRule(true)}>
            <Plus className="h-4 w-4 mr-2" />
            创建告警规则
          </Button>
          <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-6 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <p className="text-xs text-slate-400">活跃告警</p>
          </div>
          <p className="text-2xl font-bold text-white">{metricsOverview.totalAlerts}</p>
        </div>
        <div className="glass-card p-4 border-rose-500/30">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-4 w-4 text-rose-400" />
            <p className="text-xs text-slate-400">严重</p>
          </div>
          <p className="text-2xl font-bold text-rose-400">{metricsOverview.critical}</p>
        </div>
        <div className="glass-card p-4 border-amber-500/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <p className="text-xs text-slate-400">警告</p>
          </div>
          <p className="text-2xl font-bold text-amber-400">{metricsOverview.warning}</p>
        </div>
        <div className="glass-card p-4 border-sky-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-sky-400" />
            <p className="text-xs text-slate-400">信息</p>
          </div>
          <p className="text-2xl font-bold text-sky-400">{metricsOverview.info}</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <BellOff className="h-4 w-4 text-slate-400" />
            <p className="text-xs text-slate-400">静默中</p>
          </div>
          <p className="text-2xl font-bold text-white">{metricsOverview.silenced}</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-green-400" />
            <p className="text-xs text-slate-400">平均恢复</p>
          </div>
          <p className="text-2xl font-bold text-white">{metricsOverview.avgResolution}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex gap-6">
          {[
            { id: "alerts", label: "活跃告警", icon: AlertTriangle },
            { id: "rules", label: "告警规则", icon: Settings },
            { id: "notifications", label: "通知渠道", icon: Bell },
            { id: "silences", label: "静默规则", icon: BellOff },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-1 py-3 border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-sky-500 text-sky-400"
                  : "border-transparent text-slate-400 hover:text-slate-300"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "alerts" && (
        <div className="space-y-4">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="搜索告警..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-900 border-slate-700"
            />
          </div>

          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`glass-card p-5 border-l-4 ${
                alert.severity === "critical"
                  ? "border-l-rose-500"
                  : alert.severity === "warning"
                    ? "border-l-amber-500"
                    : "border-l-sky-500"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className={`p-2 rounded-lg ${
                      alert.severity === "critical"
                        ? "bg-rose-500/10"
                        : alert.severity === "warning"
                          ? "bg-amber-500/10"
                          : "bg-sky-500/10"
                    }`}
                  >
                    <AlertTriangle
                      className={`h-5 w-5 ${
                        alert.severity === "critical"
                          ? "text-rose-400"
                          : alert.severity === "warning"
                            ? "text-amber-400"
                            : "text-sky-400"
                      }`}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-white">{alert.name}</h3>
                      <Badge
                        className={`${
                          alert.severity === "critical"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : alert.severity === "warning"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-sky-500/10 text-sky-400 border-sky-500/20"
                        }`}
                      >
                        {alert.severity === "critical" ? "严重" : alert.severity === "warning" ? "警告" : "信息"}
                      </Badge>
                      <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                        {alert.status}
                      </Badge>
                    </div>
                    <p className="text-slate-300">{alert.message}</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(alert.labels).map(([key, value]) => (
                        <Badge key={key} className="bg-slate-700 text-slate-300">
                          {key}={value}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span><Clock className="h-3 w-3 inline mr-1" />开始: {alert.startsAt}</span>
                      <span>持续时间: {alert.duration}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-sky-500 hover:bg-sky-600">
                    <Eye className="h-4 w-4 mr-1" /> 详情
                  </Button>
                  <Button size="sm" variant="outline" className="border-slate-700 text-slate-300">
                    <BellOff className="h-4 w-4 mr-1" /> 静默
                  </Button>
                  <Button size="sm" variant="outline" className="border-green-500/50 text-green-400">
                    <CheckCircle2 className="h-4 w-4 mr-1" /> 已解决
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "rules" && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">告警规则配置</h3>
            <Button size="sm" className="bg-sky-500 hover:bg-sky-600" onClick={() => setShowCreateRule(true)}>
              <Plus className="h-4 w-4 mr-2" /> 新建规则
            </Button>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">规则名称</th>
                <th className="px-6 py-4 font-medium">表达式</th>
                <th className="px-6 py-4 font-medium">持续时间</th>
                <th className="px-6 py-4 font-medium">严重级别</th>
                <th className="px-6 py-4 font-medium">状态</th>
                <th className="px-6 py-4 font-medium">告警数</th>
                <th className="px-6 py-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {alertRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-semibold text-white">{rule.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-xs text-sky-400 bg-slate-800 px-2 py-1 rounded">{rule.expr}</code>
                  </td>
                  <td className="px-6 py-4 text-slate-400">{rule.for}</td>
                  <td className="px-6 py-4">
                    <Badge
                      className={`${
                        rule.severity === "critical"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : rule.severity === "warning"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-sky-500/10 text-sky-400 border-sky-500/20"
                      }`}
                    >
                      {rule.severity}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      className={`${
                        rule.status === "enabled"
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                      }`}
                    >
                      {rule.status === "enabled" ? "启用" : "禁用"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <span className={rule.alertCount > 0 ? "text-rose-400" : "text-slate-400"}>
                      {rule.alertCount}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                        {rule.status === "enabled" ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="grid grid-cols-2 gap-4">
          {notificationChannels.map((channel) => (
            <div key={channel.id} className="glass-card p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      channel.type === "email"
                        ? "bg-sky-500/10"
                        : channel.type === "wechat"
                          ? "bg-green-500/10"
                          : channel.type === "dingtalk"
                            ? "bg-purple-500/10"
                            : channel.type === "slack"
                              ? "bg-amber-500/10"
                              : "bg-rose-500/10"
                    }`}
                  >
                    {channel.type === "email" ? (
                      <Mail className="h-5 w-5 text-sky-400" />
                    ) : channel.type === "wechat" ? (
                      <MessageSquare className="h-5 w-5 text-green-400" />
                    ) : channel.type === "dingtalk" ? (
                      <MessageSquare className="h-5 w-5 text-purple-400" />
                    ) : channel.type === "slack" ? (
                      <Globe className="h-5 w-5 text-amber-400" />
                    ) : (
                      <Webhook className="h-5 w-5 text-rose-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{channel.name}</h3>
                    <p className="text-xs text-slate-500 font-mono truncate max-w-[200px]">{channel.config}</p>
                  </div>
                </div>
                <Badge
                  className={`${
                    channel.status === "enabled"
                      ? "bg-green-500/10 text-green-400 border-green-500/20"
                      : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                  }`}
                >
                  {channel.status === "enabled" ? "启用" : "禁用"}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">最后发送</p>
                  <p className="text-white">{channel.lastSent}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">发送次数</p>
                  <p className="text-white">{channel.sentCount}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-800">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                  <Edit className="h-4 w-4 mr-1" /> 编辑
                </Button>
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                  <RefreshCw className="h-4 w-4 mr-1" /> 测试
                </Button>
                <Button variant="ghost" size="sm" className="text-rose-400 hover:text-rose-300">
                  <Trash2 className="h-4 w-4 mr-1" /> 删除
                </Button>
              </div>
            </div>
          ))}
          <button
            className="glass-card p-5 flex flex-col items-center justify-center text-slate-400 hover:text-sky-400 hover:border-sky-500/50 transition-all"
            onClick={() => setShowCreateChannel(true)}
          >
            <Plus className="h-8 w-8 mb-2" />
            <span>添加通知渠道</span>
          </button>
        </div>
      )}

      {activeTab === "silences" && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">静默规则</h3>
            <Button size="sm" className="bg-sky-500 hover:bg-sky-600">
              <Plus className="h-4 w-4 mr-2" /> 创建静默
            </Button>
          </div>
          <div className="space-y-3">
            {[
              { name: "维护窗口静默", matchers: "alertname=maintenance", startsAt: "2024-01-16 02:00", endsAt: "2024-01-16 06:00", createdBy: "admin" },
              { name: "测试环境静默", matchers: "namespace=staging", startsAt: "2024-01-15 00:00", endsAt: "2024-01-20 00:00", createdBy: "dev-team" },
            ].map((silence, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-slate-700 rounded-lg">
                    <BellOff className="h-5 w-5 text-slate-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">{silence.name}</h4>
                    <p className="text-xs text-slate-500 font-mono">{silence.matchers}</p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p className="text-slate-400">
                    {silence.startsAt} → {silence.endsAt}
                  </p>
                  <p className="text-xs text-slate-500">创建者: {silence.createdBy}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-rose-400 hover:text-rose-300">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Rule Dialog */}
      <Dialog open={showCreateRule} onOpenChange={setShowCreateRule}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Settings className="h-5 w-5 text-sky-400" />
              创建告警规则
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              配置新的告警规则
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">规则名称</label>
              <Input placeholder="HighCPUUsage" className="bg-slate-800 border-slate-700" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">PromQL 表达式</label>
              <textarea
                className="w-full h-20 bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-300 resize-none focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="node_cpu_usage > 0.9"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">持续时间</label>
                <Input placeholder="5m" className="bg-slate-800 border-slate-700" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">严重级别</label>
                <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="critical">Critical</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">告警消息模板</label>
              <Input placeholder="节点 {{ $labels.node }} CPU 使用率过高" className="bg-slate-800 border-slate-700" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateRule(false)} className="border-slate-700 text-slate-300">
              取消
            </Button>
            <Button className="bg-sky-500 hover:bg-sky-600" onClick={() => setShowCreateRule(false)}>
              创建规则
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Channel Dialog */}
      <Dialog open={showCreateChannel} onOpenChange={setShowCreateChannel}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Bell className="h-5 w-5 text-sky-400" />
              添加通知渠道
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              配置告警通知渠道
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">渠道名称</label>
              <Input placeholder="运维邮件组" className="bg-slate-800 border-slate-700" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">渠道类型</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { type: "email", icon: Mail, label: "邮件" },
                  { type: "wechat", icon: MessageSquare, label: "企业微信" },
                  { type: "dingtalk", icon: MessageSquare, label: "钉钉" },
                  { type: "slack", icon: Globe, label: "Slack" },
                  { type: "pagerduty", icon: AlertTriangle, label: "PagerDuty" },
                  { type: "webhook", icon: Webhook, label: "Webhook" },
                ].map((item) => (
                  <Button
                    key={item.type}
                    variant="outline"
                    className="border-slate-700 text-slate-400 hover:border-sky-500 hover:text-sky-400"
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">配置详情</label>
              <Input placeholder="email@example.com 或 webhook URL" className="bg-slate-800 border-slate-700" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">通知级别</label>
              <div className="flex gap-2">
                {["critical", "warning", "info"].map((level) => (
                  <Badge
                    key={level}
                    className="cursor-pointer bg-slate-800 text-slate-400 hover:bg-sky-500/20 hover:text-sky-400"
                  >
                    {level}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateChannel(false)} className="border-slate-700 text-slate-300">
              取消
            </Button>
            <Button className="bg-sky-500 hover:bg-sky-600" onClick={() => setShowCreateChannel(false)}>
              添加渠道
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
