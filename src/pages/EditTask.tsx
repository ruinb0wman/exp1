import { useState } from "react";
import { Header } from "../components/Header";
import { RadioGroup } from "../components/RadioGroup";
import { MultiSelectGrid } from "../components/MultiSelectGrid";
import { Stars, Trash2, Shuffle } from "lucide-react";
import type { TaskTemplate, RepeatMode, EndCondition } from "../db/types/task";

const repeatOptions = ["None", "Daily", "Weekly", "Monthly"];
const repeatValues: RepeatMode[] = ["none", "daily", "weekly", "monthly"];

const endOptions = ["Manual", "On Date", "After Times"];
const endValues: EndCondition[] = ["manual", "date", "times"];

const weekDays = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

const monthDays = Array.from({ length: 31 }, (_, i) => ({
  label: String(i + 1),
  value: i + 1,
}));

interface EditTaskProps {
  userId?: number;
  initialTask?: Partial<TaskTemplate>;
  onSubmit?: (task: Omit<TaskTemplate, "id" | "createdAt" | "updatedAt">) => void;
}

export function EditTask({ userId = 1, initialTask, onSubmit }: EditTaskProps) {
  const [title, setTitle] = useState(initialTask?.title ?? "");
  const [description, setDescription] = useState(initialTask?.description ?? "");
  const [rewardPoints, setRewardPoints] = useState(initialTask?.rewardPoints ?? 10);
  const [repeatIndex, setRepeatIndex] = useState(() => {
    const mode = initialTask?.repeatMode ?? "none";
    return repeatValues.indexOf(mode);
  });
  const [repeatInterval, setRepeatInterval] = useState(initialTask?.repeatInterval ?? 1);
  const [repeatDaysOfWeek, setRepeatDaysOfWeek] = useState<number[]>(initialTask?.repeatDaysOfWeek ?? []);
  const [repeatDaysOfMonth, setRepeatDaysOfMonth] = useState<number[]>(initialTask?.repeatDaysOfMonth ?? []);
  const [endIndex, setEndIndex] = useState(() => {
    const condition = initialTask?.endCondition ?? "manual";
    return endValues.indexOf(condition);
  });
  const [endValue, setEndValue] = useState(initialTask?.endValue ?? "");
  const [enabled, setEnabled] = useState(initialTask?.enabled ?? true);
  const [subtasks, setSubtasks] = useState<string[]>(initialTask?.subtasks ?? []);
  const [isRandomSubtask, setIsRandomSubtask] = useState(initialTask?.isRandomSubtask ?? false);
  const [newSubtask, setNewSubtask] = useState("");

  const handleAddSubtask = () => {
    if (newSubtask.trim()) {
      setSubtasks([...subtasks, newSubtask.trim()]);
      setNewSubtask("");
    }
  };

  const handleDeleteSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  const handleWeekDayChange = (day: number) => {
    setRepeatDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleMonthDayChange = (day: number) => {
    setRepeatDaysOfMonth((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleSubmit = () => {
    const taskData: Omit<TaskTemplate, "id" | "createdAt" | "updatedAt"> = {
      userId,
      title,
      description: description || undefined,
      rewardPoints,
      repeatMode: repeatValues[repeatIndex],
      repeatInterval: repeatValues[repeatIndex] !== "none" ? repeatInterval : undefined,
      repeatDaysOfWeek: repeatValues[repeatIndex] === "weekly" ? repeatDaysOfWeek : undefined,
      repeatDaysOfMonth: repeatValues[repeatIndex] === "monthly" ? repeatDaysOfMonth : undefined,
      endCondition: endValues[endIndex],
      endValue: endValues[endIndex] !== "manual" ? endValue : undefined,
      enabled,
      subtasks,
      isRandomSubtask,
    };

    console.log(taskData);
    onSubmit?.(taskData);
  };

  const repeatMode = repeatValues[repeatIndex];
  const endCondition = endValues[endIndex];

  return (
    <div className="min-h-screen bg-background pb-32">
      <Header title={initialTask ? "Edit Task" : "Create Task"} back />

      <main className="flex-1 px-4 py-6 space-y-6">
        {/* Main Task Details Card */}
        <div className="space-y-4 rounded-xl bg-surface p-4">
          <label className="flex flex-col flex-1">
            <p className="text-text-primary text-base font-medium leading-normal pb-2">
              Task Name
            </p>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Read for 30 minutes"
              className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent bg-surface-light h-14 placeholder:text-text-muted p-4 text-base font-normal leading-normal"
            />
          </label>

          <label className="flex flex-col flex-1">
            <p className="text-text-primary text-base font-medium leading-normal pb-2">
              Description (optional)
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Finish 'Atomic Habits'"
              className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent bg-surface-light min-h-24 placeholder:text-text-muted p-4 text-base font-normal leading-normal"
            />
          </label>

          {/* Reward Points */}
          <div className="flex items-center gap-4 min-h-14 justify-between pt-2">
            <div className="flex items-center gap-4">
              <div className="text-primary flex items-center justify-center rounded-lg bg-primary/20 shrink-0 size-10">
                <Stars className="w-5 h-5" />
              </div>
              <p className="text-text-primary text-base font-normal leading-normal flex-1 truncate">
                Reward Points
              </p>
            </div>
            <div className="shrink-0">
              <div className="flex items-center gap-2 text-text-primary">
                <button
                  onClick={() => setRewardPoints(Math.max(0, rewardPoints - 5))}
                  className="text-lg font-medium leading-normal flex h-8 w-8 items-center justify-center rounded-full bg-surface-light hover:bg-surface-light/80 transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  value={rewardPoints}
                  onChange={(e) => setRewardPoints(parseInt(e.target.value) || 0)}
                  className="text-base font-medium leading-normal w-12 p-0 text-center bg-transparent focus:outline-none focus:ring-0 border-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  onClick={() => setRewardPoints(rewardPoints + 5)}
                  className="text-lg font-medium leading-normal flex h-8 w-8 items-center justify-center rounded-full bg-surface-light hover:bg-surface-light/80 transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Enabled Toggle */}
          <div className="flex items-center gap-4 min-h-14 justify-between pt-2">
            <p className="text-text-primary text-base font-normal leading-normal">
              Enabled
            </p>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                enabled ? "bg-primary" : "bg-surface-light"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Repeat Section Card */}
        <div>
          <h3 className="text-text-primary text-lg font-bold leading-tight tracking-[-0.015em] px-2 pb-2 pt-4">
            Repeat
          </h3>
          <div className="rounded-xl bg-surface p-4 space-y-4">
            <RadioGroup
              list={repeatOptions}
              value={repeatIndex}
              onChange={setRepeatIndex}
            />

            {/* Repeat Interval */}
            {repeatMode !== "none" && (
              <div className="flex items-center gap-4 pt-2 border-t border-surface-light">
                <p className="text-text-secondary text-sm">Every</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRepeatInterval(Math.max(1, repeatInterval - 1))}
                    className="text-base font-medium flex h-7 w-7 items-center justify-center rounded-full bg-surface-light hover:bg-surface-light/80 transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={repeatInterval}
                    onChange={(e) => setRepeatInterval(Math.max(1, parseInt(e.target.value) || 1))}
                    className="text-base font-medium w-10 p-0 text-center bg-transparent focus:outline-none focus:ring-0 border-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => setRepeatInterval(repeatInterval + 1)}
                    className="text-base font-medium flex h-7 w-7 items-center justify-center rounded-full bg-surface-light hover:bg-surface-light/80 transition-colors"
                  >
                    +
                  </button>
                </div>
                <p className="text-text-secondary text-sm">
                  {repeatMode === "daily" && "days"}
                  {repeatMode === "weekly" && "weeks"}
                  {repeatMode === "monthly" && "months"}
                </p>
              </div>
            )}

            {/* Weekly Repeat Days */}
            {repeatMode === "weekly" && (
              <div className="pt-2 border-t border-surface-light">
                <p className="text-text-secondary text-sm mb-3">On days</p>
                <MultiSelectGrid
                  list={weekDays}
                  value={repeatDaysOfWeek}
                  onChange={handleWeekDayChange}
                  maxCol={7}
                />
              </div>
            )}

            {/* Monthly Repeat Days */}
            {repeatMode === "monthly" && (
              <div className="pt-2 border-t border-surface-light">
                <p className="text-text-secondary text-sm mb-3">On days</p>
                <MultiSelectGrid
                  list={monthDays}
                  value={repeatDaysOfMonth}
                  onChange={handleMonthDayChange}
                  maxCol={7}
                />
              </div>
            )}
          </div>
        </div>

        {/* Ends Section Card */}
        <div>
          <h3 className="text-text-primary text-lg font-bold leading-tight tracking-[-0.015em] px-2 pb-2 pt-4">
            Ends
          </h3>
          <div className="rounded-xl bg-surface p-4 space-y-4">
            <RadioGroup
              list={endOptions}
              value={endIndex}
              onChange={setEndIndex}
            />

            {/* End Value Input */}
            {endCondition === "date" && (
              <div className="pt-2 border-t border-surface-light">
                <input
                  type="date"
                  value={endValue}
                  onChange={(e) => setEndValue(e.target.value)}
                  className="w-full h-12 px-4 rounded-lg bg-surface-light text-text-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent"
                />
              </div>
            )}

            {endCondition === "times" && (
              <div className="flex items-center gap-4 pt-2 border-t border-surface-light">
                <p className="text-text-secondary text-sm">After</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEndValue(String(Math.max(1, (parseInt(endValue) || 1) - 1)))}
                    className="text-base font-medium flex h-7 w-7 items-center justify-center rounded-full bg-surface-light hover:bg-surface-light/80 transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={endValue}
                    onChange={(e) => setEndValue(e.target.value)}
                    className="text-base font-medium w-12 p-0 text-center bg-transparent focus:outline-none focus:ring-0 border-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => setEndValue(String((parseInt(endValue) || 0) + 1))}
                    className="text-base font-medium flex h-7 w-7 items-center justify-center rounded-full bg-surface-light hover:bg-surface-light/80 transition-colors"
                  >
                    +
                  </button>
                </div>
                <p className="text-text-secondary text-sm">times</p>
              </div>
            )}
          </div>
        </div>

        {/* Subtasks Section Card */}
        <div>
          <div className="flex items-center justify-between px-2 pb-2 pt-4">
            <h3 className="text-text-primary text-lg font-bold leading-tight tracking-[-0.015em]">
              Checklist
            </h3>
            {subtasks.length > 0 && (
              <button
                onClick={() => setIsRandomSubtask(!isRandomSubtask)}
                className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                  isRandomSubtask ? "text-primary" : "text-text-secondary"
                }`}
              >
                <Shuffle className="w-4 h-4" />
                <span>Random</span>
              </button>
            )}
          </div>
          <div className="space-y-3 rounded-xl bg-surface p-4">
            {/* Add new subtask */}
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddSubtask();
                  }
                }}
                placeholder="Add a subtask"
                className="flex w-full min-w-0 flex-1 bg-transparent text-text-primary focus:outline-none border-b-2 border-transparent focus:border-primary text-base font-normal leading-normal py-1"
              />
              <button
                onClick={handleAddSubtask}
                disabled={!newSubtask.trim()}
                className="text-primary disabled:text-text-muted font-medium text-sm px-3 py-1 rounded-lg hover:bg-primary/10 disabled:hover:bg-transparent transition-colors"
              >
                Add
              </button>
            </div>

            {/* Subtask list */}
            {subtasks.map((subtask, index) => (
              <div
                key={index}
                className="flex items-center gap-3 group"
              >
                <span className="text-text-secondary text-sm w-6">{index + 1}.</span>
                <input
                  type="text"
                  value={subtask}
                  onChange={(e) => {
                    const newSubtasks = [...subtasks];
                    newSubtasks[index] = e.target.value;
                    setSubtasks(newSubtasks);
                  }}
                  className="flex w-full min-w-0 flex-1 bg-transparent text-text-primary focus:outline-none border-b-2 border-transparent focus:border-primary text-base font-normal leading-normal py-1"
                />
                <button
                  onClick={() => handleDeleteSubtask(index)}
                  className="text-text-muted hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}

            {subtasks.length === 0 && (
              <p className="text-text-muted text-sm text-center py-4">
                No subtasks yet. Add one above.
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Bottom CTA Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-8 bg-gradient-to-t from-background to-transparent">
        <button
          onClick={handleSubmit}
          disabled={!title.trim()}
          className="w-full h-14 bg-primary text-white font-bold text-lg rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {initialTask ? "Update Task" : "Create Task"}
        </button>
      </div>
    </div>
  );
}
