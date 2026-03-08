import { useState } from "react";
import { useNavigate } from "react-router";
import { History } from "lucide-react";
import { Header } from "@/components/Header";
import { FilterTabs } from "@/components/FilterTabs";
import { useConfirm } from "@/hooks/useConfirm";
import { useTaskTemplates, useTaskTemplateActions } from "@/hooks/useTasks";
import { useUserStore } from "@/store";
import {
  categories,
  type Category,
  filterTemplatesByCategory,
  getTaskStats,
} from "./lib";
import { TaskList } from "./components/TaskList";
import { StatsSummary } from "./components/StatsSummary";
import { FloatingAddButton } from "./components/FloatingAddButton";

export function AllTasks() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const { templates, isLoading, error, refresh } = useTaskTemplates(user?.id);
  const { remove, toggleEnabled, isLoading: isActionLoading } = useTaskTemplateActions();
  const confirm = useConfirm();
  const [filter, setFilter] = useState<Category>("All");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // 筛选任务
  const filteredTemplates = filterTemplatesByCategory(templates, filter);

  // 启用/禁用任务
  const handleToggleEnabled = async (id: number, currentEnabled: boolean) => {
    try {
      await toggleEnabled(id, !currentEnabled);
      refresh();
    } catch (error) {
      console.error("Failed to toggle task:", error);
    }
  };

  // 删除任务
  const handleDelete = async (id: number, title: string) => {
    const confirmed = await confirm({
      title: "Delete Task",
      message: `Are you sure you want to delete "${title}"? This will also delete all related task instances.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "danger",
    });

    if (!confirmed) return;

    setDeletingId(id);
    try {
      await remove(id);
      refresh();
    } catch (error) {
      console.error("Failed to delete task:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const { enabledCount, totalCount } = getTaskStats(templates);

  return (
    <div className="min-h-screen pb-24 bg-background">
      <Header
        title="All Tasks"
        back
        rightSlot={
          <button
            onClick={() => navigate("/task-history")}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
            title="任务历史"
          >
            <History className="w-5 h-5" />
          </button>
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
          deletingId={deletingId}
          isActionLoading={isActionLoading}
          filter={filter}
          onRefresh={refresh}
          onEdit={(id) => navigate(`/tasks/${id}`)}
          onToggleEnabled={handleToggleEnabled}
          onDelete={handleDelete}
        />
      </main>

      {/* Floating Add Button */}
      <FloatingAddButton onClick={() => navigate("/tasks/new")} />
    </div>
  );
}
