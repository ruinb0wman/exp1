import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, ScanLine } from "lucide-react";
import { useSync } from "@/hooks/useSync";
import { SyncModal } from "@/components/SyncUI";
import { QRScanner } from "@/components/SyncUI/QRScanner";
import { SyncProgressUI } from "@/components/SyncUI/SyncProgress";
import { getDeviceId } from "@/db";
import { formatLastSync, formatLastSyncI18n } from "@/libs/time";

export function Sync() {
  const { t } = useTranslation();
  const isMobile = getDeviceId() === "mobile";
  const { state, openSync, closeSync, startSync, retrySync, cancelSync } = useSync();
  const [showScanner, setShowScanner] = useState(false);

  const handleScan = async (content: string) => {
    setShowScanner(false);
    try {
      const data = JSON.parse(content);
      if (data.ip && data.port) {
        const serverUrl = `http://${data.ip}:${data.port}`;
        await startSync(serverUrl);
      }
    } catch (error) {
      console.error("Failed to parse QR code:", error);
    }
  };

  const lastSyncResult = formatLastSync(state.lastSyncAt);

  return (
    <div className="min-h-screen pb-24 bg-background">
      <header className="flex items-center p-4 pb-2 sticky top-0 bg-background z-10">
        <h1 className="text-lg font-bold text-text-primary flex-1 text-center">
          {t("sync.title")}
        </h1>
      </header>

      <div className="p-4">
        <div className="rounded-xl bg-surface p-6 border border-border">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <RefreshCw className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-text-primary text-lg font-bold">
                {isMobile ? t("sync.syncWith.mobile") : t("sync.syncWith.pc")}
              </h2>
              <p className="text-text-secondary text-sm">
                {lastSyncResult.type === "never"
                  ? t("sync.lastSync.never")
                  : t("sync.lastSync.lastTime", { time: formatLastSyncI18n(lastSyncResult, t) })}
              </p>
            </div>
          </div>

          {isMobile ? (
            <button
              onClick={() => setShowScanner(true)}
              className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-light transition-colors flex items-center justify-center gap-2"
            >
              <ScanLine className="w-5 h-5" />
              {t("sync.scanQR")}
            </button>
          ) : (
            <button
              onClick={openSync}
              className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-light transition-colors"
            >
              {t("sync.showQR")}
            </button>
          )}

          {!isMobile && state.progress.phase !== "idle" && state.progress.phase !== "complete" && (
            <div className="mt-4">
              <SyncProgressUI progress={state.progress} />
            </div>
          )}
        </div>

        {!isMobile && (
          <div className="mt-6 p-4">
            <h3 className="text-text-secondary text-sm font-medium mb-3">
              {t("sync.syncInstructions")}
            </h3>
            <div className="space-y-3 text-text-secondary text-sm">
              <div className="flex gap-3">
                <span className="text-primary font-bold">1</span>
                <p>{t("sync.instruction1")}</p>
              </div>
              <div className="flex gap-3">
                <span className="text-primary font-bold">2</span>
                <p>{t("sync.instruction2")}</p>
              </div>
              <div className="flex gap-3">
                <span className="text-primary font-bold">3</span>
                <p>{t("sync.instruction3")}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {isMobile && state.progress.phase !== "idle" && state.progress.phase !== "complete" && (
        <div className="p-4">
          <div className="rounded-xl bg-surface p-4 border border-border">
            <SyncProgressUI progress={state.progress} />
            <button
              onClick={cancelSync}
              className="w-full mt-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              {t("sync.cancelSync")}
            </button>
          </div>
        </div>
      )}

      {!isMobile && (
        <SyncModal
          isOpen={state.isOpen}
          onClose={closeSync}
          platform="desktop"
          qrCodeContent={state.qrCodeContent}
          progress={state.progress}
          onStartSync={startSync}
          onRetry={retrySync}
          onCancel={cancelSync}
        />
      )}

      {isMobile && (
        <QRScanner
          isOpen={showScanner}
          onScan={handleScan}
          onCancel={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
