#[cfg(target_os = "macos")]
mod desktop;
mod storage;

use serde_json::{json, Value};
use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::Duration,
};
use tauri::Manager;

#[derive(Default)]
struct RuntimeState {
    popup_busy: AtomicBool,
    save_lock: Mutex<()>,
}

#[tauri::command]
fn runtime_context() -> Value {
    json!({
        "kind": if cfg!(target_os = "macos") { "macos" } else { "ios" },
        "smokeTest": std::env::args().any(|argument| argument == "--smoke-test")
    })
}

#[tauri::command]
async fn load_state(app: tauri::AppHandle) -> Result<Option<Value>, String> {
    if std::env::args().any(|argument| argument == "--smoke-test") {
        return Ok(None);
    }
    let path = app
        .path()
        .app_data_dir()
        .map_err(|_| "无法获取日历数据目录")?
        .join("calendar-state.json");
    if let Some(state) = storage::read_state(&path)? {
        return Ok(Some(state));
    }
    #[cfg(target_os = "macos")]
    {
        let directory = app.path().data_dir().map_err(|_| "无法获取旧版数据目录")?;
        let home = app.path().home_dir().map_err(|_| "无法获取用户目录")?;
        return storage::legacy_state(&directory, &home);
    }
    #[cfg(not(target_os = "macos"))]
    Ok(None)
}

#[tauri::command]
async fn save_state(
    app: tauri::AppHandle,
    state: Value,
    runtime: tauri::State<'_, RuntimeState>,
) -> Result<(), String> {
    if std::env::args().any(|argument| argument == "--smoke-test") {
        return Ok(());
    }
    let _lock = runtime.save_lock.lock().map_err(|_| "日历数据正在保存")?;
    let path = app
        .path()
        .app_data_dir()
        .map_err(|_| "无法获取日历数据目录")?
        .join("calendar-state.json");
    storage::save_state(&path, &state)
}

#[tauri::command]
async fn fetch_holiday_year(year: u16) -> Result<Option<Value>, String> {
    if !(1901..=2100).contains(&year) {
        return Err("调休年份超出范围".into());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|_| "无法初始化数据请求")?;
    let mut response = client
        .get(format!(
            "https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/{year}.json"
        ))
        .send()
        .await
        .map_err(|_| "网络连接失败")?;
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !response.status().is_success() {
        return Err("调休数据下载失败".into());
    }
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "调休下载中断")? {
        if body.len() + chunk.len() > 1_000_000 {
            return Err("调休数据超过大小限制".into());
        }
        body.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&body)
        .map(Some)
        .map_err(|_| "调休数据不是有效 JSON".into())
}

#[tauri::command]
fn set_popup_busy(busy: bool, runtime: tauri::State<'_, RuntimeState>) {
    runtime.popup_busy.store(busy, Ordering::Relaxed);
}

#[tauri::command]
fn close_calendar(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|_| "无法收起日历")?;
    }
    Ok(())
}

#[tauri::command]
fn quit_calendar(app: tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    app.exit(0);
}

#[tauri::command]
fn frontend_ready(app: tauri::AppHandle, report: Value) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        desktop::show_calendar(&app);
        if std::env::args().any(|argument| argument == "--smoke-test") {
            if report.get("renderedCells").and_then(Value::as_u64) != Some(42)
                || report.get("cells").and_then(Value::as_u64) != Some(42)
                || report.get("lunar").and_then(Value::as_str) != Some("初一")
                || report.get("makeup").and_then(Value::as_bool) != Some(true)
                || report.pointer("/almanac/day").and_then(Value::as_str) != Some("己酉")
                || report.pointer("/almanac/fu").and_then(Value::as_str) != Some("正南")
                || report.pointer("/almanac/yiCount").and_then(Value::as_u64) != Some(21)
            {
                eprintln!("Tauri 前端与共享核心验证失败：{report}");
                app.exit(1);
                return Err("前端验证失败".into());
            }
            let window = app.get_webview_window("main").ok_or("主界面不存在")?;
            if !window.is_visible().unwrap_or(false) {
                app.exit(1);
                return Err("菜单栏日历未显示".into());
            }
            window.hide().map_err(|_| "日历收起失败")?;
            desktop::show_calendar(&app);
            if !window.is_visible().unwrap_or(false) {
                app.exit(1);
                return Err("日历重新打开失败".into());
            }
            println!("PASS：Tauri 原生窗口、WebView 前端、共享日历核心与 Rust 命令交互通过");
            app.exit(0);
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .manage(RuntimeState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init());
    #[cfg(target_os = "macos")]
    let builder = if std::env::args().any(|argument| argument == "--smoke-test") {
        // 冒烟模式已跳过持久化读写，允许与开发实例并行验证打包产物。
        builder
    } else {
        builder.plugin(tauri_plugin_single_instance::init(|app, _, _| {
            desktop::show_calendar(app)
        }))
    };
    let application = builder
        .invoke_handler(tauri::generate_handler![
            runtime_context,
            load_state,
            save_state,
            fetch_holiday_year,
            set_popup_busy,
            close_calendar,
            quit_calendar,
            frontend_ready
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            desktop::setup(app)?;
            if std::env::args().any(|argument| argument == "--smoke-test") {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_secs(30));
                    eprintln!("Tauri 前端启动验证超时");
                    handle.exit(1);
                });
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("拾日历初始化失败");
    application.run(|app, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen { .. } = event {
            desktop::show_calendar(app);
        }
    });
}
