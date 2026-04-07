## id机制

template采用uuid, 并通过dexiejs在创建template时自动生成, 生成方法为`crypto.randomUUID()`

instance采用确定id方式, 结合hash生成id
- taskInstance: hash(tempalteId, 'yyyy-MM-dd`)
- rewardInstance: hash(templateId, timestamp)
## 同步模块

![[Drawing 2026-04-07 12.12.36.excalidraw]]

### 通信

### 合并算法

[^1]: 
