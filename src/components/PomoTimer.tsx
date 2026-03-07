import { useEffect, useRef } from 'react';
import { usePomoStore } from '@/store/pomoStore';
import { POMO_MODE_CONFIG } from '@/db/types/pomo';

export function PomoTimer() {
  const { timeLeft, totalTime, mode, isRunning, isPaused, tick } = usePomoStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // 格式化时间显示为 MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // 计算进度百分比
  const progress = ((totalTime - timeLeft) / totalTime) * 100;
  const config = POMO_MODE_CONFIG[mode];
  
  // 圆形进度条参数
  const size = 280;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  
  // 计时器逻辑
  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        tick();
      }, 1000);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, isPaused, tick]);
  
  // 页面可见性变化处理（后台运行）
  useEffect(() => {
    const handleVisibilityChange = () => {
      // 使用 Page Visibility API 确保后台计时继续
      if (document.hidden && isRunning && !isPaused) {
        // 页面隐藏时，记录当前时间
        sessionStorage.setItem('pomoHiddenAt', Date.now().toString());
      } else if (!document.hidden && isRunning && !isPaused) {
        // 页面显示时，计算时间差
        const hiddenAt = sessionStorage.getItem('pomoHiddenAt');
        if (hiddenAt) {
          const diff = Math.floor((Date.now() - parseInt(hiddenAt)) / 1000);
          // 批量处理tick
          for (let i = 0; i < diff && i < 60; i++) {
            tick();
          }
          sessionStorage.removeItem('pomoHiddenAt');
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRunning, isPaused, tick]);
  
  return (
    <div className="relative flex items-center justify-center">
      {/* 外圈发光效果 */}
      <div 
        className="absolute inset-0 rounded-full blur-2xl opacity-20"
        style={{ backgroundColor: config.color }}
      />
      
      {/* SVG 进度环 */}
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* 背景圆环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2a2a30"
          strokeWidth={strokeWidth}
        />
        
        {/* 进度圆环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={config.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      
      {/* 中心内容 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* 时间显示 */}
        <div className="text-6xl font-bold font-display tracking-tight text-white">
          {formatTime(timeLeft)}
        </div>
        
        {/* 状态标签 */}
        <div 
          className="mt-2 text-lg font-medium px-4 py-1 rounded-full"
          style={{ 
            backgroundColor: `${config.color}20`,
            color: config.color 
          }}
        >
          {isRunning ? (isPaused ? '已暂停' : config.label + '中') : config.label}
        </div>
      </div>
      
      {/* 刻度点（装饰） */}
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-text-muted rounded-full"
          style={{
            transform: `rotate(${i * 30}deg) translateY(${-size / 2 + 16}px)`,
          }}
        />
      ))}
    </div>
  );
}
