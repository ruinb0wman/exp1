import { useTranslation } from "react-i18next";
import { Check, Loader2, AlertCircle, Wifi, Download, Upload, GitMerge } from 'lucide-react';
import type { SyncProgress } from '@/services/sync';

interface SyncProgressProps {
  progress: SyncProgress;
}

const phaseIcons: Record<SyncProgress['phase'], React.ReactNode> = {
  idle: <Wifi className="w-6 h-6" />,
  init: <Wifi className="w-6 h-6" />,
  upload: <Upload className="w-6 h-6" />,
  merge: <GitMerge className="w-6 h-6" />,
  download: <Download className="w-6 h-6" />,
  apply: <Loader2 className="w-6 h-6 animate-spin" />,
  complete: <Check className="w-6 h-6" />,
  error: <AlertCircle className="w-6 h-6" />,
};

export function SyncProgressUI({ progress }: SyncProgressProps) {
  const { t } = useTranslation();
  const isError = progress.phase === 'error';
  const isComplete = progress.phase === 'complete';

  return (
    <div className="flex flex-col items-center py-8">
      <div
        className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
          isError
            ? 'bg-red-500/20 text-red-400'
            : isComplete
            ? 'bg-green-500/20 text-green-400'
            : 'bg-primary/20 text-primary'
        }`}
      >
        {phaseIcons[progress.phase]}
      </div>

      <p
        className={`text-lg font-medium mb-2 ${
          isError
            ? 'text-red-400'
            : isComplete
            ? 'text-green-400'
            : 'text-text-primary'
        }`}
      >
        {t(`sync.phase.${progress.phase}`)}
      </p>

      <p className="text-sm text-text-secondary text-center mb-6">
        {progress.message}
      </p>

      <div className="w-full max-w-xs">
        <div className="h-2 bg-surface-light rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isError
                ? 'bg-red-500'
                : isComplete
                ? 'bg-green-500'
                : 'bg-primary'
            }`}
            style={{ width: `${progress.progress}%` }}
          />
        </div>
        <p className="text-xs text-text-muted text-center mt-2">
          {progress.progress}%
        </p>
      </div>
    </div>
  );
}
