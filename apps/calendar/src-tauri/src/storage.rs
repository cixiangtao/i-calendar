use serde_json::{json, Value};
use std::{fs, io::Write, path::Path};

const MAX_STATE_SIZE: u64 = 1_000_000;

pub fn read_state(path: &Path) -> Result<Option<Value>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let metadata = fs::metadata(path).map_err(|_| "本地数据无法读取")?;
    if metadata.len() > MAX_STATE_SIZE {
        return Err("本地数据过大".into());
    }
    let contents = fs::read(path).map_err(|_| "本地数据无法读取")?;
    serde_json::from_slice(&contents)
        .map(Some)
        .map_err(|_| "本地数据格式无效".into())
}

pub fn save_state(path: &Path, state: &Value) -> Result<(), String> {
    if state.get("schemaVersion").and_then(Value::as_u64) != Some(1) {
        return Err("本地数据版本无效".into());
    }
    let bytes = serde_json::to_vec(state).map_err(|_| "本地数据无法编码")?;
    if bytes.len() as u64 > MAX_STATE_SIZE {
        return Err("本地数据过大".into());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|_| "无法创建日历数据目录")?;
    }
    let temporary = path.with_extension("json.tmp");
    let mut file = fs::File::create(&temporary).map_err(|_| "无法保存日历数据")?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|_| "无法保存日历数据")?;
    fs::rename(&temporary, path).map_err(|_| "无法替换日历数据".to_string())
}

/// 旧版调休与显示设置只读迁移；旧文件保持原样。
#[cfg(target_os = "macos")]
pub fn legacy_state(data_directory: &Path, home: &Path) -> Result<Option<Value>, String> {
    let holidays = read_state(&data_directory.join("ShiriCalendar/holidays.json"))?;
    let preferences_path = home.join("Library/Preferences/local.shiri.calendar.plist");
    let settings = plist::Value::from_file(preferences_path).ok();
    let dictionary = settings.as_ref().and_then(plist::Value::as_dictionary);
    let week = dictionary
        .and_then(|value| value.get("weekStartsOn"))
        .and_then(plist::Value::as_signed_integer)
        .filter(|week| *week == 7)
        .unwrap_or(1);
    let appearance = dictionary
        .and_then(|value| value.get("appearance"))
        .and_then(plist::Value::as_string)
        .filter(|value| matches!(*value, "system" | "light" | "dark"))
        .unwrap_or("system");
    if holidays.is_none() && settings.is_none() {
        return Ok(None);
    }
    let datasets = holidays.unwrap_or_else(|| json!([]));
    if !datasets.is_array() {
        return Err("旧版调休缓存格式无效".into());
    }
    Ok(Some(
        json!({"schemaVersion": 1, "preferences": {"weekStartsOn": week, "appearance": appearance}, "datasets": datasets}),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(target_os = "macos")]
    #[test]
    fn legacy_settings_and_holidays_migrate_without_modifying_original() {
        let directory = std::env::temp_dir().join(format!("shiri-legacy-{}", std::process::id()));
        let data = directory.join("Application Support");
        let home = directory.join("home");
        fs::create_dir_all(data.join("ShiriCalendar")).unwrap();
        fs::create_dir_all(home.join("Library/Preferences")).unwrap();
        let original = br#"[{"year":2026,"papers":[],"days":[]}]"#;
        let cache = data.join("ShiriCalendar/holidays.json");
        fs::write(&cache, original).unwrap();
        let mut preferences = plist::Dictionary::new();
        preferences.insert("weekStartsOn".into(), plist::Value::Integer(7.into()));
        preferences.insert("appearance".into(), plist::Value::String("dark".into()));
        plist::Value::Dictionary(preferences)
            .to_file_binary(home.join("Library/Preferences/local.shiri.calendar.plist"))
            .unwrap();
        let state = legacy_state(&data, &home).unwrap().unwrap();
        assert_eq!(
            state["preferences"],
            json!({"weekStartsOn":7,"appearance":"dark"})
        );
        assert_eq!(state["datasets"][0]["year"], 2026);
        assert_eq!(fs::read(cache).unwrap(), original);
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn atomic_storage_round_trip_and_invalid_version_preserve_previous() {
        let directory = std::env::temp_dir().join(format!("shiri-storage-{}", std::process::id()));
        let path = directory.join("calendar.json");
        assert!(read_state(&path).unwrap().is_none());
        let state = json!({"schemaVersion": 1, "preferences": {"weekStartsOn": 1}, "datasets": []});
        save_state(&path, &state).unwrap();
        assert!(save_state(&path, &json!({"schemaVersion": 99})).is_err());
        assert_eq!(read_state(&path).unwrap().unwrap(), state);
        fs::remove_dir_all(directory).unwrap();
    }
}
