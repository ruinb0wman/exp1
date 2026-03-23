import { useState, useCallback } from "react";
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
  type ImportStrategy,
  type ImportPreview,
  type ImportResult,
} from "@/db/services";

export function DataImportExport() {
  const navigate = useNavigate();
  const { refreshUser } = useUserStore();


  // 导出状态
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // 导入状态
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [pendingImportData, setPendingImportData] = useState<ExportData | null>(null);
  const [showStrategyDialog, setShowStrategyDialog] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);

  // 处理导出
  const handleExport = useCallback(async () => {
    try {
      setIsExporting(true);
      setExportSuccess(false);

      // 获取导出数据
      const exportData = await exportAllData();
      const jsonContent = JSON.stringify(exportData, null, 2);

      // 保存文件
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
      alert(`导出失败: ${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setIsExporting(false);
    }
  }, []);

  // 处理文件选择
  const handleFileSelect = useCallback(async () => {
    try {
      setIsImporting(true);

      const file = await fileSystem.selectFile({
        accept: ".json",
        multiple: false,
      });

      if (file) {
        const data = JSON.parse(file.content) as ExportData;

        // 验证数据
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
        error: error instanceof Error ? error.message : "文件读取失败",
      });
      setShowResultDialog(true);
    } finally {
      setIsImporting(false);
    }
  }, []);

  // 执行导入
  const executeImport = useCallback(
    async (strategy: ImportStrategy) => {
      if (!pendingImportData) return;

      setShowStrategyDialog(false);
      setIsImporting(true);

      try {
        const result = await importData(pendingImportData, strategy);
        setImportResult(result);
        setShowResultDialog(true);

        // 导入成功后刷新用户积分
        if (result.success && result.userId) {
          await refreshUser();
        }
      } catch (error) {
        setImportResult({
          success: false,
          message: `导入失败: ${error instanceof Error ? error.message : "未知错误"}`,
        });
        setShowResultDialog(true);
      } finally {
        setIsImporting(false);
        setPendingImportData(null);
      }
    },
    [pendingImportData, refreshUser]
  );

  return (
    <div className="bg-background">
      {/* Header */}
      <header className="flex items-center p-4 pb-2 sticky top-0 bg-background z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center -ml-2 text-text-primary hover:text-primary transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-text-primary flex-1 text-center mr-8">
          数据导入导出
        </h1>
      </header>

      {/* Content */}
      <div className="p-4">
        {/* 导出卡片 */}
        <div className="rounded-xl bg-surface p-5 border border-border mb-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
              <Download className="w-6 h-6 text-green-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-text-primary font-bold text-lg mb-1">
                导出数据
              </h2>
              <p className="text-text-secondary text-sm mb-4">
                将您的所有任务、奖励、积分记录导出为 JSON 文件，作为备份或在其他设备上使用。
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
                  ? "导出中..."
                  : exportSuccess
                  ? "导出成功"
                  : "导出到文件"}
              </button>
            </div>
          </div>
        </div>

        {/* 导入卡片 */}
        <div className="rounded-xl bg-surface p-5 border border-border">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <Download className="w-6 h-6 text-blue-500 rotate-180" />
            </div>
            <div className="flex-1">
              <h2 className="text-text-primary font-bold text-lg mb-1">
                导入数据
              </h2>
              <p className="text-text-secondary text-sm mb-4">
                从备份文件恢复数据。您可以选择覆盖现有数据或与现有数据合并。
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
                {isImporting ? "读取中..." : "选择文件"}
              </button>
            </div>
          </div>
        </div>

        {/* 提示信息 */}
        <div className="mt-6 rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-yellow-500 font-medium text-sm mb-1">
                注意事项
              </h3>
              <ul className="text-text-secondary text-sm space-y-1">
                <li>• 导出的文件包含您的所有数据，请妥善保管</li>
                <li>• 导入前建议先导出一份当前数据作为备份</li>
                <li>• 全量覆盖将删除所有现有数据，请谨慎选择</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 导入策略选择弹窗 */}
      <Popup
        isOpen={showStrategyDialog}
        onClose={() => {
          setShowStrategyDialog(false);
          setPendingImportData(null);
        }}
        position="center"
        title="选择导入方式"
      >
        <div className="p-4">
          {importPreview?.stats && (
            <div className="mb-4 p-3 rounded-lg bg-surface-light">
              <p className="text-text-secondary text-sm mb-2">文件内容概览：</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-text-secondary">
                  任务模板: <span className="text-text-primary">{importPreview.stats.taskTemplates}</span>
                </div>
                <div className="text-text-secondary">
                  任务实例: <span className="text-text-primary">{importPreview.stats.taskInstances}</span>
                </div>
                <div className="text-text-secondary">
                  奖励模板: <span className="text-text-primary">{importPreview.stats.rewardTemplates}</span>
                </div>
                <div className="text-text-secondary">
                  奖励实例: <span className="text-text-primary">{importPreview.stats.rewardInstances}</span>
                </div>
                <div className="text-text-secondary">
                  用户数据: <span className="text-text-primary">{importPreview.stats.users}</span>
                </div>
                <div className="text-text-secondary">
                  积分记录: <span className="text-text-primary">{importPreview.stats.pointsHistory}</span>
                </div>
              </div>
            </div>
          )}

          <p className="text-text-secondary text-sm mb-4">
            请选择如何处理导入的数据：
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => executeImport("overwrite")}
              className="flex flex-col items-start p-4 rounded-xl bg-surface border border-border hover:border-primary transition-colors text-left"
            >
              <span className="text-text-primary font-medium mb-1">
                全量覆盖
              </span>
              <span className="text-text-secondary text-sm">
                删除所有现有数据，完全使用备份文件中的数据
              </span>
            </button>

            <button
              onClick={() => executeImport("merge")}
              className="flex flex-col items-start p-4 rounded-xl bg-surface border border-border hover:border-primary transition-colors text-left"
            >
              <span className="text-text-primary font-medium mb-1">
                智能合并
              </span>
              <span className="text-text-secondary text-sm">
                保留现有数据，仅添加备份文件中的新记录
              </span>
            </button>
          </div>
        </div>
      </Popup>

      {/* 导入结果弹窗 */}
      <Popup
        isOpen={showResultDialog}
        onClose={() => {
          setShowResultDialog(false);
          setImportResult(null);
          setImportPreview(null);
        }}
        position="center"
        title={importResult?.success ? "导入成功" : "导入失败"}
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
                  <p className="text-text-secondary text-sm mb-2">导入统计：</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-text-secondary">
                      任务模板: <span className="text-text-primary">{importResult.stats.taskTemplates}</span>
                    </div>
                    <div className="text-text-secondary">
                      任务实例: <span className="text-text-primary">{importResult.stats.taskInstances}</span>
                    </div>
                    <div className="text-text-secondary">
                      奖励模板: <span className="text-text-primary">{importResult.stats.rewardTemplates}</span>
                    </div>
                    <div className="text-text-secondary">
                      奖励实例: <span className="text-text-primary">{importResult.stats.rewardInstances}</span>
                    </div>
                    <div className="text-text-secondary">
                      用户数据: <span className="text-text-primary">{importResult.stats.users}</span>
                    </div>
                    <div className="text-text-secondary">
                      积分记录: <span className="text-text-primary">{importResult.stats.pointsHistory}</span>
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
            确定
          </button>
        </div>
      </Popup>
    </div>
  );
}
