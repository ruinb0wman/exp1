# TaskTemplate 自动生成 TaskInstance 方案

## 概述

本方案实现了在 Dexie.js 数据库层面自动检查 TaskTemplate 并生成 TaskInstance 的机制，替代了原来在 Home 页面手动检查的方式。

## 核心设计

### 1. Dexie.js 中间件

**文件**: `src/db/middleware/taskTemplateMiddleware.ts`

#### 功能
- 在 TaskTemplate 创建和更新时自动检查是否需要生成 TaskInstance
- 使用数据库事务确保不会重复生成实例

#### 实现机制

##### 创建模板时
```typescript
db.taskTemplates.hook('creating', function (_primKey, obj, _trans) {
  const template = obj as TaskTemplate;
  
  if (!template.enabled) return;

  this.onsuccess = async (generatedId) => {
    const templateId = generatedId as number;
    
    // 防重检查
    if (processedTemplateIds.has(templateId)) return;
    processedTemplateIds.add(templateId);
    
    template.id = templateId;
    await checkAndGenerateForTemplate(db, template, dayEndTime);
  };
});
```

**关键点**:
- 使用 `creating` hook 拦截创建操作
- 使用 `onsuccess` 回调获取生成的 id
- 使用 `processedTemplateIds` Set 防止重复处理

##### 更新模板时
```typescript
db.taskTemplates.hook('updating', function (mods, _primKey, obj, trans) {
  const updatedTemplate = { ...obj, ...mods } as TaskTemplate;
  
  if (!updatedTemplate.enabled) return;

  trans.on('complete', async () => {
    await checkAndGenerateForTemplate(db, updatedTemplate, dayEndTime);
  });
});
```

##### 生成逻辑
```typescript
export async function checkAndGenerateForTemplate(
  db: DB,
  template: TaskTemplate,
  dayEndTime: string = "00:00"
): Promise<boolean> {
  // 一次性任务使用事务确保原子性
  if (template.repeatMode === 'none') {
    await db.transaction('rw', db.taskInstances, async () => {
      // 在事务中查询
      const instancesInTx = await db.taskInstances
        .where('templateId')
        .equals(template.id!)
        .toArray();

      if (instancesInTx.length > 0) return;

      // 生成并添加实例
      const instanceData = generateTaskInstance(template, dayEndTime, today);
      await db.taskInstances.add({...instanceData, createdAt: new Date().toISOString()});
    });
  }
  
  // 周期性任务直接生成
  // ...
}
```

**关键点**:
- 一次性任务使用 `db.transaction()` 包裹整个过程
- 利用 IndexedDB 的事务隔离性防止并发问题
- 在事务中再次查询确认，确保只有一个实例能被创建

### 2. 全局应用初始化

**文件**: `src/hooks/useAppInitializer.ts`

#### 功能
- 应用启动时检查所有启用的模板
- 逐个异步生成今天需要的实例

#### 使用方式
```typescript
// App.tsx
const { initialize: initializeApp } = useAppInitializer({
  userId: user?.id,
  dayEndTime: user?.dayEndTime,
  onError: (error) => console.error("Failed to initialize app:", error),
});

useEffect(() => {
  if (user?.id) initializeApp();
}, [user?.id, initializeApp]);
```

### 3. 删除改为停用

**文件**: `src/db/services/taskService.ts`

#### 变更
- `deleteTaskTemplate()` → `disableTaskTemplate()`
- 模板不能物理删除，只能标记为 `enabled: false`
- 保留历史实例数据，便于追溯

#### 影响
- `src/hooks/useTasks.ts`: `remove` → `disable`
- `src/pages/AllTasks/index.tsx`: 更新为停用操作
- UI 文案从"删除"改为"停用"

### 4. 移除 Home 页面检查

**文件**: `src/pages/Home/index.tsx`

#### 变更
- 移除 `useTaskInstanceGenerator` hook
- 移除 `generateToday()` 调用
- 移除相关的 `useEffect` 和状态管理

## 架构优势

### 1. 自动化
- 模板创建/更新后自动检查生成
- 无需在页面组件中手动调用生成逻辑
- 减少遗漏和重复代码

### 2. 数据一致性
- 使用数据库事务保证原子性
- 防止并发情况下重复生成实例
- 一次性任务只会生成一个实例

### 3. 解耦
- 任务生成逻辑与页面组件完全解耦
- 统一的生成入口，便于维护
- 页面组件只负责展示，不关心生成逻辑

### 4. 安全
- 模板不能删除，只能停用
- 保留完整的历史数据
- 便于数据分析和审计

## 关键问题解决

### 问题：一次性任务重复生成多个实例

**现象**: 创建 repeatMode 为 'none' 的模板时，生成了 3 个实例

**原因分析**:
1. React StrictMode 导致组件渲染多次
2. `onsuccess` 回调被多次触发
3. 多个回调并发执行，查询时都显示没有实例

**解决方案**:

#### 方案 1: Set 防重
```typescript
const processedTemplateIds = new Set<number>();

this.onsuccess = async (generatedId) => {
  if (processedTemplateIds.has(generatedId)) return;
  processedTemplateIds.add(generatedId);
  // ...
};
```

#### 方案 2: 数据库事务原子性（核心方案）
```typescript
await db.transaction('rw', db.taskInstances, async () => {
  // 在事务中查询
  const instances = await db.taskInstances.where('templateId').equals(id).toArray();
  if (instances.length > 0) return; // 已有实例，跳过
  
  // 生成实例
  await db.taskInstances.add(instanceData);
});
```

**效果**: 利用 IndexedDB 的事务隔离性，确保只有一个事务能成功创建实例

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/db/middleware/taskTemplateMiddleware.ts` | 新建 | 中间件核心逻辑 |
| `src/db/index.ts` | 修改 | 注册中间件 |
| `src/hooks/useAppInitializer.ts` | 新建 | 全局初始化 hook |
| `src/App.tsx` | 修改 | 使用 useAppInitializer |
| `src/db/services/taskService.ts` | 修改 | 删除改为停用 |
| `src/hooks/useTasks.ts` | 修改 | remove 改为 disable |
| `src/pages/AllTasks/index.tsx` | 修改 | 更新为停用操作 |
| `src/pages/Home/index.tsx` | 修改 | 移除生成检查逻辑 |

## 使用说明

### 创建模板
```typescript
const id = await createTaskTemplate({
  userId: 1,
  title: "新任务",
  repeatMode: "none", // 或 "daily", "weekly", "monthly"
  enabled: true,
  // ... 其他字段
});
// 中间件会自动检查并生成今天的实例
```

### 更新模板
```typescript
await updateTaskTemplate(id, {
  enabled: true,
  repeatMode: "daily",
  // ... 其他字段
});
// 中间件会自动检查并生成今天的实例（如果需要）
```

### 停用模板
```typescript
await disableTaskTemplate(id);
// 模板被标记为 enabled: false，不再生成新实例
// 历史实例保留
```

## 注意事项

1. **事务隔离**: 一次性任务使用数据库事务确保原子性，但周期性任务直接生成
2. **并发处理**: Set 防重机制在模块级别，如果模块被重新加载（如 HMR）会失效
3. **错误处理**: 生成失败会抛出错误，需要在调用处处理
4. **性能考虑**: 全局初始化时逐个检查模板，模板数量多时可能影响启动速度

## 后续优化建议

1. **批量生成**: 全局初始化时可以批量生成实例，减少数据库操作次数
2. **缓存机制**: 缓存已检查的模板，避免重复检查
3. **后台生成**: 将生成逻辑移到 Web Worker，避免阻塞主线程
4. **唯一约束**: 在数据库层面添加唯一索引，防止重复生成
