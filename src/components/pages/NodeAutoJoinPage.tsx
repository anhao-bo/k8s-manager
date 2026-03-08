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
  PlusCircle,
  Terminal,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  Download,
  Server,
  Shield,
  Cpu,
  HardDrive,
  Wifi,
  Globe,
  Key,
  FileCode,
  Play,
  XCircle,
  Loader2,
} from "lucide-react";

// Mock data for join tokens
const joinTokens = [
  {
    id: 1,
    name: "production-worker-token",
    token: "abc123.xxxxxxxx",
    createdAt: "2024-01-15 10:30",
    expiresAt: "2024-01-22 10:30",
    usedCount: 5,
    maxUsage: 10,
    status: "active",
  },
  {
    id: 2,
    name: "edge-node-token",
    token: "def456.yyyyyyyy",
    createdAt: "2024-01-14 14:20",
    expiresAt: "2024-01-16 14:20",
    usedCount: 3,
    maxUsage: 5,
    status: "expired",
  },
  {
    id: 3,
    name: "gpu-node-token",
    token: "ghi789.zzzzzzzz",
    createdAt: "2024-01-15 08:00",
    expiresAt: "2024-01-30 08:00",
    usedCount: 0,
    maxUsage: 20,
    status: "active",
  },
];

// Mock data for pending nodes
const pendingNodes = [
  {
    id: 1,
    hostname: "worker-node-05",
    ip: "10.0.1.105",
    os: "Ubuntu 22.04 LTS",
    kernel: "5.15.0-91-generic",
    cpu: "8核",
    memory: "32GB",
    containerRuntime: "containerd://1.7.2",
    requestTime: "5 分钟前",
    status: "pending",
  },
  {
    id: 2,
    hostname: "gpu-node-02",
    ip: "10.0.1.110",
    os: "Ubuntu 22.04 LTS",
    kernel: "5.15.0-91-generic",
    cpu: "16核",
    memory: "128GB",
    containerRuntime: "containerd://1.7.2",
    requestTime: "12 分钟前",
    status: "pending",
  },
  {
    id: 3,
    hostname: "edge-node-01",
    ip: "10.0.2.50",
    os: "CentOS 8",
    kernel: "4.18.0-477.el8",
    cpu: "4核",
    memory: "16GB",
    containerRuntime: "docker://24.0.5",
    requestTime: "1 小时前",
    status: "rejected",
  },
];

// Mock data for auto-join history
const joinHistory = [
  { id: 1, node: "worker-node-04", ip: "10.0.1.104", time: "2024-01-15 09:30", status: "success", duration: "2m 15s" },
  { id: 2, node: "worker-node-03", ip: "10.0.1.103", time: "2024-01-14 16:45", status: "success", duration: "1m 50s" },
  { id: 3, node: "worker-node-02", ip: "10.0.1.102", time: "2024-01-14 11:20", status: "failed", duration: "-" },
  { id: 4, node: "gpu-node-01", ip: "10.0.1.108", time: "2024-01-13 14:10", status: "success", duration: "3m 22s" },
];

export default function NodeAutoJoinPage() {
  const [activeTab, setActiveTab] = useState("pending");
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [showScriptDialog, setShowScriptDialog] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState<Record<number, boolean>>({});

  const joinScript = `#!/bin/bash
# KubeNext 节点自动接入脚本
# 生成时间: ${new Date().toLocaleString()}

# 设置 Master 地址
MASTER_IP="10.0.0.1"
MASTER_PORT="6443"
JOIN_TOKEN="abc123.xxxxxxxx"

# 系统检查
echo "🔍 正在检查系统环境..."
# 检查容器运行时
if ! command -v containerd &> /dev/null; then
    echo "❌ 未检测到 containerd，请先安装容器运行时"
    exit 1
fi

# 检查内核版本
KERNEL_VERSION=$(uname -r | cut -d. -f1-2)
if (( $(echo "$KERNEL_VERSION < 4.18" | bc -l) )); then
    echo "⚠️ 内核版本过低，建议升级到 4.18+"
fi

# 执行节点接入
echo "🚀 正在加入集群..."
kubeadm join $MASTER_IP:$MASTER_PORT \\
    --token $JOIN_TOKEN \\
    --discovery-token-ca-cert-hash sha256:xxxx... \\
    --node-name=$(hostname)

echo "✅ 节点接入完成！"`;

  const copyToClipboard = (text: string, id?: string) => {
    navigator.clipboard.writeText(text);
    if (id) {
      setCopiedToken(id);
      setTimeout(() => setCopiedToken(null), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <PlusCircle className="text-sky-400 h-7 w-7" />
            节点自动接入
          </h1>
          <p className="text-slate-400 text-sm mt-1">自动化节点接入流程，支持批量添加和审批管理</p>
        </div>
        <div className="flex gap-3">
          <Button className="bg-sky-500 hover:bg-sky-600 text-white" onClick={() => setShowTokenDialog(true)}>
            <Key className="h-4 w-4 mr-2" />
            创建令牌
          </Button>
          <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setShowScriptDialog(true)}>
            <FileCode className="h-4 w-4 mr-2" />
            生成脚本
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Clock className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{pendingNodes.filter(n => n.status === "pending").length}</p>
              <p className="text-xs text-slate-400">待审批节点</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">12</p>
              <p className="text-xs text-slate-400">本月已接入</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 rounded-lg">
              <Key className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{joinTokens.filter(t => t.status === "active").length}</p>
              <p className="text-xs text-slate-400">活动令牌</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Server className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">24</p>
              <p className="text-xs text-slate-400">集群总节点</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex gap-6">
          {[
            { id: "pending", label: "待审批节点", icon: Clock },
            { id: "tokens", label: "接入令牌", icon: Key },
            { id: "history", label: "接入历史", icon: Clock },
            { id: "config", label: "自动化配置", icon: Shield },
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
      {activeTab === "pending" && (
        <div className="space-y-4">
          {pendingNodes.filter(n => n.status === "pending").length === 0 ? (
            <div className="glass-card p-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">无待审批节点</h3>
              <p className="text-slate-400">当前没有新的节点接入请求</p>
            </div>
          ) : (
            pendingNodes.filter(n => n.status === "pending").map((node) => (
              <div key={node.id} className="glass-card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-sky-500/10 rounded-xl">
                      <Server className="h-6 w-6 text-sky-400" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-white text-lg">{node.hostname}</h3>
                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">待审批</Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-6 text-sm">
                        <div>
                          <p className="text-slate-500 text-xs">IP 地址</p>
                          <p className="text-white font-mono">{node.ip}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">操作系统</p>
                          <p className="text-white">{node.os}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">CPU/内存</p>
                          <p className="text-white">{node.cpu} / {node.memory}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">容器运行时</p>
                          <p className="text-white font-mono text-xs">{node.containerRuntime}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span><Clock className="h-3 w-3 inline mr-1" />请求时间: {node.requestTime}</span>
                        <span><Globe className="h-3 w-3 inline mr-1" />内核: {node.kernel}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button className="bg-green-500 hover:bg-green-600 text-white">
                      <CheckCircle2 className="h-4 w-4 mr-2" /> 批准接入
                    </Button>
                    <Button variant="outline" className="border-rose-500/50 text-rose-400 hover:bg-rose-500/10">
                      <XCircle className="h-4 w-4 mr-2" /> 拒绝
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "tokens" && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">接入令牌管理</h3>
            <Button size="sm" className="bg-sky-500 hover:bg-sky-600" onClick={() => setShowTokenDialog(true)}>
              <PlusCircle className="h-4 w-4 mr-2" /> 新建令牌
            </Button>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">名称</th>
                <th className="px-6 py-4 font-medium">令牌</th>
                <th className="px-6 py-4 font-medium">使用次数</th>
                <th className="px-6 py-4 font-medium">有效期</th>
                <th className="px-6 py-4 font-medium">状态</th>
                <th className="px-6 py-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {joinTokens.map((token) => (
                <tr key={token.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 font-semibold text-white">{token.name}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <code className="bg-slate-800 px-2 py-1 rounded text-sky-400 text-xs font-mono">
                        {showToken[token.id] ? token.token : "••••••••••••"}
                      </code>
                      <button
                        onClick={() => setShowToken(prev => ({ ...prev, [token.id]: !prev[token.id] }))}
                        className="text-slate-400 hover:text-white"
                      >
                        {showToken[token.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(token.token, token.id.toString())}
                        className="text-slate-400 hover:text-white"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    {token.usedCount} / {token.maxUsage}
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    <div>
                      <p className="text-xs">创建: {token.createdAt}</p>
                      <p className="text-xs">过期: {token.expiresAt}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      className={`${
                        token.status === "active"
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                      }`}
                    >
                      {token.status === "active" ? "有效" : "已过期"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                        <RefreshCw className="h-4 w-4" />
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

      {activeTab === "history" && (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">节点名称</th>
                <th className="px-6 py-4 font-medium">IP 地址</th>
                <th className="px-6 py-4 font-medium">接入时间</th>
                <th className="px-6 py-4 font-medium">耗时</th>
                <th className="px-6 py-4 font-medium">状态</th>
                <th className="px-6 py-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {joinHistory.map((record) => (
                <tr key={record.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-sky-400" />
                      <span className="font-semibold text-white">{record.node}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-400">{record.ip}</td>
                  <td className="px-6 py-4 text-slate-400">{record.time}</td>
                  <td className="px-6 py-4 text-slate-400">{record.duration}</td>
                  <td className="px-6 py-4">
                    <Badge
                      className={`${
                        record.status === "success"
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      }`}
                    >
                      {record.status === "success" ? "成功" : "失败"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Button variant="ghost" size="sm" className="text-sky-400 hover:text-sky-300">
                      查看日志
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "config" && (
        <div className="grid grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-sky-400" />
              自动化配置
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                <div>
                  <p className="text-white font-medium">自动审批模式</p>
                  <p className="text-xs text-slate-500">自动批准符合条件的节点接入请求</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:ring-2 peer-focus:ring-sky-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                </label>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                <div>
                  <p className="text-white font-medium">硬件检测</p>
                  <p className="text-xs text-slate-500">自动检测节点硬件配置并标记</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:ring-2 peer-focus:ring-sky-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                </label>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                <div>
                  <p className="text-white font-medium">GPU 节点识别</p>
                  <p className="text-xs text-slate-500">自动识别并标记 GPU 节点</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:ring-2 peer-focus:ring-sky-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Cpu className="h-5 w-5 text-purple-400" />
              节点标签模板
            </h3>
            <div className="space-y-3">
              {[
                { label: "node-role.kubernetes.io/worker", value: "true", description: "工作节点标签" },
                { label: "node-role.kubernetes.io/gpu", value: "true", description: "GPU 节点标签" },
                { label: "node.kubernetes.io/instance-type", value: "auto-detect", description: "实例类型" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                  <code className="text-xs text-sky-400">{item.label}</code>
                  <span className="text-slate-500">=</span>
                  <code className="text-xs text-purple-400">{item.value}</code>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full border-slate-700 text-slate-300">
                <PlusCircle className="h-4 w-4 mr-2" /> 添加标签模板
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Token Dialog */}
      <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Key className="h-5 w-5 text-sky-400" />
              创建接入令牌
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              生成新的节点接入令牌
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">令牌名称</label>
              <Input placeholder="例如: production-worker-token" className="bg-slate-800 border-slate-700" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">有效期</label>
                <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                  <option>24 小时</option>
                  <option>7 天</option>
                  <option>30 天</option>
                  <option>永不过期</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">最大使用次数</label>
                <Input type="number" placeholder="10" className="bg-slate-800 border-slate-700" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">关联节点角色</label>
              <div className="flex flex-wrap gap-2">
                {["worker", "master", "gpu", "edge"].map((role) => (
                  <Badge
                    key={role}
                    className="cursor-pointer bg-slate-800 text-slate-400 hover:bg-sky-500/20 hover:text-sky-400"
                  >
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTokenDialog(false)} className="border-slate-700 text-slate-300">
              取消
            </Button>
            <Button className="bg-sky-500 hover:bg-sky-600" onClick={() => setShowTokenDialog(false)}>
              生成令牌
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Script Dialog */}
      <Dialog open={showScriptDialog} onOpenChange={setShowScriptDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileCode className="h-5 w-5 text-sky-400" />
              节点接入脚本
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              在新节点上执行此脚本自动加入集群
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2 border-slate-700 text-slate-300"
              onClick={() => copyToClipboard(joinScript)}
            >
              <Copy className="h-4 w-4 mr-2" /> 复制
            </Button>
            <pre className="bg-slate-800 rounded-lg p-4 text-xs font-mono text-slate-300 overflow-auto max-h-96">
              {joinScript}
            </pre>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <Button variant="outline" className="border-slate-700 text-slate-300">
                <Download className="h-4 w-4 mr-2" /> 下载脚本
              </Button>
              <Button variant="outline" className="border-slate-700 text-slate-300">
                <Terminal className="h-4 w-4 mr-2" /> 一键执行
              </Button>
            </div>
            <Button className="bg-sky-500 hover:bg-sky-600" onClick={() => setShowScriptDialog(false)}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
