/**
 * PC端标题栏组件
 * - 使用 data-tauri-drag-region 实现窗口拖动
 * - 无系统控制按钮（缩小/放大/关闭）
 */
export function TitleBar() {
  return (
    <div
      data-tauri-drag-region
      className="fixed top-0 left-0 right-0 landscape:left-56 h-8 bg-surface z-[9999] select-none border-b border-border"
    >
      {/* 标题栏内容区域 - 居中显示应用名称 */}
      <div data-tauri-drag-region className="h-full flex items-center justify-center">
        <span className="text-text-secondary text-sm font-medium">
          Exp1
        </span>
      </div>
    </div>
  );
}
