import type { AchievementCondition, AchievementConditionType, TaskType } from '@/db/types';

const TASK_TYPE_LABEL: Record<TaskType, string> = {
	simple: 'simple',
	time: 'timed',
	count: 'counted',
	subtask: 'subtask',
};

/** 条件短句模板：scope 为空，或「“任务标题” 」前缀 */
const CONDITION_TEMPLATE: Record<AchievementConditionType, (scope: string, target: number) => string> = {
	task_complete_count: (scope, target) => `${scope}Complete ${target} tasks in total`,
	stage_complete_count: (scope, target) => `${scope}Reach ${target} stages in total`,
	points_earned: (scope, target) => `${scope}Earn ${target} points in total`,
	pomo_focus_minutes: (scope, target) => `${scope}Focus for ${target} minutes in total`,
	pomo_session_count: (scope, target) => `${scope}Finish ${target} focus sessions`,
	streak_days: (scope, target) => `${scope}Complete tasks ${target} days in a row`,
	daily_task_count: (scope, target) => `${scope}Complete ${target} tasks in one day`,
	reward_redeem_count: (scope, target) => `${scope}Redeem ${target} rewards`,
};

/**
 * 将成就条件格式化为用户可读的短句
 * 例：「Complete 100 tasks in total」/「“Morning Run” Complete 20 tasks in total」
 */
export function formatCondition(
	condition: AchievementCondition,
	templateTitle?: string
): string {
	const scope = templateTitle ? `“${templateTitle}” ` : '';

	if (condition.type === 'task_complete_count' && condition.taskType) {
		const typeLabel = TASK_TYPE_LABEL[condition.taskType] ?? condition.taskType;
		return `${scope}Complete ${condition.target} ${typeLabel} tasks in total`;
	}

	return CONDITION_TEMPLATE[condition.type](scope, condition.target);
}
