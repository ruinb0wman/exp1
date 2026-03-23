import { useState, useCallback } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { Popup } from '@/components/Popup';
import { QRCodeDisplay } from './QRCodeDisplay';
import { QRScanner } from './QRScanner';
import { ConflictResolver } from './ConflictResolver';
import { SyncProgressUI } from './SyncProgress';
import type { SyncProgress, FieldConflict, SyncTable } from '@/services/sync';

interface SyncModalProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 平台类型 */
  platform: 'desktop' | 'mobile';
  /** QR码内容（PC端） */
  qrCodeContent?: string;
  /** 同步进度 */
  progress: SyncProgress;
  /** 冲突列表 */
  conflicts?: FieldConflict[];
  /** 开始同步（手机端扫码后） */
  onStartSync?: (serverUrl: string) => void;
  /** 解决冲突 */
  onResolveConflicts?: (resolutions: { table: SyncTable; syncId: string; field: string; choice: 'local' | 'remote' }[]) => void;
  /** 重试 */
  onRetry?: () => void;
  /** 取消同步 */
  onCancel?: () => void;
}

export function SyncModal({
  isOpen,
  onClose,
  platform,
  qrCodeContent,
  progress,
  conflicts,
  onStartSync,
  onResolveConflicts,
  onRetry,
  onCancel,
}: SyncModalProps) {
  const [showScanner, setShowScanner] = useState(false);

  // 处理扫码结果
  const handleScan = useCallback((content: string) => {
    console.log('QR Scanner - Raw content:', content);
    setShowScanner(false);
    try {
      // 解析 QR 码内容
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

  // 渲染内容
  const renderContent = () => {
    // 冲突解决模式
    if (conflicts && conflicts.length > 0 && onResolveConflicts) {
      return (
        <ConflictResolver
          conflicts={conflicts}
          onResolve={onResolveConflicts}
          onCancel={() => onCancel?.()}
        />
      );
    }

    // 错误状态
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
              重试
            </button>
            <button
              onClick={onCancel}
              className="px-6 py-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      );
    }

    // 同步中或完成
    if (progress.phase !== 'idle') {
      return (
        <div className="py-4">
          <SyncProgressUI progress={progress} />
          {progress.phase !== 'complete' && progress.phase !== 'conflict' && (
            <button
              onClick={onCancel}
              className="w-full mt-6 py-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              取消同步
            </button>
          )}
        </div>
      );
    }

    // 初始状态
    return (
      <div className="flex flex-col items-center py-6">
        {platform === 'desktop' ? (
          // PC端：显示 QR 码
          <>
            <p className="text-text-secondary text-center mb-6">
              请在手机端打开应用，扫描下方二维码进行同步
            </p>
            <QRCodeDisplay
              content={qrCodeContent || ''}
              size={240}
              loading={!qrCodeContent}
            />
            <div className="mt-6 text-center">
              <p className="text-sm text-text-muted">
                等待手机端连接...
              </p>
            </div>
          </>
        ) : (
          // 手机端：显示扫码按钮
          <>
            <p className="text-text-secondary text-center mb-6">
              点击下方按钮扫描 PC 端显示的二维码
            </p>
            <button
              onClick={() => setShowScanner(true)}
              className="flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-xl hover:bg-primary-light transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              扫描二维码
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
        title="数据同步"
        width="400px"
      >
        {renderContent()}
      </Popup>

      {/* 扫码界面 */}
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
