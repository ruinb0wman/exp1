import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ChevronLeft, Download, Info, Clock, RefreshCw, Smartphone } from "lucide-react";
import { TimePicker } from "@/components/TimePicker";
import { SyncModal } from "@/components/SyncUI";
import { useSync } from "@/hooks/useSync";
import { useUserStore } from "@/store";
import { updateUserDayEndTime } from "@/db/services";

const settingsMenu = [
  {
    icon: Download,
    label: "数据导入导出",
    description: "备份或恢复您的任务和奖励数据",
    path: "/data-import-export",
  },
];

export function Settings() {
  const navigate = useNavigate();
  const { user, refreshUser } = useUserStore();
  const { state, isMobile, openSync, closeSync, startSync, resolveConflicts, retrySync, cancelSync } = useSync();
  
  const [dayEndTime, setDayEndTime] = useState(user?.dayEndTime || "00:00");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.dayEndTime) {
      setDayEndTime(user.dayEndTime);
    }
  }, [user?.dayEndTime]);

  const handleTimeChange = async (newTime: string) => {
    if (!user?.id) return;
    
    setIsSaving(true);
    try {
      await updateUserDayEndTime(user.id, newTime);
      await refreshUser();
      setDayEndTime(newTime);
    } catch (error) {
      console.error("Failed to update day end time:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const getTimeDescription = (time: string) => {
    if (time === "00:00") return "自然日（午夜12点）";
    const [hour] = time.split(':').map(Number);
    if (hour < 6) return `凌晨 ${time}`;
    if (hour < 12) return `上午 ${time}`;
    if (hour === 12) return `中午 ${time}`;
    if (hour < 18) return `下午 ${time}`;
    return `晚上 ${time}`;
  };

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return "从未同步";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes === 0 ? "刚刚" : `${minutes} 分钟前`;
      }
      return `${hours} 小时前`;
    } else if (days === 1) {
      return "昨天";
    } else if (days < 7) {
      return `${days} 天前`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center p-4 pb-2 sticky top-0 bg-background z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center -ml-2 text-text-primary hover:text-primary transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-text-primary flex-1 text-center mr-8">
          设置
        </h1>
      </header>

      <div className="p-4 pt-6">
        <div className="mb-6">
          <h2 className="text-text-secondary text-sm font-medium px-2 mb-3">
            时间设置
          </h2>
          <button
            onClick={() => setShowTimePicker(true)}
            disabled={isSaving}
            className="w-full flex items-center gap-4 rounded-xl bg-surface p-4 border border-border hover:bg-surface-light transition-colors text-left disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-text-primary font-medium">一天结束时间</p>
              <p className="text-text-secondary text-sm truncate">
                {getTimeDescription(dayEndTime)} · 此时间前任务不会过期
              </p>
            </div>
            <span className="text-primary font-medium">{dayEndTime}</span>
          </button>
        </div>

        <div className="mb-6">
          <h2 className="text-text-secondary text-sm font-medium px-2 mb-3">
            数据同步
          </h2>
          <button
            onClick={openSync}
            className="w-full flex items-center gap-4 rounded-xl bg-surface p-4 border border-border hover:bg-surface-light transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              {isMobile ? (
                <Smartphone className="w-5 h-5 text-primary" />
              ) : (
                <RefreshCw className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-text-primary font-medium">
                {isMobile ? "与 PC 端同步" : "与手机端同步"}
              </p>
              <p className="text-text-secondary text-sm truncate">
                最后同步: {formatLastSync(state.lastSyncAt)}
              </p>
            </div>
            <ChevronLeft className="w-5 h-5 text-text-secondary rotate-180 shrink-0" />
          </button>
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <h2 className="text-text-secondary text-sm font-medium px-2">
            数据管理
          </h2>
          {settingsMenu.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="flex items-center gap-4 rounded-xl bg-surface p-4 border border-border hover:bg-surface-light transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-text-primary font-medium">{item.label}</p>
                <p className="text-text-secondary text-sm truncate">
                  {item.description}
                </p>
              </div>
              <ChevronLeft className="w-5 h-5 text-text-secondary rotate-180 shrink-0" />
            </button>
          ))}
        </div>

        <div>
          <h2 className="text-text-secondary text-sm font-medium px-2 mb-3">
            关于
          </h2>
          <div className="flex items-center gap-4 rounded-xl bg-surface p-4 border border-border">
            <div className="w-10 h-10 rounded-lg bg-surface-light flex items-center justify-center shrink-0">
              <Info className="w-5 h-5 text-text-secondary" />
            </div>
            <div className="flex-1">
              <p className="text-text-primary font-medium">版本信息</p>
              <p className="text-text-secondary text-sm">v0.1.0</p>
            </div>
          </div>
        </div>
      </div>

      <TimePicker
        isOpen={showTimePicker}
        value={dayEndTime}
        onChange={handleTimeChange}
        onClose={() => setShowTimePicker(false)}
        title="选择一天结束时间"
        minuteInterval={15}
      />

      <SyncModal
        isOpen={state.isOpen}
        onClose={closeSync}
        platform={isMobile ? "mobile" : "desktop"}
        qrCodeContent={state.qrCodeContent}
        progress={state.progress}
        conflicts={state.conflicts}
        onStartSync={startSync}
        onResolveConflicts={resolveConflicts}
        onRetry={retrySync}
        onCancel={cancelSync}
      />
    </div>
  );
}
