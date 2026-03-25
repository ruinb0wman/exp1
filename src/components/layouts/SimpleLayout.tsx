import { Outlet } from "react-router";
import { BottomNav } from "@/components/BottomNav";
import { BaseLayout } from "./BaseLayout";

/**
 * 简单布局组件
 * 不带底部导航栏（横屏时显示），用于次级页面
 */
export function SimpleLayout() {
  return (
    <BaseLayout showBottomNav={false}>
      <Outlet />
      {/* 横屏时显示导航栏 */}
      <div className="hidden landscape:block flex-shrink-0">
        <BottomNav />
      </div>
    </BaseLayout>
  );
}
