import { Outlet } from "react-router";
import { BottomNav } from "@/components/BottomNav";
import { BaseLayout } from "./BaseLayout";

/**
 * 主布局组件
 * 带底部导航栏，用于主要页面
 */
export function MainLayout() {
  return (
    <BaseLayout showBottomNav>
      <Outlet />
      <BottomNav />
    </BaseLayout>
  );
}
