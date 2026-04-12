import { useState } from "react";
import { RefreshCw, ScanLine } from "lucide-react";
import { useSync } from "@/hooks/useSync";
import { SyncModal } from "@/components/SyncUI";
import { QRScanner } from "@/components/SyncUI/QRScanner";
import { SyncProgressUI } from "@/components/SyncUI/SyncProgress";
import { getDeviceId } from "@/db";

export function Sync() {
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

  return (
    <div className="min-h-screen pb-24 bg-background">
      <header className="flex items-center p-4 pb-2 sticky top-0 bg-background z-10">
        <h1 className="text-lg font-bold text-text-primary flex-1 text-center">
          数据同步
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
                {isMobile ? "与 PC 端同步" : "与手机端同步"}
              </h2>
              <p className="text-text-secondary text-sm">
                {state.lastSyncAt
                  ? `最后同步: ${formatLastSync(state.lastSyncAt)}`
                  : "从未同步"}
              </p>
            </div>
          </div>

          {isMobile ? (
            <button
              onClick={() => setShowScanner(true)}
              className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-light transition-colors flex items-center justify-center gap-2"
            >
              <ScanLine className="w-5 h-5" />
              扫描二维码
            </button>
          ) : (
            <button
              onClick={openSync}
              className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-light transition-colors"
            >
              显示二维码
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
              同步说明
            </h3>
            <div className="space-y-3 text-text-secondary text-sm">
              <div className="flex gap-3">
                <span className="text-primary font-bold">1</span>
                <p>PC 端显示二维码后，使用手机扫描</p>
              </div>
              <div className="flex gap-3">
                <span className="text-primary font-bold">2</span>
                <p>手机将自动与 PC 端交换数据</p>
              </div>
              <div className="flex gap-3">
                <span className="text-primary font-bold">3</span>
                <p>同步完成后，两端数据保持一致</p>
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
              取消同步
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

function formatLastSync(dateStr: string | null): string {
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
    return date.toLocaleDateString("zh-CN");
  }
}
