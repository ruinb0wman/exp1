import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router";
import { Header } from "@/components/Header";
import { RadioGroup } from "@/components/RadioGroup";
import { IconPicker } from "@/components/IconPicker";
import { DynamicIcon } from "@/components/DynamicIcon";
import { MultiSelectGrid } from "@/components/MultiSelectGrid";
import { Package, Sparkles, Scale } from "lucide-react";
import { NumberInput } from "@/components/NumberInput";
import type { RewardTemplate, RewardIconName, RewardIconColor, ReplenishmentMode } from "@/db/types";
import { REWARD_ICON_COLORS } from "@/db/types";
import { isValidMoneyCost, formatMoney } from "@/libs/reward";
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
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const rewardId = id && id !== "new" ? id : null;
  
  // 使用 hook 获取奖励模板数据
  const { template, isLoading: isLoadingTemplate } = useRewardTemplate(rewardId);
  const { create, update, isLoading: isSubmitting } = useRewardTemplateActions();
  
  const isEditing = Boolean(rewardId);

  // Basic Info
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pointsCost, setPointsCost] = useState(100);
  // 单件折合金额（元）：与积分价互相独立，消费金额 = 单件金额 × 数量
  const [moneyCost, setMoneyCost] = useState(100);
  // 是否折合金额并计入消费统计：关闭后不折合金额，之后的购买不计入消费统计
  const [countInConsumption, setCountInConsumption] = useState(true);
  const [enabled, setEnabled] = useState(true);

  // Icon
  const [selectedIcon, setSelectedIcon] = useState<RewardIconName>("Gift");
  const [selectedColor, setSelectedColor] = useState<RewardIconColor>(REWARD_ICON_COLORS[0]);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

  // Replenishment
  const [restockIndex, setRestockIndex] = useState(0);
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatDaysOfWeek, setRepeatDaysOfWeek] = useState<number[]>([]);
  const [repeatDaysOfMonth, setRepeatDaysOfMonth] = useState<number[]>([]);
  const [replenishmentNum, setReplenishmentNum] = useState(1);
  const [hasStockLimit, setHasStockLimit] = useState(false);
  const [replenishmentLimit, setReplenishmentLimit] = useState(10);

  // 加载现有奖励数据
  useEffect(() => {
    if (template) {
      setTitle(template.title);
      setDescription(template.description ?? "");
      setPointsCost(template.pointsCost);
      setMoneyCost(template.moneyCost ?? 0);
      setCountInConsumption(template.countInConsumption !== false);
      setEnabled(template.enabled);
      setSelectedIcon(template.icon);
      setSelectedColor(template.iconColor ?? REWARD_ICON_COLORS[0]);

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

    // 关闭统计时不需要校验金额（金额仅保留，便于重新打开）
    if (countInConsumption && !isValidMoneyCost(moneyCost)) {
      alert(t("editReward.invalidMoneyCost"));
      return;
    }

    const rewardData: Omit<RewardTemplate, "id" | "createdAt" | "updatedAt"> = {
      userId: user.id,
      title,
      description: description || undefined,
      pointsCost,
      moneyCost,
      countInConsumption,
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
        // 消费额度由补货流程管理，编辑时不改动
        await update(rewardId, rewardData);
      } else {
        await create(rewardData);
      }
      navigate(-1);
    } catch (err) {
      console.error("Failed to save reward:", err);
      alert(err instanceof Error ? err.message : t("editReward.saveFailed"));
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
    <div className="relative min-h-screen bg-background pb-32">
      <Header
        title={isEditing ? t("editReward.title") : t("editReward.createTitle")}
        back
      />

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
            <NumberInput
              value={pointsCost}
              onChange={setPointsCost}
              min={0}
              step={10}
              size="lg"
            />
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

        {/* Unit Value Section：单件金额与积分价互相独立 */}
        <div>
          <div className="flex items-center justify-between gap-4 px-2 pb-2 pt-4">
            <h3 className="text-text-primary text-lg font-bold leading-tight tracking-[-0.015em]">
              {t("editReward.moneyCost")}
            </h3>
            <button
              role="switch"
              aria-checked={countInConsumption}
              aria-label={t("editReward.countInConsumption")}
              onClick={() => setCountInConsumption(!countInConsumption)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                countInConsumption ? "bg-primary" : "bg-surface-light"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  countInConsumption ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <div className="rounded-xl bg-surface p-4 space-y-4">
            {countInConsumption ? (
              <>
                <div className="flex items-center gap-4 min-h-10 justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-primary flex items-center justify-center rounded-lg bg-primary/20 shrink-0 size-10">
                      <Scale className="w-5 h-5" />
                    </div>
                    <p className="text-text-primary text-base font-normal leading-normal">
                      {t("editReward.moneyCostLabel")}
                    </p>
                  </div>
                  <NumberInput
                    value={moneyCost}
                    onChange={setMoneyCost}
                    min={0}
                    step={1}
                    allowDecimal
                    size="lg"
                  />
                </div>

                <p className="text-text-muted text-sm pt-2 border-t border-surface-light">
                  {t("editReward.moneyCostHint")}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-surface-light">
                  <span className="text-text-secondary text-sm">
                    {t("editReward.moneyCostPreview", { cost: pointsCost })}
                  </span>
                  <span className="text-green-400 font-bold">
                    {isValidMoneyCost(moneyCost) ? formatMoney(moneyCost) : "-"}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-text-muted text-sm">
                {t("editReward.moneyCostOffHint")}
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
                <NumberInput
                  value={repeatInterval}
                  onChange={setRepeatInterval}
                  min={1}
                  label="Every"
                  suffix={restockMode === "daily" ? "days" : restockMode === "weekly" ? "weeks" : "months"}
                />
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
                <NumberInput
                  value={replenishmentNum}
                  onChange={setReplenishmentNum}
                  min={1}
                  label="Restock amount"
                />
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
                    <NumberInput
                      value={replenishmentLimit}
                      onChange={setReplenishmentLimit}
                      min={1}
                      label="Max stock"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom CTA Button */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pb-8 bg-gradient-to-t from-background to-transparent">
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
