"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Save, RotateCcw, Download, Copy, Check, AlertTriangle } from "lucide-react";
import { useResourceYaml, useUpdateResourceYaml } from "@/hooks/use-k8s";
import { useToast } from "@/hooks/use-toast";

interface ResourceYamlEditorProps {
  kind: string;
  namespace: string;
  name: string;
  onClose?: () => void;
}

// 资源类型到 apiVersion 的映射
const kindToApiVersion: Record<string, { apiVersion: string; kind: string }> = {
  pod: { apiVersion: "v1", kind: "Pod" },
  pods: { apiVersion: "v1", kind: "Pod" },
  deployment: { apiVersion: "apps/v1", kind: "Deployment" },
  deployments: { apiVersion: "apps/v1", kind: "Deployment" },
  statefulset: { apiVersion: "apps/v1", kind: "StatefulSet" },
  statefulsets: { apiVersion: "apps/v1", kind: "StatefulSet" },
  daemonset: { apiVersion: "apps/v1", kind: "DaemonSet" },
  daemonsets: { apiVersion: "apps/v1", kind: "DaemonSet" },
  service: { apiVersion: "v1", kind: "Service" },
  services: { apiVersion: "v1", kind: "Service" },
  configmap: { apiVersion: "v1", kind: "ConfigMap" },
  configmaps: { apiVersion: "v1", kind: "ConfigMap" },
  secret: { apiVersion: "v1", kind: "Secret" },
  secrets: { apiVersion: "v1", kind: "Secret" },
  namespace: { apiVersion: "v1", kind: "Namespace" },
  namespaces: { apiVersion: "v1", kind: "Namespace" },
  job: { apiVersion: "batch/v1", kind: "Job" },
  jobs: { apiVersion: "batch/v1", kind: "Job" },
  cronjob: { apiVersion: "batch/v1", kind: "CronJob" },
  cronjobs: { apiVersion: "batch/v1", kind: "CronJob" },
  ingress: { apiVersion: "networking.k8s.io/v1", kind: "Ingress" },
  ingresses: { apiVersion: "networking.k8s.io/v1", kind: "Ingress" },
  persistentvolumeclaim: { apiVersion: "v1", kind: "PersistentVolumeClaim" },
  pvc: { apiVersion: "v1", kind: "PersistentVolumeClaim" },
  pvcs: { apiVersion: "v1", kind: "PersistentVolumeClaim" },
};

// 确保 YAML 包含 apiVersion 和 kind 字段
function ensureYamlHeaders(yaml: string, kind: string): string {
  const kindInfo = kindToApiVersion[kind.toLowerCase()];
  if (!kindInfo) {
    return yaml;
  }

  // 检查是否已经有 apiVersion 字段
  if (yaml.includes("apiVersion:")) {
    return yaml;
  }

  // 添加 apiVersion 和 kind 到 YAML 开头
  return `apiVersion: ${kindInfo.apiVersion}
kind: ${kindInfo.kind}
${yaml}`;
}

// 从 YAML 中移除 apiVersion 和 kind（更新时后端不需要这些）
function stripYamlHeaders(yaml: string): string {
  const lines = yaml.split('\n');
  const filteredLines = lines.filter(line => 
    !line.startsWith('apiVersion:') && !line.startsWith('kind:')
  );
  return filteredLines.join('\n').trimStart();
}

export default function ResourceYamlEditor({ kind, namespace, name, onClose }: ResourceYamlEditorProps) {
  const { data, isLoading, error } = useResourceYaml(kind, namespace, name);
  const updateResourceYaml = useUpdateResourceYaml();
  const { toast } = useToast();
  
  const [yamlContent, setYamlContent] = useState("");
  const [originalYaml, setOriginalYaml] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // 当获取到 YAML 数据时，更新本地状态
  useEffect(() => {
    if (data?.yaml) {
      // 确保 YAML 包含 apiVersion 和 kind 字段
      const fullYaml = ensureYamlHeaders(data.yaml, kind);
      setYamlContent(fullYaml);
      setOriginalYaml(fullYaml);
    }
  }, [data?.yaml, kind]);
  
  // 检测是否有变更
  useEffect(() => {
    setHasChanges(yamlContent !== originalYaml);
  }, [yamlContent, originalYaml]);
  
  // 处理保存
  const handleSave = async () => {
    if (!hasChanges) return;
    
    try {
      // 更新时移除 apiVersion 和 kind，让后端处理
      const yamlToUpdate = stripYamlHeaders(yamlContent);
      
      await updateResourceYaml.mutateAsync({
        kind,
        namespace,
        name,
        yaml: yamlToUpdate,
      });
      
      toast({
        title: "更新成功",
        description: `${kind} ${name} 已更新`,
      });
      
      setOriginalYaml(yamlContent);
      setHasChanges(false);
      
      // 关闭对话框
      if (onClose) {
        setTimeout(() => onClose(), 1000);
      }
    } catch (error) {
      toast({
        title: "更新失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    }
  };
  
  // 处理重置
  const handleReset = () => {
    setYamlContent(originalYaml);
    setHasChanges(false);
  };
  
  // 处理下载
  const handleDownload = () => {
    const blob = new Blob([yamlContent], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // 处理复制
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(yamlContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "复制成功",
        description: "YAML 内容已复制到剪贴板",
      });
    } catch {
      toast({
        title: "复制失败",
        variant: "destructive",
      });
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] text-rose-400">
        <p>加载 YAML 失败</p>
        <p className="text-sm text-slate-500 mt-2">
          {error instanceof Error ? error.message : "未知错误"}
        </p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* 提示信息 */}
      <div className="mb-4 p-3 bg-sky-500/10 border border-sky-500/30 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-sky-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sky-400 font-medium">编辑 {kind} 资源</p>
            <p className="text-sm text-slate-400 mt-1">
              修改 YAML 配置后点击保存按钮更新资源。
            </p>
            <p className="text-sm text-slate-500 mt-2">
              注意: 某些字段（如 metadata.name, metadata.namespace）不可更改。
            </p>
          </div>
        </div>
      </div>
      
      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || updateResourceYaml.isPending}
            className="bg-sky-500/10 border-sky-500/30 text-sky-400 hover:bg-sky-500/20"
          >
            {updateResourceYaml.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            保存
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!hasChanges}
            className="bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            重置
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="text-slate-400 hover:text-white"
          >
            {copied ? (
              <Check className="h-4 w-4 mr-2 text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            复制
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="text-slate-400 hover:text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            下载
          </Button>
        </div>
      </div>
      
      {/* 变更提示 */}
      {hasChanges && (
        <div className="mb-4 p-2 bg-amber-500/10 border border-amber-500/30 rounded text-amber-400 text-sm">
          ⚠️ 您有未保存的更改
        </div>
      )}
      
      {/* YAML 编辑器 */}
      <div className="flex-1 relative">
        <textarea
          value={yamlContent}
          onChange={(e) => setYamlContent(e.target.value)}
          className="w-full h-[400px] bg-slate-950 text-slate-200 font-mono text-sm p-4 rounded-lg border border-slate-700 focus:border-sky-500 focus:outline-none resize-none"
          spellCheck={false}
        />
        <div className="absolute bottom-4 right-4 text-xs text-slate-500">
          行数: {yamlContent.split('\n').length}
        </div>
      </div>
    </div>
  );
}
