# 同步系统文档

## 概述

本系统实现 PC 端与移动端之间的局域网数据同步功能，采用**影子表（Shadow Table）**架构设计，通过 HTTP 协议进行数据传输，支持三路合并算法解决冲突。

### 核心特性

- **双向同步**: PC 端作为服务器，移动端作为客户端
- **增量同步**: 基于版本号和时间戳的增量检测
- **三路合并**: 字段级三路合并算法自动解决大部分冲突
- **数据安全**: 同步前自动备份，失败时自动回滚
- **压缩传输**: 使用 gzip 压缩减少网络传输量

---

## 架构设计

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        同步系统架构                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐                    ┌──────────────┐          │
│  │   PC 端       │ ◄────────────────► │   移动端      │          │
│  │  (服务器)     │    HTTP/局域网      │   (客户端)    │          │
│  └──────┬───────┘                    └──────┬───────┘          │
│         │                                    │                  │
│  ┌──────▼───────┐                    ┌──────▼───────┐          │
│  │  Rust 后端    │                    │  TypeScript  │          │
│  │  HTTP 服务器  │                    │  HTTP 客户端  │          │
│  │  IPC 处理    │                    │  同步服务     │          │
│  └──────┬───────┘                    └──────┬───────┘          │
│         │                                    │                  │
│  ┌──────▼───────┐                    ┌──────▼───────┐          │
│  │  React 前端   │ ◄── IPC 事件 ────► │  React 前端   │          │
│  │  useSync Hook │                    │  useSync Hook │          │
│  └──────┬───────┘                    └──────┬───────┘          │
│         │                                    │                  │
│  ┌──────▼───────┐                    ┌──────▼───────┐          │
│  │   Dexie.js   │                    │   Dexie.js   │          │
│  │  IndexedDB   │                    │  IndexedDB   │          │
│  └──────────────┘                    └──────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 影子表架构

业务表不感知同步逻辑，通过独立的影子表记录同步状态：

```
┌─────────────────────────────────────────────────────────────┐
│                     影子表架构                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐      ┌─────────────────────────────┐  │
│  │   业务表         │      │         影子表               │  │
│  │  (无感知)       │      │    (记录同步状态)            │  │
│  ├─────────────────┤      ├─────────────────────────────┤  │
│  │ taskTemplates   │◄────►│ syncMetadata                │  │
│  │ taskInstances   │◄────►│   - syncId (全局 UUID)      │  │
│  │ rewardTemplates │◄────►│   - version (版本号)        │  │
│  │ rewardInstances │◄────►│   - modifiedAt (修改时间)   │  │
│  │ users           │◄────►│   - modifiedBy (修改设备)   │  │
│  │ pointsHistory   │◄────►│   - checksum (内容哈希)     │  │
│  └─────────────────┘      │   - isDeleted (软删除)      │  │
│                           └─────────────────────────────┘  │
│                                                             │
│  同步中间件自动拦截所有 CRUD 操作，维护影子表状态            │
└─────────────────────────────────────────────────────────────┘
```

---

## 数据库表说明

### 1. syncMetadata - 同步元数据表

记录每条业务记录的同步状态。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | 自增主键 |
| `table` | string | 业务表名 (taskTemplates, users 等) |
| `localId` | number | 业务表本地自增 ID |
| `syncId` | string | 全局 UUID v4，用于跨设备识别 |
| `version` | number | 版本号，每次修改 +1 |
| `modifiedAt` | string | ISO 8601 时间戳 |
| `modifiedBy` | 'pc' \| 'mobile' | 修改设备 |
| `checksum` | string | 内容哈希（用于快速比对） |
| `isDeleted` | boolean | 软删除标记 |

**索引**: `++id`, `[table+localId]`, `syncId`, `[table+syncId]`

### 2. syncConfig - 同步配置表

存储设备标识和同步相关配置。

| 字段 | 类型 | 说明 |
|------|------|------|
| `key` | string | 配置项名称（主键） |
| `value` | any | 配置值 |
| `updatedAt` | string | 更新时间 |

**常用配置项**:
- `lastSyncAt`: 上次成功同步时间
- `currentSessionId`: 当前同步会话 ID
- `currentConflicts`: 当前冲突列表

### 3. syncSessions - 同步会话表

记录同步历史和状态。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | 自增主键 |
| `sessionId` | string | 会话 UUID |
| `device` | 'pc' \| 'mobile' | 对端设备 |
| `direction` | string | 同步方向 (upload/download/bidirectional) |
| `status` | string | 状态 (pending/success/failed/conflict/cancelled) |
| `startedAt` | string | 开始时间 |
| `completedAt` | string | 完成时间 |
| `errorMessage` | string | 错误信息 |
| `stats` | object | 同步统计 |

**统计信息**:
```typescript
interface SyncStats {
  recordsUploaded: number;    // 上传记录数
  recordsDownloaded: number;  // 下载记录数
  conflictsResolved: number;  // 解决的冲突数
  durationMs: number;         // 同步耗时
}
```

### 4. syncBackups - 同步备份表

同步前的完整数据备份，用于失败回滚。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | 自增主键 |
| `sessionId` | string | 关联的同步会话 ID |
| `table` | string | 业务表名 |
| `data` | string | JSON 字符串，完整表数据 |
| `createdAt` | string | 备份时间 |

**索引**: `++id`, `sessionId`, `table`

---

## 同步流程

### 完整同步流程（10步）

```
┌────────────────────────────────────────────────────────────────────────┐
│                         同步流程时序图                                  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  移动端                    PC 端 Rust 后端              PC 端前端       │
│    │                            │                          │          │
│    │  1. 初始化同步              │                          │          │
│    │ ─────────────────────────> │                          │          │
│    │                            │                          │          │
│    │  2. 创建备份                │                          │          │
│    │ ─────────────────────────> │                          │          │
│    │                            │                          │          │
│    │  3. 收集移动端数据          │                          │          │
│    │ ─────────────────────────> │                          │          │
│    │                            │                          │          │
│    │  4. 上传移动端数据          │                          │          │
│    │ ─────────────────────────> │                          │          │
│    │                            │  5. 请求 PC 数据          │          │
│    │                            │ ───────────────────────> │          │
│    │                            │                          │          │
│    │                            │ <─────────────────────── │          │
│    │                            │  6. PC 前端提供数据       │          │
│    │                            │                          │          │
│    │  7. 下载 PC 数据            │                          │          │
│    │ <───────────────────────── │                          │          │
│    │                            │                          │          │
│    │  8. 移动端执行三路合并      │                          │          │
│    │    (自动解决或标记冲突)     │                          │          │
│    │                            │                          │          │
│    │  9. 上传合并后数据          │                          │          │
│    │ ─────────────────────────> │                          │          │
│    │                            │  10. PC 前端应用数据      │          │
│    │                            │ ───────────────────────> │          │
│    │                            │                          │          │
│    │  11. 移动端应用数据         │                          │          │
│    │    (完成)                   │                          │          │
│    │                            │                          │          │
│    │  12. 完成同步               │                          │          │
│    │ ─────────────────────────> │                          │          │
│    │                            │                          │          │
└────────────────────────────────────────────────────────────────────────┘
```

### 详细步骤说明

#### 步骤 1: 初始化同步
- **移动端**调用 `POST /api/sync/init`
- **PC 端**创建新会话，返回 `sessionId` 和服务器时间

#### 步骤 2: 创建备份
- **移动端**在本地创建所有业务表的完整备份
- 存储到 `syncBackups` 表，关联 `sessionId`

#### 步骤 3-4: 收集并上传移动端数据
- **移动端**收集所有业务表数据和对应的 `syncMetadata`
- 使用 gzip 压缩后上传到 `POST /api/sync/upload`

#### 步骤 5-6: PC 端提供数据
- **PC 端 Rust**通过 IPC 事件 `sync:request-pc-data`通知前端
- **PC 端前端**收集数据，通过 `set_pc_sync_data` IPC 命令发送给 Rust
- Rust 压缩并存储，等待移动端下载

#### 步骤 7: 下载 PC 数据
- **移动端**调用 `POST /api/sync/download`
- 获取 PC 端压缩数据，解压后解析

#### 步骤 8: 三路合并
- **移动端**执行三路合并算法：
  - 基础版本：上次同步时的状态（通过版本号推断）
  - 本地版本：移动端当前数据
  - 远程版本：PC 端数据
- 自动合并无冲突字段
- 标记冲突字段供用户解决

#### 步骤 9-10: 上传并应用合并数据
- **移动端**将合并后的数据上传到 `POST /api/sync/apply`
- **PC 端 Rust**通过 IPC 事件 `sync:apply-merged-data`通知前端应用数据
- **PC 端前端**调用 `get_merged_sync_data`获取数据并应用到本地数据库

#### 步骤 11: 移动端应用数据
- **移动端**将合并后的数据应用到本地数据库
- 更新 `syncMetadata` 和 `syncConfig`

#### 步骤 12: 完成同步
- **移动端**调用 `POST /api/sync/complete`
- **PC 端**清理会话数据，发送 `sync:completed`事件
- **移动端**清理备份，更新 `lastSyncAt`

---

## 三路合并算法

### 算法逻辑

```typescript
function threeWayMerge(base, local, remote, table, syncId) {
  // 1. 如果 local === remote，无需合并
  if (deepEqual(local, remote)) {
    return { success: true, data: local };
  }

  // 2. 如果 base === local，采用 remote（只有 remote 修改）
  if (deepEqual(base, local)) {
    return { success: true, data: remote };
  }

  // 3. 如果 base === remote，采用 local（只有 local 修改）
  if (deepEqual(base, remote)) {
    return { success: true, data: local };
  }

  // 4. 字段级三路合并
  const result = {};
  const conflicts = [];
  const allFields = union(Object.keys(base), Object.keys(local), Object.keys(remote));

  for (const field of allFields) {
    const baseVal = base?.[field];
    const localVal = local?.[field];
    const remoteVal = remote?.[field];

    if (deepEqual(baseVal, localVal) && !deepEqual(baseVal, remoteVal)) {
      // 只有 remote 修改
      result[field] = remoteVal;
    } else if (deepEqual(baseVal, remoteVal) && !deepEqual(baseVal, localVal)) {
      // 只有 local 修改
      result[field] = localVal;
    } else if (deepEqual(localVal, remoteVal)) {
      // 双方修改相同
      result[field] = localVal;
    } else {
      // 冲突：双方修改不同
      conflicts.push({
        table, syncId, field,
        baseValue: baseVal,
        localValue: localVal,
        remoteValue: remoteVal
      });
    }
  }

  if (conflicts.length > 0) {
    return { success: false, conflicts };
  }

  return { success: true, data: result };
}
```

### 冲突解决策略

当检测到冲突时，系统会：

1. **暂停同步**，保存当前会话状态
2. **展示冲突列表**给用户，显示：
   - 冲突的表名和记录 ID
   - 冲突字段名
   - 基础值、本地值、远程值
3. **用户选择**每个冲突的解决方案：
   - `local`: 保留本地（移动端）的值
   - `remote`: 采用远程（PC 端）的值
4. **重新执行同步**，应用用户的选择

---

## 技术实现

### 文件结构

```
src/
├── db/sync/                    # 数据库层
│   ├── types.ts               # 影子表类型定义
│   ├── migrations.ts          # 数据库迁移
│   ├── middleware.ts          # 同步中间件（拦截 CRUD）
│   └── index.ts               # 导出
│
├── services/sync/              # 同步服务
│   ├── types.ts               # 同步服务类型
│   ├── syncService.ts         # 核心同步逻辑
│   ├── syncClient.ts          # HTTP 客户端
│   ├── merge.ts               # 三路合并算法
│   ├── backup.ts              # 备份与恢复
│   ├── compression.ts         # gzip 压缩
│   ├── utils.ts               # 工具函数
│   └── index.ts               # 导出
│
├── hooks/
│   └── useSync.ts             # 同步状态管理 Hook
│
src-tauri/src/sync/            # Rust 后端
├── mod.rs                     # 模块导出
├── types.rs                   # Rust 类型定义
├── server.rs                  # HTTP 服务器
├── handlers.rs                # API 处理器
├── ipc.rs                     # IPC 命令
├── merge.rs                   # Rust 端合并逻辑
├── network.rs                 # 网络工具
└── qr_code.rs                 # QR 码生成
```

### HTTP API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/sync/init` | POST | 初始化同步会话 |
| `/api/sync/upload` | POST | 上传移动端数据 |
| `/api/sync/download` | POST | 下载 PC 端数据 |
| `/api/sync/apply` | POST | 上传合并后的数据 |
| `/api/sync/complete` | POST | 完成同步 |

### IPC 命令（PC 端）

| 命令 | 方向 | 说明 |
|------|------|------|
| `start_sync_server` | 调用 | 启动同步服务器 |
| `stop_sync_server` | 调用 | 停止同步服务器 |
| `get_server_status` | 调用 | 获取服务器状态 |
| `set_pc_sync_data` | 调用 | PC 前端提供数据给 Rust |
| `get_merged_sync_data` | 调用 | PC 前端获取合并后的数据 |
| `clear_sync_session` | 调用 | 清理同步会话 |

### IPC 事件（PC 端）

| 事件 | 方向 | 说明 |
|------|------|------|
| `sync:server-started` | 监听 | 服务器启动成功 |
| `sync:server-stopped` | 监听 | 服务器已停止 |
| `sync:request-pc-data` | 监听 | Rust 请求 PC 数据 |
| `sync:pc-data-received` | 监听 | PC 数据已接收 |
| `sync:apply-merged-data` | 监听 | 请求应用合并数据 |
| `sync:merged-data-ready` | 监听 | 合并数据已就绪 |
| `sync:completed` | 监听 | 同步完成 |
| `sync:session-cleared` | 监听 | 会话已清理 |

### 数据压缩

使用 gzip 压缩减少网络传输：

```typescript
// TypeScript (移动端)
import pako from 'pako';

function compressData(data: any): Uint8Array {
  const json = JSON.stringify(data);
  return pako.gzip(json);
}

function decompressData(compressed: Uint8Array): any {
  const json = pako.ungzip(compressed, { to: 'string' });
  return JSON.parse(json);
}
```

```rust
// Rust (PC 端)
use flate2::write::GzEncoder;
use flate2::Compression;
use flate2::read::GzDecoder;

fn compress_gzip(data: &[u8]) -> Result<Vec<u8>, String> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(data).map_err(|e| e.to_string())?;
    encoder.finish().map_err(|e| e.to_string())
}

fn decompress_gzip(data: &[u8]) -> Result<Vec<u8>, String> {
    let mut decoder = GzDecoder::new(data);
    let mut result = Vec::new();
    decoder.read_to_end(&mut result).map_err(|e| e.to_string())?;
    Ok(result)
}
```

---

## 错误处理与恢复

### 备份机制

每次同步开始前，系统会自动创建完整备份：

```typescript
async function createSyncBackup(sessionId: string): Promise<void> {
  const db = getDB();
  const timestamp = new Date().toISOString();

  for (const tableName of SYNCABLE_TABLES) {
    const records = await db.table(tableName).toArray();
    const backup: SyncBackup = {
      sessionId,
      table: tableName,
      data: JSON.stringify(records),
      createdAt: timestamp
    };
    await db.table('syncBackups').add(backup);
  }
}
```

### 失败恢复

当同步失败时，自动从备份恢复：

```typescript
async function restoreFromBackup(sessionId: string): Promise<void> {
  const db = getDB();
  const backups = await db.table('syncBackups')
    .where('sessionId')
    .equals(sessionId)
    .toArray();

  await db.transaction('rw', [...tables, backupTable], async () => {
    for (const backup of backups) {
      const table = db.table(backup.table);
      const records = JSON.parse(backup.data);
      await table.clear();
      if (records.length > 0) {
        await table.bulkAdd(records);
      }
    }
    // 清理备份
    await backupTable.where('sessionId').equals(sessionId).delete();
  });
}
```

### 错误类型

```typescript
class SyncError extends Error {
  constructor(
    message: string,
    public code: string,        // 错误代码
    public recoverable: boolean  // 是否可恢复
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

// 常见错误代码
const ErrorCodes = {
  INIT_FAILED: '初始化失败',
  UPLOAD_FAILED: '上传失败',
  DOWNLOAD_FAILED: '下载失败',
  MERGE_FAILED: '合并失败',
  CONFLICTS_DETECTED: '检测到冲突',
  APPLY_FAILED: '应用数据失败',
  TIMEOUT: '请求超时',
  NETWORK_ERROR: '网络错误',
  NO_SESSION: '无活动会话',
};
```

---

## 使用指南

### PC 端开启同步

```typescript
import { useSync } from '@/hooks/useSync';

function SyncButton() {
  const { state, openSync, closeSync } = useSync();

  return (
    <button onClick={openSync}>
      开启同步
    </button>
    // 显示 QR 码: state.qrCodeContent
  );
}
```

### 移动端扫码同步

```typescript
import { useSync } from '@/hooks/useSync';

function MobileSync() {
  const { state, startSync, resolveConflicts } = useSync();

  // 扫码获取 serverUrl
  const handleScan = (serverUrl: string) => {
    startSync(serverUrl);
  };

  // 解决冲突
  const handleResolve = (resolutions) => {
    resolveConflicts(resolutions);
  };

  // 显示同步进度: state.progress
  // 显示冲突列表: state.conflicts
}
```

---

## 注意事项

1. **网络要求**: PC 端和移动端必须在同一局域网内
2. **端口占用**: PC 端默认使用 8765 端口，被占用时会自动尝试其他端口
3. **数据量限制**: 建议单次同步数据量不超过 100MB
4. **并发控制**: 同一时间只能进行一个同步会话
5. **版本兼容**: 确保 PC 端和移动端应用版本兼容

---

## 未来优化方向

1. **增量同步**: 只传输变更的记录，而非全量数据
2. **断点续传**: 支持大文件分片传输和断点续传
3. **冲突自动解决**: 基于 AI 或规则的自动冲突解决
4. **多设备同步**: 支持超过两台设备之间的同步
5. **云同步**: 支持通过云端服务器进行远程同步
