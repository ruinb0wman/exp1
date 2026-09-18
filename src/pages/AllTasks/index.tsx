import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { History } from "lucide-react";
import { Header, HeaderActionButton } from "@/components/Header";
import { FilterTabs } from "@/components/FilterTabs";
import { useTaskTemplates, useTaskTemplateActions } from "@/hooks/useTasks";
import { useUserStore } from "@/store";
import {
  categories,
  type Category,
  filterTemplatesByCategory,
  getTaskStats,
  moveTemplateOrder,
} from "./lib";
import { TaskList } from "./components/TaskList";
import { StatsSummary } from "./components/StatsSummary";
import { FloatingAddButton } from "./components/FloatingAddButton";

export function AllTasks() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const { templates, isLoading, error, refresh } = useTaskTemplates(user?.id);
  const { toggleEnabled, reorder, isLoading: isActionLoading } = useTaskTemplateActions();
  const [filter, setFilter] = useState<Category>("All");

  // 筛选任务
  const filteredTemplates = filterTemplatesByCategory(templates, filter);

  // 启用/禁用任务
  const handleToggleEnabled = async (id: string, currentEnabled: boolean) => {
    try {
      await toggleEnabled(id, !currentEnabled);
      refresh();
    } catch (error) {
      console.error("Failed to toggle task:", error);
    }
  };

  // 上移/下移任务（与可见的邻居交换，筛选视图下会跳过被隐藏的模板）
  const handleMove = async (id: string, direction: -1 | 1) => {
    const next = moveTemplateOrder(
      templates.map((t) => t.id!),
      filteredTemplates.map((t) => t.id!),
      id,
      direction
    );
    if (!next) return;

    try {
      await reorder(next);
      await refresh();
    } catch (error) {
      console.error("Failed to reorder task:", error);
    }
  };

  const { enabledCount, totalCount } = getTaskStats(templates);

  return (
    <div className="min-h-screen pb-24 bg-background">
      <Header
        title={t("allTasks.title")}
        back
        rightSlot={
          <HeaderActionButton
            icon={History}
            side="end"
            label={t("allTasks.taskHistory")}
            onClick={() => navigate("/task-history")}
          />
        }
      />

      {/* Filter Tabs */}
      <div className="px-4 pb-4">
        <FilterTabs
          options={categories}
          activeFilter={filter}
          onFilterChange={setFilter}
        />
      </div>

      {/* Stats Summary */}
      <div className="px-4 pb-4">
        <StatsSummary enabledCount={enabledCount} totalCount={totalCount} />
      </div>

      {/* Tasks List */}
      <main className="px-4">
        <TaskList
          templates={filteredTemplates}
          isLoading={isLoading}
          error={error}
          isActionLoading={isActionLoading}
          filter={filter}
          onRefresh={refresh}
          onEdit={(id) => navigate(`/tasks/${id}`)}
          onToggleEnabled={handleToggleEnabled}
          onMove={handleMove}
        />
      </main>

      {/* Floating Add Button */}
      <FloatingAddButton onClick={() => navigate("/tasks/new")} />
    </div>
  );
}
