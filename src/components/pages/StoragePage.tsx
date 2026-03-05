"use client";

import { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Search,
  Plus,
  RefreshCw,
  Database,
  FileKey,
  HardDrive,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Download,
  Loader2,
} from "lucide-react";
import { useConfigMaps, useSecrets, usePVCs } from "@/hooks/use-k8s";

interface StoragePageProps {
  namespace: string;
  initialTab?: string;
}

// Format age from date
function formatAge(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return "刚刚";
}

const getStatusBadge = (status: string) => {
  const config: Record<string, { color: string; bg: string; dot: string }> = {
    Bound: { color: "text-green-400", bg: "bg-green-500/10", dot: "bg-green-500" },
    Pending: { color: "text-amber-400", bg: "bg-amber-500/10", dot: "bg-amber-500" },
    Available: { color: "text-sky-400", bg: "bg-sky-500/10", dot: "bg-sky-500" },
    Released: { color: "text-slate-400", bg: "bg-slate-500/10", dot: "bg-slate-500" },
    Failed: { color: "text-rose-400", bg: "bg-rose-500/10", dot: "bg-rose-500" },
  };
  const c = config[status] || config.Available;
  return (
    <Badge className={`${c.bg} ${c.color} border-0`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} mr-1.5`} />
      {status}
    </Badge>
  );
};

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between">
        <div className="h-8 w-48 bg-slate-800 rounded" />
        <div className="flex gap-4">
          <div className="h-10 w-24 bg-slate-800 rounded" />
          <div className="h-10 w-32 bg-slate-800 rounded" />
        </div>
      </div>
      <div className="grid gap-4 grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-slate-800 rounded-xl" />
        ))}
      </div>
      <div className="glass-card">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 border-b border-slate-800 flex items-center px-6">
            <div className="h-4 bg-slate-800 rounded w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StoragePage({ namespace, initialTab = "configmaps" }: StoragePageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showSecretData, setShowSecretData] = useState<Record<string, boolean>>({});

  // Fetch real K8s data
  const { data: configMaps, isLoading: cmLoading, refetch: refetchCM } = useConfigMaps();
  const { data: secrets, isLoading: secretsLoading, refetch: refetchSecrets } = useSecrets();
  const { data: pvcs, isLoading: pvcsLoading, refetch: refetchPVCs } = usePVCs();

  const isLoading = cmLoading || secretsLoading || pvcsLoading;

  // Ensure data is arrays
  const configMapsList = Array.isArray(configMaps) ? configMaps : [];
  const secretsList = Array.isArray(secrets) ? secrets : [];
  const pvcsList = Array.isArray(pvcs) ? pvcs : [];

  // 当 initialTab 从外部改变时，更新 activeTab
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Filter by namespace and search term
  const filteredConfigMaps = configMapsList.filter(
    (c) => {
      const matchesNamespace = namespace === "default" || c.namespace === namespace;
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesNamespace && matchesSearch;
    }
  );

  const filteredSecrets = secretsList.filter(
    (s) => {
      const matchesNamespace = namespace === "default" || s.namespace === namespace;
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesNamespace && matchesSearch;
    }
  );

  const filteredPVCs = pvcsList.filter(
    (p) => {
      const matchesNamespace = namespace === "default" || p.namespace === namespace;
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesNamespace && matchesSearch;
    }
  );

  const handleRefresh = () => {
    refetchCM();
    refetchSecrets();
    refetchPVCs();
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const boundPVCs = pvcsList.filter(p => p.status === "Bound").length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Database className="text-sky-400 h-7 w-7" />
            {activeTab === "configmaps" && "ConfigMaps 管理"}
            {activeTab === "secrets" && "Secrets 管理"}
            {activeTab === "pvc" && "持久卷声明 (PVC)"}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {activeTab === "configmaps" && "管理应用程序配置数据"}
            {activeTab === "secrets" && "管理敏感信息和密钥"}
            {activeTab === "pvc" && "管理持久化存储声明"}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="border-slate-700 text-slate-300" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button className="bg-sky-500 hover:bg-sky-600 text-white" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            创建{activeTab === "configmaps" ? "ConfigMap" : activeTab === "secrets" ? "Secret" : "PVC"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 rounded-lg">
              <Database className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{configMapsList.length}</p>
              <p className="text-xs text-slate-400">ConfigMaps</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <FileKey className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{secretsList.length}</p>
              <p className="text-xs text-slate-400">Secrets</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <HardDrive className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{boundPVCs}/{pvcsList.length}</p>
              <p className="text-xs text-slate-400">PVC 已绑定</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Database className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">-</p>
              <p className="text-xs text-slate-400">存储类</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex gap-6">
          {[
            { id: "configmaps", label: "ConfigMaps", icon: Database, count: filteredConfigMaps.length },
            { id: "secrets", label: "Secrets", icon: FileKey, count: filteredSecrets.length },
            { id: "pvc", label: "PVC", icon: HardDrive, count: filteredPVCs.length },
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
              <span className="text-xs text-slate-500">({tab.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          placeholder="搜索..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-slate-900 border-slate-700"
        />
      </div>

      {/* Content */}
      {activeTab === "configmaps" && (
        filteredConfigMaps.length > 0 ? (
          <div className="glass-card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">名称</th>
                  <th className="px-6 py-4 font-medium">命名空间</th>
                  <th className="px-6 py-4 font-medium">数据键</th>
                  <th className="px-6 py-4 font-medium">存活时间</th>
                  <th className="px-6 py-4 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredConfigMaps.map((cm) => (
                  <tr key={`${cm.namespace}-${cm.name}`} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-sky-400" />
                        <span className="font-mono text-sky-400">{cm.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge className="bg-slate-700 text-slate-300">{cm.namespace}</Badge>
                    </td>
                    <td className="px-6 py-4 text-white">{Object.keys(cm.data || {}).length}</td>
                    <td className="px-6 py-4 text-slate-500">{formatAge(cm.createdAt)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="glass-card p-12 text-center">
            <Database className="h-12 w-12 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 text-sm">当前命名空间没有 ConfigMap</p>
          </div>
        )
      )}

      {activeTab === "secrets" && (
        filteredSecrets.length > 0 ? (
          <div className="glass-card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">名称</th>
                  <th className="px-6 py-4 font-medium">命名空间</th>
                  <th className="px-6 py-4 font-medium">类型</th>
                  <th className="px-6 py-4 font-medium">数据键</th>
                  <th className="px-6 py-4 font-medium">存活时间</th>
                  <th className="px-6 py-4 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredSecrets.map((secret) => (
                  <tr key={`${secret.namespace}-${secret.name}`} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-amber-400" />
                        <span className="font-mono text-sky-400">{secret.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge className="bg-slate-700 text-slate-300">{secret.namespace}</Badge>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">{secret.type}</td>
                    <td className="px-6 py-4 text-white">{secret.dataKeys?.length || 0}</td>
                    <td className="px-6 py-4 text-slate-500">{formatAge(secret.createdAt)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-white"
                          onClick={() => setShowSecretData(prev => ({ ...prev, [secret.name]: !prev[secret.name] }))}
                        >
                          {showSecretData[secret.name] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="glass-card p-12 text-center">
            <Lock className="h-12 w-12 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 text-sm">当前命名空间没有 Secret</p>
          </div>
        )
      )}

      {activeTab === "pvc" && (
        filteredPVCs.length > 0 ? (
          <div className="glass-card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">名称</th>
                  <th className="px-6 py-4 font-medium">命名空间</th>
                  <th className="px-6 py-4 font-medium">状态</th>
                  <th className="px-6 py-4 font-medium">容量</th>
                  <th className="px-6 py-4 font-medium">访问模式</th>
                  <th className="px-6 py-4 font-medium">存储类</th>
                  <th className="px-6 py-4 font-medium">存活时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredPVCs.map((pvc) => (
                  <tr key={`${pvc.namespace}-${pvc.name}`} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-purple-400" />
                        <span className="font-mono text-sky-400">{pvc.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge className="bg-slate-700 text-slate-300">{pvc.namespace}</Badge>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(pvc.status)}</td>
                    <td className="px-6 py-4 text-white">{pvc.capacity || "-"}</td>
                    <td className="px-6 py-4">
                      <Badge className="bg-slate-700 text-slate-300 text-xs">
                        {pvc.accessModes?.join(", ") || "-"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{pvc.storageClass || "-"}</td>
                    <td className="px-6 py-4 text-slate-500">{formatAge(pvc.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="glass-card p-12 text-center">
            <HardDrive className="h-12 w-12 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 text-sm">当前命名空间没有 PVC</p>
          </div>
        )
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">
              创建 {activeTab === "configmaps" ? "ConfigMap" : activeTab === "secrets" ? "Secret" : "PVC"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {activeTab === "configmaps" && "创建新的配置映射"}
              {activeTab === "secrets" && "创建新的密钥"}
              {activeTab === "pvc" && "创建新的持久卷声明"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">名称</Label>
              <Input placeholder="my-resource" className="bg-slate-800 border-slate-700" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">命名空间</Label>
              <Input placeholder="default" className="bg-slate-800 border-slate-700" />
            </div>
            {activeTab === "pvc" && (
              <>
                <div className="space-y-2">
                  <Label className="text-slate-300">存储类</Label>
                  <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                    <option>standard</option>
                    <option>fast-ssd</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">容量</Label>
                  <Input placeholder="10Gi" className="bg-slate-800 border-slate-700" />
                </div>
              </>
            )}
            {(activeTab === "configmaps" || activeTab === "secrets") && (
              <div className="space-y-2">
                <Label className="text-slate-300">数据 (YAML/JSON)</Label>
                <textarea
                  className="w-full h-32 bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-300 resize-none"
                  placeholder="key: value"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="border-slate-700 text-slate-300">
              取消
            </Button>
            <Button className="bg-sky-500 hover:bg-sky-600" onClick={() => setIsCreateOpen(false)}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
