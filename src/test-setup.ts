// 测试环境设置
import 'fake-indexeddb/auto';

// 模拟 window 对象
if (typeof window === 'undefined') {
  (globalThis as any).window = {};
}

// 模拟 performance
if (typeof performance === 'undefined') {
  (globalThis as any).performance = {
    now: () => Date.now(),
  };
}
