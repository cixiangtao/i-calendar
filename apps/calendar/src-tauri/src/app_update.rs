use serde::Serialize;
use std::{
    error::Error,
    future::Future,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::{Duration, Instant},
};
use tauri::{ipc::Channel, Manager};
use tauri_plugin_updater::{Error as UpdateError, Update, UpdaterExt};

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
        .configure_client(|client| {
            client
                .https_only(true)
                .connect_timeout(Duration::from_secs(10))
                .read_timeout(Duration::from_secs(30))
        })
        .timeout(timeout)
        .build()
        .map_err(|_| "无法初始化应用更新".to_string())
}

fn is_transport_failure(error: &UpdateError) -> bool {
    let UpdateError::Reqwest(error) = error else {
        return false;
    };
    // reqwest 也将响应体传输中断包装为 Decode；格式错误的 JSON 不应重试。
    let interrupted_body = error.is_decode()
        && error
            .source()
            .is_some_and(|cause| !cause.is::<serde_json::Error>());
    error.is_timeout() || error.is_request() || error.is_body() || interrupted_body
}

// 只重试获取清单、下载包这两种只读操作。重试期间仍由外层 Operation 持有互斥锁。
async fn retry_transport<T, F: Future<Output = Result<T, UpdateError>>>(
    mut request: impl FnMut() -> F,
) -> Result<T, UpdateError> {
    for delay in [1, 3] {
        match request().await {
            Err(error) if is_transport_failure(&error) => {
                tokio::time::sleep(Duration::from_secs(delay)).await;
            }
            result => return result,
        }
    }
    request().await
}

fn update_error(error: UpdateError, fallback: &'static str) -> String {
    if is_transport_failure(&error) {
        return "UPDATE_NETWORK".into();
    }
    match error {
        UpdateError::Minisign(_)
        | UpdateError::Base64(_)
        | UpdateError::SignatureUtf8(_)
        | UpdateError::SignedVersionMismatch { .. }
        | UpdateError::MissingSignedVersion => "UPDATE_SIGNATURE",
        UpdateError::Network(_) | UpdateError::ReleaseNotFound => "UPDATE_SERVER",
        _ => fallback,
    }
    .into()
}

pub async fn check(app: tauri::AppHandle) -> Result<Option<Release>, String> {
    let state = app.state::<AppUpdates>();
    let _operation = Operation::acquire(&state.busy)?;
    let updater = updater(&app, Duration::from_secs(15))?;
    let update = retry_transport(|| updater.check())
        .await
        .map_err(|error| update_error(error, "UPDATE_MANIFEST"))?;
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
    let bytes = retry_transport(|| async {
        let mut downloaded = 0u64;
        let mut last_event = Instant::now() - Duration::from_secs(1);
        let _ = progress.send(serde_json::json!({"phase": "downloading", "downloaded": 0}));
        update.download(|length, total| {
            downloaded = downloaded.saturating_add(length as u64);
            if last_event.elapsed() >= Duration::from_millis(100) || total == Some(downloaded) {
                let _ = progress.send(serde_json::json!({"phase": "downloading", "downloaded": downloaded, "total": total}));
                last_event = Instant::now();
            }
        }, || {}).await
    }).await.map_err(|error| update_error(error, "UPDATE_DOWNLOAD"))?;
    let _ = progress.send(
        serde_json::json!({"phase": "downloading", "downloaded": bytes.len(), "total": bytes.len()}),
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
        .map_err(|error| update_error(error, "UPDATE_INSTALL"))?;
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
    fn truncated_manifest_retries_but_invalid_json_and_signature_stop() {
        use std::{
            io::{BufRead, BufReader, Write},
            net::TcpListener,
        };

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let endpoint = format!("http://{}", listener.local_addr().unwrap());
        let mut context = tauri::test::mock_context(tauri::test::noop_assets());
        context.config_mut().plugins.0.insert("updater".into(), serde_json::json!({
            "pubkey": "test", "dangerousInsecureTransportProtocol": true, "endpoints": [endpoint]
        }));
        let app = tauri::test::mock_builder()
            .plugin(tauri_plugin_updater::Builder::new().build())
            .build(context)
            .unwrap();
        let updater = app
            .updater_builder()
            .no_proxy()
            .timeout(Duration::from_secs(2))
            .build()
            .unwrap();
        let server = std::thread::spawn(move || {
            for response in [
                "200 OK\r\nContent-Length: 10\r\n\r\n{",
                "204 No Content\r\n\r\n",
                "200 OK\r\nContent-Length: 1\r\n\r\n{",
            ] {
                let (mut socket, _) = listener.accept().unwrap();
                let reader = BufReader::new(&socket);
                for line in reader.lines() {
                    if line.unwrap().is_empty() {
                        break;
                    }
                }
                write!(socket, "HTTP/1.1 {response}").unwrap();
            }
        });
        tauri::async_runtime::block_on(async {
            let mut attempts = 0;
            let result = retry_transport(|| {
                attempts += 1;
                updater.check()
            })
            .await
            .unwrap();
            assert!(result.is_none());
            assert_eq!(attempts, 2);
            let mut attempts = 0;
            let result = retry_transport(|| {
                attempts += 1;
                updater.check()
            })
            .await;
            assert_eq!(
                update_error(result.err().unwrap(), "UPDATE_MANIFEST"),
                "UPDATE_MANIFEST"
            );
            assert_eq!(attempts, 1);
            assert!(!is_transport_failure(&UpdateError::MissingSignedVersion));
            assert_eq!(
                update_error(UpdateError::MissingSignedVersion, "UPDATE_DOWNLOAD"),
                "UPDATE_SIGNATURE"
            );
        });
        server.join().unwrap();
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
