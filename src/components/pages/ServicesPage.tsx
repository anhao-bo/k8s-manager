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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Search,
  Plus,
  MoreHorizontal,
  RefreshCw,
  Network,
  Loader2,
  Eye,
  Edit,
  Trash2,
  Code,
  AlertTriangle,
} from "lucide-react";
import { useServices, useDeleteService } from "@/hooks/use-k8s";
import { useToast } from "@/hooks/use-toast";
import ResourceYamlEditor from "@/components/ui/ResourceYamlEditor";

interface ServicesPageProps {
  namespace: string;
}

// Service 详情类型
interface ServiceDetail {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIP: string;
  ports: Array<{ name: string; port: number; targetPort: string; protocol: string }>;
  selector: Record<string, string>;
  createdAt: string;
  labels: Record<string, string>;
  sessionAffinity: string;
  internalTrafficPolicy: string;
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
  const colors: Record<string, string> = {
    ClusterIP: "text-sky-400",
    NodePort: "text-emerald-400",
    LoadBalancer: "text-amber-400",
    ExternalName: "text-purple-400",
  };
  return <span className={`font-medium ${colors[type] || "text-slate-400"}`}>{type}</span>;
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

export default function ServicesPage({ namespace }: ServicesPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<{ namespace: string; name: string } | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceDetail | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<{ namespace: string; name: string } | null>(null);

  const { toast } = useToast();

  // Fetch real K8s data
  const { data: services, isLoading, refetch, isRefetching } = useServices();
  const deleteService = useDeleteService();

  // Ensure data is array
  const servicesList = Array.isArray(services) ? services : [];

  // Filter by namespace and search term
  const filteredServices = servicesList.filter(
    (s) => {
      const matchesNamespace = namespace === "default" || s.namespace === namespace;
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesNamespace && matchesSearch;
    }
  );

  // Stats
  const stats = {
    total: filteredServices.length,
    clusterIP: filteredServices.filter(s => s.type === "ClusterIP").length,
    nodePort: filteredServices.filter(s => s.type === "NodePort").length,
    loadBalancer: filteredServices.filter(s => s.type === "LoadBalancer").length,
  };

  // Handle view detail
  const handleViewDetail = async (svcNamespace: string, svcName: string) => {
    try {
      const response = await fetch(`/api/services/detail?namespace=${svcNamespace}&name=${svcName}&XTransformPort=8080`);
      if (response.ok) {
        const data = await response.json();
        setSelectedService(data);
        setIsDetailOpen(true);
      } else {
        toast({ title: "获取详情失败", variant: "destructive" });
      }
    } catch {
      toast({ title: "获取详情失败", variant: "destructive" });
    }
  };

  // Handle edit YAML
  const handleEditYaml = (svcNamespace: string, svcName: string) => {
    setSelectedResource({ namespace: svcNamespace, name: svcName });
    setIsEditOpen(true);
  };

  // Handle delete
  const handleDelete = (svcNamespace: string, svcName: string) => {
    setServiceToDelete({ namespace: svcNamespace, name: svcName });
    setIsDeleteOpen(true);
  };

  // Confirm delete
  const confirmDelete = () => {
    if (serviceToDelete) {
      deleteService.mutate(serviceToDelete.namespace, serviceToDelete.name, {
        onSuccess: () => {
          toast({ title: "删除成功", description: `Service ${serviceToDelete.name} 已删除` });
          setIsDeleteOpen(false);
          setServiceToDelete(null);
        },
        onError: (error) => {
          toast({ title: "删除失败", description: error.message, variant: "destructive" });
        },
      });
    }
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">服务与路由</h2>
          <p className="text-slate-400 text-sm mt-1">管理 Kubernetes Services</p>
        </div>
        <div className="flex gap-4">
          <Button 
            variant="ghost" 
            className="glass-card px-4 py-2 text-sm text-slate-300"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            {isRefetching ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            刷新
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-sky-500 hover:bg-sky-600 px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-sky-500/20">
                <Plus className="h-4 w-4 mr-2" />
                创建服务
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">创建服务</DialogTitle>
                <DialogDescription className="text-slate-400">创建新的 Service</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-slate-300">名称</Label>
                  <Input placeholder="my-service" className="col-span-3 bg-slate-800 border-slate-600" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-slate-300">类型</Label>
                  <Input placeholder="ClusterIP" className="col-span-3 bg-slate-800 border-slate-600" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-slate-300">端口</Label>
                  <Input placeholder="80:8080" className="col-span-3 bg-slate-800 border-slate-600" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="text-slate-300">取消</Button>
                <Button onClick={() => setIsCreateOpen(false)} className="bg-sky-500 hover:bg-sky-600">创建</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-xs text-slate-400 mt-1">总计</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-2xl font-bold text-sky-400">{stats.clusterIP}</div>
          <div className="text-xs text-slate-400 mt-1">ClusterIP</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-2xl font-bold text-emerald-400">{stats.nodePort}</div>
          <div className="text-xs text-slate-400 mt-1">NodePort</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-2xl font-bold text-amber-400">{stats.loadBalancer}</div>
          <div className="text-xs text-slate-400 mt-1">LoadBalancer</div>
        </div>
      </div>

      {/* Search */}
      <div className="flex justify-between items-center">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="搜索服务..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-slate-900 border-slate-700"
          />
        </div>
      </div>

      {/* Services Table */}
      {filteredServices.length > 0 ? (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">名称</th>
                <th className="px-6 py-4 font-medium">命名空间</th>
                <th className="px-6 py-4 font-medium">类型</th>
                <th className="px-6 py-4 font-medium">ClusterIP</th>
                <th className="px-6 py-4 font-medium">外部IP</th>
                <th className="px-6 py-4 font-medium">端口</th>
                <th className="px-6 py-4 font-medium">存活时间</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredServices.map((service) => (
                <tr key={`${service.namespace}-${service.name}`} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Network className="h-4 w-4 text-sky-400" />
                      <span className="font-mono font-bold text-sky-400">{service.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{service.namespace}</span>
                  </td>
                  <td className="px-6 py-4">{getTypeBadge(service.type)}</td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-400">{service.clusterIP || "None"}</td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-400">{service.externalIP || "-"}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1 flex-wrap">
                      {service.ports && service.ports.length > 0 ? (
                        service.ports.map((p, i) => (
                          <Badge key={i} variant="secondary" className="text-xs bg-slate-800">
                            {p.port}/{p.protocol}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{formatAge(service.createdAt)}</td>
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                        <DropdownMenuItem 
                          className="text-slate-300 hover:text-white focus:bg-slate-800"
                          onClick={() => handleViewDetail(service.namespace, service.name)}
                        >
                          <Eye className="h-4 w-4 mr-2" /> 查看详情
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-slate-300 hover:text-white focus:bg-slate-800"
                          onClick={() => handleEditYaml(service.namespace, service.name)}
                        >
                          <Edit className="h-4 w-4 mr-2" /> 编辑 YAML
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-rose-500 hover:text-rose-300 focus:bg-rose-500/10"
                          onClick={() => handleDelete(service.namespace, service.name)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> 删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <Network className="h-12 w-12 mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 text-sm">当前命名空间没有 Service</p>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[600px] bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Network className="h-5 w-5 text-sky-400" />
              Service 详情
            </DialogTitle>
          </DialogHeader>
          {selectedService && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 text-xs">名称</p>
                  <p className="text-white font-mono">{selectedService.name}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">命名空间</p>
                  <p className="text-white">{selectedService.namespace}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">类型</p>
                  <Badge variant="secondary" className="bg-slate-800">{selectedService.type}</Badge>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">ClusterIP</p>
                  <p className="text-sky-400 font-mono text-sm">{selectedService.clusterIP || "None"}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">外部IP</p>
                  <p className="text-white text-sm">{selectedService.externalIP || "-"}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">会话亲和性</p>
                  <p className="text-white text-sm">{selectedService.sessionAffinity || "None"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-500 text-xs">创建时间</p>
                  <p className="text-white text-sm">{selectedService.createdAt}</p>
                </div>
              </div>
              
              {/* Selector */}
              {selectedService.selector && Object.keys(selectedService.selector).length > 0 && (
                <div>
                  <p className="text-slate-500 text-xs mb-2">Selector</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(selectedService.selector).map(([key, value]) => (
                      <Badge key={key} variant="secondary" className="bg-slate-800 text-xs">
                        {key}={value}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Ports */}
              {selectedService.ports && selectedService.ports.length > 0 && (
                <div>
                  <p className="text-slate-500 text-xs mb-2">端口</p>
                  <div className="space-y-2">
                    {selectedService.ports.map((port, idx) => (
                      <div key={idx} className="bg-slate-800 rounded p-3 flex justify-between items-center">
                        <div>
                          <p className="text-sky-400 font-mono text-sm">{port.name || `port-${idx}`}</p>
                          <p className="text-slate-400 text-xs">{port.port} → {port.targetPort} ({port.protocol})</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)} className="border-slate-700 text-slate-300">
              关闭
            </Button>
            <Button 
              className="bg-sky-500 hover:bg-sky-600"
              onClick={() => {
                setIsDetailOpen(false);
                if (selectedService) {
                  handleEditYaml(selectedService.namespace, selectedService.name);
                }
              }}
            >
              <Edit className="h-4 w-4 mr-2" /> 编辑 YAML
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit YAML Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-5xl h-[700px] bg-slate-900 border-slate-700 flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Code className="h-5 w-5 text-sky-400" />
              编辑 Service YAML - {selectedResource?.name}
            </DialogTitle>
            <DialogDescription className="text-slate-400">命名空间: {selectedResource?.namespace}</DialogDescription>
          </DialogHeader>
          {selectedResource && (
            <ResourceYamlEditor 
              kind="Service" 
              namespace={selectedResource.namespace} 
              name={selectedResource.name} 
              onClose={() => setIsEditOpen(false)} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-400" />
              确认删除 Service
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              您确定要删除 Service <span className="text-rose-400 font-mono font-bold">{serviceToDelete?.name}</span> 吗？
              <br />
              <span className="text-slate-500 text-xs">命名空间: {serviceToDelete?.namespace}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteService.isPending}
              className="bg-rose-500 hover:bg-rose-600 text-white"
            >
              {deleteService.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  删除中...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  确认删除
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
