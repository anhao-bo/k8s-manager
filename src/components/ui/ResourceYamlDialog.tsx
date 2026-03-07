"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Code,
  AlertCircle,
  Save,
  Copy,
  Download,
  Check,
} from "lucide-react";
import { useResourceYaml, useUpdateResourceYaml } from "@/hooks/use-k8s";
import { useToast } from "@/hooks/use-toast";

interface ResourceYamlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: string; // deployments, statefulsets, daemonsets, jobs, cronjobs, etc.
  namespace: string;
  name: string;
  detailData?: Record<string, unknown>; // 可选的详情数据
  detailComponent?: React.ReactNode; // 可选的详情组件
}

// 资源类型中文名称映射
const resourceTypeNames: Record<string, string> = {
  deployments: "Deployment",
  statefulsets: "StatefulSet",
  daemonsets: "DaemonSet",
  jobs: "Job",
  cronjobs: "CronJob",
  replicasets: "ReplicaSet",
  hpas: "HPA",
  services: "Service",
  ingresses: "Ingress",
  configmaps: "ConfigMap",
  secrets: "Secret",
  pvs: "PV",
  pvcs: "PVC",
};

export function ResourceYamlDialog({
  open,
  onOpenChange,
  resourceType,
  namespace,
  name,
  detailComponent,
}: ResourceYamlDialogProps) {
  const [editedYaml, setEditedYaml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("yaml");

  const { toast } = useToast();

  // 获取 YAML
  const { data, isLoading, error, refetch } = useResourceYaml(
    resourceType,
    namespace,
    name
  );

  // 更新 YAML
  const updateYaml = useUpdateResourceYaml(resourceType);

  // 使用 useMemo 来计算当前的 YAML 内容
  const yamlContent = useMemo(() => {
    return editedYaml ?? data?.yaml ?? "";
  }, [editedYaml, data?.yaml]);

  // 当对话框关闭时重置编辑状态
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setEditedYaml(null);
      setCopied(false);
      setActiveTab("yaml");
    }
    onOpenChange(newOpen);
  }, [onOpenChange]);

  // 保存 YAML
  const handleSave = useCallback(() => {
    updateYaml.mutate(
      { namespace, name, yaml: yamlContent },
      {
        onSuccess: (result: { status?: string; message?: string }) => {
          toast({
            title: "保存成功",
            description: result.message || `${resourceTypeNames[resourceType] || resourceType} ${name} 已更新`,
          });
          handleOpenChange(false);
        },
        onError: (error: Error) => {
          toast({
            title: "保存失败",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  }, [updateYaml, namespace, name, yamlContent, resourceType, toast, handleOpenChange]);

  // 复制 YAML
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(yamlContent);
      setCopied(true);
      toast({ title: "已复制", description: "YAML 内容已复制到剪贴板" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "复制失败", variant: "destructive" });
    }
  }, [yamlContent, toast]);

  // 下载 YAML
  const handleDownload = useCallback(() => {
    const blob = new Blob([yamlContent], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "下载成功", description: `${name}.yaml 已下载` });
  }, [yamlContent, name, toast]);

  const resourceTypeName = resourceTypeNames[resourceType] || resourceType;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl h-[700px] bg-slate-900 border-slate-700 flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Code className="h-5 w-5 text-sky-400" />
            {resourceTypeName} - {name}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            命名空间: {namespace}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="yaml" className="data-[state=active]:bg-sky-500">
              <Code className="h-4 w-4 mr-2" />
              YAML
            </TabsTrigger>
            {detailComponent && (
              <TabsTrigger value="detail" className="data-[state=active]:bg-sky-500">
                详情
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="yaml" className="flex-1 overflow-hidden mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full text-rose-400">
                <AlertCircle className="h-5 w-5 mr-2" />
                加载 YAML 失败: {error instanceof Error ? error.message : "未知错误"}
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* 工具栏 */}
                <div className="flex items-center gap-2 mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="text-slate-400 hover:text-white"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-1 text-emerald-400" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        复制
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownload}
                    className="text-slate-400 hover:text-white"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    下载
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditedYaml(null);
                      refetch();
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <Loader2 className="h-4 w-4 mr-1" />
                    刷新
                  </Button>
                </div>

                {/* YAML 编辑器 */}
                <Textarea
                  value={yamlContent}
                  onChange={(e) => setEditedYaml(e.target.value)}
                  className="flex-1 min-h-[450px] bg-slate-950 border-slate-700 font-mono text-sm text-slate-300 resize-none"
                  spellCheck={false}
                />

                {/* 提示信息 */}
                <div className="text-xs text-slate-500 mt-2">
                  注意：修改 YAML 后保存将更新资源配置。部分字段可能无法修改。
                </div>
              </div>
            )}
          </TabsContent>

          {detailComponent && (
            <TabsContent value="detail" className="flex-1 overflow-auto mt-4">
              {detailComponent}
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            className="text-slate-300"
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            className="bg-sky-500 hover:bg-sky-600"
            disabled={isLoading || updateYaml.isPending}
          >
            {updateYaml.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 资源详情展示组件
interface ResourceDetailProps {
  data: Record<string, unknown>;
}

export function ResourceDetail({ data }: ResourceDetailProps) {
  if (!data) return null;

  return (
    <div className="space-y-4">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="grid grid-cols-3 gap-2">
          <div className="text-slate-400 text-sm">{key}</div>
          <div className="col-span-2 text-white text-sm">
            {typeof value === "object" ? (
              <pre className="text-xs bg-slate-800 p-2 rounded overflow-auto">
                {JSON.stringify(value, null, 2)}
              </pre>
            ) : (
              String(value)
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ResourceYamlDialog;
