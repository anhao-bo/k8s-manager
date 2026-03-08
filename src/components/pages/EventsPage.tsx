"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  RefreshCw,
  Download,
  Clock,
  Filter,
  Play,
  FileText,
  Activity,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useEvents, usePods, usePodLogs } from "@/hooks/use-k8s";

interface EventsPageProps {
  namespace: string;
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

const getTypeBadge = (type: string) => {
  if (type === "Warning") {
    return (
      <span className="px-2 py-0.5 bg-rose-500/10 text-rose-500 text-[10px] font-bold rounded">
        Warning
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 bg-sky-500/10 text-sky-500 text-[10px] font-bold rounded">
      Normal
    </span>
  );
};

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-slate-800 rounded" />
        <div className="flex gap-4">
          <div className="h-10 w-24 bg-slate-800 rounded" />
          <div className="h-10 w-32 bg-slate-800 rounded" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
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

export default function EventsPage({ namespace }: EventsPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("events");
  const [selectedPod, setSelectedPod] = useState<{ namespace: string; name: string } | null>(null);

  // Fetch real K8s data
  const { data: events, isLoading: eventsLoading, refetch: refetchEvents, error } = useEvents();
  const { data: pods, isLoading: podsLoading } = usePods();
  
  // Pod logs query
  const { data: logsData, isLoading: logsLoading } = usePodLogs(
    selectedPod?.namespace || "",
    selectedPod?.name || "",
    undefined,
    100
  );

  const isLoading = eventsLoading || podsLoading;

  // Ensure data is arrays
  const eventsList = Array.isArray(events) ? events : [];
  const podsList = Array.isArray(pods) ? pods : [];

  // Filter events by namespace, search term, and type
  const filteredEvents = eventsList.filter((event) => {
    const matchesNamespace = namespace === "default" || event.namespace === namespace;
    const matchesSearch =
      event.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.involvedObject.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || event.type === typeFilter;
    return matchesNamespace && matchesSearch && matchesType;
  });

  // Filter pods by namespace
  const filteredPods = podsList.filter((pod) => 
    namespace === "default" || pod.namespace === namespace
  );

  const warningCount = eventsList.filter(e => e.type === "Warning").length;
  const normalCount = eventsList.filter(e => e.type === "Normal").length;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">事件日志</h2>
          <p className="text-slate-400 text-sm mt-1">查看集群事件和 Pod 日志</p>
        </div>
        <div className="flex gap-4">
          <Button 
            variant="ghost" 
            className="glass-card px-4 py-2 text-sm text-slate-300"
            onClick={() => refetchEvents()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="glass-card p-6">
          <p className="text-slate-400 text-xs">总事件</p>
          <div className="text-2xl font-bold text-white mt-2">{eventsList.length}</div>
        </div>
        <div className="glass-card p-6">
          <p className="text-slate-400 text-xs">警告</p>
          <div className="text-2xl font-bold text-rose-400 mt-2">{warningCount}</div>
        </div>
        <div className="glass-card p-6">
          <p className="text-slate-400 text-xs">正常</p>
          <div className="text-2xl font-bold text-sky-400 mt-2">{normalCount}</div>
        </div>
        <div className="glass-card p-6">
          <p className="text-slate-400 text-xs">最近更新</p>
          <div className="flex items-center gap-1 text-sm font-medium text-slate-300 mt-2">
            <Clock className="h-4 w-4 text-slate-500" />
            刚刚
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="glass-card p-4 border-rose-500/50 bg-rose-500/10">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">无法加载事件数据，请检查集群连接</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-900 border border-slate-700">
          <TabsTrigger value="events" className="gap-2 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
            <Activity className="h-4 w-4" />
            事件
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
            <FileText className="h-4 w-4" />
            日志
          </TabsTrigger>
        </TabsList>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="搜索事件..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-900 border-slate-700"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px] bg-slate-900 border-slate-700">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="类型筛选" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Warning">Warning</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="glass-card">
            {filteredEvents.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-medium">级别</th>
                    <th className="px-6 py-4 font-medium">原因</th>
                    <th className="px-6 py-4 font-medium">消息</th>
                    <th className="px-6 py-4 font-medium">资源</th>
                    <th className="px-6 py-4 font-medium">来源</th>
                    <th className="px-6 py-4 font-medium">次数</th>
                    <th className="px-6 py-4 font-medium">最后发生</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredEvents.map((event, index) => (
                    <tr key={`${event.name}-${index}`} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4">{getTypeBadge(event.type)}</td>
                      <td className="px-6 py-4 font-medium text-white">{event.reason}</td>
                      <td className="px-6 py-4 text-slate-400 max-w-[300px] truncate" title={event.message}>
                        {event.message}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <Badge variant="outline" className="w-fit text-xs bg-slate-800 border-slate-700">
                            {event.involvedObject.kind}
                          </Badge>
                          <span className="text-xs mt-1 text-sky-400 font-mono truncate max-w-[150px]" title={event.involvedObject.name}>
                            {event.involvedObject.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-300">{event.source.component}</span>
                        {event.source.host && (
                          <span className="text-xs text-slate-500 block">{event.source.host}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className="bg-slate-800">{event.count}</Badge>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">{formatAge(event.lastTimestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center">
                <Activity className="h-12 w-12 mx-auto text-slate-600 mb-4" />
                <p className="text-slate-400 text-sm">
                  {error ? "无法加载事件数据" : "当前命名空间没有事件"}
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <div className="relative w-64 mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="搜索 Pod..."
              className="pl-9 bg-slate-900 border-slate-700"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="grid gap-4">
            {filteredPods
              .filter(pod => pod.name.toLowerCase().includes(searchTerm.toLowerCase()))
              .slice(0, 10)
              .map((pod) => (
                <div key={`${pod.namespace}-${pod.name}`} className="glass-card overflow-hidden">
                  <div className="px-6 py-4 bg-slate-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-slate-400" />
                      <div>
                        <h4 className="text-sm font-medium text-white">{pod.name}</h4>
                        <p className="text-xs text-slate-500">命名空间: {pod.namespace} | 状态: {pod.status}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedPod({ namespace: pod.namespace, name: pod.name })}
                        className="text-slate-300 hover:text-white"
                      >
                        <Play className="h-4 w-4 mr-1" />
                        查看日志
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
          
          {filteredPods.length === 0 && (
            <div className="glass-card p-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400 text-sm">当前命名空间没有 Pod</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedPod} onOpenChange={() => setSelectedPod(null)}>
        <DialogContent className="max-w-4xl bg-slate-900 border-slate-700">
          {selectedPod && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-white">
                  <FileText className="h-5 w-5 text-sky-400" />
                  {selectedPod.name}
                </DialogTitle>
                <DialogDescription className="text-slate-400">命名空间: {selectedPod.namespace}</DialogDescription>
              </DialogHeader>
              <div className="mt-4">
                {logsLoading ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
                  </div>
                ) : (
                  <pre className="p-4 text-xs font-mono text-slate-400 bg-slate-950 rounded-lg overflow-auto max-h-[500px]">
                    {logsData?.logs || "暂无日志数据"}
                  </pre>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
