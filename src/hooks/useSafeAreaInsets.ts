import { useState, useEffect } from "react";

interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * 获取安全区域（Safe Area）的 Hook
 * 使用 CSS env(safe-area-inset-*) 获取安全区域值
 * 主要用于移动端处理刘海屏、状态栏、手势条等
 */
export function useSafeAreaInsets(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    const calculateInsets = () => {
      // 创建一个临时元素来获取计算后的 env() 值
      const div = document.createElement("div");
      div.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        padding-top: env(safe-area-inset-top);
        padding-right: env(safe-area-inset-right);
        padding-bottom: env(safe-area-inset-bottom);
        padding-left: env(safe-area-inset-left);
        pointer-events: none;
        visibility: hidden;
      `;
      document.body.appendChild(div);

      const styles = getComputedStyle(div);
      const top = parseFloat(styles.paddingTop) || 0;
      const right = parseFloat(styles.paddingRight) || 0;
      const bottom = parseFloat(styles.paddingBottom) || 0;
      const left = parseFloat(styles.paddingLeft) || 0;

      document.body.removeChild(div);

      setInsets({ top, right, bottom, left });
    };

    // 初始计算
    calculateInsets();

    // 监听窗口变化
    window.addEventListener("resize", calculateInsets);
    window.addEventListener("orientationchange", calculateInsets);

    // 延迟再次计算，确保 WebView 已正确应用安全区域
    const timeoutId = setTimeout(calculateInsets, 100);
    const intervalId = setInterval(calculateInsets, 500);

    // 5秒后停止轮询
    setTimeout(() => clearInterval(intervalId), 5000);

    return () => {
      window.removeEventListener("resize", calculateInsets);
      window.removeEventListener("orientationchange", calculateInsets);
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, []);

  return insets;
}
