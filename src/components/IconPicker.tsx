import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { DynamicIcon } from './DynamicIcon';
import {
  REWARD_ICONS,
  REWARD_ICON_COLORS,
  type RewardIconName,
  type RewardIconColor,
} from '@/db/types';

interface IconPickerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIcon: RewardIconName;
  selectedColor: RewardIconColor;
  onSelect: (icon: RewardIconName, color: RewardIconColor) => void;
}

export function IconPicker({
  isOpen,
  onClose,
  selectedIcon,
  selectedColor,
  onSelect,
}: IconPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tempIcon, setTempIcon] = useState<RewardIconName>(selectedIcon);
  const [tempColor, setTempColor] = useState<RewardIconColor>(selectedColor);

  // 过滤图标
  const filteredIcons = REWARD_ICONS.filter((icon) =>
    icon.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 确认选择
  const handleConfirm = () => {
    onSelect(tempIcon, tempColor);
    onClose();
  };

  // 取消选择
  const handleCancel = () => {
    setTempIcon(selectedIcon);
    setTempColor(selectedColor);
    setSearchQuery('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-surface rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-text-primary text-lg font-bold">选择图标</h3>
          <button
            onClick={handleCancel}
            className="p-2 rounded-lg hover:bg-surface-light transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Preview */}
          <div className="flex items-center gap-4 p-4 bg-background rounded-xl">
            <span className="text-text-secondary text-sm">预览:</span>
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${tempColor}20` }}
            >
              <DynamicIcon
                name={tempIcon}
                color={tempColor}
                className="w-7 h-7"
              />
            </div>
            <span className="text-text-secondary text-sm ml-2">{tempIcon}</span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索图标..."
              className="w-full h-10 pl-9 pr-4 rounded-lg bg-background border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Color Selection */}
          <div>
            <p className="text-text-primary text-sm font-medium mb-3">图标颜色</p>
            <div className="flex flex-wrap gap-3">
              {REWARD_ICON_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setTempColor(color)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    tempColor === color
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-surface scale-110'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Icon Grid */}
          <div>
            <p className="text-text-primary text-sm font-medium mb-3">
              图标 ({filteredIcons.length})
            </p>
            <div className="grid grid-cols-6 gap-2">
              {filteredIcons.map((iconName) => (
                <button
                  key={iconName}
                  onClick={() => setTempIcon(iconName)}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                    tempIcon === iconName
                      ? 'bg-primary/20 ring-2 ring-primary'
                      : 'bg-background hover:bg-surface-light'
                  }`}
                >
                  <DynamicIcon
                    name={iconName}
                    color={tempIcon === iconName ? tempColor : '#a0a0a0'}
                    className="w-5 h-5"
                  />
                </button>
              ))}
            </div>
            {filteredIcons.length === 0 && (
              <p className="text-center text-text-muted py-8">未找到匹配的图标</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-border">
          <button
            onClick={handleCancel}
            className="flex-1 h-12 rounded-xl bg-surface-light text-text-primary font-bold hover:bg-surface transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 h-12 rounded-xl bg-primary text-white font-bold hover:bg-primary-light transition-colors shadow-lg shadow-primary/30"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}
