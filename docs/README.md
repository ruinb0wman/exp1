
## 每日结束时间

通过`dayEndTime`来确定每天的结束时间

dayEndTime不应该与其他状态耦合, 而是在需要时计算

关联的操作
- 首页显示的今日任务
- 检查是否该生成实例
- 检查过期实例

## 同步

### id机制

template采用uuid, 并通过dexiejs在创建template时自动生成, 生成方法为`crypto.randomUUID()`

instance采用确定id方式, 结合hash生成id, 避免不同设备之间数据id不一致导致合并时出现重复
- taskInstance: `hash(tempalteId, 'yyyy-MM-dd')`
- rewardInstance: `hash(templateId, timestamp)`
- pointHistory: `hash(instanceId, type, [subtaskid])`

### 同步流程步骤

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
|           


### 合并算法

pointHistory, instance和template采用以下合并规则
- 默认create时updatedAt为undefined, 只有执行update操作时才会更新updatedAt
- 两端updatedAt不存在时, createdAt大的获胜
- 有一端有udpatedAt, 有updatedAt的获胜
- 两端都有updatedAt, updatedAt大的获胜

## pointHistory

pointHistory在创建时使用put, 这样可以避免撤销后重新执行导致的id重复, 并用新的数据覆盖旧的