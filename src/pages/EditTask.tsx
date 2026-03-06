import { useState } from "react";
import { Header } from "../components/Header";
import { RadioGroup } from "../components/RadioGroup";
import { CalendarX, Stars, Trash2, Circle, CheckCircle2 } from "lucide-react";

const repeatOptions = ["None", "Daily", "Weekly", "Monthly"];
const repeatValues = ["none", "daily", "weekly", "monthly"] as const;

const endOptions = ["Never", "On Date", "After Count"];
const endValues = ["never", "date", "count"] as const;

interface Subtask {
  id: number;
  title: string;
  completed: boolean;
}

export function EditTask() {
  const [taskName, setTaskName] = useState("");
  const [description, setDescription] = useState("");
  const [rewardPoints, setRewardPoints] = useState(10);
  const [repeatIndex, setRepeatIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(0);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState("");

  const handleAddSubtask = () => {
    if (newSubtask.trim()) {
      setSubtasks([
        ...subtasks,
        { id: Date.now(), title: newSubtask.trim(), completed: false },
      ]);
      setNewSubtask("");
    }
  };

  const handleToggleSubtask = (id: number) => {
    setSubtasks(
      subtasks.map((st) =>
        st.id === id ? { ...st, completed: !st.completed } : st
      )
    );
  };

  const handleDeleteSubtask = (id: number) => {
    setSubtasks(subtasks.filter((st) => st.id !== id));
  };

  const handleSubmit = () => {
    // TODO: Submit task data
    console.log({
      taskName,
      description,
      rewardPoints,
      repeat: repeatValues[repeatIndex],
      endType: endValues[endIndex],
      subtasks,
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header title="Create Task" back />

      <main className="flex-1 px-4 py-6 space-y-6">
        {/* Main Task Details Card */}
        <div className="space-y-4 rounded-xl bg-surface p-4">
          <label className="flex flex-col flex-1">
            <p className="text-text-primary text-base font-medium leading-normal pb-2">
              Task Name
            </p>
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
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
                  className="text-base font-medium leading-normal w-10 p-0 text-center bg-transparent focus:outline-none focus:ring-0 border-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
        </div>

        {/* Scheduling Section Card */}
        <div>
          <h3 className="text-text-primary text-lg font-bold leading-tight tracking-[-0.015em] px-2 pb-2 pt-4">
            Scheduling
          </h3>
          <div className="space-y-px rounded-xl bg-surface overflow-hidden">
            <div className="flex flex-col gap-3 bg-surface px-4 py-4">
              <p className="text-text-primary text-base font-medium leading-normal">
                Repeat
              </p>
              <RadioGroup
                list={repeatOptions}
                value={repeatIndex}
                onChange={setRepeatIndex}
              />
            </div>

            <div className="flex flex-col gap-3 bg-surface px-4 py-4">
              <p className="text-text-primary text-base font-medium leading-normal">
                Ends
              </p>
              <RadioGroup
                list={endOptions}
                value={endIndex}
                onChange={setEndIndex}
              />
            </div>
          </div>
        </div>

        {/* Subtasks Section Card */}
        <div>
          <h3 className="text-text-primary text-lg font-bold leading-tight tracking-[-0.015em] px-2 pb-2 pt-4">
            Checklist
          </h3>
          <div className="space-y-3 rounded-xl bg-surface p-4">
            {/* Add new subtask */}
            <div className="flex items-center gap-3">
              <Circle className="w-6 h-6 text-text-muted" />
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
            </div>

            {/* Subtask list */}
            {subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className={`flex items-center gap-3 ${
                  subtask.completed ? "opacity-60" : ""
                }`}
              >
                <button
                  onClick={() => handleToggleSubtask(subtask.id)}
                  className="text-text-secondary hover:text-primary transition-colors"
                >
                  {subtask.completed ? (
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                  ) : (
                    <Circle className="w-6 h-6" />
                  )}
                </button>
                <input
                  type="text"
                  value={subtask.title}
                  readOnly={subtask.completed}
                  className={`flex w-full min-w-0 flex-1 bg-transparent text-text-primary focus:outline-none border-b-2 border-transparent focus:border-primary text-base font-normal leading-normal py-1 ${
                    subtask.completed ? "line-through text-text-muted" : ""
                  }`}
                />
                <button
                  onClick={() => handleDeleteSubtask(subtask.id)}
                  className="text-text-muted hover:text-primary transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom CTA Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-8 bg-gradient-to-t from-background to-transparent">
        <button
          onClick={handleSubmit}
          className="w-full h-14 bg-primary text-white font-bold text-lg rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary-light transition-colors"
        >
          Create Task
        </button>
      </div>
    </div>
  );
}
