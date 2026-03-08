import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// 获取系统配置
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const key = searchParams.get("key");

    let configs;
    if (key) {
      // 获取单个配置
      const config = await db.systemConfig.findUnique({
        where: { key },
      });
      configs = config ? [config] : [];
    } else if (category) {
      // 按分类获取配置
      configs = await db.systemConfig.findMany({
        where: { category },
      });
    } else {
      // 获取所有配置
      configs = await db.systemConfig.findMany();
    }

    // 转换为键值对格式
    const configMap = configs.reduce((acc, config) => {
      acc[config.key] = config.value;
      return acc;
    }, {} as Record<string, string>);

    return NextResponse.json({
      success: true,
      data: configMap,
      list: configs,
    });
  } catch (error) {
    console.error("获取系统配置失败:", error);
    return NextResponse.json(
      { success: false, message: "获取系统配置失败" },
      { status: 500 }
    );
  }
}

// 更新系统配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value, description, category = "general" } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { success: false, message: "缺少必要参数" },
        { status: 400 }
      );
    }

    const config = await db.systemConfig.upsert({
      where: { key },
      update: { value, description, category },
      create: { key, value, description, category },
    });

    return NextResponse.json({
      success: true,
      message: "配置更新成功",
      data: config,
    });
  } catch (error) {
    console.error("更新系统配置失败:", error);
    return NextResponse.json(
      { success: false, message: "更新系统配置失败" },
      { status: 500 }
    );
  }
}

// 批量更新系统配置
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { configs } = body as { configs: Array<{ key: string; value: string; description?: string; category?: string }> };

    if (!configs || !Array.isArray(configs)) {
      return NextResponse.json(
        { success: false, message: "缺少必要参数" },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      configs.map((config) =>
        db.systemConfig.upsert({
          where: { key: config.key },
          update: {
            value: config.value,
            description: config.description,
            category: config.category || "general",
          },
          create: {
            key: config.key,
            value: config.value,
            description: config.description,
            category: config.category || "general",
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      message: "批量更新成功",
      data: results,
    });
  } catch (error) {
    console.error("批量更新系统配置失败:", error);
    return NextResponse.json(
      { success: false, message: "批量更新系统配置失败" },
      { status: 500 }
    );
  }
}
