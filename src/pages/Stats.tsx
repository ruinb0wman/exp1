import { ChevronLeft, ChevronRight } from "lucide-react";

const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

// Mock calendar data
const calendarDays = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  status: Math.random() > 0.7 ? "completed" : Math.random() > 0.5 ? "partial" : null,
}));

const dayTasks = [
  { id: 1, name: "Morning Run", exp: 10, completed: false },
  { id: 2, name: "Read 20 pages", exp: 5, completed: false },
  { id: 3, name: "Plan tomorrow's tasks", exp: 5, completed: true },
];

export function Stats() {
  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <header className="flex items-center p-4 pb-2 justify-between">
        <button className="w-12 flex items-center text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-text-primary flex-1 text-center">
          Calendar
        </h1>
        <div className="w-12 flex justify-end">
          <button className="text-text-primary hover:text-primary transition-colors text-2xl font-light">
            +
          </button>
        </div>
      </header>

      <main className="px-4">
        {/* Calendar */}
        <div className="max-w-xs mx-auto">
          {/* Month Navigation */}
          <div className="flex items-center p-1 justify-between mb-2">
            <button className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-base font-bold text-text-primary">
              September 2024
            </p>
            <button className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Week Days */}
          <div className="grid grid-cols-7">
            {weekDays.map((day) => (
              <p
                key={day}
                className="h-12 flex items-center justify-center text-[13px] font-bold text-text-muted"
              >
                {day}
              </p>
            ))}

            {/* Calendar Days */}
            {calendarDays.map((item, index) => (
              <button
                key={item.day}
                className={`h-12 text-sm font-medium relative ${
                  index === 0 ? "col-start-1" : ""
                }`}
              >
                <div
                  className={`w-full h-full flex items-center justify-center rounded-lg ${
                    item.day === 24
                      ? "bg-primary text-white"
                      : "text-text-primary hover:bg-surface transition-colors"
                  }`}
                >
                  {item.day}
                </div>
                {item.status && (
                  <div
                    className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                      item.status === "completed"
                        ? "bg-green-500"
                        : "bg-amber-500"
                    }`}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tasks for the day */}
        <div className="mt-6">
          <h3 className="text-lg font-bold text-text-primary pb-2 pt-4">
            Tasks for September 24
          </h3>
          <div className="divide-y divide-border">
            {dayTasks.map((task) => (
              <label
                key={task.id}
                className="flex gap-x-3 py-4 flex-row items-center cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  className="custom-checkbox w-6 h-6"
                  readOnly
                />
                <p className="text-base text-text-primary">
                  {task.name}{" "}
                  <span className="text-text-muted">
                    (+{task.exp} exp)
                  </span>
                </p>
              </label>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
