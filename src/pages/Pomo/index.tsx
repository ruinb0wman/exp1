import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePomoStore } from '@/store/pomoStore';
import { useUserStore } from '@/store/userStore';
import { useTodayTasks } from '@/hooks/useTasks';
import { PomoTimer } from '@/components/PomoTimer';
import {
  TaskSelector,
  SettingsPopup,
  TaskSelectorButton,
  ControlButtons,
  PomoHeader,
  ModeSwitcher,
} from './components';

export function Pomo() {
  const { t } = useTranslation();
  const userStore = useUserStore();
  const userId = userStore.user?.id ?? 1;
  const dayEndTime = userStore.user?.dayEndTime;

  const {
    mode,
    isRunning,
    isPaused,
    selectedTaskId,
    todayCount,
    settings,
    setMode,
    setSelectedTask,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    resetTimer,
    updateSettings,
    loadTodayCount,
    loadSettings,
  } = usePomoStore();

  const { tasks } = useTodayTasks(userId, dayEndTime);
  const [showTaskSelector, setShowTaskSelector] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // 加载设置和今日完成数
  useEffect(() => {
    if (userId) {
      loadSettings(userId);
      loadTodayCount(userId);
    }
  }, [userId, loadSettings, loadTodayCount]);

  // 获取选中的任务
  const selectedTask = tasks.find(t => t.instance.id === selectedTaskId);

  // 放弃按钮
  const handleStop = () => {
    if (confirm(t('pomo.confirm.giveUp'))) {
      stopTimer(false);
    }
  };

  // 完成按钮（提前完成）
  const handleComplete = () => {
    if (confirm(t('pomo.confirm.completeEarly'))) {
      stopTimer(true);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* 头部 */}
      <PomoHeader
        todayCount={todayCount}
        soundEnabled={settings.soundEnabled}
        onToggleSound={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* 模式切换 */}
      <ModeSwitcher
        currentMode={mode}
        isRunning={isRunning}
        onModeChange={setMode}
      />

      {/* 计时器 */}
      <div className="flex justify-center mt-8">
        <PomoTimer />
      </div>

      {/* 任务选择 */}
      <div className="px-4 mt-8">
        <TaskSelectorButton
          selectedTask={selectedTask}
          disabled={isRunning}
          onClick={() => setShowTaskSelector(true)}
        />
      </div>

      {/* 控制按钮 */}
      <div className="px-4 mt-8">
        <ControlButtons
          isRunning={isRunning}
          isPaused={isPaused}
          onStart={startTimer}
          onPause={pauseTimer}
          onResume={resumeTimer}
          onReset={resetTimer}
          onStop={handleStop}
          onComplete={handleComplete}
        />
      </div>

      {/* 任务选择弹窗 */}
      <TaskSelector
        isOpen={showTaskSelector}
        onClose={() => setShowTaskSelector(false)}
        tasks={tasks}
        selectedTaskId={selectedTaskId}
        onSelectTask={setSelectedTask}
      />

      {/* 设置弹窗 */}
      <SettingsPopup
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
      />
    </div>
  );
}
