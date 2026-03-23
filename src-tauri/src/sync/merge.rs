//! 三路合并算法

use crate::sync::types::{FieldConflict, MergeResult, SyncData, SyncTable, TableSyncData};
use serde_json::Value;

/// 三路合并
///
/// base: 上次同步时的数据（共同祖先）
/// local: 本地当前数据（PC端）
/// remote: 远程数据（手机端）
pub fn three_way_merge(base: &SyncData, local: &SyncData, remote: &SyncData) -> MergeResult {
    let mut merged_tables = std::collections::HashMap::new();
    let mut all_conflicts = Vec::new();

    // 获取所有表名
    let all_tables: std::collections::HashSet<&SyncTable> = base
        .tables
        .keys()
        .chain(local.tables.keys())
        .chain(remote.tables.keys())
        .collect();

    for table in all_tables {
        let base_table = base.tables.get(table);
        let local_table = local.tables.get(table);
        let remote_table = remote.tables.get(table);

        // 合并单个表
        let (merged_table, conflicts) = merge_table(base_table, local_table, remote_table);

        merged_tables.insert(*table, merged_table);
        all_conflicts.extend(conflicts);
    }

    MergeResult {
        success: all_conflicts.is_empty(),
        merged_data: if all_conflicts.is_empty() {
            Some(SyncData {
                device_id: local.device_id,
                session_id: local.session_id.clone(),
                timestamp: chrono::Utc::now(),
                tables: merged_tables,
            })
        } else {
            None
        },
        conflicts: all_conflicts,
    }
}

/// 合并单个表
fn merge_table(
    base: Option<&TableSyncData>,
    local: Option<&TableSyncData>,
    remote: Option<&TableSyncData>,
) -> (TableSyncData, Vec<FieldConflict>) {
    let mut merged_metadata = Vec::new();
    let mut merged_records = Vec::new();
    let mut conflicts = Vec::new();

    // 获取所有 sync_id
    let all_sync_ids: std::collections::HashSet<String> = base
        .map(|t| t.metadata.iter().map(|m| m.sync_id.clone()))
        .into_iter()
        .flatten()
        .chain(
            local
                .map(|t| t.metadata.iter().map(|m| m.sync_id.clone()))
                .into_iter()
                .flatten(),
        )
        .chain(
            remote
                .map(|t| t.metadata.iter().map(|m| m.sync_id.clone()))
                .into_iter()
                .flatten(),
        )
        .collect();

    for sync_id in all_sync_ids {
        let base_meta = base.and_then(|t| t.metadata.iter().find(|m| m.sync_id == sync_id));
        let local_meta = local.and_then(|t| t.metadata.iter().find(|m| m.sync_id == sync_id));
        let remote_meta = remote.and_then(|t| t.metadata.iter().find(|m| m.sync_id == sync_id));

        let base_record = base.and_then(|t| {
            let idx = t.metadata.iter().position(|m| m.sync_id == sync_id)?;
            t.records.get(idx)
        });
        let local_record = local.and_then(|t| {
            let idx = t.metadata.iter().position(|m| m.sync_id == sync_id)?;
            t.records.get(idx)
        });
        let remote_record = remote.and_then(|t| {
            let idx = t.metadata.iter().position(|m| m.sync_id == sync_id)?;
            t.records.get(idx)
        });

        // 检查是否已删除
        if local_meta.map(|m| m.is_deleted).unwrap_or(false)
            && remote_meta.map(|m| m.is_deleted).unwrap_or(false)
        {
            // 双方都已删除，跳过
            continue;
        }

        // 合并单个记录
        let (merged_record, record_conflicts) = merge_record(
            base_record,
            local_record,
            remote_record,
            local_meta.map(|m| m.table).unwrap_or(
                base_meta
                    .map(|m| m.table)
                    .unwrap_or(remote_meta.map(|m| m.table).unwrap()),
            ),
            &sync_id,
        );

        if let Some(record) = merged_record {
            // 使用 local 的元数据作为基础，更新版本和时间
            let mut merged_meta = local_meta.or(remote_meta).or(base_meta).unwrap().clone();
            merged_meta.version += 1;
            merged_meta.modified_at = chrono::Utc::now();

            merged_metadata.push(merged_meta);
            merged_records.push(record);
        }

        conflicts.extend(record_conflicts);
    }

    (
        TableSyncData {
            metadata: merged_metadata,
            records: merged_records,
        },
        conflicts,
    )
}

/// 合并单个记录
fn merge_record(
    base: Option<&Value>,
    local: Option<&Value>,
    remote: Option<&Value>,
    table: SyncTable,
    sync_id: &str,
) -> (Option<Value>, Vec<FieldConflict>) {
    // 如果 local 和 remote 相同，直接返回
    if local == remote {
        return (local.cloned(), Vec::new());
    }

    // 如果 base 和 local 相同，采用 remote
    if base == local {
        return (remote.cloned(), Vec::new());
    }

    // 如果 base 和 remote 相同，采用 local
    if base == remote {
        return (local.cloned(), Vec::new());
    }

    // 三方都不同，需要字段级合并
    let mut merged = serde_json::Map::new();
    let mut conflicts = Vec::new();

    // 获取所有字段名
    let all_fields: std::collections::HashSet<String> = base
        .map(|v| {
            v.as_object()
                .map(|o| o.keys().cloned().collect::<Vec<_>>())
                .unwrap_or_default()
        })
        .unwrap_or_default()
        .into_iter()
        .chain(
            local
                .map(|v| {
                    v.as_object()
                        .map(|o| o.keys().cloned().collect::<Vec<_>>())
                        .unwrap_or_default()
                })
                .unwrap_or_default(),
        )
        .chain(
            remote
                .map(|v| {
                    v.as_object()
                        .map(|o| o.keys().cloned().collect::<Vec<_>>())
                        .unwrap_or_default()
                })
                .unwrap_or_default(),
        )
        .collect();

    for field in all_fields {
        let base_val = base.and_then(|v| v.get(&field).cloned());
        let local_val = local.and_then(|v| v.get(&field).cloned());
        let remote_val = remote.and_then(|v| v.get(&field).cloned());

        // 字段级三路合并
        if values_equal(&base_val, &local_val) && !values_equal(&base_val, &remote_val) {
            // 只有 remote 修改了
            if let Some(val) = remote_val {
                merged.insert(field.clone(), val);
            }
        } else if values_equal(&base_val, &remote_val) && !values_equal(&base_val, &local_val) {
            // 只有 local 修改了
            if let Some(val) = local_val {
                merged.insert(field.clone(), val);
            }
        } else if values_equal(&local_val, &remote_val) {
            // 修改相同
            if let Some(val) = local_val {
                merged.insert(field.clone(), val);
            }
        } else {
            // 冲突！
            let local_val_for_conflict = local_val.clone();
            conflicts.push(FieldConflict {
                table,
                sync_id: sync_id.to_string(),
                field: field.clone(),
                base_value: base_val,
                local_value: local_val,
                remote_value: remote_val,
            });

            // 默认采用 local 的值
            if let Some(val) = local_val_for_conflict {
                merged.insert(field, val);
            }
        }
    }

    (Some(Value::Object(merged)), conflicts)
}

/// 比较两个 JSON 值是否相等
fn values_equal(a: &Option<Value>, b: &Option<Value>) -> bool {
    match (a, b) {
        (None, None) => true,
        (Some(a), Some(b)) => a == b,
        _ => false,
    }
}

/// 应用冲突解决
///
/// 根据用户的冲突解决选择，重新执行合并
pub fn apply_conflict_resolutions(
    base: &SyncData,
    local: &SyncData,
    remote: &SyncData,
    resolutions: &[(String, String, String)], // (sync_id, field, choice)
) -> SyncData {
    let mut merged_tables = std::collections::HashMap::new();

    // 获取所有表名
    let all_tables: std::collections::HashSet<&SyncTable> = base
        .tables
        .keys()
        .chain(local.tables.keys())
        .chain(remote.tables.keys())
        .collect();

    for table in all_tables {
        let base_table = base.tables.get(table);
        let local_table = local.tables.get(table);
        let remote_table = remote.tables.get(table);

        // 合并单个表并应用冲突解决
        let merged_table =
            apply_resolutions_to_table(base_table, local_table, remote_table, table, resolutions);

        merged_tables.insert(*table, merged_table);
    }

    SyncData {
        device_id: local.device_id,
        session_id: local.session_id.clone(),
        timestamp: chrono::Utc::now(),
        tables: merged_tables,
    }
}

/// 对单个表应用冲突解决
fn apply_resolutions_to_table(
    base: Option<&TableSyncData>,
    local: Option<&TableSyncData>,
    remote: Option<&TableSyncData>,
    table: &SyncTable,
    resolutions: &[(String, String, String)],
) -> TableSyncData {
    let mut merged_metadata = Vec::new();
    let mut merged_records = Vec::new();

    // 获取所有 sync_id
    let all_sync_ids: std::collections::HashSet<String> = base
        .map(|t| t.metadata.iter().map(|m| m.sync_id.clone()))
        .into_iter()
        .flatten()
        .chain(
            local
                .map(|t| t.metadata.iter().map(|m| m.sync_id.clone()))
                .into_iter()
                .flatten(),
        )
        .chain(
            remote
                .map(|t| t.metadata.iter().map(|m| m.sync_id.clone()))
                .into_iter()
                .flatten(),
        )
        .collect();

    for sync_id in all_sync_ids {
        let base_record = base.and_then(|t| {
            let idx = t.metadata.iter().position(|m| m.sync_id == sync_id)?;
            t.records.get(idx)
        });
        let local_record = local.and_then(|t| {
            let idx = t.metadata.iter().position(|m| m.sync_id == sync_id)?;
            t.records.get(idx)
        });
        let remote_record = remote.and_then(|t| {
            let idx = t.metadata.iter().position(|m| m.sync_id == sync_id)?;
            t.records.get(idx)
        });

        // 应用冲突解决到单个记录
        let merged_record = apply_resolutions_to_record(
            base_record,
            local_record,
            remote_record,
            &sync_id,
            resolutions,
        );

        if let Some(record) = merged_record {
            // 使用 local 的元数据作为基础，更新版本和时间
            let local_meta = local.and_then(|t| t.metadata.iter().find(|m| m.sync_id == sync_id));
            let remote_meta = remote.and_then(|t| t.metadata.iter().find(|m| m.sync_id == sync_id));
            let base_meta = base.and_then(|t| t.metadata.iter().find(|m| m.sync_id == sync_id));

            let mut merged_meta = local_meta.or(remote_meta).or(base_meta).unwrap().clone();
            merged_meta.version += 1;
            merged_meta.modified_at = chrono::Utc::now();

            merged_metadata.push(merged_meta);
            merged_records.push(record);
        }
    }

    TableSyncData {
        metadata: merged_metadata,
        records: merged_records,
    }
}

/// 对单个记录应用冲突解决
fn apply_resolutions_to_record(
    base: Option<&Value>,
    local: Option<&Value>,
    remote: Option<&Value>,
    sync_id: &str,
    resolutions: &[(String, String, String)],
) -> Option<Value> {
    // 获取该记录的所有冲突解决选择
    let record_resolutions: std::collections::HashMap<&str, &str> = resolutions
        .iter()
        .filter(|(sid, _, _)| sid == sync_id)
        .map(|(_, field, choice)| (field.as_str(), choice.as_str()))
        .collect();

    let mut merged = serde_json::Map::new();

    // 获取所有字段名
    let all_fields: std::collections::HashSet<String> = base
        .map(|v| {
            v.as_object()
                .map(|o| o.keys().cloned().collect::<Vec<_>>())
                .unwrap_or_default()
        })
        .unwrap_or_default()
        .into_iter()
        .chain(
            local
                .map(|v| {
                    v.as_object()
                        .map(|o| o.keys().cloned().collect::<Vec<_>>())
                        .unwrap_or_default()
                })
                .unwrap_or_default(),
        )
        .chain(
            remote
                .map(|v| {
                    v.as_object()
                        .map(|o| o.keys().cloned().collect::<Vec<_>>())
                        .unwrap_or_default()
                })
                .unwrap_or_default(),
        )
        .collect();

    for field in all_fields {
        let base_val = base.and_then(|v| v.get(&field).cloned());
        let local_val = local.and_then(|v| v.get(&field).cloned());
        let remote_val = remote.and_then(|v| v.get(&field).cloned());

        // 检查是否有冲突解决选择
        if let Some(choice) = record_resolutions.get(field.as_str()) {
            // 应用用户选择
            let chosen_val = if *choice == "local" {
                local_val
            } else {
                remote_val
            };
            if let Some(val) = chosen_val {
                merged.insert(field, val);
            }
        } else if values_equal(&base_val, &local_val) && !values_equal(&base_val, &remote_val) {
            // 只有 remote 修改了
            if let Some(val) = remote_val {
                merged.insert(field, val);
            }
        } else if values_equal(&base_val, &remote_val) && !values_equal(&base_val, &local_val) {
            // 只有 local 修改了
            if let Some(val) = local_val {
                merged.insert(field, val);
            }
        } else if values_equal(&local_val, &remote_val) {
            // 修改相同
            if let Some(val) = local_val {
                merged.insert(field, val);
            }
        } else {
            // 默认采用 local 的值
            if let Some(val) = local_val {
                merged.insert(field, val);
            }
        }
    }

    Some(Value::Object(merged))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sync::types::{DeviceId, SyncMetadata, SyncTable, TableSyncData};
    use serde_json::json;

    #[test]
    fn test_merge_no_conflict() {
        let base = SyncData {
            device_id: DeviceId::Pc,
            session_id: "test".to_string(),
            timestamp: chrono::Utc::now(),
            tables: std::collections::HashMap::new(),
        };

        let local = base.clone();
        let remote = base.clone();

        let result = three_way_merge(&base, &local, &remote);
        assert!(result.success);
        assert!(result.conflicts.is_empty());
    }

    #[test]
    fn test_merge_local_changed() {
        // base = remote, local changed
        // should adopt local
        let mut base = SyncData {
            device_id: DeviceId::Pc,
            session_id: "test".to_string(),
            timestamp: chrono::Utc::now(),
            tables: std::collections::HashMap::new(),
        };

        // 添加测试数据
        let table_data = TableSyncData {
            metadata: vec![SyncMetadata {
                id: Some(1),
                table: SyncTable::Users,
                local_id: 1,
                sync_id: "test-uuid".to_string(),
                version: 1,
                modified_at: chrono::Utc::now(),
                modified_by: DeviceId::Pc,
                checksum: "abc".to_string(),
                is_deleted: false,
            }],
            records: vec![json!({"id": 1, "name": "Base"})],
        };
        base.tables.insert(SyncTable::Users, table_data);

        let remote = base.clone();

        // local 修改了数据
        let mut local = base.clone();
        if let Some(table) = local.tables.get_mut(&SyncTable::Users) {
            table.records[0] = json!({"id": 1, "name": "Local Changed"});
        }

        let result = three_way_merge(&base, &local, &remote);
        assert!(result.success);
        assert!(result.conflicts.is_empty());
        // 应该采用 local 的值
        if let Some(merged) = result.merged_data {
            if let Some(table) = merged.tables.get(&SyncTable::Users) {
                assert_eq!(table.records[0]["name"], "Local Changed");
            }
        }
    }

    #[test]
    fn test_merge_remote_changed() {
        // base = local, remote changed
        // should adopt remote
        let mut base = SyncData {
            device_id: DeviceId::Pc,
            session_id: "test".to_string(),
            timestamp: chrono::Utc::now(),
            tables: std::collections::HashMap::new(),
        };

        let table_data = TableSyncData {
            metadata: vec![SyncMetadata {
                id: Some(1),
                table: SyncTable::Users,
                local_id: 1,
                sync_id: "test-uuid".to_string(),
                version: 1,
                modified_at: chrono::Utc::now(),
                modified_by: DeviceId::Pc,
                checksum: "abc".to_string(),
                is_deleted: false,
            }],
            records: vec![json!({"id": 1, "name": "Base"})],
        };
        base.tables.insert(SyncTable::Users, table_data);

        let local = base.clone();

        // remote 修改了数据
        let mut remote = base.clone();
        if let Some(table) = remote.tables.get_mut(&SyncTable::Users) {
            table.records[0] = json!({"id": 1, "name": "Remote Changed"});
        }

        let result = three_way_merge(&base, &local, &remote);
        assert!(result.success);
        assert!(result.conflicts.is_empty());
        // 应该采用 remote 的值
        if let Some(merged) = result.merged_data {
            if let Some(table) = merged.tables.get(&SyncTable::Users) {
                assert_eq!(table.records[0]["name"], "Remote Changed");
            }
        }
    }

    #[test]
    fn test_merge_conflict() {
        // all three different
        // should detect conflict
        let mut base = SyncData {
            device_id: DeviceId::Pc,
            session_id: "test".to_string(),
            timestamp: chrono::Utc::now(),
            tables: std::collections::HashMap::new(),
        };

        let table_data = TableSyncData {
            metadata: vec![SyncMetadata {
                id: Some(1),
                table: SyncTable::Users,
                local_id: 1,
                sync_id: "test-uuid".to_string(),
                version: 1,
                modified_at: chrono::Utc::now(),
                modified_by: DeviceId::Pc,
                checksum: "abc".to_string(),
                is_deleted: false,
            }],
            records: vec![json!({"id": 1, "name": "Base"})],
        };
        base.tables.insert(SyncTable::Users, table_data);

        // local 修改了数据
        let mut local = base.clone();
        if let Some(table) = local.tables.get_mut(&SyncTable::Users) {
            table.records[0] = json!({"id": 1, "name": "Local Changed"});
        }

        // remote 也修改了数据（不同值）
        let mut remote = base.clone();
        if let Some(table) = remote.tables.get_mut(&SyncTable::Users) {
            table.records[0] = json!({"id": 1, "name": "Remote Changed"});
        }

        let result = three_way_merge(&base, &local, &remote);
        assert!(!result.success);
        assert!(!result.conflicts.is_empty());
        // 应该检测到 name 字段的冲突
        assert_eq!(result.conflicts[0].field, "name");
    }
}
