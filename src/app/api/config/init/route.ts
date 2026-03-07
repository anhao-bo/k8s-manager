import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// 初始化系统配置
export async function POST(request: NextRequest) {
  try {
    const defaultConfigs = [
      { key: "logoUrl", value: "/logo.svg", description: "系统 Logo URL", category: "theme" },
      { key: "logoName", value: "KubeNext 默认", description: "Logo 名称", category: "theme" },
      { key: "primaryColor", value: "#38bdf8", description: "主题主色", category: "theme" },
      { key: "themeId", value: "sky", description: "主题 ID", category: "theme" },
      { key: "siteName", value: "KubeNext", description: "站点名称", category: "general" },
      { key: "siteDescription", value: "Kubernetes 集群管理平台", description: "站点描述", category: "general" },
      { key: "defaultNamespace", value: "default", description: "默认命名空间", category: "general" },
      { key: "refreshInterval", value: "5000", description: "刷新间隔(毫秒)", category: "general" },
    ];

    const results = await Promise.all(
      defaultConfigs.map((config) =>
        db.systemConfig.upsert({
          where: { key: config.key },
          update: { value: config.value },
          create: config,
        })
      )
    );

    return NextResponse.json({
      success: true,
      message: "初始化配置成功",
      data: results,
    });
  } catch (error) {
    console.error("初始化配置失败:", error);
    return NextResponse.json(
      { success: false, message: "初始化配置失败" },
      { status: 500 }
    );
  }
}
