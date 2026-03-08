"use client";

import { useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Search,
  Plus,
  MoreVertical,
  RefreshCw,
  Trash2,
  Download,
  Upload,
  Settings,
  CheckCircle2,
  AlertCircle,
  Play,
  Server,
  Globe,
  Star,
  TrendingUp,
  Box,
  Zap,
  Loader2,
  Database,
  Gauge,
  Activity,
} from "lucide-react";
import { MIDDLEWARE_TEMPLATES } from "@/hooks/use-helm";
import { useNamespaces, usePods, useDeployments } from "@/hooks/use-k8s";
import { useToast } from "@/hooks/use-toast";

// 分类配置
const CATEGORY_CONFIG = {
  database: { label: "数据库", icon: Database, color: "text-sky-400", bg: "bg-sky-500/10" },
  cache: { label: "缓存", icon: Gauge, color: "text-amber-400", bg: "bg-amber-500/10" },
  queue: { label: "消息队列", icon: Server, color: "text-purple-400", bg: "bg-purple-500/10" },
  monitoring: { label: "监控", icon: Activity, color: "text-green-400", bg: "bg-green-500/10" },
  ingress: { label: "网关", icon: Zap, color: "text-pink-400", bg: "bg-pink-500/10" },
};

// 模拟 Helm 仓库数据
const helmRepos = [
  { name: "Bitnami", url: "https://charts.bitnami.com/bitnami", status: "healthy", charts: 180, lastUpdate: "1 小时前" },
  { name: "Prometheus", url: "https://prometheus-community.github.io/helm-charts", status: "healthy", charts: 50, lastUpdate: "2 小时前" },
  { name: "阿里云", url: "https://apphub.aliyuncs.com", status: "healthy", charts: 156, lastUpdate: "6 小时前" },
];

// 模拟 Chart 市场
const chartMarket = [
  { id: 1, name: "nginx", description: "高性能 Web 服务器", version: "15.0.0", appVersion: "1.25.3", repo: "Bitnami", icon: "🚀", downloads: "50M+", stars: 4.8 },
  { id: 2, name: "redis", description: "高性能内存数据库", version: "18.0.0", appVersion: "7.2.3", repo: "Bitnami", icon: "🔴", downloads: "40M+", stars: 4.7 },
  { id: 3, name: "mysql", description: "关系型数据库", version: "9.0.0", appVersion: "8.0.35", repo: "Bitnami", icon: "🗄️", downloads: "35M+", stars: 4.6 },
  { id: 4, name: "prometheus", description: "监控告警系统", version: "15.0.0", appVersion: "2.45.0", repo: "Prometheus", icon: "📊", downloads: "25M+", stars: 4.9 },
  { id: 5, name: "grafana", description: "可视化监控面板", version: "7.0.0", appVersion: "10.2.0", repo: "Bitnami", icon: "📈", downloads: "30M+", stars: 4.8 },
  { id: 6, name: "kafka", description: "分布式消息队列", version: "22.0.0", appVersion: "3.6.0", repo: "Bitnami", icon: "📨", downloads: "15M+", stars: 4.7 },
];

export default function HelmPage() {
  const [activeTab, setActiveTab] = useState("quick-deploy");
  const [searchQuery, setSearchQuery] = useState("");
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<typeof MIDDLEWARE_TEMPLATES[0] | null>(null);
  const [deployName, setDeployName] = useState("");
  const [deployNamespace, setDeployNamespace] = useState("default");
  const [deployValues, setDeployValues] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);

  const { data: namespaces } = useNamespaces();
  const { data: pods } = usePods();
  const { data: deployments } = useDeployments();
  const { toast } = useToast();

  // 过滤 Chart
  const filteredCharts = chartMarket.filter(
    (chart) =>
      chart.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chart.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 检查中间件是否已部署
  const isDeployed = (name: string) => {
    return pods?.some((p) => p.name.toLowerCase().includes(name.toLowerCase())) ||
           deployments?.some((d) => d.name.toLowerCase().includes(name.toLowerCase()));
  };

  // 打开部署对话框
  const handleQuickDeploy = (template: typeof MIDDLEWARE_TEMPLATES[0]) => {
    setSelectedTemplate(template);
    setDeployName(template.name.toLowerCase());
    setDeployNamespace("default");
    setDeployValues(JSON.stringify(template.defaultValues, null, 2));
    setShowInstallDialog(true);
  };

  // 执行部署
  const executeDeploy = async () => {
    if (!selectedTemplate) return;

    setIsDeploying(true);
    try {
      // 模拟部署过程
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast({
        title: "部署成功",
        description: `${selectedTemplate.name} 已提交部署请求到 ${deployNamespace} 命名空间`,
      });

      setShowInstallDialog(false);
    } catch (error) {
      toast({
        title: "部署失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Package className="text-sky-400 h-7 w-7" />
            Helm 应用商店
          </h1>
          <p className="text-slate-400 text-sm mt-1">管理 Helm Charts 和一键部署中间件</p>
        </div>
        <div className="flex gap-3">
          <Button className="bg-sky-500 hover:bg-sky-600 text-white">
            <Plus className="h-4 w-4 mr-2" />
            添加仓库
          </Button>
          <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
            <Upload className="h-4 w-4 mr-2" />
            上传 Chart
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 rounded-lg">
              <Package className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{helmRepos.reduce((a, r) => a + r.charts, 0)}</p>
              <p className="text-xs text-slate-400">可用 Charts</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{deployments?.length || 0}</p>
              <p className="text-xs text-slate-400">已部署应用</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Server className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{helmRepos.length}</p>
              <p className="text-xs text-slate-400">仓库数量</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Zap className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{MIDDLEWARE_TEMPLATES.length}</p>
              <p className="text-xs text-slate-400">快速部署模板</p>
            </div>
          </div>
        </div>
      </div>

      {/* 标签页 */}
      <div className="border-b border-slate-800">
        <div className="flex gap-6">
          {[
            { id: "quick-deploy", label: "一键部署", icon: Zap },
            { id: "marketplace", label: "应用市场", icon: Globe },
            { id: "installed", label: "已安装", icon: Box },
            { id: "repositories", label: "仓库管理", icon: Server },
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

      {/* 一键部署 */}
      {activeTab === "quick-deploy" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">快速部署中间件</h3>
            <div className="flex gap-2">
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                <Badge key={key} className={`${config.bg} ${config.color} border-0`}>
                  {config.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-5 gap-4">
            {MIDDLEWARE_TEMPLATES.map((template) => {
              const config = CATEGORY_CONFIG[template.category];
              const deployed = isDeployed(template.name);

              return (
                <div key={template.name} className="glass-card p-4 hover:border-sky-500/50 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{template.icon}</span>
                    <div>
                      <h4 className="font-semibold text-white text-sm">{template.name}</h4>
                      <Badge className={`${config.bg} ${config.color} border-0 text-[10px]`}>
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-3 line-clamp-2">{template.description}</p>
                  <Button
                    size="sm"
                    className={`w-full ${
                      deployed
                        ? "bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20"
                        : "bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20"
                    }`}
                    onClick={() => handleQuickDeploy(template)}
                    disabled={isDeploying}
                  >
                    {deployed ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        已部署
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 mr-1" />
                        一键部署
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 应用市场 */}
      {activeTab === "marketplace" && (
        <div className="space-y-4">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="搜索 Helm Charts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-900 border-slate-700"
            />
          </div>

          <div className="grid grid-cols-4 gap-4">
            {filteredCharts.map((chart) => (
              <div key={chart.id} className="glass-card p-4 hover:border-sky-500/50 transition-all">
                <div className="flex items-start gap-3 mb-3">
                  <div className="text-3xl">{chart.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-white truncate">{chart.name}</h3>
                      <Badge className="bg-sky-500/10 text-sky-400 border-sky-500/20 text-[10px]">
                        {chart.repo}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">v{chart.appVersion}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 mb-3">{chart.description}</p>
                <div className="flex items-center justify-between text-xs mb-3">
                  <span className="text-slate-500">
                    <Download className="h-3 w-3 inline mr-1" />
                    {chart.downloads}
                  </span>
                  <span className="text-amber-400">
                    <Star className="h-3 w-3 inline mr-1" />
                    {chart.stars}
                  </span>
                </div>
                <Button
                  size="sm"
                  className="w-full bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20"
                >
                  <Play className="h-3 w-3 mr-1" /> 安装
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 已安装 */}
      {activeTab === "installed" && (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">应用名称</th>
                <th className="px-6 py-4 font-medium">Chart</th>
                <th className="px-6 py-4 font-medium">命名空间</th>
                <th className="px-6 py-4 font-medium">状态</th>
                <th className="px-6 py-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {deployments?.map((deploy) => (
                <tr key={deploy.name} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-semibold text-white">{deploy.name}</span>
                  </td>
                  <td className="px-6 py-4 font-mono text-sky-400 text-xs">{deploy.namespace}</td>
                  <td className="px-6 py-4">
                    <Badge className="bg-slate-700 text-slate-300">{deploy.namespace}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                      {deploy.readyReplicas}/{deploy.replicas} Ready
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                        <TrendingUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-400 hover:text-rose-300">
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

      {/* 仓库管理 */}
      {activeTab === "repositories" && (
        <div className="grid grid-cols-2 gap-4">
          {helmRepos.map((repo) => (
            <div key={repo.name} className="glass-card p-5 hover:border-sky-500/50 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-500/10 rounded-lg">
                    <Package className="h-5 w-5 text-sky-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{repo.name}</h3>
                    <p className="text-xs text-slate-500 font-mono truncate max-w-[200px]">{repo.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500/10 text-green-400 border-green-500/20">正常</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                      <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800">
                        <RefreshCw className="h-4 w-4 mr-2" /> 更新索引
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800">
                        <Settings className="h-4 w-4 mr-2" /> 编辑配置
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-rose-400 focus:bg-slate-800">
                        <Trash2 className="h-4 w-4 mr-2" /> 删除仓库
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Chart 数量</p>
                  <p className="text-white font-semibold">{repo.charts}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">最后更新</p>
                  <p className="text-white font-semibold">{repo.lastUpdate}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 部署对话框 */}
      <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {selectedTemplate && (
                <>
                  <span className="text-2xl">{selectedTemplate.icon}</span>
                  一键部署 {selectedTemplate.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedTemplate?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">应用名称</label>
                <Input
                  value={deployName}
                  onChange={(e) => setDeployName(e.target.value)}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">命名空间</label>
                <Select value={deployNamespace} onValueChange={setDeployNamespace}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="default">default</SelectItem>
                    {namespaces?.map((ns) => (
                      <SelectItem key={ns.name} value={ns.name}>
                        {ns.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">配置参数 (YAML)</label>
              <textarea
                value={deployValues}
                onChange={(e) => setDeployValues(e.target.value)}
                className="w-full h-48 bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-300 resize-none focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <p className="text-xs text-amber-400">
                部署前请确保已添加对应的 Helm 仓库: helm repo add bitnami https://charts.bitnami.com/bitnami
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInstallDialog(false)} className="border-slate-700 text-slate-300">
              取消
            </Button>
            <Button className="bg-sky-500 hover:bg-sky-600" onClick={executeDeploy} disabled={isDeploying}>
              {isDeploying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  部署中...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  开始部署
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
