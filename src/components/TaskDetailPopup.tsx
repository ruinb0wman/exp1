import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import i18n from "i18next";
import { CheckCircle2, XCircle, Clock, RefreshCw, Calendar, AlignLeft, Pencil, CheckSquare, Square, Timer, ChevronRight } from "lucide-react";
import { Popup } from "./Popup";
import { TaskContributionGraph } from "./TaskContributionGraph";
import type { TaskInstance, TaskTemplate } from "@/db/types";
import { isExpiredByInstanceDate, getExpireTimeTextByInstanceDate, type ExpireTimeResult } from "@/libs/time";
import { getTaskProgressPercent, getNextStage, getTotalPointsEarned } from "@/db/services";
import { calculateMaxPoints } from "@/db/types";
import { useUserStore } from "@/store";
import { usePomoStore } from "@/store/pomoStore";

export interface TaskDetailPopupProps {
  isOpen: boolean;
  onClose: () => void;
  instance: TaskInstance | null;
  template: TaskTemplate | null;
  onComplete?: () => void;
  onReset?: () => void;
  onIncrementCount?: () => void;
  onToggleSubtask?: (index: number) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function TaskDetailPopup({
  isOpen,
  onClose,
  instance,
  template,
  onComplete,
  onReset,
  onIncrementCount,
  onToggleSubtask,
  isLoading = false,
  disabled = false,
}: TaskDetailPopupProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleEdit = () => {
    onClose();
    if (template?.id) {
      navigate(`/tasks/${template.id}`);
    }
  };

  return (
    <Popup
      isOpen={isOpen}
      onClose={onClose}
      position="bottom"
      title={t('home.detail.taskDetail')}
      maskClosable={true}
      maxHeight="80vh"
      headerRight={(
        <button
          onClick={handleEdit}
          disabled={isLoading}
          className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title={t('home.detail.editTask')}
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>{t('home.detail.edit')}</span>
        </button>
      )}
    >
      {instance && template ? (
        <TaskDetailContent
          instance={instance}
          template={template}
          onComplete={onComplete}
          onReset={onReset}
          onIncrementCount={onIncrementCount}
          onToggleSubtask={onToggleSubtask}
          onClose={onClose}
          isLoading={isLoading}
          disabled={disabled}
        />
      ) : (
        <div className="py-8 text-center text-text-secondary">{t('home.detail.loading')}</div>
      )}
    </Popup>
  );
}

interface TaskDetailContentProps {
  instance: TaskInstance;
  template: TaskTemplate;
  onComplete?: () => void;
  onReset?: () => void;
  onIncrementCount?: () => void;
  onToggleSubtask?: (index: number) => void;
  onClose: () => void;
  isLoading: boolean;
  disabled: boolean;
}

function TaskDetailContent({
  instance,
  template,
  onComplete,
  onReset,
  onIncrementCount,
  onToggleSubtask,
  onClose,
  isLoading,
  disabled,
}: TaskDetailContentProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const dayEndTime = user?.dayEndTime ?? "00:00";
  const expireDays = template?.completeExpireDays;
  const isExpired = expireDays && expireDays > 0
    ? isExpiredByInstanceDate(instance.instanceDate, expireDays, dayEndTime)
    : false;
  const expireTimeResult = expireDays && expireDays > 0
    ? getExpireTimeTextByInstanceDate(instance.instanceDate, expireDays, dayEndTime)
    : null;

  const isCompleted = instance.status === "completed";
  const rule = template.completeRule;
  const isSimpleRule = rule?.type === 'simple';
  const hasCompleteRule = !!rule && !isSimpleRule;
  const progressPercent = getTaskProgressPercent(instance);
  
  const earnedPoints = isSimpleRule
    ? (isCompleted ? rule.completionPoints : 0)
    : getTotalPointsEarned(instance);
  
  const expectedPoints = isSimpleRule
    ? (isCompleted ? rule.completionPoints : 0)
    : (hasCompleteRule ? calculateMaxPoints(rule) : 0);

  const isCountRule = rule?.type === "count";
  const isTimeRule = rule?.type === "time";
  const isSubtaskRule = rule?.type === "subtask";

  const getProgressText = () => {
    if (!hasCompleteRule) return null;
    
    if (isSubtaskRule) {
      const completedCount = (instance.completedSubtasks || []).filter(Boolean).length;
      const config = rule?.subtaskConfig;
      const targetCount = config?.mode === 'all' 
        ? instance.subtasks.length 
        : (config?.requiredCount || 1);
      return `${completedCount}/${targetCount} ${t('home.units.items')}`;
    }

    const progress = instance.completeProgress ?? 0;
    const maxThreshold = rule?.stages.length ? Math.max(...rule.stages.map(s => s.threshold)) : 0;
    const unit = rule?.type === "time" ? t('home.units.minutes') : t('home.units.times');
    return `${progress}/${maxThreshold} ${unit}`;
  };

  const getNextStageHint = () => {
    if (!rule || isSubtaskRule || !instance) return null;
    
    const nextStage = getNextStage(instance);
    if (!nextStage) return null;

    const progress = instance.completeProgress ?? 0;
    const remaining = nextStage.threshold - progress;
    const unit = rule.type === 'time' ? t('home.units.minutes') : t('home.units.times');
    
    return t('home.hint.nextStage', { remaining, unit, points: nextStage.points });
  };

  const getRepeatText = () => {
    switch (template.repeatMode) {
      case "daily":
        return template.repeatInterval && template.repeatInterval > 1
          ? `${t('home.repeat.daily')} (${template.repeatInterval})`
          : t('home.repeat.daily');
      case "weekly":
        if (template.repeatDaysOfWeek && template.repeatDaysOfWeek.length > 0) {
          const dayKeys = ['time.sunday', 'time.monday', 'time.tuesday', 'time.wednesday', 'time.thursday', 'time.friday', 'time.saturday'];
          const dayNames = template.repeatDaysOfWeek.map((d) => t(`home.${dayKeys[d]}`)).join(', ');
          return template.repeatInterval && template.repeatInterval > 1
            ? `${t('home.repeat.weekly')} (${template.repeatInterval}) ${dayNames}`
            : `${t('home.repeat.weekly')} ${dayNames}`;
        }
        return t('home.repeat.weekly');
      case "monthly":
        if (template.repeatDaysOfMonth && template.repeatDaysOfMonth.length > 0) {
          const days = template.repeatDaysOfMonth.map((d) => `${d}`).join(', ');
          return template.repeatInterval && template.repeatInterval > 1
            ? `${t('home.repeat.monthly')} (${template.repeatInterval}) ${days}`
            : `${t('home.repeat.monthly')} ${days}`;
        }
        return t('home.repeat.monthly');
      default:
        return t('home.repeat.oneTime');
    }
  };

  const renderExpireTime = (result: ExpireTimeResult) => {
    switch (result.type) {
      case "expired":
        return t('home.time.expired');
      case "expiresInDays":
        return i18n.language === 'zh' ? `${result.value}天后过期` : `Expires in ${result.value} days`;
      case "expiresInHours":
        const hoursText = i18n.language === 'zh' ? `${result.hours}小时后过期` : `Expires in ${result.hours} hours`;
        const minsText = result.minutes > 0 ? (i18n.language === 'zh' ? ` ${result.minutes}分钟后` : ` ${result.minutes} min`) : '';
        return hoursText + minsText;
      case "expiresInMinutes":
        return i18n.language === 'zh' ? `${result.value}分钟后过期` : `Expires in ${result.value} minutes`;
    }
  };

  const getStatusText = () => {
    if (isCompleted) return t('home.status.completed');
    if (isExpired) return t('home.status.expired');
    return t('home.status.inProgress');
  };

  const renderSubtasks = () => {
    if (!isSubtaskRule || instance.subtasks.length === 0) return null;

    const completedSubtasks = instance.completedSubtasks || [];
    const pointsPerSubtask = rule?.subtaskConfig?.pointsPerSubtask || [];

    return (
      <div className="bg-surface rounded-lg p-3 space-y-2">
        <p className="text-xs text-text-muted mb-2">{t('home.detail.subtasks')}</p>
        {instance.subtasks.map((subtask, index) => {
          const isCompleted = completedSubtasks[index];
          const points = pointsPerSubtask[index] || 0;

          return (
            <button
              key={index}
              onClick={() => !isExpired && !disabled && onToggleSubtask?.(index)}
              disabled={isExpired || disabled || isLoading}
              className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors
                ${isCompleted 
                  ? 'bg-green-500/10' 
                  : 'bg-surface-light hover:bg-surface-light/80'
                } ${(isExpired || disabled) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {isCompleted ? (
                <CheckSquare className="w-5 h-5 text-green-500 shrink-0" />
              ) : (
                <Square className="w-5 h-5 text-text-muted shrink-0" />
              )}
              <span className={`flex-1 text-sm text-left ${isCompleted ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                {subtask}
              </span>
              {points > 0 && (
                <span className={`text-xs ${isCompleted ? 'text-green-500' : 'text-text-muted'}`}>
                  +{points}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isCompleted ? "bg-green-500/20" : isExpired ? "bg-red-500/20" : "bg-primary/20"
            }`}
        >
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : isExpired ? (
            <XCircle className="w-5 h-5 text-red-500" />
          ) : (
            <Clock className="w-5 h-5 text-primary" />
          )}
        </div>
        <div className="flex-1">
          <h3
            className={`text-lg font-semibold ${isCompleted ? "text-text-secondary line-through" : "text-text-primary"
              }`}
          >
            {template.title}
          </h3>
          <p className="text-sm text-text-secondary mt-1">
            {getStatusText()}
          </p>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <span className="text-lg font-bold text-primary">
            +{earnedPoints}{expectedPoints > 0 && <span className="text-sm text-text-muted font-normal">/{expectedPoints}</span>}
          </span>
          <p className="text-xs text-text-muted">{t('home.time.exp')}</p>
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="space-y-3">
        {template.description && (
          <div className="flex items-start gap-3">
            <AlignLeft className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-text-muted">{t('home.detail.description')}</p>
              <p className="text-sm text-text-primary mt-0.5">{template.description}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <RefreshCw className="w-4 h-4 text-text-muted shrink-0" />
          <div>
            <p className="text-xs text-text-muted">{t('home.detail.repeat')}</p>
            <p className="text-sm text-text-primary mt-0.5">{getRepeatText()}</p>
          </div>
        </div>

        {instance.instanceDate && (
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-text-muted shrink-0" />
            <div>
              <p className="text-xs text-text-muted">{t('home.detail.date')}</p>
              <p className="text-sm text-text-primary mt-0.5">
                {new Date(instance.instanceDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
      </div>

      {hasCompleteRule && (
        <div className="bg-surface rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-secondary">{t('home.detail.progress')}</span>
            <span className="text-sm font-medium text-primary">{getProgressText()}</span>
          </div>
          <div className="h-2 bg-surface-light rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${progressPercent >= 100 ? "bg-green-500" : progressPercent >= 60 ? "bg-primary" : "bg-yellow-500"
                }`}
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
          {!isCompleted && !isExpired && getNextStageHint() && (
            <p className="text-xs text-text-muted mt-2">{getNextStageHint()}</p>
          )}
        </div>
      )}

      {template.repeatMode !== "none" && (
        <TaskContributionGraph template={template} userId={instance.userId} weeks={20} />
      )}

      {isExpired && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <p className="text-sm text-red-500 flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            {t('home.detail.taskExpired')}
          </p>
        </div>
      )}
      {!isExpired && expireTimeResult && (
        <div className="bg-surface rounded-lg p-3">
          <p className="text-xs text-text-muted">{renderExpireTime(expireTimeResult)}</p>
        </div>
      )}

      {renderSubtasks()}

      <div className="flex gap-3 pt-2">
        {isCompleted ? (
          <button
            onClick={onReset}
            disabled={disabled || isLoading}
            className="flex-1 py-3 px-4 bg-surface hover:bg-surface-light disabled:opacity-50 disabled:cursor-not-allowed text-text-primary rounded-xl font-medium transition-colors"
          >
            {isLoading ? t('home.detail.processing') : t('home.detail.markIncomplete')}
          </button>
        ) : isTimeRule ? (
          <button
            onClick={() => {
              usePomoStore.getState().setSelectedTask(instance.id!);
              navigate('/pomo');
            }}
            disabled={isExpired || disabled || isLoading}
            className="flex-1 py-3 px-4 bg-surface hover:bg-surface-light disabled:opacity-50 disabled:cursor-not-allowed text-text-primary rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Timer className="w-4 h-4" />
            <span>{isLoading ? t('home.detail.processing') : isExpired ? t('home.status.expired') : t('home.detail.usePomodoro')}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : isCountRule && onIncrementCount ? (
          <button
            onClick={onIncrementCount}
            disabled={isExpired || disabled || isLoading}
            className="flex-1 py-3 px-4 bg-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
          >
            {isLoading ? t('home.detail.processing') : isExpired ? t('home.status.expired') : t('home.detail.completeOne')}
          </button>
        ) : isSubtaskRule ? (
          <div className="flex-1 py-3 px-4 bg-surface rounded-xl text-center">
            <p className="text-sm text-text-secondary">{t('home.detail.clickSubtasks')}</p>
          </div>
        ) : (
          <button
            onClick={onComplete}
            disabled={isExpired || disabled || isLoading}
            className="flex-1 py-3 px-4 bg-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
          >
            {isLoading ? t('home.detail.processing') : isExpired ? t('home.status.expired') : t('home.detail.completeTask')}
          </button>
        )}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="py-3 px-6 bg-surface hover:bg-surface-light disabled:opacity-50 text-text-secondary rounded-xl font-medium transition-colors"
        >
          {t('home.detail.close')}
        </button>
      </div>
    </div>
  );
}