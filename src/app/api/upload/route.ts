import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// 文件上传 API
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string || "general"; // logo, icon, etc.

    if (!file) {
      return NextResponse.json(
        { success: false, message: "没有上传文件" },
        { status: 400 }
      );
    }

    // 检查文件类型
    const allowedTypes = ["image/png", "image/jpeg", "image/gif", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: "不支持的文件类型，仅支持 PNG、JPEG、GIF、SVG" },
        { status: 400 }
      );
    }

    // 检查文件大小 (最大 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: "文件大小不能超过 2MB" },
        { status: 400 }
      );
    }

    // 创建上传目录
    const uploadDir = path.join(process.cwd(), "public", "uploads", type);
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // 生成文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = file.name.split(".").pop() || "png";
    const fileName = `${type}-${timestamp}-${randomStr}.${ext}`;
    const filePath = path.join(uploadDir, fileName);

    // 写入文件
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // 返回可访问的 URL
    const fileUrl = `/uploads/${type}/${fileName}`;

    return NextResponse.json({
      success: true,
      message: "文件上传成功",
      data: {
        url: fileUrl,
        fileName,
        originalName: file.name,
        size: file.size,
        type: file.type,
      },
    });
  } catch (error) {
    console.error("文件上传失败:", error);
    return NextResponse.json(
      { success: false, message: "文件上传失败" },
      { status: 500 }
    );
  }
}
