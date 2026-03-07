import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { QueryProvider } from "@/components/providers/QueryProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KubeNext Gen-AI | 2026 智能容器管理平台",
  description: "现代化的 Kubernetes 智能集群管理平台，提供工作负载管理、服务路由、配置存储、节点监控等功能",
  keywords: ["Kubernetes", "K8s", "管理平台", "容器编排", "云原生", "DevOps", "AI"],
  authors: [{ name: "KubeNext Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "KubeNext Gen-AI",
    description: "Kubernetes 智能集群管理平台",
    url: "https://kubenext.io",
    siteName: "KubeNext",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KubeNext Gen-AI",
    description: "Kubernetes 智能集群管理平台",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#020617] text-slate-100`}
      >
        <QueryProvider>
          {children}
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
