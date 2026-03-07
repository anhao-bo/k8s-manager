"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { getK8sServicePort } from "@/lib/api-config";

interface KubeconfigUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadSuccess?: () => void;
}

interface UploadResult {
  success: boolean;
  message?: string;
  error?: string;
  hint?: string;
  filename?: string;
  cluster?: {
    version: string;
    platform: string;
  };
}

export function KubeconfigUpload({
  open,
  onOpenChange,
  onUploadSuccess,
}: KubeconfigUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile) {
      // kubeconfig 文件可以是任意文件名，通常名为 "config"（无扩展名）
      // 也支持 .yaml, .yml, .kubeconfig, .conf 等扩展名
      // 主要验证文件大小和基本格式
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (selectedFile.size > maxSize) {
        setResult({
          success: false,
          error: "文件太大，请上传小于 10MB 的 kubeconfig 文件",
        });
        return;
      }

      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      const port = getK8sServicePort();
      const formData = new FormData();
      formData.append("kubeconfig", file);

      const response = await fetch(`/api/kubeconfig/upload?XTransformPort=${port}`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setResult(data);

      if (data.success && onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error) {
      setResult({
        success: false,
        error: "上传失败，请检查网络连接",
        hint: String(error),
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    onOpenChange(false);
  };

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Upload className="h-5 w-5 text-sky-400" />
            上传 Kubeconfig
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            上传 Kubernetes 配置文件以连接集群
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 拖放区域 */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver
                ? "border-sky-500 bg-sky-500/10"
                : "border-slate-700 hover:border-slate-600"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0];
                if (selectedFile) handleFileSelect(selectedFile);
              }}
            // 不限制文件类型，允许选择任何文件名（包括无扩展名的 config 文件）
            // 后端会验证文件内容是否为有效的 kubeconfig
            />

            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-emerald-400" />
                <div className="text-left">
                  <p className="text-white font-medium">{file.name}</p>
                  <p className="text-slate-400 text-sm">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-white"
                  onClick={() => setFile(null)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div>
                <Upload className="h-10 w-10 mx-auto text-slate-500 mb-3" />
                <p className="text-slate-300 mb-2">
                  拖放 kubeconfig 文件到此处
                </p>
                <p className="text-slate-500 text-sm mb-3">或</p>
                <Button
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:text-white"
                  onClick={handleBrowse}
                >
                  浏览文件
                </Button>
              </div>
            )}
          </div>

          {/* 提示信息 */}
          <div className="text-xs text-slate-500 space-y-1">
            <p>• kubeconfig 文件是 <span className="text-sky-400">YAML 格式</span>的配置文件</p>
            <p>• 文件名通常为 <span className="text-sky-400">config</span>（无扩展名）</p>
            <p>• 标准位置：<code className="text-sky-400">~/.kube/config</code></p>
            <p>• 也支持 <span className="text-sky-400">.yaml, .yml, .kubeconfig</span> 等扩展名</p>
            <p>• 上传后将自动连接集群</p>
          </div>

          {/* 上传结果 */}
          {result && (
            <Alert
              className={
                result.success
                  ? "bg-emerald-500/10 border-emerald-500/50"
                  : "bg-rose-500/10 border-rose-500/50"
              }
            >
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-400" />
              )}
              <AlertDescription
                className={result.success ? "text-emerald-300" : "text-rose-300"}
              >
                {result.success ? (
                  <div className="space-y-2">
                    <p className="font-medium">{result.message}</p>
                    {result.cluster && (
                      <div className="flex gap-2">
                        <Badge variant="outline" className="border-emerald-500/50 text-emerald-300">
                          v{result.cluster.version}
                        </Badge>
                        <Badge variant="outline" className="border-emerald-500/50 text-emerald-300">
                          {result.cluster.platform}
                        </Badge>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="font-medium">{result.error}</p>
                    {result.hint && (
                      <p className="text-xs mt-1 text-rose-400">{result.hint}</p>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={handleClose}
            className="text-slate-300 hover:text-white"
          >
            取消
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="bg-sky-500 hover:bg-sky-600"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                上传中...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                上传并连接
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
