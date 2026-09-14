import { ChevronLeft, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

interface HeaderProps {
  title: string;
  back?: boolean;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  onBack?: () => void;
}

interface HeaderActionButtonProps {
  icon: LucideIcon;
  onClick: () => void;
  /** 无障碍标签，同时作为 title 提示 */
  label: string;
  /** 左槽传 start、右槽传 end，使图标贴向屏幕外缘 */
  side?: "start" | "end";
}

/**
 * 页面顶部标题栏的统一组件。
 *
 * 约定：所有「标题栏」类页面顶部区域都必须使用本组件；槽位里的图标按钮
 * 必须使用 HeaderActionButton，不要在页面内手写样式，否则会再次产生分叉。
 * 例外：Home（问候语 + 进度）/ Pomo（计时器控制）的个性化头部语义不同，
 * 分别由 src/components/HomeHeader.tsx 与 pages/Pomo/components/PomoHeader.tsx 提供。
 */
export function Header({
  title,
  back = false,
  leftSlot,
  rightSlot,
  onBack,
}: HeaderProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <header className="flex h-header items-center bg-background px-4 justify-between sticky top-0 z-10 border-b border-border">
      {/* Left Section */}
      <div className="flex size-11 shrink-0 items-center justify-start">
        {back ? (
          <button
            type="button"
            onClick={handleBack}
            aria-label={t("common.back")}
            className="flex size-11 items-center justify-start text-text-primary hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        ) : (
          leftSlot
        )}
      </div>

      {/* Center Title */}
      <h1 className="text-text-primary text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center truncate">
        {title}
      </h1>

      {/* Right Section */}
      <div className="flex size-11 shrink-0 items-center justify-end">
        {rightSlot}
      </div>
    </header>
  );
}

/**
 * Header 左右槽位里的图标按钮，保证全应用命中区、颜色、对齐一致。
 */
export function HeaderActionButton({
  icon: Icon,
  onClick,
  label,
  side = "start",
}: HeaderActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex size-11 items-center ${
        side === "start" ? "justify-start" : "justify-end"
      } text-text-secondary hover:text-primary transition-colors`}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
