# 积分历史中间件实现方案

## 问题背景

在完成任务时，系统需要自动记录积分历史（PointsHistory），但最初的 DBCore 中间件实现无法正确拦截 `db.taskInstances.update()` 操作。

## 根本原因分析

### Dexie 的 update() 实现机制

Dexie 的 `update()` 方法内部实现路径：

```
Table.update()
  → Collection.modify()
    → 使用 cursor 获取匹配记录
    → 使用 getMany() 批量获取旧记录
    → 应用修改器（modifier）
    → 通过 mutate({type: 'put', ...}) 批量写入
```

DBCore 中间件拦截 `mutate` 时面临以下问题：
- `update()` 操作使用特殊的 `criteria` 和 `changeSpec` 字段
- 批量操作的复杂异步流程难以正确拦截
- 事务上下文难以在 DBCore 层正确处理

## 解决方案对比

| 方案 | 拦截能力 | 代码复杂度 | 事务处理 | 维护性 |
|------|----------|-----------|----------|--------|
| DBCore 中间件 | ❌ 无法拦截 update() | 高 | 手动管理 | 差 |
| **Hooks API** | ✅ 能拦截所有操作 | 低 | 自动处理 | **优** |

## 最终方案：Dexie Hooks API

### 核心实现

```typescript
// src/db/middleware/pointsHistoryMiddleware.ts

export function createPointsHistoryMiddleware() {
  return {
    register(db: DB) {
      // 1. 监听任务更新（完成任务/撤销完成）
      db.taskInstances.hook('updating', function (mods, primKey, obj, trans) {
        const oldInstance = obj as TaskInstance;
        const newInstance = { ...oldInstance, ...mods } as TaskInstance;

        // 检测状态变化
        if (oldInstance.status !== 'completed' && newInstance.status === 'completed') {
          // 发放积分
          trans.on('complete', async () => {
            await db.pointsHistory.add({
              userId: newInstance.userId,
              amount: newInstance.template?.rewardPoints || 0,
              type: 'task_reward',
              relatedInstanceId: primKey as number,
              createdAt: new Date().toISOString(),
            });
          });
        }
      });

      // 2. 监听奖励创建（兑换奖励）
      db.rewardInstances.hook('creating', function (primKey, obj, trans) {
        const instance = obj as RewardInstance;
        // 扣除积分
        trans.on('complete', async () => {
          await db.pointsHistory.add({
            userId: instance.userId,
            amount: -(instance.template?.pointsCost || 0),
            type: 'reward_exchange',
            relatedInstanceId: primKey as number,
            createdAt: new Date().toISOString(),
          });
        });
      });
    },
  };
}
```

### 关键设计决策

#### 1. 使用 `hook('updating')` 而非 `hook('creating')`

- **updating**：在更新现有记录时触发，适用于任务完成/撤销场景
- **creating**：在创建新记录时触发，适用于奖励兑换场景

#### 2. 在 `trans.on('complete')` 中记录积分

```typescript
trans.on('complete', async () => {
  // 事务完成后执行
  await db.pointsHistory.add({...});
});
```

**原因**：
- 确保主业务操作（任务状态更新）成功后再记录积分
- 如果任务更新失败，不会留下无效的积分记录
- 保持数据一致性

#### 3. 合并新旧记录检测状态变化

```typescript
const oldInstance = obj;           // Dexie 提供的旧记录
const newInstance = { ...obj, ...mods };  // 合并得到新记录

// 检测状态变化
if (oldInstance.status !== 'completed' && newInstance.status === 'completed') {
  // 任务完成，发放积分
}
```

**优势**：
- Dexie 自动处理部分更新（`mods` 只包含变更字段）
- 无需手动查询旧记录
- 代码简洁，易于理解

### 注册方式

```typescript
// src/db/index.ts

const createDB = () => {
  const db = new Dexie('exp-v4') as DB;
  migration(db);

  // 注册积分历史中间件（Hooks）
  const pointsHistoryMiddleware = createPointsHistoryMiddleware();
  pointsHistoryMiddleware.register(db);

  return db;
};
```

## 与项目现有模式的一致性

项目已在 `taskTemplateMiddleware.ts` 中使用相同的 Hooks API 模式：

```typescript
// taskTemplateMiddleware.ts
export function createTaskTemplateMiddleware() {
  return {
    register(db: DB) {
      db.taskTemplates.hook('creating', function (primKey, obj, trans) {
        // 创建模板时生成实例
      });

      db.taskTemplates.hook('updating', function (mods, primKey, obj, trans) {
        // 更新模板时生成实例
      });
    },
  };
}
```

## 最佳实践

1. **Hooks vs DBCore**：
   - 使用 Hooks API 监听数据变更（creating/updating/deleting）
   - 使用 DBCore 中间件进行更低级的操作拦截（如同步、审计日志）

2. **事务处理**：
   - 使用 `trans.on('complete')` 在事务成功后执行副作用
   - 使用 `trans.on('error')` 处理事务失败情况

3. **错误处理**：
   - 积分记录失败不应影响主业务流程
   - 使用 try-catch 包裹积分操作，记录错误但不抛出

## 参考文档

- [Dexie Hooks API](https://dexie.org/docs/Table/Table.hook('creating'))
- [Dexie DBCore Middleware](https://dexie.org/docs/Dexie/Dexie.use())
- [Dexie Collection.modify()](https://dexie.org/docs/Collection/Collection.modify())
