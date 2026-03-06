import { useState, useEffect } from "react";
import { ListTodo, ChevronRight, Plus, Star } from "lucide-react";
import { useNavigate } from "react-router";
import { useUserStore } from "@/store";

interface Task {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  exp: number;
}

const initialTasks: Task[] = [
  {
    id: 1,
    title: "Morning Jogging",
    description: "30-minute run around the park (+20 exp)",
    completed: true,
    exp: 20,
  },
  {
    id: 2,
    title: "Read a Chapter",
    description: "Read at least one chapter of 'Atomic Habits' (+15 exp)",
    completed: true,
    exp: 15,
  },
  {
    id: 3,
    title: "Plan Tomorrow",
    description: "Organize tasks and schedule for the next day (+10 exp)",
    completed: true,
    exp: 10,
  },
  {
    id: 4,
    title: "Drink 8 glasses of water",
    description: "Stay hydrated throughout the day (+5 exp)",
    completed: false,
    exp: 5,
  },
  {
    id: 5,
    title: "Practice coding for 1 hour",
    description: "Work on a personal project or do a coding challenge (+30 exp)",
    completed: false,
    exp: 30,
  },
];

export function Home() {
  const navigate = useNavigate();
  const { user, initUser, isLoading } = useUserStore();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  useEffect(() => {
    if (!user && !isLoading) {
      initUser();
    }
  }, [user, isLoading, initUser]);

  const toggleTask = (id: number) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-text-primary font-bold border border-border">
              A
            </div>
            <div className="flex flex-col">
              <p className="text-text-secondary text-sm font-normal">
                Good Morning!
              </p>
              <h1 className="text-text-primary text-xl font-bold tracking-tight">
                {user?.name ?? "User"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 border border-border">
            <Star className="w-4 h-4 text-primary fill-primary" />
            <p className="text-text-primary text-sm font-bold">{user?.currentPoints ?? 0} exp</p>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-2">
          <p className="text-text-primary text-base font-normal mb-2">
            You've completed {completedCount} of {totalCount} tasks today.
          </p>
          <div className="w-full rounded-full bg-surface h-2">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* Tasks List */}
      <main className="px-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-text-primary text-lg font-bold tracking-tight">
            Today's Tasks
          </h2>
          <button
            onClick={() => navigate("/tasks")}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-primary hover:bg-surface transition-colors"
          >
            <ListTodo className="w-4 h-4" />
            <span>All Tasks</span>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-4 bg-surface rounded-xl p-4 min-h-[72px] justify-between border border-border"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggleTask(task.id)}
                    className="custom-checkbox"
                  />
                </div>
                <div className="flex flex-col justify-center flex-1">
                  <p
                    className={`text-base font-medium leading-normal line-clamp-1 transition-all ${
                      task.completed
                        ? "text-text-secondary line-through"
                        : "text-text-primary"
                    }`}
                  >
                    {task.title}
                  </p>
                  <p
                    className={`text-sm font-normal leading-normal line-clamp-2 transition-all ${
                      task.completed
                        ? "text-text-muted line-through"
                        : "text-text-secondary"
                    }`}
                  >
                    {task.description}
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <ChevronRight className="w-5 h-5 text-text-muted" />
              </div>
            </div>
          ))}
        </div>
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
