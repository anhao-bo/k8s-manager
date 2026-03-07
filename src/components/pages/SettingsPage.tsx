"use client";

import { useState, useEffect, useRef } from "react";
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
  Settings,
  Palette,
  Image as ImageIcon,
  Upload,
  RefreshCw,
  Check,
  Monitor,
  Moon,
  Sun,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// 预设主题配色方案
const themePresets = [
  {
    id: "sky",
    name: "天蓝科技",
    primary: "#38bdf8",
    secondary: "#0ea5e9",
    accent: "#0284c7",
    description: "清新专业的科技蓝",
  },
  {
    id: "emerald",
    name: "翠绿生机",
    primary: "#34d399",
    secondary: "#10b981",
    accent: "#059669",
    description: "充满活力的绿色",
  },
  {
    id: "purple",
    name: "梦幻紫",
    primary: "#a855f7",
    secondary: "#9333ea",
    accent: "#7c3aed",
    description: "神秘优雅的紫色",
  },
  {
    id: "rose",
    name: "玫瑰红",
    primary: "#fb7185",
    secondary: "#f43f5e",
    accent: "#e11d48",
    description: "热情奔放的红色",
  },
  {
    id: "amber",
    name: "琥珀金",
    primary: "#fbbf24",
    secondary: "#f59e0b",
    accent: "#d97706",
    description: "温暖明亮的金色",
  },
  {
    id: "cyan",
    name: "青色深邃",
    primary: "#22d3ee",
    secondary: "#06b6d4",
    accent: "#0891b2",
    description: "深邃冷静的青色",
  },
];

// 预设 Logo
const presetLogos = [
  { id: "kubenext", name: "KubeNext 默认", url: "/logo.svg" },
  { id: "kubernetes", name: "Kubernetes", url: "https://kubernetes.io/images/kubernetes-logo.svg" },
  { id: "custom", name: "自定义上传", url: "" },
];

interface SystemConfig {
  logoUrl: string;
  logoName: string;
  primaryColor: string;
  themeId: string;
  siteName: string;
  siteDescription: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("appearance");
  const [config, setConfig] = useState<SystemConfig>({
    logoUrl: "/logo.svg",
    logoName: "KubeNext 默认",
    primaryColor: "#38bdf8",
    themeId: "sky",
    siteName: "KubeNext",
    siteDescription: "Kubernetes 集群管理平台",
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showLogoDialog, setShowLogoDialog] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载配置
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await fetch("/api/config?category=theme");
      const data = await res.json();
      if (data.success && data.data) {
        setConfig(prev => ({
          ...prev,
          logoUrl: data.data.logoUrl || "/logo.svg",
          logoName: data.data.logoName || "KubeNext 默认",
          primaryColor: data.data.primaryColor || "#38bdf8",
          themeId: data.data.themeId || "sky",
          siteName: data.data.siteName || "KubeNext",
          siteDescription: data.data.siteDescription || "Kubernetes 集群管理平台",
        }));
      }
    } catch (error) {
      console.error("加载配置失败:", error);
    }
  };

  // 保存配置
  const saveConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configs: [
            { key: "logoUrl", value: config.logoUrl, category: "theme" },
            { key: "logoName", value: config.logoName, category: "theme" },
            { key: "primaryColor", value: config.primaryColor, category: "theme" },
            { key: "themeId", value: config.themeId, category: "theme" },
            { key: "siteName", value: config.siteName, category: "general" },
            { key: "siteDescription", value: config.siteDescription, category: "general" },
          ],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        // 应用主题
        applyTheme(config.primaryColor);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error("保存配置失败:", error);
    } finally {
      setLoading(false);
    }
  };

  // 应用主题颜色
  const applyTheme = (color: string) => {
    document.documentElement.style.setProperty("--color-primary", color);
    // 更新 CSS 变量
    const hsl = hexToHSL(color);
    document.documentElement.style.setProperty("--primary", `${hsl.h} ${hsl.s}% ${hsl.l}%`);
  };

  // 十六进制转 HSL
  const hexToHSL = (hex: string) => {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  };

  // 选择主题预设
  const selectTheme = (theme: typeof themePresets[0]) => {
    setConfig(prev => ({
      ...prev,
      themeId: theme.id,
      primaryColor: theme.primary,
    }));
  };

  // 上传 Logo
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "logo");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setConfig(prev => ({
          ...prev,
          logoUrl: data.data.url,
          logoName: file.name,
        }));
        setShowLogoDialog(false);
      }
    } catch (error) {
      console.error("上传失败:", error);
    }
  };

  // 选择预设 Logo
  const selectPresetLogo = (logo: typeof presetLogos[0]) => {
    if (logo.id === "custom") {
      fileInputRef.current?.click();
    } else {
      setConfig(prev => ({
        ...prev,
        logoUrl: logo.url,
        logoName: logo.name,
      }));
      setShowLogoDialog(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Settings className="text-sky-400 h-7 w-7" />
            系统设置
          </h1>
          <p className="text-slate-400 text-sm mt-1">配置系统外观和行为</p>
        </div>
        <div className="flex gap-3">
          {saved && (
            <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
              <CheckCircle2 className="h-3 w-3 mr-1" /> 已保存
            </Badge>
          )}
          <Button
            className="bg-sky-500 hover:bg-sky-600 text-white"
            onClick={saveConfig}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            保存配置
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex gap-6">
          {[
            { id: "appearance", label: "外观设置", icon: Palette },
            { id: "general", label: "基础配置", icon: Settings },
            { id: "about", label: "关于系统", icon: Monitor },
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

      {/* Tab Content */}
      {activeTab === "appearance" && (
        <div className="grid grid-cols-2 gap-6">
          {/* Logo 配置 */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-sky-400" />
              Logo 配置
            </h3>
            <div className="space-y-4">
              {/* 当前 Logo 预览 */}
              <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg">
                <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center border border-slate-700">
                  <img
                    src={config.logoUrl}
                    alt="Logo"
                    className="w-12 h-12 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/logo.svg";
                    }}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{config.logoName}</p>
                  <p className="text-xs text-slate-500 mt-1">当前 Logo</p>
                </div>
                <Button
                  variant="outline"
                  className="border-slate-700 text-slate-300"
                  onClick={() => setShowLogoDialog(true)}
                >
                  <Upload className="h-4 w-4 mr-2" /> 更换
                </Button>
              </div>

              {/* 快速选择 */}
              <div className="grid grid-cols-3 gap-2">
                {presetLogos.slice(0, 2).map((logo) => (
                  <button
                    key={logo.id}
                    onClick={() => selectPresetLogo(logo)}
                    className={`p-3 rounded-lg border transition-all ${
                      config.logoName === logo.name
                        ? "border-sky-500 bg-sky-500/10"
                        : "border-slate-700 hover:border-slate-600"
                    }`}
                  >
                    <img src={logo.url} alt={logo.name} className="w-8 h-8 mx-auto object-contain" />
                    <p className="text-[10px] text-slate-400 mt-1 text-center">{logo.name}</p>
                  </button>
                ))}
                <button
                  onClick={() => setShowLogoDialog(true)}
                  className="p-3 rounded-lg border border-slate-700 hover:border-sky-500 hover:bg-sky-500/10 transition-all"
                >
                  <Upload className="w-8 h-8 mx-auto text-slate-500" />
                  <p className="text-[10px] text-slate-400 mt-1 text-center">自定义</p>
                </button>
              </div>
            </div>
          </div>

          {/* 主题配色 */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Palette className="h-5 w-5 text-purple-400" />
              主题配色
            </h3>
            <div className="space-y-4">
              {/* 当前颜色预览 */}
              <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg">
                <div
                  className="w-12 h-12 rounded-xl shadow-lg"
                  style={{ backgroundColor: config.primaryColor, boxShadow: `0 0 20px ${config.primaryColor}40` }}
                />
                <div className="flex-1">
                  <p className="text-white font-medium">
                    {themePresets.find(t => t.id === config.themeId)?.name || "自定义"}
                  </p>
                  <p className="text-xs text-slate-500 font-mono mt-1">{config.primaryColor}</p>
                </div>
                <Button
                  variant="outline"
                  className="border-slate-700 text-slate-300"
                  onClick={() => setShowColorPicker(true)}
                >
                  <Palette className="h-4 w-4 mr-2" /> 自定义
                </Button>
              </div>

              {/* 预设主题 */}
              <div className="grid grid-cols-3 gap-2">
                {themePresets.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => selectTheme(theme)}
                    className={`p-3 rounded-lg border transition-all ${
                      config.themeId === theme.id
                        ? "border-sky-500 bg-sky-500/10"
                        : "border-slate-700 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: theme.primary }}
                      />
                      <span className="text-xs text-white">{theme.name}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 text-left">{theme.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 一键应用效果预览 */}
          <div className="col-span-2 glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-400" />
              效果预览
            </h3>
            <div className="flex gap-4">
              {/* 导航栏预览 */}
              <div className="flex-1 p-4 bg-slate-900 rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: config.primaryColor }}
                  >
                    <Monitor className="text-white h-4 w-4" />
                  </div>
                  <span className="text-white font-semibold">{config.siteName}</span>
                </div>
                <div className="flex gap-2">
                  <div
                    className="px-3 py-1 rounded text-xs text-white"
                    style={{ backgroundColor: `${config.primaryColor}20`, color: config.primaryColor }}
                  >
                    仪表板
                  </div>
                  <div className="px-3 py-1 rounded text-xs text-slate-400 bg-slate-800">
                    节点
                  </div>
                </div>
              </div>

              {/* 按钮预览 */}
              <div className="flex-1 p-4 bg-slate-900 rounded-lg">
                <p className="text-xs text-slate-500 mb-3">按钮样式</p>
                <div className="flex gap-2">
                  <button
                    className="px-4 py-2 rounded-lg text-white text-sm"
                    style={{ backgroundColor: config.primaryColor }}
                  >
                    主要按钮
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg text-sm border"
                    style={{ borderColor: config.primaryColor, color: config.primaryColor }}
                  >
                    次要按钮
                  </button>
                </div>
              </div>

              {/* 标签预览 */}
              <div className="flex-1 p-4 bg-slate-900 rounded-lg">
                <p className="text-xs text-slate-500 mb-3">状态标签</p>
                <div className="flex gap-2">
                  <span
                    className="px-2 py-1 rounded text-xs"
                    style={{ backgroundColor: `${config.primaryColor}20`, color: config.primaryColor }}
                  >
                    运行中
                  </span>
                  <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400">
                    健康
                  </span>
                  <span className="px-2 py-1 rounded text-xs bg-amber-500/20 text-amber-400">
                    警告
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "general" && (
        <div className="grid grid-cols-2 gap-6">
          {/* 基础信息 */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">基础信息</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">站点名称</label>
                <Input
                  value={config.siteName}
                  onChange={(e) => setConfig(prev => ({ ...prev, siteName: e.target.value }))}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">站点描述</label>
                <Input
                  value={config.siteDescription}
                  onChange={(e) => setConfig(prev => ({ ...prev, siteDescription: e.target.value }))}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
            </div>
          </div>

          {/* 快速操作 */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">快速操作</h3>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full border-slate-700 text-slate-300 justify-start"
                onClick={() => {
                  setConfig(prev => ({
                    ...prev,
                    logoUrl: "/logo.svg",
                    logoName: "KubeNext 默认",
                    primaryColor: "#38bdf8",
                    themeId: "sky",
                  }));
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" /> 恢复默认外观
              </Button>
              <Button
                variant="outline"
                className="w-full border-slate-700 text-slate-300 justify-start"
              >
                <Moon className="h-4 w-4 mr-2" /> 切换深色模式
              </Button>
              <Button
                variant="outline"
                className="w-full border-slate-700 text-slate-300 justify-start"
              >
                <Sun className="h-4 w-4 mr-2" /> 切换浅色模式
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "about" && (
        <div className="glass-card p-6">
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Monitor className="text-white h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{config.siteName}</h2>
            <p className="text-slate-400 mb-4">{config.siteDescription}</p>
            <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
              <span>版本: v2.6.0</span>
              <span>•</span>
              <span>基于 Next.js 16</span>
              <span>•</span>
              <span>参考 kubemanage</span>
            </div>
            <div className="mt-6 flex justify-center gap-4">
              <Button variant="outline" className="border-slate-700 text-slate-300">
                查看文档
              </Button>
              <Button variant="outline" className="border-slate-700 text-slate-300">
                GitHub
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Logo 选择对话框 */}
      <Dialog open={showLogoDialog} onOpenChange={setShowLogoDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">选择 Logo</DialogTitle>
            <DialogDescription className="text-slate-400">
              选择预设 Logo 或上传自定义 Logo
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
            {presetLogos.map((logo) => (
              <button
                key={logo.id}
                onClick={() => selectPresetLogo(logo)}
                className="p-4 rounded-lg border border-slate-700 hover:border-sky-500 hover:bg-sky-500/10 transition-all"
              >
                {logo.id === "custom" ? (
                  <Upload className="w-8 h-8 mx-auto text-slate-500" />
                ) : (
                  <img src={logo.url} alt={logo.name} className="w-12 h-12 mx-auto object-contain" />
                )}
                <p className="text-xs text-slate-400 mt-2">{logo.name}</p>
              </button>
            ))}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
          />
        </DialogContent>
      </Dialog>

      {/* 颜色选择器对话框 */}
      <Dialog open={showColorPicker} onOpenChange={setShowColorPicker}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">自定义颜色</DialogTitle>
            <DialogDescription className="text-slate-400">
              输入十六进制颜色值或选择颜色
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={config.primaryColor}
                onChange={(e) => setConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                className="w-12 h-12 rounded-lg cursor-pointer border-0"
              />
              <Input
                value={config.primaryColor}
                onChange={(e) => setConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                className="bg-slate-800 border-slate-700 font-mono"
                placeholder="#38bdf8"
              />
            </div>
            <div
              className="h-16 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: config.primaryColor }}
            >
              <span className="text-white font-medium">颜色预览</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowColorPicker(false)} className="border-slate-700 text-slate-300">
              取消
            </Button>
            <Button className="bg-sky-500 hover:bg-sky-600" onClick={() => setShowColorPicker(false)}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
