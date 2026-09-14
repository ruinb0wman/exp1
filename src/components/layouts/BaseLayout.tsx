import { Outlet } from "react-router";
import { useSafeAreaInsets } from "@/hooks/useSafeAreaInsets";

interface BaseLayoutProps {
  children?: React.ReactNode;
  showBottomNav?: boolean;
}

/**
 * 基础布局组件
 * 只负责布局结构，不包含任何业务初始化逻辑
 */
export function BaseLayout({ children, showBottomNav = true }: BaseLayoutProps) {
  const { top: safeAreaTop } = useSafeAreaInsets();

  // 移动端顶部占位：优先使用安全区，读不到时用 32px 兜底
  const topPadding = safeAreaTop || 32;

  return (
    <>
      <div className="h-screen flex flex-col bg-background landscape:pl-56 overflow-hidden">
        {/* 固定安全区域 - 状态栏占位（透明背景） */}
        <div
          className="flex-shrink-0 z-50"
          style={{ height: `${topPadding}px` }}
        />

        {/* 可滚动内容区域 */}
        <div className="flex-1 relative">
          <div className="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-hide">
            {children || <Outlet />}
          </div>
        </div>

        {/* 底部导航区域 - 由子组件控制显示 */}
        {showBottomNav && <div className="flex-shrink-0 landscape:hidden" />}
      </div>
    </>
  );
}
