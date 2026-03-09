# 项目记忆 - Project Context

## 项目概况

这是一个**游戏化任务管理应用**，帮助用户通过积分奖励系统培养习惯。

## 技术栈速查

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript 5.8 + Vite 7 |
| 样式 | Tailwind CSS v4 |
| 后端 | Tauri v2 (Rust) |
| 数据库 | Dexie.js (IndexedDB) |
| 状态 | Zustand |
| 包管理 | Bun |

## 常用开发命令

```bash
# 桌面端开发
bun run dev:pc

# Android 开发
bun run dev:android

# 构建
bun run build
```

## 代码规范

- 所有注释使用**中文**
- 时间存储使用 UTC，显示用本地时间
- 任务实例每天最多生成一个
- 单用户设计，userId 始终为 1

## 目录结构约定

```
src/
├── components/     # UI 组件
├── pages/          # 页面组件
├── db/             # 数据库相关
├── hooks/          # React Hooks
├── libs/           # 工具函数
└── store/          # Zustand 状态
```

## 最近工作重点

<!-- 由 AI 自动更新 -->
- 任务完成规则支持（时间制/计数制）
- 番茄钟功能
- 自定义一天结束时间

## 待办事项

<!-- 可手动添加 -->
- [ ] 
