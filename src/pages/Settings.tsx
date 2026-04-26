import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Download, Info, Clock, Globe, Power, EyeOff } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { TimePicker } from "@/components/TimePicker";
import { useUserStore } from "@/store";
import { updateUserDayEndTime } from "@/db/services";
import { SUPPORTED_LANGUAGES } from "@/libs/i18n";
import type { SupportedLanguage } from "@/db/types";

function Toggle({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
        disabled
          ? "opacity-40 cursor-not-allowed"
          : "cursor-pointer"
      } ${enabled ? "bg-primary" : "bg-border"}`}
      role="switch"
      aria-checked={enabled}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function Settings() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, refreshUser, updateUser } = useUserStore();

  const [dayEndTime, setDayEndTime] = useState(user?.dayEndTime || "00:00");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 开机自启状态
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [silentStartEnabled, setSilentStartEnabled] = useState(
    user?.silentStart ?? false,
  );
  const [isAutostartLoading, setIsAutostartLoading] = useState(false);

  // 初始化时从后端获取自启状态
  useEffect(() => {
    (async () => {
      try {
        const enabled = await invoke<boolean>("get_autostart");
        setAutostartEnabled(enabled);
      } catch (error) {
        console.error("Failed to get autostart state:", error);
      }
    })();
  }, []);

  // 同步用户设置中的静默启动
  useEffect(() => {
    if (user?.silentStart !== undefined) {
      setSilentStartEnabled(user.silentStart);
    }
  }, [user?.silentStart]);

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

  const handleLanguageChange = async (lang: SupportedLanguage) => {
    try {
      await updateUser({ language: lang });
      i18n.changeLanguage(lang);
    } catch (error) {
      console.error("Failed to update language:", error);
    }
  };

  // 切换开机自启
  const handleAutostartToggle = useCallback(
    async (enabled: boolean) => {
      if (!user?.id) return;
      setIsAutostartLoading(true);
      try {
        await invoke("set_autostart", {
          enabled,
          silent: silentStartEnabled,
        });
        setAutostartEnabled(enabled);
        // 如果关闭自启，也关闭静默启动
        if (!enabled && silentStartEnabled) {
          setSilentStartEnabled(false);
          await updateUser({ silentStart: false });
        }
      } catch (error) {
        console.error("Failed to set autostart:", error);
      } finally {
        setIsAutostartLoading(false);
      }
    },
    [user?.id, silentStartEnabled, updateUser],
  );

  // 切换静默启动
  const handleSilentToggle = useCallback(
    async (enabled: boolean) => {
      if (!user?.id) return;
      setSilentStartEnabled(enabled);
      try {
        await updateUser({ silentStart: enabled });
        // 同步更新 Rust 后端的静默标记
        await invoke("set_silent_start", { silent: enabled });
        // 如果自启已开启，更新自启注册参数
        if (autostartEnabled) {
          await invoke("set_autostart", {
            enabled: true,
            silent: enabled,
          });
        }
      } catch (error) {
        console.error("Failed to set silent start:", error);
        setSilentStartEnabled(!enabled); // 回滚
      }
    },
    [user?.id, autostartEnabled, updateUser],
  );

  const getTimeDescription = (time: string) => {
    if (time === "00:00") return t("settings.timeDescriptions.naturalDay");
    const [hour] = time.split(":").map(Number);
    if (hour < 6) return `${t("settings.timeDescriptions.dawn")} ${time}`;
    if (hour < 12) return `${t("settings.timeDescriptions.morning")} ${time}`;
    if (hour === 12) return `${t("settings.timeDescriptions.noon")} ${time}`;
    if (hour < 18) return `${t("settings.timeDescriptions.afternoon")} ${time}`;
    return `${t("settings.timeDescriptions.evening")} ${time}`;
  };

  return (
    <div className="bg-background min-h-screen">
      <header className="flex items-center p-4 pb-2 sticky top-0 bg-background z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center -ml-2 text-text-primary hover:text-primary transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-text-primary flex-1 text-center mr-8">
          {t("settings.title")}
        </h1>
      </header>

      <div className="p-4">
        <div className="mb-6">
          <h2 className="text-text-secondary text-sm font-medium px-2 mb-3">
            {t("settings.general")}
          </h2>
          <div
            className="w-full flex items-center gap-4 rounded-xl bg-surface p-4 border border-border hover:bg-surface-light transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-text-primary font-medium">
                {t("settings.language")}
              </p>
              <p className="text-text-secondary text-sm truncate">
                {t("settings.languageDescription")}
              </p>
            </div>
            <div className="flex gap-1">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLanguageChange(lang.code);
                  }}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    (user?.language || "zh") === lang.code
                      ? "bg-primary text-white"
                      : "bg-surface-light text-text-secondary hover:bg-border"
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 启动设置 */}
        <div className="mb-6">
          <h2 className="text-text-secondary text-sm font-medium px-2 mb-3">
            启动设置
          </h2>

          {/* 开机自启 */}
          <div className="flex items-center gap-4 rounded-xl bg-surface p-4 border border-border mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Power className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-text-primary font-medium">
                {t("settings.autostart")}
              </p>
              <p className="text-text-secondary text-sm truncate">
                {t("settings.autostartDescription")}
              </p>
            </div>
            <Toggle
              enabled={autostartEnabled}
              onChange={handleAutostartToggle}
              disabled={isAutostartLoading}
            />
          </div>

          {/* 静默启动 */}
          <div
            className={`flex items-center gap-4 rounded-xl bg-surface p-4 border border-border transition-opacity ${
              !autostartEnabled ? "opacity-50" : ""
            }`}
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                autostartEnabled
                  ? "bg-primary/10"
                  : "bg-surface-light"
              }`}
            >
              <EyeOff
                className={`w-5 h-5 ${
                  autostartEnabled ? "text-primary" : "text-text-secondary"
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-text-primary font-medium">
                {t("settings.silentStart")}
              </p>
              <p className="text-text-secondary text-sm truncate">
                {t("settings.silentStartDescription")}
              </p>
            </div>
            <Toggle
              enabled={silentStartEnabled}
              onChange={handleSilentToggle}
              disabled={!autostartEnabled}
            />
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-text-secondary text-sm font-medium px-2 mb-3">
            {t("settings.timeSettings")}
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
                {t("settings.dayEndTime")}
              </p>
              <p className="text-text-secondary text-sm truncate">
                {getTimeDescription(dayEndTime)} ·{" "}
                {t("settings.dayEndTimeDescription")}
              </p>
            </div>
            <span className="text-primary font-medium">{dayEndTime}</span>
          </button>
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <h2 className="text-text-secondary text-sm font-medium px-2">
            {t("settings.dataManagement")}
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
                {t("settings.dataImportExport")}
              </p>
              <p className="text-text-secondary text-sm truncate">
                {t("settings.dataImportExportDescription")}
              </p>
            </div>
            <ChevronLeft className="w-5 h-5 text-text-secondary rotate-180 shrink-0" />
          </button>
        </div>

        <div>
          <h2 className="text-text-secondary text-sm font-medium px-2 mb-3">
            {t("settings.about")}
          </h2>
          <div className="flex items-center gap-4 rounded-xl bg-surface p-4 border border-border">
            <div className="w-10 h-10 rounded-lg bg-surface-light flex items-center justify-center shrink-0">
              <Info className="w-5 h-5 text-text-secondary" />
            </div>
            <div className="flex-1">
              <p className="text-text-primary font-medium">
                {t("settings.version")}
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
        title={t("settings.dayEndTime")}
        minuteInterval={15}
      />
    </div>
  );
}
