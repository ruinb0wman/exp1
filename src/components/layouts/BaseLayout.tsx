import { Outlet } from "react-router";
import { TitleBar } from "@/components/TitleBar";
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

  // 移动端使用动态计算的 safeAreaTop，桌面端使用固定 32px
  const isMobile = safeAreaTop > 0;
  const topPadding = isMobile ? safeAreaTop : 32;

  return (
    <>
      <TitleBar />
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
