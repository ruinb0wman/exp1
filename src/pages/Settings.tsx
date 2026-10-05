import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ChevronLeft, Download, Info, Clock } from "lucide-react";
import { TimePicker } from "@/components/TimePicker";
import { Header } from "@/components/Header";
import { AiSettingsSection } from "@/components/AiSettingsSection";
import { useUserStore } from "@/store";
import { updateUserDayEndTime } from "@/db/services";

export function Settings() {
  const navigate = useNavigate();
  const { user, refreshUser } = useUserStore();

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
    if (time === "00:00") return "Natural day (midnight)";
    const [hour] = time.split(":").map(Number);
    if (hour < 6) return `Dawn ${time}`;
    if (hour < 12) return `Morning ${time}`;
    if (hour === 12) return `Noon ${time}`;
    if (hour < 18) return `Afternoon ${time}`;
    return `Evening ${time}`;
  };

  return (
    <div className="bg-background min-h-screen">
      <Header title="Settings" back />

      <div className="p-4">
        <AiSettingsSection />

        <div className="mb-6">
          <h2 className="text-text-secondary text-sm font-medium px-2 mb-3">
            Time Settings
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
              <p className="text-text-primary font-medium">
                Day End Time
              </p>
              <p className="text-text-secondary text-sm truncate">
                {getTimeDescription(dayEndTime)} ·{" "}
                Tasks won't expire before this time
              </p>
            </div>
            <span className="text-primary font-medium">{dayEndTime}</span>
          </button>
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <h2 className="text-text-secondary text-sm font-medium px-2">
            Data Management
          </h2>
          <button
            onClick={() => navigate("/data-import-export")}
            className="flex items-center gap-4 rounded-xl bg-surface p-4 border border-border hover:bg-surface-light transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-text-primary font-medium">
                Import & Export
              </p>
              <p className="text-text-secondary text-sm truncate">
                Backup or restore your tasks and rewards
              </p>
            </div>
            <ChevronLeft className="w-5 h-5 text-text-secondary rotate-180 shrink-0" />
          </button>
        </div>

        <div>
          <h2 className="text-text-secondary text-sm font-medium px-2 mb-3">
            About
          </h2>
          <div className="flex items-center gap-4 rounded-xl bg-surface p-4 border border-border">
            <div className="w-10 h-10 rounded-lg bg-surface-light flex items-center justify-center shrink-0">
              <Info className="w-5 h-5 text-text-secondary" />
            </div>
            <div className="flex-1">
              <p className="text-text-primary font-medium">
                Version
              </p>
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
        title="Day End Time"
        minuteInterval={15}
      />
    </div>
  );
}
