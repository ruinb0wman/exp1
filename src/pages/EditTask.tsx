import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { Header } from "../components/Header";
import { RadioGroup } from "../components/RadioGroup";
import { MultiSelectGrid } from "../components/MultiSelectGrid";
import { DatePicker } from "../components/DatePicker";
import { Stars, Trash2, Shuffle, Loader2 } from "lucide-react";
import { useUserStore } from "@/store";
import { useTaskTemplate, useTaskTemplateActions } from "@/hooks/useTasks";
import type { TaskTemplate, RepeatMode, EndCondition, CompleteRule } from "../db/types/task";

const repeatOptions = ["None", "Daily", "Weekly", "Monthly"];
const repeatValues: RepeatMode[] = ["none", "daily", "weekly", "monthly"];

const endOptions = ["Manual", "On Date", "After Times"];
const endValues: EndCondition[] = ["manual", "date", "times"];

const completeRuleOptions = ["Simple", "Time", "Count"];
const completeRuleValues: (CompleteRule | undefined)[] = [undefined, "time", "count"];
const completeRuleLabels = {
  time: "分钟",
  count: "次",
};

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

export function EditTask() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useUserStore();
  const isEditMode = id && id !== "new";
  const templateId = isEditMode ? parseInt(id, 10) : null;

  // 获取现有任务数据（编辑模式）
  const {
    template: existingTemplate,
    isLoading: isLoadingTemplate,
    error: loadError,
  } = useTaskTemplate(templateId);

  const { create, update, isLoading: isSubmitting } = useTaskTemplateActions();

  // 表单状态
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rewardPoints, setRewardPoints] = useState(10);
  const [repeatIndex, setRepeatIndex] = useState(0);
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatDaysOfWeek, setRepeatDaysOfWeek] = useState<number[]>([]);
  const [repeatDaysOfMonth, setRepeatDaysOfMonth] = useState<number[]>([]);
  const [endIndex, setEndIndex] = useState(0);
  const [endValue, setEndValue] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [isRandomSubtask, setIsRandomSubtask] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");

  // 完成规则相关状态
  const [completeRule, setCompleteRule] = useState<CompleteRule | undefined>(undefined);
  const [completeTarget, setCompleteTarget] = useState<number>(1);
  const [completeExpireDays, setCompleteExpireDays] = useState<number>(0);

  // 开始时间
  const [startAt, setStartAt] = useState<string>("");
  // Schedule 是否启用
  const [isScheduleEnabled, setIsScheduleEnabled] = useState(false);

  // 加载现有数据（编辑模式）
  useEffect(() => {
    if (existingTemplate) {
      setTitle(existingTemplate.title);
      setDescription(existingTemplate.description ?? "");
      setRewardPoints(existingTemplate.rewardPoints);
      setRepeatIndex(repeatValues.indexOf(existingTemplate.repeatMode));
      setRepeatInterval(existingTemplate.repeatInterval ?? 1);
      setRepeatDaysOfWeek(existingTemplate.repeatDaysOfWeek ?? []);
      setRepeatDaysOfMonth(existingTemplate.repeatDaysOfMonth ?? []);
      setEndIndex(endValues.indexOf(existingTemplate.endCondition));
      setEndValue(existingTemplate.endValue ?? "");
      setEnabled(existingTemplate.enabled);
      setSubtasks(existingTemplate.subtasks ?? []);
      setIsRandomSubtask(existingTemplate.isRandomSubtask);
      // 加载完成规则
      setCompleteRule(existingTemplate.completeRule);
      setCompleteTarget(existingTemplate.completeTarget ?? 1);
      setCompleteExpireDays(existingTemplate.completeExpireDays ?? 0);
      // 加载开始时间和 schedule 启用状态
      setStartAt(existingTemplate.startAt ?? "");
      setIsScheduleEnabled(!!existingTemplate.startAt);
    }
  }, [existingTemplate]);

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

  const handleSubmit = async () => {
    if (!user?.id) {
      alert("User not initialized");
      return;
    }

    const taskData: Omit<TaskTemplate, "id" | "createdAt" | "updatedAt"> = {
      userId: user.id,
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
      completeRule,
      completeTarget: completeRule ? completeTarget : undefined,
      completeExpireDays: completeRule ? completeExpireDays : undefined,
      startAt: isScheduleEnabled ? startAt || undefined : undefined,
    };

    try {
      if (isEditMode && templateId) {
        await update(templateId, taskData);
      } else {
        await create(taskData);
      }
      navigate("/tasks", { replace: true });
    } catch (error) {
      console.error("Failed to save task:", error);
      alert(error instanceof Error ? error.message : "Failed to save task");
    }
  };

  const repeatMode = repeatValues[repeatIndex];
  const endCondition = endValues[endIndex];
  const completeRuleIndex = completeRuleValues.indexOf(completeRule);

  // 加载中状态
  if (isEditMode && isLoadingTemplate) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-text-muted">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p>Loading task...</p>
        </div>
      </div>
    );
  }

  // 加载错误
  if (isEditMode && loadError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-text-muted">
          <p>Failed to load task</p>
          <button
            onClick={() => navigate("/tasks")}
            className="text-primary hover:text-primary-light"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <Header title={isEditMode ? "Edit Task" : "Create Task"} back />

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

        {/* Complete Rule Section Card */}
        <div>
          <h3 className="text-text-primary text-lg font-bold leading-tight tracking-[-0.015em] px-2 pb-2 pt-4">
            Complete Rule
          </h3>
          <div className="rounded-xl bg-surface p-4 space-y-4">
            <RadioGroup
              list={completeRuleOptions}
              value={completeRuleIndex}
              onChange={(index) => setCompleteRule(completeRuleValues[index])}
            />

            {/* Time/Count Target Input */}
            {completeRule && (
              <div className="pt-2 border-t border-surface-light">
                {/* Target */}
                <div className="flex items-center gap-4">
                  <p className="text-text-secondary text-sm min-w-[60px]">Target</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCompleteTarget(Math.max(1, completeTarget - 1))}
                      className="text-base font-medium flex h-7 w-7 items-center justify-center rounded-full bg-surface-light hover:bg-surface-light/80 transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={completeTarget}
                      onChange={(e) => setCompleteTarget(Math.max(1, parseInt(e.target.value) || 1))}
                      className="text-base font-medium w-14 p-0 text-center bg-transparent focus:outline-none focus:ring-0 border-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => setCompleteTarget(completeTarget + 1)}
                      className="text-base font-medium flex h-7 w-7 items-center justify-center rounded-full bg-surface-light hover:bg-surface-light/80 transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-text-secondary text-sm">
                    {completeRuleLabels[completeRule]}
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Schedule Card - Start At & Expire */}
        <div>
          <div className="flex items-center justify-between px-2 pb-2 pt-4">
            <h3 className="text-text-primary text-lg font-bold leading-tight tracking-[-0.015em]">
              Schedule
            </h3>
            {/* Schedule 启用开关 */}
            <button
              onClick={() => {
                setIsScheduleEnabled(!isScheduleEnabled);
                if (isScheduleEnabled) {
                  // 禁用时清空 startAt 和 expire
                  setStartAt('');
                  setCompleteExpireDays(0);
                }
              }}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                isScheduleEnabled ? "bg-primary" : "bg-surface-light"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  isScheduleEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <div className="rounded-xl bg-surface p-4 space-y-4">
            {/* Start At - 只有启用 schedule 时才可编辑 */}
            <div className={`flex items-center gap-4 ${!isScheduleEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <p className="text-text-secondary text-sm min-w-[80px]">Start from</p>
              <div className="flex-1">
                <DatePicker
                  value={startAt ? (() => {
                    const [year, month, day] = startAt.split('-').map(Number);
                    return new Date(year, month - 1, day);
                  })() : null}
                  onChange={(date) => {
                    if (!date) {
                      setStartAt('');
                      // 清空 startAt 时，同时清空 expire
                      setCompleteExpireDays(0);
                      return;
                    }
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    setStartAt(`${year}-${month}-${day}`);
                  }}
                  placeholder="Today (default)"
                  minDate={new Date()}
                />
              </div>
            </div>

            {/* Expire Days - 只有在启用了 schedule 时才可设置 */}
            <div className={`flex items-center gap-4 pt-4 border-t border-surface-light ${!isScheduleEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <p className="text-text-secondary text-sm min-w-[80px]">Expire after</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCompleteExpireDays(Math.max(0, completeExpireDays - 1))}
                  className="text-base font-medium flex h-7 w-7 items-center justify-center rounded-full bg-surface-light hover:bg-surface-light/80 transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  min={0}
                  value={completeExpireDays}
                  onChange={(e) => setCompleteExpireDays(Math.max(0, parseInt(e.target.value) || 0))}
                  className="text-base font-medium w-14 p-0 text-center bg-transparent focus:outline-none focus:ring-0 border-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  onClick={() => setCompleteExpireDays(completeExpireDays + 1)}
                  className="text-base font-medium flex h-7 w-7 items-center justify-center rounded-full bg-surface-light hover:bg-surface-light/80 transition-colors"
                >
                  +
                </button>
              </div>
              <p className="text-text-secondary text-sm">days (0 = never)</p>
            </div>
            {!isScheduleEnabled && (
              <p className="text-text-muted text-xs">Enable schedule to set start date and expiration</p>
            )}
          </div>
        </div>

        {/* Repeat & Ends Card */}
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

            {/* Ends Section - 只有在 repeat 不为 none 时才显示 */}
            {repeatMode !== "none" && (
              <div className="pt-4 border-t border-surface-light space-y-4">
                <p className="text-text-primary text-sm font-medium">Ends</p>
                <RadioGroup
                  list={endOptions}
                  value={endIndex}
                  onChange={setEndIndex}
                />

                {/* End Value Input */}
                {endCondition === "date" && (
                  <div className="pt-2 border-t border-surface-light">
                    <DatePicker
                      value={endValue ? (() => {
                        // 将 YYYY-MM-DD 字符串解析为本地日期（避免时区问题）
                        const [year, month, day] = endValue.split('-').map(Number);
                        return new Date(year, month - 1, day);
                      })() : null}
                      onChange={(date) => {
                        // 将本地日期转为 YYYY-MM-DD 字符串
                        if (!date) {
                          setEndValue('');
                          return;
                        }
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        setEndValue(`${year}-${month}-${day}`);
                      }}
                      placeholder="Select end date"
                      minDate={new Date()}
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
          disabled={!title.trim() || isSubmitting}
          className="w-full h-14 bg-primary text-white font-bold text-lg rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : isEditMode ? (
            "Update Task"
          ) : (
            "Create Task"
          )}
        </button>
      </div>
    </div>
  );
}
