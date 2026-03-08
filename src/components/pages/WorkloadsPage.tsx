"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  Plus,
  MoreHorizontal,
  RefreshCw,
  Terminal,
  Trash2,
  Edit,
  Play,
  Pause,
  FileText,
  Loader2,
  AlertCircle,
  Code,
  Container,
  Boxes,
  Layers,
  Clock,
  Calendar,
  Info,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  usePods,
  useDeployments,
  useStatefulSets,
  useDaemonSets,
  useJobs,
  useCronJobs,
  useDeletePod,
  useDeleteDeployment,
  useDeleteStatefulSet,
  useDeleteDaemonSet,
  useDeleteJob,
  useDeleteCronJob,
  useScaleDeployment,
  useScaleStatefulSet,
  useRestartDeployment,
  useRestartStatefulSet,
  useRestartDaemonSet,
  useSuspendCronJob,
  useTriggerCronJob,
  useCreatePod,
  useCreateDeployment,
  useCreateStatefulSet,
  useCreateDaemonSet,
  useCreateJob,
  useCreateCronJob,
  useNamespaces,
  usePodLogs,
  usePodYaml,
  useUpdatePodYaml,
  usePodDetail,
  useStatefulSetDetail,
  useDaemonSetDetail,
  useJobDetail,
  useCronJobDetail,
  type StatefulSetDetail,
  type DaemonSetDetail,
  type JobDetail,
  type CronJobDetail,
  type PodDetail,
} from "@/hooks/use-k8s";
import { useToast } from "@/hooks/use-toast";
import dynamic from "next/dynamic";

// 动态导入 PodTerminal 以避免 xterm.js SSR 错误
const PodTerminal = dynamic(() => import("@/components/ui/PodTerminal"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-[#0a0a0f] rounded-lg">
      <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
    </div>
  ),
});

interface WorkloadsPageProps {
  namespace: string;
}

const getStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    Running: "text-emerald-400",
    Pending: "text-amber-400",
    CrashLoopBackOff: "text-rose-400",
    Error: "text-rose-400",
    Failed: "text-rose-400",
    Completed: "text-sky-400",
    Succeeded: "text-emerald-400",
  };
  const dotStyles: Record<string, string> = {
    Running: "bg-emerald-500",
    Pending: "bg-amber-500",
    CrashLoopBackOff: "bg-rose-500",
    Error: "bg-rose-500",
    Failed: "bg-rose-500",
    Completed: "bg-sky-500",
    Succeeded: "bg-emerald-500",
  };
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${dotStyles[status] || "bg-slate-500"} status-pulse`} />
      <span className={`${styles[status] || "text-slate-400"} font-medium`}>{status}</span>
    </div>
  );
};

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
      <div className="h-12 bg-slate-800 rounded" />
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

export default function WorkloadsPage({ namespace }: WorkloadsPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pods");
  const [isCreatePodOpen, setIsCreatePodOpen] = useState(false);
  const [isCreateDeployOpen, setIsCreateDeployOpen] = useState(false);
  const [isCreateStsOpen, setIsCreateStsOpen] = useState(false);
  const [isCreateDsOpen, setIsCreateDsOpen] = useState(false);
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const [isCreateCronJobOpen, setIsCreateCronJobOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isYamlOpen, setIsYamlOpen] = useState(false);
  const [selectedPod, setSelectedPod] = useState<{ namespace: string; name: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Detail dialog states
  const [isPodDetailOpen, setIsPodDetailOpen] = useState(false);
  const [isStatefulSetDetailOpen, setIsStatefulSetDetailOpen] = useState(false);
  const [isDaemonSetDetailOpen, setIsDaemonSetDetailOpen] = useState(false);
  const [isJobDetailOpen, setIsJobDetailOpen] = useState(false);
  const [isCronJobDetailOpen, setIsCronJobDetailOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<{ namespace: string; name: string } | null>(null);
  
  // Form states
  const [podForm, setPodForm] = useState({
    name: "",
    image: "",
    namespace: "default",
  });
  const [deployForm, setDeployForm] = useState({
    name: "",
    image: "",
    namespace: "default",
    replicas: 1,
    port: 80,
  });
  const [stsForm, setStsForm] = useState({
    name: "",
    image: "",
    namespace: "default",
    replicas: 1,
    port: 80,
    serviceName: "",
  });
  const [dsForm, setDsForm] = useState({
    name: "",
    image: "",
    namespace: "default",
    port: 80,
  });
  const [jobForm, setJobForm] = useState({
    name: "",
    image: "",
    namespace: "default",
    completions: 1,
    parallelism: 1,
    restartPolicy: "OnFailure",
  });
  const [cronJobForm, setCronJobForm] = useState({
    name: "",
    image: "",
    namespace: "default",
    schedule: "*/5 * * * *",
    suspend: false,
  });
  
  const { toast } = useToast();

  // Fetch real K8s data
  const { data: pods, isLoading: podsLoading, error: podsError, refetch: refetchPods, isRefetching: isRefetchingPods } = usePods();
  const { data: deployments, isLoading: deploymentsLoading, refetch: refetchDeployments, isRefetching: isRefetchingDeployments } = useDeployments();
  const { data: statefulSets, isLoading: statefulSetsLoading, refetch: refetchStatefulSets, isRefetching: isRefetchingStatefulSets } = useStatefulSets();
  const { data: daemonSets, isLoading: daemonSetsLoading, refetch: refetchDaemonSets, isRefetching: isRefetchingDaemonSets } = useDaemonSets();
  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs, isRefetching: isRefetchingJobs } = useJobs();
  const { data: cronJobs, isLoading: cronJobsLoading, refetch: refetchCronJobs, isRefetching: isRefetchingCronJobs } = useCronJobs();
  const { data: namespaces } = useNamespaces();

  // Mutations
  const deletePod = useDeletePod();
  const deleteDeployment = useDeleteDeployment();
  const deleteStatefulSet = useDeleteStatefulSet();
  const deleteDaemonSet = useDeleteDaemonSet();
  const deleteJob = useDeleteJob();
  const deleteCronJob = useDeleteCronJob();
  const scaleDeployment = useScaleDeployment();
  const scaleStatefulSet = useScaleStatefulSet();
  const restartDeployment = useRestartDeployment();
  const restartStatefulSet = useRestartStatefulSet();
  const restartDaemonSet = useRestartDaemonSet();
  const suspendCronJob = useSuspendCronJob();
  const triggerCronJob = useTriggerCronJob();
  const createPod = useCreatePod();
  const createDeployment = useCreateDeployment();
  const createStatefulSet = useCreateStatefulSet();
  const createDaemonSet = useCreateDaemonSet();
  const createJob = useCreateJob();
  const createCronJob = useCreateCronJob();

  // Ensure data is arrays
  const podsList = Array.isArray(pods) ? pods : [];
  const deploymentsList = Array.isArray(deployments) ? deployments : [];
  const statefulSetsList = Array.isArray(statefulSets) ? statefulSets : [];
  const daemonSetsList = Array.isArray(daemonSets) ? daemonSets : [];
  const jobsList = Array.isArray(jobs) ? jobs : [];
  const cronJobsList = Array.isArray(cronJobs) ? cronJobs : [];
  const namespacesList = Array.isArray(namespaces) ? namespaces : [];

  // Filter functions
  const filterByNamespace = <T extends { namespace: string }>(items: T[]) =>
    items.filter((item) => namespace === "default" || item.namespace === namespace);

  const filteredPods = podsList.filter(
    (p) => {
      const matchesNamespace = namespace === "default" || p.namespace === namespace;
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesNamespace && matchesSearch;
    }
  );
  const filteredDeployments = filterByNamespace(deploymentsList);
  const filteredStatefulSets = filterByNamespace(statefulSetsList);
  const filteredDaemonSets = filterByNamespace(daemonSetsList);
  const filteredJobs = filterByNamespace(jobsList);
  const filteredCronJobs = filterByNamespace(cronJobsList);

  const isLoading = podsLoading || deploymentsLoading || statefulSetsLoading || daemonSetsLoading || jobsLoading || cronJobsLoading;
  const isRefetching = isRefetchingPods || isRefetchingDeployments || isRefetchingStatefulSets || isRefetchingDaemonSets || isRefetchingJobs || isRefetchingCronJobs;

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchPods(),
        refetchDeployments(),
        refetchStatefulSets(),
        refetchDaemonSets(),
        refetchJobs(),
        refetchCronJobs(),
      ]);
      toast({
        title: "刷新成功",
        description: "工作负载数据已更新",
      });
    } catch (error) {
      toast({
        title: "刷新失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle pod delete
  const handleDeletePod = (podNamespace: string, podName: string) => {
    if (confirm(`确定要删除 Pod "${podName}" 吗？`)) {
      deletePod.mutate(podNamespace, podName, {
        onSuccess: () => {
          toast({ title: "删除成功", description: `Pod ${podName} 已删除` });
        },
        onError: (error) => {
          toast({ title: "删除失败", description: error.message, variant: "destructive" });
        },
      });
    }
  };

  // Handle deployment actions
  const handleDeleteDeployment = (ns: string, name: string) => {
    if (confirm(`确定要删除 Deployment "${name}" 吗？这将删除所有关联的 Pod。`)) {
      deleteDeployment.mutate(ns, name, {
        onSuccess: () => toast({ title: "删除成功", description: `Deployment ${name} 已删除` }),
        onError: (error) => toast({ title: "删除失败", description: error.message, variant: "destructive" }),
      });
    }
  };

  const handleScaleDeployment = (ns: string, name: string, current: number) => {
    const replicas = prompt(`当前副本数: ${current}\n请输入新的副本数:`, String(current));
    if (replicas) {
      const num = parseInt(replicas);
      if (isNaN(num) || num < 0) {
        toast({ title: "输入无效", description: "请输入有效的正整数", variant: "destructive" });
        return;
      }
      scaleDeployment.mutate(ns, name, num, {
        onSuccess: () => toast({ title: "扩缩容成功", description: `Deployment ${name} 副本数已设置为 ${num}` }),
        onError: (error) => toast({ title: "扩缩容失败", description: error.message, variant: "destructive" }),
      });
    }
  };

  const handleRestartDeployment = (ns: string, name: string) => {
    if (confirm(`确定要重启 Deployment "${name}" 吗？`)) {
      restartDeployment.mutate(ns, name, {
        onSuccess: () => toast({ title: "重启成功", description: `Deployment ${name} 正在重启` }),
        onError: (error) => toast({ title: "重启失败", description: error.message, variant: "destructive" }),
      });
    }
  };

  // Handle StatefulSet actions
  const handleDeleteStatefulSet = (ns: string, name: string) => {
    if (confirm(`确定要删除 StatefulSet "${name}" 吗？这将删除所有关联的 Pod。`)) {
      deleteStatefulSet.mutate(ns, name, {
        onSuccess: () => toast({ title: "删除成功", description: `StatefulSet ${name} 已删除` }),
        onError: (error) => toast({ title: "删除失败", description: error.message, variant: "destructive" }),
      });
    }
  };

  const handleScaleStatefulSet = (ns: string, name: string, current: number) => {
    const replicas = prompt(`当前副本数: ${current}\n请输入新的副本数:`, String(current));
    if (replicas) {
      const num = parseInt(replicas);
      if (isNaN(num) || num < 0) {
        toast({ title: "输入无效", description: "请输入有效的正整数", variant: "destructive" });
        return;
      }
      scaleStatefulSet.mutate(ns, name, num, {
        onSuccess: () => toast({ title: "扩缩容成功", description: `StatefulSet ${name} 副本数已设置为 ${num}` }),
        onError: (error) => toast({ title: "扩缩容失败", description: error.message, variant: "destructive" }),
      });
    }
  };

  const handleRestartStatefulSet = (ns: string, name: string) => {
    if (confirm(`确定要重启 StatefulSet "${name}" 吗？`)) {
      restartStatefulSet.mutate(ns, name, {
        onSuccess: () => toast({ title: "重启成功", description: `StatefulSet ${name} 正在重启` }),
        onError: (error) => toast({ title: "重启失败", description: error.message, variant: "destructive" }),
      });
    }
  };

  // Handle DaemonSet actions
  const handleDeleteDaemonSet = (ns: string, name: string) => {
    if (confirm(`确定要删除 DaemonSet "${name}" 吗？这将删除所有关联的 Pod。`)) {
      deleteDaemonSet.mutate(ns, name, {
        onSuccess: () => toast({ title: "删除成功", description: `DaemonSet ${name} 已删除` }),
        onError: (error) => toast({ title: "删除失败", description: error.message, variant: "destructive" }),
      });
    }
  };

  const handleRestartDaemonSet = (ns: string, name: string) => {
    if (confirm(`确定要重启 DaemonSet "${name}" 吗？`)) {
      restartDaemonSet.mutate(ns, name, {
        onSuccess: () => toast({ title: "重启成功", description: `DaemonSet ${name} 正在重启` }),
        onError: (error) => toast({ title: "重启失败", description: error.message, variant: "destructive" }),
      });
    }
  };

  // Handle Job actions
  const handleDeleteJob = (ns: string, name: string) => {
    if (confirm(`确定要删除 Job "${name}" 吗？`)) {
      deleteJob.mutate(ns, name, {
        onSuccess: () => toast({ title: "删除成功", description: `Job ${name} 已删除` }),
        onError: (error) => toast({ title: "删除失败", description: error.message, variant: "destructive" }),
      });
    }
  };

  // Handle CronJob actions
  const handleDeleteCronJob = (ns: string, name: string) => {
    if (confirm(`确定要删除 CronJob "${name}" 吗？`)) {
      deleteCronJob.mutate(ns, name, {
        onSuccess: () => toast({ title: "删除成功", description: `CronJob ${name} 已删除` }),
        onError: (error) => toast({ title: "删除失败", description: error.message, variant: "destructive" }),
      });
    }
  };

  const handleSuspendCronJob = (ns: string, name: string, currentSuspend: boolean) => {
    const action = currentSuspend ? "恢复" : "暂停";
    if (confirm(`确定要${action} CronJob "${name}" 吗？`)) {
      suspendCronJob.mutate(ns, name, !currentSuspend, {
        onSuccess: () => toast({ title: `${action}成功`, description: `CronJob ${name} 已${action}` }),
        onError: (error) => toast({ title: `${action}失败`, description: error.message, variant: "destructive" }),
      });
    }
  };

  const handleTriggerCronJob = (ns: string, name: string) => {
    if (confirm(`确定要手动触发 CronJob "${name}" 吗？`)) {
      triggerCronJob.mutate(ns, name, {
        onSuccess: () => toast({ title: "触发成功", description: `CronJob ${name} 已手动触发` }),
        onError: (error) => toast({ title: "触发失败", description: error.message, variant: "destructive" }),
      });
    }
  };

  // Handle create pod
  const handleCreatePod = () => {
    if (!podForm.name || !podForm.image) {
      toast({ title: "表单不完整", description: "请填写名称和镜像", variant: "destructive" });
      return;
    }
    createPod.mutate({
      namespace: podForm.namespace,
      name: podForm.name,
      image: podForm.image,
    }, {
      onSuccess: () => {
        toast({ title: "创建成功", description: `Pod ${podForm.name} 已创建` });
        setIsCreatePodOpen(false);
        setPodForm({ name: "", image: "", namespace: "default" });
      },
      onError: (error) => {
        toast({ title: "创建失败", description: error.message, variant: "destructive" });
      },
    });
  };

  // Handle create deployment
  const handleCreateDeployment = () => {
    if (!deployForm.name || !deployForm.image) {
      toast({ title: "表单不完整", description: "请填写名称和镜像", variant: "destructive" });
      return;
    }
    createDeployment.mutate({
      namespace: deployForm.namespace,
      name: deployForm.name,
      image: deployForm.image,
      replicas: deployForm.replicas,
      containerPort: deployForm.port,
    }, {
      onSuccess: () => {
        toast({ title: "创建成功", description: `Deployment ${deployForm.name} 已创建` });
        setIsCreateDeployOpen(false);
        setDeployForm({ name: "", image: "", namespace: "default", replicas: 1, port: 80 });
      },
      onError: (error) => {
        toast({ title: "创建失败", description: error.message, variant: "destructive" });
      },
    });
  };

  // Handle create StatefulSet
  const handleCreateStatefulSet = () => {
    if (!stsForm.name || !stsForm.image) {
      toast({ title: "表单不完整", description: "请填写名称和镜像", variant: "destructive" });
      return;
    }
    createStatefulSet.mutate({
      namespace: stsForm.namespace,
      name: stsForm.name,
      image: stsForm.image,
      replicas: stsForm.replicas,
      containerPort: stsForm.port,
      serviceName: stsForm.serviceName || `${stsForm.name}-headless`,
    }, {
      onSuccess: () => {
        toast({ title: "创建成功", description: `StatefulSet ${stsForm.name} 已创建` });
        setIsCreateStsOpen(false);
        setStsForm({ name: "", image: "", namespace: "default", replicas: 1, port: 80, serviceName: "" });
      },
      onError: (error) => {
        toast({ title: "创建失败", description: error.message, variant: "destructive" });
      },
    });
  };

  // Handle create DaemonSet
  const handleCreateDaemonSet = () => {
    if (!dsForm.name || !dsForm.image) {
      toast({ title: "表单不完整", description: "请填写名称和镜像", variant: "destructive" });
      return;
    }
    createDaemonSet.mutate({
      namespace: dsForm.namespace,
      name: dsForm.name,
      image: dsForm.image,
      containerPort: dsForm.port,
    }, {
      onSuccess: () => {
        toast({ title: "创建成功", description: `DaemonSet ${dsForm.name} 已创建` });
        setIsCreateDsOpen(false);
        setDsForm({ name: "", image: "", namespace: "default", port: 80 });
      },
      onError: (error) => {
        toast({ title: "创建失败", description: error.message, variant: "destructive" });
      },
    });
  };

  // Handle create Job
  const handleCreateJob = () => {
    if (!jobForm.name || !jobForm.image) {
      toast({ title: "表单不完整", description: "请填写名称和镜像", variant: "destructive" });
      return;
    }
    createJob.mutate({
      namespace: jobForm.namespace,
      name: jobForm.name,
      image: jobForm.image,
      completions: jobForm.completions,
      parallelism: jobForm.parallelism,
      restartPolicy: jobForm.restartPolicy,
    }, {
      onSuccess: () => {
        toast({ title: "创建成功", description: `Job ${jobForm.name} 已创建` });
        setIsCreateJobOpen(false);
        setJobForm({ name: "", image: "", namespace: "default", completions: 1, parallelism: 1, restartPolicy: "OnFailure" });
      },
      onError: (error) => {
        toast({ title: "创建失败", description: error.message, variant: "destructive" });
      },
    });
  };

  // Handle create CronJob
  const handleCreateCronJob = () => {
    if (!cronJobForm.name || !cronJobForm.image || !cronJobForm.schedule) {
      toast({ title: "表单不完整", description: "请填写名称、镜像和调度规则", variant: "destructive" });
      return;
    }
    createCronJob.mutate({
      namespace: cronJobForm.namespace,
      name: cronJobForm.name,
      image: cronJobForm.image,
      schedule: cronJobForm.schedule,
      suspend: cronJobForm.suspend,
    }, {
      onSuccess: () => {
        toast({ title: "创建成功", description: `CronJob ${cronJobForm.name} 已创建` });
        setIsCreateCronJobOpen(false);
        setCronJobForm({ name: "", image: "", namespace: "default", schedule: "*/5 * * * *", suspend: false });
      },
      onError: (error) => {
        toast({ title: "创建失败", description: error.message, variant: "destructive" });
      },
    });
  };

  // Handle view logs
  const handleViewLogs = (podNamespace: string, podName: string) => {
    setSelectedPod({ namespace: podNamespace, name: podName });
    setIsLogOpen(true);
  };

  // Handle open terminal
  const handleOpenTerminal = (podNamespace: string, podName: string) => {
    setSelectedPod({ namespace: podNamespace, name: podName });
    setIsTerminalOpen(true);
  };

  // Handle open YAML editor
  const handleOpenYaml = (podNamespace: string, podName: string) => {
    setSelectedPod({ namespace: podNamespace, name: podName });
    setIsYamlOpen(true);
  };

  // Handle view detail
  const handleViewDetail = (type: string, ns: string, name: string) => {
    setSelectedResource({ namespace: ns, name });
    switch (type) {
      case 'pod':
        setIsPodDetailOpen(true);
        break;
      case 'statefulset':
        setIsStatefulSetDetailOpen(true);
        break;
      case 'daemonset':
        setIsDaemonSetDetailOpen(true);
        break;
      case 'job':
        setIsJobDetailOpen(true);
        break;
      case 'cronjob':
        setIsCronJobDetailOpen(true);
        break;
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
          <h2 className="text-2xl font-bold text-white">工作负载</h2>
          <p className="text-slate-400 text-sm mt-1">管理集群内所有运行状态的容器实例</p>
        </div>
        <div className="flex gap-4">
          <Button 
            variant="ghost" 
            className="glass-card px-4 py-2 flex items-center gap-2 text-sm text-slate-300"
            onClick={handleRefresh}
            disabled={isRefreshing || isRefetching}
          >
            {isRefreshing || isRefetching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> 刷新中...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" /> 刷新
              </>
            )}
          </Button>
          
          {/* Create Pod Dialog */}
          {activeTab === "pods" && (
            <>
              <Button 
                className="bg-sky-500 hover:bg-sky-600 px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-sky-500/20"
                onClick={() => setIsCreatePodOpen(true)}
              >
                <Plus className="h-4 w-4" /> 创建 Pod
              </Button>
              <Dialog open={isCreatePodOpen} onOpenChange={setIsCreatePodOpen}>
                <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">创建 Pod</DialogTitle>
                  <DialogDescription className="text-slate-400">创建新的 Pod 工作负载</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">命名空间</Label>
                    <Select value={podForm.namespace} onValueChange={(v) => setPodForm({ ...podForm, namespace: v })}>
                      <SelectTrigger className="col-span-3 bg-slate-800 border-slate-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        <SelectItem value="default">default</SelectItem>
                        {namespacesList.map((ns) => (
                          <SelectItem key={ns.name} value={ns.name}>{ns.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">名称 *</Label>
                    <Input 
                      value={podForm.name}
                      onChange={(e) => setPodForm({ ...podForm, name: e.target.value })}
                      placeholder="my-pod" 
                      className="col-span-3 bg-slate-800 border-slate-600" 
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">镜像 *</Label>
                    <Input 
                      value={podForm.image}
                      onChange={(e) => setPodForm({ ...podForm, image: e.target.value })}
                      placeholder="nginx:latest" 
                      className="col-span-3 bg-slate-800 border-slate-600" 
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsCreatePodOpen(false)} className="text-slate-300">取消</Button>
                  <Button onClick={handleCreatePod} className="bg-sky-500 hover:bg-sky-600" disabled={createPod.isPending}>
                    {createPod.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}创建
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </>
          )}

          {/* Create Deployment Dialog */}
          {activeTab === "deployments" && (
            <>
              <Button 
                className="bg-sky-500 hover:bg-sky-600 px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-sky-500/20"
                onClick={() => setIsCreateDeployOpen(true)}
              >
                <Plus className="h-4 w-4" /> 创建 Deployment
              </Button>
              <Dialog open={isCreateDeployOpen} onOpenChange={setIsCreateDeployOpen}>
                <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">创建 Deployment</DialogTitle>
                  <DialogDescription className="text-slate-400">创建新的 Deployment 工作负载</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">命名空间</Label>
                    <Select value={deployForm.namespace} onValueChange={(v) => setDeployForm({ ...deployForm, namespace: v })}>
                      <SelectTrigger className="col-span-3 bg-slate-800 border-slate-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        <SelectItem value="default">default</SelectItem>
                        {namespacesList.map((ns) => (
                          <SelectItem key={ns.name} value={ns.name}>{ns.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">名称 *</Label>
                    <Input value={deployForm.name} onChange={(e) => setDeployForm({ ...deployForm, name: e.target.value })} placeholder="my-app" className="col-span-3 bg-slate-800 border-slate-600" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">镜像 *</Label>
                    <Input value={deployForm.image} onChange={(e) => setDeployForm({ ...deployForm, image: e.target.value })} placeholder="nginx:latest" className="col-span-3 bg-slate-800 border-slate-600" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">副本数</Label>
                    <Input type="number" value={deployForm.replicas} onChange={(e) => setDeployForm({ ...deployForm, replicas: parseInt(e.target.value) || 1 })} min={1} className="col-span-3 bg-slate-800 border-slate-600" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">容器端口</Label>
                    <Input type="number" value={deployForm.port} onChange={(e) => setDeployForm({ ...deployForm, port: parseInt(e.target.value) || 80 })} className="col-span-3 bg-slate-800 border-slate-600" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsCreateDeployOpen(false)} className="text-slate-300">取消</Button>
                  <Button onClick={handleCreateDeployment} className="bg-sky-500 hover:bg-sky-600" disabled={createDeployment.isPending}>
                    {createDeployment.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}创建
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </>
          )}

          {/* Create StatefulSet Dialog */}
          {activeTab === "statefulsets" && (
            <>
              <Button 
                className="bg-sky-500 hover:bg-sky-600 px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-sky-500/20"
                onClick={() => setIsCreateStsOpen(true)}
              >
                <Plus className="h-4 w-4" /> 创建 StatefulSet
              </Button>
              <Dialog open={isCreateStsOpen} onOpenChange={setIsCreateStsOpen}>
                <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">创建 StatefulSet</DialogTitle>
                  <DialogDescription className="text-slate-400">创建有状态应用</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">命名空间</Label>
                    <Select value={stsForm.namespace} onValueChange={(v) => setStsForm({ ...stsForm, namespace: v })}>
                      <SelectTrigger className="col-span-3 bg-slate-800 border-slate-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        <SelectItem value="default">default</SelectItem>
                        {namespacesList.map((ns) => (
                          <SelectItem key={ns.name} value={ns.name}>{ns.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">名称 *</Label>
                    <Input value={stsForm.name} onChange={(e) => setStsForm({ ...stsForm, name: e.target.value })} placeholder="my-app" className="col-span-3 bg-slate-800 border-slate-600" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">镜像 *</Label>
                    <Input value={stsForm.image} onChange={(e) => setStsForm({ ...stsForm, image: e.target.value })} placeholder="nginx:latest" className="col-span-3 bg-slate-800 border-slate-600" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">副本数</Label>
                    <Input type="number" value={stsForm.replicas} onChange={(e) => setStsForm({ ...stsForm, replicas: parseInt(e.target.value) || 1 })} min={1} className="col-span-3 bg-slate-800 border-slate-600" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">容器端口</Label>
                    <Input type="number" value={stsForm.port} onChange={(e) => setStsForm({ ...stsForm, port: parseInt(e.target.value) || 80 })} className="col-span-3 bg-slate-800 border-slate-600" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsCreateStsOpen(false)} className="text-slate-300">取消</Button>
                  <Button onClick={handleCreateStatefulSet} className="bg-sky-500 hover:bg-sky-600" disabled={createStatefulSet.isPending}>
                    {createStatefulSet.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}创建
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </>
          )}

          {/* Create DaemonSet Dialog */}
          {activeTab === "daemonsets" && (
            <>
              <Button 
                className="bg-sky-500 hover:bg-sky-600 px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-sky-500/20"
                onClick={() => setIsCreateDsOpen(true)}
              >
                <Plus className="h-4 w-4" /> 创建 DaemonSet
              </Button>
              <Dialog open={isCreateDsOpen} onOpenChange={setIsCreateDsOpen}>
                <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">创建 DaemonSet</DialogTitle>
                  <DialogDescription className="text-slate-400">在每个节点上运行的守护进程</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">命名空间</Label>
                    <Select value={dsForm.namespace} onValueChange={(v) => setDsForm({ ...dsForm, namespace: v })}>
                      <SelectTrigger className="col-span-3 bg-slate-800 border-slate-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        <SelectItem value="default">default</SelectItem>
                        {namespacesList.map((ns) => (
                          <SelectItem key={ns.name} value={ns.name}>{ns.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">名称 *</Label>
                    <Input value={dsForm.name} onChange={(e) => setDsForm({ ...dsForm, name: e.target.value })} placeholder="my-daemon" className="col-span-3 bg-slate-800 border-slate-600" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">镜像 *</Label>
                    <Input value={dsForm.image} onChange={(e) => setDsForm({ ...dsForm, image: e.target.value })} placeholder="nginx:latest" className="col-span-3 bg-slate-800 border-slate-600" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">容器端口</Label>
                    <Input type="number" value={dsForm.port} onChange={(e) => setDsForm({ ...dsForm, port: parseInt(e.target.value) || 80 })} className="col-span-3 bg-slate-800 border-slate-600" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsCreateDsOpen(false)} className="text-slate-300">取消</Button>
                  <Button onClick={handleCreateDaemonSet} className="bg-sky-500 hover:bg-sky-600" disabled={createDaemonSet.isPending}>
                    {createDaemonSet.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}创建
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </>
          )}

          {/* Create Job Dialog */}
          {activeTab === "jobs" && (
            <>
              <Button 
                className="bg-sky-500 hover:bg-sky-600 px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-sky-500/20"
                onClick={() => setIsCreateJobOpen(true)}
              >
                <Plus className="h-4 w-4" /> 创建 Job
              </Button>
              <Dialog open={isCreateJobOpen} onOpenChange={setIsCreateJobOpen}>
                <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">创建 Job</DialogTitle>
                  <DialogDescription className="text-slate-400">创建一次性任务</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">命名空间</Label>
                    <Select value={jobForm.namespace} onValueChange={(v) => setJobForm({ ...jobForm, namespace: v })}>
                      <SelectTrigger className="col-span-3 bg-slate-800 border-slate-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        <SelectItem value="default">default</SelectItem>
                        {namespacesList.map((ns) => (
                          <SelectItem key={ns.name} value={ns.name}>{ns.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">名称 *</Label>
                    <Input value={jobForm.name} onChange={(e) => setJobForm({ ...jobForm, name: e.target.value })} placeholder="my-job" className="col-span-3 bg-slate-800 border-slate-600" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">镜像 *</Label>
                    <Input value={jobForm.image} onChange={(e) => setJobForm({ ...jobForm, image: e.target.value })} placeholder="busybox:latest" className="col-span-3 bg-slate-800 border-slate-600" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">完成次数</Label>
                    <Input type="number" value={jobForm.completions} onChange={(e) => setJobForm({ ...jobForm, completions: parseInt(e.target.value) || 1 })} min={1} className="col-span-3 bg-slate-800 border-slate-600" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">并行数</Label>
                    <Input type="number" value={jobForm.parallelism} onChange={(e) => setJobForm({ ...jobForm, parallelism: parseInt(e.target.value) || 1 })} min={1} className="col-span-3 bg-slate-800 border-slate-600" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">重启策略</Label>
                    <Select value={jobForm.restartPolicy} onValueChange={(v) => setJobForm({ ...jobForm, restartPolicy: v })}>
                      <SelectTrigger className="col-span-3 bg-slate-800 border-slate-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        <SelectItem value="OnFailure">OnFailure</SelectItem>
                        <SelectItem value="Never">Never</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsCreateJobOpen(false)} className="text-slate-300">取消</Button>
                  <Button onClick={handleCreateJob} className="bg-sky-500 hover:bg-sky-600" disabled={createJob.isPending}>
                    {createJob.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}创建
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </>
          )}

          {/* Create CronJob Dialog */}
          {activeTab === "cronjobs" && (
            <>
              <Button 
                className="bg-sky-500 hover:bg-sky-600 px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-sky-500/20"
                onClick={() => setIsCreateCronJobOpen(true)}
              >
                <Plus className="h-4 w-4" /> 创建 CronJob
              </Button>
              <Dialog open={isCreateCronJobOpen} onOpenChange={setIsCreateCronJobOpen}>
                <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">创建 CronJob</DialogTitle>
                  <DialogDescription className="text-slate-400">创建定时任务</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">命名空间</Label>
                    <Select value={cronJobForm.namespace} onValueChange={(v) => setCronJobForm({ ...cronJobForm, namespace: v })}>
                      <SelectTrigger className="col-span-3 bg-slate-800 border-slate-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        <SelectItem value="default">default</SelectItem>
                        {namespacesList.map((ns) => (
                          <SelectItem key={ns.name} value={ns.name}>{ns.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">名称 *</Label>
                    <Input value={cronJobForm.name} onChange={(e) => setCronJobForm({ ...cronJobForm, name: e.target.value })} placeholder="my-cronjob" className="col-span-3 bg-slate-800 border-slate-600" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">镜像 *</Label>
                    <Input value={cronJobForm.image} onChange={(e) => setCronJobForm({ ...cronJobForm, image: e.target.value })} placeholder="busybox:latest" className="col-span-3 bg-slate-800 border-slate-600" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">调度规则 *</Label>
                    <Input value={cronJobForm.schedule} onChange={(e) => setCronJobForm({ ...cronJobForm, schedule: e.target.value })} placeholder="*/5 * * * *" className="col-span-3 bg-slate-800 border-slate-600" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-slate-300">暂停</Label>
                    <div className="col-span-3 flex items-center gap-2">
                      <input type="checkbox" checked={cronJobForm.suspend} onChange={(e) => setCronJobForm({ ...cronJobForm, suspend: e.target.checked })} className="h-4 w-4" />
                      <span className="text-slate-400 text-sm">暂停 CronJob 执行</span>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsCreateCronJobOpen(false)} className="text-slate-300">取消</Button>
                  <Button onClick={handleCreateCronJob} className="bg-sky-500 hover:bg-sky-600" disabled={createCronJob.isPending}>
                    {createCronJob.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}创建
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-900 border border-slate-700 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="pods" className="gap-2 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
            <Container className="h-4 w-4" />
            Pods ({filteredPods.length})
          </TabsTrigger>
          <TabsTrigger value="deployments" className="gap-2 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
            <Boxes className="h-4 w-4" />
            Deployments ({filteredDeployments.length})
          </TabsTrigger>
          <TabsTrigger value="statefulsets" className="gap-2 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
            <Layers className="h-4 w-4" />
            StatefulSets ({filteredStatefulSets.length})
          </TabsTrigger>
          <TabsTrigger value="daemonsets" className="gap-2 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
            <Layers className="h-4 w-4" />
            DaemonSets ({filteredDaemonSets.length})
          </TabsTrigger>
          <TabsTrigger value="jobs" className="gap-2 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
            <Clock className="h-4 w-4" />
            Jobs ({filteredJobs.length})
          </TabsTrigger>
          <TabsTrigger value="cronjobs" className="gap-2 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
            <Calendar className="h-4 w-4" />
            CronJobs ({filteredCronJobs.length})
          </TabsTrigger>
        </TabsList>

        {/* Pods Tab */}
        <TabsContent value="pods" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input placeholder="搜索 Pod..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 bg-slate-900 border-slate-700" />
            </div>
          </div>
          <div className="glass-card overflow-hidden">
            {filteredPods.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-medium">名称</th>
                    <th className="px-6 py-4 font-medium">命名空间</th>
                    <th className="px-6 py-4 font-medium">状态</th>
                    <th className="px-6 py-4 font-medium">就绪</th>
                    <th className="px-6 py-4 font-medium">重启</th>
                    <th className="px-6 py-4 font-medium">IP 地址</th>
                    <th className="px-6 py-4 font-medium">节点</th>
                    <th className="px-6 py-4 font-medium">运行时长</th>
                    <th className="px-6 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredPods.map((pod) => (
                    <tr key={`${pod.namespace}-${pod.name}`} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-sky-400">{pod.name}</td>
                      <td className="px-6 py-4"><span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{pod.namespace}</span></td>
                      <td className="px-6 py-4">{getStatusBadge(pod.status)}</td>
                      <td className="px-6 py-4"><span className={pod.readyContainers === pod.containers ? "text-emerald-400" : "text-amber-400"}>{pod.readyContainers}/{pod.containers}</span></td>
                      <td className="px-6 py-4"><span className={pod.restarts > 10 ? "text-rose-400 font-bold" : ""}>{pod.restarts}</span></td>
                      <td className="px-6 py-4 text-slate-400 font-mono text-xs">{pod.podIP || "-"}</td>
                      <td className="px-6 py-4 text-slate-400 text-xs">{pod.nodeName || "-"}</td>
                      <td className="px-6 py-4 text-slate-500">{formatAge(pod.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button title="详情" onClick={() => handleViewDetail('pod', pod.namespace, pod.name)} className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"><Info className="h-4 w-4" /></button>
                          <button title="编辑 YAML" onClick={() => handleOpenYaml(pod.namespace, pod.name)} className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"><Code className="h-4 w-4" /></button>
                          <button title="日志" onClick={() => handleViewLogs(pod.namespace, pod.name)} className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"><FileText className="h-4 w-4" /></button>
                          <button title="终端" onClick={() => handleOpenTerminal(pod.namespace, pod.name)} className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"><Terminal className="h-4 w-4" /></button>
                          <button title="删除" onClick={() => handleDeletePod(pod.namespace, pod.name)} className="p-1.5 hover:bg-rose-500/20 text-rose-500 rounded transition-colors"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center">
                <Container className="h-12 w-12 mx-auto text-slate-600 mb-4" />
                <p className="text-slate-400 text-sm">{podsError ? "无法加载 Pod 数据，请检查集群连接" : "当前命名空间没有 Pod"}</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Deployments Tab */}
        <TabsContent value="deployments" className="space-y-4">
          <div className="glass-card overflow-hidden">
            {filteredDeployments.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-medium">名称</th>
                    <th className="px-6 py-4 font-medium">命名空间</th>
                    <th className="px-6 py-4 font-medium">READY</th>
                    <th className="px-6 py-4 font-medium">UP-TO-DATE</th>
                    <th className="px-6 py-4 font-medium">AVAILABLE</th>
                    <th className="px-6 py-4 font-medium">策略</th>
                    <th className="px-6 py-4 font-medium">存活时间</th>
                    <th className="px-6 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredDeployments.map((deploy) => (
                    <tr key={`${deploy.namespace}-${deploy.name}`} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-sky-400">{deploy.name}</td>
                      <td className="px-6 py-4"><span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{deploy.namespace}</span></td>
                      <td className="px-6 py-4"><span className={deploy.readyReplicas === deploy.replicas ? "text-emerald-400" : "text-amber-400"}>{deploy.readyReplicas}/{deploy.replicas}</span></td>
                      <td className="px-6 py-4"><span className="text-slate-300">{deploy.updatedReplicas}</span></td>
                      <td className="px-6 py-4"><span className={deploy.availableReplicas === deploy.replicas ? "text-emerald-400" : "text-amber-400"}>{deploy.availableReplicas}</span></td>
                      <td className="px-6 py-4 text-slate-400 text-xs">{deploy.strategy}</td>
                      <td className="px-6 py-4 text-slate-500">{formatAge(deploy.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-slate-400"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                            <DropdownMenuLabel className="text-slate-400">操作</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-slate-700" />
                            <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800" onClick={() => handleRestartDeployment(deploy.namespace, deploy.name)}><RefreshCw className="h-4 w-4 mr-2" />重启</DropdownMenuItem>
                            <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800" onClick={() => handleScaleDeployment(deploy.namespace, deploy.name, deploy.replicas)}><Edit className="h-4 w-4 mr-2" />扩缩容</DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-700" />
                            <DropdownMenuItem className="text-rose-500 focus:bg-rose-500/10" onClick={() => handleDeleteDeployment(deploy.namespace, deploy.name)}><Trash2 className="h-4 w-4 mr-2" />删除</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center"><Boxes className="h-12 w-12 mx-auto text-slate-600 mb-4" /><p className="text-slate-400 text-sm">当前命名空间没有 Deployment</p></div>
            )}
          </div>
        </TabsContent>

        {/* StatefulSets Tab */}
        <TabsContent value="statefulsets" className="space-y-4">
          <div className="glass-card overflow-hidden">
            {filteredStatefulSets.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-medium">名称</th>
                    <th className="px-6 py-4 font-medium">命名空间</th>
                    <th className="px-6 py-4 font-medium">副本</th>
                    <th className="px-6 py-4 font-medium">服务名</th>
                    <th className="px-6 py-4 font-medium">存活时间</th>
                    <th className="px-6 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredStatefulSets.map((sts) => (
                    <tr key={`${sts.namespace}-${sts.name}`} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-sky-400">{sts.name}</td>
                      <td className="px-6 py-4"><span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{sts.namespace}</span></td>
                      <td className="px-6 py-4"><span className={sts.readyReplicas === sts.replicas ? "text-emerald-400" : "text-amber-400"}>{sts.readyReplicas}/{sts.replicas}</span></td>
                      <td className="px-6 py-4 text-slate-400 text-xs">{sts.serviceName || "-"}</td>
                      <td className="px-6 py-4 text-slate-500">{formatAge(sts.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-slate-400"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                            <DropdownMenuLabel className="text-slate-400">操作</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-slate-700" />
                            <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800" onClick={() => handleViewDetail('statefulset', sts.namespace, sts.name)}><Info className="h-4 w-4 mr-2" />详情</DropdownMenuItem>
                            <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800" onClick={() => handleRestartStatefulSet(sts.namespace, sts.name)}><RefreshCw className="h-4 w-4 mr-2" />重启</DropdownMenuItem>
                            <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800" onClick={() => handleScaleStatefulSet(sts.namespace, sts.name, sts.replicas)}><Edit className="h-4 w-4 mr-2" />扩缩容</DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-700" />
                            <DropdownMenuItem className="text-rose-500 focus:bg-rose-500/10" onClick={() => handleDeleteStatefulSet(sts.namespace, sts.name)}><Trash2 className="h-4 w-4 mr-2" />删除</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center"><Layers className="h-12 w-12 mx-auto text-slate-600 mb-4" /><p className="text-slate-400 text-sm">当前命名空间没有 StatefulSet</p></div>
            )}
          </div>
        </TabsContent>

        {/* DaemonSets Tab */}
        <TabsContent value="daemonsets" className="space-y-4">
          <div className="glass-card overflow-hidden">
            {filteredDaemonSets.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-medium">名称</th>
                    <th className="px-6 py-4 font-medium">命名空间</th>
                    <th className="px-6 py-4 font-medium">节点数</th>
                    <th className="px-6 py-4 font-medium">就绪</th>
                    <th className="px-6 py-4 font-medium">存活时间</th>
                    <th className="px-6 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredDaemonSets.map((ds) => (
                    <tr key={`${ds.namespace}-${ds.name}`} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-sky-400">{ds.name}</td>
                      <td className="px-6 py-4"><span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{ds.namespace}</span></td>
                      <td className="px-6 py-4 text-slate-300">{ds.currentNodes}/{ds.desiredNodes}</td>
                      <td className="px-6 py-4"><span className={ds.readyNodes === ds.desiredNodes ? "text-emerald-400" : "text-amber-400"}>{ds.readyNodes}</span></td>
                      <td className="px-6 py-4 text-slate-500">{formatAge(ds.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-slate-400"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                            <DropdownMenuLabel className="text-slate-400">操作</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-slate-700" />
                            <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800" onClick={() => handleViewDetail('daemonset', ds.namespace, ds.name)}><Info className="h-4 w-4 mr-2" />详情</DropdownMenuItem>
                            <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800" onClick={() => handleRestartDaemonSet(ds.namespace, ds.name)}><RefreshCw className="h-4 w-4 mr-2" />重启</DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-700" />
                            <DropdownMenuItem className="text-rose-500 focus:bg-rose-500/10" onClick={() => handleDeleteDaemonSet(ds.namespace, ds.name)}><Trash2 className="h-4 w-4 mr-2" />删除</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center"><Layers className="h-12 w-12 mx-auto text-slate-600 mb-4" /><p className="text-slate-400 text-sm">当前命名空间没有 DaemonSet</p></div>
            )}
          </div>
        </TabsContent>

        {/* Jobs Tab */}
        <TabsContent value="jobs" className="space-y-4">
          <div className="glass-card overflow-hidden">
            {filteredJobs.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-medium">名称</th>
                    <th className="px-6 py-4 font-medium">命名空间</th>
                    <th className="px-6 py-4 font-medium">完成数</th>
                    <th className="px-6 py-4 font-medium">并行度</th>
                    <th className="px-6 py-4 font-medium">状态</th>
                    <th className="px-6 py-4 font-medium">存活时间</th>
                    <th className="px-6 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredJobs.map((job) => (
                    <tr key={`${job.namespace}-${job.name}`} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-sky-400">{job.name}</td>
                      <td className="px-6 py-4"><span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{job.namespace}</span></td>
                      <td className="px-6 py-4 text-slate-300">{job.succeeded}/{job.completions}</td>
                      <td className="px-6 py-4 text-slate-300">{job.parallelism}</td>
                      <td className="px-6 py-4">{getStatusBadge(job.status)}</td>
                      <td className="px-6 py-4 text-slate-500">{formatAge(job.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-slate-400"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                            <DropdownMenuLabel className="text-slate-400">操作</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-slate-700" />
                            <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800" onClick={() => handleViewDetail('job', job.namespace, job.name)}><Info className="h-4 w-4 mr-2" />详情</DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-700" />
                            <DropdownMenuItem className="text-rose-500 focus:bg-rose-500/10" onClick={() => handleDeleteJob(job.namespace, job.name)}><Trash2 className="h-4 w-4 mr-2" />删除</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center"><Clock className="h-12 w-12 mx-auto text-slate-600 mb-4" /><p className="text-slate-400 text-sm">当前命名空间没有 Job</p></div>
            )}
          </div>
        </TabsContent>

        {/* CronJobs Tab */}
        <TabsContent value="cronjobs" className="space-y-4">
          <div className="glass-card overflow-hidden">
            {filteredCronJobs.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-medium">名称</th>
                    <th className="px-6 py-4 font-medium">命名空间</th>
                    <th className="px-6 py-4 font-medium">调度</th>
                    <th className="px-6 py-4 font-medium">状态</th>
                    <th className="px-6 py-4 font-medium">活跃 Job</th>
                    <th className="px-6 py-4 font-medium">存活时间</th>
                    <th className="px-6 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredCronJobs.map((cj) => (
                    <tr key={`${cj.namespace}-${cj.name}`} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-sky-400">{cj.name}</td>
                      <td className="px-6 py-4"><span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">{cj.namespace}</span></td>
                      <td className="px-6 py-4 font-mono text-amber-400">{cj.schedule}</td>
                      <td className="px-6 py-4">
                        {cj.suspend ? (
                          <Badge variant="outline" className="text-amber-400 border-amber-400">已暂停</Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-400 border-emerald-400">运行中</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-300">{cj.activeJobs}</td>
                      <td className="px-6 py-4 text-slate-500">{formatAge(cj.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-slate-400"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                            <DropdownMenuLabel className="text-slate-400">操作</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-slate-700" />
                            <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800" onClick={() => handleViewDetail('cronjob', cj.namespace, cj.name)}><Info className="h-4 w-4 mr-2" />详情</DropdownMenuItem>
                            <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800" onClick={() => handleSuspendCronJob(cj.namespace, cj.name, cj.suspend)}>
                              {cj.suspend ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}{cj.suspend ? "恢复" : "暂停"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-slate-300 hover:text-white focus:bg-slate-800" onClick={() => handleTriggerCronJob(cj.namespace, cj.name)}><Play className="h-4 w-4 mr-2" />手动触发</DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-700" />
                            <DropdownMenuItem className="text-rose-500 focus:bg-rose-500/10" onClick={() => handleDeleteCronJob(cj.namespace, cj.name)}><Trash2 className="h-4 w-4 mr-2" />删除</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center"><Calendar className="h-12 w-12 mx-auto text-slate-600 mb-4" /><p className="text-slate-400 text-sm">当前命名空间没有 CronJob</p></div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Log Dialog */}
      <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}>
        <DialogContent className="max-w-4xl h-[600px] bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <FileText className="h-5 w-5 text-sky-400" />
              Pod 日志 - {selectedPod?.name}
            </DialogTitle>
            <DialogDescription className="text-slate-400">命名空间: {selectedPod?.namespace}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 bg-slate-950 rounded-lg p-4 font-mono text-sm text-green-400 overflow-auto h-[480px]">
            {selectedPod && <PodLogContent namespace={selectedPod.namespace} name={selectedPod.name} />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Terminal Dialog */}
      <Dialog open={isTerminalOpen} onOpenChange={setIsTerminalOpen}>
        <DialogContent className="max-w-5xl h-[600px] bg-[#0a0a0f] border-slate-700 p-0 overflow-hidden" showCloseButton={false}>
          {selectedPod && <PodTerminal namespace={selectedPod.namespace} podName={selectedPod.name} onClose={() => setIsTerminalOpen(false)} />}
        </DialogContent>
      </Dialog>

      {/* YAML Edit Dialog */}
      <Dialog open={isYamlOpen} onOpenChange={setIsYamlOpen}>
        <DialogContent className="max-w-5xl h-[700px] bg-slate-900 border-slate-700 flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Code className="h-5 w-5 text-sky-400" />
              编辑 Pod YAML - {selectedPod?.name}
            </DialogTitle>
            <DialogDescription className="text-slate-400">命名空间: {selectedPod?.namespace}</DialogDescription>
          </DialogHeader>
          {selectedPod && <PodYamlEditor namespace={selectedPod.namespace} name={selectedPod.name} onClose={() => setIsYamlOpen(false)} />}
        </DialogContent>
      </Dialog>

      {/* Pod Detail Dialog */}
      <Dialog open={isPodDetailOpen} onOpenChange={setIsPodDetailOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Container className="h-5 w-5 text-sky-400" />
              Pod 详情 - {selectedResource?.name}
            </DialogTitle>
            <DialogDescription className="text-slate-400">命名空间: {selectedResource?.namespace}</DialogDescription>
          </DialogHeader>
          {selectedResource && <PodDetailContent namespace={selectedResource.namespace} name={selectedResource.name} />}
        </DialogContent>
      </Dialog>

      {/* StatefulSet Detail Dialog */}
      <Dialog open={isStatefulSetDetailOpen} onOpenChange={setIsStatefulSetDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">StatefulSet 详情 - {selectedResource?.name}</DialogTitle>
          </DialogHeader>
          {selectedResource && <StatefulSetDetailContent namespace={selectedResource.namespace} name={selectedResource.name} />}
        </DialogContent>
      </Dialog>

      {/* DaemonSet Detail Dialog */}
      <Dialog open={isDaemonSetDetailOpen} onOpenChange={setIsDaemonSetDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">DaemonSet 详情 - {selectedResource?.name}</DialogTitle>
          </DialogHeader>
          {selectedResource && <DaemonSetDetailContent namespace={selectedResource.namespace} name={selectedResource.name} />}
        </DialogContent>
      </Dialog>

      {/* Job Detail Dialog */}
      <Dialog open={isJobDetailOpen} onOpenChange={setIsJobDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Job 详情 - {selectedResource?.name}</DialogTitle>
          </DialogHeader>
          {selectedResource && <JobDetailContent namespace={selectedResource.namespace} name={selectedResource.name} />}
        </DialogContent>
      </Dialog>

      {/* CronJob Detail Dialog */}
      <Dialog open={isCronJobDetailOpen} onOpenChange={setIsCronJobDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">CronJob 详情 - {selectedResource?.name}</DialogTitle>
          </DialogHeader>
          {selectedResource && <CronJobDetailContent namespace={selectedResource.namespace} name={selectedResource.name} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Pod YAML Editor Component
function PodYamlEditor({ namespace, name, onClose }: { namespace: string; name: string; onClose: () => void }) {
  const { data, isLoading, error } = usePodYaml(namespace, name);
  const updatePodYaml = useUpdatePodYaml();
  const [yamlContent, setYamlContent] = useState("");
  const { toast } = useToast();

  React.useEffect(() => {
    if (data?.yaml) {
      setYamlContent(data.yaml);
    }
  }, [data]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full flex-1"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>;
  }

  if (error) {
    return <div className="text-rose-400 flex items-center justify-center h-full flex-1"><AlertCircle className="h-5 w-5 inline mr-2" />加载 YAML 失败: {error instanceof Error ? error.message : "未知错误"}</div>;
  }

  const handleSave = () => {
    updatePodYaml.mutate(
      { namespace, name, yaml: yamlContent },
      {
        onSuccess: (result: { status: string; message: string }) => {
          toast({ title: result.status === "no_change" ? "无变化" : "更新成功", description: result.message });
          onClose();
        },
        onError: (error: Error) => {
          toast({ title: "更新失败", description: error.message, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-auto mb-4">
        <Textarea value={yamlContent} onChange={(e) => setYamlContent(e.target.value)} className="h-full min-h-[500px] bg-slate-950 border-slate-700 font-mono text-sm text-slate-300 resize-none" spellCheck={false} />
      </div>
      <div className="text-xs text-slate-500 mb-2">注意：修改 YAML 后保存将删除旧 Pod 并重新创建。由 Deployment/StatefulSet 等控制器管理的 Pod 无法直接修改。</div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} className="text-slate-300">取消</Button>
        <Button onClick={handleSave} className="bg-sky-500 hover:bg-sky-600" disabled={updatePodYaml.isPending}>
          {updatePodYaml.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}保存
        </Button>
      </DialogFooter>
    </div>
  );
}

// Pod Log Content Component
function PodLogContent({ namespace, name }: { namespace: string; name: string }) {
  const { data, isLoading, error } = usePodLogs(namespace, name, "", 200);
  
  if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>;
  if (error) return <div className="text-rose-400"><AlertCircle className="h-5 w-5 inline mr-2" />加载日志失败: {error instanceof Error ? error.message : "未知错误"}</div>;
  
  const logs = data?.logs || "";
  if (!logs) return <span className="text-slate-500">暂无日志</span>;
  
  return (
    <pre className="whitespace-pre-wrap break-all">
      {logs.split('\n').map((line, i) => (
        <div key={i} className="hover:bg-slate-900/50 px-1">{line}</div>
      ))}
    </pre>
  );
}

// Detail Content Components
function PodDetailContent({ namespace, name }: { namespace: string; name: string }) {
  const { data, isLoading, error } = usePodDetail(namespace, name);

  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>;
  if (error) return <div className="text-rose-400 p-4"><AlertCircle className="h-5 w-5 inline mr-2" />加载失败: {error instanceof Error ? error.message : "未知错误"}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6 text-sm">
      {/* Basic Info */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs mb-1">状态</p>
          <div className="flex items-center gap-2">
            {getStatusBadge(data.status)}
            <span className="text-slate-500 text-xs">({data.phase})</span>
          </div>
          {data.statusReason && (
            <p className="text-amber-400 text-xs mt-1">原因: {data.statusReason}</p>
          )}
        </div>
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs mb-1">Pod IP</p>
          <p className="text-white font-mono">{data.podIP || "-"}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-slate-400 text-xs mb-1">节点</p>
          <p className="text-white font-mono text-xs">{data.nodeName || "-"}</p>
        </div>
      </div>

      {/* Additional Info */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <p className="text-slate-400 text-xs">重启策略</p>
          <p className="text-white">{data.restartPolicy || "-"}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">QoS 类</p>
          <p className="text-white">{data.qosClass || "-"}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">主机 IP</p>
          <p className="text-white font-mono text-xs">{data.hostIP || "-"}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">静态 Pod</p>
          <p className="text-white">{data.isStaticPod ? "是" : "否"}</p>
        </div>
      </div>

      {/* Containers */}
      <div>
        <h4 className="text-slate-300 font-medium mb-3 flex items-center gap-2">
          <Container className="h-4 w-4 text-sky-400" />
          容器状态 ({data.containers?.length || 0})
        </h4>
        <div className="space-y-3">
          {data.containers?.map((container, idx) => (
            <div key={idx} className="glass-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sky-400">{container.name}</span>
                  {container.ready ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">就绪</Badge>
                  ) : (
                    <Badge className="bg-amber-500/20 text-amber-400 border-0 text-xs">未就绪</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {container.restartCount > 0 && (
                    <span className="text-amber-400 text-xs">重启: {container.restartCount}</span>
                  )}
                  <span className={`w-2 h-2 rounded-full ${
                    container.state === 'Running' ? 'bg-emerald-500' :
                    container.state === 'Waiting' ? 'bg-amber-500' :
                    container.state === 'Terminated' ? 'bg-rose-500' : 'bg-slate-500'
                  } status-pulse`} />
                </div>
              </div>
              <p className="text-slate-400 text-xs mb-2">{container.image}</p>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500">状态: </span>
                  <span className={
                    container.state === 'Running' ? 'text-emerald-400' :
                    container.state === 'Waiting' ? 'text-amber-400' :
                    container.state === 'Terminated' ? 'text-rose-400' : 'text-slate-400'
                  }>{container.state}</span>
                  {container.stateReason && <span className="text-slate-400"> ({container.stateReason})</span>}
                </div>
                {container.stateMessage && (
                  <div className="col-span-2 text-amber-400">
                    消息: {container.stateMessage}
                  </div>
                )}
                {container.state === 'Running' && container.startedAt && (
                  <div>
                    <span className="text-slate-500">启动时间: </span>
                    <span className="text-slate-300">{container.startedAt}</span>
                  </div>
                )}
                {container.state === 'Terminated' && (
                  <>
                    {container.exitCode !== undefined && (
                      <div>
                        <span className="text-slate-500">退出码: </span>
                        <span className={container.exitCode === 0 ? 'text-emerald-400' : 'text-rose-400'}>{container.exitCode}</span>
                      </div>
                    )}
                    {container.finishedAt && (
                      <div>
                        <span className="text-slate-500">完成时间: </span>
                        <span className="text-slate-300">{container.finishedAt}</span>
                      </div>
                    )}
                  </>
                )}
                {container.lastExitCode !== undefined && container.lastExitCode > 0 && (
                  <div>
                    <span className="text-slate-500">上次退出码: </span>
                    <span className="text-rose-400">{container.lastExitCode}</span>
                    {container.lastExitReason && <span className="text-slate-400"> ({container.lastExitReason})</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Init Containers */}
      {data.initContainers && data.initContainers.length > 0 && (
        <div>
          <h4 className="text-slate-300 font-medium mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-amber-400" />
            Init 容器 ({data.initContainers.length})
          </h4>
          <div className="space-y-3">
            {data.initContainers.map((container, idx) => (
              <div key={idx} className="glass-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-amber-400">{container.name}</span>
                  <span className={`w-2 h-2 rounded-full ${
                    container.state === 'Running' ? 'bg-emerald-500' :
                    container.state === 'Waiting' ? 'bg-amber-500' :
                    container.state === 'Terminated' ? 'bg-rose-500' : 'bg-slate-500'
                  } status-pulse`} />
                </div>
                <p className="text-slate-400 text-xs">{container.image}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conditions */}
      {data.conditions && data.conditions.length > 0 && (
        <div>
          <h4 className="text-slate-300 font-medium mb-3">条件状态</h4>
          <div className="glass-card overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-4 py-2 text-left text-slate-500">类型</th>
                  <th className="px-4 py-2 text-left text-slate-500">状态</th>
                  <th className="px-4 py-2 text-left text-slate-500">原因</th>
                  <th className="px-4 py-2 text-left text-slate-500">消息</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.conditions.map((condition, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-slate-300">{condition.type}</td>
                    <td className="px-4 py-2">
                      <span className={condition.status === 'True' ? 'text-emerald-400' : 'text-amber-400'}>
                        {condition.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-400">{condition.reason || '-'}</td>
                    <td className="px-4 py-2 text-slate-500 max-w-xs truncate">{condition.message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Events */}
      {data.events && data.events.length > 0 && (
        <div>
          <h4 className="text-slate-300 font-medium mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-sky-400" />
            事件日志 ({data.events.length})
          </h4>
          <div className="glass-card overflow-hidden max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-900/50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-slate-500">类型</th>
                  <th className="px-4 py-2 text-left text-slate-500">原因</th>
                  <th className="px-4 py-2 text-left text-slate-500">消息</th>
                  <th className="px-4 py-2 text-left text-slate-500">次数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.events.map((event, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2">
                      <span className={event.type === 'Normal' ? 'text-sky-400' : 'text-amber-400'}>
                        {event.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-300">{event.reason}</td>
                    <td className="px-4 py-2 text-slate-400 max-w-md truncate">{event.message}</td>
                    <td className="px-4 py-2 text-slate-500">{event.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Labels */}
      {data.labels && Object.keys(data.labels).length > 0 && (
        <div>
          <h4 className="text-slate-300 font-medium mb-3">标签</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.labels).map(([key, value]) => (
              <Badge key={key} variant="outline" className="text-xs text-slate-300">{key}={value}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatefulSetDetailContent({ namespace, name }: { namespace: string; name: string }) {
  const { data, isLoading, error } = useStatefulSetDetail(namespace, name);
  
  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>;
  if (error) return <div className="text-rose-400 p-4"><AlertCircle className="h-5 w-5 inline mr-2" />加载失败: {error instanceof Error ? error.message : "未知错误"}</div>;
  
  return <ResourceDetail data={data} type="statefulset" />;
}

function DaemonSetDetailContent({ namespace, name }: { namespace: string; name: string }) {
  const { data, isLoading, error } = useDaemonSetDetail(namespace, name);
  
  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>;
  if (error) return <div className="text-rose-400 p-4"><AlertCircle className="h-5 w-5 inline mr-2" />加载失败: {error instanceof Error ? error.message : "未知错误"}</div>;
  
  return <ResourceDetail data={data} type="daemonset" />;
}

function JobDetailContent({ namespace, name }: { namespace: string; name: string }) {
  const { data, isLoading, error } = useJobDetail(namespace, name);
  
  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>;
  if (error) return <div className="text-rose-400 p-4"><AlertCircle className="h-5 w-5 inline mr-2" />加载失败: {error instanceof Error ? error.message : "未知错误"}</div>;
  
  return <ResourceDetail data={data} type="job" />;
}

function CronJobDetailContent({ namespace, name }: { namespace: string; name: string }) {
  const { data, isLoading, error } = useCronJobDetail(namespace, name);
  
  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>;
  if (error) return <div className="text-rose-400 p-4"><AlertCircle className="h-5 w-5 inline mr-2" />加载失败: {error instanceof Error ? error.message : "未知错误"}</div>;
  
  return <ResourceDetail data={data} type="cronjob" />;
}

// Generic Resource Detail Component
function ResourceDetail({ data, type }: { data: StatefulSetDetail | DaemonSetDetail | JobDetail | CronJobDetail | null; type: string }) {
  if (!data) return null;
  
  return (
    <div className="space-y-4 text-sm">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-slate-400">名称</Label>
          <p className="text-white font-mono">{data.name}</p>
        </div>
        <div>
          <Label className="text-slate-400">命名空间</Label>
          <p className="text-white">{data.namespace}</p>
        </div>
      </div>
      
      {/* Type-specific info */}
      {type === 'statefulset' && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label className="text-slate-400">副本数</Label>
              <p className="text-white">{(data as StatefulSetDetail).replicas}</p>
            </div>
            <div>
              <Label className="text-slate-400">就绪</Label>
              <p className="text-emerald-400">{(data as StatefulSetDetail).readyReplicas}</p>
            </div>
            <div>
              <Label className="text-slate-400">服务名</Label>
              <p className="text-white">{(data as StatefulSetDetail).serviceName || "-"}</p>
            </div>
            <div>
              <Label className="text-slate-400">更新策略</Label>
              <p className="text-white">{(data as StatefulSetDetail).updateStrategy}</p>
            </div>
          </div>
        </>
      )}
      
      {type === 'daemonset' && (
        <div className="grid grid-cols-4 gap-4">
          <div>
            <Label className="text-slate-400">期望节点</Label>
            <p className="text-white">{(data as DaemonSetDetail).desiredNodes}</p>
          </div>
          <div>
            <Label className="text-slate-400">当前节点</Label>
            <p className="text-white">{(data as DaemonSetDetail).currentNodes}</p>
          </div>
          <div>
            <Label className="text-slate-400">就绪节点</Label>
            <p className="text-emerald-400">{(data as DaemonSetDetail).readyNodes}</p>
          </div>
          <div>
            <Label className="text-slate-400">更新策略</Label>
            <p className="text-white">{(data as DaemonSetDetail).updateStrategy}</p>
          </div>
        </div>
      )}
      
      {type === 'job' && (
        <div className="grid grid-cols-4 gap-4">
          <div>
            <Label className="text-slate-400">完成数</Label>
            <p className="text-white">{(data as JobDetail).succeeded}/{(data as JobDetail).completions}</p>
          </div>
          <div>
            <Label className="text-slate-400">并行度</Label>
            <p className="text-white">{(data as JobDetail).parallelism}</p>
          </div>
          <div>
            <Label className="text-slate-400">状态</Label>
            <p className="text-white">{(data as JobDetail).status}</p>
          </div>
          <div>
            <Label className="text-slate-400">重试限制</Label>
            <p className="text-white">{(data as JobDetail).backoffLimit}</p>
          </div>
        </div>
      )}
      
      {type === 'cronjob' && (
        <div className="grid grid-cols-4 gap-4">
          <div>
            <Label className="text-slate-400">调度</Label>
            <p className="text-amber-400 font-mono">{(data as CronJobDetail).schedule}</p>
          </div>
          <div>
            <Label className="text-slate-400">状态</Label>
            <p className="text-white">{(data as CronJobDetail).suspend ? "已暂停" : "运行中"}</p>
          </div>
          <div>
            <Label className="text-slate-400">并发策略</Label>
            <p className="text-white">{(data as CronJobDetail).concurrencyPolicy}</p>
          </div>
          <div>
            <Label className="text-slate-400">活跃 Job</Label>
            <p className="text-white">{(data as CronJobDetail).activeJobs}</p>
          </div>
        </div>
      )}
      
      {/* Containers */}
      {data.containers && data.containers.length > 0 && (
        <div>
          <Label className="text-slate-400">容器</Label>
          <div className="mt-2 space-y-2">
            {data.containers.map((container, idx) => (
              <div key={idx} className="bg-slate-800 p-3 rounded-lg">
                <p className="font-mono text-sky-400">{container.name}</p>
                <p className="text-slate-400 text-xs">{container.image}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Labels */}
      {data.labels && Object.keys(data.labels).length > 0 && (
        <div>
          <Label className="text-slate-400">标签</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(data.labels).map(([key, value]) => (
              <Badge key={key} variant="outline" className="text-xs">{key}={value}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
