"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Container,
  Network,
  Database,
  Server,
  Layers,
  FileText,
  Settings,
  Bell,
  Search,
  ChevronDown,
  Terminal,
  Shield,
  HardDrive,
  Cpu,
  HelpCircle,
  Zap,
  Menu,
  X,
  Boxes,
  RotateCcw,
  Play,
  Globe,
  Key,
  Users,
  Package,
  Image,
  Gauge,
  Scale,
  PlusCircle,
  Activity,
  Monitor,
  Copy,
} from "lucide-react";
import DashboardPage from "@/components/pages/DashboardPage";
import ClustersPage from "@/components/pages/ClustersPage";
import NodesPage from "@/components/pages/NodesPage";
import WorkloadsPage from "@/components/pages/WorkloadsPage";
import DeploymentsPage from "@/components/pages/DeploymentsPage";
import StatefulSetsPage from "@/components/pages/StatefulSetsPage";
import DaemonSetsPage from "@/components/pages/DaemonSetsPage";
import ServicesPage from "@/components/pages/ServicesPage";
import StoragePage from "@/components/pages/StoragePage";
import PVPage from "@/components/pages/PVPage";
import NamespacesPage from "@/components/pages/NamespacesPage";
import EventsPage from "@/components/pages/EventsPage";
import RBACPage from "@/components/pages/RBACPage";
import StorageClassPage from "@/components/pages/StorageClassPage";
import ImageRegistryPage from "@/components/pages/ImageRegistryPage";
import HelmPage from "@/components/pages/HelmPage";
import NodeAutoJoinPage from "@/components/pages/NodeAutoJoinPage";
import LoadBalancerPage from "@/components/pages/LoadBalancerPage";
import MonitorAlertPage from "@/components/pages/MonitorAlertPage";
import VisualizationDashboardPage from "@/components/pages/VisualizationDashboardPage";
import SettingsPage from "@/components/pages/SettingsPage";
import APMMonitorPage from "@/components/pages/APMMonitorPage";
import IngressPage from "@/components/pages/IngressPage";
import JobsPage from "@/components/pages/JobsPage";
import CronJobsPage from "@/components/pages/CronJobsPage";
import HPAPage from "@/components/pages/HPAPage";
import ReplicaSetsPage from "@/components/pages/ReplicaSetsPage";
import { Clock } from "lucide-react";
import { useNamespaces } from "@/hooks/use-k8s";

const menuItems = [
  // 核心
  { title: "仪表板概览", icon: LayoutDashboard, page: "dashboard", group: "核心" },
  { title: "可视化大屏", icon: Monitor, page: "visualization", group: "核心" },
  { title: "集群管理", icon: Server, page: "clusters", group: "核心" },
  { title: "节点管理", icon: Cpu, page: "nodes", group: "核心" },
  // 工作负载
  { title: "Pod 容器组", icon: Container, page: "workloads", group: "工作负载" },
  { title: "Deployments", icon: Boxes, page: "deployments", group: "工作负载" },
  { title: "StatefulSets", icon: Database, page: "statefulsets", group: "工作负载" },
  { title: "DaemonSets", icon: RotateCcw, page: "daemonsets", group: "工作负载" },
  { title: "Jobs", icon: Play, page: "jobs", group: "工作负载" },
  { title: "CronJobs", icon: Clock, page: "cronjobs", group: "工作负载" },
  { title: "ReplicaSets", icon: Copy, page: "replicasets", group: "工作负载" },
  { title: "HPA 自动扩缩", icon: Gauge, page: "hpa", group: "工作负载" },
  // 网络
  { title: "服务与路由", icon: Network, page: "services", group: "网络" },
  { title: "Ingress", icon: Globe, page: "ingress", group: "网络" },
  { title: "负载均衡器", icon: Scale, page: "loadbalancer", group: "网络" },
  // 配置与存储
  { title: "ConfigMaps", icon: Database, page: "configmaps", group: "配置与存储" },
  { title: "Secrets", icon: Key, page: "secrets", group: "配置与存储" },
  { title: "PVC", icon: HardDrive, page: "pvc", group: "配置与存储" },
  { title: "PV 持久卷", icon: HardDrive, page: "pv", group: "配置与存储" },
  { title: "存储类", icon: Database, page: "storageclass", group: "配置与存储" },
  // 应用市场
  { title: "Helm 应用商店", icon: Package, page: "helm", group: "应用市场" },
  { title: "镜像仓库管理", icon: Image, page: "registry", group: "应用市场" },
  // 自动化运维
  { title: "节点自动接入", icon: PlusCircle, page: "nodeautojoin", group: "自动化运维" },
  { title: "APM 性能监控", icon: Activity, page: "apm", group: "自动化运维" },
  { title: "监控告警", icon: Gauge, page: "monitor", group: "自动化运维" },
  // 集群资源
  { title: "命名空间", icon: Layers, page: "namespaces", group: "集群资源" },
  { title: "事件日志", icon: FileText, page: "events", group: "集群资源" },
  // 系统设置
  { title: "RBAC", icon: Shield, page: "rbac", group: "系统设置" },
  { title: "设置", icon: Settings, page: "settings", group: "系统设置" },
];

export default function K8sManager() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [currentNamespace, setCurrentNamespace] = useState("default");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Fetch namespaces from API
  const { data: namespacesData } = useNamespaces();
  const namespaces = namespacesData && Array.isArray(namespacesData) 
    ? namespacesData.map(ns => ns.name)
    : ["default"];

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage onNavigate={setCurrentPage} />;
      case "clusters":
        return <ClustersPage />;
      case "nodes":
        return <NodesPage />;
      case "workloads":
        return <WorkloadsPage namespace={currentNamespace} />;
      case "deployments":
        return <DeploymentsPage namespace={currentNamespace} />;
      case "statefulsets":
        return <StatefulSetsPage namespace={currentNamespace} />;
      case "daemonsets":
        return <DaemonSetsPage namespace={currentNamespace} />;
      case "services":
        return <ServicesPage namespace={currentNamespace} />;
      case "configmaps":
        return <StoragePage key="configmaps" namespace={currentNamespace} initialTab="configmaps" />;
      case "secrets":
        return <StoragePage key="secrets" namespace={currentNamespace} initialTab="secrets" />;
      case "pvc":
        return <StoragePage key="pvc" namespace={currentNamespace} initialTab="pvc" />;
      case "pv":
        return <PVPage />;
      case "storageclass":
        return <StorageClassPage />;
      case "namespaces":
        return <NamespacesPage />;
      case "events":
        return <EventsPage namespace={currentNamespace} />;
      case "rbac":
        return <RBACPage />;
      case "registry":
        return <ImageRegistryPage />;
      case "helm":
        return <HelmPage />;
      case "nodeautojoin":
        return <NodeAutoJoinPage />;
      case "loadbalancer":
        return <LoadBalancerPage />;
      case "monitor":
        return <MonitorAlertPage />;
      case "apm":
        return <APMMonitorPage />;
      case "visualization":
        return <VisualizationDashboardPage />;
      case "settings":
        return <SettingsPage />;
      case "ingress":
        return <IngressPage />;
      case "jobs":
        return <JobsPage />;
      case "cronjobs":
        return <CronJobsPage namespace={currentNamespace} />;
      case "replicasets":
        return <ReplicaSetsPage namespace={currentNamespace} />;
      case "hpa":
        return <HPAPage namespace={currentNamespace} />;
      default:
        return <DashboardPage />;
    }
  };

  const groupedMenuItems = menuItems.reduce((acc, item) => {
    if (!acc[item.group]) {
      acc[item.group] = [];
    }
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, typeof menuItems>);

  return (
    <div className="flex h-screen bg-[#020617]">
      {/* 侧边导航栏 */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } h-full border-r border-slate-800 flex flex-col shrink-0 bg-[#0F172A] z-50 transition-all duration-300 overflow-hidden`}
      >
        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center neon-shadow-blue">
            <Terminal className="text-white text-xl" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight text-white">KubeNext</h1>
            <p className="text-[10px] text-sky-400 font-mono tracking-wider">GEN-AI 2026</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
          {Object.entries(groupedMenuItems).map(([group, items]) => (
            <div key={group}>
              <p className="px-2 pt-3 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {group}
              </p>
              {items.map((item) => (
                <button
                  key={item.page}
                  onClick={() => setCurrentPage(item.page)}
                  className={`${
                    currentPage === item.page
                      ? "sidebar-item-active"
                      : "text-slate-400 hover:text-sky-400 hover:bg-slate-800/50"
                  } w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm group`}
                >
                  <item.icon className="text-lg" />
                  <span>{item.title}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-slate-800">
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="relative">
              <Avatar className="w-10 h-10 border-2 border-sky-500">
                <AvatarImage src="/avatar.png" />
                <AvatarFallback className="bg-sky-500 text-slate-900 text-xs font-bold">
                  AD
                </AvatarFallback>
              </Avatar>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold truncate">运维专家 Alex</p>
              <p className="text-[10px] text-slate-500 truncate">Administrator</p>
            </div>
            <button className="ml-auto text-slate-400 hover:text-white">
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#020617] relative">
        {/* 顶部通栏 */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-[#0F172A]/50 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-4 flex-1">
            {/* Toggle Sidebar */}
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            {/* Cluster Selector */}
            <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700">
              <Server className="h-4 w-4 text-sky-400" />
              <span className="text-xs font-medium">生产集群: Prod-China-01</span>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </div>

            {/* Namespace Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 bg-slate-900 border border-slate-700 hover:bg-slate-800"
                >
                  <Layers className="h-4 w-4 text-sky-400" />
                  <span className="max-w-[120px] truncate text-xs">{currentNamespace}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-slate-900 border-slate-700">
                <DropdownMenuLabel className="text-slate-400">命名空间</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-700" />
                {namespaces.map((ns) => (
                  <DropdownMenuItem
                    key={ns}
                    onClick={() => setCurrentNamespace(ns)}
                    className="flex items-center justify-between text-slate-300 hover:text-white focus:bg-slate-800"
                  >
                    <span>{ns}</span>
                    {currentNamespace === ns && (
                      <Badge className="h-5 px-1 text-[10px] bg-sky-500/20 text-sky-400 border-0">
                        当前
                      </Badge>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Search */}
            <div className="relative w-80 group">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 group-focus-within:text-sky-400" />
              <Input
                placeholder="全域搜索资源 (Cmd + K)..."
                className="w-full bg-slate-900 border-slate-700 rounded-lg py-1.5 pl-10 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* API Status */}
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-green-500 status-pulse" />
              <span className="text-slate-400">APIServer 响应: 12ms</span>
            </div>

            {/* Notifications */}
            <button className="relative p-2 text-slate-400 hover:text-white glass-card !rounded-full">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-slate-900" />
            </button>

            {/* Help */}
            <button className="p-2 text-slate-400 hover:text-white glass-card !rounded-full">
              <HelpCircle className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* 内容画布 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">{renderPage()}</div>

        {/* 浮动 AI 助手 */}
        <div className="fixed bottom-8 right-8 z-50">
          <button className="w-14 h-14 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-full flex items-center justify-center shadow-2xl neon-shadow-blue hover:scale-110 active:scale-95 transition-all">
            <Cpu className="h-6 w-6 text-white" />
          </button>
        </div>
      </main>
    </div>
  );
}
