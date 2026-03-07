import { useEffect, useCallback, useState } from 'react';
import { X } from 'lucide-react';

export interface PopupProps {
  /** 控制显示 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 位置模式 */
  position: 'bottom' | 'center';
  /** 点击遮罩是否可关闭，默认 true */
  maskClosable?: boolean;
  /** 标题（可选） */
  title?: string;
  /** 是否显示关闭按钮，默认 true */
  showCloseButton?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 是否隐藏遮罩 */
  hideMask?: boolean;
  /** 内容 */
  children: React.ReactNode;
  /** 自定义头部（优先级高于 title） */
  header?: React.ReactNode;
  /** 自定义底部 */
  footer?: React.ReactNode;
  /** 最大高度（如 '80vh'） */
  maxHeight?: string;
  /** 宽度（center 模式有效） */
  width?: string;
}

export function Popup({
  isOpen,
  onClose,
  position,
  maskClosable = true,
  title,
  showCloseButton = true,
  className = '',
  hideMask = false,
  children,
  header,
  footer,
  maxHeight,
  width,
}: PopupProps) {
  // 动画状态: 'entering' | 'entered' | 'exiting' | 'exited'
  const [animationState, setAnimationState] = useState<'entering' | 'entered' | 'exiting' | 'exited'>(
    isOpen ? 'entered' : 'exited'
  );

  // ESC 键关闭
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && animationState === 'entered') {
        onClose();
      }
    },
    [isOpen, onClose, animationState]
  );

  // 处理动画状态
  useEffect(() => {
    if (isOpen) {
      setAnimationState('entering');
      const timer = setTimeout(() => setAnimationState('entered'), 50);
      return () => clearTimeout(timer);
    } else if (animationState !== 'exited') {
      setAnimationState('exiting');
      const timer = setTimeout(() => setAnimationState('exited'), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 阻止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // 监听 ESC 键
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 遮罩点击
  const handleMaskClick = () => {
    if (maskClosable && animationState === 'entered') {
      onClose();
    }
  };

  // 内容点击阻止冒泡
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (animationState === 'exited') return null;

  const isBottom = position === 'bottom';
  const isEntering = animationState === 'entering';
  const isExiting = animationState === 'exiting';

  // 遮罩动画样式
  const maskAnimationStyle: React.CSSProperties = {
    opacity: isEntering ? 0 : isExiting ? 0 : 1,
    transition: 'opacity 300ms ease-out',
  };

  // 内容动画样式
  const getContentAnimationStyle = (): React.CSSProperties => {
    if (isBottom) {
      return {
        transform: isEntering ? 'translateY(100%)' : isExiting ? 'translateY(100%)' : 'translateY(0)',
        transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
      };
    } else {
      return {
        opacity: isEntering ? 0 : isExiting ? 0 : 1,
        transform: isEntering
          ? 'scale(0.95)'
          : isExiting
          ? 'scale(0.95)'
          : 'scale(1)',
        transition: 'opacity 200ms ease-out, transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
      };
    }
  };

  const customStyles: React.CSSProperties = {
    maxHeight: maxHeight,
    width: width,
  };

  return (
    <div
      className={`fixed inset-0 z-[60] flex justify-center ${
        hideMask ? '' : 'bg-black/60'
      } ${isBottom ? 'items-end' : 'items-center'} ${className}`}
      style={maskAnimationStyle}
      onClick={handleMaskClick}
    >
      {/* 内容区域 */}
      <div
        className={`bg-[#1b1b1f] shadow-2xl flex flex-col ${
          isBottom ? 'w-full rounded-t-2xl' : `rounded-2xl ${width ? '' : 'max-w-lg w-[90%]'}`
        }`}
        style={{ ...getContentAnimationStyle(), ...customStyles }}
        onClick={handleContentClick}
      >
        {/* 顶部拖动条（仅 bottom 模式） */}
        {isBottom && (
          <div className="w-12 h-1.5 bg-zinc-600 rounded-full mx-auto mt-3 mb-2" />
        )}

        {/* 头部区域 */}
        {header ? (
          <div className="px-4 pt-4">{header}</div>
        ) : title || showCloseButton ? (
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            {title && (
              <h2 className="text-xl font-bold text-white">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-zinc-700 transition-colors"
                aria-label="关闭"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            )}
          </div>
        ) : null}

        {/* 内容区域 */}
        <div className="flex-1 overflow-auto px-4 py-2">{children}</div>

        {/* 底部区域 */}
        {footer && <div className="px-4 pb-4 pt-2">{footer}</div>}

        {/* bottom 模式默认底部安全间距 */}
        {isBottom && !footer && <div className="h-4" />}
      </div>
    </div>
  );
}
