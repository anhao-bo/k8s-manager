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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Image,
  Plus,
  Search,
  MoreVertical,
  RefreshCw,
  Trash2,
  Edit,
  Eye,
  Download,
  Upload,
  Server,
  Clock,
  CheckCircle2,
  AlertCircle,
  Shield,
  Globe,
  Lock,
  ExternalLink,
  Layers,
} from "lucide-react";

// Mock data for registries
const registries = [
  {
    id: 1,
    name: "Docker Hub",
    url: "https://registry.hub.docker.com",
    type: "public",
    status: "healthy",
    imageCount: 128,
    lastSync: "5 分钟前",
    authType: "username",
  },
  {
    id: 2,
    name: "阿里云镜像仓库",
    url: "https://registry.cn-beijing.aliyuncs.com",
    type: "private",
    status: "healthy",
    imageCount: 45,
    lastSync: "12 分钟前",
    authType: "username",
  },
  {
    id: 3,
    name: "Harbor 企业仓库",
    url: "https://harbor.company.com",
    type: "private",
    status: "healthy",
    imageCount: 256,
    lastSync: "2 小时前",
    authType: "token",
  },
  {
    id: 4,
    name: "腾讯云 TCR",
    url: "https://ccr.ccs.tencentyun.com",
    type: "private",
    status: "warning",
    imageCount: 89,
    lastSync: "1 天前",
    authType: "username",
  },
];

// Mock data for images
const images = [
  {
    id: 1,
    name: "nginx",
    tag: "1.25.3-alpine",
    registry: "Docker Hub",
    size: "25.6 MB",
    created: "2024-01-15",
    vulnerabilities: 0,
    status: "ready",
  },
  {
    id: 2,
    name: "redis",
    tag: "7.2.3",
    registry: "阿里云镜像仓库",
    size: "45.2 MB",
    created: "2024-01-14",
    vulnerabilities: 2,
    status: "ready",
  },
  {
    id: 3,
    name: "mysql",
    tag: "8.0.35",
    registry: "Harbor 企业仓库",
    size: "156.8 MB",
    created: "2024-01-13",
    vulnerabilities: 5,
    status: "ready",
  },
  {
    id: 4,
    name: "payment-api",
    tag: "v2.3.1",
    registry: "Harbor 企业仓库",
    size: "89.3 MB",
    created: "2024-01-15",
    vulnerabilities: 0,
    status: "ready",
  },
  {
    id: 5,
    name: "gateway-service",
    tag: "latest",
    registry: "阿里云镜像仓库",
    size: "112.5 MB",
    created: "2024-01-15",
    vulnerabilities: 3,
    status: "syncing",
  },
  {
    id: 6,
    name: "user-center",
    tag: "v1.8.0",
    registry: "Harbor 企业仓库",
    size: "78.2 MB",
    created: "2024-01-12",
    vulnerabilities: 1,
    status: "ready",
  },
];

// Mock data for sync tasks
const syncTasks = [
  { id: 1, source: "Docker Hub", target: "Harbor 企业仓库", image: "nginx:1.25.3-alpine", status: "completed", progress: 100 },
  { id: 2, source: "Docker Hub", target: "阿里云镜像仓库", image: "redis:7.2.3", status: "completed", progress: 100 },
  { id: 3, source: "Docker Hub", target: "Harbor 企业仓库", image: "gateway-service:latest", status: "syncing", progress: 67 },
];

export default function ImageRegistryPage() {
  const [activeTab, setActiveTab] = useState("registries");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddRegistry, setShowAddRegistry] = useState(false);

  const filteredImages = images.filter(
    (img) =>
      img.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      img.tag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Image className="text-sky-400 h-7 w-7" />
            镜像仓库管理
          </h1>
          <p className="text-slate-400 text-sm mt-1">管理容器镜像仓库、镜像同步和安全扫描</p>
        </div>
        <div className="flex gap-3">
          <Button className="bg-sky-500 hover:bg-sky-600 text-white" onClick={() => setShowAddRegistry(true)}>
            <Plus className="h-4 w-4 mr-2" />
            添加仓库
          </Button>
          <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
            <RefreshCw className="h-4 w-4 mr-2" />
            同步全部
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 rounded-lg">
              <Server className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{registries.length}</p>
              <p className="text-xs text-slate-400">镜像仓库</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Layers className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{images.length}</p>
              <p className="text-xs text-slate-400">镜像总数</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">11</p>
              <p className="text-xs text-slate-400">安全漏洞</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">1</p>
              <p className="text-xs text-slate-400">同步任务</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex gap-6">
          {[
            { id: "registries", label: "仓库列表", icon: Server },
            { id: "images", label: "镜像管理", icon: Image },
            { id: "sync", label: "同步任务", icon: RefreshCw },
            { id: "security", label: "安全扫描", icon: Shield },
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
      {activeTab === "registries" && (
        <div className="grid grid-cols-2 gap-4">
          {registries.map((registry) => (
            <div key={registry.id} className="glass-card p-5 hover:border-sky-500/50 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${registry.type === "public" ? "bg-sky-500/10" : "bg-purple-500/10"}`}>
                    {registry.type === "public" ? (
                      <Globe className="h-5 w-5 text-sky-400" />
                    ) : (
                      <Lock className="h-5 w-5 text-purple-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{registry.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">{registry.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    className={`${
                      registry.status === "healthy"
                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }`}
                  >
                    {registry.status === "healthy" ? "正常" : "警告"}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                      <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800">
                        <Edit className="h-4 w-4 mr-2" /> 编辑配置
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800">
                        <RefreshCw className="h-4 w-4 mr-2" /> 立即同步
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800">
                        <Eye className="h-4 w-4 mr-2" /> 查看镜像
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-rose-400 focus:bg-slate-800">
                        <Trash2 className="h-4 w-4 mr-2" /> 删除仓库
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">镜像数量</p>
                  <p className="text-white font-semibold">{registry.imageCount}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">认证方式</p>
                  <p className="text-white font-semibold">{registry.authType === "username" ? "用户名密码" : "Token"}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">最后同步</p>
                  <p className="text-white font-semibold">{registry.lastSync}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "images" && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="搜索镜像名称或标签..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-900 border-slate-700 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="border-slate-700 text-slate-300">
                <Upload className="h-4 w-4 mr-2" /> 推送镜像
              </Button>
              <Button variant="outline" size="sm" className="border-slate-700 text-slate-300">
                <Download className="h-4 w-4 mr-2" /> 拉取镜像
              </Button>
            </div>
          </div>

          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">镜像名称</th>
                <th className="px-6 py-4 font-medium">标签</th>
                <th className="px-6 py-4 font-medium">仓库</th>
                <th className="px-6 py-4 font-medium">大小</th>
                <th className="px-6 py-4 font-medium">创建时间</th>
                <th className="px-6 py-4 font-medium">漏洞</th>
                <th className="px-6 py-4 font-medium">状态</th>
                <th className="px-6 py-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredImages.map((image) => (
                <tr key={image.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4 text-sky-400" />
                      <span className="font-mono text-sky-400">{image.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">{image.tag}</Badge>
                  </td>
                  <td className="px-6 py-4 text-slate-400">{image.registry}</td>
                  <td className="px-6 py-4 text-slate-400">{image.size}</td>
                  <td className="px-6 py-4 text-slate-400">{image.created}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 text-xs font-bold rounded ${
                        image.vulnerabilities === 0
                          ? "bg-green-500/10 text-green-400"
                          : image.vulnerabilities < 3
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-rose-500/10 text-rose-400"
                      }`}
                    >
                      {image.vulnerabilities}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      className={`${
                        image.status === "ready"
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}
                    >
                      {image.status === "ready" ? "就绪" : "同步中"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                        <Download className="h-4 w-4" />
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

      {activeTab === "sync" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">同步任务队列</h3>
            <Button size="sm" className="bg-sky-500 hover:bg-sky-600">
              <Plus className="h-4 w-4 mr-2" /> 新建同步任务
            </Button>
          </div>

          {syncTasks.map((task) => (
            <div key={task.id} className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      task.status === "completed" ? "bg-green-500/10" : "bg-amber-500/10"
                    }`}
                  >
                    <RefreshCw
                      className={`h-5 w-5 ${
                        task.status === "completed" ? "text-green-400" : "text-amber-400 animate-spin"
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sky-400">{task.image}</span>
                      <ExternalLink className="h-3 w-3 text-slate-500" />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {task.source} → {task.target}
                    </p>
                  </div>
                </div>
                <Badge
                  className={`${
                    task.status === "completed"
                      ? "bg-green-500/10 text-green-400 border-green-500/20"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  }`}
                >
                  {task.status === "completed" ? "已完成" : "同步中"}
                </Badge>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    task.status === "completed" ? "bg-green-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${task.progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2 text-right">{task.progress}%</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === "security" && (
        <div className="glass-card p-6">
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sky-500/10 mb-4">
              <Shield className="h-8 w-8 text-sky-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">镜像安全扫描</h3>
            <p className="text-slate-400 max-w-md mx-auto mb-6">
              使用 Trivy 或 Clair 对镜像进行漏洞扫描，检测已知安全漏洞并提供修复建议
            </p>
            <div className="flex justify-center gap-3">
              <Button className="bg-sky-500 hover:bg-sky-600">
                <Shield className="h-4 w-4 mr-2" /> 开始扫描
              </Button>
              <Button variant="outline" className="border-slate-700 text-slate-300">
                查看报告
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Registry Dialog */}
      <Dialog open={showAddRegistry} onOpenChange={setShowAddRegistry}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">添加镜像仓库</DialogTitle>
            <DialogDescription className="text-slate-400">
              配置新的容器镜像仓库连接
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">仓库名称</label>
              <Input placeholder="例如: Harbor 企业仓库" className="bg-slate-800 border-slate-700" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">仓库地址</label>
              <Input placeholder="https://registry.example.com" className="bg-slate-800 border-slate-700" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">认证方式</label>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="border-sky-500 text-sky-400 bg-sky-500/10">
                  用户名密码
                </Button>
                <Button variant="outline" className="border-slate-700 text-slate-400">
                  Token
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">用户名</label>
                <Input placeholder="输入用户名" className="bg-slate-800 border-slate-700" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">密码</label>
                <Input type="password" placeholder="输入密码" className="bg-slate-800 border-slate-700" />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="verify-ssl" className="rounded border-slate-700" />
              <label htmlFor="verify-ssl" className="text-sm text-slate-400">
                验证 SSL 证书
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRegistry(false)} className="border-slate-700 text-slate-300">
              取消
            </Button>
            <Button className="bg-sky-500 hover:bg-sky-600" onClick={() => setShowAddRegistry(false)}>
              添加仓库
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
