import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Download, Info, Clock, Globe } from "lucide-react";
import { TimePicker } from "@/components/TimePicker";
import { useUserStore } from "@/store";
import { updateUserDayEndTime } from "@/db/services";
import { SUPPORTED_LANGUAGES } from "@/libs/i18n";
import type { SupportedLanguage } from "@/db/types";

export function Settings() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, refreshUser, updateUser } = useUserStore();
  
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

  const handleLanguageChange = async (lang: SupportedLanguage) => {
    try {
      await updateUser({ language: lang });
      i18n.changeLanguage(lang);
    } catch (error) {
      console.error("Failed to update language:", error);
    }
  };

  const getTimeDescription = (time: string) => {
    if (time === "00:00") return t("settings.timeDescriptions.naturalDay");
    const [hour] = time.split(':').map(Number);
    if (hour < 6) return `${t("settings.timeDescriptions.dawn")} ${time}`;
    if (hour < 12) return `${t("settings.timeDescriptions.morning")} ${time}`;
    if (hour === 12) return `${t("settings.timeDescriptions.noon")} ${time}`;
    if (hour < 18) return `${t("settings.timeDescriptions.afternoon")} ${time}`;
    return `${t("settings.timeDescriptions.evening")} ${time}`;
  };

  return (
    <div className="bg-background">
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
          <button
            onClick={() => {}}
            className="w-full flex items-center gap-4 rounded-xl bg-surface p-4 border border-border hover:bg-surface-light transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-text-primary font-medium">{t("settings.language")}</p>
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
          </button>
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
              <p className="text-text-primary font-medium">{t("settings.dayEndTime")}</p>
              <p className="text-text-secondary text-sm truncate">
                {getTimeDescription(dayEndTime)} · {t("settings.dayEndTimeDescription")}
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
              <p className="text-text-primary font-medium">{t("settings.dataImportExport")}</p>
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
              <p className="text-text-primary font-medium">{t("settings.version")}</p>
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
