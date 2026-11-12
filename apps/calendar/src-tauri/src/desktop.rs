use crate::RuntimeState;
use objc2_app_kit::{NSColor, NSWindow};
use std::{sync::atomic::Ordering, time::Duration};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, PhysicalPosition, WindowEvent,
};

const POPUP_CORNER_RADIUS: f64 = 20.0;

/// 仅在 setup 主线程调用；在原生内容视图裁切整棵 WebView，窗口四角真正透明。
fn round_popup(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    let pointer = window.ns_window()?.cast::<NSWindow>();
    // SAFETY: Tauri 的 setup 位于主线程，窗口仍由 WebviewWindow 持有。
    let native = unsafe { pointer.as_ref() }.ok_or(tauri::Error::InvalidWindowHandle)?;
    let content = native
        .contentView()
        .ok_or_else(|| std::io::Error::other("无法获取悬浮窗内容视图"))?;
    content.setWantsLayer(true);
    let layer = content
        .layer()
        .ok_or_else(|| std::io::Error::other("无法创建悬浮窗圆角图层"))?;
    layer.setCornerRadius(POPUP_CORNER_RADIUS);
    layer.setMasksToBounds(true);
    native.setOpaque(false);
    native.setBackgroundColor(Some(&NSColor::clearColor()));
    native.invalidateShadow();
    Ok(())
}

/// 从真实 AppKit 窗口读取裁切状态；通过主线程回调保证原生视图访问安全。
pub async fn verify_rounded_popup(window: &tauri::WebviewWindow) -> Result<(), String> {
    let (sender, receiver) = std::sync::mpsc::sync_channel(1);
    window
        .with_webview(move |webview| {
            let result = (|| {
                // SAFETY: with_webview 在主线程执行，原生窗口在回调期间有效。
                let native = unsafe { webview.ns_window().cast::<NSWindow>().as_ref() }
                    .ok_or("悬浮窗原生句柄不存在")?;
                let layer = native
                    .contentView()
                    .and_then(|view| view.layer())
                    .ok_or("悬浮窗圆角图层不存在")?;
                let clear_background = native.backgroundColor().alphaComponent() == 0.0;
                if (layer.cornerRadius() - POPUP_CORNER_RADIUS).abs() > f64::EPSILON
                    || !layer.masksToBounds()
                    || native.isOpaque()
                    || !clear_background
                    || !native.hasShadow()
                {
                    return Err("悬浮窗圆角、透明边角或系统阴影未生效");
                }
                Ok(())
            })();
            let _ = sender.send(result.map_err(str::to_owned));
        })
        .map_err(|_| "无法检查原生悬浮窗")?;
    tauri::async_runtime::spawn_blocking(move || {
        receiver
            .recv_timeout(Duration::from_secs(3))
            .map_err(|_| "原生悬浮窗检查超时".to_string())?
    })
    .await
    .map_err(|_| "原生悬浮窗检查线程失败")?
}

pub fn show_calendar(app: &tauri::AppHandle) {
    app.state::<RuntimeState>().menu_clock.wake();
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if let Some(tray) = app.tray_by_id("calendar") {
        if let Ok(Some(rect)) = tray.rect() {
            let scale = window.scale_factor().unwrap_or(1.0);
            let point = rect.position.to_physical::<f64>(scale);
            let icon = rect.size.to_physical::<f64>(scale);
            if let Ok(monitors) = window.available_monitors() {
                if let Some(monitor) = monitors.iter().find(|monitor| {
                    let origin = monitor.position();
                    let size = monitor.size();
                    point.x >= origin.x as f64
                        && point.x < origin.x as f64 + size.width as f64
                        && point.y >= origin.y as f64
                        && point.y < origin.y as f64 + size.height as f64
                }) {
                    if let Ok(size) = window.outer_size() {
                        let (x, y) = popup_position(
                            point.x + icon.width / 2.0,
                            point.y + icon.height,
                            size.width as f64,
                            size.height as f64,
                            monitor.position().x as f64,
                            monitor.position().y as f64,
                            monitor.size().width as f64,
                            monitor.size().height as f64,
                            monitor.scale_factor(),
                        );
                        let _ = window.set_position(PhysicalPosition::new(x, y));
                    }
                }
            }
        }
    }
    let _ = window.show();
    let _ = window.set_focus();
}

#[allow(clippy::too_many_arguments)]
fn popup_position(
    center: f64,
    bottom: f64,
    width: f64,
    height: f64,
    left: f64,
    top: f64,
    screen_width: f64,
    screen_height: f64,
    scale: f64,
) -> (i32, i32) {
    let margin = 8.0 * scale;
    let max_x = (left + screen_width - width - margin).max(left + margin);
    let max_y = (top + screen_height - height - margin).max(top + margin);
    (
        (center - width / 2.0).clamp(left + margin, max_x).round() as i32,
        (bottom + margin).clamp(top + margin, max_y).round() as i32,
    )
}

pub fn setup(app: &mut tauri::App) -> tauri::Result<()> {
    app.set_activation_policy(tauri::ActivationPolicy::Accessory);
    let clock = crate::read_saved_state(app.handle())
        .and_then(|value| crate::menu_clock::ClockPreferences::from_saved(value.as_ref()));
    match clock {
        Ok(settings) => {
            let _ = app.state::<RuntimeState>().menu_clock.update(settings);
        }
        Err(error) => eprintln!("菜单栏时钟采用默认设置：{error}"),
    }
    let open = MenuItem::with_id(app, "open", "打开i日历", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "设置与调休数据…", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出i日历", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &settings, &quit])?;
    let _tray = TrayIconBuilder::with_id("calendar")
        .icon(tauri::image::Image::from_bytes(include_bytes!(
            "../icons/tray.png"
        ))?)
        .icon_as_template(true)
        .tooltip("i日历 · 公农历与放假调休")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_calendar(app),
            "settings" => {
                show_calendar(app);
                let _ = app.emit("calendar:settings", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        show_calendar(app);
                    }
                }
            }
        })
        .build(app)?;
    crate::menu_clock::start(app.handle().clone());
    if let Some(window) = app.get_webview_window("main") {
        round_popup(&window)?;
        let _ = window.set_visible_on_all_workspaces(true);
        let handle = app.handle().clone();
        window.on_window_event(move |event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            WindowEvent::Focused(false) => {
                let app = handle.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_millis(180));
                    let busy = app
                        .state::<RuntimeState>()
                        .popup_busy
                        .load(Ordering::Relaxed);
                    if let Some(window) = app.get_webview_window("main") {
                        if !busy && !window.is_focused().unwrap_or(false) {
                            let _ = window.hide();
                        }
                    }
                });
            }
            _ => {}
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::popup_position;
    #[test]
    fn popup_is_clamped_inside_primary_and_negative_origin_monitors() {
        assert_eq!(
            popup_position(1400.0, 24.0, 400.0, 660.0, 0.0, 0.0, 1440.0, 900.0, 1.0),
            (1032, 32)
        );
        assert_eq!(
            popup_position(-1430.0, 24.0, 400.0, 660.0, -1440.0, 0.0, 1440.0, 900.0, 1.0),
            (-1432, 32)
        );
        assert_eq!(
            popup_position(1600.0, 48.0, 800.0, 1320.0, 0.0, 0.0, 2880.0, 1800.0, 2.0),
            (1200, 64)
        );
    }
}
