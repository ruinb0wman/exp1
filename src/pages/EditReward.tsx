import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { Header } from "@/components/Header";
import { RadioGroup } from "@/components/RadioGroup";
import { IconPicker } from "@/components/IconPicker";
import { DynamicIcon } from "@/components/DynamicIcon";
import { MultiSelectGrid } from "@/components/MultiSelectGrid";
import { Package, Clock, Sparkles } from "lucide-react";
import type { RewardTemplate, RewardIconName, RewardIconColor, ReplenishmentMode } from "@/db/types";
import { REWARD_ICON_COLORS } from "@/db/types";
import { useRewardTemplate, useRewardTemplateActions } from "@/hooks/useRewards";
import { useUserStore } from "@/store";

const restockOptions = ["None", "Daily", "Weekly", "Monthly"];
const restockValues: ReplenishmentMode[] = ["none", "daily", "weekly", "monthly"];

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

export function EditReward() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, initUser } = useUserStore();
  const rewardId = id ? parseInt(id) : null;
  
  // 使用 hook 获取奖励模板数据
  const { template, isLoading: isLoadingTemplate } = useRewardTemplate(rewardId);
  const { create, update, isLoading: isSubmitting } = useRewardTemplateActions();
  
  const isEditing = Boolean(rewardId);

  // Basic Info
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pointsCost, setPointsCost] = useState(100);
  const [enabled, setEnabled] = useState(true);

  // Icon
  const [selectedIcon, setSelectedIcon] = useState<RewardIconName>("Gift");
  const [selectedColor, setSelectedColor] = useState<RewardIconColor>(REWARD_ICON_COLORS[0]);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

  // Valid Duration (days) - stored as seconds in DB
  const [validDurationDays, setValidDurationDays] = useState(30);
  const [hasValidDuration, setHasValidDuration] = useState(true);

  // Replenishment
  const [restockIndex, setRestockIndex] = useState(0);
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatDaysOfWeek, setRepeatDaysOfWeek] = useState<number[]>([]);
  const [repeatDaysOfMonth, setRepeatDaysOfMonth] = useState<number[]>([]);
  const [replenishmentNum, setReplenishmentNum] = useState(1);
  const [hasStockLimit, setHasStockLimit] = useState(false);
  const [replenishmentLimit, setReplenishmentLimit] = useState(10);

  // 初始化用户
  useEffect(() => {
    if (!user) {
      initUser();
    }
  }, [user, initUser]);

  // 加载现有奖励数据
  useEffect(() => {
    if (template) {
      setTitle(template.title);
      setDescription(template.description ?? "");
      setPointsCost(template.pointsCost);
      setEnabled(template.enabled);
      setSelectedIcon(template.icon);
      setSelectedColor(template.iconColor ?? REWARD_ICON_COLORS[0]);
      
      // Convert seconds to days for display
      const days = template.validDuration > 0 ? Math.floor(template.validDuration / 86400) : 30;
      setValidDurationDays(days);
      setHasValidDuration(template.validDuration > 0);
      
      setRestockIndex(restockValues.indexOf(template.replenishmentMode));
      setRepeatInterval(template.repeatInterval ?? 1);
      setRepeatDaysOfWeek(template.repeatDaysOfWeek ?? []);
      setRepeatDaysOfMonth(template.repeatDaysOfMonth ?? []);
      setReplenishmentNum(template.replenishmentNum ?? 1);
      setHasStockLimit(template.replenishmentLimit !== undefined);
      setReplenishmentLimit(template.replenishmentLimit ?? 10);
    }
  }, [template]);

  const handleIconSelect = (icon: RewardIconName, color: RewardIconColor) => {
    setSelectedIcon(icon);
    setSelectedColor(color);
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
    if (!user?.id) return;

    // Convert days to seconds for storage
    const validDurationSeconds = hasValidDuration ? validDurationDays * 86400 : 0;

    const rewardData: Omit<RewardTemplate, "id" | "createdAt" | "updatedAt"> = {
      userId: user.id,
      title,
      description: description || undefined,
      pointsCost,
      validDuration: validDurationSeconds,
      enabled,
      replenishmentMode: restockValues[restockIndex],
      repeatInterval: restockValues[restockIndex] !== "none" ? repeatInterval : undefined,
      repeatDaysOfWeek: restockValues[restockIndex] === "weekly" ? repeatDaysOfWeek : undefined,
      repeatDaysOfMonth: restockValues[restockIndex] === "monthly" ? repeatDaysOfMonth : undefined,
      replenishmentNum: restockValues[restockIndex] !== "none" ? replenishmentNum : undefined,
      replenishmentLimit: hasStockLimit ? replenishmentLimit : undefined,
      icon: selectedIcon,
      iconColor: selectedColor,
    };

    try {
      if (isEditing && rewardId) {
        await update(rewardId, rewardData);
      } else {
        await create(rewardData);
      }
      navigate(-1);
    } catch (err) {
      console.error("Failed to save reward:", err);
      alert(err instanceof Error ? err.message : "保存失败");
    }
  };

  const restockMode = restockValues[restockIndex];

  // 加载中状态
  if (isEditing && isLoadingTemplate) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <Header title={isEditing ? "Edit Reward" : "Create Reward"} back />

      <main className="flex-1 px-4 py-6 space-y-6">
        {/* Icon Selector Card */}
        <div className="rounded-xl bg-surface p-4">
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => setIsIconPickerOpen(true)}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-surface-light w-full"
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center transition-colors"
                style={{ backgroundColor: `${selectedColor}20` }}
              >
                <DynamicIcon
                  name={selectedIcon}
                  color={selectedColor}
                  className="w-10 h-10"
                />
              </div>
              <div className="flex items-center gap-2 text-text-secondary text-sm">
                <span>点击更换图标</span>
              </div>
            </button>
          </div>
        </div>

        {/* Basic Information Card */}
        <div className="space-y-4 rounded-xl bg-surface p-4">
          <label className="flex flex-col flex-1">
            <p className="text-text-primary text-base font-medium leading-normal pb-2">
              Reward Name
            </p>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Watch a movie"
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
              placeholder="e.g., Watch a movie after completing all tasks"
              className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent bg-surface-light min-h-24 placeholder:text-text-muted p-4 text-base font-normal leading-normal"
            />
          </label>

          {/* Points Cost */}
          <div className="flex items-center gap-4 min-h-14 justify-between pt-2">
            <div className="flex items-center gap-4">
              <div className="text-primary flex items-center justify-center rounded-lg bg-primary/20 shrink-0 size-10">
                <Sparkles className="w-5 h-5" />
              </div>
              <p className="text-text-primary text-base font-normal leading-normal flex-1 truncate">
                Point Cost
              </p>
            </div>
            <div className="shrink-0">
              <div className="flex items-center gap-2 text-text-primary">
                <button
                  onClick={() => setPointsCost(Math.max(0, pointsCost - 10))}
                  className="text-lg font-medium leading-normal flex h-8 w-8 items-center justify-center rounded-full bg-surface-light hover:bg-surface-light/80 transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  value={pointsCost}
                  onChange={(e) => setPointsCost(parseInt(e.target.value) || 0)}
                  className="text-base font-medium leading-normal w-14 p-0 text-center bg-transparent focus:outline-none focus:ring-0 border-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  onClick={() => setPointsCost(pointsCost + 10)}
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

        {/* Valid Duration Section */}
        <div>
          <h3 className="text-text-primary text-lg font-bold leading-tight tracking-[-0.015em] px-2 pb-2 pt-4">
            Valid Duration
          </h3>
          <div className="rounded-xl bg-surface p-4 space-y-4">
            {/* Enable Valid Duration Toggle */}
            <div className="flex items-center gap-4 min-h-10 justify-between">
              <div className="flex items-center gap-4">
                <div className="text-primary flex items-center justify-center rounded-lg bg-primary/20 shrink-0 size-10">
                  <Clock className="w-5 h-5" />
                </div>
                <p className="text-text-primary text-base font-normal leading-normal">
                  Expires after
                </p>
              </div>
              <button
                onClick={() => setHasValidDuration(!hasValidDuration)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  hasValidDuration ? "bg-primary" : "bg-surface-light"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    hasValidDuration ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {hasValidDuration && (
              <div className="flex items-center gap-4 pt-2 border-t border-surface-light">
                <p className="text-text-secondary text-sm">Valid for</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setValidDurationDays(Math.max(1, validDurationDays - 1))}
                    className="text-base font-medium flex h-7 w-7 items-center justify-center rounded-full bg-surface-light hover:bg-surface-light/80 transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={validDurationDays}
                    onChange={(e) => setValidDurationDays(Math.max(1, parseInt(e.target.value) || 1))}
                    className="text-base font-medium w-12 p-0 text-center bg-transparent focus:outline-none focus:ring-0 border-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => setValidDurationDays(validDurationDays + 1)}
                    className="text-base font-medium flex h-7 w-7 items-center justify-center rounded-full bg-surface-light hover:bg-surface-light/80 transition-colors"
                  >
                    +
                  </button>
                </div>
                <p className="text-text-secondary text-sm">days</p>
              </div>
            )}

            {!hasValidDuration && (
              <p className="text-text-muted text-sm pt-2 border-t border-surface-light">
                Reward will never expire
              </p>
            )}
          </div>
        </div>

        {/* Restock Cycle Section */}
        <div>
          <h3 className="text-text-primary text-lg font-bold leading-tight tracking-[-0.015em] px-2 pb-2 pt-4">
            Auto Restock
          </h3>
          <div className="rounded-xl bg-surface p-4 space-y-4">
            <RadioGroup
              list={restockOptions}
              value={restockIndex}
              onChange={setRestockIndex}
            />

            {/* Restock Interval */}
            {restockMode !== "none" && (
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
                  {restockMode === "daily" && "days"}
                  {restockMode === "weekly" && "weeks"}
                  {restockMode === "monthly" && "months"}
                </p>
              </div>
            )}

            {/* Weekly Restock Days */}
            {restockMode === "weekly" && (
              <div className="pt-2 border-t border-surface-light">
                <p className="text-text-secondary text-sm mb-3">Restock on</p>
                <MultiSelectGrid
                  list={weekDays}
                  value={repeatDaysOfWeek}
                  onChange={handleWeekDayChange}
                  maxCol={7}
                />
              </div>
            )}

            {/* Monthly Restock Days */}
            {restockMode === "monthly" && (
              <div className="pt-2 border-t border-surface-light">
                <p className="text-text-secondary text-sm mb-3">Restock on</p>
                <MultiSelectGrid
                  list={monthDays}
                  value={repeatDaysOfMonth}
                  onChange={handleMonthDayChange}
                  maxCol={7}
                />
              </div>
            )}

            {/* Restock Amount */}
            {restockMode !== "none" && (
              <div className="flex items-center gap-4 pt-2 border-t border-surface-light">
                <div className="flex items-center gap-4 flex-1">
                  <p className="text-text-secondary text-sm">Restock amount</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setReplenishmentNum(Math.max(1, replenishmentNum - 1))}
                      className="text-base font-medium flex h-7 w-7 items-center justify-center rounded-full bg-surface-light hover:bg-surface-light/80 transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={replenishmentNum}
                      onChange={(e) => setReplenishmentNum(Math.max(1, parseInt(e.target.value) || 1))}
                      className="text-base font-medium w-10 p-0 text-center bg-transparent focus:outline-none focus:ring-0 border-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => setReplenishmentNum(replenishmentNum + 1)}
                      className="text-base font-medium flex h-7 w-7 items-center justify-center rounded-full bg-surface-light hover:bg-surface-light/80 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Stock Limit */}
            {restockMode !== "none" && (
              <div className="space-y-4 pt-2 border-t border-surface-light">
                <div className="flex items-center gap-4 min-h-10 justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-primary flex items-center justify-center rounded-lg bg-primary/20 shrink-0 size-10">
                      <Package className="w-5 h-5" />
                    </div>
                    <p className="text-text-primary text-base font-normal leading-normal">
                      Stock Limit
                    </p>
                  </div>
                  <button
                    onClick={() => setHasStockLimit(!hasStockLimit)}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                      hasStockLimit ? "bg-primary" : "bg-surface-light"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        hasStockLimit ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {hasStockLimit && (
                  <div className="flex items-center gap-4">
                    <p className="text-text-secondary text-sm">Max stock</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setReplenishmentLimit(Math.max(1, replenishmentLimit - 1))}
                        className="text-base font-medium flex h-7 w-7 items-center justify-center rounded-full bg-surface-light hover:bg-surface-light/80 transition-colors"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={replenishmentLimit}
                        onChange={(e) => setReplenishmentLimit(Math.max(1, parseInt(e.target.value) || 1))}
                        className="text-base font-medium w-12 p-0 text-center bg-transparent focus:outline-none focus:ring-0 border-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <button
                        onClick={() => setReplenishmentLimit(replenishmentLimit + 1)}
                        className="text-base font-medium flex h-7 w-7 items-center justify-center rounded-full bg-surface-light hover:bg-surface-light/80 transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            isEditing ? "Update Reward" : "Create Reward"
          )}
        </button>
      </div>

      {/* Icon Picker Modal */}
      <IconPicker
        isOpen={isIconPickerOpen}
        onClose={() => setIsIconPickerOpen(false)}
        selectedIcon={selectedIcon}
        selectedColor={selectedColor}
        onSelect={handleIconSelect}
      />
    </div>
  );
}
