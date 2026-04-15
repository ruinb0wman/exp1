import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { Popup } from '@/components/Popup';
import { QRCodeDisplay } from './QRCodeDisplay';
import { QRScanner } from './QRScanner';
import { SyncProgressUI } from './SyncProgress';
import type { SyncProgress } from '@/services/sync';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: 'desktop' | 'mobile';
  qrCodeContent?: string;
  progress: SyncProgress;
  onStartSync?: (serverUrl: string) => void;
  onRetry?: () => void;
  onCancel?: () => void;
}

export function SyncModal({
  isOpen,
  onClose,
  platform,
  qrCodeContent,
  progress,
  onStartSync,
  onRetry,
  onCancel,
}: SyncModalProps) {
  const { t } = useTranslation();
  const [showScanner, setShowScanner] = useState(false);

  const handleScan = useCallback((content: string) => {
    console.log('QR Scanner - Raw content:', content);
    setShowScanner(false);
    try {
      const data = JSON.parse(content);
      console.log('QR Scanner - Parsed data:', data);
      if (data.ip && data.port) {
        const serverUrl = `http://${data.ip}:${data.port}`;
        console.log('QR Scanner - Server URL:', serverUrl);
        onStartSync?.(serverUrl);
      } else {
        console.error('QR Scanner - Missing ip or port in data:', data);
      }
    } catch (error) {
      console.error('QR Scanner - Failed to parse QR code content:', error);
      console.error('QR Scanner - Raw content was:', content);
    }
  }, [onStartSync]);

  const renderContent = () => {
    if (progress.phase === 'error') {
      return (
        <div className="flex flex-col items-center py-8">
          <SyncProgressUI progress={progress} />
          <div className="flex gap-3 mt-6">
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-light transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              {t("sync.retry")}
            </button>
            <button
              onClick={onCancel}
              className="px-6 py-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      );
    }

    if (progress.phase !== 'idle') {
      return (
        <div className="py-4">
          <SyncProgressUI progress={progress} />
          {progress.phase !== 'complete' && (
            <button
              onClick={onCancel}
              className="w-full mt-6 py-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              {t("sync.cancelSync")}
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center py-6">
        {platform === 'desktop' ? (
          <>
            <p className="text-text-secondary text-center mb-6">
              {t("sync.pcInstructions")}
            </p>
            <QRCodeDisplay
              content={qrCodeContent || ''}
              size={240}
              loading={!qrCodeContent}
            />
            <div className="mt-6 text-center">
              <p className="text-sm text-text-muted">
                {t("sync.waitingForConnection")}
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="text-text-secondary text-center mb-6">
              {t("sync.mobileInstructions")}
            </p>
            <button
              onClick={() => setShowScanner(true)}
              className="flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-xl hover:bg-primary-light transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              {t("sync.scanQR")}
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <Popup
        isOpen={isOpen && !showScanner}
        onClose={onClose}
        position="center"
        title={t("sync.title")}
        width="400px"
      >
        {renderContent()}
      </Popup>

      {platform === 'mobile' && (
        <QRScanner
          isOpen={showScanner}
          onScan={handleScan}
          onCancel={() => setShowScanner(false)}
        />
      )}
    </>
  );
}
