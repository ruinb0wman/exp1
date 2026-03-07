import { useEffect, useState } from 'react';
import { usePomoStore } from '@/store/pomoStore';
import { useUserStore } from '@/store/userStore';
import { useTodayTasks } from '@/hooks/useTasks';
import { PomoTimer } from '@/components/PomoTimer';
import { PomoMode, POMO_MODE_CONFIG } from '@/db/types/pomo';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  CheckCircle2, 
  Circle,
  Timer,
  Volume2,
  VolumeX,
  Settings,
  ChevronDown
} from 'lucide-react';
import { Popup } from '@/components/Popup';

export function Pomo() {
  const userStore = useUserStore();
  const userId = userStore.user?.id || 1;
  
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
  } = usePomoStore();
  
  const { tasks } = useTodayTasks(userId);
  const [showTaskSelector, setShowTaskSelector] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // 加载今日完成数
  useEffect(() => {
    loadTodayCount(userId);
  }, [userId, loadTodayCount]);
  
  // 获取选中的任务
  const selectedTask = tasks.find(t => t.instance.id === selectedTaskId);
  
  // 模式切换按钮
  const ModeButton = ({ targetMode }: { targetMode: PomoMode }) => {
    const config = POMO_MODE_CONFIG[targetMode];
    const isActive = mode === targetMode;
    
    return (
      <button
        onClick={() => setMode(targetMode)}
        disabled={isRunning}
        className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all ${
          isActive
            ? 'bg-surface-light text-white'
            : 'text-text-secondary hover:text-text-primary hover:bg-surface/50'
        } ${isRunning && !isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {config.label}
      </button>
    );
  };
  
  // 主控制按钮
  const MainControlButton = () => {
    if (!isRunning) {
      return (
        <button
          onClick={startTimer}
          className="w-20 h-20 rounded-full bg-primary hover:bg-primary-light active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-primary/25"
        >
          <Play className="w-8 h-8 text-white ml-1" fill="white" />
        </button>
      );
    }
    
    if (isPaused) {
      return (
        <button
          onClick={resumeTimer}
          className="w-20 h-20 rounded-full bg-primary hover:bg-primary-light active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-primary/25"
        >
          <Play className="w-8 h-8 text-white ml-1" fill="white" />
        </button>
      );
    }
    
    return (
      <button
        onClick={pauseTimer}
        className="w-20 h-20 rounded-full bg-primary hover:bg-primary-light active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-primary/25"
      >
        <Pause className="w-8 h-8 text-white" fill="white" />
      </button>
    );
  };
  
  // 放弃按钮
  const handleStop = () => {
    if (confirm('确定要放弃当前计时吗？')) {
      stopTimer(false);
    }
  };
  
  // 完成按钮（提前完成）
  const handleComplete = () => {
    if (confirm('提前完成当前计时？')) {
      stopTimer(true);
    }
  };
  
  // 时长设置滑块
  const DurationSlider = ({ 
    label, 
    value, 
    min, 
    max, 
    onChange 
  }: { 
    label: string; 
    value: number; 
    min: number; 
    max: number; 
    onChange: (val: number) => void;
  }) => (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-primary font-medium">{value} 分钟</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
  
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="px-4 pt-12 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Timer className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">番茄钟</h1>
            <p className="text-xs text-text-secondary">今日完成 {todayCount} 个</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
            className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
          >
            {settings.soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>
      
      {/* 模式切换 */}
      <div className="px-4 mt-4">
        <div className="bg-surface rounded-2xl p-1.5 flex gap-1">
          <ModeButton targetMode="focus" />
          <ModeButton targetMode="shortBreak" />
          <ModeButton targetMode="longBreak" />
        </div>
      </div>
      
      {/* 计时器 */}
      <div className="flex justify-center mt-8">
        <PomoTimer />
      </div>
      
      {/* 任务选择 */}
      <div className="px-4 mt-8">
        <button
          onClick={() => !isRunning && setShowTaskSelector(true)}
          disabled={isRunning}
          className="w-full bg-surface rounded-2xl p-4 flex items-center gap-3 transition-colors hover:bg-surface-light disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            {selectedTask ? (
              <CheckCircle2 className="w-5 h-5 text-primary" />
            ) : (
              <Circle className="w-5 h-5 text-text-muted" />
            )}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm text-text-secondary">当前专注任务</p>
            <p className="text-white font-medium truncate">
              {selectedTask ? selectedTask.template.title : '未选择任务'}
            </p>
          </div>
          {!isRunning && (
            <ChevronDown className="w-5 h-5 text-text-muted" />
          )}
        </button>
      </div>
      
      {/* 控制按钮 */}
      <div className="px-4 mt-8">
        <div className="flex items-center justify-center gap-6">
          {/* 重置 */}
          <button
            onClick={resetTimer}
            disabled={isRunning}
            className="w-14 h-14 rounded-full bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-light transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-6 h-6" />
          </button>
          
          {/* 主控制 */}
          <MainControlButton />
          
          {/* 停止 */}
          <button
            onClick={handleStop}
            disabled={!isRunning}
            className="w-14 h-14 rounded-full bg-surface flex items-center justify-center text-text-secondary hover:text-primary hover:bg-surface-light transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Square className="w-6 h-6" fill="currentColor" />
          </button>
        </div>
        
        {/* 提前完成 */}
        {isRunning && (
          <button
            onClick={handleComplete}
            className="w-full mt-4 py-3 text-sm text-text-secondary hover:text-primary transition-colors"
          >
            提前完成
          </button>
        )}
      </div>
      
      {/* 任务选择弹窗 */}
      <Popup
        isOpen={showTaskSelector}
        onClose={() => setShowTaskSelector(false)}
        position="bottom"
        title="选择专注任务"
      >
        <div className="space-y-2 max-h-80 overflow-y-auto">
          <button
            onClick={() => {
              setSelectedTask(null);
              setShowTaskSelector(false);
            }}
            className={`w-full p-3 rounded-xl flex items-center gap-3 transition-colors ${
              selectedTaskId === null ? 'bg-primary/10' : 'hover:bg-surface-light'
            }`}
          >
            <Circle className={`w-5 h-5 ${selectedTaskId === null ? 'text-primary' : 'text-text-muted'}`} />
            <span className={selectedTaskId === null ? 'text-primary font-medium' : 'text-text-primary'}>
              自由专注
            </span>
          </button>
          
          {tasks.filter(t => t.instance.status === 'pending').map(({ instance, template }) => (
            <button
              key={instance.id}
              onClick={() => {
                setSelectedTask(instance.id!);
                setShowTaskSelector(false);
              }}
              className={`w-full p-3 rounded-xl flex items-center gap-3 transition-colors ${
                selectedTaskId === instance.id ? 'bg-primary/10' : 'hover:bg-surface-light'
              }`}
            >
              {selectedTaskId === instance.id ? (
                <CheckCircle2 className="w-5 h-5 text-primary" />
              ) : (
                <Circle className="w-5 h-5 text-text-muted" />
              )}
              <span className={selectedTaskId === instance.id ? 'text-primary font-medium' : 'text-text-primary'}>
                {template.title}
              </span>
            </button>
          ))}
          
          {tasks.filter(t => t.instance.status === 'pending').length === 0 && (
            <p className="text-center text-text-muted py-4">今日没有待办任务</p>
          )}
        </div>
      </Popup>
      
      {/* 设置弹窗 */}
      <Popup
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        position="center"
        title="番茄钟设置"
      >
        <div className="space-y-6 w-80">
          <DurationSlider
            label="专注时长"
            value={settings.focusDuration}
            min={5}
            max={60}
            onChange={(val) => updateSettings({ focusDuration: val })}
          />
          
          <DurationSlider
            label="短休息时长"
            value={settings.shortBreakDuration}
            min={1}
            max={15}
            onChange={(val) => updateSettings({ shortBreakDuration: val })}
          />
          
          <DurationSlider
            label="长休息时长"
            value={settings.longBreakDuration}
            min={5}
            max={30}
            onChange={(val) => updateSettings({ longBreakDuration: val })}
          />
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">长休息间隔</span>
              <span className="text-text-primary font-medium">{settings.longBreakInterval} 个番茄</span>
            </div>
            <input
              type="range"
              min={2}
              max={8}
              value={settings.longBreakInterval}
              onChange={(e) => updateSettings({ longBreakInterval: parseInt(e.target.value) })}
              className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
          
          <div className="space-y-3 pt-2 border-t border-border">
            <label className="flex items-center justify-between">
              <span className="text-text-secondary text-sm">自动开始休息</span>
              <button
                onClick={() => updateSettings({ autoStartBreaks: !settings.autoStartBreaks })}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  settings.autoStartBreaks ? 'bg-primary' : 'bg-surface-light'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                  settings.autoStartBreaks ? 'left-7' : 'left-1'
                }`} />
              </button>
            </label>
            
            <label className="flex items-center justify-between">
              <span className="text-text-secondary text-sm">自动开始专注</span>
              <button
                onClick={() => updateSettings({ autoStartPomos: !settings.autoStartPomos })}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  settings.autoStartPomos ? 'bg-primary' : 'bg-surface-light'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                  settings.autoStartPomos ? 'left-7' : 'left-1'
                }`} />
              </button>
            </label>
          </div>
        </div>
      </Popup>
    </div>
  );
}
