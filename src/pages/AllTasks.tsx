import { useState } from "react";
import { Header } from "../components/Header";
import { Plus, ChevronRight, Calendar, Trash2, Power, History } from "lucide-react";
import { useNavigate } from "react-router";
import { useTaskTemplates, useTaskTemplateActions } from "@/hooks/useTasks";
import { useUserStore } from "@/store";
import type { RepeatMode } from "@/db/types";

const categories = ["All", "Daily", "Weekly", "Monthly"] as const;
type Category = (typeof categories)[number];

const repeatModeMap: Record<RepeatMode, string> = {
  none: "One-time",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const repeatModeColorMap: Record<RepeatMode, string> = {
  none: "bg-text-muted/20 text-text-muted",
  daily: "bg-blue-500/20 text-blue-400",
  weekly: "bg-purple-500/20 text-purple-400",
  monthly: "bg-orange-500/20 text-orange-400",
};

export function AllTasks() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const { templates, isLoading, error, refresh } = useTaskTemplates(user?.id);
  const { remove, toggleEnabled, isLoading: isActionLoading } = useTaskTemplateActions();
  const [filter, setFilter] = useState<Category>("All");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // 筛选任务
  const filteredTemplates = templates.filter((template) => {
    if (filter === "All") return true;
    if (filter === "Daily") return template.repeatMode === "daily";
    if (filter === "Weekly") return template.repeatMode === "weekly";
    if (filter === "Monthly") return template.repeatMode === "monthly";
    return true;
  });

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
  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this task? This will also delete all related task instances.")) {
      return;
    }

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

  const enabledCount = templates.filter((t) => t.enabled).length;
  const totalCount = templates.length;

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
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === cat
                  ? "bg-primary text-white"
                  : "bg-surface text-text-secondary hover:bg-surface-light"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between text-text-secondary text-sm">
          <span>
            {enabledCount} of {totalCount} enabled
          </span>
          <button className="flex items-center gap-1 text-primary hover:text-primary-light transition-colors">
            <Calendar className="w-4 h-4" />
            <span>Calendar View</span>
          </button>
        </div>
      </div>

      {/* Tasks List */}
      <main className="px-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm mt-4">Loading tasks...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted">
            <p className="text-base font-medium">Failed to load tasks</p>
            <button
              onClick={refresh}
              className="mt-2 text-primary hover:text-primary-light"
            >
              Retry
            </button>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted">
            <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
              <Plus className="w-8 h-8" />
            </div>
            <p className="text-base font-medium">No tasks found</p>
            <p className="text-sm mt-1">
              {filter === "All" ? "Create your first task" : "Try a different filter"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className={`flex items-center gap-4 bg-surface rounded-xl p-4 min-h-[72px] justify-between border transition-colors ${
                  template.enabled ? "border-border hover:border-surface-light" : "border-border/50 opacity-60"
                }`}
              >
                <div
                  className="flex items-center gap-4 flex-1 cursor-pointer"
                  onClick={() => navigate(`/tasks/${template.id}`)}
                >
                  <div className="flex flex-col justify-center flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-base font-medium leading-normal line-clamp-1 transition-all ${
                          template.enabled ? "text-text-primary" : "text-text-secondary"
                        }`}
                      >
                        {template.title}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${repeatModeColorMap[template.repeatMode]}`}
                      >
                        {repeatModeMap[template.repeatMode]}
                      </span>
                    </div>
                    <p
                      className={`text-sm font-normal leading-normal line-clamp-1 transition-all ${
                        template.enabled ? "text-text-secondary" : "text-text-muted"
                      }`}
                    >
                      {template.description || `+${template.rewardPoints} exp`}
                    </p>
                    {template.subtasks.length > 0 && (
                      <p className="text-xs text-text-muted mt-1">
                        {template.subtasks.length} checklist item
                        {template.subtasks.length > 1 ? "s" : ""}
                        {template.isRandomSubtask && " (random)"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex items-center gap-2">
                  {/* Enable/Disable Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleEnabled(template.id!, template.enabled);
                    }}
                    disabled={isActionLoading}
                    className={`p-2 rounded-lg transition-colors ${
                      template.enabled
                        ? "text-primary hover:bg-primary/10"
                        : "text-text-muted hover:bg-surface-light"
                    }`}
                    title={template.enabled ? "Disable" : "Enable"}
                  >
                    <Power className="w-4 h-4" />
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(template.id!);
                    }}
                    disabled={deletingId === template.id || isActionLoading}
                    className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="Delete"
                  >
                    {deletingId === template.id ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>

                  <ChevronRight className="w-5 h-5 text-text-muted" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Add Button */}
      <button
        onClick={() => navigate("/tasks/new")}
        className="fixed bottom-24 right-4 flex items-center justify-center w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:bg-primary-light transition-colors z-40"
      >
        <Plus className="w-7 h-7" />
      </button>
    </div>
  );
}
