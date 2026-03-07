"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal as XTerm } from "xterm";
import { Terminal } from "lucide-react";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import { Button } from "@/components/ui/button";
import "xterm/css/xterm.css";

// 后端服务端口 - 从环境变量读取，默认 8080
const K8S_SERVICE_PORT = process.env.NEXT_PUBLIC_K8S_SERVICE_PORT || '8080';

// 可用的 Shell 类型
const SHELL_OPTIONS = [
  { value: "/bin/bash", label: "bash", desc: "Bourne Again Shell (推荐)" },
  { value: "/bin/sh", label: "sh", desc: "Bourne Shell (基础)" },
  { value: "/bin/zsh", label: "zsh", desc: "Z Shell (高级)" },
  { value: "/bin/ash", label: "ash", desc: "Almquist Shell (轻量)" },
];

interface TerminalProps {
  namespace: string;
  podName: string;
  container?: string;
  onClose?: () => void;
}

export default function PodTerminal({ namespace, podName, container, onClose }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const [selectedShell, setSelectedShell] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // 初始化终端
  const initTerminal = useCallback(() => {
    if (!terminalRef.current || xtermRef.current) return;

    // 创建终端实例
    const xterm = new XTerm({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      theme: {
        background: "#0a0a0f",
        foreground: "#00ff88",
        cursor: "#00ff88",
        cursorAccent: "#0a0a0f",
        selectionBackground: "#00ff8833",
        black: "#0a0a0f",
        red: "#ff6b6b",
        green: "#00ff88",
        yellow: "#ffd93d",
        blue: "#6bcbff",
        magenta: "#ff6bcb",
        cyan: "#6bffff",
        white: "#e0e0e0",
        brightBlack: "#404040",
        brightRed: "#ff8b8b",
        brightGreen: "#00ff88",
        brightYellow: "#ffeb3b",
        brightBlue: "#8bcbff",
        brightMagenta: "#ff8bcb",
        brightCyan: "#8bffff",
        brightWhite: "#ffffff",
      },
      allowTransparency: true,
      scrollback: 5000,
      tabStopWidth: 4,
    });

    // 加载插件
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(new WebLinksAddon());

    // 打开终端
    xterm.open(terminalRef.current);
    fitAddon.fit();
    fitAddonRef.current = fitAddon;
    xtermRef.current = xterm;

    return xterm;
  }, []);

  // 连接 WebSocket
  const connectWebSocket = useCallback((shell: string) => {
    // 构建 WebSocket URL，添加 shell 参数
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsHost = window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/api/ws/exec?XTransformPort=${K8S_SERVICE_PORT}&namespace=${namespace}&pod=${podName}${container ? `&container=${container}` : ""}&shell=${encodeURIComponent(shell)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected with shell:", shell);
      setIsConnected(true);
      setConnectionError(null);
      if (xtermRef.current) {
        xtermRef.current.writeln(`\x1b[1;32m✓ Connected to pod terminal\x1b[0m`);
        xtermRef.current.writeln(`\x1b[1;36m  Shell: ${shell}\x1b[0m`);
        xtermRef.current.writeln("");
      }
      // 发送初始终端大小
      if (fitAddonRef.current) {
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims) {
          ws.send(JSON.stringify({
            type: "resize",
            cols: dims.cols || 80,
            rows: dims.rows || 24,
          }));
        }
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "stdout" && xtermRef.current) {
          xtermRef.current.write(msg.data);
        } else if (msg.type === "error" && xtermRef.current) {
          xtermRef.current.writeln(`\r\n\x1b[1;31mError: ${msg.data}\x1b[0m`);
          setConnectionError(msg.data);
        }
      } catch {
        // 非 JSON 消息直接写入
        if (xtermRef.current) {
          xtermRef.current.write(event.data);
        }
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setConnectionError("连接失败");
      if (xtermRef.current) {
        xtermRef.current.writeln("\r\n\x1b[1;31m✗ Connection error\x1b[0m");
      }
    };

    ws.onclose = (event) => {
      console.log("WebSocket closed:", event.reason);
      setIsConnected(false);
      if (xtermRef.current) {
        xtermRef.current.writeln("\r\n\x1b[1;33m⏏ Connection closed\x1b[0m");
      }
    };

    return ws;
  }, [namespace, podName, container]);

  // 设置终端输入
  const setupTerminalInput = useCallback(() => {
    if (!xtermRef.current || !wsRef.current) return;

    const xterm = xtermRef.current;
    const ws = wsRef.current;

    // 键盘输入
    xterm.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "stdin",
          data: data,
        }));
      }
    });

    // 窗口大小变化
    const handleResize = () => {
      if (fitAddonRef.current && ws.readyState === WebSocket.OPEN) {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims) {
          ws.send(JSON.stringify({
            type: "resize",
            cols: dims.cols || 80,
            rows: dims.rows || 24,
          }));
        }
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // 当选择了 shell 后初始化终端并连接
  useEffect(() => {
    if (!selectedShell) return;

    const xterm = initTerminal();
    if (!xterm) return;

    // 输出欢迎信息
    xterm.writeln("\x1b[1;36m╔════════════════════════════════════════════════════════════╗\x1b[0m");
    xterm.writeln("\x1b[1;36m║\x1b[0m  \x1b[1;32mKubeNext Pod Terminal\x1b[0m                                \x1b[1;36m║\x1b[0m");
    xterm.writeln("\x1b[1;36m║\x1b[0m                                                             \x1b[1;36m║\x1b[0m");
    xterm.writeln(`\x1b[1;36m║\x1b[0m  \x1b[1;33mPod:\x1b[0m ${podName.padEnd(48)}\x1b[1;36m║\x1b[0m`);
    xterm.writeln(`\x1b[1;36m║\x1b[0m  \x1b[1;33mNamespace:\x1b[0m ${namespace.padEnd(41)}\x1b[1;36m║\x1b[0m`);
    if (container) {
      xterm.writeln(`\x1b[1;36m║\x1b[0m  \x1b[1;33mContainer:\x1b[0m ${container.padEnd(41)}\x1b[1;36m║\x1b[0m`);
    }
    xterm.writeln("\x1b[1;36m║\x1b[0m                                                             \x1b[1;36m║\x1b[0m");
    xterm.writeln("\x1b[1;36m║\x1b[0m  \x1b[1;37mType 'exit' to close the terminal.\x1b[0m                    \x1b[1;36m║\x1b[0m");
    xterm.writeln("\x1b[1;36m╚════════════════════════════════════════════════════════════╝\x1b[0m");
    xterm.writeln("");
    xterm.writeln(`\x1b[1;34m➜ Connecting with ${selectedShell}...\x1b[0m`);

    const ws = connectWebSocket(selectedShell);
    if (!ws) return;

    const cleanup = setupTerminalInput();

    return () => {
      cleanup?.();
      ws.close();
      xterm.dispose();
      xtermRef.current = null;
      wsRef.current = null;
    };
  }, [selectedShell, initTerminal, connectWebSocket, setupTerminalInput, namespace, podName, container]);

  // 监听终端元素大小变化
  useEffect(() => {
    if (!terminalRef.current || !fitAddonRef.current) return;

    const observer = new ResizeObserver(() => {
      fitAddonRef.current?.fit();
    });

    observer.observe(terminalRef.current);

    return () => {
      observer.disconnect();
    };
  }, [selectedShell]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] overflow-hidden">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <button
              onClick={onClose}
              className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors cursor-pointer"
              title="关闭终端"
            />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-sm text-slate-300 font-medium">
            {podName}
          </span>
          <span className="text-xs text-slate-500">•</span>
          <span className="text-xs text-slate-500">{namespace}</span>
          {selectedShell && isConnected && (
            <span className="text-xs text-emerald-400 px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20">
              {selectedShell.split('/').pop()}
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white text-xs px-3 py-1.5 rounded-md hover:bg-slate-700/50 transition-colors border border-slate-700/50"
          >
            断开连接
          </button>
        )}
      </div>

      {/* Shell Selector or Terminal Container */}
      {!selectedShell ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-sky-500/10 flex items-center justify-center mb-4 mx-auto border border-sky-500/20">
              <Terminal className="w-8 h-8 text-sky-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">选择 Shell 解释器</h3>
            <p className="text-slate-400 text-sm">
              选择要在容器 <span className="text-sky-400 font-mono">{podName}</span> 中使用的 Shell 类型
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
            {SHELL_OPTIONS.map((shell) => (
              <button
                key={shell.value}
                onClick={() => setSelectedShell(shell.value)}
                className="flex flex-col items-start p-4 rounded-xl border border-slate-700 bg-slate-800/50 hover:border-sky-500/50 hover:bg-slate-800 transition-all text-left group"
              >
                <span className="text-lg font-mono text-white group-hover:text-sky-400 transition-colors">
                  {shell.label}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {shell.value}
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  {shell.desc}
                </span>
              </button>
            ))}
          </div>

          <p className="text-slate-500 text-xs mt-6">
            提示：如果选择的 Shell 不可用，将自动降级为 /bin/sh
          </p>
        </div>
      ) : (
        <div
          ref={terminalRef}
          className="flex-1 p-2 overflow-hidden"
          style={{ height: "calc(100% - 52px)" }}
        />
      )}
    </div>
  );
}
