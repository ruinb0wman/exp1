import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { Header } from "../components/Header";
import { RadioGroup } from "../components/RadioGroup";
import { MultiSelectGrid } from "../components/MultiSelectGrid";
import { DatePicker } from "../components/DatePicker";
import { Trash2, Shuffle, Loader2, Plus } from "lucide-react";
import { useUserStore } from "@/store";
import { useTaskTemplate, useTaskTemplateActions } from "@/hooks/useTasks";
import type { TaskTemplate, RepeatMode, EndCondition, CompleteRule, Stage, SubtaskConfig, TaskType } from "../db/types/task";
import { NumberInput } from "@/components/NumberInput";

const repeatOptions = ["None", "Daily", "Weekly", "Monthly"];
const repeatValues: RepeatMode[] = ["none", "daily", "weekly", "monthly"];

const endOptions = ["Manual", "On Date", "After Times"];
const endValues: EndCondition[] = ["manual", "date", "times"];

const taskTypeOptions = ["Simple", "Time", "Count", "Subtask"];
const taskTypeValues: (TaskType | undefined)[] = [undefined, "time", "count", "subtask"];

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

  const {
    template: existingTemplate,
    isLoading: isLoadingTemplate,
    error: loadError,
  } = useTaskTemplate(templateId);

  const { create, update, isLoading: isSubmitting } = useTaskTemplateActions();

  // 表单状态
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
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

  // 完成规则相关状态（新系统）
  const [taskType, setTaskType] = useState<TaskType | undefined>(undefined);
  const [stages, setStages] = useState<Stage[]>([]);
  const [completionPoints, setCompletionPoints] = useState(0);
  const [completeExpireDays, setCompleteExpireDays] = useState<number>(0);
  
  // 子任务配置
  const [subtaskMode, setSubtaskMode] = useState<SubtaskConfig['mode']>('all');
  const [requiredCount, setRequiredCount] = useState(1);
  const [pointsPerSubtask, setPointsPerSubtask] = useState<number[]>([]);

  // 开始时间
  const [startAt, setStartAt] = useState<string>("");
  const [isScheduleEnabled, setIsScheduleEnabled] = useState(false);

  // 加载现有数据（编辑模式）
  useEffect(() => {
    if (existingTemplate) {
      setTitle(existingTemplate.title);
      setDescription(existingTemplate.description ?? "");
      setRepeatIndex(repeatValues.indexOf(existingTemplate.repeatMode));
      setRepeatInterval(existingTemplate.repeatInterval ?? 1);
      setRepeatDaysOfWeek(existingTemplate.repeatDaysOfWeek ?? []);
      setRepeatDaysOfMonth(existingTemplate.repeatDaysOfMonth ?? []);
      setEndIndex(endValues.indexOf(existingTemplate.endCondition));
      
      const formatToDateStr = (isoStr: string | undefined): string => {
        if (!isoStr) return "";
        const date = new Date(isoStr);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      setEndValue(formatToDateStr(existingTemplate.endValue));
      setEnabled(existingTemplate.enabled);
      setSubtasks(existingTemplate.subtasks ?? []);
      setIsRandomSubtask(existingTemplate.isRandomSubtask);
      
      // 加载新的完成规则
      const rule = existingTemplate.completeRule;
      if (rule) {
        setTaskType(rule.type);
        setStages(rule.stages || []);
        setCompletionPoints(rule.completionPoints || 0);
        
        if (rule.type === 'subtask' && rule.subtaskConfig) {
          setSubtaskMode(rule.subtaskConfig.mode);
          setRequiredCount(rule.subtaskConfig.requiredCount || 1);
          setPointsPerSubtask(rule.subtaskConfig.pointsPerSubtask || []);
        }
      } else {
        // 旧数据兼容：如果有 completeTarget 但没有 completeRule
        const oldType = existingTemplate.completeRule as unknown as 'time' | 'count' | undefined;
        const oldTarget = existingTemplate.completeTarget;
        const oldReward = existingTemplate.rewardPoints;
        
        if (oldType && oldTarget) {
          setTaskType(oldType);
          setStages([{
            id: `legacy_${Date.now()}`,
            threshold: oldTarget,
            points: oldReward
          }]);
          setCompletionPoints(0);
        } else {
          setTaskType(undefined);
          setStages([]);
          setCompletionPoints(0);
        }
      }
      
      setCompleteExpireDays(existingTemplate.completeExpireDays ?? 0);
      setStartAt(formatToDateStr(existingTemplate.startAt));
      setIsScheduleEnabled(!!existingTemplate.startAt);
    }
  }, [existingTemplate]);

  // 当子任务变化时，同步更新 pointsPerSubtask
  useEffect(() => {
    setPointsPerSubtask(prev => {
      const newArray = [...prev];
      // 确保长度与子任务一致
      while (newArray.length < subtasks.length) {
        newArray.push(0);
      }
      // 截断多余的部分
      return newArray.slice(0, subtasks.length);
    });
  }, [subtasks.length]);

  const handleAddSubtask = () => {
    if (newSubtask.trim()) {
      setSubtasks([...subtasks, newSubtask.trim()]);
      setNewSubtask("");
    }
  };

  const handleDeleteSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
    setPointsPerSubtask(pointsPerSubtask.filter((_, i) => i !== index));
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

  // 阶段管理
  const addStage = () => {
    const lastStage = stages[stages.length - 1];
    const newThreshold = lastStage 
      ? lastStage.threshold + (taskType === 'time' ? 5 : 1)
      : (taskType === 'time' ? 5 : 1);
    
    setStages([...stages, {
      id: `stage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      threshold: newThreshold,
      points: 1
    }]);
  };

  const updateStage = (index: number, field: keyof Stage, value: number) => {
    const newStages = [...stages];
    newStages[index] = { ...newStages[index], [field]: value };
    setStages(newStages);
  };

  const removeStage = (index: number) => {
    setStages(stages.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      alert("User not initialized");
      return;
    }

    const formatToUTCISO = (dateStr: string): string | undefined => {
      if (!dateStr) return undefined;
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
    };

    // 构建 CompleteRule
    let completeRule: CompleteRule | undefined = undefined;
    
    if (taskType) {
      if (taskType === 'subtask') {
        completeRule = {
          type: 'subtask',
          stages: [],
          completionPoints,
          subtaskConfig: {
            mode: subtaskMode,
            requiredCount: subtaskMode === 'partial' ? requiredCount : undefined,
            pointsPerSubtask
          }
        };
      } else {
        completeRule = {
          type: taskType,
          stages,
          completionPoints
        };
      }
    }

    const taskData: Omit<TaskTemplate, "id" | "createdAt" | "updatedAt"> = {
      userId: user.id,
      title,
      description: description || undefined,
      rewardPoints: 0, // 新系统不再使用，积分由 stages 决定
      repeatMode: repeatValues[repeatIndex],
      repeatInterval: repeatValues[repeatIndex] !== "none" ? repeatInterval : undefined,
      repeatDaysOfWeek: repeatValues[repeatIndex] === "weekly" ? repeatDaysOfWeek : undefined,
      repeatDaysOfMonth: repeatValues[repeatIndex] === "monthly" ? repeatDaysOfMonth : undefined,
      endCondition: endValues[endIndex],
      endValue: endValues[endIndex] !== "manual" ? formatToUTCISO(endValue) : undefined,
      enabled,
      subtasks,
      isRandomSubtask,
      completeRule,
      completeTarget: undefined, // 旧字段，不再使用
      completeExpireDays: completeExpireDays > 0 ? completeExpireDays : undefined,
      startAt: isScheduleEnabled ? formatToUTCISO(startAt) : undefined,
    };

    try {
      if (isEditMode && templateId) {
        await update(templateId, taskData);
      } else {
        await create(taskData);
      }
      navigate(-1);
    } catch (error) {
      console.error("Failed to save task:", error);
      alert(error instanceof Error ? error.message : "Failed to save task");
    }
  };

  const repeatMode = repeatValues[repeatIndex];
  const endCondition = endValues[endIndex];
  const taskTypeIndex = taskTypeValues.indexOf(taskType);

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
    <div className="min-h-screen bg-background">
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
            Task Type
          </h3>
          <div className="rounded-xl bg-surface p-4 space-y-4">
            <RadioGroup
              list={taskTypeOptions}
              value={taskTypeIndex}
              onChange={(index) => {
                const newType = taskTypeValues[index];
                setTaskType(newType);
                if (newType && newType !== 'subtask' && stages.length === 0) {
                  // 自动添加一个默认阶段
                  addStage();
                }
              }}
            />

            {/* Simple 类型积分设置 */}
            {taskType === undefined && (
              <div className="pt-4 border-t border-surface-light">
                <div className="flex items-center justify-between">
                  <div className="text-text-secondary text-sm">
                    完成获得积分
                  </div>
                  <NumberInput
                    value={completionPoints}
                    onChange={setCompletionPoints}
                    min={0}
                    size="md"
                  />
                </div>
              </div>
            )}

            {/* Time/Count 阶段配置 */}
            {(taskType === 'time' || taskType === 'count') && (
              <div className="pt-4 border-t border-surface-light space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-text-secondary text-sm">
                    阶段配置（达到目标获得积分）
                  </p>
                  <button
                    onClick={addStage}
                    className="flex items-center gap-1 text-sm text-primary hover:text-primary-light"
                  >
                    <Plus className="w-4 h-4" />
                    添加阶段
                  </button>
                </div>

                {stages.map((stage, index) => (
                  <div key={stage.id} className="flex items-center gap-3 bg-surface-light p-3 rounded-xl">
                    <span className="text-text-muted w-6">#{index + 1}</span>
                    
                    <div className="flex-1">
                      <label className="text-xs text-text-muted block mb-1">
                        达到{taskType === 'time' ? '（分钟）' : '（次数）'}
                      </label>
                      <NumberInput
                        value={stage.threshold}
                        onChange={(value) => updateStage(index, 'threshold', value)}
                        min={1}
                        size="sm"
                        inputWidth="w-16"
                      />
                    </div>
                    
                    <div className="flex-1">
                      <label className="text-xs text-text-muted block mb-1">获得积分</label>
                      <NumberInput
                        value={stage.points}
                        onChange={(value) => updateStage(index, 'points', value)}
                        min={0}
                        size="sm"
                        inputWidth="w-16"
                      />
                    </div>
                    
                    <button
                      onClick={() => removeStage(index)}
                      className="p-2 text-text-muted hover:text-error"
                      disabled={stages.length <= 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* 完成额外积分 */}
                <div className="flex items-center justify-between pt-2 border-t border-surface-light">
                  <div className="text-text-secondary text-sm">
                    全部完成额外奖励
                  </div>
                  <NumberInput
                    value={completionPoints}
                    onChange={setCompletionPoints}
                    min={0}
                    size="md"
                    inputWidth="w-12"
                  />
                </div>

                {/* 积分预览 */}
                <div className="text-sm text-text-muted pt-2">
                  最高可获得：{stages.reduce((sum, s) => sum + s.points, 0) + completionPoints} 积分
                </div>
              </div>
            )}

            {/* Subtask 配置 */}
            {taskType === 'subtask' && (
              <div className="pt-4 border-t border-surface-light space-y-4">
                {/* Checklist */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-text-secondary text-sm">子任务列表</div>
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
                  {/* 添加新子任务 */}
                  <div className="flex items-center gap-3 bg-surface-light p-3 rounded-xl">
                    <span className="text-text-muted text-sm">New</span>
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
                      className="flex-1 bg-transparent text-text-primary focus:outline-none border-b-2 border-transparent focus:border-primary text-base font-normal leading-normal py-1"
                    />
                    <NumberInput
                      value={0}
                      onChange={() => {}}
                      min={0}
                      size="sm"
                      inputWidth="w-10"
                      disabled
                    />
                    <button
                      onClick={handleAddSubtask}
                      disabled={!newSubtask.trim()}
                      className="text-primary disabled:text-text-muted font-medium text-sm px-2 py-1 rounded-lg hover:bg-primary/10 disabled:hover:bg-transparent transition-colors"
                    >
                      Add
                    </button>
                  </div>

                  {/* 子任务列表 */}
                  {subtasks.map((subtask, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 bg-surface-light p-3 rounded-xl"
                    >
                      <span className="text-text-muted text-sm w-6">{index + 1}.</span>
                      <input
                        type="text"
                        value={subtask}
                        onChange={(e) => {
                          const newSubtasks = [...subtasks];
                          newSubtasks[index] = e.target.value;
                          setSubtasks(newSubtasks);
                        }}
                        className="flex-1 bg-transparent text-text-primary focus:outline-none border-b-2 border-transparent focus:border-primary text-base font-normal leading-normal py-1"
                      />
                      <NumberInput
                        value={pointsPerSubtask[index] || 0}
                        onChange={(value) => {
                          const newPoints = [...pointsPerSubtask];
                          newPoints[index] = value;
                          setPointsPerSubtask(newPoints);
                        }}
                        min={0}
                        size="sm"
                        inputWidth="w-10"
                      />
                      <button
                        onClick={() => handleDeleteSubtask(index)}
                        className="text-text-muted hover:text-primary transition-colors opacity-0 group-hover:opacity-100 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {subtasks.length === 0 && (
                    <p className="text-text-muted text-sm text-center py-4">
                      No subtasks yet. Add one above.
                    </p>
                  )}
                </div>

                {/* 子任务模式选择 */}
                <div className="flex gap-4 pt-4 border-t border-surface-light">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={subtaskMode === 'all'}
                      onChange={() => setSubtaskMode('all')}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-text-primary text-sm">完成所有子任务</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={subtaskMode === 'partial'}
                      onChange={() => setSubtaskMode('partial')}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-text-primary text-sm">完成指定数量</span>
                  </label>
                </div>

                {/* Partial 模式：设置需要完成的数量 */}
                {subtaskMode === 'partial' && (
                  <div className="flex items-center gap-2">
                    <span className="text-text-secondary text-sm">完成</span>
                    <NumberInput
                      value={requiredCount}
                      onChange={(value) => setRequiredCount(Math.min(subtasks.length, Math.max(1, value)))}
                      min={1}
                      max={subtasks.length || 1}
                      size="sm"
                      inputWidth="w-14"
                    />
                    <span className="text-text-secondary text-sm">项即可</span>
                  </div>
                )}

                {/* 完成额外积分 */}
                <div className="flex items-center justify-between pt-2 border-t border-surface-light">
                  <div className="text-text-secondary text-sm">
                    全部完成额外奖励
                  </div>
                  <NumberInput
                    value={completionPoints}
                    onChange={setCompletionPoints}
                    min={0}
                    size="md"
                    inputWidth="w-12"
                  />
                </div>

                {/* 积分预览 */}
                <div className="text-sm text-text-muted pt-2">
                  {subtaskMode === 'all' 
                    ? `最高可获得：${pointsPerSubtask.reduce((sum, p) => sum + (p || 0), 0) + completionPoints} 积分`
                    : `最高可获得：${[...pointsPerSubtask].sort((a, b) => (b || 0) - (a || 0)).slice(0, requiredCount).reduce((sum, p) => sum + (p || 0), 0) + completionPoints} 积分`
                  }
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
            <button
              onClick={() => {
                const newEnabled = !isScheduleEnabled;
                setIsScheduleEnabled(newEnabled);
                if (newEnabled) {
                  const today = new Date();
                  const year = today.getFullYear();
                  const month = String(today.getMonth() + 1).padStart(2, '0');
                  const day = String(today.getDate()).padStart(2, '0');
                  setStartAt(`${year}-${month}-${day}`);
                } else {
                  setStartAt('');
                  setCompleteExpireDays(0);
                  setRepeatIndex(0);
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
          <div className={`rounded-xl bg-surface p-4 space-y-4 ${!isScheduleEnabled ? 'opacity-50' : ''}`}>
            <RadioGroup
              list={repeatOptions}
              value={repeatIndex}
              onChange={(index) => {
                if (isScheduleEnabled) {
                  setRepeatIndex(index);
                }
              }}
            />
            {!isScheduleEnabled && (
              <p className="text-text-muted text-xs">Enable schedule to set repeat mode</p>
            )}

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

            {repeatMode !== "none" && (
              <div className="pt-4 border-t border-surface-light space-y-4">
                <p className="text-text-primary text-sm font-medium">Ends</p>
                <RadioGroup
                  list={endOptions}
                  value={endIndex}
                  onChange={setEndIndex}
                />

                {endCondition === "date" && (
                  <div className="pt-2 border-t border-surface-light">
                    <DatePicker
                      value={endValue ? (() => {
                        const [year, month, day] = endValue.split('-').map(Number);
                        return new Date(year, month - 1, day);
                      })() : null}
                      onChange={(date) => {
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

      </main>

      {/* Bottom CTA Button */}
      <div className="px-4 pb-8 pt-4">
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
