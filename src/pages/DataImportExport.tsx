import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  ChevronLeft,
  Download,
  FileJson,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { Popup } from "@/components/Popup";
import { fileSystem } from "@/libs/fileSystem";
import { useUserStore } from "@/store/userStore";
import {
  exportAllData,
  generateExportFilename,
  validateImportData,
  importData,
  type ExportData,
  type ImportPreview,
  type ImportResult,
} from "@/db/services";

export function DataImportExport() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refreshUser } = useUserStore();

  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [pendingImportData, setPendingImportData] = useState<ExportData | null>(null);
  const [showStrategyDialog, setShowStrategyDialog] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);

  const handleExport = useCallback(async () => {
    try {
      setIsExporting(true);
      setExportSuccess(false);

      const exportData = await exportAllData();
      const jsonContent = JSON.stringify(exportData, null, 2);

      const success = await fileSystem.saveFile({
        content: jsonContent,
        filename: generateExportFilename(),
        mimeType: "application/json",
      });

      if (success) {
        setExportSuccess(true);
        setTimeout(() => setExportSuccess(false), 3000);
      }
    } catch (error) {
      console.error("Export failed:", error);
      alert(t("data.export.failed", { error: error instanceof Error ? error.message : t("common.error") }));
    } finally {
      setIsExporting(false);
    }
  }, [t]);

  const handleFileSelect = useCallback(async () => {
    try {
      setIsImporting(true);

      const file = await fileSystem.selectFile({
        accept: ".json",
        multiple: false,
      });

      if (file) {
        const data = JSON.parse(file.content) as ExportData;

        const preview = validateImportData(data);
        setImportPreview(preview);

        if (preview.isValid) {
          setPendingImportData(data);
          setShowStrategyDialog(true);
        } else {
          setShowResultDialog(true);
        }
      }
    } catch (error) {
      console.error("Import failed:", error);
      setImportPreview({
        isValid: false,
        error: error instanceof Error ? error.message : t("common.error"),
      });
      setShowResultDialog(true);
    } finally {
      setIsImporting(false);
    }
  }, [t]);

  const executeImport = useCallback(async () => {
    if (!pendingImportData) return;

    setShowStrategyDialog(false);
    setIsImporting(true);

    try {
      const result = await importData(pendingImportData);
        setImportResult(result);
        setShowResultDialog(true);

        if (result.success && result.userId) {
          await refreshUser();
        }
      } catch (error) {
        setImportResult({
          success: false,
          message: t("data.import.failed", { error: error instanceof Error ? error.message : t("common.error") }),
        });
        setShowResultDialog(true);
      } finally {
        setIsImporting(false);
        setPendingImportData(null);
      }
    },
    [pendingImportData, refreshUser, t]
  );

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
          {t("data.title")}
        </h1>
      </header>

      <div className="p-4">
        <div className="rounded-xl bg-surface p-5 border border-border mb-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
              <Download className="w-6 h-6 text-green-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-text-primary font-bold text-lg mb-1">
                {t("data.export.title")}
              </h2>
              <p className="text-text-secondary text-sm mb-4">
                {t("data.export.description")}
              </p>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : exportSuccess ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <FileJson className="w-4 h-4" />
                )}
                {isExporting
                  ? t("data.export.inProgress")
                  : exportSuccess
                  ? t("data.export.success")
                  : t("data.export.toFile")}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-surface p-5 border border-border">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <Download className="w-6 h-6 text-blue-500 rotate-180" />
            </div>
            <div className="flex-1">
              <h2 className="text-text-primary font-bold text-lg mb-1">
                {t("data.import.title")}
              </h2>
              <p className="text-text-secondary text-sm mb-4">
                {t("data.import.description")}
              </p>
              <button
                onClick={handleFileSelect}
                disabled={isImporting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500 text-white font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileJson className="w-4 h-4" />
                )}
                {isImporting ? t("data.import.reading") : t("data.import.selectFile")}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-yellow-500 font-medium text-sm mb-1">
                {t("data.warnings.title")}
              </h3>
              <ul className="text-text-secondary text-sm space-y-1">
                <li>• {t("data.warnings.backup")}</li>
                <li>• {t("data.warnings.backupBeforeImport")}</li>
                <li>• {t("data.warnings.fullOverwrite")}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <Popup
        isOpen={showStrategyDialog}
        onClose={() => {
          setShowStrategyDialog(false);
          setPendingImportData(null);
        }}
        position="center"
        title={t("data.strategy.title")}
      >
        <div className="p-4">
          {importPreview?.stats && (
            <div className="mb-4 p-3 rounded-lg bg-surface-light">
              <p className="text-text-secondary text-sm mb-2">{t("data.import.preview.title")}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-text-secondary">
                  {t("data.import.preview.taskTemplates")}: <span className="text-text-primary">{importPreview.stats.taskTemplates}</span>
                </div>
                <div className="text-text-secondary">
                  {t("data.import.preview.taskInstances")}: <span className="text-text-primary">{importPreview.stats.taskInstances}</span>
                </div>
                <div className="text-text-secondary">
                  {t("data.import.preview.rewardTemplates")}: <span className="text-text-primary">{importPreview.stats.rewardTemplates}</span>
                </div>
                <div className="text-text-secondary">
                  {t("data.import.preview.rewardInstances")}: <span className="text-text-primary">{importPreview.stats.rewardInstances}</span>
                </div>
                <div className="text-text-secondary">
                  {t("data.import.preview.users")}: <span className="text-text-primary">{importPreview.stats.users}</span>
                </div>
                <div className="text-text-secondary">
                  {t("data.import.preview.pointsHistory")}: <span className="text-text-primary">{importPreview.stats.pointsHistory}</span>
                </div>
              </div>
            </div>
          )}

          <p className="text-text-secondary text-sm mb-4">
            {t("data.strategy.warning")}
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={executeImport}
              className="flex flex-col items-start p-4 rounded-xl bg-surface border border-border hover:border-primary transition-colors text-left"
            >
              <span className="text-text-primary font-medium mb-1">
                {t("data.strategy.confirm")}
              </span>
              <span className="text-text-secondary text-sm">
                {t("data.strategy.fullOverwrite")}
              </span>
            </button>
          </div>
        </div>
      </Popup>

      <Popup
        isOpen={showResultDialog}
        onClose={() => {
          setShowResultDialog(false);
          setImportResult(null);
          setImportPreview(null);
        }}
        position="center"
        title={importResult?.success ? t("data.result.success") : t("data.result.failed")}
      >
        <div className="p-4">
          {importPreview && !importPreview.isValid ? (
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-text-secondary">{importPreview.error}</p>
            </div>
          ) : importResult ? (
            <div className="flex flex-col items-center text-center">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                  importResult.success
                    ? "bg-green-500/10"
                    : "bg-red-500/10"
                }`}
              >
                {importResult.success ? (
                  <CheckCircle className="w-8 h-8 text-green-500" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                )}
              </div>
              <p className="text-text-primary font-medium mb-2">
                {importResult.message}
              </p>
              {importResult.stats && (
                <div className="w-full mt-4 p-3 rounded-lg bg-surface-light text-left">
                  <p className="text-text-secondary text-sm mb-2">{t("data.result.stats")}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-text-secondary">
                      {t("data.import.preview.taskTemplates")}: <span className="text-text-primary">{importResult.stats.taskTemplates}</span>
                    </div>
                    <div className="text-text-secondary">
                      {t("data.import.preview.taskInstances")}: <span className="text-text-primary">{importResult.stats.taskInstances}</span>
                    </div>
                    <div className="text-text-secondary">
                      {t("data.import.preview.rewardTemplates")}: <span className="text-text-primary">{importResult.stats.rewardTemplates}</span>
                    </div>
                    <div className="text-text-secondary">
                      {t("data.import.preview.rewardInstances")}: <span className="text-text-primary">{importResult.stats.rewardInstances}</span>
                    </div>
                    <div className="text-text-secondary">
                      {t("data.import.preview.users")}: <span className="text-text-primary">{importResult.stats.users}</span>
                    </div>
                    <div className="text-text-secondary">
                      {t("data.import.preview.pointsHistory")}: <span className="text-text-primary">{importResult.stats.pointsHistory}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <button
            onClick={() => {
              setShowResultDialog(false);
              setImportResult(null);
              setImportPreview(null);
            }}
            className="w-full mt-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors"
          >
            {t("common.confirm")}
          </button>
        </div>
      </Popup>
    </div>
  );
}
