## id机制

template采用uuid, 并通过dexiejs在创建template时自动生成, 生成方法为`crypto.randomUUID()`

instance采用确定id方式, 结合hash生成id
- taskInstance: hash(tempalteId, 'yyyy-MM-dd`)
- rewardInstance: hash(templateId, timestamp)

## 同步

### 流程

1. initSync (获取sessionId)
2. downloadData (直接下载PC数据)
3. merge (手机端合并)
4. applyData (上传合并结果，PC应用)
5. completeSync

### 连接

### 合并算法


---

同步流程总结

关键文件
角色	文件	作用
移动端前端	src/services/sync/syncService.ts	发起同步请求、执行合并
移动端后端	src-tauri/src/sync/server.rs	运行HTTP服务器(PC)
PC前端	src/hooks/useSync.ts	响应事件、提供/应用数据
PC后端	src-tauri/src/sync/handlers.rs	处理HTTP请求
PC后端IPC	src-tauri/src/sync/ipc.rs	前后端通信命令
---
同步流程步骤

| 步骤        | 移动端前端                                              | 移动端后端 | PC后端                                                         | PC前端                                                                              |
| --------- | -------------------------------------------------- | ----- | ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 1启动服务器    |                                                    |       | start_sync_server (server.rs)                                | 生成二维码                                                                             |
| 2初始化同步    | client.initSync → HTTP POST /api/sync/init         |       | handle_init (handlers.rs): 创建session，触发 sync:request-pc-data |                                                                                   |
| 3. PC准备数据 | 等待500ms                                            |       |                                                              | listen('sync:request-pc-data') → collectSyncData → invoke('set_pc_sync_data')     |
| 4. 下载PC数据 | client.downloadData → HTTP POST /api/sync/download |       | handle_download: 返回 pc_data_raw                              |                                                                                   |
| 5. 合并数据   | mergeTables(mobileData, pcData) (merge.ts)         |       |                                                              |                                                                                   |
| 6. 上传合并数据 | client.applyData → HTTP POST /api/sync/apply       |       | handle_apply: 存储merged_data，触发 sync:apply-merged-data        |                                                                                   |
| 7. PC应用数据 |                                                    |       |                                                              | listen('sync:apply-merged-data') → invoke('get_merged_sync_data') → applySyncData |
| 8. 完成同步   | client.completeSync → HTTP POST /api/sync/complete |       | handle_complete: 清理缓存，触发 sync:completed                      | listen('sync:completed')                                                          |

---
### 关键函数映射
#### 移动端前端 (`syncService.ts`)
- `performSync()` - 主同步流程
- `collectSyncData()` - 收集本地数据
- `mergeTables()` - 合并手机和PC数据
- `applySyncData()` - 应用同步数据到本地
#### PC前端 (`useSync.ts`)
- `listen('sync:request-pc-data')` → `collectSyncData()` + `set_pc_sync_data`
- `listen('sync:apply-merged-data')` → `get_merged_sync_data` + `applySyncData`
- `listen('sync:completed')` - 更新最后同步时间
#### PC后端 (`handlers.rs`)
- `handle_init` - 初始化session，通知PC准备数据
- `handle_download` - 返回PC数据
- `handle_apply` - 接收合并数据，通知PC应用
#### IPC命令 (`ipc.rs`)
- `set_pc_sync_data` - 存储PC数据到内存
- `get_merged_sync_data` - 获取合并后的数据
- `clear_sync_session` - 清理会话缓存
---
优化后的流程特点
1. 手机端主导：合并逻辑在手机端执行
2. PC端被动：PC只需响应事件提供/应用数据
3. 减少交互：移除手机先上传数据的步骤，改为init时PC直接准备
