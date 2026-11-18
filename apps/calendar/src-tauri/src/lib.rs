#[cfg(target_os = "macos")]
mod app_update;
#[cfg(target_os = "macos")]
mod desktop;
#[cfg(target_os = "macos")]
mod launch_at_login;
#[cfg(any(target_os = "macos", target_os = "ios"))]
mod location;
#[cfg(target_os = "macos")]
mod menu_clock;
mod storage;
#[cfg(target_os = "macos")]
mod theme_export;

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
    #[cfg(target_os = "macos")]
    popup_height: std::sync::atomic::AtomicU32,
    #[cfg(target_os = "macos")]
    popup_motion: desktop::PopupMotion,
    save_lock: Mutex<()>,
    #[cfg(target_os = "macos")]
    menu_clock: menu_clock::MenuClock,
}

#[tauri::command]
fn runtime_context() -> Value {
    json!({
        "kind": if cfg!(target_os = "macos") { "macos" } else { "ios" },
        "smokeTest": std::env::args().any(|argument| argument == "--smoke-test")
    })
}

#[tauri::command]
async fn locate_sunlight(
    app: tauri::AppHandle,
    request_id: u64,
    request_permission: bool,
) -> Result<location::LocationFix, location::LocationFailure> {
    location::locate(app, request_id, request_permission).await
}

#[tauri::command]
fn cancel_sunlight_location(app: tauri::AppHandle, request_id: u64) -> Result<(), String> {
    location::cancel(app, request_id)
}

#[tauri::command]
async fn open_sunlight_settings(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return location::open_settings(app).await;
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Err("请在系统设置中查看定位服务".into())
    }
}

#[tauri::command]
async fn describe_sunlight_location(
    app: tauri::AppHandle,
    request_id: u64,
    latitude: f64,
    longitude: f64,
) -> Result<Option<String>, String> {
    location::describe(app, request_id, latitude, longitude).await
}

#[tauri::command]
fn app_update_available() -> bool {
    #[cfg(target_os = "macos")]
    return app_update::available();
    #[cfg(not(target_os = "macos"))]
    false
}

#[tauri::command]
fn launch_at_login_available() -> bool {
    #[cfg(target_os = "macos")]
    return launch_at_login::available();
    #[cfg(not(target_os = "macos"))]
    false
}

#[tauri::command]
fn get_launch_at_login(app: tauri::AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    return launch_at_login::get(&app);
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Err("此平台不支持开机自启".into())
    }
}

#[tauri::command]
fn set_launch_at_login(app: tauri::AppHandle, enabled: bool) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    return launch_at_login::set(&app, enabled);
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, enabled);
        Err("此平台不支持开机自启".into())
    }
}

#[tauri::command]
async fn check_app_update(app: tauri::AppHandle) -> Result<Option<Value>, String> {
    #[cfg(target_os = "macos")]
    return app_update::check(app).await.and_then(|release| {
        release
            .map(serde_json::to_value)
            .transpose()
            .map_err(|_| "应用更新信息无效".into())
    });
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Ok(None)
    }
}

#[tauri::command]
async fn download_app_update(
    app: tauri::AppHandle,
    version: String,
    progress: tauri::ipc::Channel<Value>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return app_update::download(app, version, progress).await;
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, version, progress);
        Err("此平台不支持应用内更新".into())
    }
}

#[tauri::command]
async fn install_app_update(app: tauri::AppHandle, version: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return app_update::install(app, version).await;
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, version);
        Err("此平台不支持应用内更新".into())
    }
}

#[tauri::command]
async fn load_state(app: tauri::AppHandle) -> Result<Option<Value>, String> {
    read_saved_state(&app)
}

fn read_saved_state(app: &tauri::AppHandle) -> Result<Option<Value>, String> {
    if std::env::args().any(|argument| argument == "--smoke-test") {
        return Ok(None);
    }
    let path = app
        .path()
        .app_data_dir()
        .map_err(|_| "无法获取日历数据目录")?
        .join("calendar-state.json");
    #[cfg(target_os = "macos")]
    {
        let directory = app.path().data_dir().map_err(|_| "无法获取旧版数据目录")?;
        let home = app.path().home_dir().map_err(|_| "无法获取用户目录")?;
        return storage::load_with_legacy(&path, &directory, &home);
    }
    #[cfg(not(target_os = "macos"))]
    storage::read_state(&path)
}

#[tauri::command]
async fn save_state(
    app: tauri::AppHandle,
    state: Value,
    runtime: tauri::State<'_, RuntimeState>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    runtime
        .menu_clock
        .update(menu_clock::ClockPreferences::from_saved(Some(&state))?)?;
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
async fn export_theme(
    app: tauri::AppHandle,
    name: String,
    content: String,
) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    return theme_export::save(app, name, content).await;
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, name, content);
        Err("此平台不支持原生保存对话框".into())
    }
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
fn resize_popup(app: tauri::AppHandle, height: f64) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return desktop::resize_popup(&app, height);
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, height);
        Ok(())
    }
}

#[tauri::command]
fn close_calendar(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    if let Some(window) = app.get_webview_window("main") {
        desktop::hide_calendar(&window).map_err(|_| "无法收起日历")?;
    }
    Ok(())
}

#[tauri::command]
fn quit_calendar(app: tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    app.exit(0);
}

#[tauri::command]
async fn frontend_ready(app: tauri::AppHandle, report: Value) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let arguments: Vec<_> = std::env::args().collect();
        let background = launch_at_login::background_start(arguments.iter().map(String::as_str));
        if !background {
            desktop::show_calendar(&app);
        }
        if std::env::args().any(|argument| argument == "--smoke-test") {
            if report.get("calculatorVerified").and_then(Value::as_bool) != Some(true)
                || report.get("releaseNotesVerified").and_then(Value::as_bool) != Some(true)
                || report.get("sunlightVerified").and_then(Value::as_bool) != Some(true)
                || report.get("themesVerified").and_then(Value::as_bool) != Some(true)
                || report.get("appUpdaterAvailable").and_then(Value::as_bool) != Some(false)
                || report
                    .get("launchAtLoginAvailable")
                    .and_then(Value::as_bool)
                    != Some(false)
                || report.get("renderedCells").and_then(Value::as_u64) != Some(42)
                || report
                    .pointer("/controlGeometry/year")
                    .and_then(Value::as_u64)
                    != Some(28)
                || report
                    .pointer("/controlGeometry/previous")
                    .and_then(Value::as_u64)
                    != Some(28)
                || report
                    .pointer("/controlGeometry/day")
                    .and_then(Value::as_u64)
                    != Some(40)
                || report.get("detailScrollable").and_then(Value::as_bool) != Some(false)
                || report.get("cells").and_then(Value::as_u64) != Some(42)
                || report.get("lunar").and_then(Value::as_str) != Some("初一")
                || report.get("makeup").and_then(Value::as_bool) != Some(true)
                || report.get("zodiac").and_then(Value::as_str) != Some("马")
                || report.get("constellation").and_then(Value::as_str) != Some("天蝎座")
                || report.pointer("/almanac/day").and_then(Value::as_str) != Some("己酉")
                || report.pointer("/almanac/fu").and_then(Value::as_str) != Some("正南")
                || report.pointer("/almanac/yiCount").and_then(Value::as_u64) != Some(21)
            {
                eprintln!("Tauri 前端与共享核心验证失败：{report}");
                app.exit(1);
                return Err("前端验证失败".into());
            }
            let window = app.get_webview_window("main").ok_or("主界面不存在")?;
            if background {
                if window.is_visible().unwrap_or(true) {
                    app.exit(1);
                    return Err("开机自启不应自动展开日历".into());
                }
                // 隔离启动验证完成后再打开，继续复用真实窗口生命周期冒烟。
                println!("PASS：开机自启模式保持面板隐藏且菜单栏已初始化");
                desktop::show_calendar(&app);
            }
            if !window.is_visible().unwrap_or(false) {
                app.exit(1);
                return Err("菜单栏日历未显示".into());
            }
            desktop::wait_for_motion_settle(&app)
                .await
                .inspect_err(|error| {
                    eprintln!("首次打开等待失败：{error}");
                    app.exit(1);
                })?;
            desktop::verify_rounded_popup(&window).await?;
            desktop::verify_content_height(&app)?;
            window.hide().map_err(|_| "日历收起失败")?;
            menu_clock::verify_smoke(&app).await?;
            desktop::show_calendar(&app);
            if !window.is_visible().unwrap_or(false) {
                app.exit(1);
                return Err("日历重新打开失败".into());
            }
            desktop::wait_for_motion_settle(&app)
                .await
                .inspect_err(|error| {
                    eprintln!("重开等待失败：{error}");
                    app.exit(1);
                })?;
            desktop::verify_rounded_popup(&window).await?;
            desktop::verify_content_height(&app)?;
            if let Err(error) = desktop::verify_popup_motion(&app).await {
                eprintln!("悬浮窗动效验证失败：{error}");
                app.exit(1);
                return Err(error);
            }
            if let Err(error) = desktop::verify_popup_reset(&app).await {
                eprintln!("悬浮窗页面恢复验证失败：{error}");
                app.exit(1);
                return Err(error);
            }
            println!("PASS：详情卡片完整展开，原生窗口按内容高度适配屏幕可用区域");
            println!("PASS：原生悬浮窗 20px 圆角、透明边角和系统阴影在收起重开后保持生效");
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
    let builder = builder
        .manage(app_update::AppUpdates::default())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .macos_launcher(tauri_plugin_autostart::MacosLauncher::LaunchAgent)
                .app_name("local.icalendar.app")
                .args([launch_at_login::ARGUMENT])
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build());
    #[cfg(target_os = "macos")]
    let builder = if std::env::args().any(|argument| argument == "--smoke-test") {
        // 冒烟模式已跳过持久化读写，允许与开发实例并行验证打包产物。
        builder
    } else {
        builder.plugin(tauri_plugin_single_instance::init(|app, arguments, _| {
            if !launch_at_login::background_start(arguments.iter().map(String::as_str)) {
                desktop::show_calendar(app);
            }
        }))
    };
    let context = tauri::generate_context!();
    #[cfg(target_os = "macos")]
    let context = {
        let mut context = context;
        for window in &mut context.config_mut().app.windows {
            // 避免登录启动时先闪现面板；普通启动由 frontend_ready 显示。
            window.visible = false;
        }
        context
    };
    let application = builder
        .invoke_handler(tauri::generate_handler![
            runtime_context,
            locate_sunlight,
            cancel_sunlight_location,
            open_sunlight_settings,
            describe_sunlight_location,
            app_update_available,
            launch_at_login_available,
            get_launch_at_login,
            set_launch_at_login,
            check_app_update,
            download_app_update,
            install_app_update,
            load_state,
            save_state,
            export_theme,
            fetch_holiday_year,
            set_popup_busy,
            resize_popup,
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
        .build(context)
        .expect("i日历初始化失败");
    application.run(|app, event| {
        #[cfg(target_os = "macos")]
        match event {
            tauri::RunEvent::Reopen { .. } => desktop::show_calendar(app),
            tauri::RunEvent::Resumed => app.state::<RuntimeState>().menu_clock.wake(),
            tauri::RunEvent::Exit => app.state::<RuntimeState>().menu_clock.stop(),
            _ => {}
        }
    });
}
