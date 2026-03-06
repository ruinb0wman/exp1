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
import { useDB } from "@/db";

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

interface EditRewardProps {
  userId?: number;
  initialReward?: Partial<RewardTemplate>;
  onSubmit?: (reward: Omit<RewardTemplate, "id" | "createdAt" | "updatedAt">) => void;
}

export function EditReward({ userId = 1, initialReward, onSubmit }: EditRewardProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getDB } = useDB();
  const isEditing = Boolean(id);

  // Basic Info
  const [title, setTitle] = useState(initialReward?.title ?? "");
  const [description, setDescription] = useState(initialReward?.description ?? "");
  const [pointsCost, setPointsCost] = useState(initialReward?.pointsCost ?? 100);
  const [enabled, setEnabled] = useState(initialReward?.enabled ?? true);

  // Icon
  const [selectedIcon, setSelectedIcon] = useState<RewardIconName>(initialReward?.icon ?? "Gift");
  const [selectedColor, setSelectedColor] = useState<RewardIconColor>(initialReward?.iconColor ?? REWARD_ICON_COLORS[0]);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

  // Valid Duration (days)
  const [validDuration, setValidDuration] = useState(initialReward?.validDuration ?? 30);
  const [hasValidDuration, setHasValidDuration] = useState(initialReward?.validDuration !== undefined && initialReward?.validDuration > 0);

  // Replenishment
  const [restockIndex, setRestockIndex] = useState(() => {
    const mode = initialReward?.replenishmentMode ?? "none";
    return restockValues.indexOf(mode);
  });
  const [repeatInterval, setRepeatInterval] = useState(initialReward?.repeatInterval ?? 1);
  const [repeatDaysOfWeek, setRepeatDaysOfWeek] = useState<number[]>(initialReward?.repeatDaysOfWeek ?? []);
  const [repeatDaysOfMonth, setRepeatDaysOfMonth] = useState<number[]>(initialReward?.repeatDaysOfMonth ?? []);
  const [replenishmentNum, setReplenishmentNum] = useState(initialReward?.replenishmentNum ?? 1);
  const [hasStockLimit, setHasStockLimit] = useState(initialReward?.replenishmentLimit !== undefined);
  const [replenishmentLimit, setReplenishmentLimit] = useState(initialReward?.replenishmentLimit ?? 10);

  // Load existing reward data when editing
  useEffect(() => {
    if (id) {
      const loadReward = async () => {
        const db = getDB();
        const rewardId = parseInt(id);
        const reward = await db.rewardTemplates.get(rewardId);
        if (reward) {
          setTitle(reward.title);
          setDescription(reward.description ?? "");
          setPointsCost(reward.pointsCost);
          setEnabled(reward.enabled);
          setSelectedIcon(reward.icon);
          setSelectedColor(reward.iconColor ?? REWARD_ICON_COLORS[0]);
          setValidDuration(reward.validDuration);
          setHasValidDuration(reward.validDuration > 0);
          setRestockIndex(restockValues.indexOf(reward.replenishmentMode));
          setRepeatInterval(reward.repeatInterval ?? 1);
          setRepeatDaysOfWeek(reward.repeatDaysOfWeek ?? []);
          setRepeatDaysOfMonth(reward.repeatDaysOfMonth ?? []);
          setReplenishmentNum(reward.replenishmentNum ?? 1);
          setHasStockLimit(reward.replenishmentLimit !== undefined);
          setReplenishmentLimit(reward.replenishmentLimit ?? 10);
        }
      };
      loadReward();
    }
  }, [id, getDB]);

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
    const rewardData: Omit<RewardTemplate, "id" | "createdAt" | "updatedAt"> = {
      userId,
      title,
      description: description || undefined,
      pointsCost,
      validDuration: hasValidDuration ? validDuration : 0,
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

    // 打印表单内容
    console.log("Reward Form Data:", rewardData);

    if (onSubmit) {
      onSubmit(rewardData);
    } else {
      // Save to database
      const db = getDB();
      if (id) {
        await db.rewardTemplates.update(parseInt(id), rewardData);
      } else {
        await db.rewardTemplates.add(rewardData as RewardTemplate);
      }
      navigate(-1);
    }
  };

  const restockMode = restockValues[restockIndex];

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
                    onClick={() => setValidDuration(Math.max(1, validDuration - 1))}
                    className="text-base font-medium flex h-7 w-7 items-center justify-center rounded-full bg-surface-light hover:bg-surface-light/80 transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={validDuration}
                    onChange={(e) => setValidDuration(Math.max(1, parseInt(e.target.value) || 1))}
                    className="text-base font-medium w-12 p-0 text-center bg-transparent focus:outline-none focus:ring-0 border-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => setValidDuration(validDuration + 1)}
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
          disabled={!title.trim()}
          className="w-full h-14 bg-primary text-white font-bold text-lg rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isEditing ? "Update Reward" : "Create Reward"}
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
