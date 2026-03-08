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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Database,
  Server,
  Activity,
  Gauge,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Settings,
  ExternalLink,
  Zap,
} from "lucide-react";
import { MIDDLEWARE_TEMPLATES, useQuickDeploy, useReleases } from "@/hooks/use-helm";
import { useNamespaces } from "@/hooks/use-k8s";
import { useToast } from "@/hooks/use-toast";

// 分类配置
const CATEGORY_CONFIG = {
  database: { label: "数据库", icon: Database, color: "text-sky-400", bg: "bg-sky-500/10" },
  cache: { label: "缓存", icon: Gauge, color: "text-amber-400", bg: "bg-amber-500/10" },
  queue: { label: "消息队列", icon: Server, color: "text-purple-400", bg: "bg-purple-500/10" },
  monitoring: { label: "监控", icon: Activity, color: "text-green-400", bg: "bg-green-500/10" },
  ingress: { label: "网关", icon: Zap, color: "text-pink-400", bg: "bg-pink-500/10" },
};

export default function QuickDeployPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<typeof MIDDLEWARE_TEMPLATES[0] | null>(null);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [deployName, setDeployName] = useState("");
  const [deployNamespace, setDeployNamespace] = useState("default");
  const [deployValues, setDeployValues] = useState("");

  const { data: namespaces } = useNamespaces();
  const { data: releases } = useReleases();
  const quickDeploy = useQuickDeploy();
  const { toast } = useToast();

  // 过滤模板
  const filteredTemplates = MIDDLEWARE_TEMPLATES.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = selectedCategory === "all" || t.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  // 检查是否已安装
  const isInstalled = (template: typeof MIDDLEWARE_TEMPLATES[0]) => {
    return releases?.some((r) =>
      r.chart.toLowerCase().includes(template.name.toLowerCase()) ||
      r.name.toLowerCase() === template.name.toLowerCase()
    );
  };

  // 打开部署对话框
  const handleDeploy = (template: typeof MIDDLEWARE_TEMPLATES[0]) => {
    setSelectedTemplate(template);
    setDeployName(template.name.toLowerCase());
    setDeployNamespace("default");
    setDeployValues(JSON.stringify(template.defaultValues, null, 2));
    setShowDeployDialog(true);
  };

  // 执行部署
  const executeDeploy = async () => {
    if (!selectedTemplate) return;

    try {
      const values = deployValues ? JSON.parse(deployValues) : undefined;
      await quickDeploy.quickDeploy(selectedTemplate, {
        name: deployName,
        namespace: deployNamespace,
        values,
      });

      toast({
        title: "部署成功",
        description: `${selectedTemplate.name} 已成功部署到 ${deployNamespace} 命名空间`,
      });

      setShowDeployDialog(false);
    } catch (error) {
      toast({
        title: "部署失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Zap className="text-sky-400 h-7 w-7" />
            一键部署中间件
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            快速部署数据库、缓存、消息队列、监控系统等中间件
          </p>
        </div>
      </div>

      {/* 搜索和过滤 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="搜索中间件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-700"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("all")}
            className={selectedCategory === "all" ? "bg-sky-500" : "border-slate-700 text-slate-400"}
          >
            全部
          </Button>
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
            <Button
              key={key}
              variant={selectedCategory === key ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(key)}
              className={selectedCategory === key ? "bg-sky-500" : "border-slate-700 text-slate-400"}
            >
              <config.icon className="h-3 w-3 mr-1" />
              {config.label}
            </Button>
          ))}
        </div>
      </div>

      {/* 中间件卡片网格 */}
      <div className="grid grid-cols-4 gap-4">
        {filteredTemplates.map((template) => {
          const config = CATEGORY_CONFIG[template.category];
          const installed = isInstalled(template);

          return (
            <div
              key={template.name}
              className="glass-card p-5 hover:border-sky-500/50 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{template.icon}</div>
                  <div>
                    <h3 className="font-semibold text-white">{template.name}</h3>
                    <Badge className={`${config.bg} ${config.color} border-0 text-[10px]`}>
                      {config.label}
                    </Badge>
                  </div>
                </div>
                {installed && (
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                )}
              </div>

              <p className="text-xs text-slate-400 mb-4 line-clamp-2">
                {template.description}
              </p>

              <div className="text-[10px] text-slate-500 mb-3 font-mono">
                {template.chart}
              </div>

              <Button
                size="sm"
                className={`w-full ${
                  installed
                    ? "bg-slate-700 text-slate-400 hover:bg-slate-600"
                    : "bg-sky-500 hover:bg-sky-600 text-white"
                }`}
                onClick={() => handleDeploy(template)}
                disabled={quickDeploy.isPending}
              >
                {quickDeploy.isPending && selectedTemplate?.name === template.name ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    部署中...
                  </>
                ) : installed ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    已安装
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

      {/* 已部署服务 */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-lg font-semibold text-white">已部署服务</h3>
          <p className="text-xs text-slate-400">当前集群中已部署的中间件</p>
        </div>
        <div className="divide-y divide-slate-800">
          {releases && releases.length > 0 ? (
            releases.map((release) => (
              <div key={`${release.namespace}-${release.name}`} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-500/10 rounded-lg">
                    <Database className="h-5 w-5 text-sky-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{release.name}</span>
                      <Badge className="bg-slate-700 text-slate-300">{release.namespace}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 font-mono">{release.chart}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge
                    className={
                      release.status === "deployed"
                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                        : release.status === "failed"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }
                  >
                    {release.status === "deployed" ? "运行中" : release.status === "failed" ? "失败" : "更新中"}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-500">
              <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>暂无已部署的中间件</p>
              <p className="text-xs mt-1">点击上方卡片开始部署</p>
            </div>
          )}
        </div>
      </div>

      {/* 部署配置对话框 */}
      <Dialog open={showDeployDialog} onOpenChange={setShowDeployDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {selectedTemplate && (
                <>
                  <span className="text-2xl">{selectedTemplate.icon}</span>
                  部署 {selectedTemplate.name}
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
                    <SelectItem value="__new__">+ 新建命名空间</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                配置参数 (YAML)
              </label>
              <textarea
                value={deployValues}
                onChange={(e) => setDeployValues(e.target.value)}
                className="w-full h-48 bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-300 resize-none focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="# Helm Values 配置..."
              />
            </div>

            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <p className="text-xs text-amber-400">
                请确保已添加对应的 Helm 仓库，如 bitnami、prometheus-community 等
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeployDialog(false)}
              className="border-slate-700 text-slate-300"
            >
              取消
            </Button>
            <Button
              className="bg-sky-500 hover:bg-sky-600"
              onClick={executeDeploy}
              disabled={quickDeploy.isPending || !deployName || !deployNamespace}
            >
              {quickDeploy.isPending ? (
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
