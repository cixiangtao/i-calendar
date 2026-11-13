use serde::Serialize;
use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::{Duration, Instant},
};
use tauri::{ipc::Channel, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

#[derive(Default)]
pub struct AppUpdates {
    busy: AtomicBool,
    pending: Mutex<Option<Update>>,
    downloaded: Mutex<Option<(String, Vec<u8>)>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Release {
    version: String,
    notes: Option<String>,
}

struct Operation<'a>(&'a AtomicBool);
impl<'a> Operation<'a> {
    fn acquire(busy: &'a AtomicBool) -> Result<Self, String> {
        busy.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| "应用更新正在进行，请稍后重试".to_string())?;
        Ok(Self(busy))
    }
}
impl Drop for Operation<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

fn configuration(
    endpoint: Option<&str>,
    public_key: Option<&str>,
) -> Result<Option<(reqwest::Url, String)>, String> {
    match (
        endpoint.filter(|s| !s.trim().is_empty()),
        public_key.filter(|s| !s.trim().is_empty()),
    ) {
        (None, None) => Ok(None),
        (Some(endpoint), Some(key)) => {
            let url = reqwest::Url::parse(endpoint).map_err(|_| "应用更新地址无效")?;
            if url.scheme() != "https"
                || !url.username().is_empty()
                || url.password().is_some()
                || url.fragment().is_some()
            {
                return Err("应用更新地址必须是无凭据的 HTTPS 地址".into());
            }
            Ok(Some((url, key.into())))
        }
        _ => Err("应用更新地址和公钥必须一起配置".into()),
    }
}

fn configured() -> Result<Option<(reqwest::Url, String)>, String> {
    configuration(
        option_env!("I_CALENDAR_UPDATE_ENDPOINT"),
        option_env!("I_CALENDAR_UPDATE_PUBKEY"),
    )
}

pub fn available() -> bool {
    !cfg!(debug_assertions)
        && !std::env::args().any(|arg| arg == "--smoke-test")
        && matches!(configured(), Ok(Some(_)))
}

fn updater(
    app: &tauri::AppHandle,
    timeout: Duration,
) -> Result<tauri_plugin_updater::Updater, String> {
    if !available() {
        return Err("自动更新将在正式发布后启用".into());
    }
    let (endpoint, key) = configured()?.ok_or("尚未配置应用更新")?;
    app.updater_builder()
        .endpoints(vec![endpoint])
        .map_err(|_| "应用更新地址无效")?
        .pubkey(key)
        .configure_client(|client| client.https_only(true))
        .timeout(timeout)
        .build()
        .map_err(|_| "无法初始化应用更新".to_string())
}

pub async fn check(app: tauri::AppHandle) -> Result<Option<Release>, String> {
    let state = app.state::<AppUpdates>();
    let _operation = Operation::acquire(&state.busy)?;
    let update = updater(&app, Duration::from_secs(15))?
        .check()
        .await
        .map_err(|_| "应用更新检查失败")?;
    if let Some(update) = &update {
        // 不把下载地址交给界面；安装时只使用已检查且保存在 Rust 中的对象。
        if update.download_url.scheme() != "https"
            || !update.download_url.username().is_empty()
            || update.download_url.password().is_some()
        {
            return Err("更新包地址无效".into());
        }
    }
    let release = update.as_ref().map(|update| Release {
        version: update.version.clone(),
        notes: update
            .body
            .as_ref()
            .map(|notes| notes.chars().take(20_000).collect()),
    });
    *state.pending.lock().map_err(|_| "应用更新状态不可用")? = update;
    *state.downloaded.lock().map_err(|_| "应用更新状态不可用")? = None;
    Ok(release)
}

pub async fn download(
    app: tauri::AppHandle,
    version: String,
    progress: Channel<serde_json::Value>,
) -> Result<(), String> {
    if !available() {
        return Err("自动更新将在正式发布后启用".into());
    }
    let state = app.state::<AppUpdates>();
    let _operation = Operation::acquire(&state.busy)?;
    let mut update = state
        .pending
        .lock()
        .map_err(|_| "应用更新状态不可用")?
        .clone()
        .filter(|update| update.version == version)
        .ok_or("请重新检查应用更新")?;
    update.timeout = Some(Duration::from_secs(300));
    let mut downloaded = 0u64;
    let mut last_event = Instant::now() - Duration::from_secs(1);
    let bytes = update.download(|length, total| {
        downloaded = downloaded.saturating_add(length as u64);
        if last_event.elapsed() >= Duration::from_millis(100) || total == Some(downloaded) {
            let _ = progress.send(serde_json::json!({"phase": "downloading", "downloaded": downloaded, "total": total}));
            last_event = Instant::now();
        }
    }, || {}).await.map_err(|_| "更新包下载或签名验证失败")?;
    let _ = progress.send(
        serde_json::json!({"phase": "downloading", "downloaded": downloaded, "total": downloaded}),
    );
    *state.downloaded.lock().map_err(|_| "应用更新状态不可用")? = Some((version, bytes));
    Ok(())
}

pub async fn install(app: tauri::AppHandle, version: String) -> Result<(), String> {
    if !available() {
        return Err("自动更新将在正式发布后启用".into());
    }
    let state = app.state::<AppUpdates>();
    let _operation = Operation::acquire(&state.busy)?;
    let update = state
        .pending
        .lock()
        .map_err(|_| "应用更新状态不可用")?
        .clone()
        .filter(|update| update.version == version)
        .ok_or("请重新检查应用更新")?;
    let (_, bytes) = state
        .downloaded
        .lock()
        .map_err(|_| "应用更新状态不可用")?
        .take()
        .filter(|(downloaded_version, _)| *downloaded_version == version)
        .ok_or("请重新下载更新包")?;
    // 官方下载接口先验签，安装接口再次验签；任一步失败都不重启。
    tauri::async_runtime::spawn_blocking(move || update.install(bytes))
        .await
        .map_err(|_| "应用更新安装线程失败")?
        .map_err(|_| "应用更新安装失败")?;
    *state.pending.lock().map_err(|_| "应用更新状态不可用")? = None;
    app.restart();
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn configuration_is_explicit_https_and_paired() {
        assert!(configuration(None, None).unwrap().is_none());
        assert!(
            configuration(Some("https://example.com/latest.json"), Some("public-key"))
                .unwrap()
                .is_some()
        );
        for url in [
            "http://example.com/latest.json",
            "file:///tmp/update",
            "https://user:pass@example.com/latest.json",
            "https://example.com/latest.json#fragment",
        ] {
            assert!(configuration(Some(url), Some("public-key")).is_err());
        }
        assert!(configuration(Some("https://example.com"), None).is_err());
        assert!(configuration(None, Some("public-key")).is_err());
        assert!(!available(), "开发与隔离冒烟构建不自动请求更新");
    }
    #[test]
    fn operations_are_exclusive_and_recover_on_drop() {
        let busy = AtomicBool::new(false);
        let first = Operation::acquire(&busy).unwrap();
        assert!(Operation::acquire(&busy).is_err());
        drop(first);
        assert!(Operation::acquire(&busy).is_ok());
    }
}
