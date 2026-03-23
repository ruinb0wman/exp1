import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * PC端标题栏组件
 * - 使用 data-tauri-drag-region 实现窗口拖动
 * - 无系统控制按钮（缩小/放大/关闭）
 * - 仅在桌面端显示
 */
export function TitleBar() {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const checkPlatform = async () => {
      try {
        const platform = await invoke<string>("get_platform");
        setIsDesktop(platform !== "mobile");
      } catch (error) {
        console.error("Failed to detect platform:", error);
        setIsDesktop(true);
      }
    };
    checkPlatform();
  }, []);

  if (!isDesktop) {
    return null;
  }

  return (
    <div
      data-tauri-drag-region
      className="fixed top-0 left-0 right-0 landscape:left-56 h-8 bg-surface z-[9999] select-none border-b border-border"
    >
      {/* 标题栏内容区域 - 居中显示应用名称 */}
      <div data-tauri-drag-region className="h-full flex items-center justify-center">
        <span className="text-text-secondary text-sm font-medium">
          Exp1
        </span>
      </div>
    </div>
  );
}
