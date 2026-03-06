import { useState } from "react";
import { Header } from "../components/Header";
import { Plus, ChevronRight, Calendar, ListFilter } from "lucide-react";
import { useNavigate } from "react-router";

interface Task {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  exp: number;
  repeat: "daily" | "weekly" | "monthly";
  category: string;
}

const initialTasks: Task[] = [
  {
    id: 1,
    title: "Morning Jogging",
    description: "30-minute run around the park",
    completed: true,
    exp: 20,
    repeat: "daily",
    category: "Health",
  },
  {
    id: 2,
    title: "Read a Chapter",
    description: "Read at least one chapter of 'Atomic Habits'",
    completed: true,
    exp: 15,
    repeat: "daily",
    category: "Learning",
  },
  {
    id: 3,
    title: "Plan Tomorrow",
    description: "Organize tasks and schedule for the next day",
    completed: false,
    exp: 10,
    repeat: "daily",
    category: "Productivity",
  },
  {
    id: 4,
    title: "Drink 8 glasses of water",
    description: "Stay hydrated throughout the day",
    completed: false,
    exp: 5,
    repeat: "daily",
    category: "Health",
  },
  {
    id: 5,
    title: "Practice coding for 1 hour",
    description: "Work on a personal project or do a coding challenge",
    completed: false,
    exp: 30,
    repeat: "weekly",
    category: "Learning",
  },
  {
    id: 6,
    title: "Weekly Review",
    description: "Review weekly progress and achievements",
    completed: false,
    exp: 25,
    repeat: "weekly",
    category: "Productivity",
  },
  {
    id: 7,
    title: "Monthly Budget Check",
    description: "Review expenses and update budget",
    completed: false,
    exp: 50,
    repeat: "monthly",
    category: "Finance",
  },
];

const categories = ["All", "Daily", "Weekly", "Monthly"];
const taskCategories = ["All", "Health", "Learning", "Productivity", "Finance"];

export function AllTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [filter, setFilter] = useState<"All" | "Daily" | "Weekly" | "Monthly">("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  const toggleTask = (id: number) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const filteredTasks = tasks.filter((task) => {
    const matchRepeat = filter === "All" || task.repeat === filter.toLowerCase();
    const matchCategory = categoryFilter === "All" || task.category === categoryFilter;
    return matchRepeat && matchCategory;
  });

  const completedCount = filteredTasks.filter((t) => t.completed).length;
  const totalCount = filteredTasks.length;

  return (
    <div className="min-h-screen pb-24 bg-background">
      <Header
        title="All Tasks"
        back
        rightSlot={
          <button
            onClick={() => navigate("/tasks/new")}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        }
      />

      {/* Filter Tabs */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat as typeof filter)}
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

      {/* Category Filter */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-text-muted" />
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {taskCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  categoryFilter === cat
                    ? "bg-surface-light text-text-primary"
                    : "bg-transparent text-text-muted hover:text-text-secondary"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between text-text-secondary text-sm">
          <span>
            {completedCount} of {totalCount} completed
          </span>
          <button className="flex items-center gap-1 text-primary hover:text-primary-light transition-colors">
            <Calendar className="w-4 h-4" />
            <span>Calendar View</span>
          </button>
        </div>
      </div>

      {/* Tasks List */}
      <main className="px-4">
        <div className="flex flex-col gap-3">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-4 bg-surface rounded-xl p-4 min-h-[72px] justify-between border border-border hover:border-surface-light transition-colors cursor-pointer"
              onClick={() => navigate(`/tasks/${task.id}`)}
            >
              <div className="flex items-center gap-4 flex-1">
                <div
                  className="flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTask(task.id);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => {}}
                    className="custom-checkbox"
                  />
                </div>
                <div className="flex flex-col justify-center flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-base font-medium leading-normal line-clamp-1 transition-all ${
                        task.completed
                          ? "text-text-muted line-through"
                          : "text-text-primary"
                      }`}
                    >
                      {task.title}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        task.repeat === "daily"
                          ? "bg-blue-500/20 text-blue-400"
                          : task.repeat === "weekly"
                          ? "bg-purple-500/20 text-purple-400"
                          : "bg-orange-500/20 text-orange-400"
                      }`}
                    >
                      {task.repeat}
                    </span>
                  </div>
                  <p
                    className={`text-sm font-normal leading-normal line-clamp-1 transition-all ${
                      task.completed ? "text-text-muted" : "text-text-secondary"
                    }`}
                  >
                    {task.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-primary">+{task.exp} exp</span>
                    <span className="text-xs text-text-muted">•</span>
                    <span className="text-xs text-text-muted">{task.category}</span>
                  </div>
                </div>
              </div>
              <div className="shrink-0">
                <ChevronRight className="w-5 h-5 text-text-muted" />
              </div>
            </div>
          ))}
        </div>

        {filteredTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted">
            <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
              <ListFilter className="w-8 h-8" />
            </div>
            <p className="text-base font-medium">No tasks found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
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
