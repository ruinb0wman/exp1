import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, RefreshCw } from 'lucide-react';

interface QRScannerProps {
  /** 扫描成功回调 */
  onScan: (content: string) => void;
  /** 取消扫描 */
  onCancel: () => void;
  /** 是否显示 */
  isOpen: boolean;
}

export function QRScanner({ onScan, onCancel, isOpen }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'detected'>('idle');

  // 检查相机权限
  const checkCameraPermission = async (): Promise<boolean> => {
    try {
      const stream = await (navigator as Navigator & { mediaDevices: MediaDevices }).mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      return true;
    } catch (err) {
      console.error('Camera permission check failed:', err);
      return false;
    }
  };

  // 重试扫描
  const handleRetry = () => {
    setError('');
    setScanStatus('idle');
    startScanning();
  };

  // 开始扫描
  const startScanning = async () => {
    setIsInitializing(true);
    setError('');
    setScanStatus('idle');

    try {
      const hasPermission = await checkCameraPermission();
      
      if (!hasPermission) {
        setError('需要相机权限才能扫描二维码\n请在系统设置中允许相机访问');
        setIsInitializing(false);
        return;
      }

      const scanner = new Html5Qrcode('qr-scanner');
      scannerRef.current = scanner;

      // 获取可用相机设备
      const devices = await Html5Qrcode.getCameras();
      console.log('Available cameras:', devices);

      let cameraConfig: string | { facingMode: string } = { facingMode: 'environment' };
      
      // 如果有多个相机，优先选择后置相机
      if (devices && devices.length > 0) {
        const backCamera = devices.find((d: { id: string; label: string }) => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('后置')
        );
        if (backCamera) {
          cameraConfig = backCamera.id;
          console.log('Using back camera:', backCamera.label);
        } else {
          cameraConfig = devices[0].id;
          console.log('Using first camera:', devices[0].label);
        }
      }

      await scanner.start(
        cameraConfig,
        {
          fps: 30,
          qrbox: undefined,
          aspectRatio: 1.0,
        },
        (decodedText: string) => {
          console.log('QR Code detected:', decodedText);
          setScanStatus('detected');
          // 先停止扫描器，再调用回调
          if (scanner.isScanning) {
            scanner.stop().then(() => {
              onScan(decodedText);
            }).catch((err: Error) => {
              console.error('Error stopping scanner after scan:', err);
              onScan(decodedText);
            });
          } else {
            onScan(decodedText);
          }
        },
        (errorMessage: string) => {
          // 扫描过程中的错误（未识别到二维码），忽略但记录
          if (errorMessage && !errorMessage.includes('No MultiFormat Readers')) {
            console.log('Scanning error:', errorMessage);
          }
        }
      );

      setIsInitializing(false);
      setScanStatus('scanning');
    } catch (err) {
      console.error('Failed to start scanner:', err);
      
      let errorMessage = '无法启动相机，请检查权限设置';
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMessage = '相机权限被拒绝\n请在系统设置中允许相机访问';
        } else if (err.name === 'NotFoundError') {
          errorMessage = '未找到相机设备';
        } else if (err.name === 'NotReadableError') {
          errorMessage = '相机被其他应用占用';
        } else if (err.name === 'OverconstrainedError') {
          errorMessage = '相机不支持所需的配置';
        }
      }
      
      setError(errorMessage);
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch((err: Error) => {
          // 忽略 "scanner is not running" 错误
          if (!err.message?.includes('not running')) {
            console.error('Error stopping scanner:', err);
          }
        });
        scannerRef.current = null;
      }
      setError('');
      setScanStatus('idle');
      return;
    }

    const timer = setTimeout(startScanning, 100);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch((err: Error) => {
          // 忽略 "scanner is not running" 错误
          if (!err.message?.includes('not running')) {
            console.error('Error stopping scanner:', err);
          }
        });
        scannerRef.current = null;
      }
    };
  }, [isOpen, onScan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* 头部 */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <h2 className="text-lg font-semibold text-white">扫描二维码</h2>
        <button
          onClick={onCancel}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* 扫描区域 */}
      <div className="relative w-full h-full flex items-center justify-center">
        {/* 相机预览容器 */}
        <div
          id="qr-scanner"
          className="w-full h-full"
        />

        {/* 扫描框遮罩 */}
        <div className="absolute inset-0 pointer-events-none">
          {/* 中心扫描框 */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64">
            {/* 四角 */}
            <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-primary rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-primary rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-primary rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-primary rounded-br-lg" />

            {/* 扫描线动画 */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary animate-scan-line" />
          </div>

          {/* 暗色遮罩 */}
          <div className="absolute inset-0 bg-black/50" style={{
            clipPath: 'polygon(0% 0%, 0% 100%, calc(50% - 8rem) 100%, calc(50% - 8rem) calc(50% - 8rem), calc(50% + 8rem) calc(50% - 8rem), calc(50% + 8rem) calc(50% + 8rem), calc(50% - 8rem) calc(50% + 8rem), calc(50% - 8rem) 100%, 100% 100%, 100% 0%)'
          }} />
        </div>

        {/* 加载状态 */}
        {isInitializing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
            <Camera className="w-12 h-12 text-primary mb-4 animate-pulse" />
            <p className="text-white">正在启动相机...</p>
          </div>
        )}

        {/* 扫描中状态 */}
        {scanStatus === 'scanning' && !isInitializing && !error && (
          <div className="absolute top-24 left-0 right-0 text-center pointer-events-none">
            <p className="text-white/80 text-sm bg-black/50 inline-block px-4 py-2 rounded-full">
              请将二维码对准扫描框
            </p>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-8">
            <Camera className="w-12 h-12 text-red-400 mb-4" />
            <p className="text-red-400 text-center mb-4 whitespace-pre-line">{error}</p>
            <div className="flex gap-4">
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                重试
              </button>
              <button
                onClick={onCancel}
                className="px-6 py-2 bg-surface text-white rounded-lg hover:bg-surface/80 transition-colors"
              >
                返回
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-white/70 text-sm">将二维码放入框内即可自动扫描</p>
      </div>

      {/* 添加扫描线动画样式 */}
      <style>{`
        @keyframes scan-line {
          0% { transform: translateY(0); }
          50% { transform: translateY(256px); }
          100% { transform: translateY(0); }
        }
        .animate-scan-line {
          animation: scan-line 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
