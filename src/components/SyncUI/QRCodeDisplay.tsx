import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
  /** QR码内容 */
  content: string;
  /** 尺寸（像素） */
  size?: number;
  /** 加载中 */
  loading?: boolean;
}

export function QRCodeDisplay({
  content,
  size = 256,
  loading = false,
}: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!content || loading) return;

    QRCode.toDataURL(content, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then(url => {
        setDataUrl(url);
        setError('');
      })
      .catch(err => {
        console.error('QR code generation failed:', err);
        setError('生成二维码失败');
      });
  }, [content, size, loading]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center bg-surface rounded-xl"
        style={{ width: size, height: size }}
      >
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-center bg-surface rounded-xl p-4"
        style={{ width: size, height: size }}
      >
        <p className="text-sm text-red-400 text-center">{error}</p>
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        className="flex items-center justify-center bg-surface rounded-xl"
        style={{ width: size, height: size }}
      >
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-xl">
      <img
        src={dataUrl}
        alt="Sync QR Code"
        width={size}
        height={size}
        className="block"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
